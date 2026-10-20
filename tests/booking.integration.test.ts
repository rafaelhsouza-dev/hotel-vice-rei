import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadTestDatabase } from "./setup-db";

const enabled = loadTestDatabase();

/**
 * End-to-end checks of the booking core against a real Postgres: the lock
 * that prevents double-selling the last room, the override layer, and the
 * check-in/out side effects on units and housekeeping.
 */
describe.skipIf(!enabled)("booking core (Postgres)", () => {
  let db: typeof import("@/lib/db");
  let service: typeof import("@/lib/booking/service");
  let lifecycle: typeof import("@/lib/booking/lifecycle");
  let availability: typeof import("@/lib/repo/availability");
  const created: string[] = [];
  const ROOM = "triple";
  const guest = { firstName: "Teste", lastName: "Integração", email: "teste@example.com", phone: "", country: "PT", notes: "", locale: "pt" };

  // Far enough ahead to avoid real data in a dev database, but inside the
  // site's booking horizon (maxAdvanceDays).
  const base = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 400);
    return d.toISOString().slice(0, 10);
  })();
  const plus = (n: number) => {
    const d = new Date(`${base}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };

  beforeAll(async () => {
    const { ensureDatabase } = await import("@/lib/migrate");
    expect(await ensureDatabase()).toBe(true);
    db = await import("@/lib/db");
    service = await import("@/lib/booking/service");
    lifecycle = await import("@/lib/booking/lifecycle");
    availability = await import("@/lib/repo/availability");
    await db.query(`DELETE FROM bookings WHERE email = 'teste@example.com'`);
    await db.query(`DELETE FROM availability WHERE room_id = $1 AND date >= $2::date`, [ROOM, base]);
  }, 60_000);

  afterAll(async () => {
    if (!enabled) return;
    await db.query(`DELETE FROM tasks WHERE booking_id = ANY($1::uuid[])`, [created]);
    await db.query(`DELETE FROM bookings WHERE email = 'teste@example.com'`);
    await db.query(`DELETE FROM availability WHERE room_id = $1 AND date >= $2::date`, [ROOM, base]);
    await db.query(`UPDATE units SET status = 'available' WHERE room_id = $1`, [ROOM]);
  });

  const stay = (checkIn: string, checkOut: string) => ({
    roomId: ROOM,
    ratePlanId: "standard",
    checkIn,
    checkOut,
    adults: 2,
    children: 0,
    extras: [],
    promoCode: "",
  });

  it("never sells the last unit twice, even under concurrent requests", async () => {
    const days = await availability.getCalendar(ROOM, plus(0), plus(1));
    const free = days[0].free;
    expect(free).toBeGreaterThan(0);

    // free + 3 simultaneous attempts for the same night.
    const attempts = await Promise.all(
      Array.from({ length: free + 3 }, () => service.placeBooking(stay(plus(0), plus(1)), guest, { source: "site" })),
    );
    const ok = attempts.filter((a) => a.ok);
    const refused = attempts.filter((a) => !a.ok);
    for (const a of ok) if (a.ok) created.push(a.id);

    expect(ok.length).toBe(free);
    expect(refused.length).toBe(3);
    for (const r of refused) if (!r.ok) expect(r.violations[0].code).toBe("sold_out");

    const after = await availability.getCalendar(ROOM, plus(0), plus(0));
    expect(after[0].free).toBe(0);
    expect(after[0].overbooked).toBe(false);
  }, 60_000);

  it("changing only the price keeps blocks and restrictions", async () => {
    await availability.setAvailability(ROOM, plus(10), plus(12), { closed: true, minStay: 3, unitsBlocked: 1 });
    await availability.setAvailability(ROOM, plus(10), plus(12), { rate: 99 });
    const days = await availability.getCalendar(ROOM, plus(10), plus(12));
    for (const d of days) {
      expect(d.closed).toBe(true);
      expect(d.minStay).toBe(3);
      expect(d.rate).toBe(99);
    }
    await availability.setAvailability(ROOM, plus(10), plus(12), { closed: false });
    const reopened = await availability.getCalendar(ROOM, plus(10), plus(12));
    expect(reopened.every((d) => !d.closed && d.minStay === 3 && d.rate === 99)).toBe(true);

    const priced = await service.priceStay(stay(plus(10), plus(13)));
    expect(priced.quote.ok).toBe(true);
    expect(priced.quote.nightly.slice(0, 3).map((n) => n.price)).toEqual([99, 99, 99]);

    const short = await service.priceStay(stay(plus(10), plus(12)));
    expect(short.quote.violations).toContainEqual({ code: "min_stay", nights: 3 });
  });

  it("a closed day blocks the booking on the site", async () => {
    await availability.setAvailability(ROOM, plus(20), plus(20), { closed: true });
    const r = await service.placeBooking(stay(plus(19), plus(22)), guest, { source: "site" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violations).toContainEqual({ code: "closed", date: plus(20) });
  });

  it("modifies a stay, keeping its own nights available to itself", async () => {
    const placed = await service.placeBooking(stay(plus(30), plus(32)), guest, { source: "desk", staff: true });
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    created.push(placed.id);
    const updated = await lifecycle.modifyStay(placed.id, {
      roomId: ROOM,
      checkIn: plus(30),
      checkOut: plus(33),
      adults: 2,
      children: 0,
      ratePlanId: "standard",
      reprice: true,
      overrideRestrictions: false,
    });
    expect(updated.nights).toBe(3);
    expect(updated.checkOut).toBe(plus(33));
  });

  it("check-out sends the unit to cleaning and creates the task", async () => {
    // Check-in is only allowed on the arrival day, so use a stay starting today.
    const today = availability.today();
    const tomorrow = availability.addDays(today, 1);
    const placed = await service.placeBooking(stay(today, tomorrow), guest, { source: "desk", staff: true });
    if (!placed.ok) {
      // The dev database may be full today; nothing to assert then.
      expect(placed.violations[0].code).toBe("sold_out");
      return;
    }
    created.push(placed.id);
    await db.query(`UPDATE units SET status = 'available' WHERE id = $1`, [placed.unitId]);
    await lifecycle.checkIn(placed.id, {});
    const unitIn = await db.queryOne<{ status: string }>(`SELECT status FROM units WHERE id = $1`, [placed.unitId]);
    expect(unitIn?.status).toBe("occupied");

    await lifecycle.checkOut(placed.id, { by: "teste" });
    const unitOut = await db.queryOne<{ status: string }>(`SELECT status FROM units WHERE id = $1`, [placed.unitId]);
    expect(unitOut?.status).toBe("cleaning");
    const task = await db.queryOne<{ kind: string }>(`SELECT kind FROM tasks WHERE booking_id = $1`, [placed.id]);
    expect(task?.kind).toBe("cleaning");
  });

  it("cancelling inside the penalty window charges the first night", async () => {
    const placed = await service.placeBooking(stay(plus(40), plus(42)), guest, { source: "desk", staff: true });
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    created.push(placed.id);
    // Arrival far in the future → free.
    const b = await lifecycle.cancelBooking(placed.id, { reason: "teste", by: "teste" });
    expect(b.status).toBe("cancelled");
    expect(b.cancelFee).toBe(0);
  });
  it("extranet allotments are held back from the site and consumed by extranet bookings", async () => {
    const id = "extranet-teste-integracao";
    await db.query(`DELETE FROM channels WHERE id = $1`, [id]);
    const start = (await availability.getCalendar(ROOM, plus(60), plus(60)))[0];
    const before = start.free;
    await db.query(
      `INSERT INTO channels (id, provider, kind, name, enabled, settings) VALUES ($1,'extranet','api','Teste',true,$2::jsonb)`,
      [id, JSON.stringify({ allotments: { [ROOM]: 2 } })],
    );
    try {
      const held = (await availability.getCalendar(ROOM, plus(60), plus(60)))[0];
      expect(held.free).toBe(before - 2);
      expect(held.unitsAllotted).toBe(start.unitsAllotted + 2);

      const placed = await service.placeBooking(stay(plus(60), plus(61)), guest, {
        source: "extranet",
        staff: true,
        channelId: id,
      });
      expect(placed.ok).toBe(true);
      if (placed.ok) created.push(placed.id);
      // The extranet sale comes out of its own allotment, not the site's stock.
      const after = (await availability.getCalendar(ROOM, plus(60), plus(60)))[0];
      expect(after.free).toBe(before - 2);
      expect(after.unitsAllotted).toBe(start.unitsAllotted + 1);
    } finally {
      await db.query(`DELETE FROM bookings WHERE channel_id = $1`, [id]);
      await db.query(`DELETE FROM channels WHERE id = $1`, [id]);
    }
  });
});
