import { requirePagePermission } from "@/lib/auth/session";
import Image from "next/image";
import { listRooms } from "@/lib/repo/admin";
import { AdminHeader, Section, TableWrap, Th, Td, EmptyState, Badge } from "@/components/admin/ui";
import { RowActions } from "@/components/admin/RowActions";

export const dynamic = "force-dynamic";

export default async function RoomsAdminPage() {
  await requirePagePermission("/admin/quartos");
  const rooms = await listRooms();
  const ids = rooms.map((r) => r.id);

  return (
    <>
      <AdminHeader
        title="Quartos"
        subtitle="Tipologias apresentadas no site e disponíveis para reserva."
        action={{ href: "/admin/quartos/novo", label: "Novo quarto" }}
      />
      <Section>
        {rooms.length === 0 ? (
          <EmptyState message="Ainda não há quartos. Crie o primeiro." />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-[var(--color-line)]">
                <tr>
                  <Th>Quarto</Th>
                  <Th>Capacidade</Th>
                  <Th>Área</Th>
                  <Th>Desde</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr
                    key={room.id}
                    className="border-b border-[var(--color-line-soft)] last:border-0"
                  >
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="relative h-11 w-16 shrink-0 overflow-hidden rounded-lg bg-[var(--color-line-soft)]">
                          {room.image && (
                            <Image
                              src={room.image}
                              alt=""
                              fill
                              sizes="64px"
                              className="object-cover"
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{room.name.pt}</p>
                          <p className="truncate text-xs text-[var(--color-ink-muted)]">
                            /{room.slug}
                          </p>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-[var(--color-ink-soft)]">{room.capacity} pax</Td>
                    <Td className="text-[var(--color-ink-soft)]">{room.size} m²</Td>
                    <Td className="font-medium">{room.priceFrom.toFixed(2)} €</Td>
                    <Td>
                      <Badge tone={room.published ? "success" : "neutral"}>
                        {room.published ? "Publicado" : "Oculto"}
                      </Badge>
                    </Td>
                    <Td>
                      <RowActions
                        table="rooms"
                        id={room.id}
                        ids={ids}
                        published={room.published}
                        editHref={`/admin/quartos/${room.id}`}
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
