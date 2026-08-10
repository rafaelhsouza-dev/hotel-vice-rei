import Image from "next/image";
import { listGallery } from "@/lib/repo/admin";
import { listMedia } from "@/lib/repo/ops";
import { galleryImages as seedGallery } from "@/data/hotel";
import { addGalleryImage } from "@/app/(admin)/admin/actions";
import { AdminHeader, Section, Card, EmptyState, fieldClass, labelClass } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { RowActions } from "@/components/admin/RowActions";

export const dynamic = "force-dynamic";

export default async function GalleryAdminPage() {
  const images = await listGallery();
  const ids = images.map((i) => String(i.id));
  const media = await listMedia().catch(() => []);
  const suggestions = [...media.map((m) => m.path), ...seedGallery];

  return (
    <>
      <AdminHeader title="Galeria" subtitle="Imagens da página de galeria." />
      <Section>
        <Card className="p-6">
          <h2 className="font-display text-lg tracking-tight">Adicionar imagem</h2>
          <form action={addGalleryImage} className="mt-4 grid gap-4 sm:grid-cols-[2fr_2fr_auto] sm:items-end">
            <datalist id="gallery-images">
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <div>
              <label className={labelClass} htmlFor="src">
                Caminho da imagem
              </label>
              <input
                id="src"
                name="src"
                list="gallery-images"
                required
                placeholder="/images/... ou /uploads/..."
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="alt">
                Texto alternativo
              </label>
              <input
                id="alt"
                name="alt"
                placeholder="Descrição para leitores de ecrã"
                className={fieldClass}
              />
            </div>
            <SubmitButton icon="plus" pendingLabel="A adicionar…">
              Adicionar
            </SubmitButton>
          </form>
        </Card>

        <div className="mt-6">
          {images.length === 0 ? (
            <EmptyState message="A galeria está vazia." />
          ) : (
            <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {images.map((img) => (
                <li key={img.id}>
                  <Card className="overflow-hidden">
                    <div className="relative aspect-[4/3] bg-[var(--color-line-soft)]">
                      <Image
                        src={img.src}
                        alt={img.alt}
                        fill
                        sizes="(min-width:1280px) 22vw, (min-width:768px) 30vw, 45vw"
                        className={`object-cover ${img.published ? "" : "opacity-40"}`}
                      />
                    </div>
                    <div className="p-3">
                      <p className="truncate text-xs text-[var(--color-ink-muted)]" title={img.src}>
                        {img.src}
                      </p>
                      <div className="mt-2">
                        <RowActions
                          table="gallery_images"
                          id={String(img.id)}
                          ids={ids}
                          published={img.published}
                        />
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>
    </>
  );
}
