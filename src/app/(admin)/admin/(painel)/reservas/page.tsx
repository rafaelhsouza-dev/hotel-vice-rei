import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import {
  BOOKING_SOURCES,
  BOOKING_STATUSES,
  PAYMENT_STATUS_LABEL,
  SOURCE_LABEL,
  STATUS_LABEL,
  listBookings,
  type BookingSourceId,
  type BookingStatus,
} from "@/lib/repo/bookings";
import { Icon } from "@/components/Icon";
import { AdminHeader, Section, TableWrap, Th, Td, EmptyState, Badge, fieldClass, euro, formatDate } from "@/components/admin/ui";
import { StatusBadge } from "@/components/admin/BookingBadges";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function BookingsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; source?: string; q?: string; page?: string; from?: string; to?: string; sort?: string; csv?: string }>;
}) {
  const actor = await requirePagePermission("/admin/reservas");
  const sp = await searchParams;
  const status = (sp.status && ([...BOOKING_STATUSES, "active"] as string[]).includes(sp.status) ? sp.status : "all") as BookingStatus | "all" | "active";
  const source = (sp.source && (BOOKING_SOURCES as readonly string[]).includes(sp.source) ? sp.source : "all") as BookingSourceId | "all";
  const search = sp.q?.trim().slice(0, 80) ?? "";
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? "") ? sp.from : undefined;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? "") ? sp.to : undefined;
  const sort = sp.sort === "arrival" ? "arrival" : "created";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  let items: Awaited<ReturnType<typeof listBookings>>["items"] = [];
  let total = 0;
  let dbDown = false;
  try {
    const r = await listBookings({ status, source, search, from, to, sort, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
    items = r.items;
    total = r.total;
  } catch {
    dbDown = true;
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const params = (next: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { status: status === "all" ? "" : status, source: source === "all" ? "" : source, q: search, from: from ?? "", to: to ?? "", sort: sort === "created" ? "" : sort, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return p.toString();
  };
  const linkFor = (next: Record<string, string>) => `/admin/reservas${params(next) ? `?${params(next)}` : ""}`;
  const chips: { value: string; label: string }[] = [
    { value: "all", label: "Todas" },
    { value: "active", label: "Ativas" },
    ...BOOKING_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
  ];

  return (
    <>
      <AdminHeader
        title="Reservas"
        subtitle={`${total} reserva${total === 1 ? "" : "s"} no filtro atual — site, balcão e plataformas numa só lista.`}
        action={can(actor.role, "bookings.manage") ? { href: "/admin/reservas/nova", label: "Nova reserva" } : undefined}
      />

      <Section>
        <div className="scroll-bar-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2">
          {chips.map((c) => (
            <Link
              key={c.value}
              href={linkFor({ status: c.value === "all" ? "" : c.value, page: "" })}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                status === c.value
                  ? "bg-[var(--color-ink)] text-white"
                  : "border border-[var(--color-line)] bg-white text-[var(--color-ink-soft)] hover:bg-[var(--color-line-soft)]"
              }`}
            >
              {c.label}
            </Link>
          ))}
        </div>

        <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]" action="/admin/reservas">
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <div>
            <label className="sr-only" htmlFor="q">Pesquisar</label>
            <input id="q" name="q" defaultValue={search} placeholder="Nome, email, telefone ou referência" className={fieldClass} />
          </div>
          <div>
            <label className="sr-only" htmlFor="source">Origem</label>
            <select id="source" name="source" defaultValue={source} className={fieldClass}>
              <option value="all">Todas as origens</option>
              {BOOKING_SOURCES.map((s) => (
                <option key={s} value={s}>{SOURCE_LABEL[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="sr-only" htmlFor="from">Estadias a partir de</label>
            <input id="from" name="from" type="date" defaultValue={from} className={fieldClass} title="Estadias a partir de" />
          </div>
          <div>
            <label className="sr-only" htmlFor="to">Estadias até</label>
            <input id="to" name="to" type="date" defaultValue={to} className={fieldClass} title="Estadias até" />
          </div>
          <div>
            <label className="sr-only" htmlFor="sort">Ordenar</label>
            <select id="sort" name="sort" defaultValue={sort} className={fieldClass}>
              <option value="created">Mais recentes</option>
              <option value="arrival">Por data de chegada</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--color-line)] bg-white px-4 text-sm hover:bg-[var(--color-line-soft)]">
              <Icon name="search" width={16} height={16} /> Filtrar
            </button>
            <a
              href={`/admin/reservas/exportar?${params({})}`}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--color-line)] bg-white px-4 text-sm hover:bg-[var(--color-line-soft)]"
              title="Exportar CSV do filtro atual"
            >
              <Icon name="download" width={16} height={16} /> CSV
            </a>
          </div>
        </form>

        <div className="mt-6">
          {dbDown ? (
            <EmptyState message="Não foi possível ligar à base de dados." />
          ) : items.length === 0 ? (
            <EmptyState message="Nenhuma reserva corresponde a este filtro." />
          ) : (
            <>
              {/* Phones: cards */}
              <ul className="grid gap-3 md:hidden">
                {items.map((b) => (
                  <li key={b.id}>
                    <Link href={`/admin/reservas/${b.id}`} className="block rounded-2xl border border-[var(--color-line)] bg-white p-4 active:bg-[var(--color-line-soft)]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{b.firstName} {b.lastName}</p>
                          <p className="font-mono text-xs text-[var(--color-ink-muted)]">{b.reference}</p>
                        </div>
                        <StatusBadge status={b.status} />
                      </div>
                      <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
                        {formatDate(b.checkIn)} → {formatDate(b.checkOut)} · {b.nights} noite(s)
                      </p>
                      <p className="mt-1 flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="text-[var(--color-ink-muted)]">
                          {b.roomName}
                          {b.unitCode ? ` · ${b.unitCode}` : ""}
                        </span>
                        <span className="font-medium">{euro.format(b.total + b.touristTax)}</span>
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>

              {/* Larger screens: table */}
              <div className="hidden md:block">
                <TableWrap>
                  <table className="w-full min-w-[980px] text-sm">
                    <thead className="border-b border-[var(--color-line)]">
                      <tr>
                        <Th>Referência</Th>
                        <Th>Hóspede</Th>
                        <Th>Estadia</Th>
                        <Th>Quarto</Th>
                        <Th>Origem</Th>
                        <Th>Total</Th>
                        <Th>Pagamento</Th>
                        <Th>Estado</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((b) => (
                        <tr key={b.id} className="border-b border-[var(--color-line-soft)] align-top last:border-0 hover:bg-[var(--color-line-soft)]/40">
                          <Td className="font-mono text-xs">
                            <Link href={`/admin/reservas/${b.id}`} className="text-[var(--color-accent-deep)] hover:underline">
                              {b.reference}
                            </Link>
                            {b.externalRef && <span className="block text-[var(--color-ink-muted)]">{b.externalRef}</span>}
                          </Td>
                          <Td>
                            <Link href={`/admin/reservas/${b.id}`} className="font-medium hover:underline">
                              {b.firstName} {b.lastName}
                            </Link>
                            <p className="text-xs text-[var(--color-ink-muted)]">{b.email || b.phone}</p>
                          </Td>
                          <Td className="whitespace-nowrap text-[var(--color-ink-soft)]">
                            {formatDate(b.checkIn)} → {formatDate(b.checkOut)}
                            <p className="text-xs text-[var(--color-ink-muted)]">
                              {b.nights} noite(s) · {b.adults}
                              {b.children ? `+${b.children}` : ""} pax
                            </p>
                          </Td>
                          <Td className="text-[var(--color-ink-soft)]">
                            {b.roomName}
                            <p className="text-xs">{b.unitCode ? `Quarto ${b.unitCode}` : <span className="text-[var(--color-accent-deep)]">Sem quarto</span>}</p>
                          </Td>
                          <Td className="text-xs text-[var(--color-ink-soft)]">
                            {SOURCE_LABEL[b.source]}
                            {b.channelName && <span className="block">{b.channelName}</span>}
                          </Td>
                          <Td className="whitespace-nowrap font-medium">{euro.format(b.total + b.touristTax)}</Td>
                          <Td>
                            <Badge tone={b.paymentStatus === "paid" ? "success" : b.paymentStatus === "pending" || b.paymentStatus === "partial" ? "warning" : "neutral"}>
                              {PAYMENT_STATUS_LABEL[b.paymentStatus] ?? b.paymentStatus}
                            </Badge>
                          </Td>
                          <Td>
                            <StatusBadge status={b.status} />
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              </div>
            </>
          )}
        </div>

        {pages > 1 && (
          <nav className="mt-6 flex flex-wrap items-center justify-center gap-2" aria-label="Paginação">
            {page > 1 && (
              <Link href={linkFor({ page: String(page - 1) })} className="rounded-full border border-[var(--color-line)] bg-white px-4 py-2 text-sm">
                Anterior
              </Link>
            )}
            <span className="px-3 py-2 text-sm">Página {page} de {pages}</span>
            {page < pages && (
              <Link href={linkFor({ page: String(page + 1) })} className="rounded-full border border-[var(--color-line)] bg-white px-4 py-2 text-sm">
                Seguinte
              </Link>
            )}
          </nav>
        )}
      </Section>
    </>
  );
}
