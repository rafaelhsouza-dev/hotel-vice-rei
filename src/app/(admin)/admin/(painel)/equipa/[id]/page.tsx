import Link from "next/link";
import { notFound } from "next/navigation";
import { listStaff, DEPARTMENTS, SHIFTS } from "@/lib/repo/operations";
import { saveStaff } from "@/app/(admin)/admin/actions-ops";
import { AdminHeader, Section, Card, fieldClass, labelClass } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { DEPARTMENT_LABEL, SHIFT_LABEL } from "@/components/admin/StatusPill";

export const dynamic = "force-dynamic";

export default async function StaffEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const person = (await listStaff()).find((s) => s.id === id);
  if (!person) notFound();

  return (
    <>
      <AdminHeader title={person.name} subtitle="Editar colaborador." />
      <Section>
        <form action={saveStaff} className="max-w-2xl">
          <input type="hidden" name="id" value={person.id} />
          <Card className="p-6">
            <div className="grid gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="name">
                    Nome
                  </label>
                  <input id="name" name="name" required defaultValue={person.name} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="role">
                    Função
                  </label>
                  <input id="role" name="role" defaultValue={person.role} className={fieldClass} />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="department">
                    Departamento
                  </label>
                  <select
                    id="department"
                    name="department"
                    defaultValue={person.department}
                    className={fieldClass}
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {DEPARTMENT_LABEL[d]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="shift">
                    Turno
                  </label>
                  <select id="shift" name="shift" defaultValue={person.shift} className={fieldClass}>
                    {SHIFTS.map((s) => (
                      <option key={s} value={s}>
                        {SHIFT_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="email">
                    Email
                  </label>
                  <input id="email" name="email" type="email" defaultValue={person.email} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="phone">
                    Telefone
                  </label>
                  <input id="phone" name="phone" defaultValue={person.phone} className={fieldClass} />
                </div>
              </div>

              <div>
                <label className={labelClass} htmlFor="hiredAt">
                  Data de admissão
                </label>
                <input
                  id="hiredAt"
                  name="hiredAt"
                  type="date"
                  defaultValue={person.hiredAt ?? ""}
                  className={fieldClass}
                />
              </div>

              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={person.active}
                  className="h-4 w-4 accent-[var(--color-accent-deep)]"
                />
                Colaborador ativo
              </label>

              <div className="flex flex-wrap gap-3 border-t border-[var(--color-line)] pt-5">
                <SubmitButton icon="check" pendingLabel="A guardar…">
                  Guardar
                </SubmitButton>
                <Link
                  href="/admin/equipa"
                  className="inline-flex items-center rounded-full border border-[var(--color-line)] px-4 py-2 text-sm text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-line-soft)]"
                >
                  Cancelar
                </Link>
              </div>
            </div>
          </Card>
        </form>
      </Section>
    </>
  );
}
