/**
 * The SIBA bulletin file: XML per BAL.XSD (webservice) and the ".DAT" text
 * file (portal upload). Pure functions only — no I/O.
 *
 * Source of truth: ./reference/bal.xsd.txt (https://siba.ssi.gov.pt/s/documentacao/XSD/bal.XSD)
 * and the field tables in ./reference/modos-de-envio.pagina.txt
 * (https://siba.ssi.gov.pt/ajuda/modos-de-envio/), both fetched 2026-10-20.
 *
 * XML structure (namespace http://sef.pt/BAws, elementFormDefault=qualified):
 *
 *   <MovimentoBAL xmlns="http://sef.pt/BAws">
 *     <Unidade_Hoteleira>
 *       Codigo_Unidade_Hoteleira(9) Estabelecimento(2) Nome(40) Abreviatura(15)
 *       Morada(40) Localidade(30) Codigo_Postal(4) Zona_Postal(3) Telefone(10)
 *       Fax(10) Nome_Contacto(40) Email_Contacto(140, optional)
 *     </Unidade_Hoteleira>
 *     <Boletim_Alojamento>  (one per guest)
 *       Apelido(40) Nome(40, optional) Nacionalidade(3) Data_Nascimento(dateTime)
 *       Local_Nascimento(30, optional) Documento_Identificacao(16)
 *       Pais_Emissor_Documento(3) Tipo_Documento(3) Data_Entrada(dateTime)
 *       Data_Saida(dateTime, optional) Pais_Residencia_Origem(3)
 *       Local_Residencia_Origem(30, may be empty)
 *     </Boletim_Alojamento>
 *     <Envio> Numero_Ficheiro(int) Data_Movimento(dateTime) </Envio>
 *   </MovimentoBAL>
 */

import type { SibaBulletin, SibaConfig, SibaEstablishment } from "./types";
import {
  countryNamePt,
  isAlpha3,
  isSibaDocumentType,
  requiresBulletin,
  TERRITORY_SOVEREIGN,
  toSibaCountryCode,
} from "./countries";

export const BAL_NAMESPACE = "http://sef.pt/BAws";

/** xs:maxLength of every string element in BAL.XSD. */
export const BAL_MAX_LENGTH = {
  Codigo_Unidade_Hoteleira: 9,
  Estabelecimento: 2,
  Nome: 40,
  Abreviatura: 15,
  Morada: 40,
  Localidade: 30,
  Codigo_Postal: 4,
  Zona_Postal: 3,
  Telefone: 10,
  Fax: 10,
  Nome_Contacto: 40,
  Email_Contacto: 140,
  Apelido: 40,
  NomeHospede: 40,
  Nacionalidade: 3,
  Local_Nascimento: 30,
  Documento_Identificacao: 16,
  Pais_Emissor_Documento: 3,
  Tipo_Documento: 3,
  Pais_Residencia_Origem: 3,
  Local_Residencia_Origem: 30,
} as const;

/** "Numero_Ficheiro … Numérico, 5" (modos de envio). */
export const MAX_FILE_NUMBER = 99999;

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

/** Characters forbidden in XML 1.0 (C0 controls except tab, LF, CR). */
const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

export function escapeXml(value: string): string {
  return value
    .replace(XML_INVALID, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Cut to `max` characters (code points, as xs:maxLength counts them). */
export function truncate(value: string, max: number): string {
  const chars = Array.from(value);
  return chars.length <= max ? value : chars.slice(0, max).join("").trimEnd();
}

/** Trim, drop control characters and collapse runs of whitespace. */
function clean(value: string | undefined | null): string {
  return (value ?? "").replace(XML_INVALID, " ").replace(/\s+/g, " ").trim();
}

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Accented capitals SIBA accepts in names: "[ÇÃÁÀÉÊÍÕÔÓÚ'-] e espaço". */
const NAME_ACCENTED = "ÇÃÁÀÉÊÍÕÔÓÚ";
const LETTER_MAP: Record<string, string> = {
  ß: "SS", ẞ: "SS", Æ: "AE", Œ: "OE", Ø: "O", Ð: "D", Đ: "D", Þ: "TH", Ł: "L", Ħ: "H",
};
const APOSTROPHES = /[‘’ʼ`´]/g;

/**
 * A guest name the way SIBA accepts it: capitals A–Z, the Portuguese accented
 * capitals ÇÃÁÀÉÊÍÕÔÓÚ, apostrophe, hyphen and single spaces, not starting
 * with a space. Other Latin letters lose their accent (Müller → MULLER,
 * Núñez → NÚNEZ, Søren → SOREN); anything else becomes a space.
 */
export function sibaName(value: string): string {
  let out = "";
  for (const ch of clean(value).replace(APOSTROPHES, "'").toUpperCase()) {
    if ((ch >= "A" && ch <= "Z") || ch === " " || ch === "-" || ch === "'") out += ch;
    else if (NAME_ACCENTED.includes(ch)) out += ch;
    else if (LETTER_MAP[ch]) out += LETTER_MAP[ch];
    else {
      const base = stripDiacritics(ch);
      out += /^[A-Z]+$/.test(base) ? base : " ";
    }
  }
  return out.replace(/\s+/g, " ").replace(/^[\s'-]+|[\s'-]+$/g, "");
}

/** Document number: only 0–9 and A–Z ("sem espaços embebidos"). */
export function sibaDocumentNumber(value: string): string {
  return stripDiacritics(clean(value).toUpperCase()).replace(/[^0-9A-Z]/g, "");
}

/** Digits only; a leading +351 / 00351 is dropped. */
export function sibaPhone(value: string): string {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 14 && digits.startsWith("00351")) return digits.slice(5);
  if (digits.length === 12 && digits.startsWith("351")) return digits.slice(3);
  return digits;
}

/** "4700-123" → { code: "4700", zone: "123" }; null if not a PT postal code. */
export function splitPostalCode(value: string): { code: string; zone: string } | null {
  const m = /^(\d{4})\s*-?\s*(\d{3})$/.exec(clean(value));
  return m ? { code: m[1], zone: m[2] } : null;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date written YYYY-MM-DD. */
export function isYmd(value: string): boolean {
  const m = YMD.exec(value ?? "");
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** xs:dateTime for a calendar date, without time zone: "1980-05-12T00:00:00". */
export function balDate(ymd: string): string {
  return `${ymd}T00:00:00`;
}

function lisbonParts(now: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const out: Record<string, string> = {};
  for (const p of parts) out[p.type] = p.value;
  return out;
}

/** Today in Lisbon, YYYY-MM-DD. */
export function lisbonToday(now: Date = new Date()): string {
  const p = lisbonParts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Lisbon wall-clock time as xs:dateTime without zone: "2026-10-20T14:05:09". */
export function lisbonDateTime(now: Date): string {
  const p = lisbonParts(now);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

/** Portuguese NIF/NIPC check digit (mod 11, weights 9…2). */
export function isValidNipc(value: string): boolean {
  if (!/^\d{9}$/.test(value)) return false;
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += Number(value[i]) * (9 - i);
  const check = 11 - (sum % 11);
  return (check >= 10 ? 0 : check) === Number(value[8]);
}

/** "0" → "00"; establishment numbers are two digits in BAL.XSD. */
export function normalizeEstablishment(value: string | undefined): string {
  const v = (value ?? "").trim();
  return /^\d$/.test(v) ? `0${v}` : v;
}

export type CredentialIssue = { field: "nipc" | "establishment" | "accessKey"; message: string };

/**
 * Format checks on the credentials. The NIPC check digit is a warning-level
 * issue in test mode only: SIBA's own fictitious test unit (121212121, from
 * EnvioBA.zip) fails it.
 */
export function checkCredentials(config: SibaConfig): { errors: CredentialIssue[]; warnings: string[] } {
  const { nipc = "", establishment, accessKey = "" } = config.credentials;
  const errors: CredentialIssue[] = [];
  const warnings: string[] = [];
  const n = nipc.trim();
  if (!n) errors.push({ field: "nipc", message: "Falta o NIPC do estabelecimento." });
  else if (!/^\d{9}$/.test(n)) errors.push({ field: "nipc", message: "O NIPC tem de ter 9 algarismos." });
  else if (!isValidNipc(n)) {
    if (config.mode === "live") errors.push({ field: "nipc", message: "O NIPC não é válido (dígito de controlo errado)." });
    else warnings.push("O NIPC não passa o dígito de controlo (aceite apenas no ambiente de testes).");
  }
  const e = normalizeEstablishment(establishment);
  if (!e) errors.push({ field: "establishment", message: "Falta o número de estabelecimento (\"00\" para o primeiro)." });
  else if (!/^\d{2}$/.test(e)) errors.push({ field: "establishment", message: "O número de estabelecimento tem de ter 2 algarismos (ex.: 00)." });
  const k = accessKey.trim();
  if (!k) errors.push({ field: "accessKey", message: "Falta a chave de acesso enviada pelo SIBA." });
  else if (!/^\d+$/.test(k)) errors.push({ field: "accessKey", message: "A chave de acesso só tem algarismos." });
  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function countryIssue(value: string, missing: string, label: string): string | null {
  const v = clean(value).toUpperCase();
  if (!v) return missing;
  if (toSibaCountryCode(v)) return null;
  if (v in TERRITORY_SOVEREIGN) {
    const sovereign = TERRITORY_SOVEREIGN[v];
    const name = countryNamePt(v) ?? v;
    return sovereign
      ? `${label}: ${name} não consta da tabela de países do SIBA; use ${countryNamePt(sovereign)} (${sovereign}).`
      : `${label}: ${name} não consta da tabela de países do SIBA.`;
  }
  return isAlpha3(v)
    ? `${label}: o país ${v} não consta da tabela de países do SIBA.`
    : `${label}: código de país inválido "${v}" (use o código de 3 letras, ex.: FRA).`;
}

/**
 * Problems that would make SIBA reject the bulletin, in pt-PT, for the desk
 * to fix before sending. Empty array = ready to send.
 *
 * @param today YYYY-MM-DD in Lisbon; defaults to the current date.
 */
export function validateBulletin(b: SibaBulletin, today: string = lisbonToday()): string[] {
  const errors: string[] = [];

  const last = sibaName(b.lastName ?? "");
  const first = sibaName(b.firstNames ?? "");
  if (!last && !first) {
    errors.push(
      clean(b.lastName) || clean(b.firstNames)
        ? "O nome tem de ser escrito em caracteres latinos, como no documento."
        : "Falta o nome do hóspede.",
    );
  }

  const nat = clean(b.nationality).toUpperCase();
  const natIssue = countryIssue(nat, "Falta a nacionalidade.", "Nacionalidade");
  if (natIssue) errors.push(natIssue);
  else if (!requiresBulletin(nat)) errors.push("Hóspede de nacionalidade portuguesa: não se comunica ao SIBA.");

  if (!clean(b.birthDate)) errors.push("Falta a data de nascimento.");
  else if (!isYmd(b.birthDate)) errors.push("Data de nascimento inválida.");
  else if (b.birthDate >= today) errors.push("A data de nascimento tem de ser anterior a hoje.");

  const doc = sibaDocumentNumber(b.documentNumber ?? "");
  if (!doc) errors.push("Documento de identificação em falta.");
  else if (doc.length > BAL_MAX_LENGTH.Documento_Identificacao)
    errors.push("O número do documento tem mais de 16 caracteres.");

  const type = clean(b.documentType).toUpperCase();
  if (!type) errors.push("Falta o tipo de documento.");
  else if (!isSibaDocumentType(type)) errors.push("Tipo de documento inválido (P passaporte, B bilhete de identidade, O outro).");

  const docCountry = countryIssue(b.documentCountry, "Falta o país emissor do documento.", "País emissor do documento");
  if (docCountry) errors.push(docCountry);

  const resCountry = countryIssue(b.residenceCountry, "Falta o país de residência.", "País de residência");
  if (resCountry) errors.push(resCountry);
  // Local_Residencia_Origem may be empty: optional per the FAQ (P19) and the
  // DAT spec, and SIBA's test webservice accepted an empty element (2026-10-20).

  if (!clean(b.checkIn)) errors.push("Falta a data de entrada.");
  else if (!isYmd(b.checkIn)) errors.push("Data de entrada inválida.");
  else if (b.checkIn > today) errors.push("A data de entrada não pode ser futura: só se comunica quem já fez check-in.");

  if (clean(b.checkOut)) {
    if (!isYmd(b.checkOut)) errors.push("Data de saída inválida.");
    else if (isYmd(b.checkIn) && b.checkOut < b.checkIn)
      errors.push("A data de saída não pode ser anterior à data de entrada.");
  }
  if (isYmd(b.birthDate) && isYmd(b.checkIn) && b.birthDate > b.checkIn)
    errors.push("A data de nascimento é posterior à data de entrada.");

  return errors;
}

/** Problems with the establishment header (Unidade_Hoteleira), in pt-PT. */
export function validateEstablishment(e: SibaEstablishment): string[] {
  const errors: string[] = [];
  if (!clean(e.name)) errors.push("Falta o nome do estabelecimento.");
  if (!clean(e.address)) errors.push("Falta a morada do estabelecimento.");
  if (!clean(e.city)) errors.push("Falta a localidade do estabelecimento.");
  if (!splitPostalCode(e.postalCode)) errors.push("Código postal do estabelecimento inválido (formato 0000-000).");
  const phone = sibaPhone(e.phone);
  if (!phone) errors.push("Falta o telefone do estabelecimento.");
  else if (phone.length !== 9) errors.push("O telefone do estabelecimento tem de ter 9 algarismos.");
  if (!clean(e.contactName)) errors.push("Falta o nome do contacto do estabelecimento.");
  if (clean(e.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(e.email)))
    errors.push("E-mail de contacto do estabelecimento inválido.");
  return errors;
}

// ---------------------------------------------------------------------------
// Field preparation shared by XML and DAT
// ---------------------------------------------------------------------------

function settingString(config: SibaConfig, key: string): string {
  const v = config.settings?.[key];
  return typeof v === "string" ? clean(v) : "";
}

type Header = {
  nipc: string;
  establishment: string;
  name: string;
  abbreviation: string;
  address: string;
  city: string;
  postalCode: string;
  postalZone: string;
  phone: string;
  fax: string;
  contactName: string;
  email: string;
};

function header(establishment: SibaEstablishment, config: SibaConfig): Header {
  const pc = splitPostalCode(establishment.postalCode);
  const name = clean(establishment.name);
  return {
    nipc: (config.credentials.nipc ?? "").trim(),
    establishment: normalizeEstablishment(config.credentials.establishment),
    name,
    abbreviation: settingString(config, "abbreviation") || name,
    address: clean(establishment.address),
    city: clean(establishment.city),
    postalCode: pc?.code ?? "",
    postalZone: pc?.zone ?? "",
    phone: sibaPhone(establishment.phone),
    fax: sibaPhone(settingString(config, "fax")),
    contactName: clean(establishment.contactName),
    email: clean(establishment.email),
  };
}

type Guest = {
  lastName: string;
  firstNames: string;
  nationality: string;
  birthDate: string;
  birthPlace: string;
  documentNumber: string;
  documentType: string;
  documentCountry: string;
  checkIn: string;
  checkOut: string;
  residenceCountry: string;
  residenceCity: string;
};

function guest(b: SibaBulletin): Guest {
  let last = sibaName(b.lastName ?? "");
  let first = sibaName(b.firstNames ?? "");
  // "Se o nome do hóspede só tiver um nome, este deverá ser posto neste campo [Apelido]".
  if (!last) [last, first] = [first, ""];
  const country = (v: string) => toSibaCountryCode(v ?? "") ?? clean(v).toUpperCase();
  return {
    lastName: last,
    firstNames: first,
    nationality: country(b.nationality),
    birthDate: clean(b.birthDate),
    birthPlace: clean(b.birthPlace),
    documentNumber: sibaDocumentNumber(b.documentNumber ?? ""),
    documentType: clean(b.documentType).toUpperCase(),
    documentCountry: country(b.documentCountry),
    checkIn: clean(b.checkIn),
    checkOut: clean(b.checkOut),
    residenceCountry: country(b.residenceCountry),
    residenceCity: clean(b.residenceCity),
  };
}

// ---------------------------------------------------------------------------
// XML (webservice)
// ---------------------------------------------------------------------------

function el(name: string, value: string, max?: number): string {
  const v = max ? truncate(value, max) : value;
  return `<${name}>${escapeXml(v)}</${name}>`;
}

/**
 * The XML for EntregaBoletinsAlojamento's `Boletins` parameter (before
 * Base64), valid against BAL.XSD. Does not validate the data — call
 * validateBulletin / validateEstablishment / checkCredentials first.
 */
export function buildBalXml(
  establishment: SibaEstablishment,
  config: SibaConfig,
  bulletins: SibaBulletin[],
  fileNumber: number,
  now: Date,
): string {
  const L = BAL_MAX_LENGTH;
  const h = header(establishment, config);
  const out: string[] = [];
  out.push(`<?xml version="1.0" encoding="utf-8"?>`);
  out.push(`<MovimentoBAL xmlns="${BAL_NAMESPACE}">`);
  out.push(
    "  <Unidade_Hoteleira>" +
      el("Codigo_Unidade_Hoteleira", h.nipc, L.Codigo_Unidade_Hoteleira) +
      el("Estabelecimento", h.establishment, L.Estabelecimento) +
      el("Nome", h.name, L.Nome) +
      el("Abreviatura", h.abbreviation, L.Abreviatura) +
      el("Morada", h.address, L.Morada) +
      el("Localidade", h.city, L.Localidade) +
      el("Codigo_Postal", h.postalCode, L.Codigo_Postal) +
      el("Zona_Postal", h.postalZone, L.Zona_Postal) +
      el("Telefone", h.phone, L.Telefone) +
      // Required by the XSD even though the field is optional ("exceto o <Fax>").
      el("Fax", h.fax, L.Fax) +
      el("Nome_Contacto", h.contactName, L.Nome_Contacto) +
      (h.email ? el("Email_Contacto", h.email, L.Email_Contacto) : "") +
      "</Unidade_Hoteleira>",
  );
  for (const b of bulletins) {
    const g = guest(b);
    out.push(
      "  <Boletim_Alojamento>" +
        el("Apelido", g.lastName, L.Apelido) +
        (g.firstNames ? el("Nome", g.firstNames, L.NomeHospede) : "") +
        el("Nacionalidade", g.nationality, L.Nacionalidade) +
        el("Data_Nascimento", balDate(g.birthDate)) +
        (g.birthPlace ? el("Local_Nascimento", g.birthPlace, L.Local_Nascimento) : "") +
        el("Documento_Identificacao", g.documentNumber, L.Documento_Identificacao) +
        el("Pais_Emissor_Documento", g.documentCountry, L.Pais_Emissor_Documento) +
        el("Tipo_Documento", g.documentType, L.Tipo_Documento) +
        el("Data_Entrada", balDate(g.checkIn)) +
        (g.checkOut ? el("Data_Saida", balDate(g.checkOut)) : "") +
        el("Pais_Residencia_Origem", g.residenceCountry, L.Pais_Residencia_Origem) +
        el("Local_Residencia_Origem", g.residenceCity, L.Local_Residencia_Origem) +
        "</Boletim_Alojamento>",
    );
  }
  out.push(
    "  <Envio>" +
      el("Numero_Ficheiro", String(Math.trunc(fileNumber))) +
      el("Data_Movimento", lisbonDateTime(now)) +
      "</Envio>",
  );
  out.push("</MovimentoBAL>");
  return out.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// .DAT (portal upload, "Entrega de Boletins – Carregamento de Ficheiros")
// ---------------------------------------------------------------------------

/** "Alfabético Limitado": capitals A–Z, space, hyphen, quotes, apostrophe, comma, period. */
function datLimited(value: string, max: number, allowDigits = false): string {
  const v = stripDiacritics(clean(value).replace(APOSTROPHES, "'").toUpperCase())
    .replace(allowDigits ? /[^A-Z0-9 \-"',.]/g : /[^A-Z \-"',.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return truncate(v, max);
}

function datEmail(value: string): string {
  return truncate(clean(value).toUpperCase().replace(/[|\s]/g, ""), 140);
}

const ymdCompact = (ymd: string) => ymd.replace(/-/g, "");
const pad = (n: number, width: number) => String(Math.trunc(n)).padStart(width, "0");

/**
 * The ".DAT" text file for the portal upload, exactly as described in
 * "UPLOAD DE FICHEIROS" (modos de envio): pipe-terminated fields, one header
 * record (0), one record per guest (1) and a trailer (9). Lines end in CRLF.
 *
 * Note the field order differs from the XML: Local de Nascimento comes
 * before Data de Nascimento, and the dates come last.
 */
export function buildBalDat(
  establishment: SibaEstablishment,
  config: SibaConfig,
  bulletins: SibaBulletin[],
  fileNumber: number,
  now: Date,
): string {
  const h = header(establishment, config);
  const line = (fields: string[]) => fields.map((f) => f.replace(/\|/g, " ")).join("|") + "|";
  const lines: string[] = [];
  lines.push(
    line([
      "0",
      "BA03",
      h.nipc,
      h.establishment,
      datLimited(h.name, 40, true),
      // Digits kept: an address without the door number would overwrite the
      // registered one (the header updates "Morada, Telefone/Fax e contacto").
      datLimited(h.address, 40, true),
      datLimited(h.city, 30),
      h.postalCode,
      h.postalZone,
      truncate(h.phone, 10),
      truncate(h.fax, 10),
      datLimited(h.contactName, 40),
      datEmail(h.email),
    ]),
  );
  for (const b of bulletins) {
    const g = guest(b);
    lines.push(
      line([
        "1",
        truncate(g.lastName, 40),
        truncate(g.firstNames, 40),
        g.nationality,
        datLimited(g.birthPlace, 40),
        ymdCompact(g.birthDate),
        truncate(g.documentNumber, 16),
        g.documentType,
        g.documentCountry,
        g.residenceCountry,
        datLimited(g.residenceCity, 30),
        ymdCompact(g.checkIn),
        g.checkOut ? ymdCompact(g.checkOut) : "",
      ]),
    );
  }
  lines.push(line(["9", pad(bulletins.length + 2, 5), ymdCompact(lisbonToday(now)), pad(fileNumber, 5)]));
  return lines.join("\r\n") + "\r\n";
}

export type SibaExportFile = {
  format: "dat" | "xml";
  /** "<NIF><Estabelecimento><Numero de Ficheiro>.DAT" for the portal. */
  fileName: string;
  contentType: string;
  /** The text, for preview. */
  content: string;
  /** What to write to disk / send as the download body. */
  bytes: Uint8Array;
};

/**
 * The bulletins as a file for the portal (manual fallback).
 *
 * The SIBA portal's "Carregamento de Ficheiros" takes the .DAT text format,
 * not XML (perguntas técnicas P01/P15: "ficheiro em formato de texto com
 * extensão DAT"); the XML only goes through the webservice. `format: "xml"`
 * returns the raw BAL XML (not Base64), useful for SIBA support (P15: send
 * the failing XML to siba@ssi.gov.pt) or for inspection.
 *
 * The .DAT encoding is not documented; it is written as ISO-8859-1, which
 * holds every character the name rule allows (ÇÃÁÀÉÊÍÕÔÓÚ).
 */
export function exportBulletinsFile(
  config: SibaConfig,
  establishment: SibaEstablishment,
  bulletins: SibaBulletin[],
  fileNumber: number,
  options: { format?: "dat" | "xml"; now?: Date } = {},
): SibaExportFile {
  const format = options.format ?? "dat";
  const now = options.now ?? new Date();
  const base = `${(config.credentials.nipc ?? "").trim()}${normalizeEstablishment(config.credentials.establishment)}${pad(fileNumber, 5)}`;
  if (format === "xml") {
    const content = buildBalXml(establishment, config, bulletins, fileNumber, now);
    return {
      format,
      fileName: `${base}.xml`,
      contentType: "application/xml; charset=utf-8",
      content,
      bytes: new Uint8Array(Buffer.from(content, "utf8")),
    };
  }
  const content = buildBalDat(establishment, config, bulletins, fileNumber, now);
  return {
    format,
    fileName: `${base}.DAT`,
    contentType: "text/plain; charset=iso-8859-1",
    content,
    bytes: new Uint8Array(Buffer.from(content, "latin1")),
  };
}
