import { requirePagePermission } from "@/lib/auth/session";
import { getCalendar, addDays, today, type DayAvailability } from "@/lib/repo/availability";
import { getRooms } from "@/lib/repo/content";
import { saveAvailabilityOverride } from "@/app/(admin)/admin/actions-channels";
import {
  AdminHeader, Section, Card, EmptyState, Flash, fieldClass, labelClass,
} from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";

/** Four weeks fits on screen without scrolling on a laptop. */
const WINDOW_DAYS = 28;

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function dayLabel(date: string): { day: string; weekday: string; weekend: boolean } {
  const d = new Date(`${date}T00:00:00Z`);
  const index = d.getUTCDay();
  return {
    day: String(d.getUTCDate()),
    weekday: WEEKDAYS[index],
    weekend: index === 0 || index === 6,
  };
}

/** Colour carries the story, but the number is always there for anyone who
 *  cannot rely on colour alone. */
function cellTone(day: DayAvailability): string {
  if (day.overbooked) return "bg-red-600 text-white";
  if (day.closed) return "bg-[var(--color-ink)] text-white";
  if (day.free === 0) return "bg-red-50 text-red-700";
  if (day.free <= 2) return "bg-[var(--color-accent)]/20 text-[var(--color-accent-deep)]";
  return "bg-[var(--color-success)]/10 text-[var(--color-success)]";
}

/** Full state of one cell in words, used for both the tooltip and the a11y text. */
function detail(day: DayAvailability): string {
  if (day.overbooked) {
    return `${day.date}: sobrelotado — ${day.unitsBooked + day.unitsBlocked} reservas para ${day.unitsTotal} unidades`;
  }
  const parts = [
    `${day.date}: ${day.closed ? "encerrado à venda" : `${day.free} de ${day.unitsTotal} livres`}`,
    `${day.unitsBooked} reservas do site`,
    `${day.unitsBlocked} de plataformas`,
  ];
  if (day.minStay > 1) parts.push(`mínimo ${day.minStay} noites`);
  return parts.join(", ");
}

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string; from?: string }>;
}) {
  await requirePagePermission("/admin/disponibilidade");
  const { ok, erro, from: fromParam } = await searchParams;

  const from = /^\d{4}-\d{2}-\d{2}$/.test(fromParam ?? "") ? fromParam! : today();
  const to = addDays(from, WINDOW_DAYS - 1);

  let days: DayAvailability[] = [];
  let rooms: Awaited<ReturnType<typeof getRooms>> = [];
  try {
    [days, rooms] = await Promise.all([getCalendar(null, from, to), getRooms()]);
  } catch {
    /* handled by the empty state */
  }

  const dates = [...new Set(days.map((d) => d.date))].sort();
  const byRoom = new Map<string, DayAvailability[]>();
  for (const day of days) {
    const list = byRoom.get(day.roomId) ?? [];
    list.push(day);
    byRoom.set(day.roomId, list);
  }

  const overbooked = days.filter((d) => d.overbooked);

  return (
    <>
      <AdminHeader
        title="Disponibilidade"
        subtitle={`${from} a ${to}. Os números são unidades ainda por vender.`}
      />

      <Section>
        <Flash ok={ok} error={erro} />

        {overbooked.length > 0 && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            <strong className="font-medium">
              {overbooked.length} dia(s) com reservas acima do inventário.
            </strong>{" "}
            Verifique as reservas importadas das plataformas antes de voltar a abrir a venda.
          </div>
        )}

        {/* --- window navigation ------------------------------------------- */}
        <form className="mb-6 flex flex-wrap items-end gap-3">
          <div>
            <label className={labelClass} htmlFor="from">
              A partir de
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={from}
              className={`${fieldClass} w-auto`}
            />
          </div>
          <SubmitButton variant="ghost" pendingLabel="…">
            Ver período
          </SubmitButton>
        </form>

        {dates.length === 0 ? (
          <EmptyState message="Sem dados de disponibilidade. Verifique a ligação à base de dados." />
        ) : (
          <div className="scroll-bar-thin overflow-x-auto rounded-2xl border border-[var(--color-line)] bg-white">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <caption className="sr-only">
                Unidades disponíveis por tipologia e por dia, de {from} a {to}
              </caption>
              <thead>
                <tr className="border-b border-[var(--color-line)]">
                  <th
                    scope="col"
                    className="sticky left-0 z-10 bg-white px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--color-ink-muted)]"
                  >
                    Tipologia
                  </th>
                  {dates.map((date) => {
                    const { day, weekday, weekend } = dayLabel(date);
                    return (
                      <th
                        key={date}
                        scope="col"
                        className={`px-1 py-2 text-center text-[11px] font-medium ${
                          weekend
                            ? "text-[var(--color-accent-deep)]"
                            : "text-[var(--color-ink-muted)]"
                        }`}
                      >
                        <span className="block">{weekday}</span>
                        <span className="block text-xs text-[var(--color-ink)]">{day}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.id} className="border-b border-[var(--color-line-soft)] last:border-0">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-white px-4 py-2 text-left font-normal"
                    >
                      <span className="block text-sm font-medium">{room.name.pt}</span>
                      <span className="block text-xs text-[var(--color-ink-muted)]">
                        {byRoom.get(room.id)?.[0]?.unitsTotal ?? 0} unidades
                      </span>
                    </th>
                    {(byRoom.get(room.id) ?? []).map((day) => (
                      <td key={day.date} className="px-0.5 py-1 text-center">
                        <span
                          title={detail(day)}
                          className={`inline-grid h-8 w-8 place-items-center rounded-lg text-xs font-medium ${cellTone(day)}`}
                        >
                          <span aria-hidden="true">{day.closed ? "×" : day.free}</span>
                          {/* The colour and the glyph both need a text
                              equivalent: "×" alone tells a screen reader
                              nothing, and colour tells it less. */}
                          <span className="sr-only">{detail(day)}</span>
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* --- manual override --------------------------------------------- */}
        <Card className="mt-8 p-6">
          <h2 className="font-display text-lg tracking-tight">Bloquear ou ajustar um período</h2>
          <p className="mt-1 max-w-3xl text-sm text-[var(--color-ink-muted)]">
            Usado para manutenção, alojamento de equipa ou estadias mínimas em época alta. O que
            for definido aqui é enviado às plataformas na próxima sincronização.
          </p>
          <form action={saveAvailabilityOverride} className="mt-4 grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-3">
              <label className={labelClass} htmlFor="roomId">
                Tipologia
              </label>
              <select id="roomId" name="roomId" required className={fieldClass}>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name.pt}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className={labelClass} htmlFor="ov-from">
                De
              </label>
              <input id="ov-from" name="from" type="date" required defaultValue={from} className={fieldClass} />
            </div>
            <div className="lg:col-span-2">
              <label className={labelClass} htmlFor="ov-to">
                Até
              </label>
              <input id="ov-to" name="to" type="date" required defaultValue={to} className={fieldClass} />
            </div>
            <div className="lg:col-span-1">
              <label className={labelClass} htmlFor="unitsBlocked">
                Bloquear
              </label>
              <input
                id="unitsBlocked"
                name="unitsBlocked"
                type="number"
                min={0}
                defaultValue={0}
                className={fieldClass}
              />
            </div>
            <div className="lg:col-span-1">
              <label className={labelClass} htmlFor="minStay">
                Mín. noites
              </label>
              <input
                id="minStay"
                name="minStay"
                type="number"
                min={1}
                defaultValue={1}
                className={fieldClass}
              />
            </div>
            <div className="lg:col-span-2">
              <label className={labelClass} htmlFor="rate">
                Preço (€)
              </label>
              <input
                id="rate"
                name="rate"
                inputMode="decimal"
                placeholder="manter"
                className={fieldClass}
              />
            </div>
            <div className="flex items-end gap-3 lg:col-span-12">
              <label className="flex items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  name="closed"
                  className="h-4 w-4 rounded border-[var(--color-line)]"
                />
                Encerrar à venda
              </label>
              <SubmitButton pendingLabel="A guardar…">Aplicar</SubmitButton>
              <SubmitButton
                variant="ghost"
                name="action"
                value="clear"
                pendingLabel="A repor…"
                confirm="Repor este período aos valores automáticos?"
              >
                Repor período
              </SubmitButton>
            </div>
          </form>
        </Card>
      </Section>
    </>
  );
}
