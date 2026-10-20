import { requirePagePermission } from "@/lib/auth/session";
import { pingDb, safeQuery } from "@/lib/db";
import { hasDedicatedKey } from "@/lib/crypto";
import { listJobs } from "@/lib/jobs";
import { listIntegrations } from "@/lib/repo/integrations";
import { INTEGRATIONS } from "@/lib/integrations/catalog";
import { listEmailLog } from "@/lib/email/send";
import { SITE_URL } from "@/lib/site";
import { runJobNow } from "@/app/(admin)/admin/actions-config";
import { AdminHeader, Section, Card, Badge, Flash, TableWrap, Th, Td, formatDate } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { CopyField } from "@/components/admin/CopyField";

export const dynamic = "force-dynamic";

export default async function SystemPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requirePagePermission("/admin/sistema");
  const { ok, erro } = await searchParams;
  const [db, jobs, integrations, emails, version] = await Promise.all([
    pingDb(),
    listJobs(),
    listIntegrations().catch(() => []),
    listEmailLog({ limit: 15 }).catch(() => []),
    safeQuery<{ v: string }>(`SHOW server_version`),
  ]);
  const checks: { label: string; ok: boolean; detail: string }[] = [
    { label: "Base de dados", ok: db, detail: db ? `PostgreSQL ${version?.[0]?.v ?? ""}` : "Sem ligação" },
    { label: "Chave própria das credenciais (CREDENTIALS_KEY)", ok: hasDedicatedKey(), detail: hasDedicatedKey() ? "Configurada" : "Em falta — usa a chave derivada de JWT_SECRET" },
    { label: "Segredo do cron externo (SYNC_SECRET)", ok: (process.env.SYNC_SECRET ?? "").length >= 16, detail: (process.env.SYNC_SECRET ?? "").length >= 16 ? "Configurado" : "Opcional — só para disparar tarefas de fora" },
    { label: "Endereço público do site (NEXT_PUBLIC_SITE_URL)", ok: Boolean(process.env.NEXT_PUBLIC_SITE_URL), detail: SITE_URL },
    { label: "Tarefas automáticas no servidor", ok: process.env.DISABLE_JOBS !== "1", detail: process.env.DISABLE_JOBS === "1" ? "Desligadas (DISABLE_JOBS=1)" : "A correr de 5 em 5 minutos" },
  ];

  return (
    <>
      <AdminHeader title="Estado do sistema" subtitle="Saúde da instalação, tarefas automáticas e envios recentes." />
      <Section>
        <Flash ok={ok} error={erro} />
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="p-6">
            <h2 className="font-display text-lg tracking-tight">Verificações</h2>
            <ul className="mt-4 grid gap-3 text-sm">
              {checks.map((c) => (
                <li key={c.label} className="flex items-start justify-between gap-3">
                  <span>
                    {c.label}
                    <span className="block text-xs text-[var(--color-ink-muted)]">{c.detail}</span>
                  </span>
                  <Badge tone={c.ok ? "success" : "warning"}>{c.ok ? "OK" : "Atenção"}</Badge>
                </li>
              ))}
            </ul>
            <div className="mt-5 grid gap-3">
              <CopyField label="Sonda para monitorização (UptimeRobot, Better Stack…)" value={`${SITE_URL}/api/health`} />
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-display text-lg tracking-tight">Ligações</h2>
            <ul className="mt-4 grid gap-2 text-sm">
              {INTEGRATIONS.map((d) => {
                const r = integrations.find((i) => i.id === d.id);
                return (
                  <li key={d.id} className="flex items-center justify-between gap-3">
                    <a href={`/admin/ligacoes?s=${d.id}`} className="hover:underline">
                      {d.name}
                    </a>
                    {!r?.enabled ? (
                      <Badge>Desligado</Badge>
                    ) : r.lastTestOk === false ? (
                      <Badge tone="danger">Erro no último teste</Badge>
                    ) : r.lastTestOk ? (
                      <Badge tone="success">{r.mode === "live" ? "Produção" : "Teste"}</Badge>
                    ) : (
                      <Badge tone="warning">Por testar</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <h2 className="mb-3 mt-10 font-display text-xl tracking-tight">Tarefas automáticas</h2>
        <TableWrap>
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-[var(--color-line)]">
              <tr>
                <Th>Tarefa</Th>
                <Th>Frequência</Th>
                <Th>Última execução</Th>
                <Th>Resultado</Th>
                <Th className="text-right">Ação</Th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.name} className="border-b border-[var(--color-line-soft)] last:border-0">
                  <Td>{j.label}</Td>
                  <Td className="text-[var(--color-ink-muted)]">
                    {j.everyMinutes >= 1440 ? "diária" : j.everyMinutes >= 60 ? `${j.everyMinutes / 60} h` : `${j.everyMinutes} min`}
                  </Td>
                  <Td className="whitespace-nowrap text-xs">{formatDate(j.lastRunAt, true)}</Td>
                  <Td className="text-xs">
                    {j.lastOk === null ? (
                      <span className="text-[var(--color-ink-muted)]">Ainda não correu</span>
                    ) : (
                      <span className={j.lastOk ? "text-[var(--color-success)]" : "text-red-700"}>{j.message}</span>
                    )}
                  </Td>
                  <Td className="text-right">
                    <form action={runJobNow}>
                      <input type="hidden" name="job" value={j.name} />
                      <SubmitButton variant="ghost" icon="sync" pendingLabel="…">
                        Correr agora
                      </SubmitButton>
                    </form>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>

        <h2 className="mb-3 mt-10 font-display text-xl tracking-tight">E-mails recentes</h2>
        <TableWrap>
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-[var(--color-line)]">
              <tr>
                <Th>Quando</Th>
                <Th>Para</Th>
                <Th>Assunto</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {emails.length === 0 && (
                <tr>
                  <Td className="text-[var(--color-ink-muted)]">Ainda não foi enviado nenhum e-mail.</Td>
                </tr>
              )}
              {emails.map((e) => (
                <tr key={e.id} className="border-b border-[var(--color-line-soft)] last:border-0">
                  <Td className="whitespace-nowrap text-xs">{formatDate(e.createdAt, true)}</Td>
                  <Td className="text-xs">{e.to}</Td>
                  <Td className="text-xs">{e.subject}</Td>
                  <Td>
                    <Badge tone={e.status === "sent" ? "success" : e.status === "failed" ? "danger" : "neutral"}>
                      {e.status === "sent" ? "Enviado" : e.status === "failed" ? "Falhou" : "Não enviado"}
                    </Badge>
                    {e.status !== "sent" && <span className="ml-2 text-xs text-[var(--color-ink-muted)]">{e.message}</span>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Section>
    </>
  );
}
