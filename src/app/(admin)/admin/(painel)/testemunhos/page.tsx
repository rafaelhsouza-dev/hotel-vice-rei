import { listTestimonials } from "@/lib/repo/admin";
import { Icon } from "@/components/Icon";
import { AdminHeader, Section, TableWrap, Th, Td, EmptyState, Badge } from "@/components/admin/ui";
import { RowActions } from "@/components/admin/RowActions";

export const dynamic = "force-dynamic";

export default async function TestimonialsAdminPage() {
  const items = await listTestimonials();
  const ids = items.map((t) => t.id);

  return (
    <>
      <AdminHeader
        title="Testemunhos"
        subtitle="Opiniões de hóspedes apresentadas na página inicial."
        action={{ href: "/admin/testemunhos/novo", label: "Novo testemunho" }}
      />
      <Section>
        {items.length === 0 ? (
          <EmptyState message="Ainda não há testemunhos." />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-[var(--color-line)]">
                <tr>
                  <Th>Autor</Th>
                  <Th>Citação</Th>
                  <Th>Avaliação</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--color-line-soft)] last:border-0">
                    <Td>
                      <p className="font-medium">{t.author}</p>
                      <p className="text-xs text-[var(--color-ink-muted)]">{t.origin.pt}</p>
                    </Td>
                    <Td className="max-w-md truncate text-[var(--color-ink-soft)]">
                      {t.quote.pt}
                    </Td>
                    <Td>
                      <span className="flex items-center gap-0.5 text-[var(--color-accent)]">
                        {Array.from({ length: t.rating }).map((_, i) => (
                          <Icon key={i} name="star" width={13} height={13} />
                        ))}
                      </span>
                    </Td>
                    <Td>
                      <Badge tone={t.published ? "success" : "neutral"}>
                        {t.published ? "Publicado" : "Oculto"}
                      </Badge>
                    </Td>
                    <Td>
                      <RowActions
                        table="testimonials"
                        id={t.id}
                        ids={ids}
                        published={t.published}
                        editHref={`/admin/testemunhos/${t.id}`}
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
