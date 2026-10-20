import { requirePagePermission } from "@/lib/auth/session";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listOffers } from "@/lib/repo/admin";
import { listMedia } from "@/lib/repo/ops";
import { galleryImages as seedGallery } from "@/data/hotel";
import { saveOffer } from "@/app/(admin)/admin/actions";
import { AdminHeader, Section, Card, fieldClass, labelClass } from "@/components/admin/ui";
import { LocaleFields } from "@/components/admin/LocaleFields";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";

export default async function OfferEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("/admin/promocoes/x");
  const { id } = await params;
  const isNew = id === "nova";
  const offers = await listOffers();
  const offer = isNew ? null : offers.find((o) => o.id === id);
  if (!isNew && !offer) notFound();

  const media = await listMedia().catch(() => []);
  const suggestions = [...media.map((m) => m.path), ...seedGallery];

  return (
    <>
      <AdminHeader
        title={isNew ? "Nova promoção" : offer!.title.pt}
        subtitle={isNew ? "Criar um novo pacote." : `Editar /${offer!.slug}`}
      />
      <Section>
        <form action={saveOffer} className="grid gap-6 lg:grid-cols-3">
          <datalist id="offer-images">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>

          <div className="grid gap-6 lg:col-span-2">
            <Card className="p-6">
              <h2 className="font-display text-lg tracking-tight">Conteúdo</h2>
              <div className="mt-4 grid gap-5">
                <LocaleFields name="title" label="Título" values={offer?.title} required />
                <LocaleFields name="badge" label="Etiqueta" values={offer?.badge} />
                <LocaleFields
                  name="description"
                  label="Descrição"
                  values={offer?.description}
                  variant="textarea"
                  rows={4}
                />
                <LocaleFields
                  name="priceLabel"
                  label="Legenda do preço"
                  values={offer?.priceLabel}
                  help="Ex.: «para 2 pessoas»."
                />
                <LocaleFields
                  name="includes"
                  label="Inclui"
                  values={offer?.includes}
                  variant="list"
                  rows={5}
                />
                <LocaleFields
                  name="conditions"
                  label="Condições"
                  values={offer?.conditions}
                  variant="list"
                  rows={5}
                />
              </div>
            </Card>
          </div>

          <div>
            <Card className="sticky top-6 p-6">
              <h2 className="font-display text-lg tracking-tight">Publicação</h2>
              <div className="mt-4 grid gap-5">
                <div>
                  <label className={labelClass} htmlFor="slug">
                    Slug
                  </label>
                  <input id="slug" name="slug" defaultValue={offer?.slug ?? ""} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="id">
                    Identificador
                  </label>
                  <input
                    id="id"
                    name="id"
                    defaultValue={offer?.id ?? ""}
                    readOnly={!isNew}
                    className={`${fieldClass} ${!isNew ? "bg-[var(--color-line-soft)]" : ""}`}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="image">
                    Imagem
                  </label>
                  <input
                    id="image"
                    name="image"
                    list="offer-images"
                    defaultValue={offer?.image ?? ""}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="priceFrom">
                    Preço desde (€)
                  </label>
                  <input
                    id="priceFrom"
                    name="priceFrom"
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={offer?.priceFrom ?? 0}
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
                    defaultValue={offer?.position ?? offers.length}
                    className={fieldClass}
                  />
                </div>
                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="published"
                    defaultChecked={offer?.published ?? true}
                    className="h-4 w-4 accent-[var(--color-accent-deep)]"
                  />
                  Publicada no site
                </label>
                <div className="flex flex-wrap gap-3 border-t border-[var(--color-line)] pt-5">
                  <SubmitButton icon="check" pendingLabel="A guardar…">
                    Guardar
                  </SubmitButton>
                  <Link
                    href="/admin/promocoes"
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
