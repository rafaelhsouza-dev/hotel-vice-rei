import { query, queryOne, transaction } from "../db";
import { SITE_URL } from "../site";
import { getIntegrationSafe } from "../repo/integrations";
import { getPaymentProvider } from "./providers";
import { lockRoomType } from "../booking/service";
import { addDays, getCalendar } from "../repo/availability";
import {
  PaymentError,
  type PaymentEvent,
  type PaymentMethod,
  type ProviderConfig,
  type ProviderId,
  type StartPaymentResult,
} from "./types";

/**
 * Payments as the PMS sees them: one `payments` row per attempt, whatever the
 * provider, and the booking's paid total always recomputed from those rows.
 *
 * Provider notifications can arrive twice, out of order, or after the guest
 * already came back from the checkout page. Every update here is therefore
 * idempotent and keyed by our own payment id or the provider's reference.
 */

export type PaymentSetup = {
  /** Which provider takes each method; absent = method not offered. */
  methods: Partial<Record<PaymentMethod, ProviderId>>;
  any: boolean;
};

async function providerConfig(id: ProviderId): Promise<ProviderConfig | null> {
  const record = await getIntegrationSafe(id);
  if (!record.enabled) return null;
  return { mode: record.mode, credentials: record.credentials, settings: record.settings };
}

/**
 * What the site can offer right now. ifthenpay takes MB WAY and Multibanco
 * when configured (lower fees); Stripe covers cards and, if enabled in its
 * settings, the Portuguese methods as a fallback.
 */
export async function getPaymentSetup(): Promise<PaymentSetup> {
  const methods: PaymentSetup["methods"] = {};
  for (const id of ["ifthenpay", "stripe"] as const) {
    const config = await providerConfig(id);
    if (!config) continue;
    for (const method of getPaymentProvider(id).methods(config)) {
      if (!methods[method]) methods[method] = id;
    }
  }
  return { methods, any: Object.keys(methods).length > 0 };
}

export type BookingForPayment = {
  id: string;
  reference: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  locale: string;
  total: number;
  amountDueNow: number;
  paidTotal: number;
  status: string;
  guestToken: string | null;
};

async function loadBooking(id: string): Promise<BookingForPayment | null> {
  const r = await queryOne<Record<string, unknown>>(
    `SELECT id, reference, first_name, last_name, email, phone, locale, total,
            amount_due_now, paid_total, status, guest_token
     FROM bookings WHERE id = $1`,
    [id],
  );
  if (!r) return null;
  return {
    id: String(r.id),
    reference: String(r.reference),
    firstName: String(r.first_name ?? ""),
    lastName: String(r.last_name ?? ""),
    email: String(r.email ?? ""),
    phone: String(r.phone ?? ""),
    locale: String(r.locale ?? "pt"),
    total: Number(r.total),
    amountDueNow: Number(r.amount_due_now),
    paidTotal: Number(r.paid_total),
    status: String(r.status),
    guestToken: (r.guest_token as string) ?? null,
  };
}

const LOCALES = ["pt", "en", "es", "fr"] as const;
type Lc = (typeof LOCALES)[number];
const asLocale = (v: string): Lc => ((LOCALES as readonly string[]).includes(v) ? (v as Lc) : "pt");

export type StartedPayment = StartPaymentResult & { paymentId: string; amount: number };

/**
 * Opens a payment for a booking. `amount` defaults to what the plan asks for
 * now minus what was already paid; the desk can pass a different amount
 * (e.g. to send a link for the balance).
 */
export async function startBookingPayment(input: {
  bookingId: string;
  method: PaymentMethod;
  phone?: string;
  amount?: number;
  holdHours: number;
  createdBy?: string;
}): Promise<StartedPayment> {
  const booking = await loadBooking(input.bookingId);
  if (!booking) throw new PaymentError("Reserva não encontrada.", "not_found");
  if (booking.status === "cancelled") throw new PaymentError("A reserva está cancelada.", "cancelled");

  const setup = await getPaymentSetup();
  const providerId = setup.methods[input.method];
  if (!providerId) throw new PaymentError("Este meio de pagamento não está disponível.", "method_unavailable");
  const config = (await providerConfig(providerId))!;
  const provider = getPaymentProvider(providerId);

  const amount = Math.round(
    (input.amount ?? Math.max(0, booking.amountDueNow - booking.paidTotal)) * 100,
  ) / 100;
  if (!(amount > 0)) throw new PaymentError("Não há valor a pagar.", "nothing_due");

  // Checkout sessions are capped at 24 h by Stripe; Multibanco references
  // can live longer. The booking hold is what releases the room either way.
  const expiresAt = new Date(Date.now() + input.holdHours * 3_600_000);

  const row = await queryOne<{ id: string }>(
    `INSERT INTO payments (booking_id, provider, method, kind, status, amount, expires_at, created_by)
     VALUES ($1,$2,$3,'payment','pending',$4,$5,$6) RETURNING id`,
    [booking.id, providerId, input.method, amount, expiresAt, input.createdBy ?? ""],
  );
  const paymentId = row!.id;
  const locale = asLocale(booking.locale);
  const back = `${SITE_URL}/${locale}/reserva/${booking.guestToken ?? ""}`;

  try {
    const result = await provider.start(config, {
      paymentId,
      bookingReference: booking.reference,
      amount,
      currency: "EUR",
      method: input.method,
      description: `Hotel Vice-Rei · ${booking.reference}`,
      customer: {
        name: `${booking.firstName} ${booking.lastName}`.trim(),
        email: booking.email,
        phone: input.phone ?? booking.phone,
      },
      locale,
      successUrl: `${back}?pagamento=ok`,
      cancelUrl: `${back}?pagamento=cancelado`,
      notifyUrl: `${SITE_URL}/api/payments/${providerId}`,
      expiresAt,
    });

    await query(
      `UPDATE payments SET
         provider_ref = $2,
         checkout_url = $3,
         mb_entity = $4,
         mb_reference = $5,
         expires_at = COALESCE($6, expires_at),
         data = $7::jsonb,
         updated_at = now()
       WHERE id = $1`,
      [
        paymentId,
        result.providerRef,
        result.kind === "redirect" ? result.url : "",
        result.kind === "multibanco" ? result.entity : "",
        result.kind === "multibanco" ? result.reference : "",
        result.expiresAt,
        JSON.stringify(result.data ?? {}),
      ],
    );
    await query(
      `UPDATE bookings SET payment_status = CASE WHEN payment_status = 'unpaid' THEN 'pending' ELSE payment_status END,
         updated_at = now() WHERE id = $1`,
      [booking.id],
    );
    return { ...result, paymentId, amount };
  } catch (err) {
    await query(
      `UPDATE payments SET status = 'failed', note = $2, updated_at = now() WHERE id = $1`,
      [paymentId, (err as Error).message.slice(0, 300)],
    );
    throw err instanceof PaymentError ? err : new PaymentError("O prestador de pagamentos recusou o pedido.");
  }
}

/** Recomputes paid_total / payment_status from the payments ledger. */
async function settleBooking(
  client: import("pg").PoolClient,
  bookingId: string,
): Promise<{ confirmedNow: boolean }> {
  const { rows } = await client.query<{ paid: string; refunded: string; pending: string }>(
    `SELECT
       COALESCE(sum(amount) FILTER (WHERE kind='payment' AND status='succeeded'),0)::text AS paid,
       COALESCE(sum(amount) FILTER (WHERE kind='refund' AND status='succeeded'),0)::text AS refunded,
       count(*) FILTER (WHERE kind='payment' AND status='pending')::text AS pending
     FROM payments WHERE booking_id = $1`,
    [bookingId],
  );
  const paid = Number(rows[0].paid) - Number(rows[0].refunded);
  const { rows: b } = await client.query<{ total: string; due: string; status: string; tax: string }>(
    `SELECT total, amount_due_now AS due, status, tourist_tax AS tax FROM bookings WHERE id = $1 FOR UPDATE`,
    [bookingId],
  );
  if (!b[0]) return { confirmedNow: false };
  const total = Number(b[0].total) + Number(b[0].tax);
  const due = Number(b[0].due);
  const refundedAll = Number(rows[0].refunded) > 0 && paid <= 0;
  const status = refundedAll
    ? "refunded"
    : paid >= total - 0.005 && total > 0
      ? "paid"
      : paid > 0
        ? "partial"
        : Number(rows[0].pending) > 0
          ? "pending"
          : "unpaid";

  const confirm = b[0].status === "pending" && due > 0 && paid >= due - 0.005;
  await client.query(
    `UPDATE bookings SET paid_total = $2, payment_status = $3,
       status = CASE WHEN $4 THEN 'confirmed' ELSE status END, updated_at = now()
     WHERE id = $1`,
    [bookingId, Math.round(paid * 100) / 100, status, confirm],
  );
  return { confirmedNow: confirm };
}

export type AppliedEvent = { bookingId: string | null; changed: boolean; confirmedNow: boolean };

/** Applies one verified provider event. Safe to call repeatedly. */
export async function applyPaymentEvent(provider: ProviderId, event: PaymentEvent): Promise<AppliedEvent> {
  if (event.status === "pending") return { bookingId: null, changed: false, confirmedNow: false };

  return transaction(async (client) => {
    const { rows } = await client.query<{ id: string; booking_id: string | null; status: string; amount: string }>(
      `SELECT id, booking_id, status, amount FROM payments
       WHERE provider = $1 AND (($2::uuid IS NOT NULL AND id = $2::uuid) OR (provider_ref <> '' AND provider_ref = $3))
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [provider, event.paymentId && /^[0-9a-f-]{36}$/i.test(event.paymentId) ? event.paymentId : null, event.providerRef],
    );
    const payment = rows[0];
    if (!payment) return { bookingId: null, changed: false, confirmedNow: false };

    // Terminal states never move again, except a late success after an
    // expiry we declared ourselves (the guest did pay): that one we honour.
    const terminal = payment.status === "succeeded" || payment.status === "failed" || payment.status === "cancelled";
    if (terminal || payment.status === event.status) {
      return { bookingId: payment.booking_id, changed: false, confirmedNow: false };
    }
    if (payment.status === "expired" && event.status !== "succeeded") {
      return { bookingId: payment.booking_id, changed: false, confirmedNow: false };
    }

    if (event.status === "succeeded" && event.amount != null && Math.abs(event.amount - Number(payment.amount)) > 0.009) {
      // Record what actually arrived; the desk sees the mismatch in the folio.
      await client.query(`UPDATE payments SET amount = $2, note = 'Valor recebido difere do pedido.' WHERE id = $1`, [
        payment.id,
        event.amount,
      ]);
    }
    await client.query(
      `UPDATE payments SET status = $2, provider_ref = CASE WHEN provider_ref = '' THEN $3 ELSE provider_ref END,
         data = data || $4::jsonb, updated_at = now() WHERE id = $1`,
      [payment.id, event.status, event.providerRef, JSON.stringify({ lastEvent: event.raw })],
    );

    let confirmedNow = false;
    if (payment.booking_id) {
      ({ confirmedNow } = await settleBooking(client, payment.booking_id));
      // A late payment for a booking we already released: reinstate it only
      // if the room is still free; otherwise the desk must call the guest
      // (the payment stays recorded and the booking shows it as paid).
      if (event.status === "succeeded") {
        const { rows: br } = await client.query<{ room_id: string; check_in: string; check_out: string; status: string; cancel_reason: string }>(
          `SELECT room_id, check_in, check_out, status, cancel_reason FROM bookings WHERE id = $1`,
          [payment.booking_id],
        );
        const b = br[0];
        if (b && b.status === "cancelled" && b.cancel_reason === "payment_expired" && b.room_id) {
          await lockRoomType(client, b.room_id);
          const nights = await getCalendar(b.room_id, b.check_in, addDays(b.check_out, -1), client);
          const free = nights.length > 0 && nights.every((n) => !n.closed && n.free > 0);
          await client.query(
            free
              ? `UPDATE bookings SET status = 'confirmed', cancelled_at = NULL, cancel_reason = '', updated_at = now() WHERE id = $1`
              : `UPDATE bookings SET cancel_reason = 'paid_after_release', updated_at = now() WHERE id = $1`,
            [payment.booking_id],
          );
          confirmedNow = free;
        }
      }
    }
    return { bookingId: payment.booking_id, changed: true, confirmedNow };
  });
}

/** Verifies and applies an incoming webhook/callback. */
export async function handleNotification(
  providerId: ProviderId,
  input: { rawBody: string; headers: Headers; url: URL; method: string },
): Promise<AppliedEvent[]> {
  const config = await providerConfig(providerId);
  if (!config) throw new PaymentError("Prestador desativado.", "disabled");
  const events = await getPaymentProvider(providerId).parseNotification(config, input);
  const out: AppliedEvent[] = [];
  for (const event of events) out.push(await applyPaymentEvent(providerId, event));
  return out;
}

/** Cash, card terminal or transfer taken at the desk. */
export async function recordManualPayment(input: {
  bookingId: string;
  amount: number;
  method: "cash" | "card" | "transfer" | "mbway" | "multibanco" | "other";
  note: string;
  createdBy: string;
  refund?: boolean;
}): Promise<void> {
  await transaction(async (client) => {
    await client.query(
      `INSERT INTO payments (booking_id, provider, method, kind, status, amount, note, created_by)
       VALUES ($1,'manual',$2,$3,'succeeded',$4,$5,$6)`,
      [input.bookingId, input.method, input.refund ? "refund" : "payment", input.amount, input.note.slice(0, 300), input.createdBy],
    );
    await settleBooking(client, input.bookingId);
  });
}

/** Refunds part or all of an online payment through its provider. */
export async function refundOnlinePayment(input: {
  paymentId: string;
  amount: number;
  reason: string;
  createdBy: string;
}): Promise<void> {
  const p = await queryOne<{ booking_id: string; provider: ProviderId; provider_ref: string; amount: string; status: string; method: string }>(
    `SELECT booking_id, provider, provider_ref, amount, status, method FROM payments WHERE id = $1 AND kind = 'payment'`,
    [input.paymentId],
  );
  if (!p || p.status !== "succeeded") throw new PaymentError("Só é possível reembolsar pagamentos concluídos.", "invalid");
  if (p.provider === ("manual" as ProviderId)) throw new PaymentError("Pagamentos manuais reembolsam-se como movimento manual.", "invalid");
  if (input.amount <= 0 || input.amount > Number(p.amount) + 0.001) {
    throw new PaymentError("Valor de reembolso inválido.", "invalid");
  }
  const provider = getPaymentProvider(p.provider);
  if (!provider.refund) {
    throw new PaymentError("Este prestador não permite reembolsos por API. Faça-o no backoffice do prestador e registe-o como movimento manual.", "unsupported");
  }
  const config = await providerConfig(p.provider);
  if (!config) throw new PaymentError("Prestador desativado.", "disabled");
  const result = await provider.refund(config, { providerRef: p.provider_ref, amount: input.amount, reason: input.reason });

  await transaction(async (client) => {
    await client.query(
      `INSERT INTO payments (booking_id, provider, method, kind, status, amount, provider_ref, note, created_by)
       VALUES ($1,$2,$3,'refund',$4,$5,$6,$7,$8)`,
      [
        p.booking_id,
        p.provider,
        p.method,
        result.status === "failed" ? "failed" : result.status === "pending" ? "pending" : "succeeded",
        input.amount,
        result.providerRef,
        input.reason.slice(0, 300),
        input.createdBy,
      ],
    );
    await settleBooking(client, p.booking_id);
  });
}

/**
 * Background job: pending payments past their expiry are checked with the
 * provider (when it can be asked) and otherwise marked expired; bookings that
 * required payment and got none are released so the room goes back on sale.
 */
export async function expireStalePayments(holdHours: number): Promise<{ expired: number; released: string[] }> {
  const stale = await query<{ id: string; provider: ProviderId; provider_ref: string }>(
    `SELECT id, provider, provider_ref FROM payments
     WHERE status = 'pending' AND kind = 'payment' AND expires_at IS NOT NULL AND expires_at < now()
     LIMIT 200`,
  );
  let expired = 0;
  for (const p of stale) {
    let handled = false;
    const provider = p.provider === ("manual" as ProviderId) ? null : getPaymentProvider(p.provider);
    if (provider?.fetchStatus && p.provider_ref) {
      const config = await providerConfig(p.provider);
      if (config) {
        try {
          const event = await provider.fetchStatus(config, p.provider_ref);
          if (event && event.status !== "pending") {
            await applyPaymentEvent(p.provider, { ...event, paymentId: p.id });
            handled = true;
          }
        } catch {
          /* fall through to expiry */
        }
      }
    }
    if (!handled) {
      await query(`UPDATE payments SET status = 'expired', updated_at = now() WHERE id = $1 AND status = 'pending'`, [p.id]);
      expired++;
    }
  }

  const released = await query<{ id: string }>(
    `UPDATE bookings b SET status = 'cancelled', cancelled_at = now(), cancel_reason = 'payment_expired',
       payment_status = 'unpaid', updated_at = now()
     WHERE b.status = 'pending' AND b.amount_due_now > 0 AND b.paid_total < b.amount_due_now
       AND b.source = 'site'
       -- The booking-level hold decides, not one attempt: a guest whose MB WAY
       -- request lapsed after 4 minutes can still pay by another method.
       AND b.created_at < now() - make_interval(hours => $1::int)
       AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.booking_id = b.id AND p.status IN ('pending','succeeded') AND p.kind = 'payment')
       AND EXISTS (SELECT 1 FROM payments p WHERE p.booking_id = b.id AND p.kind = 'payment')
     RETURNING b.id`,
    [Math.max(1, Math.round(holdHours))],
  );
  return { expired, released: released.map((r) => r.id) };
}

export type PaymentRow = {
  id: string;
  bookingId: string | null;
  provider: string;
  method: string;
  kind: "payment" | "refund";
  status: string;
  amount: number;
  providerRef: string;
  checkoutUrl: string;
  mbEntity: string;
  mbReference: string;
  expiresAt: string | null;
  note: string;
  createdBy: string;
  createdAt: string;
  bookingReference?: string;
  guestName?: string;
};

function toRow(r: Record<string, unknown>): PaymentRow {
  return {
    id: String(r.id),
    bookingId: (r.booking_id as string) ?? null,
    provider: String(r.provider),
    method: String(r.method),
    kind: r.kind as PaymentRow["kind"],
    status: String(r.status),
    amount: Number(r.amount),
    providerRef: String(r.provider_ref ?? ""),
    checkoutUrl: String(r.checkout_url ?? ""),
    mbEntity: String(r.mb_entity ?? ""),
    mbReference: String(r.mb_reference ?? ""),
    expiresAt: r.expires_at ? (r.expires_at as Date).toISOString() : null,
    note: String(r.note ?? ""),
    createdBy: String(r.created_by ?? ""),
    createdAt: (r.created_at as Date).toISOString(),
    bookingReference: r.reference ? String(r.reference) : undefined,
    guestName: r.first_name ? `${r.first_name} ${r.last_name ?? ""}`.trim() : undefined,
  };
}

export async function listBookingPayments(bookingId: string): Promise<PaymentRow[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM payments WHERE booking_id = $1 ORDER BY created_at`,
    [bookingId],
  );
  return rows.map(toRow);
}

export async function listPayments(opts: { status?: string; limit?: number } = {}): Promise<PaymentRow[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT p.*, b.reference, b.first_name, b.last_name
     FROM payments p LEFT JOIN bookings b ON b.id = p.booking_id
     WHERE ($1::text IS NULL OR p.status = $1)
     ORDER BY p.created_at DESC LIMIT $2`,
    [opts.status ?? null, Math.min(500, opts.limit ?? 100)],
  );
  return rows.map(toRow);
}
