import { InvoiceError, type InvoiceProvider, type InvoiceProviderId } from "../types";
import { invoicexpressProvider } from "./invoicexpress";
import { moloniProvider } from "./moloni";
import { vendusProvider } from "./vendus";

export { validatePortugueseNif, CONSUMIDOR_FINAL_NIF, DEFAULT_EXEMPTION_CODE } from "./shared";

/** The certified programs the PMS can hand invoices to. */
export const INVOICE_PROVIDERS: readonly InvoiceProvider[] = [
  invoicexpressProvider,
  moloniProvider,
  vendusProvider,
];

export function getInvoiceProvider(id: InvoiceProviderId | string): InvoiceProvider {
  const provider = INVOICE_PROVIDERS.find((p) => p.id === id);
  if (!provider) throw new InvoiceError(`Programa de faturação desconhecido: ${id}.`, "unknown_provider");
  return provider;
}
