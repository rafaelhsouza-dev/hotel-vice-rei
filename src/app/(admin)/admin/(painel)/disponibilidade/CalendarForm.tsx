import { saveCalendarAction } from "@/app/(admin)/admin/actions-rates";
import { Card, Field, fieldClass } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";

const WEEKDAYS = [
  [1, "Seg"],
  [2, "Ter"],
  [3, "Qua"],
  [4, "Qui"],
  [5, "Sex"],
  [6, "Sáb"],
  [0, "Dom"],
] as const;

function TriState({ name, label }: { name: string; label: string }) {
  return (
    <Field label={label} htmlFor={name}>
      <select id={name} name={name} defaultValue="" className={fieldClass}>
        <option value="">Manter</option>
        <option value="1">Sim</option>
        <option value="0">Não</option>
      </select>
    </Field>
  );
}

/**
 * Bulk edit of prices and restrictions. Every field defaults to "manter",
 * so changing one thing never resets the others.
 */
export function CalendarForm({ rooms, from, to }: { rooms: { id: string; name: string }[]; from: string; to: string }) {
  return (
    <Card className="mt-8 p-6">
      <h2 className="font-display text-lg tracking-tight">Alterar preços e restrições</h2>
      <p className="mt-1 max-w-3xl text-sm text-[var(--color-ink-muted)]">
        Preencha só o que quer mudar; o resto fica como está. Use os dias da semana para, por exemplo, subir o preço só às sextas e sábados.
      </p>
      <form action={saveCalendarAction} className="mt-5 grid gap-5">
        <fieldset>
          <legend className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">Tipologias</legend>
          <div className="flex flex-wrap gap-2">
            {rooms.map((r) => (
              <label key={r.id} className="flex items-center gap-2 rounded-xl border border-[var(--color-line)] px-3 py-2 text-sm">
                <input type="checkbox" name="roomIds" value={r.id} defaultChecked className="h-4 w-4" /> {r.name}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="De" htmlFor="cf-from">
            <input id="cf-from" name="from" type="date" required defaultValue={from} className={fieldClass} />
          </Field>
          <Field label="Até (inclusive)" htmlFor="cf-to">
            <input id="cf-to" name="to" type="date" required defaultValue={to} className={fieldClass} />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">Só nestes dias da semana (nenhum = todos)</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map(([n, label]) => (
              <label key={n} className="flex items-center gap-1.5 rounded-xl border border-[var(--color-line)] px-3 py-2 text-sm">
                <input type="checkbox" name="weekdays" value={n} className="h-4 w-4" /> {label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Preço da noite (€)" htmlFor="cf-rate" hint="Vazio = manter.">
            <input id="cf-rate" name="rate" inputMode="decimal" placeholder="manter" className={fieldClass} />
          </Field>
          <label className="flex items-center gap-2 self-end pb-3 text-sm">
            <input type="checkbox" name="rateMode" value="clear" className="h-4 w-4" /> Voltar ao preço base da tipologia
          </label>
          <Field label="Quartos bloqueados" htmlFor="cf-blocked" hint="Fora de venda (obras, equipa).">
            <input id="cf-blocked" name="unitsBlocked" type="number" min={0} placeholder="manter" className={fieldClass} />
          </Field>
          <Field label="Estadia mínima (noites)" htmlFor="cf-min">
            <input id="cf-min" name="minStay" type="number" min={1} placeholder="manter" className={fieldClass} />
          </Field>
          <Field label="Estadia máxima (noites)" htmlFor="cf-max">
            <input id="cf-max" name="maxStay" type="number" min={1} placeholder="manter" className={fieldClass} />
          </Field>
          <label className="flex items-center gap-2 self-end pb-3 text-sm">
            <input type="checkbox" name="maxStayMode" value="clear" className="h-4 w-4" /> Sem estadia máxima
          </label>
          <TriState name="closed" label="Fechado à venda" />
          <TriState name="closedArrival" label="Sem chegadas" />
          <TriState name="closedDeparture" label="Sem partidas" />
        </div>
        <div className="flex flex-wrap gap-3">
          <SubmitButton icon="check" pendingLabel="A aplicar…">
            Aplicar
          </SubmitButton>
          <SubmitButton variant="ghost" name="action" value="clear" pendingLabel="A repor…" confirm="Repor este período aos valores automáticos (apaga preços e restrições)?">
            Repor período
          </SubmitButton>
        </div>
      </form>
    </Card>
  );
}
