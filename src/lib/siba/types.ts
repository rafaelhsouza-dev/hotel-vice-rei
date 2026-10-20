/**
 * Guest registration with SIBA (Sistema de Informação de Boletins de
 * Alojamento, Sistema de Segurança Interna), required for every foreign guest
 * within three working days of arrival.
 */

export type SibaConfig = {
  mode: "test" | "live";
  credentials: {
    /** NIPC of the establishment, 9 digits. */
    nipc?: string;
    /** Establishment number given by SIBA ("00" for the first). */
    establishment?: string;
    /** Access key sent by letter after registration (digits only). */
    accessKey?: string;
  };
  settings: Record<string, unknown>;
};

export type SibaEstablishment = {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  /** Contact shown on the bulletin. */
  contactName: string;
  phone: string;
  email: string;
};

/** One "boletim de alojamento". */
export type SibaBulletin = {
  /** Our booking_guests.id, for matching results back. */
  guestId: string;
  lastName: string;
  firstNames: string;
  /** ISO 3166-1 alpha-3, e.g. "FRA". */
  nationality: string;
  birthDate: string; // YYYY-MM-DD
  birthPlace: string;
  /** "P" passport, "B" ID card, "O" other — per SIBA's code list. */
  documentType: string;
  documentNumber: string;
  /** ISO alpha-3 of the issuing country. */
  documentCountry: string;
  /** ISO alpha-3 of the country of residence. */
  residenceCountry: string;
  residenceCity: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
};

export type SibaSubmitResult =
  | { ok: true; message: string }
  | { ok: false; code: string; message: string };
