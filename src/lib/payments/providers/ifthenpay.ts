import {
  PaymentError,
  type PaymentEvent,
  type PaymentMethod,
  type PaymentProvider,
  type ProviderConfig,
  type StartPaymentRequest,
} from "../types";
import { TIMEOUT_MS, credential, parseEuros, safeEqual, toEuroString } from "./shared";

/**
 * ifthenpay — Multibanco references and MB WAY, the two methods Portuguese
 * guests actually reach for, at a fraction of card fees.
 *
 * Both flows return a `RequestId`, and ifthenpay's callback echoes it back
 * through the `[REQUEST_ID]` placeholder, so the RequestId is our
 * `providerRef` for both methods; the service matches callbacks by it.
 *
 * Callbacks are not signed. ifthenpay calls a URL template that is configured
 * once on their side (by their support, or the callback activation API with
 * the backoffice key) and proves itself only with the anti-phishing key we
 * chose, substituted into `[ANTI_PHISHING_KEY]`. The template this adapter
 * expects, for both Multibanco and MB WAY:
 *
 *   {notifyUrl}?key=[ANTI_PHISHING_KEY]&orderId=[ORDER_ID]&amount=[AMOUNT]
 *     &requestId=[REQUEST_ID]&entity=[ENTITY]&reference=[REFERENCE]
 *     &payment_datetime=[PAYMENT_DATETIME]
 *
 * (entity/reference are only filled for Multibanco). A callback only ever
 * means "paid"; ifthenpay retries it up to 13 times until it gets HTTP 200.
 *
 * MB WAY can additionally POST the final state (paid, declined, expired) to
 * the `notificationUrl` sent with each request. Its signature covers
 * orderId + amount + requestId but *not* the status, and the body carries
 * neither orderId nor amount — so we do not trust its body at all: we take the
 * RequestId from it and ask the status endpoint, with our own key, what
 * actually happened.
 *
 * Multibanco has a sandbox endpoint (used in test mode); MB WAY has none — in
 * test mode it is called with whatever key ifthenpay issued for testing.
 *
 * @see https://ifthenpay.com/docs/en/api/mbway/openapi.yaml (MB WAY REST v2)
 * @see https://ifthenpay.com/docs/en/api/multibanco/openapi.yaml (Multibanco REST)
 * @see https://ifthenpay.com/docs/en/guides/callback/ (callback + notification formats)
 * @see https://ifthenpay.com/docs/en/api/refund/openapi.yaml (refunds: MB WAY and cards only)
 */

const API = "https://api.ifthenpay.com";
/** The guest has 4 minutes to approve in the MB WAY app before ifthenpay expires the request. */
export const MBWAY_WINDOW_MS = 4 * 60 * 1000;
/** ifthenpay's limit for the MB WAY orderId (Multibanco allows 25; we stay under both). */
const ORDER_ID_MAX = 15;
const LISBON = "Europe/Lisbon";

type MbwayPaymentResponse = {
  Amount?: number | string;
  Message?: string;
  OrderId?: string;
  orderId?: string;
  RequestId?: string;
  Status?: string;
};

type MbwayStatusResponse = {
  CreatedAt?: string;
  UpdateAt?: string;
  Message?: string;
  RequestId?: string;
  Status?: string;
};

type MultibancoResponse = {
  Amount?: string;
  Entity?: string;
  ExpiryDate?: string;
  Message?: string;
  OrderId?: string;
  Reference?: string;
  RequestId?: string;
  Status?: string;
};

type RefundResponse = { Code?: number | string; Message?: string };

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

async function call<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  }).catch((error: unknown) => {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new PaymentError(
      timedOut ? "A ifthenpay não respondeu a tempo. Tente novamente." : "Não foi possível contactar a ifthenpay.",
      "network_error",
    );
  });

  const text = await response.text().catch(() => "");
  let payload: unknown = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { Message: text.slice(0, 200) };
  }
  if (!response.ok) {
    const message = (payload as { Message?: string }).Message;
    throw new PaymentError(
      `A ifthenpay respondeu ${response.status}${message ? `: ${message}` : "."}`,
      response.status === 429 ? "rate_limited" : "provider_error",
    );
  }
  return payload as T;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Portuguese mobile → "351#9XXXXXXXX", the format ifthenpay documents.
 * Accepts spaces, dots, dashes, brackets and a +351 / 00351 / 351 prefix.
 * Only Portuguese mobiles (91, 92, 93, 96) are accepted: MB WAY accounts are
 * tied to them, and a landline would only fail later in the guest's face.
 */
export function normaliseMbwayPhone(input: string | undefined): string {
  let digits = (input ?? "").trim().replace(/[\s.\-()/]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("351#")) digits = digits.slice(4);
  else if (digits.length === 12 && digits.startsWith("351")) digits = digits.slice(3);
  if (!/^9[1236]\d{7}$/.test(digits)) {
    throw new PaymentError("Número MB WAY inválido.", "invalid_phone");
  }
  return `351#${digits}`;
}

/**
 * A short orderId within ifthenpay's 15 characters: the booking code without
 * "VR-" plus the tail of our payment id, e.g. "7F3K9Q-A1B2C3". The suffix keeps
 * every attempt on the same booking distinct; the full paymentId travels in
 * `data`.
 */
export function orderIdFor(req: Pick<StartPaymentRequest, "bookingReference" | "paymentId">): string {
  const suffix = req.paymentId.replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase();
  const booking = req.bookingReference.replace(/^VR-/i, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const room = ORDER_ID_MAX - suffix.length - 1;
  return booking ? `${booking.slice(0, room)}-${suffix}` : suffix;
}

/** "YYYY-MM-DD" of an instant, on Lisbon's calendar. */
function lisbonDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: LISBON, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Lisbon's UTC offset in minutes at a given instant (0 in winter, 60 in summer). */
function lisbonOffsetMinutes(date: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: LISBON, timeZoneName: "longOffset" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = name?.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/**
 * ifthenpay's `expiryDays`: references always lapse at 23:59 Lisbon time, N
 * days from today (0 = tonight). We round *down* so the reference dies before
 * our hold does — a guest paying a reference after the booking was released
 * would leave money with no room behind it. Above 31 ifthenpay jumps to 45,
 * 60…, so we cap at 31.
 */
export function expiryDaysFor(expiresAt: Date, now = new Date()): number {
  const day = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  const diff = Math.round((day(lisbonDate(expiresAt)) - day(lisbonDate(now))) / 86_400_000);
  return Math.min(Math.max(diff - 1, 0), 31);
}

/** "30-10-2021" (dd-MM-yyyy, as ifthenpay returns it) → 23:59:59 that day in Lisbon. */
export function parseExpiryDate(value: string | undefined): Date | null {
  const m = value?.trim().match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (!m) return null;
  const asUtc = Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 23, 59, 59);
  return new Date(asUtc - lisbonOffsetMinutes(new Date(asUtc)) * 60_000);
}

function mbwayStatus(code: string | undefined): PaymentEvent["status"] | null {
  switch (code) {
    case "000":
      return "succeeded";
    case "020": // rejected by the user
    case "122": // declined to the user
      return "failed";
    case "101": // not approved within 4 minutes
      return "expired";
    default:
      return null;
  }
}

function antiPhishingKey(config: ProviderConfig): string {
  return credential(config.credentials, "antiPhishingKey");
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

function enabledMethods(config: ProviderConfig): PaymentMethod[] {
  const methods: PaymentMethod[] = [];
  if (credential(config.credentials, "mbKey")) methods.push("multibanco");
  if (credential(config.credentials, "mbwayKey")) methods.push("mbway");
  return methods;
}

async function fetchMbwayStatus(config: ProviderConfig, requestId: string): Promise<PaymentEvent | null> {
  const mbwayKey = credential(config.credentials, "mbwayKey");
  if (!mbwayKey || !requestId) return null;
  const query = new URLSearchParams({ mbWayKey: mbwayKey, requestId });
  const res = await call<MbwayStatusResponse>(`/spg/payment/mbway/status?${query}`);
  // Anything not echoing our RequestId (a Multibanco id, an unknown id) tells us nothing.
  if (!res.RequestId || res.RequestId !== requestId) return null;
  return {
    paymentId: null,
    providerRef: requestId,
    // Codes outside the documented four mean the guest has not answered yet.
    status: mbwayStatus(res.Status) ?? "pending",
    amount: null,
    raw: { ...res, method: "mbway", source: "status" },
  };
}

export const ifthenpayProvider: PaymentProvider = {
  id: "ifthenpay",
  name: "ifthenpay",
  docsUrl: "https://ifthenpay.com/docs/en/",
  credentialFields: [
    { key: "mbKey", label: "Chave Multibanco", hint: "MB KEY atribuída pela ifthenpay, p. ex. ABC-123456.", secret: true },
    { key: "mbwayKey", label: "Chave MB WAY", hint: "MB WAY KEY atribuída pela ifthenpay, p. ex. ABC-123456.", secret: true },
    {
      key: "antiPhishingKey",
      label: "Chave anti-phishing",
      hint: "A chave que comunicou à ifthenpay para o callback (máx. 50 caracteres). Sem ela nenhum pagamento é confirmado.",
      secret: true,
      required: true,
    },
    {
      key: "backofficeKey",
      label: "Chave de backoffice",
      hint: "Opcional — só necessária para reembolsos MB WAY.",
      secret: true,
    },
  ],

  methods: enabledMethods,

  async test(config) {
    const mbKey = credential(config.credentials, "mbKey");
    const mbwayKey = credential(config.credentials, "mbwayKey");
    const apKey = antiPhishingKey(config);
    if (!mbKey && !mbwayKey) {
      throw new PaymentError("Indique pelo menos a chave Multibanco ou a chave MB WAY.", "not_configured");
    }
    if (!apKey) throw new PaymentError("Falta a chave anti-phishing do callback.", "not_configured");
    if (apKey.length > 50) {
      throw new PaymentError("A chave anti-phishing não pode ter mais de 50 caracteres.", "invalid_credentials");
    }

    const lines: string[] = [];
    const looksLikeKey = (k: string) => /^[A-Z]{3}-\d{6}$/i.test(k);

    if (mbKey) {
      // Read-only listing of today's references: the most harmless call that takes the key.
      const today = lisbonDate(new Date());
      const list = await call<unknown>("/multibanco/reference/list", {
        method: "POST",
        body: { mbKey, fromDate: today, toDate: today },
      });
      if (Array.isArray(list)) {
        lines.push("Multibanco: a ifthenpay aceitou a chave (listagem de referências de hoje respondeu).");
      } else {
        const msg = (list as { Message?: string }).Message;
        lines.push(
          `Multibanco: a ifthenpay respondeu sem confirmar a chave${msg ? ` («${msg}»)` : ""}${looksLikeKey(mbKey) ? "" : "; o formato também não é o habitual (ABC-123456)"}.`,
        );
      }
    }

    if (mbwayKey) {
      // There is no credential check that does not create a payment, so the
      // status endpoint only proves the service is reachable.
      await call<unknown>(`/spg/payment/mbway/status?${new URLSearchParams({ mbWayKey: mbwayKey, requestId: "verificacao" })}`);
      lines.push(
        looksLikeKey(mbwayKey)
          ? "MB WAY: serviço contactável e formato da chave válido; a ifthenpay não tem verificação de credenciais sem criar um pagamento, por isso a chave só fica confirmada no primeiro pedido."
          : "MB WAY: serviço contactável, mas a chave não tem o formato habitual (ABC-123456); confirme-a com a ifthenpay.",
      );
    }

    lines.push("O callback só funciona depois de a ifthenpay o ativar para o endereço de notificação do site.");
    return lines.join(" ");
  },

  async start(config, req) {
    if (req.currency !== "EUR") {
      throw new PaymentError("Só são aceites pagamentos em euros.", "invalid_currency");
    }
    const orderId = orderIdFor(req);
    const amount = toEuroString(req.amount);

    if (req.method === "multibanco") {
      const mbKey = credential(config.credentials, "mbKey");
      if (!mbKey) throw new PaymentError("O Multibanco não está configurado na ifthenpay.", "method_unavailable");
      if (Number(amount) > 99_999.99) {
        throw new PaymentError("Montante acima do limite de uma referência Multibanco (99 999,99 €).", "invalid_amount");
      }
      const endpoint = config.mode === "live" ? "init" : "sandbox";
      const res = await call<MultibancoResponse>(`/multibanco/reference/${endpoint}`, {
        method: "POST",
        body: {
          mbKey,
          orderId,
          amount,
          description: req.description.slice(0, 200),
          clientName: req.customer.name.slice(0, 200),
          clientEmail: req.customer.email.slice(0, 200),
          ...(req.customer.phone ? { clientPhone: req.customer.phone.slice(0, 200) } : {}),
          expiryDays: expiryDaysFor(req.expiresAt),
        },
      });
      if (String(res.Status ?? "") !== "0" || !res.Entity || !res.Reference || !res.RequestId) {
        throw new PaymentError(
          `A ifthenpay não gerou a referência Multibanco${res.Message ? `: ${res.Message}` : "."}`,
          "provider_error",
        );
      }
      return {
        kind: "multibanco",
        providerRef: res.RequestId,
        entity: res.Entity,
        reference: res.Reference,
        expiresAt: parseExpiryDate(res.ExpiryDate),
        data: {
          method: "multibanco",
          paymentId: req.paymentId,
          orderId,
          requestId: res.RequestId,
          entity: res.Entity,
          reference: res.Reference,
          amount,
          sandbox: endpoint === "sandbox",
        },
      };
    }

    if (req.method === "mbway") {
      const mbWayKey = credential(config.credentials, "mbwayKey");
      if (!mbWayKey) throw new PaymentError("O MB WAY não está configurado na ifthenpay.", "method_unavailable");
      const mobileNumber = normaliseMbwayPhone(req.customer.phone);
      const notificationUrl =
        req.notifyUrl.startsWith("https://") && req.notifyUrl.length <= 500 ? req.notifyUrl : undefined;

      const res = await call<MbwayPaymentResponse>("/spg/payment/mbway", {
        method: "POST",
        body: {
          mbWayKey,
          orderId,
          amount,
          mobileNumber,
          email: req.customer.email.slice(0, 100),
          description: req.description.slice(0, 100),
          ...(notificationUrl ? { notificationUrl } : {}),
        },
      });
      if (res.Status !== "000" || !res.RequestId) {
        throw new PaymentError(
          res.Status === "122"
            ? "O MB WAY recusou o pedido para este número. Confirme que o número tem MB WAY ativo."
            : `A ifthenpay não iniciou o pedido MB WAY${res.Message ? `: ${res.Message}` : "."}`,
          res.Status === "122" ? "declined" : "provider_error",
        );
      }
      return {
        kind: "mbway",
        providerRef: res.RequestId,
        expiresAt: new Date(Date.now() + MBWAY_WINDOW_MS),
        data: { method: "mbway", paymentId: req.paymentId, orderId, requestId: res.RequestId, amount },
      };
    }

    throw new PaymentError("A ifthenpay não processa pagamentos por cartão nesta integração.", "method_unavailable");
  },

  async parseNotification(config, { rawBody, url, method }) {
    // MB WAY notificationUrl: a POST with a JSON body — confirmed via the status API.
    if (method.toUpperCase() === "POST" && rawBody.trim().startsWith("{")) {
      let body: { RequestId?: unknown };
      try {
        body = JSON.parse(rawBody);
      } catch {
        throw new PaymentError("Notificação MB WAY ilegível.", "invalid_payload");
      }
      const requestId = typeof body.RequestId === "string" ? body.RequestId.trim() : "";
      if (!requestId || !/^[A-Za-z0-9]{1,64}$/.test(requestId)) {
        throw new PaymentError("Notificação MB WAY sem RequestId válido.", "invalid_payload");
      }
      if (!credential(config.credentials, "mbwayKey")) {
        throw new PaymentError("Notificação MB WAY recebida sem MB WAY configurado.", "invalid_signature");
      }
      const event = await fetchMbwayStatus(config, requestId);
      return event ? [{ ...event, raw: { ...event.raw, source: "notification" } }] : [];
    }

    // Callback: a GET whose only proof of origin is the anti-phishing key.
    const expected = antiPhishingKey(config);
    const params = url.searchParams;
    const given = params.get("key") ?? params.get("anti_phishing_key") ?? "";
    if (!expected || !given || !safeEqual(given, expected)) {
      throw new PaymentError("Chave anti-phishing inválida.", "invalid_signature");
    }

    const requestId = (params.get("requestId") ?? "").trim();
    if (!requestId) {
      throw new PaymentError(
        "Callback da ifthenpay sem requestId. Confirme que o URL configurado inclui requestId=[REQUEST_ID].",
        "invalid_payload",
      );
    }
    const entity = params.get("entity") ?? "";
    const reference = params.get("reference") ?? "";

    const raw: Record<string, unknown> = {};
    params.forEach((value, name) => {
      if (name !== "key" && name !== "anti_phishing_key") raw[name] = value; // never persist the secret
    });
    raw.method = entity || reference ? "multibanco" : "mbway";
    raw.source = "callback";

    return [
      {
        paymentId: null,
        providerRef: requestId,
        status: "succeeded",
        amount: parseEuros(params.get("amount")),
        raw,
      },
    ];
  },

  async fetchStatus(config, providerRef) {
    // Only MB WAY has a status endpoint keyed by RequestId; Multibanco ids come back as null.
    return fetchMbwayStatus(config, providerRef);
  },

  async refund(config, { providerRef, amount }) {
    const backofficekey = credential(config.credentials, "backofficeKey");
    if (!backofficekey) {
      throw new PaymentError("Os reembolsos pela ifthenpay exigem a chave de backoffice.", "not_configured");
    }
    const res = await call<RefundResponse>("/v2/payments/refund", {
      method: "POST",
      body: { backofficekey, requestId: providerRef, amount: toEuroString(amount) },
    });
    const code = Number(res.Code);
    if (code === 1) return { providerRef, status: "succeeded" };
    if (code === -1) {
      throw new PaymentError(
        "A ifthenpay não tem saldo suficiente para o reembolso (só conta o que ainda não foi transferido para o hotel). Tente mais tarde ou reembolse por transferência.",
        "insufficient_funds",
      );
    }
    throw new PaymentError(
      `A ifthenpay não fez o reembolso${res.Message ? `: ${res.Message}` : "."} Só pagamentos MB WAY podem ser reembolsados por esta via.`,
      "refund_failed",
    );
  },
};
