import { ChannelError, type ChannelAdapter, type ImportedReservation } from "../types";

/**
 * Direct OTA connections — Expedia QuickConnect and Booking.com Connectivity.
 *
 * These two are grouped because they share a shape (XML over HTTPS, hotel-code
 * plus credentials) and a caveat: neither can be switched on from this screen
 * alone. Expedia admits independent hotels to QuickConnect, so the adapter is
 * fully implemented and waits only on credentials from Partner Central.
 * Booking.com does not: its API is restricted to certified connectivity
 * partners and, as of this build, registration is closed. Its adapter is
 * therefore deliberately inert — it explains the situation instead of
 * pretending a button will work.
 *
 * @see https://expediaconnectivity.com/apis/
 * @see https://developers.booking.com/connectivity/docs
 */

const EQC_BASE = "https://services.expediapartnercentral.com/eqc";
const TIMEOUT_MS = 30_000;

const escapeXml = (value: string) =>
  value.replace(/[<>&"']/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!,
  );

async function postXml(path: string, xml: string): Promise<string> {
  const response = await fetch(`${EQC_BASE}${path}`, {
    method: "POST",
    // EQC rejects anything but text/xml, and does not serve plain HTTP.
    headers: { "Content-Type": "text/xml", Accept: "text/xml" },
    body: xml,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  }).catch((error: unknown) => {
    throw new ChannelError(
      "Não foi possível contactar a Expedia.",
      error instanceof Error ? error.message : String(error),
    );
  });

  const text = await response.text();
  if (!response.ok) throw new ChannelError(`A Expedia respondeu ${response.status}.`, text.slice(0, 500));

  // EQC returns HTTP 200 even for business errors; the payload carries them.
  const error = /<Error[^>]*>([\s\S]*?)<\/Error>/i.exec(text);
  if (error) throw new ChannelError("A Expedia recusou o pedido.", error[1].trim().slice(0, 500));
  return text;
}

function requireEqcCredentials(credentials: Record<string, string>) {
  const username = credentials.username?.trim();
  const password = credentials.password?.trim();
  const hotelId = credentials.hotelId?.trim();
  if (!username || !password || !hotelId) {
    throw new ChannelError("Faltam o utilizador, a palavra-passe ou o ID de hotel da Expedia.");
  }
  return { username, password, hotelId };
}

export const expediaAdapter: ChannelAdapter = {
  id: "expedia",
  name: "Expedia QuickConnect",
  selfServe: false,
  docsUrl: "https://expediaconnectivity.com/apis/",
  availabilityNote:
    "Aberto a hotéis independentes, mas as credenciais são emitidas no Expedia Partner Central e a palavra-passe tem de ter pelo menos 16 caracteres. Depois de as ter, a ligação funciona sem intermediários.",
  capabilities: {
    importReservations: true,
    exportAvailability: true,
    exportRates: true,
    exportRestrictions: true,
    webhooks: false,
  },
  credentialFields: [
    { key: "username", label: "Utilizador EQC", hint: "Normalmente começa por EQC." },
    { key: "password", label: "Palavra-passe", secret: true, hint: "Mínimo 16 caracteres." },
    { key: "hotelId", label: "ID do hotel", hint: "O código da propriedade no Partner Central." },
  ],

  async test(ctx) {
    const { username, password, hotelId } = requireEqcCredentials(ctx.credentials);
    // A booking retrieval with an empty window is the cheapest authenticated
    // round trip EQC offers: it proves the credentials without writing.
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<BookingRetrievalRQ xmlns="http://www.expediaconnect.com/EQC/BR/2014/01">` +
      `<Authentication username="${escapeXml(username)}" password="${escapeXml(password)}"/>` +
      `<Hotel id="${escapeXml(hotelId)}"/>` +
      `<ParamSet><Booking status="pending"/></ParamSet>` +
      `</BookingRetrievalRQ>`;
    const response = await postXml("/br", xml);
    const count = (response.match(/<Booking\b/g) ?? []).length;
    return { items: count, message: `Credenciais aceites. ${count} reserva(s) pendentes.` };
  },

  async pullReservations(ctx): Promise<ImportedReservation[]> {
    const { username, password, hotelId } = requireEqcCredentials(ctx.credentials);
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<BookingRetrievalRQ xmlns="http://www.expediaconnect.com/EQC/BR/2014/01">` +
      `<Authentication username="${escapeXml(username)}" password="${escapeXml(password)}"/>` +
      `<Hotel id="${escapeXml(hotelId)}"/>` +
      `<ParamSet><Booking status="pending"/></ParamSet>` +
      `</BookingRetrievalRQ>`;
    const response = await postXml("/br", xml);

    const byExternal = new Map<string, string>();
    for (const [roomId, map] of Object.entries(ctx.roomMap)) {
      if (map.externalRoomId) byExternal.set(map.externalRoomId, roomId);
    }

    const reservations: ImportedReservation[] = [];
    for (const block of response.match(/<Booking\b[\s\S]*?<\/Booking>/g) ?? []) {
      const attr = (name: string, source = block) =>
        new RegExp(`${name}="([^"]*)"`).exec(source)?.[1] ?? "";
      const id = attr("id");
      const arrival = attr("start", /<StayDate[^>]*>/.exec(block)?.[0] ?? "");
      const departure = attr("end", /<StayDate[^>]*>/.exec(block)?.[0] ?? "");
      if (!id || !arrival || !departure) continue;

      const roomTypeId = attr("roomTypeID", /<RoomType[^>]*>/.exec(block)?.[0] ?? "");
      const givenName = /<GivenName>([^<]*)<\/GivenName>/.exec(block)?.[1] ?? "";
      const surname = /<Surname>([^<]*)<\/Surname>/.exec(block)?.[1] ?? "";

      reservations.push({
        externalId: id,
        roomId: byExternal.get(roomTypeId) ?? null,
        guestName: [givenName, surname].filter(Boolean).join(" ").trim(),
        checkIn: arrival.slice(0, 10),
        checkOut: departure.slice(0, 10),
        status: /type="Cancel"/i.test(block) ? "cancelled" : "confirmed",
        raw: { xml: block.slice(0, 4000) },
      });
    }
    return reservations;
  },

  async pushAvailability(ctx, days) {
    const { username, password, hotelId } = requireEqcCredentials(ctx.credentials);

    const updates: string[] = [];
    for (const [roomId, map] of Object.entries(ctx.roomMap)) {
      if (!map.externalRoomId) continue;
      for (const day of days.filter((d) => d.roomId === roomId)) {
        const closed = day.closed || day.free <= 0;
        const ratePlan = map.externalRateId
          ? `<RatePlan id="${escapeXml(map.externalRateId)}" closed="${closed}">` +
            `<Rate currency="EUR"><PerDay rate="${day.rate.toFixed(2)}"/></Rate>` +
            `<Restrictions minLOS="${day.minStay}"/>` +
            `</RatePlan>`
          : "";
        updates.push(
          `<AvailRateUpdate>` +
            `<DateRange from="${day.date}" to="${day.date}"/>` +
            `<RoomType id="${escapeXml(map.externalRoomId)}" closed="${closed}">` +
            `<Inventory totalInventoryAvailable="${closed ? 0 : day.free}"/>` +
            ratePlan +
            `</RoomType>` +
            `</AvailRateUpdate>`,
        );
      }
    }

    if (updates.length === 0) {
      throw new ChannelError("Nenhuma tipologia está mapeada para um room type da Expedia.");
    }

    await postXml(
      "/ar",
      `<?xml version="1.0" encoding="UTF-8"?>` +
        `<AvailRateUpdateRQ xmlns="http://www.expediaconnect.com/EQC/AR/2007/02">` +
        `<Authentication username="${escapeXml(username)}" password="${escapeXml(password)}"/>` +
        `<Hotel id="${escapeXml(hotelId)}"/>` +
        updates.join("") +
        `</AvailRateUpdateRQ>`,
    );
    return { items: updates.length, message: `${updates.length} atualizações enviadas.` };
  },
};

const BOOKING_GATE =
  "A API de conectividade do Booking.com é exclusiva de parceiros certificados e o registo de novos parceiros está encerrado. " +
  "O calendário iCal gratuito exige no máximo uma unidade por tipologia, o que este hotel (55 unidades em 6 tipologias) não cumpre. " +
  "O caminho viável é um channel manager certificado — por exemplo o Beds24, já disponível neste painel.";

export const bookingAdapter: ChannelAdapter = {
  id: "booking",
  name: "Booking.com (ligação direta)",
  selfServe: false,
  docsUrl: "https://developers.booking.com/connectivity/docs",
  availabilityNote: BOOKING_GATE,
  capabilities: {
    importReservations: false,
    exportAvailability: false,
    exportRates: false,
    exportRestrictions: false,
    webhooks: false,
  },
  credentialFields: [
    {
      key: "machineAccount",
      label: "Machine account",
      hint: "Só existe depois de o Booking.com certificar um parceiro de conectividade.",
      secret: true,
    },
    { key: "hotelId", label: "Hotel ID", hint: "39748 para o Vice-Rei." },
  ],

  async test() {
    // Failing loudly and explaining why beats a spinner that never resolves.
    throw new ChannelError("Ligação direta ao Booking.com indisponível.", BOOKING_GATE);
  },
};
