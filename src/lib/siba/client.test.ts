import { afterEach, describe, expect, it, vi } from "vitest";
import type { SibaBulletin, SibaConfig, SibaEstablishment } from "./types";
import {
  buildSoapEnvelope,
  parseSoapResponse,
  SIBA_ENDPOINTS,
  SIBA_SOAP_ACTION,
  submitBulletins,
  testConnection,
} from "./client";

const config: SibaConfig = {
  mode: "test",
  credentials: { nipc: "123456789", establishment: "00", accessKey: "4815162342" },
  settings: {},
};

const establishment: SibaEstablishment = {
  name: "Hotel Vice-Rei",
  address: "Rua Exemplo, 12",
  city: "Braga",
  postalCode: "4700-123",
  contactName: "Receção",
  phone: "253000000",
  email: "rececao@example.pt",
};

const guest: SibaBulletin = {
  guestId: "g1",
  lastName: "Dupont",
  firstNames: "Élodie",
  nationality: "FRA",
  birthDate: "1985-03-09",
  birthPlace: "",
  documentType: "P",
  documentNumber: "12AB34567",
  documentCountry: "FRA",
  residenceCountry: "FRA",
  residenceCity: "Paris",
  checkIn: "2020-01-01",
  checkOut: "2020-01-03",
};

const soap = (result: string) =>
  `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap:Body><EntregaBoletinsAlojamentoResponse xmlns="http://sef.pt/"><EntregaBoletinsAlojamentoResult>${result}</EntregaBoletinsAlojamentoResult></EntregaBoletinsAlojamentoResponse></soap:Body></soap:Envelope>`;

/** Verbatim from SIBA's test webservice, 2026-10-20 (nationality "DEU"). */
const REAL_ERROR = soap(`&lt;ErrosBA xmlns="http://www.sef.pt/BAws"&gt;
  &lt;RetornoBA&gt;
    &lt;Linha&gt;2&lt;/Linha&gt;
    &lt;Codigo_Retorno&gt;12&lt;/Codigo_Retorno&gt;
    &lt;Descricao&gt;Registo 2 - O boletim de HANS TESTMANN tem a Nacionalidade 'DEU' que é Inválida.&lt;/Descricao&gt;
  &lt;/RetornoBA&gt;
&lt;/ErrosBA&gt;`);

/** Same service, two errors in one file (future entry date). */
const REAL_TWO_ERRORS = soap(`&lt;ErrosBA xmlns="http://www.sef.pt/BAws"&gt;
  &lt;RetornoBA&gt;&lt;Linha&gt;2&lt;/Linha&gt;&lt;Codigo_Retorno&gt;42&lt;/Codigo_Retorno&gt;&lt;Descricao&gt;Registo 2 - A Data de Entrada não pode ser posterior à de hoje&lt;/Descricao&gt;&lt;/RetornoBA&gt;
  &lt;RetornoBA&gt;&lt;Linha&gt;2&lt;/Linha&gt;&lt;Codigo_Retorno&gt;43&lt;/Codigo_Retorno&gt;&lt;Descricao&gt;Registo 2 - Data de Saída anterior à Data de Entrada&lt;/Descricao&gt;&lt;/RetornoBA&gt;
&lt;/ErrosBA&gt;`);

function mockFetch(impl: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => impl(String(url), init));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SOAP envelope", () => {
  it("is SOAP 1.1 document/literal in the http://sef.pt/ namespace, parameters in WSDL order", () => {
    const env = buildSoapEnvelope({ nipc: "123456789", establishment: "00", accessKey: "1<2", bulletinsBase64: "QUJD" });
    expect(env).toContain('xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"');
    expect(env).toContain('<EntregaBoletinsAlojamento xmlns="http://sef.pt/">');
    const order = [...env.matchAll(/<(UnidadeHoteleira|Estabelecimento|ChaveAcesso|Boletins)>/g)].map((m) => m[1]);
    expect(order).toEqual(["UnidadeHoteleira", "Estabelecimento", "ChaveAcesso", "Boletins"]);
    expect(env).toContain("<ChaveAcesso>1&lt;2</ChaveAcesso>");
    expect(env).toContain("<Boletins>QUJD</Boletins>");
  });
});

describe("parseSoapResponse", () => {
  it('treats "0" as success', () => {
    expect(parseSoapResponse(200, soap("0")).ok).toBe(true);
  });

  it("reads SIBA's error code and description", () => {
    expect(parseSoapResponse(200, REAL_ERROR)).toEqual({
      ok: false,
      code: "12",
      message: "O SIBA recusou o envio: Registo 2 - O boletim de HANS TESTMANN tem a Nacionalidade 'DEU' que é Inválida.",
    });
  });

  it("lists every error when there are several", () => {
    const r = parseSoapResponse(200, REAL_TWO_ERRORS);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("42");
    expect(r.message).toBe(
      "O SIBA recusou o envio (2 erros):\n- Registo 2 - A Data de Entrada não pode ser posterior à de hoje\n- Registo 2 - Data de Saída anterior à Data de Entrada",
    );
  });

  it("reads the bare Codigo_Retorno/Descricao form from the documentation", () => {
    const r = parseSoapResponse(200, soap("&lt;Codigo_Retorno&gt;60&lt;/Codigo_Retorno&gt;&lt;Descricao&gt;Não foi possível autenticar a Unidade Hoteleira&lt;/Descricao&gt;"));
    expect(r).toEqual({ ok: false, code: "60", message: "O SIBA recusou o envio: Não foi possível autenticar a Unidade Hoteleira" });
  });

  it("reports SOAP faults and unknown bodies", () => {
    const fault = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><soap:Fault><faultcode>soap:Server</faultcode><faultstring>Server was unable to process request.</faultstring></soap:Fault></soap:Body></soap:Envelope>`;
    expect(parseSoapResponse(500, fault)).toEqual({
      ok: false,
      code: "SOAP_FAULT",
      message: "Erro do webservice do SIBA: Server was unable to process request.",
    });
    expect(parseSoapResponse(502, "<html>Bad gateway</html>")).toMatchObject({ ok: false, code: "HTTP_502" });
  });
});

describe("submitBulletins", () => {
  it("POSTs the Base64 BAL XML to the test endpoint with the SOAPAction header", async () => {
    const fetchMock = mockFetch(() => new Response(soap("0"), { status: 200 }));
    const r = await submitBulletins(config, establishment, [guest], 3);
    expect(r).toEqual({ ok: true, message: "1 boletim entregue ao SIBA. O SIBA envia a confirmação por e-mail." });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(SIBA_ENDPOINTS.test);
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("text/xml; charset=utf-8");
    expect(headers.SOAPAction).toBe(`"${SIBA_SOAP_ACTION}"`);
    expect(init?.signal).toBeInstanceOf(AbortSignal);

    const body = String(init?.body);
    expect(body).toContain("<UnidadeHoteleira>123456789</UnidadeHoteleira>");
    expect(body).toContain("<Estabelecimento>00</Estabelecimento>");
    expect(body).toContain("<ChaveAcesso>4815162342</ChaveAcesso>");
    const b64 = /<Boletins>([^<]+)<\/Boletins>/.exec(body)![1];
    const xml = Buffer.from(b64, "base64").toString("utf8");
    expect(xml).toContain('<MovimentoBAL xmlns="http://sef.pt/BAws">');
    expect(xml).toContain("<Nome>ÉLODIE</Nome>");
    expect(xml).toContain("<Numero_Ficheiro>3</Numero_Ficheiro>");
  });

  it("uses the production endpoint in live mode", async () => {
    const fetchMock = mockFetch(() => new Response(soap("0")));
    await submitBulletins({ ...config, mode: "live" }, establishment, [guest], 1);
    expect(fetchMock.mock.calls[0][0]).toBe(SIBA_ENDPOINTS.live);
  });

  it("returns SIBA's error", async () => {
    mockFetch(() => new Response(REAL_ERROR));
    const r = await submitBulletins(config, establishment, [guest], 1);
    expect(r).toMatchObject({ ok: false, code: "12" });
  });

  it("does not call SIBA when the data is incomplete", async () => {
    const fetchMock = mockFetch(() => new Response(soap("0")));
    const r = await submitBulletins(config, establishment, [{ ...guest, birthDate: "" }], 1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: false, code: "VALIDATION", message: "Élodie Dupont: Falta a data de nascimento." });
  });

  it("rejects an empty batch and a bad file number", async () => {
    const fetchMock = mockFetch(() => new Response(soap("0")));
    const r = await submitBulletins(config, establishment, [], 0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Número de ficheiro inválido (1 a 99999).\nNão há boletins para enviar.",
    });
  });

  it("reports timeouts and network failures", async () => {
    mockFetch(() => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });
    expect(await submitBulletins(config, establishment, [guest], 1)).toMatchObject({ ok: false, code: "TIMEOUT" });
    mockFetch(() => {
      throw new TypeError("fetch failed");
    });
    expect(await submitBulletins(config, establishment, [guest], 1)).toEqual({
      ok: false,
      code: "NETWORK",
      message: "Não foi possível contactar o SIBA: fetch failed",
    });
  });
});

describe("testConnection", () => {
  const wsdl = `<wsdl:definitions><s:element name="EntregaBoletinsAlojamento"/></wsdl:definitions>`;

  it("fetches the WSDL of the selected environment and checks the credential formats", async () => {
    const fetchMock = mockFetch(() => new Response(wsdl));
    const r = await testConnection({ ...config, mode: "live" });
    expect(fetchMock.mock.calls[0][0]).toBe(`${SIBA_ENDPOINTS.live}?wsdl`);
    expect(r).toEqual({
      ok: true,
      message: "Webservice acessível (produção) e credenciais com formato válido. A chave só é validada no primeiro envio.",
    });
  });

  it("fails on malformed credentials", async () => {
    mockFetch(() => new Response(wsdl));
    const r = await testConnection({ ...config, credentials: { nipc: "123456780", establishment: "00", accessKey: "" } });
    expect(r).toEqual({
      ok: false,
      code: "CREDENTIALS",
      message: "Webservice acessível (testes), mas as credenciais têm erros: Falta a chave de acesso enviada pelo SIBA.",
    });
  });

  it("fails when the endpoint is not SIBA's webservice", async () => {
    mockFetch(() => new Response("<html>maintenance</html>", { status: 503 }));
    expect(await testConnection(config)).toMatchObject({ ok: false, code: "HTTP_503" });
  });

  it("fails when unreachable", async () => {
    mockFetch(() => {
      throw new TypeError("fetch failed");
    });
    expect(await testConnection(config)).toMatchObject({ ok: false, code: "NETWORK" });
  });
});
