import { requirePagePermission } from "@/lib/auth/session";
import Image from "next/image";
import { listPosts } from "@/lib/repo/admin";
import { AdminHeader, Section, TableWrap, Th, Td, EmptyState, Badge } from "@/components/admin/ui";
import { RowActions } from "@/components/admin/RowActions";

export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeZone: "UTC" });

export default async function BlogAdminPage() {
  await requirePagePermission("/admin/blog");
  const posts = await listPosts();
  const ids = posts.map((p) => p.slug);

  return (
    <>
      <AdminHeader
        title="Blog"
        subtitle="Artigos sobre o Porto e o hotel."
        action={{ href: "/admin/blog/novo", label: "Novo artigo" }}
      />
      <Section>
        {posts.length === 0 ? (
          <EmptyState message="Ainda não há artigos." />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-[var(--color-line)]">
                <tr>
                  <Th>Artigo</Th>
                  <Th>Categoria</Th>
                  <Th>Data</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr
                    key={post.slug}
                    className="border-b border-[var(--color-line-soft)] last:border-0"
                  >
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="relative h-11 w-16 shrink-0 overflow-hidden rounded-lg bg-[var(--color-line-soft)]">
                          {post.image && (
                            <Image src={post.image} alt="" fill sizes="64px" className="object-cover" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{post.title.pt}</p>
                          <p className="truncate text-xs text-[var(--color-ink-muted)]">
                            /{post.slug}
                          </p>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-[var(--color-ink-soft)]">{post.category.pt}</Td>
                    <Td className="text-[var(--color-ink-soft)]">
                      {fmt.format(new Date(post.date))}
                    </Td>
                    <Td>
                      <Badge tone={post.published ? "success" : "neutral"}>
                        {post.published ? "Publicado" : "Rascunho"}
                      </Badge>
                    </Td>
                    <Td>
                      <RowActions
                        table="posts"
                        id={post.slug}
                        ids={ids}
                        published={post.published}
                        editHref={`/admin/blog/${post.slug}`}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Section>
    </>
  );
}
