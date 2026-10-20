"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { moveBookingToUnit } from "@/app/(admin)/admin/actions-pms";

export type GridUnit = { id: number; code: string; floor: number; roomId: string | null; roomName: string; status: string };
export type GridBooking = {
  id: string;
  reference: string;
  guest: string;
  checkIn: string;
  checkOut: string;
  status: string;
  unitId: number | null;
  roomId: string | null;
  source: string;
  channel: string | null;
  pax: number;
  paid: boolean;
};

const WEEK = ["D", "S", "T", "Q", "Q", "S", "S"];

function plus(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function diff(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

const TONE: Record<string, string> = {
  pending: "bg-amber-100 border-amber-400 text-amber-900",
  confirmed: "bg-emerald-100 border-emerald-500 text-emerald-900",
  checked_in: "bg-sky-100 border-sky-500 text-sky-900",
  checked_out: "bg-stone-200 border-stone-400 text-stone-700",
};
const UNIT_TONE: Record<string, string> = {
  available: "bg-emerald-500",
  occupied: "bg-sky-500",
  cleaning: "bg-amber-500",
  maintenance: "bg-red-500",
  blocked: "bg-stone-500",
};
const UNIT_LABEL: Record<string, string> = {
  available: "livre",
  occupied: "ocupado",
  cleaning: "limpeza",
  maintenance: "manutenção",
  blocked: "bloqueado",
};

/**
 * The occupancy grid. Bookings are absolutely positioned bars over a day
 * grid; dragging one onto another unit row asks the server to move it, and
 * the server re-checks room type and overlaps before accepting.
 */
export function OccupancyGrid({
  units,
  bookings,
  from,
  days,
  today,
  canMove,
}: {
  units: GridUnit[];
  bookings: GridBooking[];
  from: string;
  days: number;
  today: string;
  canMove: boolean;
}) {
  // Wider days for short windows so the grid fills a laptop screen.
  const DAY_PX = days <= 7 ? 120 : days <= 14 ? 76 : days <= 21 ? 54 : 42;
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [dragging, setDragging] = useState<GridBooking | null>(null);
  const [pending, start] = useTransition();
  const dates = useMemo(() => Array.from({ length: days }, (_, i) => plus(from, i)), [from, days]);
  const unassigned = bookings.filter((b) => !b.unitId);
  const byUnit = useMemo(() => {
    const m = new Map<number, GridBooking[]>();
    for (const b of bookings) if (b.unitId) m.set(b.unitId, [...(m.get(b.unitId) ?? []), b]);
    return m;
  }, [bookings]);

  function drop(unit: GridUnit) {
    const b = dragging;
    setDragging(null);
    if (!b || b.unitId === unit.id) return;
    if (b.roomId !== unit.roomId) {
      setMessage({ ok: false, text: `O quarto ${unit.code} é ${unit.roomName}; a reserva ${b.reference} é de outra tipologia.` });
      return;
    }
    start(async () => {
      const r = await moveBookingToUnit(b.id, unit.id);
      setMessage({ ok: r.ok, text: r.message });
      if (r.ok) router.refresh();
    });
  }

  const bar = (b: GridBooking) => {
    const startIdx = Math.max(0, diff(from, b.checkIn));
    const endIdx = Math.min(days, diff(from, b.checkOut));
    if (endIdx <= 0 || startIdx >= days) return null;
    const left = startIdx * DAY_PX + (diff(from, b.checkIn) >= 0 ? DAY_PX / 2 : 0);
    const right = endIdx * DAY_PX + (diff(from, b.checkOut) <= days ? DAY_PX / 2 : 0);
    return { left, width: Math.max(16, right - left - 2) };
  };

  function Bar({ b }: { b: GridBooking }) {
    const pos = bar(b);
    if (!pos) return null;
    return (
      <Link
        href={`/admin/reservas/${b.id}`}
        draggable={canMove && b.status !== "checked_out"}
        onDragStart={(e) => {
          setDragging(b);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => setDragging(null)}
        title={`${b.reference} · ${b.guest} · ${b.checkIn} → ${b.checkOut}${b.channel ? ` · ${b.channel}` : ""}`}
        className={`absolute top-1 bottom-1 flex items-center overflow-hidden rounded-md border px-1.5 text-[11px] leading-tight shadow-sm ${TONE[b.status] ?? TONE.confirmed} ${canMove ? "cursor-grab active:cursor-grabbing" : ""}`}
        style={{ left: pos.left, width: pos.width }}
      >
        <span className="truncate">
          {b.guest || b.reference}
          {b.pax > 1 ? ` · ${b.pax}` : ""}
          {b.paid ? " · €" : ""}
        </span>
      </Link>
    );
  }

  let lastFloor: number | null = null;

  return (
    <div>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`mb-4 rounded-xl px-4 py-2.5 text-sm ${message.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {message.text}
        </p>
      )}
      {pending && <p className="mb-2 text-xs text-[var(--color-ink-muted)]">A mover…</p>}

      {unassigned.length > 0 && (
        <div className="mb-4 rounded-2xl border border-dashed border-[var(--color-accent)] bg-[var(--color-accent)]/5 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-accent-deep)]">
            Sem quarto atribuído ({unassigned.length}) {canMove && "— arraste para um quarto"}
          </p>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((b) => (
              <Link
                key={b.id}
                href={`/admin/reservas/${b.id}`}
                draggable={canMove}
                onDragStart={() => setDragging(b)}
                onDragEnd={() => setDragging(null)}
                className={`rounded-md border px-2 py-1 text-xs ${TONE[b.status] ?? TONE.confirmed} ${canMove ? "cursor-grab" : ""}`}
              >
                {b.guest} · {b.checkIn.slice(5)}→{b.checkOut.slice(5)} · {units.find((u) => u.roomId === b.roomId)?.roomName ?? b.roomId}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="scroll-bar-thin overflow-x-auto rounded-2xl border border-[var(--color-line)] bg-white">
        <div style={{ width: 150 + days * DAY_PX }}>
          <div className="sticky top-0 z-20 flex border-b border-[var(--color-line)] bg-white">
            <div className="sticky left-0 z-30 w-[150px] shrink-0 bg-white px-3 py-2 text-[11px] uppercase tracking-[0.15em] text-[var(--color-ink-muted)]">Quarto</div>
            {dates.map((d) => {
              const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
              return (
                <div
                  key={d}
                  className={`shrink-0 py-1.5 text-center text-[11px] ${d === today ? "bg-[var(--color-accent)]/15 font-semibold" : dow === 0 || dow === 6 ? "bg-[var(--color-line-soft)]" : ""}`}
                  style={{ width: DAY_PX }}
                >
                  <span className="block text-[var(--color-ink-muted)]">{WEEK[dow]}</span>
                  <span className="block">{Number(d.slice(8))}</span>
                </div>
              );
            })}
          </div>

          {units.map((u) => {
            const floorHeader = lastFloor !== u.floor;
            lastFloor = u.floor;
            const isTarget = dragging && dragging.roomId === u.roomId && dragging.unitId !== u.id;
            return (
              <div key={u.id}>
                {floorHeader && (
                  <div className="sticky left-0 border-b border-[var(--color-line)] bg-[var(--color-line-soft)] px-3 py-1 text-[11px] uppercase tracking-[0.15em] text-[var(--color-ink-muted)]">
                    Piso {u.floor}
                  </div>
                )}
                <div
                  className={`flex border-b border-[var(--color-line-soft)] ${isTarget ? "bg-emerald-50" : ""}`}
                  onDragOver={(e) => {
                    if (dragging) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    drop(u);
                  }}
                >
                  <div className="sticky left-0 z-10 flex w-[150px] shrink-0 items-center gap-2 bg-white px-3 py-1.5">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${UNIT_TONE[u.status] ?? "bg-stone-400"}`} title={UNIT_LABEL[u.status] ?? u.status} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{u.code}</span>
                      <span className="block truncate text-[10px] text-[var(--color-ink-muted)]">{u.roomName}</span>
                    </span>
                  </div>
                  <div className="relative h-11 shrink-0" style={{ width: days * DAY_PX }}>
                    {dates.map((d, i) => (
                      <span
                        key={d}
                        aria-hidden="true"
                        className={`absolute top-0 bottom-0 border-l border-[var(--color-line-soft)] ${d === today ? "bg-[var(--color-accent)]/10" : ""}`}
                        style={{ left: i * DAY_PX, width: DAY_PX }}
                      />
                    ))}
                    {(byUnit.get(u.id) ?? []).map((b) => (
                      <Bar key={b.id} b={b} />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--color-ink-muted)]">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded border border-amber-400 bg-amber-100" /> Pendente</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded border border-emerald-500 bg-emerald-100" /> Confirmada</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded border border-sky-500 bg-sky-100" /> Em estadia</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded border border-stone-400 bg-stone-200" /> Saída feita</span>
        <span>€ = paga · número = hóspedes · bolinha = estado do quarto agora</span>
      </div>
    </div>
  );
}
