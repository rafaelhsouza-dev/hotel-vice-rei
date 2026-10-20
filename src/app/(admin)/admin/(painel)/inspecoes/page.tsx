import { requirePagePermission } from "@/lib/auth/session";
import { listChecklists, listInspections } from "@/lib/repo/maintenance";
import { listUnits } from "@/lib/repo/operations";
import { recordInspectionAction, saveChecklistAction } from "@/app/(admin)/admin/actions-maint";
import { AdminHeader, Section, Card, Badge, Field, Flash, EmptyState, fieldClass, formatDate } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";

export default async function InspectionsPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; lista?: string }> }) {
  await requirePagePermission("/admin/inspecoes");
  const sp = await searchParams;
  const [lists, inspections, units] = await Promise.all([listChecklists(), listInspections(), listUnits().catch(() => [])]);
  const active = lists.filter((l) => l.active);
  const chosen = active.find((l) => l.id === sp.lista) ?? active[0];

  return (
    <>
      <AdminHeader title="Inspeções" subtitle="Verificação dos quartos depois da limpeza, ponto a ponto. Os pontos falhados podem gerar logo uma avaria." />
      <Section>
        <Flash ok={sp.ok} error={sp.erro} />
        <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <Card className="p-6">
            <h2 className="font-display text-lg tracking-tight">Nova inspeção</h2>
            {!chosen ? (
              <p className="mt-3 text-sm text-[var(--color-ink-muted)]">Crie primeiro uma lista de verificação.</p>
            ) : (
              <>
                {active.length > 1 && (
                  <form className="mt-3 flex gap-2" action="/admin/inspecoes">
                    <select name="lista" defaultValue={chosen.id} className={fieldClass} aria-label="Lista">
                      {active.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                    <button className="rounded-full border border-[var(--color-line)] bg-white px-4 text-sm">Usar</button>
                  </form>
                )}
                <form action={recordInspectionAction} className="mt-4 grid gap-4">
                  <input type="hidden" name="checklistId" value={chosen.id} />
                  <Field label="Quarto" htmlFor="unitId">
                    <select id="unitId" name="unitId" required className={fieldClass}>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.code} · {u.roomName ?? ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <fieldset className="grid gap-2">
                    <legend className="mb-1 text-sm font-medium">{chosen.name}</legend>
                    {chosen.items.map((item, i) => (
                      <label key={item} className="flex items-start gap-3 rounded-xl border border-[var(--color-line)] px-3 py-3 text-sm has-[:checked]:border-emerald-400 has-[:checked]:bg-emerald-50">
                        <input type="checkbox" name={`ok${i}`} className="mt-0.5 h-5 w-5" /> {item}
                      </label>
                    ))}
                  </fieldset>
                  <Field label="Observações" htmlFor="notes">
                    <textarea id="notes" name="notes" rows={2} className={fieldClass} />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="createIssue" defaultChecked className="h-4 w-4" /> Criar avaria com os pontos não conformes
                  </label>
                  <div>
                    <SubmitButton icon="clipboard" pendingLabel="A registar…">
                      Registar inspeção
                    </SubmitButton>
                  </div>
                </form>
              </>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="font-display text-lg tracking-tight">Listas de verificação</h2>
            <div className="mt-4 grid gap-4">
              {[...lists, null].map((l) => (
                <details key={l?.id ?? "new"} className="rounded-xl border border-[var(--color-line)] p-3" open={!l && lists.length === 0}>
                  <summary className="cursor-pointer text-sm font-medium">
                    {l ? `${l.name} (${l.items.length} pontos)` : "+ Nova lista"} {l && !l.active && <Badge>Inativa</Badge>}
                  </summary>
                  <form action={saveChecklistAction} className="mt-3 grid gap-3">
                    <input type="hidden" name="id" value={l?.id ?? ""} />
                    <Field label="Nome" htmlFor={`cn-${l?.id ?? "new"}`}>
                      <input id={`cn-${l?.id ?? "new"}`} name="name" defaultValue={l?.name ?? ""} required className={fieldClass} />
                    </Field>
                    <Field label="Pontos (um por linha)" htmlFor={`ci-${l?.id ?? "new"}`}>
                      <textarea id={`ci-${l?.id ?? "new"}`} name="items" rows={6} defaultValue={l?.items.join("\n") ?? ""} className={fieldClass} />
                    </Field>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="active" defaultChecked={l?.active ?? true} className="h-4 w-4" /> Ativa
                    </label>
                    <div>
                      <SubmitButton variant="ghost" icon="check">
                        Guardar
                      </SubmitButton>
                    </div>
                  </form>
                </details>
              ))}
            </div>
          </Card>
        </div>

        <h2 className="mb-3 mt-10 font-display text-xl tracking-tight">Últimas inspeções</h2>
        {inspections.length === 0 ? (
          <EmptyState message="Ainda não há inspeções registadas." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {inspections.map((i) => (
              <Card key={i.id} className="p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    Quarto {i.unitCode ?? "—"} · {i.checklistName}
                  </p>
                  <Badge tone={i.failed === 0 ? "success" : "warning"}>
                    {i.passed}/{i.passed + i.failed} conforme
                  </Badge>
                </div>
                <p className="text-xs text-[var(--color-ink-muted)]">
                  {i.inspector} · {formatDate(i.createdAt, true)}
                </p>
                {i.failed > 0 && (
                  <ul className="mt-2 list-disc pl-4 text-xs text-red-700">
                    {i.results.filter((r) => !r.ok).map((r) => (
                      <li key={r.item}>{r.item}</li>
                    ))}
                  </ul>
                )}
                {i.notes && <p className="mt-2 text-xs italic">{i.notes}</p>}
              </Card>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
