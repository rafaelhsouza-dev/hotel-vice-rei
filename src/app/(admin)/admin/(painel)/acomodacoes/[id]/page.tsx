import { requirePagePermission } from "@/lib/auth/session";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listUnits, UNIT_STATUSES } from "@/lib/repo/operations";
import { listRooms } from "@/lib/repo/admin";
import { saveUnit } from "@/app/(admin)/admin/actions-ops";
import { AdminHeader, Section, Card, fieldClass, labelClass } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { UNIT_LABEL } from "@/components/admin/StatusPill";

export const dynamic = "force-dynamic";

export default async function UnitEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("/admin/acomodacoes/x");
  const { id } = await params;
  const isNew = id === "nova";
  const units = await listUnits();
  const unit = isNew ? null : units.find((u) => String(u.id) === id);
  if (!isNew && !unit) notFound();

  const rooms = await listRooms();
  const nextFloor = isNew ? Math.max(1, ...units.map((u) => u.floor)) : unit!.floor;

  return (
    <>
      <AdminHeader
        title={isNew ? "Nova unidade" : `Unidade ${unit!.code}`}
        subtitle={isNew ? "Registar uma acomodação física." : "Editar acomodação física."}
      />
      <Section>
        <form action={saveUnit} className="max-w-2xl">
          {!isNew && <input type="hidden" name="id" value={unit!.id} />}
          <Card className="p-6">
            <div className="grid gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="code">
                    Número da unidade
                  </label>
                  <input
                    id="code"
                    name="code"
                    required
                    defaultValue={unit?.code ?? ""}
                    placeholder="Ex.: 305"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="floor">
                    Piso
                  </label>
                  <input
                    id="floor"
                    name="floor"
                    type="number"
                    min={0}
                    defaultValue={unit?.floor ?? nextFloor}
                    className={fieldClass}
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="roomId">
                    Tipologia
                  </label>
                  <select
                    id="roomId"
                    name="roomId"
                    defaultValue={unit?.roomId ?? ""}
                    className={fieldClass}
                  >
                    <option value="">Sem tipologia</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name.pt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="status">
                    Estado
                  </label>
                  <select
                    id="status"
                    name="status"
                    defaultValue={unit?.status ?? "available"}
                    className={fieldClass}
                  >
                    {UNIT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {UNIT_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass} htmlFor="notes">
                  Notas internas
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  defaultValue={unit?.notes ?? ""}
                  placeholder="Ex.: vista para o pátio, ar condicionado substituído em 2026."
                  className={fieldClass}
                />
              </div>

              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={unit?.active ?? true}
                  className="h-4 w-4 accent-[var(--color-accent-deep)]"
                />
                Unidade ativa no inventário do hotel
              </label>

              <div className="flex flex-wrap gap-3 border-t border-[var(--color-line)] pt-5">
                <SubmitButton icon="check" pendingLabel="A guardar…">
                  Guardar
                </SubmitButton>
                <Link
                  href="/admin/acomodacoes"
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
