import Link from "next/link";
import { notFound } from "next/navigation";
import { listExtras } from "@/lib/repo/admin";
import { saveExtra } from "@/app/(admin)/admin/actions";
import { AdminHeader, Section, Card, fieldClass, labelClass } from "@/components/admin/ui";
import { LocaleFields } from "@/components/admin/LocaleFields";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";

export default async function ExtraEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const isNew = id === "novo";
  const extras = await listExtras();
  const extra = isNew ? null : extras.find((e) => e.id === id);
  if (!isNew && !extra) notFound();

  return (
    <>
      <AdminHeader
        title={isNew ? "Novo extra" : extra!.label.pt}
        subtitle="Serviço adicional oferecido durante a reserva."
      />
      <Section>
        <form action={saveExtra} className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="grid gap-5">
                <LocaleFields name="label" label="Nome" values={extra?.label} required />
                <LocaleFields
                  name="description"
                  label="Descrição"
                  values={extra?.description}
                  variant="textarea"
                  rows={3}
                />
              </div>
            </Card>
          </div>

          <div>
            <Card className="sticky top-6 p-6">
              <div className="grid gap-5">
                <div>
                  <label className={labelClass} htmlFor="id">
                    Identificador
                  </label>
                  <input
                    id="id"
                    name="id"
                    defaultValue={extra?.id ?? ""}
                    readOnly={!isNew}
                    className={`${fieldClass} ${!isNew ? "bg-[var(--color-line-soft)]" : ""}`}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="price">
                    Preço (€)
                  </label>
                  <input
                    id="price"
                    name="price"
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={extra?.price ?? 0}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="position">
                    Ordem
                  </label>
                  <input
                    id="position"
                    name="position"
                    type="number"
                    defaultValue={extra?.position ?? extras.length}
                    className={fieldClass}
                  />
                </div>
                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="perNight"
                    defaultChecked={extra?.perNight ?? false}
                    className="h-4 w-4 accent-[var(--color-accent-deep)]"
                  />
                  Cobrar por noite
                </label>
                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={extra?.active ?? true}
                    className="h-4 w-4 accent-[var(--color-accent-deep)]"
                  />
                  Ativo no motor de reservas
                </label>
                <div className="flex flex-wrap gap-3 border-t border-[var(--color-line)] pt-5">
                  <SubmitButton icon="check" pendingLabel="A guardar…">
                    Guardar
                  </SubmitButton>
                  <Link
                    href="/admin/tarifas"
                    className="inline-flex items-center rounded-full border border-[var(--color-line)] px-4 py-2 text-sm text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-line-soft)]"
                  >
                    Cancelar
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        </form>
      </Section>
    </>
  );
}
