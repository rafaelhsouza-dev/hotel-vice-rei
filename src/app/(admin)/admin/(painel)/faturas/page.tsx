import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/session";
import { activeInvoiceProvider, listInvoices } from "@/lib/invoicing/service";
import { AdminHeader, Section, TableWrap, Th, Td, Badge, EmptyState, euro, formatDate } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  await requirePagePermission("/admin/faturas");
  const [items, active] = await Promise.all([listInvoices(undefined, 300).catch(() => []), activeInvoiceProvider().catch(() => null)]);

  return (
    <>
      <AdminHeader
        title="Faturas"
        subtitle={
          active
            ? `Emitidas em ${active.provider.name}${active.config.mode === "test" ? " (modo teste)" : ""}. Para emitir, abra a reserva e use «Emitir fatura».`
            : "Nenhum programa de faturação ativo."
        }
      />
      <Section>
        {!active && (
          <p className="mb-6 rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm">
            A lei obriga a emitir faturas em software certificado pela AT, por isso o PMS não numera documentos. Ligue o programa que o hotel já usa (InvoiceXpress, Moloni ou Vendus) em{" "}
            <Link href="/admin/ligacoes" className="underline">Ligações</Link> e as faturas passam a ser emitidas a partir da conta do quarto.
          </p>
        )}
        {items.length === 0 ? (
          <EmptyState message="Ainda não foram emitidos documentos pelo PMS." />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-[var(--color-line)]">
                <tr>
                  <Th>Data</Th>
                  <Th>Número</Th>
                  <Th>Reserva</Th>
                  <Th>Cliente</Th>
                  <Th>Total</Th>
                  <Th>Estado</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-b border-[var(--color-line-soft)] align-top last:border-0">
                    <Td className="whitespace-nowrap text-xs">{formatDate(i.createdAt, true)}</Td>
                    <Td className="font-mono text-xs">{i.number || "—"}</Td>
                    <Td>
                      {i.bookingId ? (
                        <Link href={`/admin/reservas/${i.bookingId}#faturas`} className="font-mono text-xs hover:underline">
                          {i.reference}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="text-xs">{i.customerName}</Td>
                    <Td className="font-medium">{euro.format(i.total)}</Td>
                    <Td>
                      <Badge tone={i.status === "issued" ? "success" : i.status === "error" ? "danger" : "neutral"}>
                        {i.status === "issued" ? "Emitida" : i.status === "error" ? "Erro" : "Rascunho"}
                      </Badge>
                      {i.message && <span className="mt-1 block max-w-xs text-xs text-red-700">{i.message}</span>}
                    </Td>
                    <Td>
                      {i.pdfUrl && (
                        <a href={i.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent-deep)] underline">
                          PDF
                        </a>
                      )}
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
