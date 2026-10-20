import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { query } from "@/lib/db";
import { addDays, today } from "@/lib/repo/availability";
import { AdminHeader, Section, Field, fieldClass } from "@/components/admin/ui";
import { OccupancyGrid, type GridBooking, type GridUnit } from "./OccupancyGrid";

export const dynamic = "force-dynamic";

const SPANS = [7, 14, 21, 31];

export default async function OccupancyPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; days?: string; room?: string; ok?: string; erro?: string }>;
}) {
  const actor = await requirePagePermission("/admin/ocupacao");
  const sp = await searchParams;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? "") ? sp.from! : addDays(today(), -1);
  const days = SPANS.includes(Number(sp.days)) ? Number(sp.days) : 14;
  const to = addDays(from, days);

  const [units, bookings, rooms] = await Promise.all([
    query<{ id: number; code: string; floor: number; room_id: string | null; status: string; room_name: string | null }>(
      `SELECT u.id, u.code, u.floor, u.room_id, u.status, r.name->>'pt' AS room_name
       FROM units u LEFT JOIN rooms r ON r.id = u.room_id
       WHERE u.active AND ($1::text IS NULL OR u.room_id = $1)
       ORDER BY u.floor, u.code`,
      [sp.room || null],
    ),
    query<Record<string, unknown>>(
      `SELECT b.id, b.reference, b.first_name, b.last_name, b.check_in, b.check_out, b.status, b.unit_id,
              b.room_id, b.source, b.adults, b.children, b.payment_status, c.name AS channel_name
       FROM bookings b LEFT JOIN channels c ON c.id = b.channel_id
       WHERE b.status NOT IN ('cancelled','no_show')
         AND b.check_in < $2::date AND b.check_out > $1::date
         AND ($3::text IS NULL OR b.room_id = $3)
       ORDER BY b.check_in`,
      [from, to, sp.room || null],
    ),
    query<{ id: string; name: string }>(`SELECT id, name->>'pt' AS name FROM rooms ORDER BY position, id`),
  ]);

  const gridUnits: GridUnit[] = units.map((u) => ({
    id: u.id,
    code: u.code,
    floor: u.floor,
    roomId: u.room_id,
    roomName: u.room_name ?? "—",
    status: u.status,
  }));
  const gridBookings: GridBooking[] = bookings.map((b) => ({
    id: String(b.id),
    reference: String(b.reference),
    guest: `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim(),
    checkIn: String(b.check_in).slice(0, 10),
    checkOut: String(b.check_out).slice(0, 10),
    status: String(b.status),
    unitId: (b.unit_id as number) ?? null,
    roomId: (b.room_id as string) ?? null,
    source: String(b.source),
    channel: (b.channel_name as string) ?? null,
    pax: Number(b.adults) + Number(b.children),
    paid: b.payment_status === "paid",
  }));
  const nav = (f: string) => `/admin/ocupacao?from=${f}&days=${days}${sp.room ? `&room=${sp.room}` : ""}`;

  return (
    <>
      <AdminHeader
        title="Mapa de ocupação"
        subtitle="Quarto a quarto, dia a dia. Arraste uma reserva para outro quarto da mesma tipologia; as reservas sem quarto aparecem em cima."
        action={can(actor.role, "bookings.manage") ? { href: "/admin/reservas/nova", label: "Nova reserva" } : undefined}
      />
      <Section>
        <form className="mb-5 flex flex-wrap items-end gap-3" action="/admin/ocupacao">
          <Field label="A partir de" htmlFor="from">
            <input id="from" name="from" type="date" defaultValue={from} className={fieldClass} />
          </Field>
          <Field label="Dias" htmlFor="days">
            <select id="days" name="days" defaultValue={days} className={fieldClass}>
              {SPANS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tipologia" htmlFor="room">
            <select id="room" name="room" defaultValue={sp.room ?? ""} className={fieldClass}>
              <option value="">Todas</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <button className="h-11 rounded-full border border-[var(--color-line)] bg-white px-4 text-sm">Ver</button>
          <div className="ml-auto flex gap-2">
            <Link href={nav(addDays(from, -days))} className="rounded-full border border-[var(--color-line)] bg-white px-4 py-2.5 text-sm">
              ← Anterior
            </Link>
            <Link href={nav(addDays(today(), -1))} className="rounded-full border border-[var(--color-line)] bg-white px-4 py-2.5 text-sm">
              Hoje
            </Link>
            <Link href={nav(addDays(from, days))} className="rounded-full border border-[var(--color-line)] bg-white px-4 py-2.5 text-sm">
              Seguinte →
            </Link>
          </div>
        </form>
        <OccupancyGrid units={gridUnits} bookings={gridBookings} from={from} days={days} today={today()} canMove={can(actor.role, "bookings.manage")} />
      </Section>
    </>
  );
}
