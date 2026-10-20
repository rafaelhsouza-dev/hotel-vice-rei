import { PaymentError, type PaymentProvider, type ProviderId } from "../types";
import { ifthenpayProvider } from "./ifthenpay";
import { stripeProvider } from "./stripe";

/** Every payment provider the admin can configure, in display order. */
export const PAYMENT_PROVIDERS: PaymentProvider[] = [stripeProvider, ifthenpayProvider];

/**
 * The adapter for a provider id. Ids come from our own enum, so an unknown one
 * (a stale database row, a typo) is a bug worth failing loudly on.
 */
export function getPaymentProvider(id: ProviderId): PaymentProvider {
  const provider = PAYMENT_PROVIDERS.find((p) => p.id === id);
  if (!provider) throw new PaymentError(`Fornecedor de pagamentos desconhecido: ${id}.`, "unknown_provider");
  return provider;
}
