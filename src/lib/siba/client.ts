/**
 * SIBA webservice client (SOAP 1.1, ASP.NET .asmx).
 *
 * From the WSDL (./reference/boletinsalojamento-*.wsdl.txt, fetched 2026-10-20):
 *   - one operation, EntregaBoletinsAlojamento(UnidadeHoteleira: string,
 *     Estabelecimento: int, ChaveAcesso: string, Boletins: string) → string
 *   - target namespace "http://sef.pt/", style document/literal
 *   - SOAPAction "http://sef.pt/EntregaBoletinsAlojamento"
 * Boletins is the BAL XML, UTF-8, Base64 (as SIBA's sample EnvioBA.zip does).
 * The result is "0" on success, otherwise an XML fragment with
 * <Codigo_Retorno> and <Descricao> — in practice (test webservice,
 * 2026-10-20) <ErrosBA><RetornoBA><Linha/><Codigo_Retorno/><Descricao/>
 * </RetornoBA>…</ErrosBA>, e.g. 12 invalid nationality, 42 entry date in the
 * future, 43 exit before entry, 60 authentication failed, 75 XSD violation.
 * The XML is validated against BAL.XSD server-side, and the whole file is
 * rejected when any bulletin has an error.
 *
 * There is no harmless method to call (no ping/login), so testConnection
 * only proves the endpoint answers and the credentials are well formed.
 */

import type { SibaBulletin, SibaConfig, SibaEstablishment, SibaSubmitResult } from "./types";
import {
  buildBalXml,
  checkCredentials,
  MAX_FILE_NUMBER,
  normalizeEstablishment,
  validateBulletin,
  validateEstablishment,
} from "./xml";

export { exportBulletinsFile } from "./xml";

export const SIBA_ENDPOINTS = {
  test: "https://siba.ssi.gov.pt/bawsdev/boletinsalojamento.asmx",
  live: "https://siba.ssi.gov.pt/baws/boletinsalojamento.asmx",
} as const;

export const SIBA_SOAP_NAMESPACE = "http://sef.pt/";
export const SIBA_SOAP_ACTION = "http://sef.pt/EntregaBoletinsAlojamento";

const TIMEOUT_MS = 30_000;

function endpoint(config: SibaConfig): string {
  return config.mode === "live" ? SIBA_ENDPOINTS.live : SIBA_ENDPOINTS.test;
}

function xmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

/** The SOAP 1.1 envelope for EntregaBoletinsAlojamento. */
export function buildSoapEnvelope(params: {
  nipc: string;
  establishment: string;
  accessKey: string;
  bulletinsBase64: string;
}): string {
  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
    `<soap:Body>` +
    `<EntregaBoletinsAlojamento xmlns="${SIBA_SOAP_NAMESPACE}">` +
    `<UnidadeHoteleira>${xmlText(params.nipc)}</UnidadeHoteleira>` +
    `<Estabelecimento>${xmlText(params.establishment)}</Estabelecimento>` +
    `<ChaveAcesso>${xmlText(params.accessKey)}</ChaveAcesso>` +
    `<Boletins>${params.bulletinsBase64}</Boletins>` +
    `</EntregaBoletinsAlojamento>` +
    `</soap:Body>` +
    `</soap:Envelope>`
  );
}

function tag(xml: string, name: string): string | null {
  const m = new RegExp(`<(?:[\\w.-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${name}>`).exec(xml);
  return m ? m[1] : null;
}

/** Interpret the HTTP response of EntregaBoletinsAlojamento. */
export function parseSoapResponse(status: number, body: string): SibaSubmitResult {
  const result = tag(body, "EntregaBoletinsAlojamentoResult");
  if (result !== null) {
    const text = decodeEntities(result).trim();
    if (text === "0") return { ok: true, message: "Boletins entregues ao SIBA. O SIBA envia a confirmação por e-mail." };
    // Observed on the test webservice (2026-10-20): <ErrosBA><RetornoBA><Linha/>
    // <Codigo_Retorno/><Descricao/></RetornoBA>…</ErrosBA>, one RetornoBA per error.
    const blocks = text.match(/<(?:[\w.-]+:)?RetornoBA\b[\s\S]*?<\/(?:[\w.-]+:)?RetornoBA>/g) ?? [text];
    const errors = blocks
      .map((block) => ({
        code: decodeEntities(tag(block, "Codigo_Retorno") ?? "").trim(),
        description: decodeEntities(tag(block, "Descricao") ?? "").trim(),
      }))
      .filter((e) => e.code || e.description);
    if (errors.length > 0) {
      const list = errors.map((e) => e.description || `erro ${e.code}`);
      return {
        ok: false,
        code: errors[0].code || "SIBA",
        message:
          list.length === 1
            ? `O SIBA recusou o envio: ${list[0]}`
            : `O SIBA recusou o envio (${list.length} erros):\n${list.map((l) => `- ${l}`).join("\n")}`,
      };
    }
    return { ok: false, code: "SIBA", message: `Resposta inesperada do SIBA: ${text.slice(0, 300) || "(vazia)"}` };
  }
  const fault = tag(body, "faultstring");
  if (fault !== null) {
    return { ok: false, code: "SOAP_FAULT", message: `Erro do webservice do SIBA: ${decodeEntities(fault).trim().slice(0, 300)}` };
  }
  return {
    ok: false,
    code: `HTTP_${status}`,
    message: `O SIBA respondeu com HTTP ${status} sem resultado reconhecível.`,
  };
}

type Failure = Extract<SibaSubmitResult, { ok: false }>;

function networkError(err: unknown): Failure {
  const name = (err as { name?: string })?.name;
  if (name === "TimeoutError" || name === "AbortError") {
    return { ok: false, code: "TIMEOUT", message: "O SIBA não respondeu em 30 segundos. Tente de novo mais tarde." };
  }
  return {
    ok: false,
    code: "NETWORK",
    message: `Não foi possível contactar o SIBA: ${(err as Error)?.message ?? String(err)}`,
  };
}

/**
 * Everything that would stop a submission, in pt-PT, prefixed with the
 * guest's position when it concerns a bulletin. Empty = ready.
 */
export function preflight(
  config: SibaConfig,
  establishment: SibaEstablishment,
  bulletins: SibaBulletin[],
  fileNumber: number,
  today?: string,
): string[] {
  const errors = checkCredentials(config).errors.map((e) => e.message);
  errors.push(...validateEstablishment(establishment));
  if (!Number.isInteger(fileNumber) || fileNumber < 1 || fileNumber > MAX_FILE_NUMBER)
    errors.push(`Número de ficheiro inválido (1 a ${MAX_FILE_NUMBER}).`);
  if (bulletins.length === 0) errors.push("Não há boletins para enviar.");
  bulletins.forEach((b, i) => {
    const who = [b.firstNames, b.lastName].map((s) => (s ?? "").trim()).filter(Boolean).join(" ") || `hóspede ${i + 1}`;
    for (const e of validateBulletin(b, today)) errors.push(`${who}: ${e}`);
  });
  return errors;
}

/**
 * Send bulletins to SIBA. Validates first and does not call SIBA when
 * anything is wrong (code "VALIDATION"). `fileNumber` must increase with
 * each file the establishment sends (Numero_Ficheiro, up to 5 digits).
 */
export async function submitBulletins(
  config: SibaConfig,
  establishment: SibaEstablishment,
  bulletins: SibaBulletin[],
  fileNumber: number,
  options: { now?: Date } = {},
): Promise<SibaSubmitResult> {
  const now = options.now ?? new Date();
  const problems = preflight(config, establishment, bulletins, fileNumber);
  if (problems.length > 0) return { ok: false, code: "VALIDATION", message: problems.join("\n") };

  const xml = buildBalXml(establishment, config, bulletins, fileNumber, now);
  const envelope = buildSoapEnvelope({
    nipc: (config.credentials.nipc ?? "").trim(),
    establishment: normalizeEstablishment(config.credentials.establishment),
    accessKey: (config.credentials.accessKey ?? "").trim(),
    bulletinsBase64: Buffer.from(xml, "utf8").toString("base64"),
  });

  let res: Response;
  try {
    res = await fetch(endpoint(config), {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `"${SIBA_SOAP_ACTION}"`,
      },
      body: envelope,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return networkError(err);
  }
  let text: string;
  try {
    text = await res.text();
  } catch (err) {
    return networkError(err);
  }
  const parsed = parseSoapResponse(res.status, text);
  if (parsed.ok) {
    const n = bulletins.length;
    return { ok: true, message: `${n} ${n === 1 ? "boletim entregue" : "boletins entregues"} ao SIBA. O SIBA envia a confirmação por e-mail.` };
  }
  return parsed;
}

/**
 * The most SIBA allows without sending a bulletin: the selected environment's
 * WSDL is fetched (proves the webservice is reachable and is SIBA's) and the
 * credentials are checked for format. The access key itself is only checked
 * by SIBA on the first real submission.
 */
export async function testConnection(config: SibaConfig): Promise<SibaSubmitResult> {
  const env = config.mode === "live" ? "produção" : "testes";
  const { errors, warnings } = checkCredentials(config);

  let res: Response;
  try {
    res = await fetch(`${endpoint(config)}?wsdl`, { method: "GET", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    const n = networkError(err);
    return { ok: false, code: n.code, message: `Webservice do SIBA (${env}) inacessível. ${n.message}` };
  }
  const body = await res.text().catch(() => "");
  if (!res.ok || !body.includes("EntregaBoletinsAlojamento")) {
    return {
      ok: false,
      code: `HTTP_${res.status}`,
      message: `O endereço do SIBA (${env}) respondeu, mas não com o webservice esperado (HTTP ${res.status}).`,
    };
  }
  if (errors.length > 0) {
    return {
      ok: false,
      code: "CREDENTIALS",
      message: `Webservice acessível (${env}), mas as credenciais têm erros: ${errors.map((e) => e.message).join(" ")}`,
    };
  }
  const note = warnings.length ? ` ${warnings.join(" ")}` : "";
  return {
    ok: true,
    message: `Webservice acessível (${env}) e credenciais com formato válido. A chave só é validada no primeiro envio.${note}`,
  };
}
