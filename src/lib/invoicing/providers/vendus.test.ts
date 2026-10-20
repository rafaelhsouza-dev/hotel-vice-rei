import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvoiceError, type InvoiceConfig, type InvoiceRequest } from "../types";
import { pickVendusPayment, vendusProvider, vendusTaxId } from "./vendus";

const config: InvoiceConfig = {
  mode: "live",
  credentials: { apiKey: "VENDUS-KEY-abc", registerId: "3" },
  settings: {},
};

const req: InvoiceRequest = {
  reference: "VR-2026-0042",
  date: "2026-10-18",
  customer: { name: "Ana Silva", vat: "123456789", country: "PT", email: "ana@example.pt" },
  lines: [
    { description: "Alojamento", quantity: 3, unitPriceGross: 89.9, vatRate: 6 },
    { description: "Bar", quantity: 1, unitPriceGross: 4.5, vatRate: 23 },
    { description: "Taxa municipal turística", quantity: 6, unitPriceGross: 2, vatRate: 0 },
  ],
  kind: "FR",
  paymentMethod: "card",
  sendByEmail: true,
};

type Call = { url: URL; method: string; headers: Record<string, string>; body: Record<string, unknown> | undefined };
let calls: Call[];

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit) => {
      const url = new URL(input);
      calls.push({
        url,
        method: init.method ?? "GET",
        headers: init.headers as Record<string, string>,
        body: init.body ? JSON.parse(String(init.body)) : undefined,
      });
      if (url.pathname === "/ws/v1.1/documents/paymentmethods/") {
        return json(200, [
          { id: 11, type: "NU", status: "on" },
          { id: 12, type: "CC", status: "off" },
          { id: 13, type: "CD", status: "on" },
        ]);
      }
      if (url.pathname === "/ws/v1.1/documents/") {
        return json(201, {
          id: 501,
          number: "FR 01P2026/7",
          amount_gross: "286.20",
          output: "https://www.vendus.pt/foo/501.pdf",
        });
      }
      if (url.pathname === "/ws/v1.1/account/") return json(200, { id: 1, company: "Hotel Vice-Rei" });
      return json(404, { errors: [{ code: "A001", message: "Not found" }] });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("Vendus", () => {
  it("authenticates with the API key as the Basic user", async () => {
    expect(await vendusProvider.test(config)).toContain("Hotel Vice-Rei");
    expect(calls[0].url.href).toBe("https://www.vendus.pt/ws/v1.1/account/");
    const decoded = Buffer.from(calls[0].headers.authorization.replace("Basic ", ""), "base64").toString();
    expect(decoded).toBe("VENDUS-KEY-abc:");
  });

  it("sends gross prices, tax classes, the M99 exemption and the payment", async () => {
    const result = await vendusProvider.issue(config, req);
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.body).toMatchObject({
      type: "FR",
      mode: "normal",
      date: "2026-10-18",
      register_id: 3,
      external_reference: "VR-2026-0042",
      output: "pdf_url",
      client: { fiscal_id: "123456789", name: "Ana Silva", country: "PT", send_email: "yes" },
      payments: [{ id: "13", amount: 286.2 }],
    });
    const items = post.body!.items as Record<string, unknown>[];
    expect(items).toEqual([
      { reference: "PMS-IVA6", title: "Alojamento", qty: 3, gross_price: 89.9, type_id: "S", tax_id: "RED" },
      { reference: "PMS-IVA23", title: "Bar", qty: 1, gross_price: 4.5, type_id: "S", tax_id: "NOR" },
      {
        reference: "PMS-M99",
        title: "Taxa municipal turística",
        qty: 6,
        gross_price: 2,
        type_id: "I",
        tax_id: "ISE",
        tax_exemption: "M99",
      },
    ]);
    expect(result).toEqual({
      providerId: "501",
      number: "FR 01P2026/7",
      total: 286.2,
      pdfUrl: "https://www.vendus.pt/foo/501.pdf",
      status: "issued",
    });
  });

  it("maps test mode to mode=tests", async () => {
    await vendusProvider.issue({ ...config, mode: "test" }, req);
    expect(calls.find((c) => c.method === "POST")!.body).toMatchObject({ mode: "tests" });
  });

  it("omits fiscal_id for Consumidor final, as Vendus asks", async () => {
    await vendusProvider.issue(config, { ...req, customer: { name: "", vat: "", country: "PT" } });
    const client = calls.find((c) => c.method === "POST")!.body!.client as Record<string, unknown>;
    expect(client).not.toHaveProperty("fiscal_id");
    expect(client.send_email).toBe("no");
  });

  it("FT has a due date and no payments; a configured payment id skips the lookup", async () => {
    await vendusProvider.issue(config, { ...req, kind: "FT" });
    const ft = calls.find((c) => c.method === "POST")!.body!;
    expect(ft).toMatchObject({ type: "FT", date_due: "2026-10-18" });
    expect(ft).not.toHaveProperty("payments");

    calls = [];
    await vendusProvider.issue({ ...config, settings: { paymentMethods: { card: 99 } } }, req);
    expect(calls.map((c) => c.url.pathname)).toEqual(["/ws/v1.1/documents/"]);
    expect(calls[0].body!.payments).toEqual([{ id: "99", amount: 286.2 }]);
  });

  it("rejects an invalid NIF and unsupported rates", async () => {
    await expect(
      vendusProvider.issue(config, { ...req, customer: { ...req.customer, vat: "111111111" } }),
    ).rejects.toMatchObject({ code: "invalid_vat" });
    expect(() => vendusTaxId(18)).toThrow(InvoiceError);
  });

  it("wraps API errors without leaking the key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(400, { errors: [{ code: "A002", message: "Data inválida" }] })),
    );
    const err = await vendusProvider.issue(config, req).catch((e) => e);
    expect(err).toBeInstanceOf(InvoiceError);
    expect(err.message).toBe("Vendus: Data inválida");
    expect(err.message).not.toContain("VENDUS-KEY-abc");
  });

  it("pickVendusPayment skips inactive methods", () => {
    expect(pickVendusPayment([{ id: 1, type: "CC", status: "off" }, { id: 2, type: "OU" }], "card")).toBe("2");
  });
});
