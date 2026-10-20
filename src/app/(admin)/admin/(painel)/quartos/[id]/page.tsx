import { requirePagePermission } from "@/lib/auth/session";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRoom, listRooms } from "@/lib/repo/admin";
import { listMedia } from "@/lib/repo/ops";
import { galleryImages as seedGallery } from "@/data/hotel";
import { saveRoom } from "@/app/(admin)/admin/actions";
import { AdminHeader, Section, Card, fieldClass, labelClass } from "@/components/admin/ui";
import { LocaleFields } from "@/components/admin/LocaleFields";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";

export default async function RoomEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("/admin/quartos/x");
  const { id } = await params;
  const isNew = id === "novo";
  const room = isNew ? null : await getRoom(id);
  if (!isNew && !room) notFound();

  const nextPosition = isNew ? (await listRooms()).length : room!.position;

  // Suggestions for any image field: uploaded media plus the bundled assets.
  const media = await listMedia().catch(() => []);
  const suggestions = [
    ...media.map((m) => m.path),
    ...seedGallery,
  ];

  return (
    <>
      <AdminHeader
        title={isNew ? "Novo quarto" : room!.name.pt}
        subtitle={isNew ? "Criar uma nova tipologia." : `Editar /${room!.slug}`}
      />

      <Section>
        <form action={saveRoom} className="grid gap-6 lg:grid-cols-3">
          <datalist id="image-suggestions">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>

          <div className="grid gap-6 lg:col-span-2">
            <Card className="p-6">
              <h2 className="font-display text-lg tracking-tight">Identificação</h2>
              <div className="mt-4 grid gap-5">
                <LocaleFields
                  name="name"
                  label="Nome"
                  values={room?.name}
                  required
                />
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor="slug">
                      Slug (URL)
                    </label>
                    <input
                      id="slug"
                      name="slug"
                      defaultValue={room?.slug ?? ""}
                      placeholder="gerado a partir do nome"
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="id">
                      Identificador interno
                    </label>
                    <input
                      id="id"
                      name="id"
                      defaultValue={room?.id ?? ""}
                      readOnly={!isNew}
                      placeholder="gerado a partir do nome"
                      className={`${fieldClass} ${!isNew ? "bg-[var(--color-line-soft)]" : ""}`}
                    />
                  </div>
                </div>
                <LocaleFields
                  name="shortDescription"
                  label="Descrição curta"
                  values={room?.shortDescription}
                  variant="textarea"
                  rows={3}
                />
                <LocaleFields
                  name="longDescription"
                  label="Descrição longa"
                  values={room?.longDescription}
                  variant="list"
                  rows={7}
                  help="Um parágrafo por linha."
                />
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="font-display text-lg tracking-tight">Características</h2>
              <div className="mt-4 grid gap-5">
                <LocaleFields name="bed" label="Cama" values={room?.bed} />
                <LocaleFields name="bathroom" label="Casa de banho" values={room?.bathroom} />
                <LocaleFields
                  name="amenities"
                  label="Comodidades"
                  values={room?.amenities}
                  variant="list"
                  rows={7}
                />
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="font-display text-lg tracking-tight">Imagens</h2>
              <div className="mt-4 grid gap-5">
                <div>
                  <label className={labelClass} htmlFor="image">
                    Imagem principal
                  </label>
                  <input
                    id="image"
                    name="image"
                    list="image-suggestions"
                    defaultValue={room?.image ?? ""}
                    placeholder="/images/rooms/..."
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="gallery">
                    Galeria
                  </label>
                  <textarea
                    id="gallery"
                    name="gallery"
                    rows={4}
                    defaultValue={room?.gallery.join("\n") ?? ""}
                    className={fieldClass}
                  />
                  <p className="mt-1.5 text-xs text-[var(--color-ink-muted)]">
                    Um caminho por linha.
                  </p>
                </div>
                <div>
                  <label className={labelClass} htmlFor="panorama360">
                    Panorama 360º (opcional)
                  </label>
                  <input
                    id="panorama360"
                    name="panorama360"
                    defaultValue={room?.panorama360 ?? ""}
                    placeholder="URL de imagem equirretangular"
                    className={fieldClass}
                  />
                </div>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-6 p-6">
              <h2 className="font-display text-lg tracking-tight">Publicação</h2>
              <div className="mt-4 grid gap-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass} htmlFor="capacity">
                      Capacidade
                    </label>
                    <input
                      id="capacity"
                      name="capacity"
                      type="number"
                      min={1}
                      max={8}
                      defaultValue={room?.capacity ?? 2}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="size">
                      Área (m²)
                    </label>
                    <input
                      id="size"
                      name="size"
                      type="number"
                      min={0}
                      defaultValue={room?.size ?? 0}
                      className={fieldClass}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass} htmlFor="priceFrom">
                    Preço desde (€ / noite)
                  </label>
                  <input
                    id="priceFrom"
                    name="priceFrom"
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={room?.priceFrom ?? 0}
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
                    defaultValue={nextPosition}
                    className={fieldClass}
                  />
                </div>

                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="romantic"
                    defaultChecked={room?.romantic ?? false}
                    className="h-4 w-4 accent-[var(--color-accent-deep)]"
                  />
                  Pacote romântico
                </label>

                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="published"
                    defaultChecked={room?.published ?? true}
                    className="h-4 w-4 accent-[var(--color-accent-deep)]"
                  />
                  Publicado no site
                </label>

                <div className="flex flex-wrap gap-3 border-t border-[var(--color-line)] pt-5">
                  <SubmitButton icon="check" pendingLabel="A guardar…">
                    Guardar
                  </SubmitButton>
                  <Link
                    href="/admin/quartos"
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
