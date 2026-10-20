import { afterEach, describe, expect, it, vi } from "vitest";
import { PaymentError, type ProviderConfig, type StartPaymentRequest } from "../types";
import { toEuroString } from "./shared";
import {
  expiryDaysFor,
  ifthenpayProvider,
  normaliseMbwayPhone,
  orderIdFor,
  parseExpiryDate,
} from "./ifthenpay";

function config(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    mode: "live",
    credentials: { mbKey: "ABC-123456", mbwayKey: "DEF-654321", antiPhishingKey: "segredo-anti-phishing" },
    settings: {},
    ...overrides,
  };
}

function request(overrides: Partial<StartPaymentRequest> = {}): StartPaymentRequest {
  return {
    paymentId: "0b6f3c1e-9a7d-4c2b-8e1f-3a5b7c9d1e2f",
    bookingReference: "VR-7F3K9Q",
    amount: 50.2,
    currency: "EUR",
    method: "multibanco",
    description: "Reserva VR-7F3K9Q",
    customer: { name: "Ana Silva", email: "ana@example.com", phone: "+351 912 345 678" },
    locale: "pt",
    successUrl: "https://hotel.test/ok",
    cancelUrl: "https://hotel.test/cancel",
    notifyUrl: "https://hotel.test/api/payments/ifthenpay",
    expiresAt: new Date(Date.now() + 3 * 86_400_000),
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

const callback = (query: string, method = "GET", rawBody = "") => ({
  rawBody,
  headers: new Headers(),
  url: new URL(`https://hotel.test/api/payments/ifthenpay?${query}`),
  method,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("normaliseMbwayPhone", () => {
  it.each([
    ["912345678", "351#912345678"],
    ["912 345 678", "351#912345678"],
    ["+351 912 345 678", "351#912345678"],
    ["+351912345678", "351#912345678"],
    ["00351 93 123 4567", "351#931234567"],
    ["351962345678", "351#962345678"],
    ["351#922345678", "351#922345678"],
    ["91-234-5678", "351#912345678"],
  ])("%s → %s", (input, expected) => {
    expect(normaliseMbwayPhone(input)).toBe(expected);
  });

  it.each(["", undefined, "212345678", "+34 612345678", "9123456", "9123456789", "951234567", "abc"])(
    "rejects %s",
    (input) => {
      expect(() => normaliseMbwayPhone(input)).toThrow(expect.objectContaining({ code: "invalid_phone", message: "Número MB WAY inválido." }));
    },
  );
});

describe("orderIdFor", () => {
  it("stays within 15 characters and keeps attempts distinct", () => {
    const a = orderIdFor({ bookingReference: "VR-7F3K9Q", paymentId: "0b6f3c1e-9a7d-4c2b-8e1f-3a5b7c9d1e2f" });
    const b = orderIdFor({ bookingReference: "VR-7F3K9Q", paymentId: "0b6f3c1e-9a7d-4c2b-8e1f-3a5b7c9d1aaa" });
    expect(a).toBe("7F3K9Q-9D1E2F");
    expect(a).not.toBe(b);
    expect(orderIdFor({ bookingReference: "VR-AVERYLONGREFERENCE", paymentId: "x".repeat(40) }).length).toBeLessThanOrEqual(15);
  });
});

describe("amount formatting", () => {
  it("always two decimals with a dot", () => {
    expect(toEuroString(50.2)).toBe("50.20");
    expect(toEuroString(0.1 + 0.2)).toBe("0.30");
    expect(toEuroString(1.005)).toBe("1.01");
    expect(toEuroString(1234)).toBe("1234.00");
  });
});

describe("Multibanco expiry", () => {
  it("rounds down to the last full Lisbon day before our hold ends", () => {
    const now = new Date("2026-10-20T10:00:00Z");
    expect(expiryDaysFor(new Date("2026-10-23T09:00:00Z"), now)).toBe(2);
    expect(expiryDaysFor(new Date("2026-10-20T18:00:00Z"), now)).toBe(0);
    expect(expiryDaysFor(new Date("2027-03-01T00:00:00Z"), now)).toBe(31);
  });

  it("parses dd-MM-yyyy at 23:59:59 Lisbon time", () => {
    expect(parseExpiryDate("30-10-2026")?.toISOString()).toBe("2026-10-30T23:59:59.000Z"); // WET, UTC+0
    expect(parseExpiryDate("15-07-2026")?.toISOString()).toBe("2026-07-15T22:59:59.000Z"); // WEST, UTC+1
    expect(parseExpiryDate("")).toBeNull();
  });
});

describe("methods", () => {
  it("lists only methods with a key; never card", () => {
    expect(ifthenpayProvider.methods(config())).toEqual(["multibanco", "mbway"]);
    expect(ifthenpayProvider.methods(config({ credentials: { mbwayKey: "X" } }))).toEqual(["mbway"]);
  });
});

describe("start() Multibanco", () => {
  it("requests a reference with the documented fields", async () => {
    const fetchMock = mockFetch({
      Amount: "50.20",
      Entity: "11990",
      ExpiryDate: "22-10-2026",
      Message: "Success",
      OrderId: "7F3K9Q-9D1E2F",
      Reference: "000000291",
      RequestId: "5Qd8gtWLAEUJ6n0lkS5g",
      Status: "0",
    });
    const result = await ifthenpayProvider.start(config(), request());
    expect(result).toMatchObject({
      kind: "multibanco",
      providerRef: "5Qd8gtWLAEUJ6n0lkS5g",
      entity: "11990",
      reference: "000000291",
    });
    expect(result.data).toMatchObject({ paymentId: "0b6f3c1e-9a7d-4c2b-8e1f-3a5b7c9d1e2f", orderId: "7F3K9Q-9D1E2F" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.ifthenpay.com/multibanco/reference/init");
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ mbKey: "ABC-123456", orderId: "7F3K9Q-9D1E2F", amount: "50.20", clientEmail: "ana@example.com" });
    expect(typeof body.expiryDays).toBe("number");
  });

  it("uses the sandbox endpoint in test mode", async () => {
    const fetchMock = mockFetch({ Status: "0", Entity: "1", Reference: "2", RequestId: "r" });
    await ifthenpayProvider.start(config({ mode: "test" }), request());
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.ifthenpay.com/multibanco/reference/sandbox");
  });

  it("surfaces ifthenpay's message on failure", async () => {
    mockFetch({ Status: "-1", Message: "Chave inválida" });
    await expect(ifthenpayProvider.start(config(), request())).rejects.toThrow(/Chave inválida/);
  });
});

describe("start() MB WAY", () => {
  it("normalises the phone and returns the RequestId", async () => {
    const fetchMock = mockFetch({ Amount: 50.2, Message: "Pending", OrderId: "x", RequestId: "i2szvoUfPYBMWdSxqO3n", Status: "000" });
    const result = await ifthenpayProvider.start(config(), request({ method: "mbway" }));
    expect(result).toMatchObject({ kind: "mbway", providerRef: "i2szvoUfPYBMWdSxqO3n" });
    expect(result.data).toMatchObject({ requestId: "i2szvoUfPYBMWdSxqO3n", orderId: "7F3K9Q-9D1E2F" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.ifthenpay.com/spg/payment/mbway");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      mbWayKey: "DEF-654321",
      orderId: "7F3K9Q-9D1E2F",
      amount: "50.20",
      mobileNumber: "351#912345678",
      notificationUrl: "https://hotel.test/api/payments/ifthenpay",
    });
  });

  it("refuses an invalid phone before calling ifthenpay", async () => {
    const fetchMock = mockFetch({});
    await expect(
      ifthenpayProvider.start(config(), request({ method: "mbway", customer: { name: "A", email: "a@b.c", phone: "21 000 0000" } })),
    ).rejects.toMatchObject({ code: "invalid_phone" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps status 122 to a declined error", async () => {
    mockFetch({ Status: "122", Message: "Declined" });
    await expect(ifthenpayProvider.start(config(), request({ method: "mbway" }))).rejects.toMatchObject({ code: "declined" });
  });

  it("refuses card", async () => {
    await expect(ifthenpayProvider.start(config(), request({ method: "card" }))).rejects.toBeInstanceOf(PaymentError);
  });
});

describe("parseNotification() callback", () => {
  const good =
    "key=segredo-anti-phishing&orderId=7F3K9Q-9D1E2F&amount=50.20&requestId=5Qd8gtWLAEUJ6n0lkS5g&entity=11990&reference=000000291&payment_datetime=22-10-2026%2010:55:21";

  it("accepts a callback with the right anti-phishing key", async () => {
    const [event] = await ifthenpayProvider.parseNotification(config(), callback(good));
    expect(event).toMatchObject({ paymentId: null, providerRef: "5Qd8gtWLAEUJ6n0lkS5g", status: "succeeded", amount: 50.2 });
    expect(event.raw).toMatchObject({ method: "multibanco", reference: "000000291" });
    expect(JSON.stringify(event.raw)).not.toContain("segredo-anti-phishing");
  });

  it("marks a callback without entity/reference as MB WAY", async () => {
    const [event] = await ifthenpayProvider.parseNotification(
      config(),
      callback("key=segredo-anti-phishing&orderId=1&amount=33.61&requestId=i2szvoUfPYBMWdSxqO3n"),
    );
    expect(event.raw.method).toBe("mbway");
    expect(event.amount).toBe(33.61);
  });

  it("rejects a wrong, missing or unconfigured anti-phishing key", async () => {
    await expect(
      ifthenpayProvider.parseNotification(config(), callback(good.replace("segredo-anti-phishing", "errado"))),
    ).rejects.toMatchObject({ code: "invalid_signature" });
    await expect(
      ifthenpayProvider.parseNotification(config(), callback(good.replace("key=segredo-anti-phishing&", ""))),
    ).rejects.toMatchObject({ code: "invalid_signature" });
    await expect(
      ifthenpayProvider.parseNotification(config({ credentials: { mbKey: "ABC-123456" } }), callback(good)),
    ).rejects.toMatchObject({ code: "invalid_signature" });
  });

  it("rejects a callback without requestId", async () => {
    await expect(
      ifthenpayProvider.parseNotification(config(), callback("key=segredo-anti-phishing&amount=1.00")),
    ).rejects.toMatchObject({ code: "invalid_payload" });
  });
});

describe("parseNotification() MB WAY notificationUrl", () => {
  it("ignores the posted status and asks the status API", async () => {
    const fetchMock = mockFetch({ RequestId: "9iCipyBZ2crhtL4QH8Yv", Status: "020", Message: "Declined by user" });
    const body = JSON.stringify({ RequestId: "9iCipyBZ2crhtL4QH8Yv", Status: "000", Message: "Forged" });
    const [event] = await ifthenpayProvider.parseNotification(config(), callback("", "POST", body));
    expect(event).toMatchObject({ providerRef: "9iCipyBZ2crhtL4QH8Yv", status: "failed" });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.ifthenpay.com/spg/payment/mbway/status?mbWayKey=DEF-654321&requestId=9iCipyBZ2crhtL4QH8Yv",
    );
  });
});

describe("fetchStatus()", () => {
  it.each([
    ["000", "succeeded"],
    ["020", "failed"],
    ["122", "failed"],
    ["101", "expired"],
    ["123", "pending"],
  ])("maps status %s to %s", async (code, status) => {
    mockFetch({ RequestId: "abc", Status: code });
    expect((await ifthenpayProvider.fetchStatus!(config(), "abc"))?.status).toBe(status);
  });

  it("returns null when ifthenpay does not know the request", async () => {
    mockFetch({ Message: "Not found" });
    expect(await ifthenpayProvider.fetchStatus!(config(), "abc")).toBeNull();
  });
});

describe("refund()", () => {
  it("needs the backoffice key", async () => {
    await expect(ifthenpayProvider.refund!(config(), { providerRef: "r", amount: 10, reason: "x" })).rejects.toMatchObject({
      code: "not_configured",
    });
  });

  it("posts requestId and amount; Code 1 is success", async () => {
    const fetchMock = mockFetch({ Code: 1, Message: "Successful refunded" });
    const cfg = config({ credentials: { ...config().credentials, backofficeKey: "1111-2222-3333-4444" } });
    await expect(ifthenpayProvider.refund!(cfg, { providerRef: "r1", amount: 11.55, reason: "x" })).resolves.toEqual({
      providerRef: "r1",
      status: "succeeded",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.ifthenpay.com/v2/payments/refund");
    expect(JSON.parse(String(init?.body))).toEqual({ backofficekey: "1111-2222-3333-4444", requestId: "r1", amount: "11.55" });
  });

  it("explains insufficient funds", async () => {
    mockFetch({ Code: -1, Message: "Insufficient funds" });
    const cfg = config({ credentials: { ...config().credentials, backofficeKey: "k" } });
    await expect(ifthenpayProvider.refund!(cfg, { providerRef: "r1", amount: 5, reason: "x" })).rejects.toMatchObject({
      code: "insufficient_funds",
    });
  });
});

describe("test()", () => {
  it("is honest about what each check proved", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("/multibanco/reference/list") ? Response.json([]) : Response.json({ Message: "Not found" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const msg = await ifthenpayProvider.test(config());
    expect(msg).toContain("Multibanco: a ifthenpay aceitou a chave");
    expect(msg).toContain("MB WAY: serviço contactável");
    expect(msg).toContain("só fica confirmada no primeiro pedido");
  });

  it("requires the anti-phishing key", async () => {
    await expect(ifthenpayProvider.test(config({ credentials: { mbKey: "ABC-123456" } }))).rejects.toMatchObject({
      code: "not_configured",
    });
  });
});
