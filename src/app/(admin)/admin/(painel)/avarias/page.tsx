import Image from "next/image";
import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { SEVERITIES, SEVERITY_LABEL, issueSummary, listIssues } from "@/lib/repo/maintenance";
import { listInventory, listStaff, listSuppliers, listUnits } from "@/lib/repo/operations";
import {
  createRepairOrderAction,
  reportIssueAction,
  resolveIssueAction,
  updateRepairOrderAction,
  usePartsAction,
} from "@/app/(admin)/admin/actions-maint";
import { AdminHeader, Section, Card, Badge, Field, Flash, Stat, EmptyState, fieldClass, euro, formatDate } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";

const SEV_TONE = { low: "neutral", normal: "info", high: "warning", urgent: "danger" } as const;
const STATUS = { open: "Aberta", in_progress: "Em reparação", resolved: "Resolvida" } as const;

export default async function IssuesPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; todas?: string }> }) {
  const actor = await requirePagePermission("/admin/avarias");
  const sp = await searchParams;
  const all = sp.todas === "1";
  const [issues, summary, units, staff, suppliers, inventory] = await Promise.all([
    listIssues(all ? "all" : "open"),
    issueSummary(),
    listUnits().catch(() => []),
    listStaff().catch(() => []),
    listSuppliers().catch(() => []),
    listInventory().catch(() => []),
  ]);
  const manage = can(actor.role, "maintenance.manage");
  const techs = staff.filter((s) => s.active && (s.department === "maintenance" || s.department === "housekeeping"));
  const parts = inventory.filter((i) => i.active && i.quantity > 0);

  return (
    <>
      <AdminHeader title="Avarias e reparações" subtitle="Quem reporta, o que está avariado, quem repara, com que peças e quanto custou." />
      <Section>
        <Flash ok={sp.ok} error={sp.erro} />
        <div className="mb-6 grid grid-cols-3 gap-3">
          <Stat label="Abertas" value={summary.open} />
          <Stat label="Urgentes" value={summary.urgent} tone={summary.urgent ? "danger" : "neutral"} />
          <Stat label="A bloquear quartos" value={summary.blocked} tone={summary.blocked ? "warning" : "neutral"} />
        </div>

        <Card className="mb-8 p-6">
          <h2 className="font-display text-lg tracking-tight">Reportar avaria</h2>
          <form action={reportIssueAction} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Quarto" htmlFor="unitId">
              <select id="unitId" name="unitId" className={fieldClass}>
                <option value="">Zona comum</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Local (zona comum)" htmlFor="location">
              <input id="location" name="location" placeholder="Receção, elevador…" className={fieldClass} />
            </Field>
            <Field label="O que se passa" htmlFor="title" className="lg:col-span-2">
              <input id="title" name="title" required maxLength={160} placeholder="Torneira do lavatório a pingar" className={fieldClass} />
            </Field>
            <Field label="Detalhes" htmlFor="description" className="sm:col-span-2">
              <textarea id="description" name="description" rows={2} className={fieldClass} />
            </Field>
            <Field label="Gravidade" htmlFor="severity">
              <select id="severity" name="severity" defaultValue="normal" className={fieldClass}>
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {SEVERITY_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fotografia" htmlFor="photo" hint="Pode tirar no telemóvel.">
              <input id="photo" name="photo" type="file" accept="image/*" capture="environment" className="block w-full text-sm" />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="blocksUnit" className="h-4 w-4" /> O quarto não pode ser vendido até ser reparado
            </label>
            <div className="sm:col-span-2 lg:col-span-4">
              <SubmitButton icon="alert" pendingLabel="A registar…">
                Reportar
              </SubmitButton>
            </div>
          </form>
        </Card>

        <div className="mb-4 flex gap-2 text-sm">
          <Link href="/admin/avarias" className={`rounded-full px-3.5 py-1.5 ${!all ? "bg-[var(--color-ink)] text-white" : "border border-[var(--color-line)] bg-white"}`}>
            Por resolver
          </Link>
          <Link href="/admin/avarias?todas=1" className={`rounded-full px-3.5 py-1.5 ${all ? "bg-[var(--color-ink)] text-white" : "border border-[var(--color-line)] bg-white"}`}>
            Todas
          </Link>
        </div>

        {issues.length === 0 ? (
          <EmptyState message="Sem avarias por resolver." />
        ) : (
          <div className="grid gap-4">
            {issues.map((i) => {
              const total = i.orders.reduce((s, o) => s + o.cost + o.partsCost, 0);
              return (
                <Card key={i.id} className="p-5">
                  <div className="flex flex-wrap items-start gap-4">
                    {i.photo && (
                      <a href={i.photo} target="_blank" rel="noopener noreferrer" className="relative h-24 w-32 shrink-0 overflow-hidden rounded-xl border border-[var(--color-line)]">
                        <Image src={i.photo} alt={`Fotografia: ${i.title}`} fill sizes="128px" className="object-cover" />
                      </a>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{i.title}</p>
                        <Badge tone={SEV_TONE[i.severity]}>{SEVERITY_LABEL[i.severity]}</Badge>
                        <Badge tone={i.status === "resolved" ? "success" : "warning"}>{STATUS[i.status]}</Badge>
                        {i.blocksUnit && i.status !== "resolved" && <Badge tone="danger">Quarto bloqueado</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                        {i.unitCode ? `Quarto ${i.unitCode}` : i.location || "Zona comum"} · reportada por {i.reportedBy || "—"} em {formatDate(i.createdAt, true)}
                        {i.resolvedAt ? ` · resolvida ${formatDate(i.resolvedAt, true)}` : ""}
                      </p>
                      {i.description && <p className="mt-2 whitespace-pre-line text-sm">{i.description}</p>}
                    </div>
                    {manage && (
                      <form action={resolveIssueAction}>
                        <input type="hidden" name="id" value={i.id} />
                        {i.status === "resolved" ? (
                          <>
                            <input type="hidden" name="action" value="reopen" />
                            <SubmitButton variant="ghost">Reabrir</SubmitButton>
                          </>
                        ) : (
                          <SubmitButton icon="check" confirm="Dar a avaria como resolvida?">
                            Resolvida
                          </SubmitButton>
                        )}
                      </form>
                    )}
                  </div>

                  {i.orders.length > 0 && (
                    <div className="mt-4 grid gap-3 border-t border-[var(--color-line)] pt-4">
                      {i.orders.map((o) => (
                        <div key={o.id} className="rounded-xl bg-[var(--color-line-soft)] p-3 text-sm">
                          <p className="font-medium">
                            {o.title} <span className="text-xs font-normal text-[var(--color-ink-muted)]">· {o.status === "done" ? "concluída" : o.status === "in_progress" ? "em curso" : "por iniciar"}</span>
                          </p>
                          <p className="text-xs text-[var(--color-ink-muted)]">
                            {o.assigneeName ? `Responsável: ${o.assigneeName}` : "Sem responsável"}
                            {o.supplierName ? ` · Fornecedor: ${o.supplierName}` : ""}
                            {o.dueDate ? ` · Prazo: ${formatDate(o.dueDate)}` : ""} · Mão de obra/serviço {euro.format(o.cost)} · Peças {euro.format(o.partsCost)}
                          </p>
                          {o.parts.length > 0 && (
                            <p className="mt-1 text-xs">Peças: {o.parts.map((p) => `${p.quantity} ${p.unit} ${p.item}`).join(", ")}</p>
                          )}
                          {o.notes && <p className="mt-1 text-xs italic">{o.notes}</p>}
                          {manage && i.status !== "resolved" && (
                            <div className="mt-3 grid gap-3 lg:grid-cols-2">
                              <form action={updateRepairOrderAction} className="flex flex-wrap items-end gap-2">
                                <input type="hidden" name="taskId" value={o.id} />
                                <Field label="Custo (€)" htmlFor={`c-${o.id}`}>
                                  <input id={`c-${o.id}`} name="cost" inputMode="decimal" defaultValue={o.cost} className={`${fieldClass} w-28`} />
                                </Field>
                                <Field label="Fornecedor" htmlFor={`s-${o.id}`}>
                                  <select id={`s-${o.id}`} name="supplierId" defaultValue="" className={fieldClass}>
                                    <option value="">—</option>
                                    {suppliers.map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.name}
                                      </option>
                                    ))}
                                  </select>
                                </Field>
                                <Field label="Notas" htmlFor={`n-${o.id}`} className="min-w-[10rem] flex-1">
                                  <input id={`n-${o.id}`} name="notes" defaultValue={o.notes} className={fieldClass} />
                                </Field>
                                <SubmitButton variant="ghost">Guardar</SubmitButton>
                              </form>
                              {parts.length > 0 && (
                                <form action={usePartsAction} className="flex flex-wrap items-end gap-2">
                                  <input type="hidden" name="taskId" value={o.id} />
                                  <Field label="Peça do stock" htmlFor={`p-${o.id}`} className="min-w-[10rem] flex-1">
                                    <select id={`p-${o.id}`} name="itemId" className={fieldClass}>
                                      {parts.map((p) => (
                                        <option key={p.id} value={p.id}>
                                          {p.name} ({p.quantity} {p.unit})
                                        </option>
                                      ))}
                                    </select>
                                  </Field>
                                  <Field label="Qtd." htmlFor={`q-${o.id}`}>
                                    <input id={`q-${o.id}`} name="quantity" inputMode="decimal" defaultValue="1" className={`${fieldClass} w-20`} />
                                  </Field>
                                  <SubmitButton variant="ghost">Usar</SubmitButton>
                                </form>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      {total > 0 && <p className="text-right text-sm font-medium">Custo total: {euro.format(total)}</p>}
                    </div>
                  )}

                  {manage && i.status !== "resolved" && (
                    <details className="mt-4 border-t border-[var(--color-line)] pt-3">
                      <summary className="cursor-pointer text-sm text-[var(--color-accent-deep)]">Criar ordem de reparação</summary>
                      <form action={createRepairOrderAction} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
                        <input type="hidden" name="issueId" value={i.id} />
                        <Field label="Título" htmlFor={`t-${i.id}`} className="lg:col-span-2">
                          <input id={`t-${i.id}`} name="title" placeholder={`Reparação: ${i.title}`} className={fieldClass} />
                        </Field>
                        <Field label="Responsável" htmlFor={`a-${i.id}`}>
                          <select id={`a-${i.id}`} name="assigneeId" className={fieldClass}>
                            <option value="">—</option>
                            {techs.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Fornecedor" htmlFor={`f-${i.id}`}>
                          <select id={`f-${i.id}`} name="supplierId" className={fieldClass}>
                            <option value="">—</option>
                            {suppliers.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Prazo" htmlFor={`d-${i.id}`}>
                          <input id={`d-${i.id}`} name="dueDate" type="date" className={fieldClass} />
                        </Field>
                        <Field label="Custo previsto (€)" htmlFor={`co-${i.id}`}>
                          <input id={`co-${i.id}`} name="cost" inputMode="decimal" className={fieldClass} />
                        </Field>
                        <Field label="Instruções" htmlFor={`in-${i.id}`} className="lg:col-span-3">
                          <input id={`in-${i.id}`} name="notes" className={fieldClass} />
                        </Field>
                        <div>
                          <SubmitButton icon="wrench" pendingLabel="…">
                            Criar
                          </SubmitButton>
                        </div>
                      </form>
                    </details>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </Section>
    </>
  );
}
