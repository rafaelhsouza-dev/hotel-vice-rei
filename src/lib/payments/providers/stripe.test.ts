import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaymentError, type ProviderConfig, type StartPaymentRequest } from "../types";
import { toCents } from "./shared";
import { STRIPE_API_VERSION, clampExpiry, formEncode, stripeProvider, verifyStripeSignature } from "./stripe";

const SECRET = "whsec_test_secret";

function config(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    mode: "test",
    credentials: { secretKey: "sk_test_abc123", webhookSecret: SECRET },
    settings: { enableMbway: true, enableMultibanco: true },
    ...overrides,
  };
}

function request(overrides: Partial<StartPaymentRequest> = {}): StartPaymentRequest {
  return {
    paymentId: "pay_123",
    bookingReference: "VR-7F3K9Q",
    amount: 50.2,
    currency: "EUR",
    method: "card",
    description: "Reserva VR-7F3K9Q",
    customer: { name: "Ana Silva", email: "ana@example.com" },
    locale: "pt",
    successUrl: "https://hotel.test/ok",
    cancelUrl: "https://hotel.test/cancel",
    notifyUrl: "https://hotel.test/api/payments/stripe",
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    ...overrides,
  };
}

function mockFetch(body: unknown, status = 200) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

function sign(body: string, t = Math.floor(Date.now() / 1000), secret = SECRET) {
  const sig = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${sig},v0=deadbeef`;
}

function notification(body: string, signature: string | null) {
  const headers = new Headers();
  if (signature) headers.set("Stripe-Signature", signature);
  return { rawBody: body, headers, url: new URL("https://hotel.test/api/payments/stripe"), method: "POST" };
}

const session = (extra: Record<string, unknown> = {}) => ({
  id: "cs_test_1",
  object: "checkout.session",
  amount_total: 5020,
  client_reference_id: "pay_123",
  metadata: { payment_id: "pay_123", booking_reference: "VR-7F3K9Q" },
  payment_status: "paid",
  status: "complete",
  ...extra,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("toCents", () => {
  it("rounds floats to the cent a person would write", () => {
    expect(toCents(50.2)).toBe(5020);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(1.005)).toBe(101);
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(123.456)).toBe(12346);
  });

  it("rejects zero, negatives and NaN", () => {
    expect(() => toCents(0)).toThrow(PaymentError);
    expect(() => toCents(-5)).toThrow(PaymentError);
    expect(() => toCents(Number.NaN)).toThrow(PaymentError);
  });
});

describe("formEncode", () => {
  it("uses Stripe's bracket notation for nested objects and arrays", () => {
    const params = formEncode({ a: { b: [{ c: 1 }] }, skip: undefined, d: "x y" });
    expect(params.get("a[b][0][c]")).toBe("1");
    expect(params.get("d")).toBe("x y");
    expect(params.has("skip")).toBe(false);
  });
});

describe("clampExpiry", () => {
  const now = Date.UTC(2026, 9, 20, 12, 0, 0);
  it("pulls a too-early expiry up to 30 min + margin", () => {
    expect(clampExpiry(new Date(now + 60_000), now) - now / 1000).toBe(31 * 60);
  });
  it("caps a far expiry at just under 24 h", () => {
    expect(clampExpiry(new Date(now + 3 * 86_400_000), now) - now / 1000).toBe(86_400 - 60);
  });
  it("keeps an expiry inside the window", () => {
    expect(clampExpiry(new Date(now + 2 * 3_600_000), now) - now / 1000).toBe(7200);
  });
});

describe("methods", () => {
  it("offers card always, plus enabled Portuguese methods", () => {
    expect(stripeProvider.methods(config())).toEqual(["card", "mbway", "multibanco"]);
    expect(stripeProvider.methods(config({ settings: {} }))).toEqual(["card"]);
    expect(stripeProvider.methods(config({ credentials: {} }))).toEqual([]);
  });
});

describe("test()", () => {
  it("calls /v1/balance with the pinned version and reports the mode", async () => {
    const fetchMock = mockFetch({ object: "balance", livemode: false });
    await expect(stripeProvider.test(config())).resolves.toBe("Ligação à Stripe válida (modo teste).");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.stripe.com/v1/balance");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk_test_abc123");
    expect(headers["Stripe-Version"]).toBe(STRIPE_API_VERSION);
  });

  it("refuses a test key on a live integration before any request", async () => {
    const fetchMock = mockFetch({});
    await expect(stripeProvider.test(config({ mode: "live" }))).rejects.toMatchObject({ code: "mode_mismatch" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a live restricted key on a test integration", async () => {
    mockFetch({});
    await expect(
      stripeProvider.test(config({ credentials: { secretKey: "rk_live_x", webhookSecret: SECRET } })),
    ).rejects.toMatchObject({ code: "mode_mismatch" });
  });

  it("refuses a publishable key in the secret field", async () => {
    mockFetch({});
    await expect(
      stripeProvider.test(config({ credentials: { secretKey: "pk_test_x" } })),
    ).rejects.toMatchObject({ code: "invalid_credentials" });
  });

  it("warns when the webhook secret is missing", async () => {
    mockFetch({ object: "balance", livemode: false });
    const msg = await stripeProvider.test(config({ credentials: { secretKey: "sk_test_abc" } }));
    expect(msg).toContain("Falta o segredo do webhook");
  });

  it("wraps Stripe errors without leaking the key", async () => {
    mockFetch({ error: { message: "Invalid API Key provided: sk_test_****c123" } }, 401);
    const error = await stripeProvider.test(config()).catch((e: PaymentError) => e);
    expect(error).toBeInstanceOf(PaymentError);
    expect((error as PaymentError).message).not.toContain("sk_test");
  });

  it("scrubs keys from other Stripe error messages", async () => {
    mockFetch({ error: { message: "No such thing for sk_test_abc123", code: "resource_missing" } }, 400);
    const error = (await stripeProvider.test(config()).catch((e) => e)) as PaymentError;
    expect(error.message).not.toContain("sk_test_abc123");
    expect(error.code).toBe("resource_missing");
  });
});

describe("start()", () => {
  it("creates a Checkout Session with the documented fields", async () => {
    const fetchMock = mockFetch({
      id: "cs_test_1",
      object: "checkout.session",
      url: "https://checkout.stripe.com/c/pay/cs_test_1",
      expires_at: 1_800_000_000,
      payment_method_types: ["card"],
      livemode: false,
    });
    const req = request();
    const result = await stripeProvider.start(config(), req);

    expect(result).toMatchObject({
      kind: "redirect",
      providerRef: "cs_test_1",
      url: "https://checkout.stripe.com/c/pay/cs_test_1",
    });
    expect(result.expiresAt?.getTime()).toBe(1_800_000_000_000);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("checkout-pay_123");
    expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");

    const body = new URLSearchParams(String(init?.body));
    expect(body.get("mode")).toBe("payment");
    expect(body.get("line_items[0][price_data][currency]")).toBe("eur");
    expect(body.get("line_items[0][price_data][unit_amount]")).toBe("5020");
    expect(body.get("line_items[0][price_data][product_data][name]")).toBe("Reserva VR-7F3K9Q");
    expect(body.get("line_items[0][quantity]")).toBe("1");
    expect(body.get("allowed_payment_method_types[0]")).toBe("card");
    expect(body.has("payment_method_types[0]")).toBe(false); // removed in 2026-09-30.endive
    expect(body.get("client_reference_id")).toBe("pay_123");
    expect(body.get("metadata[payment_id]")).toBe("pay_123");
    expect(body.get("metadata[booking_reference]")).toBe("VR-7F3K9Q");
    expect(body.get("payment_intent_data[metadata][payment_id]")).toBe("pay_123");
    expect(body.get("customer_email")).toBe("ana@example.com");
    expect(body.get("locale")).toBe("pt");
    expect(body.get("success_url")).toBe("https://hotel.test/ok");
    expect(body.get("cancel_url")).toBe("https://hotel.test/cancel");
    expect(Number(body.get("expires_at"))).toBe(Math.floor(req.expiresAt.getTime() / 1000));
  });

  it("maps MB WAY and Multibanco to Stripe's type strings", async () => {
    for (const [method, type] of [
      ["mbway", "mb_way"],
      ["multibanco", "multibanco"],
    ] as const) {
      const fetchMock = mockFetch({ id: "cs_test_2", url: "https://x", payment_method_types: [type] });
      await stripeProvider.start(config(), request({ method }));
      const body = new URLSearchParams(String(fetchMock.mock.calls[0][1]?.body));
      expect(body.get("allowed_payment_method_types[0]")).toBe(type);
    }
  });

  it("fails loudly when Stripe filtered the method out", async () => {
    mockFetch({ id: "cs_test_3", url: "https://x", payment_method_types: ["card"] });
    await expect(stripeProvider.start(config(), request({ method: "mbway" }))).rejects.toMatchObject({
      code: "method_unavailable",
    });
  });

  it("refuses a method not enabled in settings", async () => {
    const fetchMock = mockFetch({});
    await expect(
      stripeProvider.start(config({ settings: {} }), request({ method: "multibanco" })),
    ).rejects.toMatchObject({ code: "method_unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("verifyStripeSignature / parseNotification", () => {
  const body = JSON.stringify({
    id: "evt_1",
    type: "checkout.session.completed",
    data: { object: session() },
  });

  it("accepts a correctly signed event", () => {
    expect(() => verifyStripeSignature(body, sign(body), SECRET)).not.toThrow();
  });

  it("accepts when any of several v1 signatures matches (rolled secret)", () => {
    const t = Math.floor(Date.now() / 1000);
    const good = createHmac("sha256", SECRET).update(`${t}.${body}`).digest("hex");
    expect(() => verifyStripeSignature(body, `t=${t},v1=${"0".repeat(64)},v1=${good}`, SECRET)).not.toThrow();
  });

  it("rejects a tampered body", () => {
    expect(() => verifyStripeSignature(body.replace("5020", "1"), sign(body), SECRET)).toThrow(
      expect.objectContaining({ code: "invalid_signature" }),
    );
  });

  it("rejects a signature made with another secret", () => {
    expect(() => verifyStripeSignature(body, sign(body, undefined, "whsec_other"), SECRET)).toThrow(PaymentError);
  });

  it("rejects timestamps older than 300 s", () => {
    const old = Math.floor(Date.now() / 1000) - 301;
    expect(() => verifyStripeSignature(body, sign(body, old), SECRET)).toThrow(
      expect.objectContaining({ code: "invalid_signature" }),
    );
  });

  it("ignores v0 signatures (downgrade protection)", () => {
    const t = Math.floor(Date.now() / 1000);
    const v0 = createHmac("sha256", SECRET).update(`${t}.${body}`).digest("hex");
    expect(() => verifyStripeSignature(body, `t=${t},v0=${v0}`, SECRET)).toThrow(PaymentError);
  });

  it("rejects a missing header or missing secret", async () => {
    await expect(stripeProvider.parseNotification(config(), notification(body, null))).rejects.toMatchObject({
      code: "invalid_signature",
    });
    await expect(
      stripeProvider.parseNotification(config({ credentials: { secretKey: "sk_test_x" } }), notification(body, sign(body))),
    ).rejects.toMatchObject({ code: "invalid_signature" });
  });

  const parse = async (type: string, obj: Record<string, unknown>) => {
    const raw = JSON.stringify({ id: "evt_x", type, data: { object: obj } });
    return stripeProvider.parseNotification(config(), notification(raw, sign(raw)));
  };

  it("maps a paid completed session to succeeded", async () => {
    const [event] = await parse("checkout.session.completed", session());
    expect(event).toMatchObject({ paymentId: "pay_123", providerRef: "cs_test_1", status: "succeeded", amount: 50.2 });
  });

  it("keeps an unpaid completed session (Multibanco voucher) pending", async () => {
    const [event] = await parse("checkout.session.completed", session({ payment_status: "unpaid" }));
    expect(event.status).toBe("pending");
  });

  it("maps async success, async failure and expiry", async () => {
    expect((await parse("checkout.session.async_payment_succeeded", session()))[0].status).toBe("succeeded");
    expect((await parse("checkout.session.async_payment_failed", session({ payment_status: "unpaid" })))[0].status).toBe("failed");
    expect((await parse("checkout.session.expired", session({ status: "expired", payment_status: "unpaid" })))[0].status).toBe("expired");
  });

  it("falls back to metadata.payment_id", async () => {
    const [event] = await parse("checkout.session.completed", session({ client_reference_id: null }));
    expect(event.paymentId).toBe("pay_123");
  });

  it("ignores unrelated event types", async () => {
    expect(await parse("payment_intent.succeeded", { id: "pi_1", object: "payment_intent" })).toEqual([]);
  });
});

describe("fetchStatus()", () => {
  it("reads the session with the PaymentIntent expanded", async () => {
    const fetchMock = mockFetch(session({ payment_status: "unpaid", payment_intent: { id: "pi_1", status: "requires_payment_method" } }));
    const event = await stripeProvider.fetchStatus!(config(), "cs_test_1");
    expect(event?.status).toBe("failed");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.stripe.com/v1/checkout/sessions/cs_test_1?expand%5B%5D=payment_intent");
  });

  it("reports an open session as pending and an expired one as expired", async () => {
    mockFetch(session({ status: "open", payment_status: "unpaid" }));
    expect((await stripeProvider.fetchStatus!(config(), "cs_test_1"))?.status).toBe("pending");
    mockFetch(session({ status: "expired", payment_status: "unpaid" }));
    expect((await stripeProvider.fetchStatus!(config(), "cs_test_1"))?.status).toBe("expired");
  });

  it("rejects a malformed reference without calling Stripe", async () => {
    const fetchMock = mockFetch({});
    await expect(stripeProvider.fetchStatus!(config(), "../balance")).rejects.toMatchObject({ code: "invalid_reference" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("refund()", () => {
  it("refunds the session's PaymentIntent in cents", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("/checkout/sessions/")
        ? Response.json(session({ payment_intent: { id: "pi_9", status: "succeeded" } }))
        : Response.json({ id: "re_1", status: "pending" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await stripeProvider.refund!(config(), { providerRef: "cs_test_1", amount: 0.1 + 0.2, reason: "Cancelamento" });
    expect(result).toEqual({ providerRef: "re_1", status: "pending" });

    const [url, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.stripe.com/v1/refunds");
    const body = new URLSearchParams(String(init.body));
    expect(body.get("payment_intent")).toBe("pi_9");
    expect(body.get("amount")).toBe("30");
    expect(body.get("metadata[reason]")).toBe("Cancelamento");
  });

  it("refuses when there is no PaymentIntent yet", async () => {
    mockFetch(session({ payment_intent: null }));
    await expect(
      stripeProvider.refund!(config(), { providerRef: "cs_test_1", amount: 10, reason: "x" }),
    ).rejects.toMatchObject({ code: "not_refundable" });
  });
});
