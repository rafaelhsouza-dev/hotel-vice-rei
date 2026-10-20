"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/repo/audit";
import { RATE_TAGS, deleteRatePlan, listRatePlans, upsertRatePlan } from "@/lib/repo/rate-plans";
import { clearAvailability, setAvailability, type AvailabilityOverride } from "@/lib/repo/availability";
import { queryOne } from "@/lib/db";
import type { RatePlan } from "@/lib/booking/pricing";
import { bool, date, dec, decOrNull, int, intOrNull, oneOf, slugify, str, triState, trio } from "@/lib/form";

/** Rate plans and the availability/rate calendar. */

function back(path: string, kind: "ok" | "erro", message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(message.slice(0, 400))}`);
}

export async function saveRatePlanAction(form: FormData) {
  const actor = await requirePermission("rates.manage");
  const existing = str(form, "existingId");
  const id = existing || slugify(str(form, "id") || str(form, "name.pt"));
  const path = `/admin/planos/${existing || "novo"}`;
  if (!id) back(path, "erro", "Indique um identificador ou nome.");
  const name = trio(form, "name");
  if (!name.pt) back(path, "erro", "O nome em português é obrigatório.");
  if (!existing) {
    const clash = await queryOne(`SELECT 1 FROM rate_plans WHERE id = $1`, [id]);
    if (clash) back(path, "erro", `Já existe um plano com o identificador «${id}».`);
  }
  const plans = await listRatePlans();
  const refundable = bool(form, "refundable");
  const plan: RatePlan = {
    id,
    name,
    description: trio(form, "description"),
    board: oneOf(str(form, "board"), ["room_only", "breakfast", "half_board"] as const),
    adjustPct: Math.min(500, Math.max(-90, dec(form, "adjustPct", 0))),
    adjustAmount: dec(form, "adjustAmount", 0),
    perGuestAmount: Math.max(0, dec(form, "perGuestAmount", 0)),
    refundable,
    freeCancelDays: Math.max(0, int(form, "freeCancelDays", 2)),
    cancelPenalty: oneOf(str(form, "cancelPenalty"), ["first_night", "none", "percent", "total"] as const),
    cancelPenaltyPct: Math.min(100, Math.max(0, dec(form, "cancelPenaltyPct", 0))),
    paymentPolicy: oneOf(str(form, "paymentPolicy"), ["hotel", "deposit", "full"] as const),
    depositPct: Math.min(100, Math.max(0, dec(form, "depositPct", 0))),
    minStay: Math.max(1, int(form, "minStay", 1)),
    maxStay: intOrNull(form, "maxStay"),
    minAdvanceDays: Math.max(0, int(form, "minAdvanceDays", 0)),
    maxAdvanceDays: intOrNull(form, "maxAdvanceDays"),
    roomIds: form.getAll("roomIds").map(String).filter(Boolean),
    active: bool(form, "active"),
    position: int(form, "position", plans.length),
  };
  if (!refundable && plan.paymentPolicy === "hotel") {
    // Non-refundable without taking money is a promise the hotel cannot enforce.
    back(path, "erro", "Uma tarifa não reembolsável deve cobrar ao reservar (sinal ou total).");
  }
  if (plan.paymentPolicy === "deposit" && !(plan.depositPct > 0)) back(path, "erro", "Indique a percentagem do sinal.");
  if (plan.maxStay != null && plan.maxStay < plan.minStay) back(path, "erro", "A estadia máxima é inferior à mínima.");
  await upsertRatePlan(plan);
  updateTag(RATE_TAGS.plans);
  revalidatePath("/admin/planos");
  await audit(actor, existing ? "rate_plan.updated" : "rate_plan.created", { entity: "rate_plan", id, summary: name.pt });
  back("/admin/planos", "ok", `Plano «${name.pt}» guardado.`);
}

export async function deleteRatePlanAction(form: FormData) {
  const actor = await requirePermission("rates.manage");
  const id = str(form, "id");
  const used = await queryOne<{ n: string }>(`SELECT count(*)::text AS n FROM bookings WHERE rate_plan_id = $1`, [id]);
  if (Number(used?.n ?? 0) > 0) {
    back("/admin/planos", "erro", "Este plano tem reservas. Desative-o em vez de o apagar — as reservas guardam as suas condições.");
  }
  const active = (await listRatePlans()).filter((p) => p.active && p.id !== id);
  if (active.length === 0) back("/admin/planos", "erro", "Tem de existir pelo menos um plano ativo.");
  await deleteRatePlan(id);
  updateTag(RATE_TAGS.plans);
  await audit(actor, "rate_plan.deleted", { entity: "rate_plan", id });
  back("/admin/planos", "ok", "Plano apagado.");
}

/**
 * Bulk change on the calendar. Every field is optional: empty / "manter"
 * leaves what is stored. That is the fix for the old form, which always sent
 * defaults and so wiped blocks and minimum stays when only the price changed.
 */
export async function saveCalendarAction(form: FormData) {
  const actor = await requirePermission("availability.manage");
  const base = "/admin/disponibilidade";
  const from = date(form, "from");
  const to = date(form, "to");
  const roomIds = form.getAll("roomIds").map(String).filter(Boolean);
  if (!from || !to) back(base, "erro", "Datas inválidas.");
  if (to < from) back(base, "erro", "A data final é anterior à inicial.");
  if (roomIds.length === 0) back(base, "erro", "Escolha pelo menos uma tipologia.");
  const span = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  if (span > 730) back(base, "erro", "Escolha um período de até 2 anos.");
  const weekdays = form.getAll("weekdays").map(Number).filter((n) => n >= 0 && n <= 6);

  if (str(form, "action") === "clear") {
    for (const roomId of roomIds) await clearAvailability(roomId, from, to);
    await audit(actor, "calendar.cleared", { entity: "calendar", summary: `${roomIds.join(",")} ${from}→${to}` });
    revalidatePath(base);
    back(`${base}?from=${from}`, "ok", "Período reposto aos valores automáticos.");
  }

  const patch: AvailabilityOverride = {};
  const rate = decOrNull(form, "rate");
  if (str(form, "rateMode") === "clear") patch.rate = null;
  else if (rate != null) {
    if (rate < 0 || rate > 10000) back(base, "erro", "Preço inválido.");
    patch.rate = Math.round(rate * 100) / 100;
  }
  const blocked = intOrNull(form, "unitsBlocked");
  if (blocked != null) patch.unitsBlocked = Math.max(0, blocked);
  const minStay = intOrNull(form, "minStay");
  if (minStay != null) patch.minStay = Math.max(1, minStay);
  const maxStayMode = str(form, "maxStayMode");
  if (maxStayMode === "clear") patch.maxStay = null;
  else {
    const maxStay = intOrNull(form, "maxStay");
    if (maxStay != null) patch.maxStay = Math.max(1, maxStay);
  }
  const closed = triState(form, "closed");
  if (closed !== undefined) patch.closed = closed;
  const cta = triState(form, "closedArrival");
  if (cta !== undefined) patch.closedArrival = cta;
  const ctd = triState(form, "closedDeparture");
  if (ctd !== undefined) patch.closedDeparture = ctd;
  if (Object.keys(patch).length === 0) back(base, "erro", "Não indicou nenhuma alteração.");

  let days = 0;
  for (const roomId of roomIds) days += await setAvailability(roomId, from, to, patch, weekdays);
  await audit(actor, "calendar.updated", {
    entity: "calendar",
    summary: `${roomIds.join(",")} ${from}→${to}${weekdays.length && weekdays.length < 7 ? ` (dias ${weekdays.join(",")})` : ""}`,
    details: patch as Record<string, unknown>,
  });
  revalidatePath(base);
  back(`${base}?from=${from}`, "ok", `${days} dia(s) atualizados.`);
}
