import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/session";
import { getSibaConfig, listPendingGuests, overdueCount } from "@/lib/siba/service";
import { countryNamePt } from "@/lib/siba/countries";
import { sendSibaPending, markSibaSent } from "@/app/(admin)/admin/actions-siba";
import { AdminHeader, Section, Card, Badge, Flash, Stat, TableWrap, Th, Td, EmptyState, formatDate } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";

export default async function SibaPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requirePagePermission("/admin/siba");
  const { ok, erro } = await searchParams;
  const [{ enabled, config, autoSend }, pending, overdue] = await Promise.all([getSibaConfig(), listPendingGuests(), overdueCount()]);
  const ready = pending.filter((g) => g.problems.length === 0);
  const incomplete = pending.filter((g) => g.problems.length > 0);

  return (
    <>
      <AdminHeader
        title="SIBA — boletins de alojamento"
        subtitle="Hóspedes estrangeiros já chegados que ainda não foram comunicados. Prazo legal: 3 dias úteis após a entrada."
      />
      <Section>
        <Flash ok={ok} error={erro} />
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Prontos a enviar" value={ready.length} />
          <Stat label="Com dados em falta" value={incomplete.length} tone={incomplete.length ? "warning" : "neutral"} />
          <Stat label="Fora de prazo" value={overdue} tone={overdue ? "danger" : "neutral"} />
          <Stat
            label="Ligação"
            value={enabled ? (config.mode === "live" ? "Produção" : "Testes") : "Desligada"}
            hint={enabled ? (autoSend ? "Envio automático de hora a hora" : "Envio manual") : <Link href="/admin/ligacoes?s=siba" className="underline">Configurar</Link>}
          />
        </div>

        <Card className="mb-6 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <form action={sendSibaPending}>
              <SubmitButton icon="shield" pendingLabel="A enviar…" confirm={`Enviar ${ready.length} boletim(ns) ao SIBA (${config.mode === "live" ? "produção" : "testes"})?`}>
                Enviar {ready.length} ao SIBA
              </SubmitButton>
            </form>
            <a href="/admin/siba/ficheiro?formato=dat" className="rounded-full border border-[var(--color-line)] bg-white px-4 py-2 text-sm">
              Descarregar ficheiro .DAT (portal)
            </a>
            <a href="/admin/siba/ficheiro?formato=xml" className="rounded-full border border-[var(--color-line)] bg-white px-4 py-2 text-sm">
              Descarregar XML
            </a>
          </div>
          <p className="mt-3 text-xs text-[var(--color-ink-muted)]">
            Se o webservice falhar, descarregue o ficheiro e carregue-o em siba.ssi.gov.pt → Carregamento de ficheiros (só se o hotel estiver inscrito nesse modo). Depois marque-os como enviados.
          </p>
          {ready.length > 0 && (
            <form action={markSibaSent} className="mt-3">
              {ready.map((g) => (
                <input key={g.guestId} type="hidden" name="guestIds" value={g.guestId} />
              ))}
              <SubmitButton variant="ghost" confirm="Confirma que estes boletins foram aceites no portal do SIBA?">
                Marcar os {ready.length} como enviados manualmente
              </SubmitButton>
            </form>
          )}
        </Card>

        {pending.length === 0 ? (
          <EmptyState message="Não há boletins por enviar." />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-[var(--color-line)]">
                <tr>
                  <Th>Hóspede</Th>
                  <Th>Reserva</Th>
                  <Th>Entrada</Th>
                  <Th>Nacionalidade</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody>
                {pending.map((g) => (
                  <tr key={g.guestId} className="border-b border-[var(--color-line-soft)] align-top last:border-0">
                    <Td className="font-medium">{g.name}</Td>
                    <Td>
                      <Link href={`/admin/reservas/${g.bookingId}#hospedes`} className="font-mono text-xs hover:underline">
                        {g.reference}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap text-xs">{formatDate(g.checkIn)}</Td>
                    <Td className="text-xs">{countryNamePt(g.bulletin.nationality) ?? g.bulletin.nationality}</Td>
                    <Td className="text-xs">
                      {g.problems.length > 0 ? (
                        <>
                          <Badge tone="warning">Dados em falta</Badge>
                          <ul className="mt-1 list-disc pl-4 text-red-700">
                            {g.problems.map((p) => (
                              <li key={p}>{p}</li>
                            ))}
                          </ul>
                        </>
                      ) : g.status === "error" ? (
                        <>
                          <Badge tone="danger">Recusado</Badge>
                          <span className="mt-1 block text-red-700">{g.message}</span>
                        </>
                      ) : (
                        <Badge tone="success">Pronto</Badge>
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
