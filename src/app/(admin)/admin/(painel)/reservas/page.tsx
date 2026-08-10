import Link from "next/link";
import { listBookings, type BookingStatus } from "@/lib/repo/ops";
import { getRooms } from "@/lib/repo/content";
import { setBookingStatus, removeBooking } from "@/app/(admin)/admin/actions";
import { Icon } from "@/components/Icon";
import { AdminHeader, Section, TableWrap, Th, Td, EmptyState, Badge, fieldClass } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";

const STATUSES: { value: BookingStatus | "all"; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Pendentes" },
  { value: "confirmed", label: "Confirmadas" },
  { value: "checked_in", label: "Em estadia" },
  { value: "cancelled", label: "Canceladas" },
];

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmada",
  checked_in: "Check-in",
  cancelled: "Cancelada",
};

const STATUS_TONE = {
  pending: "warning",
  confirmed: "success",
  checked_in: "neutral",
  cancelled: "danger",
} as const;

const euro = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });
const dayMonth = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

const PAGE_SIZE = 25;

export default async function BookingsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const status = (STATUSES.find((s) => s.value === sp.status)?.value ??
    "all") as BookingStatus | "all";
  const search = sp.q?.trim() ?? "";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const rooms = await getRooms();
  const roomName = (id: string | null) => rooms.find((r) => r.id === id)?.name.pt ?? "—";

  let items: Awaited<ReturnType<typeof listBookings>>["items"] = [];
  let total = 0;
  let dbDown = false;
  try {
    const result = await listBookings({
      status,
      search,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
    items = result.items;
    total = result.total;
  } catch {
    dbDown = true;
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const linkFor = (next: Record<string, string>) => {
    const params = new URLSearchParams({
      ...(status !== "all" ? { status } : {}),
      ...(search ? { q: search } : {}),
      ...next,
    });
    const qs = params.toString();
    return `/admin/reservas${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <AdminHeader
        title="Reservas"
        subtitle={`${total} reserva${total === 1 ? "" : "s"} no filtro atual.`}
      />

      <Section>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => (
              <Link
                key={s.value}
                href={linkFor({ status: s.value === "all" ? "" : s.value, page: "1" })}
                className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                  status === s.value
                    ? "bg-[var(--color-ink)] text-white"
                    : "border border-[var(--color-line)] bg-white text-[var(--color-ink-soft)] hover:bg-[var(--color-line-soft)]"
                }`}
              >
                {s.label}
              </Link>
            ))}
          </div>

          <form className="ml-auto flex items-center gap-2" action="/admin/reservas">
            {status !== "all" && <input type="hidden" name="status" value={status} />}
            <label className="sr-only" htmlFor="q">
              Pesquisar reservas
            </label>
            <input
              id="q"
              name="q"
              defaultValue={search}
              placeholder="Nome, email ou referência"
              className={`${fieldClass} w-64`}
            />
            <button
              type="submit"
              aria-label="Pesquisar"
              className="grid h-10 w-10 place-items-center rounded-full border border-[var(--color-line)] bg-white text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-line-soft)]"
            >
              <Icon name="search" width={16} height={16} />
            </button>
          </form>
        </div>

        <div className="mt-6">
          {dbDown ? (
            <EmptyState message="Não foi possível ligar à base de dados." />
          ) : items.length === 0 ? (
            <EmptyState message="Nenhuma reserva corresponde a este filtro." />
          ) : (
            <TableWrap>
              <table className="w-full min-w-[1000px] text-sm">
                <thead className="border-b border-[var(--color-line)]">
                  <tr>
                    <Th>Referência</Th>
                    <Th>Hóspede</Th>
                    <Th>Quarto</Th>
                    <Th>Estadia</Th>
                    <Th>Pax</Th>
                    <Th>Total</Th>
                    <Th>Estado</Th>
                    <Th className="text-right">Ações</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((b) => (
                    <tr
                      key={b.id}
                      className="border-b border-[var(--color-line-soft)] last:border-0 align-top"
                    >
                      <Td className="font-mono text-xs">{b.reference}</Td>
                      <Td>
                        <p className="font-medium">
                          {b.firstName} {b.lastName}
                        </p>
                        <a
                          href={`mailto:${b.email}`}
                          className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-accent-deep)]"
                        >
                          {b.email}
                        </a>
                        {b.phone && (
                          <p className="text-xs text-[var(--color-ink-muted)]">{b.phone}</p>
                        )}
                        {b.notes && (
                          <p className="mt-1 max-w-xs text-xs italic text-[var(--color-ink-muted)]">
                            “{b.notes}”
                          </p>
                        )}
                      </Td>
                      <Td className="text-[var(--color-ink-soft)]">
                        {roomName(b.roomId)}
                        {b.extras.length > 0 && (
                          <p className="text-xs text-[var(--color-ink-muted)]">
                            + {b.extras.length} extra{b.extras.length === 1 ? "" : "s"}
                          </p>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-[var(--color-ink-soft)]">
                        {dayMonth.format(new Date(b.checkIn))} →{" "}
                        {dayMonth.format(new Date(b.checkOut))}
                        <p className="text-xs text-[var(--color-ink-muted)]">
                          {b.nights} noite{b.nights === 1 ? "" : "s"}
                        </p>
                      </Td>
                      <Td className="text-[var(--color-ink-soft)]">
                        {b.adults}
                        {b.children > 0 ? ` + ${b.children}` : ""}
                      </Td>
                      <Td className="whitespace-nowrap font-medium">
                        {euro.format(b.total)}
                        {b.discount > 0 && (
                          <p className="text-xs font-normal text-[var(--color-success)]">
                            −{euro.format(b.discount)}
                          </p>
                        )}
                      </Td>
                      <Td>
                        <Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge>
                      </Td>
                      <Td>
                        <div className="flex flex-col items-end gap-2">
                          <form action={setBookingStatus} className="flex items-center gap-1.5">
                            <input type="hidden" name="id" value={b.id} />
                            <label className="sr-only" htmlFor={`st-${b.id}`}>
                              Estado da reserva {b.reference}
                            </label>
                            <select
                              id={`st-${b.id}`}
                              name="status"
                              defaultValue={b.status}
                              className="rounded-lg border border-[var(--color-line)] bg-white px-2 py-1.5 text-xs"
                            >
                              {(Object.keys(STATUS_LABEL) as BookingStatus[]).map((s) => (
                                <option key={s} value={s}>
                                  {STATUS_LABEL[s]}
                                </option>
                              ))}
                            </select>
                            <SubmitButton variant="icon" icon="check" title="Aplicar estado" />
                          </form>
                          <form action={removeBooking}>
                            <input type="hidden" name="id" value={b.id} />
                            <SubmitButton
                              variant="icon"
                              icon="trash"
                              title="Eliminar reserva"
                              confirm={`Eliminar a reserva ${b.reference}?`}
                            />
                          </form>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </div>

        {pages > 1 && (
          <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Paginação">
            {Array.from({ length: pages }).map((_, i) => (
              <Link
                key={i}
                href={linkFor({ page: String(i + 1) })}
                aria-current={page === i + 1 ? "page" : undefined}
                className={`grid h-9 min-w-9 place-items-center rounded-full px-3 text-sm ${
                  page === i + 1
                    ? "bg-[var(--color-ink)] text-white"
                    : "border border-[var(--color-line)] bg-white text-[var(--color-ink-soft)] hover:bg-[var(--color-line-soft)]"
                }`}
              >
                {i + 1}
              </Link>
            ))}
          </nav>
        )}
      </Section>
    </>
  );
}
