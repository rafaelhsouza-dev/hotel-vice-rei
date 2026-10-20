import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/session";
import { listChannels } from "@/lib/repo/channels";
import { listRooms } from "@/lib/repo/admin";
import { getInventoryTotals } from "@/lib/repo/availability";
import { removeExtranet, saveExtranet } from "@/app/(admin)/admin/actions-extranet";
import { AdminHeader, Section, Card, Badge, Field, Flash, fieldClass } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";

const SUGGESTIONS = ["Booking.com", "Expedia", "Agoda", "Trip.com", "Hotelbeds", "HRS", "Despegar", "HotelSpecials", "Weekendjeweg", "Atrápalo", "Destinia", "Logitravel", "Airbnb"];

type Settings = {
  allotments?: Record<string, number>;
  commissionPct?: number;
  extranetUrl?: string;
  contact?: string;
  notes?: string;
};

export default async function ExtranetsPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requirePagePermission("/admin/integracoes/extranets");
  const { ok, erro } = await searchParams;
  const [channels, rooms, totals] = await Promise.all([listChannels(), listRooms(), getInventoryTotals().catch(() => ({} as Record<string, number>))]);
  const extranets = channels.filter((c) => c.provider === "extranet");
  const held: Record<string, number> = {};
  for (const c of extranets.filter((x) => x.enabled)) {
    for (const [room, n] of Object.entries((c.settings as Settings).allotments ?? {})) held[room] = (held[room] ?? 0) + n;
  }

  const form = (c: (typeof extranets)[number] | null) => {
    const st = (c?.settings ?? {}) as Settings;
    const key = c?.id ?? "novo";
    return (
      <form action={saveExtranet} className="grid gap-4">
        <input type="hidden" name="id" value={c?.id ?? ""} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Plataforma" htmlFor={`n-${key}`}>
            <input id={`n-${key}`} name="name" list="ota-names" defaultValue={c?.name ?? ""} required className={fieldClass} />
          </Field>
          <Field label="Comissão (%)" htmlFor={`c-${key}`}>
            <input id={`c-${key}`} name="commissionPct" inputMode="decimal" defaultValue={st.commissionPct ?? ""} className={fieldClass} />
          </Field>
          <Field label="Endereço da extranet" htmlFor={`u-${key}`}>
            <input id={`u-${key}`} name="extranetUrl" type="url" defaultValue={st.extranetUrl ?? ""} placeholder="https://admin.booking.com" className={fieldClass} />
          </Field>
          <Field label="Gestor de conta / contacto" htmlFor={`ct-${key}`}>
            <input id={`ct-${key}`} name="contact" defaultValue={st.contact ?? ""} className={fieldClass} />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">Contingente: quartos reservados para esta plataforma, por noite</legend>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {rooms.map((r) => (
              <Field key={r.id} label={`${r.name.pt} (de ${totals[r.id] ?? 0})`} htmlFor={`a-${key}-${r.id}`}>
                <input
                  id={`a-${key}-${r.id}`}
                  name={`allot.${r.id}`}
                  type="number"
                  min={0}
                  max={totals[r.id] ?? 0}
                  defaultValue={st.allotments?.[r.id] ?? 0}
                  className={fieldClass}
                />
              </Field>
            ))}
          </div>
        </fieldset>
        <Field label="Notas (como fechar datas, prazos de pagamento da OTA…)" htmlFor={`no-${key}`}>
          <textarea id={`no-${key}`} name="notes" rows={2} defaultValue={st.notes ?? ""} className={fieldClass} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="enabled" defaultChecked={c?.enabled ?? true} className="h-4 w-4" /> Ativa (o contingente é descontado ao site)
        </label>
        <div className="flex flex-wrap gap-2">
          <SubmitButton icon="check" pendingLabel="A guardar…">
            Guardar
          </SubmitButton>
        </div>
      </form>
    );
  };

  return (
    <>
      <AdminHeader
        title="Extranets e contingentes"
        subtitle="Plataformas geridas à mão até haver channel manager. O contingente fica fora de venda no site e no balcão; as reservas da plataforma consomem-no."
      />
      <Section>
        <Flash ok={ok} error={erro} />
        <datalist id="ota-names">
          {SUGGESTIONS.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>

        <Card className="mb-6 p-5 text-sm">
          <p className="font-medium">Como funciona, para não haver overbooking</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[var(--color-ink-soft)]">
            <li>Na extranet de cada plataforma, abra apenas o número de quartos definido aqui como contingente.</li>
            <li>O site e o balcão deixam de vender esses quartos (veja a disponibilidade descontada em «Disponibilidade e preços»).</li>
            <li>
              Cada reserva que chegue pela plataforma é introduzida em <Link href="/admin/reservas/nova" className="underline">Nova reserva</Link> com origem «Plataforma» — consome o contingente
              em vez de reduzir o resto.
            </li>
            <li>Quando o hotel estiver quase cheio, feche as datas também na extranet.</li>
          </ol>
          {Object.keys(held).length > 0 && (
            <p className="mt-3 text-xs text-[var(--color-ink-muted)]">
              Retido hoje para extranets: {rooms.filter((r) => held[r.id]).map((r) => `${r.name.pt} ${held[r.id]}/${totals[r.id] ?? 0}`).join(" · ")}
            </p>
          )}
        </Card>

        <div className="grid gap-4">
          {extranets.map((c) => (
            <Card key={c.id} className="p-0">
              <details>
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 p-5">
                  <span className="font-display text-lg tracking-tight">{c.name}</span>
                  <span className="flex gap-2">
                    <Badge tone={c.enabled ? "success" : "neutral"}>{c.enabled ? "Ativa" : "Inativa"}</Badge>
                    <Badge>
                      {Object.values(((c.settings as Settings).allotments ?? {}) as Record<string, number>).reduce((a, b) => a + b, 0)} quarto(s) de contingente
                    </Badge>
                  </span>
                </summary>
                <div className="border-t border-[var(--color-line)] p-5">
                  {form(c)}
                  <form action={removeExtranet} className="mt-4">
                    <input type="hidden" name="id" value={c.id} />
                    <SubmitButton variant="danger" icon="trash" confirm={`Remover ${c.name}? As reservas já feitas mantêm-se.`}>
                      Remover plataforma
                    </SubmitButton>
                  </form>
                </div>
              </details>
            </Card>
          ))}
          <Card className="p-5">
            <h2 className="mb-4 font-display text-lg tracking-tight">Adicionar plataforma</h2>
            {form(null)}
          </Card>
        </div>
      </Section>
    </>
  );
}
