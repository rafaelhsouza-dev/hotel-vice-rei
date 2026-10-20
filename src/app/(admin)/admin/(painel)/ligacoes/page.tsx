import { requirePagePermission } from "@/lib/auth/session";
import { INTEGRATIONS, type IntegrationDef } from "@/lib/integrations/catalog";
import { listIntegrations, maskCredentials, type IntegrationRecord } from "@/lib/repo/integrations";
import { hasDedicatedKey } from "@/lib/crypto";
import { SITE_URL } from "@/lib/site";
import { saveIntegrationForm, sendTestEmailAction, testIntegration } from "@/app/(admin)/admin/actions-config";
import { AdminHeader, Section, Card, Badge, Field, Flash, fieldClass, formatDate } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { CopyField } from "@/components/admin/CopyField";

export const dynamic = "force-dynamic";

function status(rec: IntegrationRecord | undefined) {
  if (!rec?.enabled) return { tone: "neutral" as const, label: "Desligado" };
  if (rec.lastTestOk === false) return { tone: "danger" as const, label: "Com erro" };
  if (rec.lastTestOk) return { tone: "success" as const, label: rec.mode === "live" ? "Ativo · produção" : "Ativo · teste" };
  return { tone: "warning" as const, label: "Ativo · por testar" };
}

function IntegrationCard({ def, rec, open }: { def: IntegrationDef; rec: IntegrationRecord | undefined; open: boolean }) {
  const secretKeys = def.fields.filter((f) => f.secret).map((f) => f.key);
  const masked = maskCredentials(rec?.credentials ?? {}, secretKeys);
  const st = status(rec);
  return (
    <Card className="p-0">
      <details id={def.id} open={open} className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-5">
          <span>
            <span className="block font-display text-lg tracking-tight">{def.name}</span>
            <span className="block text-sm text-[var(--color-ink-muted)]">{def.summary}</span>
          </span>
          <Badge tone={st.tone}>{st.label}</Badge>
        </summary>
        <div className="grid gap-6 border-t border-[var(--color-line)] p-5 lg:grid-cols-[1.4fr_1fr]">
          <form action={saveIntegrationForm} className="grid gap-4" autoComplete="off">
            <input type="hidden" name="id" value={def.id} />
            <div className="flex flex-wrap items-center gap-5">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" name="enabled" defaultChecked={rec?.enabled ?? false} className="h-4 w-4" /> Ativo
              </label>
              {def.hasModes && (
                <label className="flex items-center gap-2 text-sm">
                  Ambiente
                  <select name="mode" defaultValue={rec?.mode ?? "test"} className="rounded-lg border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm">
                    <option value="test">Teste</option>
                    <option value="live">Produção</option>
                  </select>
                </label>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {def.fields.map((f) => {
                const name = `f.${f.key}`;
                const id = `${def.id}-${f.key}`;
                const settingValue = rec?.settings?.[f.key];
                if (f.type === "checkbox") {
                  return (
                    <label key={f.key} className="flex items-start gap-2 text-sm sm:col-span-2">
                      <input type="checkbox" name={name} defaultChecked={settingValue === true} className="mt-0.5 h-4 w-4" />
                      <span>
                        {f.label}
                        {f.hint && <span className="block text-xs text-[var(--color-ink-muted)]">{f.hint}</span>}
                      </span>
                    </label>
                  );
                }
                const value = f.setting
                  ? f.key === "products"
                    ? JSON.stringify(settingValue ?? {}) === "{}"
                      ? ""
                      : JSON.stringify(settingValue)
                    : String(settingValue ?? "")
                  : f.secret
                    ? ""
                    : masked[f.key] ?? "";
                const stored = f.secret && masked[f.key];
                return (
                  <Field
                    key={f.key}
                    label={`${f.label}${f.required ? " *" : ""}`}
                    htmlFor={id}
                    hint={
                      <>
                        {stored ? <span className="mr-1 font-mono">Guardada: {masked[f.key]}.</span> : null}
                        {f.secret ? "Deixe em branco para manter. " : ""}
                        {f.hint}
                      </>
                    }
                    className={f.type === "textarea" ? "sm:col-span-2" : ""}
                  >
                    {f.type === "textarea" ? (
                      <textarea id={id} name={name} defaultValue={value} rows={3} placeholder={f.placeholder} className={`${fieldClass} font-mono`} />
                    ) : (
                      <input
                        id={id}
                        name={name}
                        type={f.secret ? "password" : f.type === "number" ? "number" : f.type === "email" ? "email" : "text"}
                        defaultValue={value}
                        placeholder={stored ? "••••••••" : f.placeholder}
                        autoComplete={f.secret ? "new-password" : "off"}
                        spellCheck={false}
                        className={`${fieldClass} ${f.secret || f.key.toLowerCase().includes("key") || f.key.includes("Id") ? "font-mono" : ""}`}
                      />
                    )}
                  </Field>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3">
              <SubmitButton icon="check" pendingLabel="A guardar…">
                Guardar
              </SubmitButton>
            </div>
          </form>

          <div className="grid content-start gap-4 text-sm">
            <form action={testIntegration} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="id" value={def.id} />
              <SubmitButton variant="ghost" icon="sync" pendingLabel="A testar…">
                Testar ligação
              </SubmitButton>
              {rec?.lastTestAt && (
                <span className={`text-xs ${rec.lastTestOk ? "text-[var(--color-success)]" : "text-red-700"}`}>
                  {formatDate(rec.lastTestAt, true)}: {rec.lastMessage}
                </span>
              )}
            </form>
            {def.id === "email" && (
              <form action={sendTestEmailAction} className="flex flex-wrap items-end gap-2">
                <Field label="Enviar e-mail de teste para" htmlFor="test-to" className="min-w-[12rem] flex-1">
                  <input id="test-to" name="to" type="email" placeholder="o seu email" className={fieldClass} />
                </Field>
                <SubmitButton variant="ghost" icon="mail" pendingLabel="A enviar…">
                  Enviar
                </SubmitButton>
              </form>
            )}
            {def.callbackPath && <CopyField label="Endereço de notificações (webhook / callback)" value={`${SITE_URL}${def.callbackPath}`} />}
            <div>
              <p className="text-[11px] uppercase tracking-[0.15em] text-[var(--color-ink-muted)]">Como configurar</p>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[var(--color-ink-soft)]">
                {def.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <a href={def.docsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[var(--color-accent-deep)] underline underline-offset-2">
                Documentação oficial
              </a>
            </div>
          </div>
        </div>
      </details>
    </Card>
  );
}

export default async function LinksPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; s?: string }> }) {
  await requirePagePermission("/admin/ligacoes");
  const { ok, erro, s } = await searchParams;
  const records = await listIntegrations().catch(() => []);
  const byId = new Map(records.map((r) => [r.id, r]));
  const groups = [...new Set(INTEGRATIONS.map((i) => i.group))];

  return (
    <>
      <AdminHeader
        title="Ligações e acessos"
        subtitle="Pagamentos, e-mail, faturação certificada e SIBA. As credenciais ficam cifradas e nunca voltam a ser mostradas por inteiro."
      />
      <Section>
        <Flash ok={ok} error={erro} />
        {!hasDedicatedKey() && (
          <div role="note" className="mb-6 rounded-2xl border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 px-4 py-3 text-sm">
            <strong className="font-medium">Recomendado:</strong> defina a variável de ambiente <code>CREDENTIALS_KEY</code> (32+ caracteres aleatórios) no EasyPanel.
            Hoje as credenciais são cifradas com uma chave derivada de <code>JWT_SECRET</code>; com uma chave própria, as existentes são cifradas de novo no arranque seguinte.
          </div>
        )}
        <div className="grid gap-10">
          {groups.map((g) => (
            <div key={g}>
              <h2 className="mb-3 text-[11px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">{g}</h2>
              <div className="grid gap-4">
                {INTEGRATIONS.filter((i) => i.group === g).map((def) => (
                  <IntegrationCard key={def.id} def={def} rec={byId.get(def.id)} open={s === def.id} />
                ))}
              </div>
            </div>
          ))}
          <p className="text-sm text-[var(--color-ink-muted)]">
            Os canais de venda (Booking.com, Expedia, extranets) configuram-se em <a href="/admin/integracoes" className="underline">Canais (OTAs)</a>. Google Analytics, Search Console e
            restantes etiquetas em <a href="/admin/seo" className="underline">SEO e monitorização</a>.
          </p>
        </div>
      </Section>
    </>
  );
}
