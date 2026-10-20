import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/session";
import { listPayments, getPaymentSetup } from "@/lib/payments/service";
import { queryOne } from "@/lib/db";
import { AdminHeader, Section, TableWrap, Th, Td, Badge, EmptyState, Stat, euro, formatDate } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const METHOD: Record<string, string> = { card: "Cartão", mbway: "MB WAY", multibanco: "Multibanco", cash: "Numerário", transfer: "Transferência", other: "Outro" };
const STATUS: Record<string, [string, "success" | "warning" | "neutral" | "danger"]> = {
  succeeded: ["Concluído", "success"],
  pending: ["Pendente", "warning"],
  failed: ["Falhou", "danger"],
  expired: ["Expirado", "neutral"],
  cancelled: ["Cancelado", "neutral"],
};

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePagePermission("/admin/pagamentos");
  const sp = await searchParams;
  const status = sp.status && STATUS[sp.status] ? sp.status : undefined;
  const [items, setup, month] = await Promise.all([
    listPayments({ status, limit: 300 }),
    getPaymentSetup().catch(() => ({ any: false, methods: {} as Record<string, string> })),
    queryOne<Record<string, string>>(
      `SELECT
         COALESCE(sum(amount) FILTER (WHERE kind='payment' AND status='succeeded' AND created_at >= date_trunc('month', now())),0)::text AS received,
         COALESCE(sum(amount) FILTER (WHERE kind='refund' AND status='succeeded' AND created_at >= date_trunc('month', now())),0)::text AS refunded,
         count(*) FILTER (WHERE status='pending')::text AS pending,
         COALESCE(sum(amount) FILTER (WHERE kind='payment' AND status='succeeded' AND provider <> 'manual' AND created_at >= date_trunc('month', now())),0)::text AS online
       FROM payments`,
    ),
  ]);

  return (
    <>
      <AdminHeader title="Pagamentos" subtitle="Todos os movimentos: online (Stripe, ifthenpay) e registados no balcão." />
      <Section>
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Recebido este mês" value={euro.format(Number(month?.received ?? 0))} />
          <Stat label="Dos quais online" value={euro.format(Number(month?.online ?? 0))} />
          <Stat label="Devolvido este mês" value={euro.format(Number(month?.refunded ?? 0))} />
          <Stat label="Pendentes" value={month?.pending ?? 0} tone={Number(month?.pending) ? "warning" : "neutral"} />
        </div>
        {!setup.any && (
          <p className="mb-6 rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm">
            Nenhum meio de pagamento online está ativo. O site aceita reservas com pagamento no hotel. Para cobrar online, configure a Stripe ou a ifthenpay em{" "}
            <Link href="/admin/ligacoes" className="underline">Ligações</Link>.
          </p>
        )}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {[["", "Todos"], ...Object.entries(STATUS).map(([k, v]) => [k, v[0]])].map(([k, label]) => (
            <Link
              key={k}
              href={k ? `/admin/pagamentos?status=${k}` : "/admin/pagamentos"}
              className={`rounded-full px-3.5 py-1.5 text-sm ${(status ?? "") === k ? "bg-[var(--color-ink)] text-white" : "border border-[var(--color-line)] bg-white"}`}
            >
              {label}
            </Link>
          ))}
        </div>
        {items.length === 0 ? (
          <EmptyState message="Sem movimentos." />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-[var(--color-line)]">
                <tr>
                  <Th>Data</Th>
                  <Th>Reserva</Th>
                  <Th>Prestador</Th>
                  <Th>Meio</Th>
                  <Th>Valor</Th>
                  <Th>Estado</Th>
                  <Th>Referência</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--color-line-soft)] last:border-0">
                    <Td className="whitespace-nowrap text-xs">{formatDate(p.createdAt, true)}</Td>
                    <Td>
                      {p.bookingId ? (
                        <Link href={`/admin/reservas/${p.bookingId}#pagamentos`} className="hover:underline">
                          <span className="font-mono text-xs">{p.bookingReference}</span> {p.guestName}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="text-xs">{p.provider === "manual" ? `Balcão${p.createdBy ? ` · ${p.createdBy}` : ""}` : p.provider}</Td>
                    <Td className="text-xs">{METHOD[p.method] ?? p.method}</Td>
                    <Td className="font-medium">
                      {p.kind === "refund" ? "−" : ""}
                      {euro.format(p.amount)}
                    </Td>
                    <Td>
                      <Badge tone={STATUS[p.status]?.[1] ?? "neutral"}>{STATUS[p.status]?.[0] ?? p.status}</Badge>
                    </Td>
                    <Td className="font-mono text-[11px] text-[var(--color-ink-muted)]">
                      {p.mbReference ? `${p.mbEntity} / ${p.mbReference}` : p.providerRef.slice(0, 28)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Section>
    </>
  );
}
