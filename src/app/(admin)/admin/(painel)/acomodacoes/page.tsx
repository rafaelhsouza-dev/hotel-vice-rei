import { requirePagePermission } from "@/lib/auth/session";
import Link from "next/link";
import { listUnits, unitSummary, UNIT_STATUSES, type UnitStatus } from "@/lib/repo/operations";
import { changeUnitStatus, removeUnit } from "@/app/(admin)/admin/actions-ops";
import { AdminHeader, Section, Card, EmptyState } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { UNIT_LABEL, UNIT_STYLE, UNIT_DOT } from "@/components/admin/StatusPill";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function UnitsPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  await requirePagePermission("/admin/acomodacoes");
  const sp = await searchParams;
  const filter = (UNIT_STATUSES as readonly string[]).includes(sp.estado ?? "")
    ? (sp.estado as UnitStatus)
    : null;

  let units: Awaited<ReturnType<typeof listUnits>> = [];
  let summary = { available: 0, occupied: 0, cleaning: 0, maintenance: 0, blocked: 0, total: 0 };
  try {
    [units, summary] = await Promise.all([listUnits(), unitSummary()]);
  } catch {
    /* handled by the empty state */
  }

  const visible = filter ? units.filter((u) => u.status === filter) : units;
  const floors = [...new Set(visible.map((u) => u.floor))].sort((a, b) => a - b);

  return (
    <>
      <AdminHeader
        title="Acomodações"
        subtitle={`${summary.total} unidades · ${summary.available} livres · ${summary.occupied} ocupadas`}
        action={{ href: "/admin/acomodacoes/nova", label: "Nova unidade" }}
      />

      <Section>
        {/* Status legend doubles as the filter */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/acomodacoes"
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              !filter
                ? "bg-[var(--color-ink)] text-white"
                : "border border-[var(--color-line)] bg-white text-[var(--color-ink-soft)] hover:bg-[var(--color-line-soft)]"
            }`}
          >
            Todas ({summary.total})
          </Link>
          {UNIT_STATUSES.map((s) => (
            <Link
              key={s}
              href={`/admin/acomodacoes?estado=${s}`}
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                filter === s
                  ? "bg-[var(--color-ink)] text-white"
                  : "border border-[var(--color-line)] bg-white text-[var(--color-ink-soft)] hover:bg-[var(--color-line-soft)]"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${UNIT_DOT[s]}`} aria-hidden />
              {UNIT_LABEL[s]} ({summary[s]})
            </Link>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="mt-6">
            <EmptyState message="Nenhuma unidade neste filtro." />
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            {floors.map((floor) => (
              <div key={floor}>
                <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
                  Piso {floor}
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {visible
                    .filter((u) => u.floor === floor)
                    .map((unit) => (
                      <Card
                        key={unit.id}
                        className={`p-4 transition-shadow hover:shadow-[var(--shadow-card)] ${
                          unit.active ? "" : "opacity-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-display text-2xl leading-none tracking-tight">
                              {unit.code}
                            </p>
                            <p className="mt-1 truncate text-xs text-[var(--color-ink-muted)]">
                              {unit.roomName ?? "sem tipologia"}
                            </p>
                          </div>
                          <span
                            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium ${UNIT_STYLE[unit.status]}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${UNIT_DOT[unit.status]}`} aria-hidden />
                            {UNIT_LABEL[unit.status]}
                          </span>
                        </div>

                        {unit.guest && (
                          <p className="mt-3 flex items-center gap-1.5 truncate text-xs text-[var(--color-ink-soft)]">
                            <Icon name="users" width={12} height={12} />
                            {unit.guest}
                          </p>
                        )}
                        {unit.openTasks > 0 && (
                          <Link
                            href={`/admin/tarefas?unidade=${unit.id}`}
                            className="mt-2 inline-flex items-center gap-1.5 text-xs text-[var(--color-accent-deep)] hover:underline"
                          >
                            <Icon name="check" width={12} height={12} />
                            {unit.openTasks} tarefa{unit.openTasks === 1 ? "" : "s"} aberta
                            {unit.openTasks === 1 ? "" : "s"}
                          </Link>
                        )}

                        <div className="mt-4 flex items-center gap-2 border-t border-[var(--color-line-soft)] pt-3">
                          <form action={changeUnitStatus} className="flex flex-1 items-center gap-1.5">
                            <input type="hidden" name="id" value={unit.id} />
                            <label className="sr-only" htmlFor={`st-${unit.id}`}>
                              Estado da unidade {unit.code}
                            </label>
                            <select
                              id={`st-${unit.id}`}
                              name="status"
                              defaultValue={unit.status}
                              className="min-w-0 flex-1 rounded-lg border border-[var(--color-line)] bg-white px-2 py-1.5 text-xs"
                            >
                              {UNIT_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {UNIT_LABEL[s]}
                                </option>
                              ))}
                            </select>
                            <SubmitButton variant="icon" icon="check" title="Aplicar estado" />
                          </form>
                          <Link
                            href={`/admin/acomodacoes/${unit.id}`}
                            title="Editar unidade"
                            aria-label={`Editar unidade ${unit.code}`}
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--color-line)] bg-white text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-line-soft)]"
                          >
                            <Icon name="edit" width={14} height={14} />
                          </Link>
                          <form action={removeUnit}>
                            <input type="hidden" name="id" value={unit.id} />
                            <SubmitButton
                              variant="icon"
                              icon="trash"
                              title="Eliminar unidade"
                              confirm={`Eliminar a unidade ${unit.code}?`}
                            />
                          </form>
                        </div>
                      </Card>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
