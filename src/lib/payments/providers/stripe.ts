import { createHmac, timingSafeEqual } from "node:crypto";
import {
  PaymentError,
  type PaymentEvent,
  type PaymentMethod,
  type PaymentProvider,
  type ProviderConfig,
  type RefundResult,
  type StartPaymentRequest,
} from "../types";
import { TIMEOUT_MS, credential, scrubSecrets, toCents } from "./shared";

/**
 * Stripe, through the REST API directly (no SDK: one less dependency to keep
 * patched, and we use a handful of endpoints).
 *
 * The guest is sent to a hosted Checkout Session. Card payments settle while
 * the guest is still on the page; Multibanco is a voucher paid later at an ATM
 * or home banking, so `checkout.session.completed` can arrive *unpaid* and the
 * money only shows up in `checkout.session.async_payment_succeeded` (days
 * later). That is why "completed" only counts as paid when
 * `payment_status === "paid"`.
 *
 * The API version is pinned so a Dashboard upgrade cannot change response
 * shapes under us. 2026-09-30.endive removed `payment_method_types` from
 * Checkout Session creation; `allowed_payment_method_types` replaces it and
 * acts as a *filter* over the methods enabled in the Dashboard, silently
 * dropping ones that are not enabled — so after creating a session we check
 * the method actually survived, and fail loudly if it did not.
 *
 * Webhook events are rendered in the API version of the webhook endpoint (set
 * in the Dashboard), not this one; the fields read here (`type`,
 * `data.object.{id, payment_status, status, amount_total,
 * client_reference_id, metadata}`) are stable across versions.
 *
 * @see https://docs.stripe.com/api/checkout/sessions/create
 * @see https://docs.stripe.com/changelog/endive/2026-09-30/remove-payment-method-types-checkout-sessions
 * @see https://docs.stripe.com/webhooks?verify=verify-manually (signature scheme)
 * @see https://docs.stripe.com/payments/multibanco/accept-a-payment?payment-ui=checkout
 * @see https://docs.stripe.com/payments/mb-way/accept-a-payment?payment-ui=checkout
 * @see https://docs.stripe.com/api/refunds/create
 */

const BASE = "https://api.stripe.com/v1";
export const STRIPE_API_VERSION = "2026-09-30.endive";
/** Stripe's own libraries default to 5 minutes; older signed payloads are replays. */
export const SIGNATURE_TOLERANCE_S = 300;

/** Stripe's `expires_at` must be 30 min – 24 h after creation; keep a minute of margin each side. */
const MIN_EXPIRY_S = 30 * 60 + 60;
const MAX_EXPIRY_S = 24 * 60 * 60 - 60;

const STRIPE_METHOD: Record<PaymentMethod, string> = {
  card: "card",
  mbway: "mb_way",
  multibanco: "multibanco",
};

const METHOD_LABEL: Record<PaymentMethod, string> = {
  card: "cartão",
  mbway: "MB WAY",
  multibanco: "Multibanco",
};

type StripeSession = {
  id: string;
  object: "checkout.session";
  url?: string | null;
  status?: "open" | "complete" | "expired" | null;
  payment_status?: "paid" | "unpaid" | "no_payment_required";
  amount_total?: number | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
  expires_at?: number;
  livemode?: boolean;
  payment_method_types?: string[];
  payment_intent?: string | { id: string; status?: string } | null;
};

type StripeRefund = { id: string; status?: string | null };

// ---------------------------------------------------------------------------
// Keys and HTTP
// ---------------------------------------------------------------------------

/**
 * Validates the secret key and that its mode matches the integration's mode.
 * A test key on a "live" integration would silently take fake payments for
 * real bookings; a live key on "test" would charge real cards during tests.
 */
function secretKey(config: ProviderConfig): string {
  const key = credential(config.credentials, "secretKey");
  if (!key) throw new PaymentError("Falta a chave secreta da Stripe.", "not_configured");
  if (key.startsWith("pk_")) {
    throw new PaymentError(
      "Colocou a chave publicável (pk_…) no campo da chave secreta. Use a chave secreta (sk_…) ou restrita (rk_…).",
      "invalid_credentials",
    );
  }
  if (!/^(sk|rk)_/.test(key)) {
    throw new PaymentError("A chave secreta da Stripe deve começar por sk_ ou rk_.", "invalid_credentials");
  }
  const keyMode = /^(sk|rk)_test_/.test(key) ? "test" : /^(sk|rk)_live_/.test(key) ? "live" : null;
  if (keyMode && keyMode !== config.mode) {
    throw new PaymentError(
      keyMode === "test"
        ? "A integração está em modo real, mas a chave da Stripe é de teste (…_test_). Use a chave de modo real ou mude a integração para teste."
        : "A integração está em modo de teste, mas a chave da Stripe é de modo real (…_live_). Use a chave de teste ou mude a integração para real.",
      "mode_mismatch",
    );
  }
  return key;
}

/** Flattens `{ a: { b: [x] } }` into Stripe's form encoding: `a[b][0]=x`. */
export function formEncode(input: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();
  const walk = (value: unknown, prefix: string) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${prefix}[${i}]`));
    } else if (typeof value === "object") {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        walk(v, prefix ? `${prefix}[${k}]` : k);
      }
    } else {
      params.append(prefix, String(value));
    }
  };
  walk(input, "");
  return params;
}

async function stripe<T>(
  config: ProviderConfig,
  path: string,
  { method = "GET", body, idempotencyKey }: {
    method?: "GET" | "POST";
    body?: Record<string, unknown>;
    idempotencyKey?: string;
  } = {},
): Promise<T> {
  const key = secretKey(config);
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Stripe-Version": STRIPE_API_VERSION,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: body ? formEncode(body).toString() : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  }).catch((error: unknown) => {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new PaymentError(
      timedOut ? "A Stripe não respondeu a tempo. Tente novamente." : "Não foi possível contactar a Stripe.",
      "network_error",
    );
  });

  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string; code?: string; type?: string };
  };

  if (!response.ok) {
    // Stripe's message for a bad key echoes a masked key; ours never does.
    if (response.status === 401) {
      throw new PaymentError("A Stripe recusou a chave secreta. Confirme-a no painel da Stripe.", "invalid_credentials");
    }
    if (response.status === 403) {
      throw new PaymentError(
        "A chave da Stripe não tem permissão para esta operação. Se usa uma chave restrita, dê-lhe acesso de escrita a Checkout Sessions e Refunds.",
        "forbidden",
      );
    }
    if (response.status === 429) {
      throw new PaymentError("Limite de pedidos da Stripe atingido. Tente daqui a pouco.", "rate_limited");
    }
    const detail = payload.error?.message ? scrubSecrets(payload.error.message) : `HTTP ${response.status}`;
    throw new PaymentError(`A Stripe recusou o pedido: ${detail}`, payload.error?.code ?? "provider_error");
  }
  return payload;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

const LOCALE: Record<StartPaymentRequest["locale"], string> = {
  pt: "pt", // European Portuguese; "pt-BR" is the Brazilian variant
  en: "en",
  es: "es",
  fr: "fr",
};

/** Clamps our expiry into the window Stripe accepts, in Unix seconds. */
export function clampExpiry(expiresAt: Date, now = Date.now()): number {
  const nowS = Math.floor(now / 1000);
  const wanted = Math.floor(expiresAt.getTime() / 1000);
  return Math.min(Math.max(wanted, nowS + MIN_EXPIRY_S), nowS + MAX_EXPIRY_S);
}

function sessionEvent(session: StripeSession, status: PaymentEvent["status"], raw: Record<string, unknown>): PaymentEvent {
  return {
    paymentId: session.client_reference_id || session.metadata?.payment_id || null,
    providerRef: session.id,
    status,
    amount: typeof session.amount_total === "number" ? session.amount_total / 100 : null,
    raw,
  };
}

/**
 * Current state of a session read from the API. A complete-but-unpaid session
 * is an outstanding Multibanco voucher, unless its PaymentIntent has gone back
 * to `requires_payment_method`/`canceled`, which is how Stripe marks an
 * expired or failed voucher.
 */
function statusFromSession(session: StripeSession): PaymentEvent["status"] {
  if (session.payment_status === "paid") return "succeeded";
  if (session.status === "expired") return "expired";
  if (session.status === "complete") {
    const pi = session.payment_intent;
    const piStatus = pi && typeof pi === "object" ? pi.status : undefined;
    if (piStatus === "requires_payment_method" || piStatus === "canceled") return "failed";
  }
  return "pending";
}

const EVENT_STATUS: Record<string, ((s: StripeSession) => PaymentEvent["status"]) | undefined> = {
  "checkout.session.completed": (s) => (s.payment_status === "paid" ? "succeeded" : "pending"),
  "checkout.session.async_payment_succeeded": () => "succeeded",
  "checkout.session.async_payment_failed": () => "failed",
  "checkout.session.expired": () => "expired",
};

// ---------------------------------------------------------------------------
// Signature
// ---------------------------------------------------------------------------

/**
 * Verifies a `Stripe-Signature` header (`t=…,v1=…[,v1=…][,v0=…]`): HMAC-SHA256
 * of `${t}.${rawBody}` with the endpoint secret, compared in constant time
 * against every `v1` (there are several while a rolled secret is still
 * active). `v0` and any other scheme are ignored, as Stripe instructs, to
 * prevent downgrade attacks. Throws PaymentError("invalid_signature").
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  now = Date.now(),
): void {
  if (!secret) {
    throw new PaymentError("Falta o segredo do webhook da Stripe (whsec_…).", "invalid_signature");
  }
  if (!header) throw new PaymentError("Notificação da Stripe sem assinatura.", "invalid_signature");

  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const prefix = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (prefix === "t" && /^\d+$/.test(value)) timestamp = Number(value);
    else if (prefix === "v1") signatures.push(value);
  }
  if (timestamp === null || signatures.length === 0) {
    throw new PaymentError("Assinatura da Stripe mal formada.", "invalid_signature");
  }

  const expected = Buffer.from(
    createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex"),
    "utf8",
  );
  const matches = signatures.some((sig) => {
    const given = Buffer.from(sig, "utf8");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!matches) throw new PaymentError("Assinatura da Stripe inválida.", "invalid_signature");

  if (Math.floor(now / 1000) - timestamp > SIGNATURE_TOLERANCE_S) {
    throw new PaymentError("Notificação da Stripe expirada (possível repetição).", "invalid_signature");
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

function enabledMethods(config: ProviderConfig): PaymentMethod[] {
  if (!credential(config.credentials, "secretKey")) return [];
  const methods: PaymentMethod[] = ["card"];
  if (config.settings.enableMbway === true) methods.push("mbway");
  if (config.settings.enableMultibanco === true) methods.push("multibanco");
  return methods;
}

async function retrieveSession(config: ProviderConfig, id: string): Promise<StripeSession> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) {
    throw new PaymentError("Referência de sessão Stripe inválida.", "invalid_reference");
  }
  return stripe<StripeSession>(config, `/checkout/sessions/${encodeURIComponent(id)}?expand%5B%5D=payment_intent`);
}

export const stripeProvider: PaymentProvider = {
  id: "stripe",
  name: "Stripe",
  docsUrl: "https://docs.stripe.com/payments/checkout",
  credentialFields: [
    {
      key: "secretKey",
      label: "Chave secreta",
      hint: "sk_… ou, de preferência, uma chave restrita rk_… com escrita em Checkout Sessions e Refunds.",
      secret: true,
      required: true,
    },
    {
      key: "publishableKey",
      label: "Chave publicável",
      hint: "pk_… — opcional; o checkout alojado não precisa dela.",
    },
    {
      key: "webhookSecret",
      label: "Segredo do webhook",
      hint: "whsec_… — no painel da Stripe, em Workbench → Webhooks. Sem ele os pagamentos não são confirmados automaticamente.",
      secret: true,
      required: true,
    },
  ],

  methods: enabledMethods,

  async test(config) {
    const balance = await stripe<{ object?: string; livemode?: boolean }>(config, "/balance");
    // Keys without a recognisable prefix (e.g. managed keys) are checked here instead.
    if (typeof balance.livemode === "boolean" && balance.livemode !== (config.mode === "live")) {
      throw new PaymentError(
        balance.livemode
          ? "A integração está em modo de teste, mas a chave da Stripe é de modo real."
          : "A integração está em modo real, mas a chave da Stripe é de teste.",
        "mode_mismatch",
      );
    }
    const mode = config.mode === "live" ? "modo real" : "modo teste";
    const webhook = credential(config.credentials, "webhookSecret");
    if (!webhook) {
      return `Ligação à Stripe válida (${mode}). Falta o segredo do webhook (whsec_…): sem ele os pagamentos não são confirmados automaticamente.`;
    }
    if (!webhook.startsWith("whsec_")) {
      return `Ligação à Stripe válida (${mode}). Atenção: o segredo do webhook devia começar por whsec_.`;
    }
    return `Ligação à Stripe válida (${mode}).`;
  },

  async start(config, req) {
    if (req.currency !== "EUR") {
      throw new PaymentError("Só são aceites pagamentos em euros.", "invalid_currency");
    }
    if (!enabledMethods(config).includes(req.method)) {
      throw new PaymentError(`O pagamento por ${METHOD_LABEL[req.method]} não está ativo na Stripe.`, "method_unavailable");
    }
    const type = STRIPE_METHOD[req.method];

    const session = await stripe<StripeSession>(config, "/checkout/sessions", {
      method: "POST",
      // Same paymentId → same session, so a double click or a retried request
      // never opens two checkouts for one payment. Stripe keeps keys 24 h.
      idempotencyKey: `checkout-${req.paymentId}`,
      body: {
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: toCents(req.amount),
              product_data: { name: req.description.slice(0, 250) || `Reserva ${req.bookingReference}` },
            },
          },
        ],
        allowed_payment_method_types: [type],
        client_reference_id: req.paymentId,
        metadata: { payment_id: req.paymentId, booking_reference: req.bookingReference },
        payment_intent_data: {
          metadata: { payment_id: req.paymentId, booking_reference: req.bookingReference },
        },
        customer_email: req.customer.email || undefined,
        locale: LOCALE[req.locale] ?? "auto",
        submit_type: "book",
        success_url: req.successUrl,
        cancel_url: req.cancelUrl,
        expires_at: clampExpiry(req.expiresAt),
      },
    });

    if (!session.url) {
      throw new PaymentError("A Stripe não devolveu o endereço do checkout.", "provider_error");
    }
    if (Array.isArray(session.payment_method_types) && !session.payment_method_types.includes(type)) {
      throw new PaymentError(
        `A Stripe não disponibilizou ${METHOD_LABEL[req.method]} para este pagamento. Ative-o no painel da Stripe (Definições → Métodos de pagamento).`,
        "method_unavailable",
      );
    }
    return {
      kind: "redirect",
      providerRef: session.id,
      url: session.url,
      expiresAt: typeof session.expires_at === "number" ? new Date(session.expires_at * 1000) : null,
      data: { livemode: session.livemode ?? null, paymentMethodTypes: session.payment_method_types ?? [] },
    };
  },

  async parseNotification(config, { rawBody, headers }) {
    verifyStripeSignature(
      rawBody,
      headers.get("stripe-signature"),
      credential(config.credentials, "webhookSecret"),
    );

    let event: { id?: string; type?: string; livemode?: boolean; data?: { object?: StripeSession } };
    try {
      event = JSON.parse(rawBody);
    } catch {
      throw new PaymentError("Notificação da Stripe ilegível.", "invalid_payload");
    }

    const toStatus = event.type ? EVENT_STATUS[event.type] : undefined;
    const session = event.data?.object;
    if (!toStatus || !session || session.object !== "checkout.session") return [];

    return [
      sessionEvent(session, toStatus(session), {
        eventId: event.id ?? null,
        type: event.type,
        livemode: event.livemode ?? null,
        session,
      }),
    ];
  },

  async fetchStatus(config, providerRef) {
    const session = await retrieveSession(config, providerRef);
    return sessionEvent(session, statusFromSession(session), { session });
  },

  async refund(config, { providerRef, amount, reason }): Promise<RefundResult> {
    const session = await retrieveSession(config, providerRef);
    const pi = session.payment_intent;
    const paymentIntentId = typeof pi === "string" ? pi : pi?.id;
    if (!paymentIntentId) {
      throw new PaymentError("Este pagamento ainda não tem cobrança na Stripe; não há nada a reembolsar.", "not_refundable");
    }

    const refund = await stripe<StripeRefund>(config, "/refunds", {
      method: "POST",
      body: {
        payment_intent: paymentIntentId,
        amount: toCents(amount),
        metadata: { reason: reason.slice(0, 500), checkout_session: session.id },
      },
    });

    const status: RefundResult["status"] =
      refund.status === "succeeded"
        ? "succeeded"
        : refund.status === "failed" || refund.status === "canceled"
          ? "failed"
          : "pending"; // pending, requires_action
    return { providerRef: refund.id, status };
  },
};
