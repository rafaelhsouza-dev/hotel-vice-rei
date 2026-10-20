import { requirePagePermission } from "@/lib/auth/session";
import { ROLES, ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/auth/permissions";
import { listAdminUsers } from "@/lib/repo/users";
import { listStaff } from "@/lib/repo/operations";
import { resetUserPassword, revokeUserSessions, saveUser, unlockUser } from "@/app/(admin)/admin/actions-config";
import { AdminHeader, Section, Card, Badge, Field, Flash, fieldClass, formatDate } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const actor = await requirePagePermission("/admin/utilizadores");
  const { ok, erro } = await searchParams;
  const [users, staff] = await Promise.all([listAdminUsers(), listStaff().catch(() => [])]);
  const roles = ROLES.filter((r) => r !== "owner" || actor.role === "owner");

  return (
    <>
      <AdminHeader title="Utilizadores" subtitle="Quem entra no backoffice e o que pode fazer. Cada pessoa tem a sua própria conta." />
      <Section>
        <Flash ok={ok} error={erro} />

        <Card className="mb-8 p-6">
          <h2 className="font-display text-lg tracking-tight">Novo utilizador</h2>
          <form action={saveUser} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5 xl:items-end">
            <Field label="Nome" htmlFor="nu-name">
              <input id="nu-name" name="name" required maxLength={120} className={fieldClass} />
            </Field>
            <Field label="Email" htmlFor="nu-email">
              <input id="nu-email" name="email" type="email" required autoComplete="off" className={fieldClass} />
            </Field>
            <Field label="Função" htmlFor="nu-role">
              <select id="nu-role" name="role" defaultValue="reception" className={fieldClass}>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Palavra-passe inicial" htmlFor="nu-pass" hint="10+ caracteres, letras e números.">
              <input id="nu-pass" name="password" type="password" required minLength={10} autoComplete="new-password" className={fieldClass} />
            </Field>
            <input type="hidden" name="active" value="on" />
            <div>
              <SubmitButton icon="plus" pendingLabel="A criar…">
                Criar
              </SubmitButton>
            </div>
          </form>
          <dl className="mt-6 grid gap-2 text-xs text-[var(--color-ink-muted)] md:grid-cols-2">
            {ROLES.map((r) => (
              <div key={r}>
                <dt className="inline font-medium text-[var(--color-ink-soft)]">{ROLE_LABEL[r]}: </dt>
                <dd className="inline">{ROLE_DESCRIPTION[r]}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <div className="grid gap-4">
          {users.map((u) => {
            const locked = Boolean(u.lockedUntil && new Date(u.lockedUntil) > new Date());
            const editable = u.role !== "owner" || actor.role === "owner";
            return (
              <Card key={u.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {u.name || u.email}{" "}
                      {u.id === actor.id && <span className="text-xs text-[var(--color-ink-muted)]">(você)</span>}
                    </p>
                    <p className="break-all text-sm text-[var(--color-ink-muted)]">{u.email}</p>
                    <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                      Último acesso: {formatDate(u.lastLoginAt, true)} · criado {formatDate(u.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={u.active ? "success" : "neutral"}>{u.active ? "Ativo" : "Desativado"}</Badge>
                    <Badge tone="info">{ROLE_LABEL[u.role]}</Badge>
                    {locked && <Badge tone="danger">Bloqueado</Badge>}
                  </div>
                </div>
                {editable && (
                  <details className="mt-4 border-t border-[var(--color-line)] pt-4">
                    <summary className="cursor-pointer text-sm text-[var(--color-accent-deep)]">
                      Editar, redefinir palavra-passe ou terminar sessões
                    </summary>
                    <div className="mt-4 grid gap-6 lg:grid-cols-2">
                      <form action={saveUser} className="grid gap-4 sm:grid-cols-2">
                        <input type="hidden" name="id" value={u.id} />
                        <Field label="Nome" htmlFor={`n-${u.id}`}>
                          <input id={`n-${u.id}`} name="name" defaultValue={u.name} required className={fieldClass} />
                        </Field>
                        <Field label="Função" htmlFor={`r-${u.id}`}>
                          <select id={`r-${u.id}`} name="role" defaultValue={u.role} className={fieldClass}>
                            {roles.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABEL[r]}
                              </option>
                            ))}
                            {!roles.includes(u.role) && <option value={u.role}>{ROLE_LABEL[u.role]}</option>}
                          </select>
                        </Field>
                        <Field label="Ficha na equipa (opcional)" htmlFor={`s-${u.id}`}>
                          <select id={`s-${u.id}`} name="staffId" defaultValue={u.staffId ?? ""} className={fieldClass}>
                            <option value="">—</option>
                            {staff.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <label className="flex items-center gap-2 self-end pb-3 text-sm">
                          <input type="checkbox" name="active" defaultChecked={u.active} className="h-4 w-4" /> Conta ativa
                        </label>
                        <div className="sm:col-span-2">
                          <SubmitButton icon="check" pendingLabel="A guardar…">
                            Guardar
                          </SubmitButton>
                        </div>
                      </form>
                      <div className="grid content-start gap-4">
                        <form action={resetUserPassword} className="flex flex-wrap items-end gap-3">
                          <input type="hidden" name="id" value={u.id} />
                          <Field label="Nova palavra-passe" htmlFor={`p-${u.id}`} className="min-w-[14rem] flex-1">
                            <input id={`p-${u.id}`} name="password" type="password" minLength={10} required autoComplete="new-password" className={fieldClass} />
                          </Field>
                          <SubmitButton variant="ghost" icon="key" pendingLabel="…">
                            Redefinir
                          </SubmitButton>
                        </form>
                        <div className="flex flex-wrap gap-2">
                          {locked && (
                            <form action={unlockUser}>
                              <input type="hidden" name="id" value={u.id} />
                              <SubmitButton variant="ghost">Desbloquear</SubmitButton>
                            </form>
                          )}
                          <form action={revokeUserSessions}>
                            <input type="hidden" name="id" value={u.id} />
                            <SubmitButton variant="ghost" confirm="Terminar todas as sessões desta pessoa?">
                              Terminar sessões
                            </SubmitButton>
                          </form>
                        </div>
                      </div>
                    </div>
                  </details>
                )}
              </Card>
            );
          })}
        </div>
      </Section>
    </>
  );
}
