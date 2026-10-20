import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvoiceError, type InvoiceConfig, type InvoiceRequest } from "../types";
import { moloniProvider, pickMoloniTax, pickPaymentMethod, resetMoloniTokens } from "./moloni";
import { round2 } from "./shared";

const config: InvoiceConfig = {
  mode: "live",
  credentials: {
    clientId: "dev-id",
    clientSecret: "CLIENT-SECRET-XYZ",
    username: "hotel@example.pt",
    password: "PASS-WORD-999",
    companyId: "5",
    documentSetId: "42",
  },
  settings: { products: { "6": 101, "13": 113, "23": 123, "0": 100 } },
};

const req: InvoiceRequest = {
  reference: "VR-2026-0042",
  date: "2026-10-18",
  customer: { name: "Ana Silva", vat: "123456789", country: "PT", postalCode: "4000-001", city: "Porto" },
  lines: [
    { description: "Alojamento", quantity: 3, unitPriceGross: 89.9, vatRate: 6 },
    { description: "Jantar", quantity: 2, unitPriceGross: 24.5, vatRate: 13 },
    { description: "Taxa municipal turística", quantity: 6, unitPriceGross: 2, vatRate: 0 },
  ],
  kind: "FR",
  paymentMethod: "mbway",
};

type Call = { endpoint: string; query: URLSearchParams; body: Record<string, unknown> | undefined };
let calls: Call[];
let grants: number;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

function mockServer(opts: { customerExists?: boolean; expireFirstCall?: boolean } = {}) {
  calls = [];
  grants = 0;
  let expired = !!opts.expireFirstCall;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit) => {
      const url = new URL(input);
      const endpoint = url.pathname.replace(/^\/v1\//, "").replace(/\/$/, "");
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ endpoint, query: url.searchParams, body });
      if (endpoint === "grant") {
        grants++;
        return json(200, { access_token: `TOKEN-${grants}`, expires_in: 3600, refresh_token: `REFRESH-${grants}` });
      }
      if (expired) {
        expired = false;
        return json(401, { error: "invalid_token" });
      }
      switch (endpoint) {
        case "taxes/getAll":
          return json(200, [
            { tax_id: 1, value: 23, fiscal_zone: "PT" },
            { tax_id: 2, value: 13, fiscal_zone: "PT" },
            { tax_id: 3, value: 6, fiscal_zone: "PT" },
            { tax_id: 9, value: 6, fiscal_zone: "PT-AC" },
          ]);
        case "paymentMethods/getAll":
          return json(200, [
            { payment_method_id: 7, name: "Numerário" },
            { payment_method_id: 8, name: "MB WAY" },
          ]);
        case "customers/getByVat":
          return json(200, opts.customerExists ? [{ customer_id: 555 }] : []);
        case "maturityDates/getAll":
          return json(200, [{ maturity_date_id: 30, days: 30 }, { maturity_date_id: 31, days: 0 }]);
        case "customers/insert":
          return json(200, { valid: 1, customer_id: 556 });
        case "invoiceReceipts/insert":
        case "invoices/insert":
          return json(200, { valid: 1, document_id: 9001 });
        case "documents/getOne":
          return json(200, {
            document_id: 9001,
            number: 12,
            net_value: 330.7,
            document_set: { name: "2026" },
            document_type: { saft_code: "FR" },
          });
        case "documents/getPDFLink":
          return json(200, { url: "https://moloni.example/pdf/9001" });
        case "companies/getOne":
          return json(200, { company_id: 5, name: "Hotel Vice-Rei, Lda." });
      }
      return json(404, { error: "unknown" });
    }),
  );
}

beforeEach(() => {
  resetMoloniTokens();
  mockServer();
});
afterEach(() => vi.unstubAllGlobals());

describe("Moloni", () => {
  it("authenticates with the password grant and passes the token on every call", async () => {
    await moloniProvider.test(config);
    const grant = calls[0];
    expect(grant.endpoint).toBe("grant");
    expect(Object.fromEntries(grant.query)).toEqual({
      grant_type: "password",
      client_id: "dev-id",
      client_secret: "CLIENT-SECRET-XYZ",
      username: "hotel@example.pt",
      password: "PASS-WORD-999",
    });
    expect(calls[1].endpoint).toBe("companies/getOne");
    expect(calls[1].query.get("access_token")).toBe("TOKEN-1");
    expect(calls[1].query.get("json")).toBe("true");
    expect(calls[1].body).toEqual({ company_id: 5 });
  });

  it("test() returns the company name and reuses the cached token", async () => {
    expect(await moloniProvider.test(config)).toContain("Hotel Vice-Rei, Lda.");
    await moloniProvider.test(config);
    expect(grants).toBe(1);
  });

  it("issues a closed invoice-receipt with taxes, exemption, payment and PDF", async () => {
    const result = await moloniProvider.issue(config, req);
    const insert = calls.find((c) => c.endpoint === "invoiceReceipts/insert")!;
    const body = insert.body as Record<string, unknown>;
    expect(body).toMatchObject({
      company_id: 5,
      date: "2026-10-18",
      expiration_date: "2026-10-18",
      document_set_id: 42,
      customer_id: 556,
      our_reference: "VR-2026-0042",
      status: 1,
    });
    const products = body.products as Record<string, unknown>[];
    expect(products[0]).toMatchObject({
      product_id: 101,
      qty: 3,
      price: 84.8113,
      taxes: [{ tax_id: 3, value: 6, order: 0, cumulative: 0 }],
    });
    expect(products[1]).toMatchObject({ product_id: 113, taxes: [{ tax_id: 2, value: 13 }] });
    expect(products[2]).toMatchObject({ product_id: 100, price: 2, exemption_reason: "M99", taxes: [] });
    expect(body.payments).toEqual([{ payment_method_id: 8, date: "2026-10-18 00:00:00", value: 330.7 }]);

    // Net prices rebuild the PMS gross total exactly.
    const rebuilt = products.reduce((sum, p) => {
      const net = Number(p.price) * Number(p.qty);
      const rate = (p.taxes as { value: number }[])[0]?.value ?? 0;
      return sum + round2(net) + round2((net * rate) / 100);
    }, 0);
    expect(round2(rebuilt)).toBe(330.7);

    expect(result).toEqual({
      providerId: "9001",
      number: "FR 2026/12",
      total: 330.7,
      pdfUrl: "https://moloni.example/pdf/9001",
      status: "issued",
    });
  });

  it("creates the customer with Moloni's required fields when the NIF is new", async () => {
    await moloniProvider.issue(config, req);
    const insert = calls.find((c) => c.endpoint === "customers/insert")!;
    expect(insert.body).toMatchObject({
      company_id: 5,
      vat: "123456789",
      number: "123456789",
      name: "Ana Silva",
      country_id: 1,
      zip_code: "4000-001",
      city: "Porto",
      maturity_date_id: 31,
      payment_method_id: 8,
    });
  });

  it("reuses an existing customer and the final-consumer NIF when none is given", async () => {
    mockServer({ customerExists: true });
    await moloniProvider.issue(config, { ...req, customer: { name: "", vat: "", country: "PT" } });
    const lookup = calls.find((c) => c.endpoint === "customers/getByVat")!;
    expect(lookup.body).toEqual({ company_id: 5, vat: "999999990" });
    expect(calls.some((c) => c.endpoint === "customers/insert")).toBe(false);
  });

  it("uses invoices/insert without payments for FT", async () => {
    await moloniProvider.issue(config, { ...req, kind: "FT" });
    const insert = calls.find((c) => c.endpoint === "invoices/insert")!;
    expect(insert.body).not.toHaveProperty("payments");
  });

  it("inserts a draft (status 0) and asks no PDF in test mode", async () => {
    const result = await moloniProvider.issue({ ...config, mode: "test" }, req);
    expect(calls.find((c) => c.endpoint === "invoiceReceipts/insert")!.body).toMatchObject({ status: 0 });
    expect(calls.some((c) => c.endpoint === "documents/getPDFLink")).toBe(false);
    expect(result.status).toBe("draft");
  });

  it("re-authenticates once when the token is rejected", async () => {
    mockServer({ expireFirstCall: true });
    await moloniProvider.test(config);
    expect(grants).toBe(2);
  });

  it("requires a product per VAT rate", async () => {
    const err = await moloniProvider
      .issue({ ...config, settings: { products: { "6": 101 } } }, req)
      .catch((e) => e);
    expect(err).toBeInstanceOf(InvoiceError);
    expect(err.code).toBe("missing_product");
  });

  it("wraps validation errors and failed logins without leaking secrets", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) =>
        String(input).includes("/grant/")
          ? json(400, { error: "invalid_grant", error_description: "Invalid username and password combination" })
          : json(200, []),
      ),
    );
    const err = await moloniProvider.test(config).catch((e) => e);
    expect(err).toBeInstanceOf(InvoiceError);
    expect(err.code).toBe("unauthorized");
    expect(err.message).toContain("Invalid username and password combination");
    for (const s of ["CLIENT-SECRET-XYZ", "PASS-WORD-999"]) expect(err.message).not.toContain(s);

    resetMoloniTokens();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) =>
        String(input).includes("/grant/")
          ? json(200, { access_token: "TOKEN-SECRET", expires_in: 3600, refresh_token: "R" })
          : json(200, [{ code: 2, field: "vat", description: "NIF inválido" }]),
      ),
    );
    const err2 = await moloniProvider.test(config).catch((e) => e);
    expect(err2.message).toContain("vat: NIF inválido");
    expect(err2.message).not.toContain("TOKEN-SECRET");
  });

  it("helpers pick the mainland tax and a matching payment method", () => {
    expect(pickMoloniTax([{ tax_id: 9, value: 6, fiscal_zone: "PT-AC" }, { tax_id: 3, value: 6, fiscal_zone: "PT" }], 6)).toBe(3);
    expect(() => pickMoloniTax([], 23)).toThrow(InvoiceError);
    expect(pickPaymentMethod([{ payment_method_id: 1, name: "Cartão de crédito" }], "card")).toBe(1);
    expect(pickPaymentMethod([{ payment_method_id: 4, name: "Cheque" }], "cash")).toBe(4);
  });
});
