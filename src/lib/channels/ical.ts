/**
 * Minimal iCalendar (RFC 5545) reader and writer for availability exchange.
 *
 * Every major OTA — Airbnb, Vrbo, Booking.com, Expedia, Google — can import a
 * calendar URL and export one. It carries only blocked dates, never rates or
 * restrictions, and it is polled rather than pushed, so it is the slow lane.
 * It is also the only lane that needs no contract, no certification and no
 * partner approval, which makes it the sensible floor to build on.
 *
 * Written by hand rather than pulled from npm: the subset we need is a few
 * dozen lines, and an availability feed is not somewhere to accept a
 * dependency's parsing bugs.
 */

export type IcalEvent = {
  uid: string;
  /** Inclusive first blocked night, YYYY-MM-DD. */
  start: string;
  /** Exclusive, as DTEND is defined for all-day events. */
  end: string;
  summary: string;
  description: string;
};

const CRLF = "\r\n";

/** RFC 5545 caps lines at 75 octets; continuations start with a single space. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest) parts.push(` ${rest}`);
  return parts.join(CRLF);
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

const compact = (date: string) => date.replace(/-/g, "");

/**
 * @param stamp DTSTAMP for every event. Passed in rather than read from the
 *   clock so the same calendar renders byte-identical, which lets channels
 *   detect "nothing changed" and lets us diff feeds in tests.
 */
export function buildIcal(
  events: IcalEvent[],
  { name, stamp }: { name: string; stamp: string },
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hotel Vice-Rei//Disponibilidade//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    "X-WR-TIMEZONE:Europe/Lisbon",
  ];

  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(event.start)}`,
      `DTEND;VALUE=DATE:${compact(event.end)}`,
      `SUMMARY:${escapeText(event.summary)}`,
      `DESCRIPTION:${escapeText(event.description)}`,
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join(CRLF) + CRLF;
}

/** Reverses folding, then splits each line into name, params and value. */
function unfold(raw: string): string[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else if (line.trim()) {
      out.push(line);
    }
  }
  return out;
}

/** Accepts both `20260815` and `2026-08-15T10:00:00Z` forms. */
function parseDate(value: string): string {
  const digits = value.replace(/[^0-9]/g, "");
  if (digits.length < 8) return "";
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

export function parseIcal(raw: string): IcalEvent[] {
  const events: IcalEvent[] = [];
  let current: Partial<IcalEvent> | null = null;

  for (const line of unfold(raw)) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current?.start && current.end) {
        events.push({
          uid: current.uid ?? `${current.start}-${current.end}`,
          start: current.start,
          end: current.end,
          summary: current.summary ?? "",
          description: current.description ?? "",
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const name = line.slice(0, colon).split(";")[0].toUpperCase();
    const value = line.slice(colon + 1);

    if (name === "UID") current.uid = value.trim();
    else if (name === "DTSTART") current.start = parseDate(value);
    else if (name === "DTEND") current.end = parseDate(value);
    else if (name === "SUMMARY") current.summary = unescapeText(value);
    else if (name === "DESCRIPTION") current.description = unescapeText(value);
  }

  // A DTEND-less all-day event means a single night; channels do emit these.
  return events.filter((e) => e.start && e.end && e.end > e.start);
}

/**
 * Channels put the guest name in different places, and some deliberately
 * anonymise it ("Not available", "CLOSED", "Blocked"). Anything that looks
 * like a placeholder becomes an empty name rather than a fake guest.
 */
const PLACEHOLDERS = [
  "not available",
  "unavailable",
  "closed",
  "blocked",
  "reserved",
  "busy",
  "airbnb (not available)",
  // Portuguese, including the wording our own feed publishes — a channel that
  // re-exports our calendar must not come back as a guest called "Encerrado".
  "encerrado",
  "fechado",
  "ocupado",
  "reservado",
  "bloqueado",
  "indisponível",
  "indisponivel",
  "não disponível",
  "nao disponivel",
];

export function guestNameFrom(event: IcalEvent): string {
  const candidate = event.summary
    .replace(/^(closed|blocked|reserved|encerrado|reservado)\s*[-–:]\s*/i, "")
    .trim();
  if (!candidate) return "";
  if (PLACEHOLDERS.includes(candidate.toLowerCase())) return "";
  return candidate;
}
