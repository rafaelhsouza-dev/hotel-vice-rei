import { requirePagePermission } from "@/lib/auth/session";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getChannel, getMaskedCredentials } from "@/lib/repo/channels";
import { getRooms } from "@/lib/repo/content";
import { getAdapter } from "@/lib/channels/registry";
import {
  saveChannel,
  saveChannelCredentials,
  saveRoomMapping,
  syncChannelAction,
  testChannelAction,
} from "@/app/(admin)/admin/actions-channels";
import {
  AdminHeader, Section, Card, Badge, Flash, fieldClass, labelClass,
} from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function ChannelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  await requirePagePermission("/admin/integracoes/x");
  const { id } = await params;
  const { ok, erro } = await searchParams;

  const channel = await getChannel(id).catch(() => null);
  if (!channel) notFound();

  const adapter = getAdapter(channel.provider);
  const [masked, rooms] = await Promise.all([
    getMaskedCredentials(id),
    getRooms().catch(() => []),
  ]);

  const usesIcal = adapter.id === "ical";
  const mapped = Object.values(channel.roomMap).filter((m) =>
    usesIcal ? m.icalUrl : m.externalRoomId,
  ).length;

  return (
    <>
      <AdminHeader
        title={channel.name}
        subtitle={`${adapter.name} · ${mapped} de ${rooms.length} tipologias mapeadas.`}
      />

      <Section>
        <Flash ok={ok} error={erro} />

        <Link
          href="/admin/integracoes"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-accent-deep)]"
        >
          <Icon name="close" width={13} height={13} />
          Voltar às integrações
        </Link>

        {/* --- what this channel can do ----------------------------------- */}
        <Card className="mt-4 p-6">
          <h2 className="font-display text-lg tracking-tight">Como funciona</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--color-ink-soft)]">
            {adapter.availabilityNote}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone={adapter.capabilities.importReservations ? "success" : "neutral"}>
              {adapter.capabilities.importReservations ? "Importa reservas" : "Não importa reservas"}
            </Badge>
            <Badge tone={adapter.capabilities.exportAvailability ? "success" : "neutral"}>
              {adapter.capabilities.exportAvailability
                ? "Envia disponibilidade"
                : "Não envia disponibilidade"}
            </Badge>
            <Badge tone={adapter.capabilities.exportRates ? "success" : "neutral"}>
              {adapter.capabilities.exportRates ? "Envia preços" : "Sem preços"}
            </Badge>
            <Badge tone={adapter.capabilities.webhooks ? "success" : "neutral"}>
              {adapter.capabilities.webhooks ? "Tempo real" : "Por sondagem"}
            </Badge>
          </div>
          <a
            href={adapter.docsUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-[var(--color-accent-deep)] hover:underline"
          >
            Documentação oficial
            <Icon name="link" width={13} height={13} />
          </a>
        </Card>

        {/* --- general settings -------------------------------------------- */}
        <Card className="mt-6 p-6">
          <h2 className="font-display text-lg tracking-tight">Definições</h2>
          <form action={saveChannel} className="mt-4 grid gap-4 sm:grid-cols-12">
            <input type="hidden" name="id" value={channel.id} />
            <input type="hidden" name="provider" value={channel.provider} />
            <div className="sm:col-span-6">
              <label className={labelClass} htmlFor="name">
                Nome apresentado
              </label>
              <input id="name" name="name" defaultValue={channel.name} className={fieldClass} />
            </div>
            <div className="flex items-end sm:col-span-4">
              <label className="flex items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={channel.enabled}
                  className="h-4 w-4 rounded border-[var(--color-line)]"
                />
                Canal ativo
              </label>
            </div>
            <div className="flex items-end sm:col-span-2">
              <SubmitButton pendingLabel="A guardar…">Guardar</SubmitButton>
            </div>
          </form>
        </Card>

        {/* --- credentials -------------------------------------------------- */}
        {adapter.credentialFields.length > 0 && (
          <Card className="mt-6 p-6">
            <h2 className="font-display text-lg tracking-tight">Credenciais</h2>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              Guardadas cifradas. Os campos secretos aparecem mascarados — deixe em branco para
              manter o valor atual.
            </p>
            <form action={saveChannelCredentials} className="mt-4 grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={channel.id} />
              {adapter.credentialFields.map((field) => (
                <div key={field.key}>
                  <label className={labelClass} htmlFor={`cred.${field.key}`}>
                    {field.label}
                  </label>
                  <input
                    id={`cred.${field.key}`}
                    name={`cred.${field.key}`}
                    type={field.secret ? "password" : "text"}
                    autoComplete="off"
                    placeholder={masked[field.key] || ""}
                    className={fieldClass}
                  />
                  {field.hint && (
                    <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{field.hint}</p>
                  )}
                </div>
              ))}
              <div className="sm:col-span-2">
                <SubmitButton pendingLabel="A guardar…">Guardar credenciais</SubmitButton>
              </div>
            </form>
          </Card>
        )}

        {/* --- room mapping ------------------------------------------------- */}
        <Card className="mt-6 p-6">
          <h2 className="font-display text-lg tracking-tight">Mapeamento de tipologias</h2>
          <p className="mt-1 max-w-3xl text-sm text-[var(--color-ink-muted)]">
            {usesIcal
              ? "Cole o endereço do calendário que a plataforma exporta para cada tipologia. As datas ocupadas passam a bloquear a venda no site."
              : "Indique o identificador que a plataforma usa para cada tipologia. Sem este mapeamento, nada é sincronizado."}
          </p>

          <div className="mt-5 space-y-4">
            {rooms.map((room) => {
              const map = channel.roomMap[room.id] ?? {
                externalRoomId: "",
                externalRateId: "",
                icalUrl: "",
              };
              return (
                <form
                  key={room.id}
                  action={saveRoomMapping}
                  className="grid gap-3 rounded-2xl border border-[var(--color-line-soft)] p-4 sm:grid-cols-12"
                >
                  <input type="hidden" name="channelId" value={channel.id} />
                  <input type="hidden" name="roomId" value={room.id} />
                  <div className="sm:col-span-3">
                    <p className="text-sm font-medium">{room.name.pt}</p>
                    <p className="text-xs text-[var(--color-ink-muted)]">{room.id}</p>
                  </div>

                  {usesIcal ? (
                    <>
                      <input type="hidden" name="externalRoomId" value={map.externalRoomId} />
                      <input type="hidden" name="externalRateId" value={map.externalRateId} />
                      <div className="sm:col-span-7">
                        <label className="sr-only" htmlFor={`ical-${room.id}`}>
                          Endereço do calendário para {room.name.pt}
                        </label>
                        <input
                          id={`ical-${room.id}`}
                          name="icalUrl"
                          type="url"
                          inputMode="url"
                          placeholder="https://…/calendar.ics"
                          defaultValue={map.icalUrl}
                          className={fieldClass}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <input type="hidden" name="icalUrl" value={map.icalUrl} />
                      <div className="sm:col-span-4">
                        <label className="sr-only" htmlFor={`room-${room.id}`}>
                          ID externo do quarto para {room.name.pt}
                        </label>
                        <input
                          id={`room-${room.id}`}
                          name="externalRoomId"
                          placeholder="ID do quarto"
                          defaultValue={map.externalRoomId}
                          className={fieldClass}
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="sr-only" htmlFor={`rate-${room.id}`}>
                          ID do plano tarifário para {room.name.pt}
                        </label>
                        <input
                          id={`rate-${room.id}`}
                          name="externalRateId"
                          placeholder="ID da tarifa"
                          defaultValue={map.externalRateId}
                          className={fieldClass}
                        />
                      </div>
                    </>
                  )}

                  <div className="flex items-center justify-end sm:col-span-2">
                    <SubmitButton variant="ghost" pendingLabel="…">
                      Guardar
                    </SubmitButton>
                  </div>
                </form>
              );
            })}
          </div>
        </Card>

        {/* --- run it ------------------------------------------------------- */}
        <Card className="mt-6 p-6">
          <h2 className="font-display text-lg tracking-tight">Ligação</h2>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Teste valida as credenciais sem alterar nada. Sincronizar importa reservas e,
            quando o canal o permite, envia a disponibilidade atual.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <form action={testChannelAction}>
              <input type="hidden" name="id" value={channel.id} />
              <SubmitButton variant="ghost" icon="shield" pendingLabel="A testar…">
                Testar ligação
              </SubmitButton>
            </form>
            <form action={syncChannelAction}>
              <input type="hidden" name="id" value={channel.id} />
              <SubmitButton icon="sync" pendingLabel="A sincronizar…">
                Sincronizar agora
              </SubmitButton>
            </form>
          </div>
        </Card>
      </Section>
    </>
  );
}
