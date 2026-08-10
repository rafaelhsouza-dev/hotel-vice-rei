import { guestNameFrom, parseIcal } from "../ical";
import { ChannelError, type ChannelAdapter, type ImportedReservation } from "../types";

/**
 * Generic iCal adapter: one feed URL per room type, imported on a schedule.
 *
 * Works with Airbnb, Vrbo, Google, and with Booking.com on the small
 * properties it allows. Import only — the outbound direction is our own
 * published feed (see /api/ical), which the channel subscribes to rather than
 * us posting anywhere.
 */

const TIMEOUT_MS = 15_000;
const MAX_BYTES = 2_000_000; // a year of blocks is a few dozen KB; this is slack

async function fetchFeed(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ChannelError(`URL de calendário inválida: ${url}`);
  }
  // webcal:// is what channels hand out; it is plain https underneath.
  if (parsed.protocol === "webcal:") parsed.protocol = "https:";

  // Plain HTTP is refused because a calendar URL carries a bearer token in the
  // query string. Loopback is the exception: it cannot be intercepted, and
  // refusing it would make the integration untestable outside production.
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback)) {
    throw new ChannelError("Só são aceites calendários em HTTPS.");
  }

  const response = await fetch(parsed.toString(), {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: "text/calendar, text/plain" },
    cache: "no-store",
  }).catch((error: unknown) => {
    throw new ChannelError(
      "Não foi possível contactar o calendário.",
      error instanceof Error ? error.message : String(error),
    );
  });

  if (!response.ok) {
    throw new ChannelError(`O calendário respondeu ${response.status}.`);
  }

  const text = await response.text();
  if (text.length > MAX_BYTES) {
    throw new ChannelError("O calendário é demasiado grande para ser processado.");
  }
  if (!text.includes("BEGIN:VCALENDAR")) {
    throw new ChannelError("A resposta não é um ficheiro iCalendar.");
  }
  return text;
}

export const icalAdapter: ChannelAdapter = {
  id: "ical",
  name: "Calendário iCal",
  selfServe: true,
  docsUrl: "https://www.rfc-editor.org/rfc/rfc5545",
  availabilityNote:
    "Ligação imediata, sem contrato. Importa apenas datas ocupadas — não transporta preços nem restrições — e a atualização depende do intervalo com que cada plataforma lê o feed (no Booking.com pode chegar a 12 horas).",
  capabilities: {
    importReservations: true,
    exportAvailability: true,
    exportRates: false,
    exportRestrictions: false,
    webhooks: false,
  },
  credentialFields: [],

  async test(ctx) {
    const urls = Object.values(ctx.roomMap)
      .map((m) => m.icalUrl)
      .filter(Boolean);
    if (urls.length === 0) {
      throw new ChannelError("Nenhuma tipologia tem URL de calendário configurado.");
    }
    let events = 0;
    for (const url of urls) events += parseIcal(await fetchFeed(url)).length;
    return {
      items: events,
      message: `${urls.length} calendário(s) lidos, ${events} períodos ocupados.`,
    };
  },

  async pullReservations(ctx) {
    const reservations: ImportedReservation[] = [];
    const failures: string[] = [];

    for (const [roomId, map] of Object.entries(ctx.roomMap)) {
      if (!map.icalUrl) continue;
      try {
        for (const event of parseIcal(await fetchFeed(map.icalUrl))) {
          reservations.push({
            // The channel's UID is the only stable identity an iCal feed
            // gives us; scoping it by room keeps two feeds from colliding.
            externalId: `${roomId}:${event.uid}`,
            roomId,
            guestName: guestNameFrom(event),
            checkIn: event.start,
            checkOut: event.end,
            status: "confirmed",
            raw: { uid: event.uid, summary: event.summary, description: event.description },
          });
        }
      } catch (error) {
        failures.push(
          `${roomId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // One dead feed must not discard the rooms that imported cleanly, but the
    // operator still has to hear about it.
    if (failures.length > 0 && reservations.length === 0) {
      throw new ChannelError(failures.join(" · "));
    }
    return reservations;
  },
};
