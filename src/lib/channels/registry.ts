import { icalAdapter } from "./providers/ical";
import { beds24Adapter } from "./providers/beds24";
import { bookingAdapter, expediaAdapter } from "./providers/direct";
import type { ChannelAdapter, ProviderId } from "./types";

/**
 * Everything the admin can offer to connect. Ordered by how quickly a hotel
 * can actually get it working, which is the order an operator wants to read.
 */

/**
 * TripAdvisor is intentionally absent: Instant Book stopped accepting new
 * accommodation sign-ups on 11 November 2025 and only pre-existing
 * connections survive, so there is no route in for this property. Its reviews
 * remain reachable through the Content API, which is a marketing concern
 * rather than an availability one.
 */
export const ADAPTERS: ChannelAdapter[] = [
  icalAdapter,
  beds24Adapter,
  expediaAdapter,
  bookingAdapter,
];

export function getAdapter(provider: string): ChannelAdapter {
  const adapter = ADAPTERS.find((a) => a.id === provider);
  if (!adapter) throw new Error(`Unknown channel provider: ${provider}`);
  return adapter;
}

export function isProviderId(value: string): value is ProviderId {
  return ADAPTERS.some((a) => a.id === value) || value === "manual";
}
