import Link from "next/link";
import { notFound } from "next/navigation";
import { listTestimonials } from "@/lib/repo/admin";
import { saveTestimonial } from "@/app/(admin)/admin/actions";
import { AdminHeader, Section, Card, fieldClass, labelClass } from "@/components/admin/ui";
import { LocaleFields } from "@/components/admin/LocaleFields";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";

export default async function TestimonialEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const isNew = id === "novo";
  const items = await listTestimonials();
  const item = isNew ? null : items.find((t) => t.id === id);
  if (!isNew && !item) notFound();

  return (
    <>
      <AdminHeader
        title={isNew ? "Novo testemunho" : item!.author}
        subtitle={isNew ? "Adicionar uma opinião de hóspede." : "Editar opinião."}
      />
      <Section>
        <form action={saveTestimonial} className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="grid gap-5">
                <div>
                  <label className={labelClass} htmlFor="author">
                    Autor
                  </label>
                  <input
                    id="author"
                    name="author"
                    defaultValue={item?.author ?? ""}
                    required
                    className={fieldClass}
                  />
                </div>
                <LocaleFields
                  name="origin"
                  label="Proveniência"
                  values={item?.origin}
                  help="Ex.: «Lisboa, PT»."
                />
                <LocaleFields
                  name="quote"
                  label="Citação"
                  values={item?.quote}
                  variant="textarea"
                  rows={4}
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
                    defaultValue={item?.id ?? ""}
                    readOnly={!isNew}
                    className={`${fieldClass} ${!isNew ? "bg-[var(--color-line-soft)]" : ""}`}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="rating">
                    Avaliação (1–5)
                  </label>
                  <input
                    id="rating"
                    name="rating"
                    type="number"
                    min={1}
                    max={5}
                    defaultValue={item?.rating ?? 5}
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
                    defaultValue={item?.position ?? items.length}
                    className={fieldClass}
                  />
                </div>
                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="published"
                    defaultChecked={item?.published ?? true}
                    className="h-4 w-4 accent-[var(--color-accent-deep)]"
                  />
                  Publicado no site
                </label>
                <div className="flex flex-wrap gap-3 border-t border-[var(--color-line)] pt-5">
                  <SubmitButton icon="check" pendingLabel="A guardar…">
                    Guardar
                  </SubmitButton>
                  <Link
                    href="/admin/testemunhos"
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
