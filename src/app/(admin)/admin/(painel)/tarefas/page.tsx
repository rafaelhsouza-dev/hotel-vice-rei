import Link from "next/link";
import {
  listTasks, listUnits, listStaff,
  TASK_KINDS, TASK_STATUSES, PRIORITIES,
  type TaskStatus, type TaskKind,
} from "@/lib/repo/operations";
import { createTask, changeTaskStatus, changeTaskAssignee, removeTask } from "@/app/(admin)/admin/actions-ops";
import {
  AdminHeader, Section, Card, TableWrap, Th, Td, EmptyState, fieldClass, labelClass,
} from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { TASK_LABEL, PRIORITY_LABEL, PRIORITY_STYLE, KIND_LABEL } from "@/components/admin/StatusPill";

export const dynamic = "force-dynamic";

const dayMonth = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

const FILTERS: { value: string; label: string }[] = [
  { value: "open", label: "Em aberto" },
  { value: "pending", label: "Por fazer" },
  { value: "in_progress", label: "Em curso" },
  { value: "done", label: "Concluídas" },
  { value: "all", label: "Todas" },
];

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; tipo?: string; unidade?: string }>;
}) {
  const sp = await searchParams;
  const status = (FILTERS.some((f) => f.value === sp.estado) ? sp.estado : "open") as
    | TaskStatus
    | "open"
    | "all";
  const kind = ((TASK_KINDS as readonly string[]).includes(sp.tipo ?? "")
    ? sp.tipo
    : "all") as TaskKind | "all";
  const unitId = sp.unidade ? Number(sp.unidade) : undefined;

  let tasks: Awaited<ReturnType<typeof listTasks>> = [];
  let units: Awaited<ReturnType<typeof listUnits>> = [];
  let staff: Awaited<ReturnType<typeof listStaff>> = [];
  try {
    [tasks, units, staff] = await Promise.all([
      listTasks({ status, kind, unitId }),
      listUnits(),
      listStaff(),
    ]);
  } catch {
    /* handled by the empty state */
  }

  const activeStaff = staff.filter((s) => s.active);
  const linkFor = (next: Record<string, string>) => {
    const p = new URLSearchParams({
      ...(status !== "open" ? { estado: status } : {}),
      ...(kind !== "all" ? { tipo: kind } : {}),
      ...(unitId ? { unidade: String(unitId) } : {}),
      ...next,
    });
    const qs = p.toString();
    return `/admin/tarefas${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <AdminHeader
        title="Tarefas"
        subtitle="Limpeza, manutenção e inspeções por unidade."
      />

      <Section>
        <Card className="p-6">
          <h2 className="font-display text-lg tracking-tight">Nova tarefa</h2>
          <form action={createTask} className="mt-4 grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <label className={labelClass} htmlFor="title">
                Descrição curta
              </label>
              <input
                id="title"
                name="title"
                required
                placeholder="Ex.: Limpeza de saída"
                className={fieldClass}
              />
            </div>
            <div className="lg:col-span-2">
              <label className={labelClass} htmlFor="unitId">
                Unidade
              </label>
              <select id="unitId" name="unitId" defaultValue={unitId ?? ""} className={fieldClass}>
                <option value="">—</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className={labelClass} htmlFor="kind">
                Tipo
              </label>
              <select id="kind" name="kind" className={fieldClass}>
                {TASK_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className={labelClass} htmlFor="assigneeId">
                Responsável
              </label>
              <select id="assigneeId" name="assigneeId" className={fieldClass}>
                <option value="">Por atribuir</option>
                {activeStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-1">
              <label className={labelClass} htmlFor="priority">
                Prioridade
              </label>
              <select id="priority" name="priority" defaultValue="normal" className={fieldClass}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-1">
              <label className={labelClass} htmlFor="dueDate">
                Prazo
              </label>
              <input id="dueDate" name="dueDate" type="date" className={fieldClass} />
            </div>
            <div className="lg:col-span-10">
              <label className={labelClass} htmlFor="description">
                Notas (opcional)
              </label>
              <input id="description" name="description" className={fieldClass} />
            </div>
            <div className="flex items-end lg:col-span-2">
              <SubmitButton icon="plus" pendingLabel="A criar…">
                Criar tarefa
              </SubmitButton>
            </div>
          </form>
        </Card>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={linkFor({ estado: f.value === "open" ? "" : f.value })}
              className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                status === f.value
                  ? "bg-[var(--color-ink)] text-white"
                  : "border border-[var(--color-line)] bg-white text-[var(--color-ink-soft)] hover:bg-[var(--color-line-soft)]"
              }`}
            >
              {f.label}
            </Link>
          ))}
          <span aria-hidden className="mx-1 h-5 w-px bg-[var(--color-line)]" />
          <Link
            href={linkFor({ tipo: "" })}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              kind === "all"
                ? "bg-[var(--color-ink)] text-white"
                : "border border-[var(--color-line)] bg-white text-[var(--color-ink-soft)] hover:bg-[var(--color-line-soft)]"
            }`}
          >
            Todos os tipos
          </Link>
          {TASK_KINDS.map((k) => (
            <Link
              key={k}
              href={linkFor({ tipo: k })}
              className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                kind === k
                  ? "bg-[var(--color-ink)] text-white"
                  : "border border-[var(--color-line)] bg-white text-[var(--color-ink-soft)] hover:bg-[var(--color-line-soft)]"
              }`}
            >
              {KIND_LABEL[k]}
            </Link>
          ))}
          {unitId && (
            <Link
              href="/admin/tarefas"
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-accent)]/15 px-3.5 py-1.5 text-sm text-[var(--color-accent-deep)]"
            >
              unidade {units.find((u) => u.id === unitId)?.code ?? unitId} ✕
            </Link>
          )}
        </div>

        <div className="mt-6">
          {tasks.length === 0 ? (
            <EmptyState message="Nenhuma tarefa neste filtro." />
          ) : (
            <TableWrap>
              <table className="w-full min-w-[940px] text-sm">
                <thead className="border-b border-[var(--color-line)]">
                  <tr>
                    <Th>Tarefa</Th>
                    <Th>Unidade</Th>
                    <Th>Tipo</Th>
                    <Th>Responsável</Th>
                    <Th>Prioridade</Th>
                    <Th>Prazo</Th>
                    <Th className="text-right">Estado</Th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr
                      key={task.id}
                      className={`border-b border-[var(--color-line-soft)] align-top last:border-0 ${
                        task.status === "done" ? "opacity-60" : ""
                      }`}
                    >
                      <Td>
                        <p className="font-medium">{task.title}</p>
                        {task.description && (
                          <p className="mt-0.5 max-w-md text-xs text-[var(--color-ink-muted)]">
                            {task.description}
                          </p>
                        )}
                      </Td>
                      <Td className="text-[var(--color-ink-soft)]">
                        {task.unitCode ? (
                          <Link
                            href={`/admin/tarefas?unidade=${task.unitId}`}
                            className="hover:text-[var(--color-accent-deep)]"
                          >
                            {task.unitCode}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td className="text-[var(--color-ink-soft)]">{KIND_LABEL[task.kind]}</Td>
                      <Td>
                        <form action={changeTaskAssignee} className="flex items-center gap-1.5">
                          <input type="hidden" name="id" value={task.id} />
                          <label className="sr-only" htmlFor={`as-${task.id}`}>
                            Responsável pela tarefa {task.title}
                          </label>
                          <select
                            id={`as-${task.id}`}
                            name="assigneeId"
                            defaultValue={task.assigneeId ?? ""}
                            className="rounded-lg border border-[var(--color-line)] bg-white px-2 py-1.5 text-xs"
                          >
                            <option value="">Por atribuir</option>
                            {activeStaff.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                          <SubmitButton variant="icon" icon="check" title="Atribuir" />
                        </form>
                      </Td>
                      <Td>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${PRIORITY_STYLE[task.priority]}`}
                        >
                          {PRIORITY_LABEL[task.priority]}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap text-[var(--color-ink-soft)]">
                        {task.dueDate ? dayMonth.format(new Date(task.dueDate)) : "—"}
                      </Td>
                      <Td>
                        <div className="flex flex-col items-end gap-2">
                          <form action={changeTaskStatus} className="flex items-center gap-1.5">
                            <input type="hidden" name="id" value={task.id} />
                            <label className="sr-only" htmlFor={`ts-${task.id}`}>
                              Estado da tarefa {task.title}
                            </label>
                            <select
                              id={`ts-${task.id}`}
                              name="status"
                              defaultValue={task.status}
                              className="rounded-lg border border-[var(--color-line)] bg-white px-2 py-1.5 text-xs"
                            >
                              {TASK_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {TASK_LABEL[s]}
                                </option>
                              ))}
                            </select>
                            <SubmitButton variant="icon" icon="check" title="Aplicar estado" />
                          </form>
                          <form action={removeTask}>
                            <input type="hidden" name="id" value={task.id} />
                            <SubmitButton
                              variant="icon"
                              icon="trash"
                              title="Eliminar tarefa"
                              confirm="Eliminar esta tarefa?"
                            />
                          </form>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </div>
      </Section>
    </>
  );
}
