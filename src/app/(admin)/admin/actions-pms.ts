"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission, requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/repo/audit";
import { placeBooking, type BookingSource } from "@/lib/booking/service";
import {
  BookingRuleError,
  cancelBooking,
  checkIn,
  checkOut,
  markNoShow,
  modifyStay,
  revertStatus,
  setStatusSimple,
} from "@/lib/booking/lifecycle";
import {
  CHARGE_CATEGORIES,
  DEFAULT_VAT,
  addCharge,
  buildFolio,
  getBooking,
  listCharges,
  saveGuests,
  setBookingUnit,
  unitIsFree,
  updateBookingGuest,
  voidCharge,
} from "@/lib/repo/bookings";
import { recordManualPayment, refundOnlinePayment, startBookingPayment } from "@/lib/payments/service";
import { issueBookingInvoice } from "@/lib/invoicing/service";
import { sendPendingBulletins } from "@/lib/siba/service";
import { requiresBulletin } from "@/lib/siba/countries";
import { notifyBookingPlaced, notifyCancelled, guestUrl } from "@/lib/email/notify";
import { sendEmail } from "@/lib/email/send";
import { readBookingRules } from "@/lib/repo/rate-plans";
import { query, queryOne } from "@/lib/db";
import { violationText, getEngineStrings } from "@/i18n/engine";
import { bool, date, dec, decOrNull, int, isEmail, oneOf, str } from "@/lib/form";
import { withFlash } from "@/lib/form";
import { guestsFromForm } from "@/lib/booking/guest-form";

/** Front-desk mutations. Each asserts its permission and writes the audit log. */

const pt = getEngineStrings("pt");

function back(path: string, kind: "ok" | "erro", message: string): never {
  redirect(withFlash(path, kind, message));
}

const detail = (id: string) => `/admin/reservas/${id}`;

function refreshBooking(id?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/reservas");
  revalidatePath("/admin/ocupacao");
  revalidatePath("/admin/chegadas");
  if (id) revalidatePath(detail(id));
}

function ruleMessage(err: unknown): string {
  if (err instanceof BookingRuleError) {
    return err.violations.length ? `${err.message} ${err.violations.map((v) => violationText(pt, v)).join(" ")}` : err.message;
  }
  console.error("[pms]", (err as Error).message);
  return "Não foi possível concluir a operação. Tente novamente.";
}

// --- new booking at the desk -------------------------------------------------

export async function createDeskBooking(form: FormData) {
  const actor = await requirePermission("bookings.manage");
  const source = oneOf(str(form, "source"), ["desk", "phone", "email", "walk_in", "extranet"] as const);
  const checkInDate = date(form, "checkIn");
  const checkOutDate = date(form, "checkOut");
  const firstName = str(form, "firstName", "", 80);
  const lastName = str(form, "lastName", "", 80);
  const email = str(form, "email", "", 160);
  const channelId = source === "extranet" ? str(form, "channelId") || null : null;
  const base = "/admin/reservas/nova";
  if (!checkInDate || !checkOutDate) back(base, "erro", "Datas inválidas.");
  if (!firstName || !lastName) back(base, "erro", "Indique nome e apelido do hóspede.");
  if (email && !isEmail(email)) back(base, "erro", "Email inválido.");
  if (source === "extranet" && !channelId) back(base, "erro", "Escolha a plataforma de onde vem a reserva.");

  const result = await placeBooking(
    {
      roomId: str(form, "roomId"),
      ratePlanId: str(form, "ratePlanId"),
      checkIn: checkInDate,
      checkOut: checkOutDate,
      adults: Math.max(1, int(form, "adults", 2)),
      children: Math.max(0, int(form, "children", 0)),
      extras: form.getAll("extras").map(String),
      promoCode: str(form, "promoCode", "", 40),
    },
    {
      firstName,
      lastName,
      email,
      phone: str(form, "phone", "", 40),
      country: str(form, "country", "", 80),
      notes: str(form, "notes", "", 2000),
      locale: oneOf(str(form, "locale"), ["pt", "en", "es", "fr"] as const),
    },
    {
      source: source as BookingSource,
      staff: true,
      overrideRestrictions: bool(form, "override"),
      channelId,
      externalRef: str(form, "externalRef", "", 80),
      commission: Math.max(0, dec(form, "commission", 0)),
      totalOverride: decOrNull(form, "totalOverride"),
      createdBy: actor.email,
      forceStatus: "confirmed",
    },
  );
  if (!result.ok) {
    back(base, "erro", `Não foi possível reservar: ${result.violations.map((v) => violationText(pt, v)).join(" ")}`);
  }
  await audit(actor, "booking.created", {
    entity: "booking",
    id: result.id,
    summary: `${result.reference} · ${source} · ${checkInDate}→${checkOutDate}`,
  });
  if (email && bool(form, "notify")) await notifyBookingPlaced(result.id);
  refreshBooking(result.id);
  back(detail(result.id), "ok", `Reserva ${result.reference} criada${result.unitId ? "" : " (sem quarto atribuído — escolha um)"}.`);
}

// --- edit -----------------------------------------------------------------------

export async function updateGuestAction(form: FormData) {
  const actor = await requirePermission("bookings.manage");
  const id = str(form, "id");
  const email = str(form, "email", "", 160);
  if (email && !isEmail(email)) back(detail(id), "erro", "Email inválido.");
  await updateBookingGuest(id, {
    firstName: str(form, "firstName", "", 80),
    lastName: str(form, "lastName", "", 80),
    email,
    phone: str(form, "phone", "", 40),
    country: str(form, "country", "", 80),
    notes: str(form, "notes", "", 2000),
    eta: str(form, "eta", "", 20),
  });
  await audit(actor, "booking.guest_updated", { entity: "booking", id });
  refreshBooking(id);
  back(detail(id), "ok", "Dados do hóspede guardados.");
}

export async function modifyStayAction(form: FormData) {
  const actor = await requirePermission("bookings.manage");
  const id = str(form, "id");
  const ci = date(form, "checkIn");
  const co = date(form, "checkOut");
  if (!ci || !co) back(detail(id), "erro", "Datas inválidas.");
  try {
    const b = await modifyStay(id, {
      roomId: str(form, "roomId"),
      checkIn: ci,
      checkOut: co,
      adults: Math.max(1, int(form, "adults", 1)),
      children: Math.max(0, int(form, "children", 0)),
      ratePlanId: str(form, "ratePlanId"),
      reprice: bool(form, "reprice"),
      overrideRestrictions: bool(form, "override"),
    });
    await audit(actor, "booking.modified", { entity: "booking", id, summary: `${b.checkIn}→${b.checkOut} · ${b.roomId} · ${b.total} €` });
  } catch (err) {
    back(detail(id), "erro", ruleMessage(err));
  }
  refreshBooking(id);
  back(detail(id), "ok", "Estadia alterada.");
}

// --- status ---------------------------------------------------------------------

export async function bookingStatusAction(form: FormData) {
  const actor = await requirePermission("bookings.manage");
  const id = str(form, "id");
  const action = str(form, "action");
  try {
    switch (action) {
      case "confirm":
        await setStatusSimple(id, "confirmed");
        break;
      case "checkin":
        await checkIn(id, { unitId: int(form, "unitId", 0) || null, force: bool(form, "force") });
        break;
      case "checkout": {
        const b = await getBooking(id);
        if (b) {
          const folio = buildFolio(b, await listCharges(id));
          if (folio.balance > 0.009 && !bool(form, "force")) {
            back(detail(id), "erro", `Há ${folio.balance.toFixed(2)} € por pagar na conta. Registe o pagamento ou confirme o check-out com saldo em dívida.`);
          }
        }
        await checkOut(id, { by: actor.email });
        break;
      }
      case "noshow":
        await markNoShow(id, decOrNull(form, "fee"));
        break;
      case "undo_checkin":
        await revertStatus(id, "confirmed");
        break;
      case "undo_checkout":
        await revertStatus(id, "checked_in");
        break;
      default:
        back(detail(id), "erro", "Ação desconhecida.");
    }
  } catch (err) {
    if ((err as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw err;
    back(detail(id), "erro", ruleMessage(err));
  }
  await audit(actor, `booking.${action}`, { entity: "booking", id });
  refreshBooking(id);
  const done: Record<string, string> = {
    confirm: "Reserva confirmada.",
    checkin: "Check-in feito. O quarto está ocupado.",
    checkout: "Check-out feito. Foi criada a tarefa de limpeza.",
    noshow: "Marcada como não comparência.",
    undo_checkin: "Check-in anulado.",
    undo_checkout: "Check-out anulado.",
  };
  back(detail(id), "ok", done[action] ?? "Feito.");
}

export async function cancelBookingAction(form: FormData) {
  const actor = await requirePermission("bookings.manage");
  const id = str(form, "id");
  if (!bool(form, "confirm")) back(detail(id), "erro", "Confirme o cancelamento.");
  try {
    const b = await cancelBooking(id, { reason: str(form, "reason", "hotel", 300) || "hotel", fee: decOrNull(form, "fee"), by: actor.email });
    await audit(actor, "booking.cancelled", { entity: "booking", id, summary: `${b.reference} · penalização ${b.cancelFee} €` });
    if (bool(form, "notify")) await notifyCancelled(id, "hotel");
  } catch (err) {
    back(detail(id), "erro", ruleMessage(err));
  }
  refreshBooking(id);
  back(detail(id), "ok", "Reserva cancelada. O quarto voltou à venda.");
}

// --- units ------------------------------------------------------------------

export async function assignUnitAction(form: FormData) {
  const actor = await requirePermission("bookings.manage");
  const id = str(form, "id");
  const unitId = int(form, "unitId", 0) || null;
  const b = await getBooking(id);
  if (!b) back("/admin/reservas", "erro", "Reserva não encontrada.");
  if (unitId) {
    const unit = await queryOne<{ room_id: string; code: string }>(`SELECT room_id, code FROM units WHERE id = $1`, [unitId]);
    if (!unit) back(detail(id), "erro", "Quarto inexistente.");
    if (unit.room_id !== b.roomId) back(detail(id), "erro", `O quarto ${unit.code} não é da tipologia reservada. Altere a estadia primeiro.`);
    if (!(await unitIsFree(null, unitId, b.checkIn, b.checkOut, id))) back(detail(id), "erro", `O quarto ${unit.code} está ocupado nestas datas.`);
  }
  await setBookingUnit(null, id, unitId);
  if (b.status === "checked_in" && b.unitId !== unitId) {
    // Room change during the stay: the old room needs cleaning, the new one is occupied.
    if (b.unitId) await query(`UPDATE units SET status='cleaning', updated_at=now() WHERE id=$1`, [b.unitId]);
    if (unitId) await query(`UPDATE units SET status='occupied', updated_at=now() WHERE id=$1`, [unitId]);
  }
  await audit(actor, "booking.unit_assigned", { entity: "booking", id, summary: String(unitId ?? "—") });
  refreshBooking(id);
  back(form.get("back") === "map" ? "/admin/ocupacao" : detail(id), "ok", "Quarto atribuído.");
}

/** Drag-and-drop on the occupancy map. Returns a result instead of redirecting. */
export async function moveBookingToUnit(bookingId: string, unitId: number): Promise<{ ok: boolean; message: string }> {
  const actor = await requirePermission("bookings.manage");
  const b = await getBooking(bookingId);
  if (!b) return { ok: false, message: "Reserva não encontrada." };
  if (["cancelled", "no_show", "checked_out"].includes(b.status)) return { ok: false, message: "Esta reserva já não ocupa quarto." };
  const unit = await queryOne<{ room_id: string; code: string; active: boolean }>(`SELECT room_id, code, active FROM units WHERE id = $1`, [unitId]);
  if (!unit || !unit.active) return { ok: false, message: "Quarto inexistente." };
  if (unit.room_id !== b.roomId) return { ok: false, message: `O quarto ${unit.code} é de outra tipologia. Altere a tipologia na reserva.` };
  if (!(await unitIsFree(null, unitId, b.checkIn, b.checkOut, bookingId))) return { ok: false, message: `O quarto ${unit.code} já está ocupado nessas noites.` };
  await setBookingUnit(null, bookingId, unitId);
  if (b.status === "checked_in" && b.unitId && b.unitId !== unitId) {
    await query(`UPDATE units SET status='cleaning', updated_at=now() WHERE id=$1`, [b.unitId]);
    await query(`UPDATE units SET status='occupied', updated_at=now() WHERE id=$1`, [unitId]);
  }
  await audit(actor, "booking.unit_moved", { entity: "booking", id: bookingId, summary: `${b.unitCode ?? "—"} → ${unit.code}` });
  refreshBooking(bookingId);
  return { ok: true, message: `${b.reference} passou para o quarto ${unit.code}.` };
}

// --- folio ---------------------------------------------------------------------

export async function addChargeAction(form: FormData) {
  const actor = await requireAnyPermission("bookings.manage", "payments.manage");
  const id = str(form, "id");
  const category = oneOf(str(form, "category"), CHARGE_CATEGORIES);
  const quantity = dec(form, "quantity", 1);
  const unitPrice = dec(form, "unitPrice", NaN);
  if (!(quantity > 0) || !Number.isFinite(unitPrice)) back(detail(id), "erro", "Quantidade e preço inválidos.");
  const vat = decOrNull(form, "vatRate") ?? DEFAULT_VAT[category];
  await addCharge({
    bookingId: id,
    category,
    description: str(form, "description", "", 200),
    quantity,
    unitPrice,
    vatRate: vat,
    createdBy: actor.email,
  });
  await audit(actor, "folio.charge_added", { entity: "booking", id, summary: `${category} ${quantity} × ${unitPrice} €` });
  refreshBooking(id);
  back(`${detail(id)}#conta`, "ok", "Lançado na conta do quarto.");
}

export async function voidChargeAction(form: FormData) {
  const actor = await requireAnyPermission("bookings.manage", "payments.manage");
  const chargeId = str(form, "chargeId");
  const bookingId = await voidCharge(chargeId);
  if (!bookingId) back("/admin/reservas", "erro", "Lançamento não encontrado.");
  await audit(actor, "folio.charge_voided", { entity: "booking", id: bookingId, summary: chargeId });
  refreshBooking(bookingId);
  back(`${detail(bookingId)}#conta`, "ok", "Lançamento anulado.");
}

// --- payments --------------------------------------------------------------------

export async function manualPaymentAction(form: FormData) {
  const actor = await requirePermission("payments.manage");
  const id = str(form, "id");
  const amount = dec(form, "amount", NaN);
  if (!(amount > 0)) back(`${detail(id)}#pagamentos`, "erro", "Valor inválido.");
  const refund = bool(form, "refund");
  await recordManualPayment({
    bookingId: id,
    amount: Math.round(amount * 100) / 100,
    method: oneOf(str(form, "method"), ["cash", "card", "transfer", "mbway", "multibanco", "other"] as const),
    note: str(form, "note", "", 300),
    createdBy: actor.email,
    refund,
  });
  await audit(actor, refund ? "payment.manual_refund" : "payment.manual", { entity: "booking", id, summary: `${amount} €` });
  refreshBooking(id);
  back(`${detail(id)}#pagamentos`, "ok", refund ? "Devolução registada." : "Pagamento registado.");
}

export async function sendPaymentLinkAction(form: FormData) {
  const actor = await requirePermission("payments.manage");
  const id = str(form, "id");
  const amount = dec(form, "amount", NaN);
  const method = oneOf(str(form, "method"), ["card", "multibanco", "mbway"] as const);
  if (!(amount > 0)) back(`${detail(id)}#pagamentos`, "erro", "Valor inválido.");
  const rules = await readBookingRules();
  try {
    const started = await startBookingPayment({
      bookingId: id,
      method,
      amount,
      phone: str(form, "phone", "", 40) || undefined,
      holdHours: method === "card" ? 23 : rules.paymentHoldHours,
      createdBy: actor.email,
    });
    const b = await getBooking(id);
    if (b?.email && bool(form, "email")) {
      const lines =
        started.kind === "redirect"
          ? [`Para pagar ${amount.toFixed(2)} € relativos à reserva ${b.reference}, use este link seguro:`, started.url]
          : started.kind === "multibanco"
            ? [`Referência Multibanco para a reserva ${b.reference}:`, `Entidade ${started.entity}`, `Referência ${started.reference}`, `Valor ${amount.toFixed(2)} €`]
            : [`Enviámos um pedido MB WAY de ${amount.toFixed(2)} € para a reserva ${b.reference}.`];
      await sendEmail({
        to: b.email,
        subject: `Pagamento · ${b.reference} · Hotel Vice-Rei`,
        text: [`Olá ${b.firstName},`, "", ...lines, "", `A sua reserva: ${guestUrl(b)}`].join("\n"),
        html: `<p>Olá ${b.firstName.replace(/</g, "")},</p>${lines.map((l) => `<p>${l.startsWith("http") ? `<a href="${l}">${l}</a>` : l.replace(/</g, "")}</p>`).join("")}<p><a href="${guestUrl(b)}">A sua reserva</a></p>`,
        template: "payment_request",
        bookingId: id,
      });
    }
    await audit(actor, "payment.requested", { entity: "booking", id, summary: `${method} ${amount} €` });
  } catch (err) {
    back(`${detail(id)}#pagamentos`, "erro", (err as Error).message);
  }
  refreshBooking(id);
  back(`${detail(id)}#pagamentos`, "ok", "Pedido de pagamento criado.");
}

export async function refundAction(form: FormData) {
  const actor = await requirePermission("payments.manage");
  const id = str(form, "id");
  const paymentId = str(form, "paymentId");
  const amount = dec(form, "amount", NaN);
  try {
    await refundOnlinePayment({ paymentId, amount, reason: str(form, "reason", "", 300), createdBy: actor.email });
    await audit(actor, "payment.refund", { entity: "booking", id, summary: `${amount} €` });
  } catch (err) {
    back(`${detail(id)}#pagamentos`, "erro", (err as Error).message);
  }
  refreshBooking(id);
  back(`${detail(id)}#pagamentos`, "ok", "Reembolso pedido ao prestador.");
}

// --- invoicing ------------------------------------------------------------------

export async function issueInvoiceAction(form: FormData) {
  const actor = await requirePermission("invoices.manage");
  const id = str(form, "id");
  try {
    const inv = await issueBookingInvoice({
      bookingId: id,
      customer: {
        name: str(form, "name", "", 120),
        vat: str(form, "vat", "", 30).replace(/\s/g, ""),
        country: str(form, "countryCode", "PT", 2).toUpperCase() || "PT",
        address: str(form, "address", "", 200),
        postalCode: str(form, "postalCode", "", 20),
        city: str(form, "city", "", 80),
        email: str(form, "email", "", 160),
      },
      sendByEmail: bool(form, "sendByEmail"),
      notes: str(form, "notes", "", 300),
    });
    await audit(actor, "invoice.issued", { entity: "booking", id, summary: `${inv.number || "rascunho"} · ${inv.total} €` });
  } catch (err) {
    back(`${detail(id)}#faturas`, "erro", (err as Error).message);
  }
  refreshBooking(id);
  back(`${detail(id)}#faturas`, "ok", "Documento emitido no programa de faturação.");
}

// --- guests / SIBA ---------------------------------------------------------------

export async function saveGuestsAction(form: FormData) {
  const actor = await requirePermission("guests.manage");
  const id = str(form, "id");
  const guests = guestsFromForm(form);
  if (guests.length === 0) back(`${detail(id)}#hospedes`, "erro", "Indique pelo menos um hóspede.");
  await saveGuests(id, guests, requiresBulletin);
  await audit(actor, "guests.saved", { entity: "booking", id, summary: `${guests.length} hóspede(s)` });
  refreshBooking(id);
  back(`${detail(id)}#hospedes`, "ok", "Hóspedes guardados.");
}

export async function sendBookingSibaAction(form: FormData) {
  const actor = await requirePermission("guests.manage");
  const id = str(form, "id");
  const guestIds = (await query<{ id: string }>(`SELECT id FROM booking_guests WHERE booking_id = $1 AND siba_status IN ('pending','error')`, [id])).map((r) => r.id);
  const run = await sendPendingBulletins(guestIds);
  await audit(actor, "siba.sent_booking", { entity: "booking", id, summary: run.result?.message ?? `${run.skipped} com dados em falta` });
  refreshBooking(id);
  if (run.result?.ok) back(`${detail(id)}#hospedes`, "ok", run.result.message);
  back(`${detail(id)}#hospedes`, "erro", run.result?.message ?? "Há dados em falta nos hóspedes — veja as mensagens em cada um.");
}

export async function resendConfirmationAction(form: FormData) {
  const actor = await requirePermission("bookings.manage");
  const id = str(form, "id");
  await notifyBookingPlaced(id);
  await audit(actor, "booking.email_resent", { entity: "booking", id });
  back(detail(id), "ok", "Confirmação reenviada (ver histórico de e-mails).");
}
