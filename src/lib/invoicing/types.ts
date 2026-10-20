/**
 * Contract for certified invoicing software (InvoiceXpress, Moloni, Vendus).
 *
 * Portuguese law requires invoices to be issued by AT-certified software, so
 * the PMS never numbers or signs a document itself: it hands the lines to the
 * hotel's program through its API and stores what comes back.
 */

export type InvoiceProviderId = "invoicexpress" | "moloni" | "vendus";

export type InvoiceConfig = {
  mode: "test" | "live";
  credentials: Record<string, string>;
  settings: Record<string, unknown>;
};

export type InvoiceLine = {
  description: string;
  quantity: number;
  /** Unit price including VAT, in euros. */
  unitPriceGross: number;
  /** VAT rate in percent: 6, 13, 23, or 0 with an exemption reason. */
  vatRate: number;
  /** Required by AT when vatRate is 0, e.g. "M99" or "M07". */
  exemptionCode?: string;
};

export type InvoiceRequest = {
  /** Our booking reference, used as the document's own reference / note. */
  reference: string;
  date: string; // YYYY-MM-DD
  customer: {
    name: string;
    /** Portuguese NIF or foreign tax id; empty → "Consumidor final". */
    vat: string;
    country: string; // ISO 3166-1 alpha-2
    address?: string;
    postalCode?: string;
    city?: string;
    email?: string;
  };
  lines: InvoiceLine[];
  /** "FR" = fatura-recibo (paid), "FT" = fatura (to be paid). */
  kind: "FR" | "FT";
  /** How it was paid, for invoice-receipts. */
  paymentMethod?: "card" | "mbway" | "multibanco" | "cash" | "transfer" | "other";
  notes?: string;
  sendByEmail?: boolean;
};

export type InvoiceResult = {
  providerId: string;
  number: string;
  total: number;
  pdfUrl: string;
  status: "issued" | "draft";
};

export type CredentialField = {
  key: string;
  label: string;
  hint?: string;
  secret?: boolean;
  required?: boolean;
};

export type InvoiceProvider = {
  id: InvoiceProviderId;
  name: string;
  credentialFields: CredentialField[];
  docsUrl: string;
  /** Authenticated read proving the credentials work. Throws InvoiceError. */
  test(config: InvoiceConfig): Promise<string>;
  /** Creates and finalises the document. Throws InvoiceError on failure. */
  issue(config: InvoiceConfig, req: InvoiceRequest): Promise<InvoiceResult>;
};

export class InvoiceError extends Error {
  constructor(
    message: string,
    readonly code: string = "provider_error",
  ) {
    super(message);
    this.name = "InvoiceError";
  }
}
