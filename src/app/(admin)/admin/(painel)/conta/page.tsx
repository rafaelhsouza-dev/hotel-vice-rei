import { requirePagePermission } from "@/lib/auth/session";
import { ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/auth/permissions";
import { changeOwnPassword } from "@/app/(admin)/admin/actions-config";
import { AdminHeader, Section, Card, Field, Flash, fieldClass } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const actor = await requirePagePermission("/admin/conta");
  const { ok, erro } = await searchParams;
  return (
    <>
      <AdminHeader title="A minha conta" subtitle={`${actor.name} · ${actor.email}`} />
      <Section>
        <Flash ok={ok} error={erro} />
        <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <h2 className="font-display text-lg tracking-tight">Função</h2>
            <p className="mt-2 text-sm font-medium">{ROLE_LABEL[actor.role]}</p>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{ROLE_DESCRIPTION[actor.role]}</p>
          </Card>
          <Card className="p-6">
            <h2 className="font-display text-lg tracking-tight">Mudar palavra-passe</h2>
            <form action={changeOwnPassword} className="mt-4 grid gap-4">
              <Field label="Palavra-passe atual" htmlFor="current">
                <input id="current" name="current" type="password" autoComplete="current-password" required className={fieldClass} />
              </Field>
              <Field label="Nova palavra-passe" htmlFor="next" hint="Pelo menos 10 caracteres, com letras e números.">
                <input id="next" name="next" type="password" autoComplete="new-password" minLength={10} required className={fieldClass} />
              </Field>
              <Field label="Repetir a nova" htmlFor="repeat">
                <input id="repeat" name="repeat" type="password" autoComplete="new-password" minLength={10} required className={fieldClass} />
              </Field>
              <div>
                <SubmitButton icon="key" pendingLabel="A guardar…">
                  Mudar palavra-passe
                </SubmitButton>
              </div>
              <p className="text-xs text-[var(--color-ink-muted)]">Todas as sessões abertas, incluindo esta, terminam ao mudar.</p>
            </form>
          </Card>
        </div>
      </Section>
    </>
  );
}
