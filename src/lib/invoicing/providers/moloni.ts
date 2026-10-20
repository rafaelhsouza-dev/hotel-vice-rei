import {
  InvoiceError,
  type InvoiceConfig,
  type InvoiceProvider,
  type InvoiceRequest,
  type InvoiceResult,
} from "../types";
import {
  PAYMENT_LABELS,
  assertLines,
  clip,
  exemptionCodeFor,
  grossTotal,
  httpRequest,
  netLine,
  redact,
  requireCredential,
  resolveCustomerVat,
  round2,
  type HttpResult,
} from "./shared";

/**
 * Moloni API v1 (https://www.moloni.pt/dev/).
 *
 * Authentication is the OAuth2 password grant for native apps; the access
 * token lasts an hour and the refresh token 14 days, so both are kept in
 * module memory and the password is only replayed when the refresh fails.
 * Calls are POSTs with `?access_token=…&json=true` and a JSON body.
 *
 * Moloni requires a catalogue product on every line, so the hotel creates
 * one generic service per VAT rate (e.g. "Alojamento" at 6%) and maps them
 * in settings.products: {"6": id, "13": id, "23": id, "0": id}.
 *
 * In test mode documents are inserted with status 0 (draft): Moloni has no
 * sandbox, and a draft is neither numbered nor sent to AT.
 */

const NAME = "Moloni";
const API = "https://api.moloni.pt/v1";
/** Net prices sent with 4 decimals; see netLine for the rounding. */
const PRICE_DECIMALS = 4;
const TOKEN_MARGIN_MS = 60_000;

type Token = { access: string; refresh: string; expiresAt: number; refreshExpiresAt: number };
const tokens = new Map<string, Token>();

/** For tests: forget cached tokens. */
export function resetMoloniTokens(): void {
  tokens.clear();
}

function secretsOf(config: InvoiceConfig): string[] {
  const c = config.credentials;
  const cached = tokens.get(tokenKey(config));
  return [c.clientSecret, c.password, cached?.access, cached?.refresh].filter(
    (s): s is string => !!s,
  );
}

function tokenKey(config: InvoiceConfig): string {
  return `${config.credentials.clientId ?? ""}|${config.credentials.username ?? ""}`;
}

/** Moloni errors come as {error, error_description} or [{code, field, description}]. */
function errorMessage(body: unknown): string | undefined {
  if (!body) return undefined;
  if (typeof body === "string") return clip(body);
  if (Array.isArray(body)) {
    const parts = body
      .map((e) => {
        if (!e || typeof e !== "object") return String(e);
        const o = e as Record<string, unknown>;
        const text = o.description ?? o.message ?? o.code;
        return o.field ? `${String(o.field)}: ${String(text)}` : String(text);
      })
      .filter(Boolean);
    return parts.length ? clip(parts.join("; ")) : undefined;
  }
  if (typeof body === "object") {
    const o = body as Record<string, unknown>;
    if (o.error_description) return String(o.error_description);
    if (o.error) return String(o.error);
  }
  return undefined;
}

async function grant(params: Record<string, string>): Promise<Token> {
  const qs = new URLSearchParams(params).toString();
  const res = await httpRequest(NAME, `${API}/grant/?${qs}`, { method: "GET" });
  const body = res.body as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  } | null;
  if (res.status !== 200 || !body?.access_token) {
    const detail = errorMessage(res.body) ?? `Erro HTTP ${res.status}.`;
    throw new InvoiceError(
      redact(`${NAME}: autenticação recusada (${detail})`, [
        params.client_secret,
        params.password,
        params.refresh_token,
      ]),
      "unauthorized",
    );
  }
  const now = Date.now();
  return {
    access: body.access_token,
    refresh: body.refresh_token ?? "",
    expiresAt: now + (body.expires_in ?? 3600) * 1000,
    refreshExpiresAt: now + 14 * 24 * 3600 * 1000,
  };
}

async function accessToken(config: InvoiceConfig, force = false): Promise<string> {
  const c = config.credentials;
  const clientId = requireCredential(c, "clientId", "Developer ID (client_id)");
  const clientSecret = requireCredential(c, "clientSecret", "Client secret");
  const key = tokenKey(config);
  const cached = tokens.get(key);
  const now = Date.now();
  if (!force && cached && cached.expiresAt - TOKEN_MARGIN_MS > now) return cached.access;

  let token: Token | undefined;
  if (cached?.refresh && cached.refreshExpiresAt > now) {
    token = await grant({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: cached.refresh,
    }).catch(() => undefined);
  }
  token ??= await grant({
    grant_type: "password",
    client_id: clientId,
    client_secret: clientSecret,
    username: requireCredential(c, "username", "Utilizador"),
    password: requireCredential(c, "password", "Palavra-passe"),
  });
  tokens.set(key, token);
  return token.access;
}

function isAuthError(res: HttpResult): boolean {
  if (res.status === 401) return true;
  const msg = errorMessage(res.body)?.toLowerCase() ?? "";
  return msg.includes("invalid_token") || msg.includes("expired");
}

/** One POST, retried once with a fresh token if Moloni says the old one is dead. */
async function call<T>(config: InvoiceConfig, endpoint: string, body: Record<string, unknown>): Promise<T> {
  let res: HttpResult | undefined;
  for (const force of [false, true]) {
    const token = await accessToken(config, force);
    res = await httpRequest(
      NAME,
      `${API}/${endpoint}/?access_token=${encodeURIComponent(token)}&json=true`,
      {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!isAuthError(res)) break;
  }
  const r = res as HttpResult;
  const failed =
    r.status >= 400 ||
    (Array.isArray(r.body) && r.body.length > 0 && typeof r.body[0] === "object" && "code" in r.body[0]) ||
    (!!r.body && typeof r.body === "object" && !Array.isArray(r.body) && "error" in r.body) ||
    (!!r.body && typeof r.body === "object" && "valid" in r.body && (r.body as { valid: unknown }).valid !== 1);
  if (failed) {
    const detail = errorMessage(r.body) ?? `Erro HTTP ${r.status}.`;
    throw new InvoiceError(
      redact(`${NAME} (${endpoint}): ${detail}`, secretsOf(config)),
      isAuthError(r) ? "unauthorized" : "provider_error",
    );
  }
  return r.body as T;
}

function companyId(config: InvoiceConfig): number {
  const id = Number(requireCredential(config.credentials, "companyId", "ID da empresa"));
  if (!Number.isInteger(id) || id <= 0) {
    throw new InvoiceError("ID da empresa Moloni inválido.", "missing_credentials");
  }
  return id;
}

function numberSetting(config: InvoiceConfig, key: string): number | undefined {
  const v = Number(config.settings[key]);
  return Number.isFinite(v) && v > 0 ? v : undefined;
}

/** settings.products → product_id for a VAT rate. */
export function productIdFor(config: InvoiceConfig, rate: number): number {
  const map = (config.settings.products ?? {}) as Record<string, unknown>;
  const id = Number(map[String(rate)]);
  if (!Number.isInteger(id) || id <= 0) {
    throw new InvoiceError(
      `Falta indicar o artigo do Moloni para IVA ${rate}% (Definições → Faturação → artigos por taxa).`,
      "missing_product",
    );
  }
  return id;
}

type MoloniTax = { tax_id: number; value: number; fiscal_zone?: string; type?: number; saft_type?: number };

/**
 * Picks the company's VAT tax for a rate. Moloni lists one entry per fiscal
 * zone, so the mainland "PT" one wins over PT-AC/PT-MA duplicates.
 */
export function pickMoloniTax(taxes: MoloniTax[], rate: number): number {
  const matches = taxes.filter((t) => Number(t.value) === rate);
  const mainland = matches.find((t) => !t.fiscal_zone || t.fiscal_zone.toUpperCase() === "PT");
  const tax = mainland ?? matches[0];
  if (!tax) {
    throw new InvoiceError(`O Moloni não tem uma taxa de IVA de ${rate}% configurada.`, "unsupported_vat");
  }
  return tax.tax_id;
}

type PaymentMethodRow = { payment_method_id: number; name: string };

export function pickPaymentMethod(
  methods: PaymentMethodRow[],
  method: InvoiceRequest["paymentMethod"],
): number {
  if (!methods.length) {
    throw new InvoiceError("O Moloni não tem métodos de pagamento configurados.", "missing_payment_method");
  }
  const labels = PAYMENT_LABELS[method ?? "other"];
  const found = methods.find((m) => labels.some((l) => m.name.toLowerCase().includes(l)));
  return (found ?? methods[0]).payment_method_id;
}

let countryCache: { iso: string; id: number }[] | undefined;

async function countryId(config: InvoiceConfig, iso: string): Promise<number> {
  const code = (iso || "PT").toUpperCase();
  if (code === "PT") return 1; // Documented: country_id 1 is Portugal.
  if (!countryCache) {
    const rows = await call<{ country_id: number; iso_3166_1: string }[]>(config, "countries/getAll", {});
    countryCache = rows.map((r) => ({ iso: String(r.iso_3166_1).toUpperCase(), id: r.country_id }));
  }
  const found = countryCache.find((c) => c.iso === code);
  if (!found) throw new InvoiceError(`País desconhecido no Moloni: ${code}.`, "invalid_country");
  return found.id;
}

async function resolveCustomer(
  config: InvoiceConfig,
  req: InvoiceRequest,
  paymentMethodId: number,
): Promise<number> {
  const company_id = companyId(config);
  const { vat, isFinalConsumer } = resolveCustomerVat(req.customer);
  const existing = await call<{ customer_id: number }[]>(config, "customers/getByVat", { company_id, vat });
  if (Array.isArray(existing) && existing[0]?.customer_id) return existing[0].customer_id;

  const isPt = (req.customer.country || "PT").toUpperCase() === "PT";
  const zip = req.customer.postalCode?.trim() ?? "";
  let maturityDateId = numberSetting(config, "maturityDateId");
  if (!maturityDateId) {
    const rows = await call<{ maturity_date_id: number; days: number }[]>(config, "maturityDates/getAll", {
      company_id,
    });
    maturityDateId = (rows.find((r) => r.days === 0) ?? rows[0])?.maturity_date_id ?? 0;
  }
  const created = await call<{ customer_id: number }>(config, "customers/insert", {
    company_id,
    vat,
    // "number" is the customer's code in Moloni, unique and at most 20 chars.
    number: (isFinalConsumer ? "CF" : vat).slice(0, 20),
    name: isFinalConsumer && !req.customer.name ? "Consumidor final" : req.customer.name,
    language_id: numberSetting(config, isPt ? "languageIdPt" : "languageIdOther") ?? (isPt ? 1 : 2),
    address: req.customer.address || "Desconhecido",
    // PT postcodes must be NNNN-NNN or empty, otherwise the insert fails.
    zip_code: !isPt || /^\d{4}-\d{3}$/.test(zip) ? zip : "",
    city: req.customer.city || "Desconhecido",
    country_id: await countryId(config, req.customer.country),
    email: req.customer.email ?? "",
    maturity_date_id: maturityDateId,
    payment_method_id: paymentMethodId,
    copies: [],
  });
  return created.customer_id;
}

export function buildMoloniProducts(config: InvoiceConfig, req: InvoiceRequest, taxes: MoloniTax[]) {
  return req.lines.map((line, order) => {
    const code = exemptionCodeFor(line);
    const net = netLine(line, PRICE_DECIMALS);
    return {
      product_id: productIdFor(config, line.vatRate),
      name: net.description,
      qty: net.quantity,
      price: net.unitPrice,
      order,
      ...(code
        ? { exemption_reason: code, taxes: [] }
        : {
            taxes: [
              { tax_id: pickMoloniTax(taxes, line.vatRate), value: line.vatRate, order: 0, cumulative: 0 },
            ],
          }),
    };
  });
}

type MoloniDocument = {
  document_id: number;
  number?: number;
  net_value?: number;
  status?: number;
  document_set?: { name?: string };
  document_type?: { saft_code?: string };
};

async function issue(config: InvoiceConfig, req: InvoiceRequest): Promise<InvoiceResult> {
  assertLines(req);
  const company_id = companyId(config);
  const document_set_id = Number(requireCredential(config.credentials, "documentSetId", "ID da série"));

  const [taxes, methods] = await Promise.all([
    call<MoloniTax[]>(config, "taxes/getAll", { company_id }),
    call<PaymentMethodRow[]>(config, "paymentMethods/getAll", { company_id }),
  ]);
  const paymentMethodId = pickPaymentMethod(methods, req.paymentMethod);
  const customer_id = await resolveCustomer(config, req, paymentMethodId);
  const total = grossTotal(req.lines);
  const closed = config.mode === "live";

  const inserted = await call<{ valid: number; document_id: number }>(
    config,
    req.kind === "FR" ? "invoiceReceipts/insert" : "invoices/insert",
    {
      company_id,
      date: req.date,
      expiration_date: req.date,
      document_set_id,
      customer_id,
      our_reference: req.reference,
      notes: req.notes ?? "",
      products: buildMoloniProducts(config, req, taxes),
      ...(req.kind === "FR"
        ? {
            payments: [
              { payment_method_id: paymentMethodId, date: `${req.date} 00:00:00`, value: total },
            ],
          }
        : {}),
      status: closed ? 1 : 0,
    },
  );

  const doc = await call<MoloniDocument>(config, "documents/getOne", {
    company_id,
    document_id: inserted.document_id,
  });
  const series = doc.document_set?.name;
  const number = doc.number && series ? `${doc.document_type?.saft_code ?? req.kind} ${series}/${doc.number}` : "";

  let pdfUrl = "";
  if (closed) {
    const link = await call<{ url?: string }>(config, "documents/getPDFLink", {
      company_id,
      document_id: inserted.document_id,
    }).catch(() => undefined);
    pdfUrl = link?.url ?? "";
  }

  return {
    providerId: String(inserted.document_id),
    number,
    total: doc.net_value !== undefined ? round2(Number(doc.net_value)) : total,
    pdfUrl,
    status: closed ? "issued" : "draft",
  };
}

async function test(config: InvoiceConfig): Promise<string> {
  const company_id = companyId(config);
  const company = await call<{ name?: string }>(config, "companies/getOne", { company_id });
  return `Ligação ao Moloni confirmada${company?.name ? `: ${company.name}` : ""}.`;
}

export const moloniProvider: InvoiceProvider = {
  id: "moloni",
  name: NAME,
  docsUrl: "https://www.moloni.pt/dev/",
  credentialFields: [
    {
      key: "clientId",
      label: "Developer ID (client_id)",
      hint: "Pedido em moloni.pt/dev, na área de programador da conta.",
      required: true,
    },
    { key: "clientSecret", label: "Client secret", secret: true, required: true },
    { key: "username", label: "Utilizador", hint: "O e-mail de acesso ao Moloni.", required: true },
    { key: "password", label: "Palavra-passe", secret: true, required: true },
    {
      key: "companyId",
      label: "ID da empresa",
      hint: "Número da empresa no Moloni (companies/getAll).",
      required: true,
    },
    {
      key: "documentSetId",
      label: "ID da série",
      hint: "Série de documentos a usar; os artigos por taxa de IVA ficam nas definições.",
      required: true,
    },
  ],
  test,
  issue,
};

