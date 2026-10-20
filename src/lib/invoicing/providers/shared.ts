import { InvoiceError, type InvoiceLine, type InvoiceRequest } from "../types";

/** The NIF AT reserves for anonymous buyers ("Consumidor final"). */
export const CONSUMIDOR_FINAL_NIF = "999999990";

/**
 * Outside VAT scope (art. 2.º, n.º 2 do CIVA): the municipal tourist tax is
 * collected on the council's behalf, so it is "não sujeito", not exempt.
 */
export const DEFAULT_EXEMPTION_CODE = "M99";

export const HTTP_TIMEOUT_MS = 20000;

/** Strips spaces, dots, dashes and a leading "PT" so "PT 123 456 789" validates. */
export function normalizeVat(vat: string): string {
  return vat.replace(/[\s.\-]/g, "").replace(/^PT/i, "");
}

/** Mod-11 check digit used by AT for every Portuguese NIF/NIPC. */
export function validatePortugueseNif(nif: string): boolean {
  const digits = normalizeVat(nif);
  if (!/^[1-9]\d{8}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += Number(digits[i]) * (9 - i);
  const check = 11 - (sum % 11);
  return (check >= 10 ? 0 : check) === Number(digits[8]);
}

/**
 * Resolves the buyer's tax id. Empty → "Consumidor final"; a Portuguese one
 * must pass the checksum, because AT rejects the whole document otherwise.
 */
export function resolveCustomerVat(customer: InvoiceRequest["customer"]): {
  vat: string;
  isFinalConsumer: boolean;
} {
  const raw = customer.vat?.trim() ?? "";
  if (!raw) return { vat: CONSUMIDOR_FINAL_NIF, isFinalConsumer: true };
  const isPt = (customer.country || "PT").toUpperCase() === "PT";
  if (isPt) {
    const vat = normalizeVat(raw);
    if (!validatePortugueseNif(vat)) throw new InvoiceError("NIF inválido.", "invalid_vat");
    return { vat, isFinalConsumer: vat === CONSUMIDOR_FINAL_NIF };
  }
  return { vat: raw.replace(/\s/g, ""), isFinalConsumer: false };
}

/** Rounds half away from zero to cents, immune to 1.005-style binary drift. */
export function round2(value: number): number {
  return roundTo(value, 2);
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  const scaled = Math.abs(value) * factor;
  // Nudge by a relative epsilon so 1.005 (stored as 1.00499…) rounds up.
  const rounded = Math.round(scaled * (1 + Number.EPSILON * 8)) / factor;
  return Math.sign(value) * rounded;
}

/**
 * Net unit price for a VAT-inclusive one, or undefined if none exists at
 * this precision.
 *
 * Programs that take net prices rebuild the line as net + VAT, each rounded
 * to the cent. Dividing and rounding to `decimals` alone can land a line a
 * cent off, so we try the nearest candidates (±5 steps of 10^-decimals) and
 * keep the first one for which both reconstructions —
 * round2(qty·net·(1+rate)) and round2(qty·net) + round2(qty·net·rate) —
 * equal round2(qty·gross). With 4 decimals that fails for ~0.5% of lines
 * with quantity ≥ 5; with quantity 1 it never does.
 */
export function exactNetUnitPrice(
  unitPriceGross: number,
  vatRate: number,
  quantity = 1,
  decimals = 4,
): number | undefined {
  const rate = vatRate / 100;
  const base = roundTo(unitPriceGross / (1 + rate), decimals);
  if (rate === 0) return base;
  const target = round2(unitPriceGross * quantity);
  const step = 10 ** -decimals;
  for (const k of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5]) {
    const candidate = roundTo(base + k * step, decimals);
    const net = candidate * quantity;
    const viaGross = round2(net * (1 + rate));
    const viaSum = round2(round2(net) + round2(net * rate));
    if (viaGross === target && viaSum === target) return candidate;
  }
  return undefined;
}

/**
 * A line as a net-price program should receive it. When no unit price
 * reproduces the gross line total, the line is collapsed to quantity 1 at
 * the line's net total and the quantity moves into the description
 * ("… (14 × 24,90 €)"), because the guest's total must match to the cent.
 */
export function netLine(
  line: InvoiceLine,
  decimals = 4,
): { description: string; quantity: number; unitPrice: number } {
  const unit = exactNetUnitPrice(line.unitPriceGross, line.vatRate, line.quantity, decimals);
  if (unit !== undefined) {
    return { description: line.description, quantity: line.quantity, unitPrice: unit };
  }
  const lineGross = round2(line.unitPriceGross * line.quantity);
  const unitText = line.unitPriceGross.toFixed(2).replace(".", ",");
  return {
    description: `${line.description} (${line.quantity} × ${unitText} €)`,
    quantity: 1,
    unitPrice:
      exactNetUnitPrice(lineGross, line.vatRate, 1, decimals) ??
      roundTo(lineGross / (1 + line.vatRate / 100), decimals),
  };
}

/** What the guest pays, summed per line exactly as the PMS shows it. */
export function grossTotal(lines: InvoiceLine[]): number {
  return round2(lines.reduce((sum, l) => sum + round2(l.unitPriceGross * l.quantity), 0));
}

/** The AT reason code for a zero-rated line; M99 when the caller gave none. */
export function exemptionCodeFor(line: InvoiceLine): string | undefined {
  if (line.vatRate !== 0) return undefined;
  return (line.exemptionCode || DEFAULT_EXEMPTION_CODE).toUpperCase();
}

export function assertLines(req: InvoiceRequest): void {
  if (!req.lines.length) throw new InvoiceError("O documento não tem linhas.", "no_lines");
  for (const line of req.lines) {
    if (!(line.quantity > 0) || !(line.unitPriceGross >= 0)) {
      throw new InvoiceError(`Linha inválida: «${line.description}».`, "invalid_line");
    }
  }
}

export function requireCredential(
  credentials: Record<string, string>,
  key: string,
  label: string,
): string {
  const value = credentials[key]?.trim();
  if (!value) throw new InvoiceError(`Falta preencher «${label}».`, "missing_credentials");
  return value;
}

export type HttpResult = { status: number; body: unknown; text: string };

/**
 * fetch with the 20 s timeout and JSON parsing. Network failures become an
 * InvoiceError that names the provider but never the URL, which may carry a
 * key or token in its query string.
 */
export async function httpRequest(
  providerName: string,
  url: string,
  init: RequestInit = {},
): Promise<HttpResult> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    throw new InvoiceError(
      timedOut
        ? `O ${providerName} não respondeu a tempo. Tente novamente.`
        : `Não foi possível contactar o ${providerName}.`,
      timedOut ? "timeout" : "network",
    );
  }
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: res.status, body, text };
}

/** Removes anything that looks like a credential before a message is shown. */
export function redact(message: string, secrets: (string | undefined)[]): string {
  let out = message;
  for (const s of secrets) if (s && s.length >= 4) out = out.split(s).join("***");
  return out.replace(/(api_key|access_token|refresh_token|client_secret|password)=[^&\s]+/gi, "$1=***");
}

export function clip(text: string, max = 300): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export type PaymentMethod = NonNullable<InvoiceRequest["paymentMethod"]>;

/** pt-PT labels, also used to match payment methods by name in the provider. */
export const PAYMENT_LABELS: Record<PaymentMethod, string[]> = {
  card: ["cartão", "cartao", "card", "multibanco/tpa", "tpa"],
  mbway: ["mb way", "mbway"],
  multibanco: ["referência multibanco", "referencia multibanco", "multibanco", "ref. mb"],
  cash: ["numerário", "numerario", "dinheiro", "cash"],
  transfer: ["transferência", "transferencia", "transfer"],
  other: ["outro", "other"],
};
