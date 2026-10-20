import { requirePagePermission } from "@/lib/auth/session";
import Link from "next/link";
import { listChannels, listSyncLog, listChannelReservations } from "@/lib/repo/channels";
import { getIcalToken } from "@/lib/repo/ical-token";
import { getRooms } from "@/lib/repo/content";
import { ADAPTERS } from "@/lib/channels/registry";
import { rotateIcalTokenAction } from "@/app/(admin)/admin/actions-channels";
import {
  AdminHeader, Section, Card, TableWrap, Th, Td, EmptyState, Badge, Flash,
} from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Icon } from "@/components/Icon";
import { CopyField } from "@/components/admin/CopyField";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const STATUS_TONE = {
  ok: "success",
  error: "danger",
  never: "neutral",
  disabled: "neutral",
} as const;

const STATUS_LABEL = {
  ok: "A funcionar",
  error: "Com erro",
  never: "Por ligar",
  disabled: "Desativado",
} as const;

function when(iso: string | null): string {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleString("pt-PT", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Lisbon",
  });
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  await requirePagePermission("/admin/integracoes");
  const { ok, erro } = await searchParams;

  let channels: Awaited<ReturnType<typeof listChannels>> = [];
  let log: Awaited<ReturnType<typeof listSyncLog>> = [];
  let reservations: Awaited<ReturnType<typeof listChannelReservations>> = [];
  let token = "";
  let rooms: Awaited<ReturnType<typeof getRooms>> = [];

  try {
    [channels, log, reservations, token, rooms] = await Promise.all([
      listChannels(),
      listSyncLog(20),
      listChannelReservations(15),
      getIcalToken(),
      getRooms(),
    ]);
  } catch {
    /* handled by the empty states below */
  }

  const base = SITE_URL;
  const active = channels.filter((c) => c.enabled).length;
  const failing = channels.filter((c) => c.status === "error").length;

  return (
    <>
      <AdminHeader
        title="Integrações"
        subtitle={
          channels.length === 0
            ? "Ligue o site às plataformas de reserva."
            : `${active} de ${channels.length} canais ativos${failing > 0 ? ` · ${failing} com erro` : ""}.`
        }
      />

      <Section>
        <Flash ok={ok} error={erro} />

        {/* --- channels --------------------------------------------------- */}
        {channels.length === 0 ? (
          <EmptyState message="Sem canais configurados. Verifique a ligação à base de dados." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {channels.map((channel) => {
              const adapter = ADAPTERS.find((a) => a.id === channel.provider);
              return (
                <Card key={channel.id} className="flex flex-col p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-display text-lg tracking-tight">{channel.name}</h2>
                      <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                        Última sincronização: {when(channel.lastSyncAt)}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[channel.status]}>
                      {STATUS_LABEL[channel.status]}
                    </Badge>
                  </div>

                  {adapter && (
                    <p className="mt-3 text-sm leading-relaxed text-[var(--color-ink-soft)]">
                      {adapter.availabilityNote}
                    </p>
                  )}

                  {channel.lastError && (
                    <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800">
                      {channel.lastError}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {adapter?.selfServe ? (
                      <Badge tone="success">Ligação imediata</Badge>
                    ) : (
                      <Badge tone="warning">Requer contrato</Badge>
                    )}
                    {adapter?.capabilities.exportRates && <Badge>Preços</Badge>}
                    {adapter?.capabilities.exportRestrictions && <Badge>Restrições</Badge>}
                  </div>

                  <div className="mt-5 flex items-center gap-3 border-t border-[var(--color-line-soft)] pt-4">
                    <Link
                      href={`/admin/integracoes/${channel.id}`}
                      className="inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-deep)]"
                    >
                      <Icon name="edit" width={14} height={14} />
                      Configurar
                    </Link>
                    {adapter && (
                      <a
                        href={adapter.docsUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-accent-deep)]"
                      >
                        Documentação
                        <Icon name="link" width={13} height={13} />
                      </a>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* --- our published feeds ---------------------------------------- */}
        <Card className="mt-8 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg tracking-tight">
                Os nossos calendários públicos
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-[var(--color-ink-soft)]">
                Cole estes endereços na plataforma para que ela importe as datas já ocupadas no
                nosso site. O endereço contém uma chave secreta — não o publique.
              </p>
            </div>
            <form action={rotateIcalTokenAction}>
              <SubmitButton
                icon="sync"
                pendingLabel="A gerar…"
                confirm="Gerar um endereço novo invalida os atuais em todas as plataformas. Continuar?"
              >
                Gerar novo endereço
              </SubmitButton>
            </form>
          </div>

          {token ? (
            <div className="mt-5 space-y-3">
              <CopyField
                label="Todas as tipologias"
                value={`${base}/api/ical/todos?token=${token}`}
              />
              {rooms.map((room) => (
                <CopyField
                  key={room.id}
                  label={room.name.pt}
                  value={`${base}/api/ical/${room.id}?token=${token}`}
                />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--color-ink-muted)]">
              O endereço é gerado assim que a base de dados estiver disponível.
            </p>
          )}
        </Card>

        {/* --- reservations imported from channels ------------------------ */}
        <div className="mt-8">
          <h2 className="font-display text-lg tracking-tight">Reservas vindas das plataformas</h2>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Estas reservas bloqueiam automaticamente a disponibilidade no site.
          </p>
          <div className="mt-4">
            {reservations.length === 0 ? (
              <EmptyState message="Ainda não foram importadas reservas." />
            ) : (
              <TableWrap>
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="border-b border-[var(--color-line)]">
                    <tr>
                      <Th>Plataforma</Th>
                      <Th>Hóspede</Th>
                      <Th>Tipologia</Th>
                      <Th>Estadia</Th>
                      <Th>Estado</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-[var(--color-line-soft)] last:border-0"
                      >
                        <Td>
                          <p className="font-medium">{r.channelName}</p>
                          <p className="text-xs text-[var(--color-ink-muted)]">{r.externalId}</p>
                        </Td>
                        <Td>{r.guestName || <span className="text-[var(--color-ink-muted)]">Não divulgado</span>}</Td>
                        <Td className="text-[var(--color-ink-soft)]">{r.roomName}</Td>
                        <Td className="text-[var(--color-ink-soft)]">
                          {r.checkIn} → {r.checkOut}
                        </Td>
                        <Td>
                          <Badge tone={r.status === "confirmed" ? "success" : "neutral"}>
                            {r.status === "confirmed" ? "Confirmada" : "Cancelada"}
                          </Badge>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </div>
        </div>

        {/* --- sync log ---------------------------------------------------- */}
        <div className="mt-8">
          <h2 className="font-display text-lg tracking-tight">Histórico de sincronização</h2>
          <div className="mt-4">
            {log.length === 0 ? (
              <EmptyState message="Sem sincronizações registadas." />
            ) : (
              <TableWrap>
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="border-b border-[var(--color-line)]">
                    <tr>
                      <Th>Quando</Th>
                      <Th>Canal</Th>
                      <Th>Ação</Th>
                      <Th>Resultado</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {log.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-b border-[var(--color-line-soft)] last:border-0"
                      >
                        <Td className="whitespace-nowrap text-[var(--color-ink-soft)]">
                          {when(entry.createdAt)}
                        </Td>
                        <Td>{entry.channelName}</Td>
                        <Td className="text-[var(--color-ink-soft)]">
                          <span className="inline-flex items-center gap-1.5">
                            <Icon
                              name={entry.direction === "in" ? "upload" : "link"}
                              width={13}
                              height={13}
                              className={entry.direction === "in" ? "rotate-180" : ""}
                            />
                            {entry.action}
                          </span>
                        </Td>
                        <Td>
                          <Badge
                            tone={
                              entry.status === "ok"
                                ? "success"
                                : entry.status === "error"
                                  ? "danger"
                                  : "warning"
                            }
                          >
                            {entry.status === "ok" ? "OK" : entry.status === "error" ? "Erro" : "Ignorado"}
                          </Badge>
                          {entry.message && (
                            <p className="mt-1 max-w-md text-xs text-[var(--color-ink-muted)]">
                              {entry.message}
                            </p>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </div>
        </div>
      </Section>
    </>
  );
}
