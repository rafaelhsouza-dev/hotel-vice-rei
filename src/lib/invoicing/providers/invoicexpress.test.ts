import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvoiceError, type InvoiceConfig, type InvoiceRequest } from "../types";
import { invoicexpressProvider, countryName, pickTaxName, toInvoiceXpressDate } from "./invoicexpress";
import { round2 } from "./shared";

const config: InvoiceConfig = {
  mode: "live",
  credentials: { accountName: "vicerei", apiKey: "KEY-SECRET-123" },
  settings: {},
};

const TAXES = {
  taxes: [
    { id: 1, name: "IVA23", value: 23, region: "PT" },
    { id: 2, name: "IVA13", value: 13, region: "PT" },
    { id: 3, name: "IVA6", value: 6, region: "PT" },
    { id: 4, name: "IVA4", value: 4, region: "PT-AC" },
    { id: 5, name: "IVA0", value: 0, region: "PT" },
  ],
};

const req: InvoiceRequest = {
  reference: "VR-2026-0042",
  date: "2026-10-18",
  customer: { name: "Ana Silva", vat: "123456789", country: "PT", city: "Porto", postalCode: "4000-001" },
  lines: [
    { description: "Alojamento — Quarto Duplo, 3 noites", quantity: 3, unitPriceGross: 89.9, vatRate: 6 },
    { description: "Pequeno-almoço", quantity: 2, unitPriceGross: 9.5, vatRate: 13 },
    { description: "Taxa municipal turística", quantity: 6, unitPriceGross: 2, vatRate: 0 },
  ],
  kind: "FR",
  paymentMethod: "card",
};

type Call = { url: URL; method: string; body: unknown };
let calls: Call[];

function json(status: number, body: unknown) {
  return new Response(body === undefined ? "" : JSON.stringify(body), { status });
}

/** Simulates the server computing the total from net prices, as InvoiceXpress does. */
function serverTotal(payload: { invoice: { items: { unit_price: number; quantity: number; tax: { name: string } }[] } }) {
  const byRate = new Map<number, number>();
  for (const it of payload.invoice.items) {
    const rate = Number(it.tax.name.replace("IVA", ""));
    byRate.set(rate, (byRate.get(rate) ?? 0) + it.unit_price * it.quantity);
  }
  let total = 0;
  for (const [rate, net] of byRate) total += round2(net) + round2((net * rate) / 100);
  return round2(total);
}

function mockServer(overrides: { pdfStatus?: number; total?: number } = {}) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit) => {
      const url = new URL(input);
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method: init.method ?? "GET", body });
      const path = url.pathname;
      if (path === "/taxes.json") return json(200, TAXES);
      if (path === "/invoice_receipts.json" || path === "/invoices.json") {
        return json(201, { invoice: { id: 77, status: "draft", total: overrides.total ?? serverTotal(body) } });
      }
      if (path.endsWith("/change-state.json")) return json(200, { invoice: { id: 77 } });
      if (path === "/invoice_receipts/77.json" || path === "/invoices/77.json") {
        return json(200, { invoice: { id: 77, inverted_sequence_number: "FR A/12", total: 300.7 } });
      }
      if (path === "/api/pdf/77.json") {
        return overrides.pdfStatus === 202
          ? json(202, undefined)
          : json(200, { output: { pdfUrl: "https://cdn.example/77.pdf" } });
      }
      return json(404, {});
    }),
  );
}

beforeEach(() => mockServer());
afterEach(() => vi.unstubAllGlobals());

describe("InvoiceXpress", () => {
  it("creates an invoice-receipt draft, finalises it and returns the PDF", async () => {
    const result = await invoicexpressProvider.issue(config, req);

    expect(calls.map((c) => `${c.method} ${c.url.pathname}`)).toEqual([
      "GET /taxes.json",
      "POST /invoice_receipts.json",
      "PUT /invoice_receipts/77/change-state.json",
      "GET /invoice_receipts/77.json",
      "GET /api/pdf/77.json",
    ]);
    for (const c of calls) {
      expect(c.url.host).toBe("vicerei.app.invoicexpress.com");
      expect(c.url.searchParams.get("api_key")).toBe("KEY-SECRET-123");
    }
    expect(calls[2].body).toEqual({ invoice: { state: "finalized" } });
    expect(result).toEqual({
      providerId: "77",
      number: "FR A/12",
      total: 300.7,
      pdfUrl: "https://cdn.example/77.pdf",
      status: "issued",
    });
  });

  it("maps customer, taxes, net prices and the tourist-tax exemption", async () => {
    await invoicexpressProvider.issue(config, req);
    const invoice = (calls[1].body as { invoice: Record<string, unknown> }).invoice;
    expect(invoice.date).toBe("18/10/2026");
    expect(invoice.reference).toBe("VR-2026-0042");
    expect(invoice.tax_exemption).toBe("M99");
    expect(invoice.client).toMatchObject({
      name: "Ana Silva",
      code: "123456789",
      fiscal_id: "123456789",
      country: "Portugal",
      postal_code: "4000-001",
      city: "Porto",
    });
    const items = invoice.items as { unit_price: number; tax: { name: string } }[];
    expect(items.map((i) => i.tax.name)).toEqual(["IVA6", "IVA13", "IVA0"]);
    expect(items[0].unit_price).toBeCloseTo(84.8113, 4);
    expect(items[2].unit_price).toBe(2);
  });

  it("uses Consumidor final with a per-booking client code when there is no NIF", async () => {
    await invoicexpressProvider.issue(config, { ...req, customer: { name: "", vat: "", country: "FR" } });
    const client = (calls[1].body as { invoice: { client: Record<string, string> } }).invoice.client;
    expect(client).toMatchObject({
      name: "Consumidor final",
      fiscal_id: "999999990",
      code: "PMS-VR-2026-0042",
      country: "France",
    });
  });

  it("issues a plain invoice for FT", async () => {
    await invoicexpressProvider.issue(config, { ...req, kind: "FT" });
    expect(calls[1].url.pathname).toBe("/invoices.json");
  });

  it("leaves a draft in test mode", async () => {
    const result = await invoicexpressProvider.issue({ ...config, mode: "test" }, req);
    expect(result.status).toBe("draft");
    expect(calls.some((c) => c.url.pathname.endsWith("change-state.json"))).toBe(false);
  });

  it("returns an empty pdfUrl while the PDF is still being generated (202)", async () => {
    mockServer({ pdfStatus: 202 });
    expect((await invoicexpressProvider.issue(config, req)).pdfUrl).toBe("");
  });

  it("deletes the draft and refuses to finalise when totals disagree", async () => {
    mockServer({ total: 300.71 });
    await expect(invoicexpressProvider.issue(config, req)).rejects.toMatchObject({ code: "total_mismatch" });
    const last = calls.at(-1)!;
    expect(last.url.pathname).toBe("/invoice_receipts/77/change-state.json");
    expect(last.body).toEqual({ invoice: { state: "deleted" } });
  });

  it("rejects an invalid NIF before calling the API for the document", async () => {
    await expect(
      invoicexpressProvider.issue(config, { ...req, customer: { ...req.customer, vat: "123456780" } }),
    ).rejects.toMatchObject({ code: "invalid_vat" });
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("wraps API errors without leaking the key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(422, { errors: [{ error: "Client fiscal_id is invalid" }] })),
    );
    const err = await invoicexpressProvider.issue(config, req).catch((e) => e);
    expect(err).toBeInstanceOf(InvoiceError);
    expect(err.message).toContain("Client fiscal_id is invalid");
    expect(err.message).not.toContain("KEY-SECRET-123");
  });

  it("reports a 401 as unauthorized and network failures as InvoiceError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(401, undefined)));
    await expect(invoicexpressProvider.test(config)).rejects.toMatchObject({ code: "unauthorized" });
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    await expect(invoicexpressProvider.test(config)).rejects.toMatchObject({ code: "network" });
  });

  it("test() lists the taxes", async () => {
    expect(await invoicexpressProvider.test(config)).toContain("IVA6");
    expect(calls[0].url.pathname).toBe("/taxes.json");
  });

  it("helpers", () => {
    expect(toInvoiceXpressDate("2026-01-05")).toBe("05/01/2026");
    expect(countryName("de")).toBe("Germany");
    expect(pickTaxName(TAXES.taxes, 4)).toBe("IVA4");
    expect(pickTaxName([], 23)).toBe("IVA23");
  });
});
