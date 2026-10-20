import type { BusyPeriod, DayAvailability } from "../repo/availability";

/**
 * The contract every channel adapter implements.
 *
 * Deliberately narrow: pull reservations in, push availability out, and say
 * whether the credentials work. Anything richer (rate plans, restrictions,
 * content) is expressed through `capabilities` so the admin can grey out what
 * a given channel genuinely cannot do, instead of offering a button that
 * silently no-ops.
 */

export type ProviderId = "ical" | "beds24" | "booking" | "expedia" | "manual" | "extranet";

export type ChannelCapabilities = {
  /** Can hand us reservations. */
  importReservations: boolean;
  /** Can accept availability from us. */
  exportAvailability: boolean;
  /** Can accept prices, not just open/closed days. */
  exportRates: boolean;
  /** Can accept min-stay / closed-to-arrival style rules. */
  exportRestrictions: boolean;
  /** Pushes to us in real time instead of waiting to be polled. */
  webhooks: boolean;
};

export type CredentialField = {
  key: string;
  label: string;
  hint?: string;
  /** Rendered as a password field and never sent back to the browser. */
  secret?: boolean;
  required?: boolean;
};

export type ChannelContext = {
  channelId: string;
  credentials: Record<string, string>;
  settings: Record<string, unknown>;
  /** Our room id → the channel's own room identifier. */
  roomMap: Record<string, { externalRoomId: string; externalRateId: string; icalUrl: string }>;
};

export type ImportedReservation = {
  externalId: string;
  roomId: string | null;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: "confirmed" | "cancelled";
  raw: Record<string, unknown>;
};

export type SyncResult = {
  items: number;
  message: string;
};

export type ChannelAdapter = {
  id: ProviderId;
  name: string;
  capabilities: ChannelCapabilities;
  credentialFields: CredentialField[];
  /** Shown in the admin so the operator knows what they are signing up to. */
  docsUrl: string;
  /**
   * Honest note about how obtainable this connection actually is. Displayed
   * verbatim in the admin, because "why is this greyed out" is the first
   * question anyone asks.
   */
  availabilityNote: string;
  /** Whether a hotel can connect this today without a partner contract. */
  selfServe: boolean;

  /** Cheap credential check. Throws with a readable message on failure. */
  test(ctx: ChannelContext): Promise<SyncResult>;
  /** Pull reservations that changed since `since` (ISO date). */
  pullReservations?(ctx: ChannelContext, since: string): Promise<ImportedReservation[]>;
  /** Push our calendar out. `busy` is the compact form, `days` the detailed one. */
  pushAvailability?(
    ctx: ChannelContext,
    days: DayAvailability[],
    busy: BusyPeriod[],
  ): Promise<SyncResult>;
};

/** Thrown by adapters so the engine can log a clean message, not a stack. */
export class ChannelError extends Error {
  constructor(
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "ChannelError";
  }
}
