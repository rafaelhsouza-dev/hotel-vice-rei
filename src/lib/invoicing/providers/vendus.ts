import {
  InvoiceError,
  type InvoiceConfig,
  type InvoiceProvider,
  type InvoiceRequest,
  type InvoiceResult,
} from "../types";
import {
  assertLines,
  clip,
  exemptionCodeFor,
  grossTotal,
  httpRequest,
  redact,
  requireCredential,
  resolveCustomerVat,
  round2,
  type HttpResult,
  type PaymentMethod,
} from "./shared";

/**
 * Vendus API v1.1 (https://www.vendus.pt/ws/v1.1/).
 *
 * The API key goes as the HTTP Basic user. Vendus takes VAT-inclusive
 * prices (`gross_price`), so our lines go through unchanged and no
 * net-price rounding is needed. Rates are named by class, not percentage:
 * NOR/INT/RED follow the account's region (23/13/6 on the mainland).
 *
 * Test mode maps to Vendus's own `mode: "tests"`, which produces real-looking
 * documents with no fiscal value.
 */

const NAME = "Vendus";
const API = "https://www.vendus.pt/ws/v1.1";

function authHeader(config: InvoiceConfig): { header: string; apiKey: string } {
  const apiKey = requireCredential(config.credentials, "apiKey", "Chave da API");
  return { header: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`, apiKey };
}

function errorMessage(res: HttpResult): string {
  const body = res.body as { errors?: { message?: string; code?: string }[] } | null;
  if (body && typeof body === "object" && Array.isArray(body.errors) && body.errors.length) {
    return body.errors.map((e) => e.message ?? e.code ?? "").filter(Boolean).join(" ");
  }
  if (res.status === 401) return "Chave da API incorreta.";
  return typeof res.body === "string" && res.body ? clip(res.body) : `Erro HTTP ${res.status}.`;
}

async function call<T>(config: InvoiceConfig, method: string, path: string, body?: unknown): Promise<T> {
  const { header, apiKey } = authHeader(config);
  const res = await httpRequest(NAME, `${API}${path}`, {
    method,
    headers: {
      authorization: header,
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status < 200 || res.status >= 300) {
    throw new InvoiceError(
      redact(`${NAME}: ${errorMessage(res)}`, [apiKey, header]),
      res.status === 401 ? "unauthorized" : "provider_error",
    );
  }
  return res.body as T;
}

/** Vendus tax classes; Azores/Madeira rates map to the same class. */
export function vendusTaxId(rate: number): "NOR" | "INT" | "RED" | "ISE" {
  if (rate === 0) return "ISE";
  if ([23, 22, 16].includes(rate)) return "NOR";
  if ([13, 12, 9].includes(rate)) return "INT";
  if ([6, 5, 4].includes(rate)) return "RED";
  throw new InvoiceError(`Taxa de IVA não suportada pelo Vendus: ${rate}%.`, "unsupported_vat");
}

/** Vendus payment-type codes for our methods. */
const PAYMENT_TYPES: Record<PaymentMethod, string[]> = {
  card: ["CC", "CD", "TPASIBS", "MYPOS"],
  mbway: ["MBWAY"],
  multibanco: ["MB"],
  cash: ["NU"],
  transfer: ["TB"],
  other: ["OU"],
};

type VendusPaymentMethod = { id: number | string; type: string; status?: string };

export function pickVendusPayment(
  methods: VendusPaymentMethod[],
  method: InvoiceRequest["paymentMethod"],
): string {
  const active = methods.filter((m) => !m.status || m.status === "on");
  const wanted = PAYMENT_TYPES[method ?? "other"];
  const found =
    wanted.map((t) => active.find((m) => m.type === t)).find(Boolean) ??
    active.find((m) => m.type === "OU") ??
    active[0];
  if (!found) {
    throw new InvoiceError("O Vendus não tem métodos de pagamento ativos.", "missing_payment_method");
  }
  return String(found.id);
}

async function paymentMethodId(config: InvoiceConfig, method: InvoiceRequest["paymentMethod"]): Promise<string> {
  const map = (config.settings.paymentMethods ?? {}) as Record<string, unknown>;
  const configured = map[method ?? "other"];
  if (configured) return String(configured);
  const methods = await call<VendusPaymentMethod[]>(config, "GET", "/documents/paymentmethods/");
  return pickVendusPayment(Array.isArray(methods) ? methods : [], method);
}

export function buildVendusPayload(config: InvoiceConfig, req: InvoiceRequest, paymentId?: string) {
  const { vat, isFinalConsumer } = resolveCustomerVat(req.customer);
  const registerId = Number(config.credentials.registerId);
  const total = grossTotal(req.lines);
  const c = req.customer;
  return {
    type: req.kind,
    mode: config.mode === "test" ? "tests" : "normal",
    date: req.date,
    ...(Number.isInteger(registerId) && registerId > 0 ? { register_id: registerId } : {}),
    external_reference: req.reference,
    notes: [req.notes, `Reserva ${req.reference}`].filter(Boolean).join("\n"),
    output: "pdf_url",
    ...(req.kind === "FT" ? { date_due: req.date } : {}),
    client: {
      // Vendus asks not to send 999999990: an omitted fiscal_id is its "Consumidor final".
      ...(isFinalConsumer ? {} : { fiscal_id: vat }),
      ...(c.name ? { name: c.name } : {}),
      ...(c.address ? { address: c.address } : {}),
      ...(c.postalCode ? { postalcode: c.postalCode } : {}),
      ...(c.city ? { city: c.city } : {}),
      country: (c.country || "PT").toUpperCase(),
      ...(c.email ? { email: c.email } : {}),
      send_email: req.sendByEmail && c.email ? "yes" : "no",
    },
    items: req.lines.map((line) => {
      const code = exemptionCodeFor(line);
      return {
        // Items need an id or a reference; one stable reference per VAT class
        // keeps the Vendus catalogue small while the title carries the detail.
        reference: code ? `PMS-${code}` : `PMS-IVA${line.vatRate}`,
        title: line.description,
        qty: line.quantity,
        gross_price: round2(line.unitPriceGross),
        // M99 lines are third-party charges (tourist tax): SAF-T ProductType "I".
        type_id: code === "M99" ? "I" : "S",
        tax_id: vendusTaxId(line.vatRate),
        ...(code ? { tax_exemption: code } : {}),
      };
    }),
    ...(req.kind === "FR" && paymentId ? { payments: [{ id: paymentId, amount: total }] } : {}),
  };
}

type VendusDocument = {
  id: number;
  number?: string;
  amount_gross?: number | string;
  output?: string;
};

async function issue(config: InvoiceConfig, req: InvoiceRequest): Promise<InvoiceResult> {
  assertLines(req);
  const paymentId = req.kind === "FR" ? await paymentMethodId(config, req.paymentMethod) : undefined;
  const doc = await call<VendusDocument>(config, "POST", "/documents/", buildVendusPayload(config, req, paymentId));
  if (!doc?.id) throw new InvoiceError(`${NAME}: resposta inesperada ao criar o documento.`);
  const pdfUrl = typeof doc.output === "string" && /^https?:\/\//.test(doc.output) ? doc.output : "";
  return {
    providerId: String(doc.id),
    number: doc.number ?? String(doc.id),
    total: doc.amount_gross !== undefined ? round2(Number(doc.amount_gross)) : grossTotal(req.lines),
    pdfUrl,
    status: "issued",
  };
}

async function test(config: InvoiceConfig): Promise<string> {
  const account = await call<{ company?: string } | { company?: string }[]>(config, "GET", "/account/");
  const company = Array.isArray(account) ? account[0]?.company : account?.company;
  return `Ligação ao Vendus confirmada${company ? `: ${company}` : ""}.`;
}

export const vendusProvider: InvoiceProvider = {
  id: "vendus",
  name: NAME,
  docsUrl: "https://www.vendus.pt/ws/v1.1/",
  credentialFields: [
    {
      key: "apiKey",
      label: "Chave da API",
      hint: "Em Vendus → Conta → Integrações → API.",
      secret: true,
      required: true,
    },
    {
      key: "registerId",
      label: "ID da caixa (opcional)",
      hint: "Só se a conta tiver várias caixas; sem ele usa-se a predefinida.",
    },
  ],
  test,
  issue,
};
