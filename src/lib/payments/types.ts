/**
 * Contract every payment provider implements (Stripe, ifthenpay).
 *
 * Providers are stateless adapters: they turn a request into an API call and
 * an API answer (or webhook) into a normalised event. Persisting payments and
 * moving bookings along is done by lib/payments/service.ts, never here.
 */

export type PaymentMethod = "card" | "mbway" | "multibanco";

export type ProviderId = "stripe" | "ifthenpay";

/** Credentials and settings as stored in `integrations` for this provider. */
export type ProviderConfig = {
  mode: "test" | "live";
  credentials: Record<string, string>;
  settings: Record<string, unknown>;
};

export type StartPaymentRequest = {
  /** Our payments.id — sent to the provider as the order/metadata id. */
  paymentId: string;
  bookingReference: string;
  amount: number;
  currency: "EUR";
  method: PaymentMethod;
  description: string;
  customer: { name: string; email: string; phone?: string };
  locale: "pt" | "en" | "es" | "fr";
  /** Absolute URLs for redirect-based flows. */
  successUrl: string;
  cancelUrl: string;
  /** Absolute URL providers call back (webhook / callback). */
  notifyUrl: string;
  /** Multibanco references / checkout sessions expire at this time. */
  expiresAt: Date;
};

export type StartPaymentResult =
  | { kind: "redirect"; providerRef: string; url: string; expiresAt: Date | null; data?: Record<string, unknown> }
  | {
      kind: "multibanco";
      providerRef: string;
      entity: string;
      reference: string;
      expiresAt: Date | null;
      data?: Record<string, unknown>;
    }
  /** The guest approves in the MB WAY app; we wait for the callback. */
  | { kind: "mbway"; providerRef: string; expiresAt: Date | null; data?: Record<string, unknown> };

/** A provider notification, verified and normalised. */
export type PaymentEvent = {
  /** Our payments.id when the provider echoes it, else null. */
  paymentId: string | null;
  providerRef: string;
  status: "succeeded" | "failed" | "expired" | "pending";
  amount: number | null;
  raw: Record<string, unknown>;
};

export type RefundResult = { providerRef: string; status: "succeeded" | "pending" | "failed" };

export type CredentialField = {
  key: string;
  label: string;
  hint?: string;
  secret?: boolean;
  required?: boolean;
};

export type PaymentProvider = {
  id: ProviderId;
  name: string;
  /** Methods this provider can take with the given configuration. */
  methods(config: ProviderConfig): PaymentMethod[];
  credentialFields: CredentialField[];
  docsUrl: string;
  /** Cheap authenticated call proving the credentials work. Throws PaymentError. */
  test(config: ProviderConfig): Promise<string>;
  start(config: ProviderConfig, req: StartPaymentRequest): Promise<StartPaymentResult>;
  /**
   * Verifies and parses an incoming notification. `rawBody` is the exact body
   * bytes as text (signatures are computed over it); `url` carries the query
   * string for GET callbacks. Throws PaymentError("invalid_signature") when the
   * notification is not authentic.
   */
  parseNotification(
    config: ProviderConfig,
    input: { rawBody: string; headers: Headers; url: URL; method: string },
  ): Promise<PaymentEvent[]>;
  /** Polls the provider for the current state of one payment, if supported. */
  fetchStatus?(config: ProviderConfig, providerRef: string): Promise<PaymentEvent | null>;
  refund?(config: ProviderConfig, input: { providerRef: string; amount: number; reason: string }): Promise<RefundResult>;
};

export class PaymentError extends Error {
  constructor(
    message: string,
    readonly code: string = "provider_error",
  ) {
    super(message);
    this.name = "PaymentError";
  }
}
