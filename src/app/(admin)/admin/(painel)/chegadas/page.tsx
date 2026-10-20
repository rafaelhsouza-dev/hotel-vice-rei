import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listBookings, type Booking } from "@/lib/repo/bookings";
import { addDays, today } from "@/lib/repo/availability";
import { query, queryOne } from "@/lib/db";
import { bookingStatusAction } from "@/app/(admin)/admin/actions-pms";
import { AdminHeader, Section, Card, Badge, Stat, Field, fieldClass, euro, formatDate } from "@/components/admin/ui";
import { StatusBadge } from "@/components/admin/BookingBadges";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";

function Row({ b, children }: { b: Booking; children?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line-soft)] py-3 last:border-0">
      <div className="min-w-0">
        <Link href={`/admin/reservas/${b.id}`} className="font-medium hover:underline">
          {b.firstName} {b.lastName}
        </Link>
        <p className="text-xs text-[var(--color-ink-muted)]">
          {b.reference} · {b.roomName} {b.unitCode ? `· quarto ${b.unitCode}` : "· sem quarto"} · {b.nights} noite(s) · {b.adults + b.children} pax
          {b.eta ? ` · chega ~${b.eta}` : ""}
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <StatusBadge status={b.status} />
          {b.checkinDoneAt && <Badge tone="info">Check-in online</Badge>}
          {b.paymentStatus === "paid" ? <Badge tone="success">Paga</Badge> : <Badge>{euro.format(b.total + b.touristTax - b.paidTotal)} por pagar</Badge>}
          {b.notes && <Badge tone="warning">Tem notas</Badge>}
        </div>
      </div>
      {children}
    </li>
  );
}

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const actor = await requirePagePermission("/admin/chegadas");
  const sp = await searchParams;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.dia ?? "") ? sp.dia! : today();
  const isToday = day === today();
  const manage = can(actor.role, "bookings.manage");

  const [arrivals, departures, inHouse, cleaning, stats] = await Promise.all([
    listBookings({ arrivalOn: day, status: "active", sort: "arrival", limit: 200 }),
    listBookings({ departureOn: day, status: "active", sort: "arrival", limit: 200 }),
    listBookings({ status: "checked_in", sort: "arrival", limit: 300 }),
    query<{ id: number; code: string; status: string }>(`SELECT id, code, status FROM units WHERE active AND status IN ('cleaning','maintenance') ORDER BY code`),
    queryOne<Record<string, string>>(
      `SELECT
         (SELECT count(*) FROM units WHERE active)::text AS units,
         (SELECT count(*) FROM bookings WHERE status NOT IN ('cancelled','no_show') AND check_in <= $1::date AND check_out > $1::date)::text AS occupied,
         (SELECT COALESCE(sum((n->>'price')::numeric),0) FROM bookings b, jsonb_array_elements(b.nightly) n
            WHERE b.status NOT IN ('cancelled','no_show') AND (n->>'date')::date = $1::date)::text AS room_revenue`,
      [day],
    ),
  ]);
  const units = Number(stats?.units ?? 0);
  const occupied = Number(stats?.occupied ?? 0);
  const revenue = Number(stats?.room_revenue ?? 0);
  const late = arrivals.items.filter((b) => b.status === "confirmed" || b.status === "pending");
  const outToday = departures.items.filter((b) => b.status === "checked_in");

  return (
    <>
      <AdminHeader title={isToday ? "Hoje" : `Dia ${formatDate(day)}`} subtitle="Chegadas, partidas, hóspedes em casa e quartos por limpar." />
      <Section>
        <form className="mb-6 flex flex-wrap items-end gap-3" action="/admin/chegadas">
          <Field label="Dia" htmlFor="dia">
            <input id="dia" name="dia" type="date" defaultValue={day} className={fieldClass} />
          </Field>
          <button className="h-11 rounded-full border border-[var(--color-line)] bg-white px-4 text-sm">Ver</button>
          <Link href={`/admin/chegadas?dia=${addDays(day, -1)}`} className="rounded-full border border-[var(--color-line)] bg-white px-4 py-2.5 text-sm">← Dia anterior</Link>
          <Link href={`/admin/chegadas?dia=${addDays(day, 1)}`} className="rounded-full border border-[var(--color-line)] bg-white px-4 py-2.5 text-sm">Dia seguinte →</Link>
        </form>

        <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Chegadas" value={arrivals.items.length} hint={`${late.length} por fazer check-in`} tone={late.length ? "warning" : "neutral"} />
          <Stat label="Partidas" value={departures.items.length} hint={`${outToday.length} por fazer check-out`} />
          <Stat label="Em casa" value={inHouse.items.length} />
          <Stat label="Ocupação" value={units ? `${Math.round((occupied / units) * 100)}%` : "—"} hint={`${occupied} de ${units} quartos`} />
          <Stat label="Receita de quartos" value={euro.format(revenue)} hint={occupied ? `ADR ${euro.format(revenue / occupied)}` : undefined} />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="p-5">
            <h2 className="font-display text-lg tracking-tight">Chegadas</h2>
            {arrivals.items.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-ink-muted)]">Sem chegadas.</p>
            ) : (
              <ul className="mt-2">
                {arrivals.items.map((b) => (
                  <Row key={b.id} b={b}>
                    {manage && isToday && (b.status === "confirmed" || b.status === "pending") && (
                      <form action={bookingStatusAction}>
                        <input type="hidden" name="id" value={b.id} />
                        <input type="hidden" name="action" value="checkin" />
                        <SubmitButton icon="key" pendingLabel="…">Check-in</SubmitButton>
                      </form>
                    )}
                  </Row>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-lg tracking-tight">Partidas</h2>
            {departures.items.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-ink-muted)]">Sem partidas.</p>
            ) : (
              <ul className="mt-2">
                {departures.items.map((b) => (
                  <Row key={b.id} b={b}>
                    {manage && b.status === "checked_in" && (
                      <Link href={`/admin/reservas/${b.id}#conta`} className="rounded-full border border-[var(--color-line)] bg-white px-4 py-2 text-sm">
                        Conta e check-out
                      </Link>
                    )}
                  </Row>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-lg tracking-tight">Em casa</h2>
            {inHouse.items.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-ink-muted)]">Nenhum hóspede em casa.</p>
            ) : (
              <ul className="mt-2">
                {inHouse.items.map((b) => (
                  <Row key={b.id} b={b} />
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-lg tracking-tight">Quartos por preparar</h2>
            {cleaning.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-ink-muted)]">Todos os quartos estão prontos.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {cleaning.map((u) => (
                  <Link key={u.id} href={`/admin/acomodacoes/${u.id}`} className="rounded-xl border border-[var(--color-line)] px-3 py-2 text-sm">
                    {u.code} · <span className={u.status === "maintenance" ? "text-red-700" : "text-[var(--color-accent-deep)]"}>{u.status === "maintenance" ? "manutenção" : "limpeza"}</span>
                  </Link>
                ))}
              </div>
            )}
            <Link href="/admin/tarefas" className="mt-4 inline-block text-sm text-[var(--color-accent-deep)] underline">
              Ver tarefas da equipa
            </Link>
          </Card>
        </div>
      </Section>
    </>
  );
}
