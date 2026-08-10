import Link from "next/link";
import { notFound } from "next/navigation";
import { listPosts } from "@/lib/repo/admin";
import { listMedia } from "@/lib/repo/ops";
import { galleryImages as seedGallery } from "@/data/hotel";
import { savePost } from "@/app/(admin)/admin/actions";
import { AdminHeader, Section, Card, fieldClass, labelClass } from "@/components/admin/ui";
import { LocaleFields } from "@/components/admin/LocaleFields";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";

export default async function PostEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const isNew = slug === "novo";
  const posts = await listPosts();
  const post = isNew ? null : posts.find((p) => p.slug === slug);
  if (!isNew && !post) notFound();

  const media = await listMedia().catch(() => []);
  const suggestions = [...media.map((m) => m.path), ...seedGallery];

  return (
    <>
      <AdminHeader
        title={isNew ? "Novo artigo" : post!.title.pt}
        subtitle={isNew ? "Escrever um novo artigo." : `Editar /${post!.slug}`}
      />
      <Section>
        <form action={savePost} className="grid gap-6 lg:grid-cols-3">
          <input type="hidden" name="previousSlug" value={post?.slug ?? ""} />
          <datalist id="post-images">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>

          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="grid gap-5">
                <LocaleFields name="title" label="Título" values={post?.title} required />
                <LocaleFields name="category" label="Categoria" values={post?.category} />
                <LocaleFields
                  name="excerpt"
                  label="Resumo"
                  values={post?.excerpt}
                  variant="textarea"
                  rows={3}
                />
                <LocaleFields
                  name="body"
                  label="Corpo do artigo"
                  values={post?.body}
                  variant="list"
                  rows={14}
                  help="Um parágrafo por linha."
                />
              </div>
            </Card>
          </div>

          <div>
            <Card className="sticky top-6 p-6">
              <div className="grid gap-5">
                <div>
                  <label className={labelClass} htmlFor="slug">
                    Slug
                  </label>
                  <input id="slug" name="slug" defaultValue={post?.slug ?? ""} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="image">
                    Imagem de capa
                  </label>
                  <input
                    id="image"
                    name="image"
                    list="post-images"
                    defaultValue={post?.image ?? ""}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="date">
                    Data
                  </label>
                  <input
                    id="date"
                    name="date"
                    type="date"
                    defaultValue={post?.date ?? new Date().toISOString().slice(0, 10)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="readingMinutes">
                    Tempo de leitura (min)
                  </label>
                  <input
                    id="readingMinutes"
                    name="readingMinutes"
                    type="number"
                    min={1}
                    defaultValue={post?.readingMinutes ?? 3}
                    className={fieldClass}
                  />
                </div>
                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="published"
                    defaultChecked={post?.published ?? true}
                    className="h-4 w-4 accent-[var(--color-accent-deep)]"
                  />
                  Publicado no site
                </label>
                <div className="flex flex-wrap gap-3 border-t border-[var(--color-line)] pt-5">
                  <SubmitButton icon="check" pendingLabel="A guardar…">
                    Guardar
                  </SubmitButton>
                  <Link
                    href="/admin/blog"
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
