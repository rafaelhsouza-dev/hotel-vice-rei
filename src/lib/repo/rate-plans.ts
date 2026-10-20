import type { PoolClient } from "pg";
import { unstable_cache } from "next/cache";
import { query, safeQuery } from "../db";
import { STANDARD_PLAN, type RatePlan } from "../booking/pricing";
import { DEFAULT_RULES, normaliseRules, type BookingRules } from "../booking/rules";

/** Rate plans and the booking-engine rules, with the site's cache tags. */

export const RATE_TAGS = { plans: "rate-plans", rules: "booking-rules" } as const;

type Row = {
  id: string;
  name: Record<string, string>;
  description: Record<string, string>;
  board: RatePlan["board"];
  adjust_pct: string;
  adjust_amount: string;
  per_guest_amount: string;
  refundable: boolean;
  free_cancel_days: number;
  cancel_penalty: RatePlan["cancelPenalty"];
  cancel_penalty_pct: string;
  payment_policy: RatePlan["paymentPolicy"];
  deposit_pct: string;
  min_stay: number;
  max_stay: number | null;
  min_advance_days: number;
  max_advance_days: number | null;
  room_ids: string[];
  active: boolean;
  position: number;
};

function toPlan(r: Row): RatePlan {
  return {
    id: r.id,
    name: r.name ?? {},
    description: r.description ?? {},
    board: r.board,
    adjustPct: Number(r.adjust_pct),
    adjustAmount: Number(r.adjust_amount),
    perGuestAmount: Number(r.per_guest_amount),
    refundable: r.refundable,
    freeCancelDays: r.free_cancel_days,
    cancelPenalty: r.cancel_penalty,
    cancelPenaltyPct: Number(r.cancel_penalty_pct),
    paymentPolicy: r.payment_policy,
    depositPct: Number(r.deposit_pct),
    minStay: r.min_stay,
    maxStay: r.max_stay,
    minAdvanceDays: r.min_advance_days,
    maxAdvanceDays: r.max_advance_days,
    roomIds: Array.isArray(r.room_ids) ? r.room_ids : [],
    active: r.active,
    position: r.position,
  };
}

/** Every plan, active or not, for the admin. Throws if the DB is down. */
export async function listRatePlans(): Promise<RatePlan[]> {
  const rows = await query<Row>(`SELECT * FROM rate_plans ORDER BY position, id`);
  return rows.map(toPlan);
}

/**
 * Plans the public site may sell. Falls back to the standard flexible plan
 * when the database is unreachable or nothing is configured, so the booking
 * flow always has something coherent to price with.
 */
export const getActiveRatePlans = unstable_cache(
  async (): Promise<RatePlan[]> => {
    const rows = await safeQuery<Row>(
      `SELECT * FROM rate_plans WHERE active = true ORDER BY position, id`,
    );
    const plans = rows?.map(toPlan) ?? [];
    return plans.length > 0 ? plans : [STANDARD_PLAN];
  },
  ["rate-plans"],
  { tags: [RATE_TAGS.plans], revalidate: 300 },
);

/**
 * Uncached lookup for the moment a booking is written. Pass the transaction's
 * client so the booking path never needs a second pool connection while it
 * holds the room lock (that would deadlock under load).
 */
export async function findRatePlan(id: string, client?: PoolClient): Promise<RatePlan | null> {
  const run = async <T extends Record<string, unknown>>(sql: string, params: unknown[]) =>
    client ? (await client.query<T>(sql, params)).rows : await safeQuery<T>(sql, params);
  const rows = await run<Row>(`SELECT * FROM rate_plans WHERE id = $1`, [id]);
  if (rows && rows[0]) return toPlan(rows[0]);
  if (id === STANDARD_PLAN.id) {
    const any = await run<{ n: string }>(`SELECT count(*)::text AS n FROM rate_plans WHERE active`, []);
    // The implicit plan only exists while no real one has been configured.
    if (!any || any[0]?.n === "0") return STANDARD_PLAN;
  }
  return null;
}

export async function upsertRatePlan(p: RatePlan): Promise<void> {
  await query(
    `INSERT INTO rate_plans
       (id, name, description, board, adjust_pct, adjust_amount, per_guest_amount,
        refundable, free_cancel_days, cancel_penalty, cancel_penalty_pct, payment_policy,
        deposit_pct, min_stay, max_stay, min_advance_days, max_advance_days, room_ids,
        active, position)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
     ON CONFLICT (id) DO UPDATE SET
       name=EXCLUDED.name, description=EXCLUDED.description, board=EXCLUDED.board,
       adjust_pct=EXCLUDED.adjust_pct, adjust_amount=EXCLUDED.adjust_amount,
       per_guest_amount=EXCLUDED.per_guest_amount, refundable=EXCLUDED.refundable,
       free_cancel_days=EXCLUDED.free_cancel_days, cancel_penalty=EXCLUDED.cancel_penalty,
       cancel_penalty_pct=EXCLUDED.cancel_penalty_pct, payment_policy=EXCLUDED.payment_policy,
       deposit_pct=EXCLUDED.deposit_pct, min_stay=EXCLUDED.min_stay, max_stay=EXCLUDED.max_stay,
       min_advance_days=EXCLUDED.min_advance_days, max_advance_days=EXCLUDED.max_advance_days,
       room_ids=EXCLUDED.room_ids, active=EXCLUDED.active, position=EXCLUDED.position,
       updated_at=now()`,
    [
      p.id,
      JSON.stringify(p.name),
      JSON.stringify(p.description),
      p.board,
      p.adjustPct,
      p.adjustAmount,
      p.perGuestAmount,
      p.refundable,
      p.freeCancelDays,
      p.cancelPenalty,
      p.cancelPenaltyPct,
      p.paymentPolicy,
      p.depositPct,
      p.minStay,
      p.maxStay,
      p.minAdvanceDays,
      p.maxAdvanceDays,
      JSON.stringify(p.roomIds),
      p.active,
      p.position,
    ],
  );
}

export async function deleteRatePlan(id: string): Promise<void> {
  await query(`DELETE FROM rate_plans WHERE id = $1`, [id]);
}

export const getBookingRules = unstable_cache(
  async (): Promise<BookingRules> => {
    const rows = await safeQuery<{ booking_rules: unknown }>(
      `SELECT booking_rules FROM settings WHERE id = 1`,
    );
    return rows?.[0] ? normaliseRules(rows[0].booking_rules) : DEFAULT_RULES;
  },
  ["booking-rules"],
  { tags: [RATE_TAGS.rules], revalidate: 300 },
);

/** Uncached — used where a stale value would be wrong (writing a booking). */
export async function readBookingRules(): Promise<BookingRules> {
  const rows = await safeQuery<{ booking_rules: unknown }>(
    `SELECT booking_rules FROM settings WHERE id = 1`,
  );
  return rows?.[0] ? normaliseRules(rows[0].booking_rules) : DEFAULT_RULES;
}

export async function saveBookingRules(rules: BookingRules): Promise<void> {
  await query(`UPDATE settings SET booking_rules = $1::jsonb, updated_at = now() WHERE id = 1`, [
    JSON.stringify(rules),
  ]);
}
