import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/session";
import { listRatePlans } from "@/lib/repo/rate-plans";
import { getPaymentSetup } from "@/lib/payments/service";
import { deleteRatePlanAction } from "@/app/(admin)/admin/actions-rates";
import { AdminHeader, Section, Card, Badge, EmptyState, Flash, euro } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";

const BOARD: Record<string, string> = { room_only: "Só alojamento", breakfast: "Com pequeno-almoço", half_board: "Meia pensão" };

export default async function RatePlansPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requirePagePermission("/admin/planos");
  const { ok, erro } = await searchParams;
  const [plans, setup] = await Promise.all([listRatePlans(), getPaymentSetup().catch(() => ({ any: false, methods: {} }))]);

  return (
    <>
      <AdminHeader
        title="Planos de tarifa"
        subtitle="Cada plano define o preço sobre a tarifa do dia, o regime, o cancelamento e quando se paga. O hóspede escolhe entre os planos ativos."
        action={{ href: "/admin/planos/novo", label: "Novo plano" }}
      />
      <Section>
        <Flash ok={ok} error={erro} />
        {!setup.any && plans.some((p) => p.active && p.paymentPolicy !== "hotel") && (
          <p role="alert" className="mb-6 rounded-2xl border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 px-4 py-3 text-sm">
            Há planos que cobram ao reservar, mas nenhum meio de pagamento está ativo. Esses planos não aparecem no site até ligar a Stripe ou a ifthenpay em Ligações.
          </p>
        )}
        {plans.length === 0 ? (
          <EmptyState message="Ainda não há planos. Crie o primeiro." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {plans.map((p) => {
              const price = [
                p.adjustPct ? `${p.adjustPct > 0 ? "+" : ""}${p.adjustPct}%` : "",
                p.adjustAmount ? `${p.adjustAmount > 0 ? "+" : ""}${euro.format(p.adjustAmount)}/noite` : "",
                p.perGuestAmount ? `+${euro.format(p.perGuestAmount)} por adulto/noite` : "",
              ].filter(Boolean);
              return (
                <Card key={p.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link href={`/admin/planos/${p.id}`} className="font-display text-lg tracking-tight hover:underline">
                        {p.name.pt}
                      </Link>
                      <p className="font-mono text-xs text-[var(--color-ink-muted)]">{p.id}</p>
                    </div>
                    <Badge tone={p.active ? "success" : "neutral"}>{p.active ? "Ativo" : "Inativo"}</Badge>
                  </div>
                  <ul className="mt-3 grid gap-1 text-sm text-[var(--color-ink-soft)]">
                    <li>{BOARD[p.board]} · preço: {price.length ? price.join(", ") : "tarifa do dia"}</li>
                    <li>
                      {p.refundable
                        ? `Cancelamento grátis até ${p.freeCancelDays} dia(s) antes; depois: ${p.cancelPenalty === "first_night" ? "1.ª noite" : p.cancelPenalty === "total" ? "total" : p.cancelPenalty === "percent" ? `${p.cancelPenaltyPct}%` : "sem custo"}`
                        : "Não reembolsável"}
                    </li>
                    <li>{p.paymentPolicy === "hotel" ? "Paga no hotel" : p.paymentPolicy === "full" ? "Paga tudo ao reservar" : `Sinal de ${p.depositPct}% ao reservar`}</li>
                    <li>
                      Estadia {p.minStay}
                      {p.maxStay ? `–${p.maxStay}` : "+"} noites
                      {p.minAdvanceDays ? ` · reserva com ${p.minAdvanceDays}+ dias` : ""}
                      {p.maxAdvanceDays != null ? ` · até ${p.maxAdvanceDays} dias antes` : ""}
                      {p.roomIds.length ? ` · só ${p.roomIds.join(", ")}` : " · todas as tipologias"}
                    </li>
                  </ul>
                  <div className="mt-4 flex gap-2">
                    <Link href={`/admin/planos/${p.id}`} className="rounded-full border border-[var(--color-line)] bg-white px-4 py-2 text-sm">
                      Editar
                    </Link>
                    <form action={deleteRatePlanAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <SubmitButton variant="danger" icon="trash" confirm={`Apagar o plano ${p.name.pt}?`}>
                        Apagar
                      </SubmitButton>
                    </form>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Section>
    </>
  );
}
