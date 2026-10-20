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
  netLine,
  redact,
  requireCredential,
  resolveCustomerVat,
  round2,
  type HttpResult,
} from "./shared";

/**
 * InvoiceXpress API v2 (https://www.invoicexpress.com/api-v2).
 *
 * Every account lives on its own subdomain and authenticates with an
 * `api_key` query parameter. Documents are created as drafts, checked
 * against the PMS total, and only then finalised — once finalised they are
 * communicated to AT and can no longer be corrected, only cancelled.
 *
 * In test mode the draft is left as is: InvoiceXpress has no sandbox flag,
 * and a draft has no fiscal effect.
 */

const NAME = "InvoiceXpress";
/** Net prices sent with 4 decimals; see netLine for the rounding. */
const PRICE_DECIMALS = 4;

type Tax = { id: number; name: string; value: number; region?: string };

function baseUrl(config: InvoiceConfig): { url: string; apiKey: string } {
  const account = requireCredential(config.credentials, "accountName", "Nome da conta")
    .replace(/^https?:\/\//, "")
    .replace(/\.app\.invoicexpress\.com.*$/, "");
  if (!/^[a-z0-9-]+$/i.test(account)) {
    throw new InvoiceError("Nome da conta InvoiceXpress inválido.", "missing_credentials");
  }
  const apiKey = requireCredential(config.credentials, "apiKey", "Chave da API");
  return { url: `https://${account}.app.invoicexpress.com`, apiKey };
}

function errorMessage(res: HttpResult): string {
  const body = res.body as { errors?: unknown } | null;
  if (body && typeof body === "object" && "errors" in body) {
    const errors = body.errors;
    const list = Array.isArray(errors) ? errors : [errors];
    const parts = list.map((e) =>
      e && typeof e === "object" && "error" in e ? String((e as { error: unknown }).error) : String(e),
    );
    return parts.join(" ");
  }
  if (res.status === 401) return "Chave da API ou nome da conta incorretos.";
  if (res.status === 404) return "Recurso não encontrado na conta.";
  return typeof res.body === "string" && res.body ? clip(res.body) : `Erro HTTP ${res.status}.`;
}

async function call(
  config: InvoiceConfig,
  method: string,
  path: string,
  body?: unknown,
  ok: number[] = [200, 201],
): Promise<HttpResult> {
  const { url, apiKey } = baseUrl(config);
  const sep = path.includes("?") ? "&" : "?";
  const res = await httpRequest(NAME, `${url}${path}${sep}api_key=${encodeURIComponent(apiKey)}`, {
    method,
    headers: { accept: "application/json", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!ok.includes(res.status)) {
    throw new InvoiceError(
      redact(`${NAME}: ${errorMessage(res)}`, [apiKey]),
      res.status === 401 ? "unauthorized" : "provider_error",
    );
  }
  return res;
}

/** dd/mm/yyyy, the only date format the API accepts (it silently uses today otherwise). */
export function toInvoiceXpressDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) throw new InvoiceError("Data do documento inválida.", "invalid_date");
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** The API wants English country names ("Portugal", "Spain", "Germany"). */
export function countryName(code: string): string {
  const iso = (code || "PT").toUpperCase();
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(iso) ?? iso;
  } catch {
    return iso;
  }
}

/**
 * Picks the account's tax for a rate. Accounts list taxes per region, so a
 * mainland "PT" entry wins over Azores/Madeira; with no list we fall back
 * to the default names (IVA23, IVA13, IVA6, IVA0).
 */
export function pickTaxName(taxes: Tax[], rate: number): string {
  const matches = taxes.filter((t) => Number(t.value) === rate);
  const mainland = matches.find((t) => !t.region || t.region.toUpperCase() === "PT");
  return (mainland ?? matches[0])?.name ?? `IVA${rate}`;
}

async function listTaxes(config: InvoiceConfig): Promise<Tax[]> {
  const res = await call(config, "GET", "/taxes.json");
  const taxes = (res.body as { taxes?: Tax[] } | null)?.taxes;
  return Array.isArray(taxes) ? taxes : [];
}

export function buildInvoiceXpressPayload(req: InvoiceRequest, taxes: Tax[]) {
  const { vat, isFinalConsumer } = resolveCustomerVat(req.customer);
  const codes = new Set(req.lines.map(exemptionCodeFor).filter((c): c is string => !!c));
  // The exemption code is a document field, so one reason per document.
  if (codes.size > 1) {
    throw new InvoiceError(
      "O InvoiceXpress só aceita um motivo de isenção por documento.",
      "multiple_exemptions",
    );
  }
  const date = toInvoiceXpressDate(req.date);
  const observations = [req.notes, `Reserva ${req.reference}`].filter(Boolean).join("\n");
  return {
    invoice: {
      date,
      due_date: date,
      reference: req.reference,
      observations,
      ...(codes.size ? { tax_exemption: [...codes][0] } : {}),
      client: {
        name: req.customer.name || "Consumidor final",
        // An existing code makes InvoiceXpress ignore the other fields, so a
        // client without NIF gets one code per booking instead of a shared one.
        code: isFinalConsumer ? `PMS-${req.reference}` : vat,
        fiscal_id: vat,
        country: countryName(req.customer.country),
        ...(req.customer.email ? { email: req.customer.email } : {}),
        ...(req.customer.address ? { address: req.customer.address } : {}),
        ...(req.customer.postalCode ? { postal_code: req.customer.postalCode } : {}),
        ...(req.customer.city ? { city: req.customer.city } : {}),
      },
      items: req.lines.map((line) => {
        const net = netLine(line, PRICE_DECIMALS);
        return {
          name: net.description,
          description: net.description,
          unit_price: net.unitPrice,
          quantity: net.quantity,
          tax: { name: pickTaxName(taxes, line.vatRate) },
        };
      }),
    },
  };
}

type IxDocument = {
  id: number;
  status?: string;
  sequence_number?: string;
  inverted_sequence_number?: string;
  total?: number | string;
};

function readDocument(res: HttpResult): IxDocument {
  const body = res.body as Record<string, IxDocument> | null;
  const doc = body?.invoice ?? body?.invoice_receipt ?? (body ? Object.values(body)[0] : undefined);
  if (!doc || typeof doc !== "object" || !("id" in doc)) {
    throw new InvoiceError(`${NAME}: resposta inesperada ao criar o documento.`);
  }
  return doc;
}

async function fetchPdfUrl(config: InvoiceConfig, id: number): Promise<string> {
  // 202 means the PDF is still being generated; the caller can ask again later.
  const res = await call(config, "GET", `/api/pdf/${id}.json`, undefined, [200, 202]);
  if (res.status !== 200) return "";
  return (res.body as { output?: { pdfUrl?: string } } | null)?.output?.pdfUrl ?? "";
}

async function issue(config: InvoiceConfig, req: InvoiceRequest): Promise<InvoiceResult> {
  assertLines(req);
  const type = req.kind === "FR" ? "invoice_receipts" : "invoices";
  const taxes = await listTaxes(config);
  const payload = buildInvoiceXpressPayload(req, taxes);
  const created = readDocument(await call(config, "POST", `/${type}.json`, payload));

  const expected = grossTotal(req.lines);
  const total = round2(Number(created.total ?? expected));
  if (Math.abs(total - expected) >= 0.005) {
    // Never finalise a document that disagrees with what the guest was charged.
    await call(config, "PUT", `/${type}/${created.id}/change-state.json`, {
      invoice: { state: "deleted" },
    }).catch(() => undefined);
    throw new InvoiceError(
      `O total calculado pelo InvoiceXpress (${total.toFixed(2)} €) difere do da reserva (${expected.toFixed(2)} €). O rascunho foi apagado.`,
      "total_mismatch",
    );
  }

  if (config.mode === "test") {
    return { providerId: String(created.id), number: "", total, pdfUrl: "", status: "draft" };
  }

  await call(config, "PUT", `/${type}/${created.id}/change-state.json`, {
    invoice: { state: "finalized" },
  });
  const finalDoc = readDocument(await call(config, "GET", `/${type}/${created.id}.json`));

  if (req.sendByEmail && req.customer.email) {
    // Best effort: the invoice is already issued, a failed e-mail must not undo that.
    await call(config, "PUT", `/${type}/${created.id}/email-document.json`, {
      message: {
        client: { email: req.customer.email, save: "0" },
        subject: `Fatura ${finalDoc.inverted_sequence_number ?? finalDoc.sequence_number ?? ""}`.trim(),
        body: "Segue em anexo a fatura da sua estadia. Obrigado pela preferência.",
      },
    }).catch(() => undefined);
  }

  return {
    providerId: String(created.id),
    number: finalDoc.inverted_sequence_number || finalDoc.sequence_number || String(created.id),
    total: round2(Number(finalDoc.total ?? total)),
    pdfUrl: await fetchPdfUrl(config, created.id).catch(() => ""),
    status: "issued",
  };
}

async function test(config: InvoiceConfig): Promise<string> {
  const taxes = await listTaxes(config);
  const names = taxes.map((t) => t.name).join(", ");
  return `Ligação ao InvoiceXpress confirmada${names ? ` (taxas: ${names})` : ""}.`;
}

export const invoicexpressProvider: InvoiceProvider = {
  id: "invoicexpress",
  name: NAME,
  docsUrl: "https://www.invoicexpress.com/api-v2",
  credentialFields: [
    {
      key: "accountName",
      label: "Nome da conta",
      hint: "O subdomínio da conta: em https://hotel.app.invoicexpress.com é «hotel».",
      required: true,
    },
    {
      key: "apiKey",
      label: "Chave da API",
      hint: "Em Definições → API, na conta InvoiceXpress.",
      secret: true,
      required: true,
    },
  ],
  test,
  issue,
};
