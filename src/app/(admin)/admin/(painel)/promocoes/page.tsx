import { requirePagePermission } from "@/lib/auth/session";
import Image from "next/image";
import { listOffers } from "@/lib/repo/admin";
import { AdminHeader, Section, TableWrap, Th, Td, EmptyState, Badge } from "@/components/admin/ui";
import { RowActions } from "@/components/admin/RowActions";

export const dynamic = "force-dynamic";

export default async function OffersAdminPage() {
  await requirePagePermission("/admin/promocoes");
  const offers = await listOffers();
  const ids = offers.map((o) => o.id);

  return (
    <>
      <AdminHeader
        title="Promoções"
        subtitle="Pacotes e tarifas especiais apresentados no site."
        action={{ href: "/admin/promocoes/nova", label: "Nova promoção" }}
      />
      <Section>
        {offers.length === 0 ? (
          <EmptyState message="Ainda não há promoções." />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-[var(--color-line)]">
                <tr>
                  <Th>Promoção</Th>
                  <Th>Etiqueta</Th>
                  <Th>Desde</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {offers.map((offer) => (
                  <tr
                    key={offer.id}
                    className="border-b border-[var(--color-line-soft)] last:border-0"
                  >
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="relative h-11 w-16 shrink-0 overflow-hidden rounded-lg bg-[var(--color-line-soft)]">
                          {offer.image && (
                            <Image src={offer.image} alt="" fill sizes="64px" className="object-cover" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{offer.title.pt}</p>
                          <p className="truncate text-xs text-[var(--color-ink-muted)]">
                            /{offer.slug}
                          </p>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-[var(--color-ink-soft)]">{offer.badge.pt}</Td>
                    <Td className="font-medium">{offer.priceFrom.toFixed(2)} €</Td>
                    <Td>
                      <Badge tone={offer.published ? "success" : "neutral"}>
                        {offer.published ? "Publicada" : "Oculta"}
                      </Badge>
                    </Td>
                    <Td>
                      <RowActions
                        table="offers"
                        id={offer.id}
                        ids={ids}
                        published={offer.published}
                        editHref={`/admin/promocoes/${offer.id}`}
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
