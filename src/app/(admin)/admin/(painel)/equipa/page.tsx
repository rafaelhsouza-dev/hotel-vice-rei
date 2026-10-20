import { requirePagePermission } from "@/lib/auth/session";
import Link from "next/link";
import { listStaff, DEPARTMENTS, SHIFTS } from "@/lib/repo/operations";
import { saveStaff, removeStaff } from "@/app/(admin)/admin/actions-ops";
import {
  AdminHeader, Section, Card, TableWrap, Th, Td, EmptyState, Badge,
  fieldClass, labelClass,
} from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { DEPARTMENT_LABEL, SHIFT_LABEL } from "@/components/admin/StatusPill";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  await requirePagePermission("/admin/equipa");
  let staff: Awaited<ReturnType<typeof listStaff>> = [];
  try {
    staff = await listStaff();
  } catch {
    /* handled by the empty state */
  }

  const byDepartment = DEPARTMENTS.map((d) => ({
    department: d,
    people: staff.filter((s) => s.department === d),
  })).filter((g) => g.people.length > 0);

  return (
    <>
      <AdminHeader
        title="Equipa"
        subtitle={`${staff.filter((s) => s.active).length} colaboradores ativos de ${staff.length}.`}
      />

      <Section>
        <Card className="p-6">
          <h2 className="font-display text-lg tracking-tight">Novo colaborador</h2>
          <form action={saveStaff} className="mt-4 grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-3">
              <label className={labelClass} htmlFor="name">
                Nome
              </label>
              <input id="name" name="name" required className={fieldClass} />
            </div>
            <div className="lg:col-span-3">
              <label className={labelClass} htmlFor="role">
                Função
              </label>
              <input
                id="role"
                name="role"
                placeholder="Ex.: Empregado de andares"
                className={fieldClass}
              />
            </div>
            <div className="lg:col-span-2">
              <label className={labelClass} htmlFor="department">
                Departamento
              </label>
              <select id="department" name="department" className={fieldClass}>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {DEPARTMENT_LABEL[d]}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className={labelClass} htmlFor="shift">
                Turno
              </label>
              <select id="shift" name="shift" className={fieldClass}>
                {SHIFTS.map((s) => (
                  <option key={s} value={s}>
                    {SHIFT_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className={labelClass} htmlFor="email">
                Email
              </label>
              <input id="email" name="email" type="email" className={fieldClass} />
            </div>
            <input type="hidden" name="active" value="on" />
            <div className="flex items-end lg:col-span-2">
              <SubmitButton icon="plus" pendingLabel="A guardar…">
                Adicionar
              </SubmitButton>
            </div>
          </form>
        </Card>

        <div className="mt-8 space-y-8">
          {byDepartment.length === 0 ? (
            <EmptyState message="Ainda não há colaboradores registados." />
          ) : (
            byDepartment.map((group) => (
              <div key={group.department}>
                <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
                  {DEPARTMENT_LABEL[group.department]} · {group.people.length}
                </h2>
                <TableWrap>
                  <table className="w-full min-w-[820px] text-sm">
                    <thead className="border-b border-[var(--color-line)]">
                      <tr>
                        <Th>Colaborador</Th>
                        <Th>Turno</Th>
                        <Th>Contacto</Th>
                        <Th>Tarefas abertas</Th>
                        <Th>Estado</Th>
                        <Th className="text-right">Ações</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.people.map((person) => (
                        <tr
                          key={person.id}
                          className={`border-b border-[var(--color-line-soft)] last:border-0 ${
                            person.active ? "" : "opacity-55"
                          }`}
                        >
                          <Td>
                            <p className="font-medium">{person.name}</p>
                            <p className="text-xs text-[var(--color-ink-muted)]">
                              {person.role || "—"}
                            </p>
                          </Td>
                          <Td className="text-[var(--color-ink-soft)]">
                            {SHIFT_LABEL[person.shift]}
                          </Td>
                          <Td className="text-[var(--color-ink-soft)]">
                            {person.email ? (
                              <a href={`mailto:${person.email}`} className="hover:text-[var(--color-accent-deep)]">
                                {person.email}
                              </a>
                            ) : (
                              "—"
                            )}
                            {person.phone && (
                              <p className="text-xs text-[var(--color-ink-muted)]">{person.phone}</p>
                            )}
                          </Td>
                          <Td>
                            {person.openTasks > 0 ? (
                              <Badge tone="warning">{person.openTasks}</Badge>
                            ) : (
                              <span className="text-[var(--color-ink-muted)]">—</span>
                            )}
                          </Td>
                          <Td>
                            <Badge tone={person.active ? "success" : "neutral"}>
                              {person.active ? "Ativo" : "Inativo"}
                            </Badge>
                          </Td>
                          <Td>
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={`/admin/equipa/${person.id}`}
                                title="Editar colaborador"
                                aria-label={`Editar ${person.name}`}
                                className="grid h-9 w-9 place-items-center rounded-full border border-[var(--color-line)] bg-white text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-line-soft)]"
                              >
                                <Icon name="edit" width={14} height={14} />
                              </Link>
                              <form action={removeStaff}>
                                <input type="hidden" name="id" value={person.id} />
                                <SubmitButton
                                  variant="icon"
                                  icon="trash"
                                  title="Remover colaborador"
                                  confirm={`Remover ${person.name} da equipa?`}
                                />
                              </form>
                            </div>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              </div>
            ))
          )}
        </div>
      </Section>
    </>
  );
}
