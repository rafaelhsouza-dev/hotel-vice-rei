import Link from "next/link";
import { notFound } from "next/navigation";
import { listServices } from "@/lib/repo/admin";
import { saveService } from "@/app/(admin)/admin/actions";
import { AdminHeader, Section, Card, fieldClass, labelClass } from "@/components/admin/ui";
import { LocaleFields } from "@/components/admin/LocaleFields";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";

/** Icons that read sensibly next to a hotel amenity. */
const ICON_CHOICES = [
  "bed", "wifi", "breakfast", "parking", "concierge", "ac", "tv",
  "reception24", "laundry", "tours", "bar", "safe", "elevator", "phone",
  "globe", "users", "calendar", "shield", "sparkle", "map",
];

export default async function ServiceEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const isNew = id === "novo";
  const services = await listServices();
  const service = isNew ? null : services.find((s) => s.id === id);
  if (!isNew && !service) notFound();

  return (
    <>
      <AdminHeader
        title={isNew ? "Novo serviço" : service!.title.pt}
        subtitle={isNew ? "Adicionar uma comodidade." : "Editar comodidade."}
      />
      <Section>
        <form action={saveService} className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="grid gap-5">
                <LocaleFields name="title" label="Título" values={service?.title} required />
                <LocaleFields
                  name="description"
                  label="Descrição"
                  values={service?.description}
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
                    defaultValue={service?.id ?? ""}
                    readOnly={!isNew}
                    className={`${fieldClass} ${!isNew ? "bg-[var(--color-line-soft)]" : ""}`}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="icon">
                    Ícone
                  </label>
                  <select
                    id="icon"
                    name="icon"
                    defaultValue={service?.icon ?? "sparkle"}
                    className={fieldClass}
                  >
                    {ICON_CHOICES.map((icon) => (
                      <option key={icon} value={icon}>
                        {icon}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="position">
                    Ordem
                  </label>
                  <input
                    id="position"
                    name="position"
                    type="number"
                    defaultValue={service?.position ?? services.length}
                    className={fieldClass}
                  />
                </div>
                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="published"
                    defaultChecked={service?.published ?? true}
                    className="h-4 w-4 accent-[var(--color-accent-deep)]"
                  />
                  Publicado no site
                </label>
                <div className="flex flex-wrap gap-3 border-t border-[var(--color-line)] pt-5">
                  <SubmitButton icon="check" pendingLabel="A guardar…">
                    Guardar
                  </SubmitButton>
                  <Link
                    href="/admin/servicos"
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
