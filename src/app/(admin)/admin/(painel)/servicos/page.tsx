import { listServices } from "@/lib/repo/admin";
import { Icon, type IconName } from "@/components/Icon";
import { AdminHeader, Section, TableWrap, Th, Td, EmptyState, Badge } from "@/components/admin/ui";
import { RowActions } from "@/components/admin/RowActions";

export const dynamic = "force-dynamic";

export default async function ServicesAdminPage() {
  const services = await listServices();
  const ids = services.map((s) => s.id);

  return (
    <>
      <AdminHeader
        title="Serviços"
        subtitle="Comodidades apresentadas na home e na página de serviços."
        action={{ href: "/admin/servicos/novo", label: "Novo serviço" }}
      />
      <Section>
        {services.length === 0 ? (
          <EmptyState message="Ainda não há serviços." />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-[var(--color-line)]">
                <tr>
                  <Th>Serviço</Th>
                  <Th>Descrição</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr
                    key={service.id}
                    className="border-b border-[var(--color-line-soft)] last:border-0"
                  >
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-line-soft)] text-[var(--color-accent-deep)]">
                          <Icon name={service.icon as IconName} width={16} height={16} />
                        </span>
                        <span className="font-medium">{service.title.pt}</span>
                      </div>
                    </Td>
                    <Td className="max-w-md truncate text-[var(--color-ink-soft)]">
                      {service.description.pt}
                    </Td>
                    <Td>
                      <Badge tone={service.published ? "success" : "neutral"}>
                        {service.published ? "Publicado" : "Oculto"}
                      </Badge>
                    </Td>
                    <Td>
                      <RowActions
                        table="services"
                        id={service.id}
                        ids={ids}
                        published={service.published}
                        editHref={`/admin/servicos/${service.id}`}
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
