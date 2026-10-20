import type { ChannelAdapter } from "../types";

/**
 * A platform managed by hand in its own extranet (Weekendjeweg, Atrápalo,
 * HotelSpecials… or any OTA while there is no channel manager).
 *
 * Nothing is synchronised. What the PMS does is hold back an allotment —
 * a fixed number of units per room type — so the site and the desk cannot
 * sell the rooms the extranet is selling. Bookings made there are typed in
 * at the desk with source "Plataforma (extranet)" and consume the allotment.
 */
export const extranetAdapter: ChannelAdapter = {
  id: "extranet",
  name: "Extranet (gestão manual)",
  capabilities: {
    importReservations: false,
    exportAvailability: false,
    exportRates: false,
    exportRestrictions: false,
    webhooks: false,
  },
  credentialFields: [],
  docsUrl: "",
  availabilityNote:
    "Sem ligação automática: reserve um contingente de quartos por tipologia para esta plataforma, feche datas na extranet quando o hotel encher e introduza no PMS as reservas que lá entrarem.",
  selfServe: true,
  async test() {
    return { items: 0, message: "Canal manual — não há ligação a testar." };
  },
};
