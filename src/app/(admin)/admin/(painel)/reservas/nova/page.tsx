import { requirePagePermission } from "@/lib/auth/session";
import { listRooms, listExtras } from "@/lib/repo/admin";
import { listRatePlans } from "@/lib/repo/rate-plans";
import { listChannels } from "@/lib/repo/channels";
import { getCalendar, today, addDays } from "@/lib/repo/availability";
import { createDeskBooking } from "@/app/(admin)/admin/actions-pms";
import { AdminHeader, Section, Card, Field, Flash, fieldClass, euro } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string; checkIn?: string; checkOut?: string; room?: string }>;
}) {
  await requirePagePermission("/admin/reservas/nova");
  const sp = await searchParams;
  const ci = /^\d{4}-\d{2}-\d{2}$/.test(sp.checkIn ?? "") ? sp.checkIn! : today();
  const co = /^\d{4}-\d{2}-\d{2}$/.test(sp.checkOut ?? "") && sp.checkOut! > ci ? sp.checkOut! : addDays(ci, 1);
  const [rooms, plans, extras, channels, calendar] = await Promise.all([
    listRooms(),
    listRatePlans(),
    listExtras(),
    listChannels().catch(() => []),
    getCalendar(null, ci, addDays(co, -1)).catch(() => []),
  ]);
  const extranets = channels.filter((c) => c.provider === "extranet");
  const freeFor = (roomId: string) => {
    const days = calendar.filter((d) => d.roomId === roomId);
    return days.length ? Math.min(...days.map((d) => (d.closed ? 0 : d.free))) : 0;
  };

  return (
    <>
      <AdminHeader title="Nova reserva" subtitle="Reserva ao balcão, por telefone ou e-mail, ou introdução de uma reserva feita numa extranet." />
      <Section>
        <Flash ok={sp.ok} error={sp.erro} />

        <form className="mb-6 flex flex-wrap items-end gap-3" action="/admin/reservas/nova">
          <Field label="Ver disponibilidade de" htmlFor="v-in">
            <input id="v-in" name="checkIn" type="date" defaultValue={ci} className={fieldClass} />
          </Field>
          <Field label="até" htmlFor="v-out">
            <input id="v-out" name="checkOut" type="date" defaultValue={co} className={fieldClass} />
          </Field>
          <button className="h-11 rounded-full border border-[var(--color-line)] bg-white px-4 text-sm">Atualizar</button>
        </form>
        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((r) => {
            const free = freeFor(r.id);
            return (
              <div key={r.id} className={`rounded-2xl border p-4 text-sm ${free > 0 ? "border-[var(--color-line)] bg-white" : "border-red-200 bg-red-50"}`}>
                <p className="font-medium">{r.name.pt}</p>
                <p className="text-[var(--color-ink-muted)]">
                  {free > 0 ? `${free} livre(s) em todas as noites` : "Esgotado ou fechado numa das noites"} · desde {euro.format(r.priceFrom)}
                </p>
              </div>
            );
          })}
        </div>

        <form action={createDeskBooking} className="grid max-w-5xl gap-6">
          <Card className="p-6">
            <h2 className="font-display text-lg tracking-tight">Estadia</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Chegada" htmlFor="checkIn">
                <input id="checkIn" name="checkIn" type="date" defaultValue={ci} required className={fieldClass} />
              </Field>
              <Field label="Partida" htmlFor="checkOut">
                <input id="checkOut" name="checkOut" type="date" defaultValue={co} required className={fieldClass} />
              </Field>
              <Field label="Adultos" htmlFor="adults">
                <input id="adults" name="adults" type="number" min={1} max={8} defaultValue={2} className={fieldClass} />
              </Field>
              <Field label="Crianças" htmlFor="children">
                <input id="children" name="children" type="number" min={0} max={6} defaultValue={0} className={fieldClass} />
              </Field>
              <Field label="Tipologia" htmlFor="roomId" className="lg:col-span-2">
                <select id="roomId" name="roomId" defaultValue={sp.room ?? rooms[0]?.id} required className={fieldClass}>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name.pt} (até {r.capacity} pessoas)
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tarifa" htmlFor="ratePlanId" className="lg:col-span-2">
                <select id="ratePlanId" name="ratePlanId" required className={fieldClass}>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name.pt}
                      {p.active ? "" : " (inativa no site)"}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {extras.length > 0 && (
              <fieldset className="mt-4">
                <legend className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">Extras</legend>
                <div className="flex flex-wrap gap-3">
                  {extras
                    .filter((e) => e.active)
                    .map((e) => (
                      <label key={e.id} className="flex items-center gap-2 rounded-xl border border-[var(--color-line)] px-3 py-2 text-sm">
                        <input type="checkbox" name="extras" value={e.id} className="h-4 w-4" />
                        {e.label.pt} · {euro.format(e.price)} {e.perNight ? "/noite" : ""}
                      </label>
                    ))}
                </div>
              </fieldset>
            )}
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Código promocional" htmlFor="promoCode">
                <input id="promoCode" name="promoCode" className={`${fieldClass} uppercase`} />
              </Field>
              <Field label="Total acordado (€)" htmlFor="totalOverride" hint="Opcional: substitui o preço calculado.">
                <input id="totalOverride" name="totalOverride" inputMode="decimal" className={fieldClass} />
              </Field>
              <label className="flex items-start gap-2 self-end pb-3 text-sm">
                <input type="checkbox" name="override" className="mt-0.5 h-4 w-4" />
                <span>Ignorar estadia mínima, fechos de chegada/partida e prazos da tarifa (nunca a lotação)</span>
              </label>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-display text-lg tracking-tight">Origem</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Origem" htmlFor="source">
                <select id="source" name="source" defaultValue="desk" className={fieldClass}>
                  <option value="desk">Balcão</option>
                  <option value="phone">Telefone</option>
                  <option value="email">E-mail</option>
                  <option value="walk_in">Sem reserva (walk-in)</option>
                  <option value="extranet">Plataforma (extranet)</option>
                </select>
              </Field>
              <Field label="Plataforma" htmlFor="channelId" hint={extranets.length ? "Só para origem «Plataforma»." : "Crie as extranets em Canais (OTAs)."}>
                <select id="channelId" name="channelId" className={fieldClass}>
                  <option value="">—</option>
                  {extranets.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Referência na plataforma" htmlFor="externalRef">
                <input id="externalRef" name="externalRef" className={`${fieldClass} font-mono`} />
              </Field>
              <Field label="Comissão (€)" htmlFor="commission">
                <input id="commission" name="commission" inputMode="decimal" className={fieldClass} />
              </Field>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-display text-lg tracking-tight">Hóspede</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Nome" htmlFor="firstName">
                <input id="firstName" name="firstName" required autoComplete="off" className={fieldClass} />
              </Field>
              <Field label="Apelido" htmlFor="lastName">
                <input id="lastName" name="lastName" required autoComplete="off" className={fieldClass} />
              </Field>
              <Field label="Email" htmlFor="email">
                <input id="email" name="email" type="email" autoComplete="off" className={fieldClass} />
              </Field>
              <Field label="Telefone" htmlFor="phone">
                <input id="phone" name="phone" type="tel" className={fieldClass} />
              </Field>
              <Field label="País" htmlFor="country">
                <input id="country" name="country" className={fieldClass} />
              </Field>
              <Field label="Língua dos e-mails" htmlFor="locale">
                <select id="locale" name="locale" defaultValue="pt" className={fieldClass}>
                  <option value="pt">Português</option>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                </select>
              </Field>
              <Field label="Notas" htmlFor="notes" className="sm:col-span-2 lg:col-span-3">
                <textarea id="notes" name="notes" rows={2} className={fieldClass} />
              </Field>
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input type="checkbox" name="notify" defaultChecked className="h-4 w-4" /> Enviar confirmação por e-mail ao hóspede
            </label>
          </Card>

          <div>
            <SubmitButton icon="check" pendingLabel="A verificar disponibilidade…">
              Criar reserva
            </SubmitButton>
          </div>
        </form>
      </Section>
    </>
  );
}
