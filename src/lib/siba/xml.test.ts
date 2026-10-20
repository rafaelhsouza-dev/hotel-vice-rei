import { describe, expect, it } from "vitest";
import type { SibaBulletin, SibaConfig, SibaEstablishment } from "./types";
import {
  buildBalDat,
  buildBalXml,
  checkCredentials,
  escapeXml,
  exportBulletinsFile,
  isValidNipc,
  lisbonDateTime,
  sibaDocumentNumber,
  sibaName,
  sibaPhone,
  splitPostalCode,
  truncate,
  validateBulletin,
  validateEstablishment,
} from "./xml";

const config: SibaConfig = {
  mode: "live",
  credentials: { nipc: "123456789", establishment: "00", accessKey: "4815162342" },
  settings: {},
};

const establishment: SibaEstablishment = {
  name: "Hotel Vice-Rei",
  address: "Rua Exemplo, 12",
  city: "Braga",
  postalCode: "4700-123",
  contactName: "Receção",
  phone: "+351 253 000 000",
  email: "rececao@example.pt",
};

const guest = (o: Partial<SibaBulletin> = {}): SibaBulletin => ({
  guestId: "g1",
  lastName: "Dupont",
  firstNames: "Élodie Marie",
  nationality: "FRA",
  birthDate: "1985-03-09",
  birthPlace: "Lyon",
  documentType: "P",
  documentNumber: "12AB34567",
  documentCountry: "FRA",
  residenceCountry: "FRA",
  residenceCity: "Paris",
  checkIn: "2026-10-18",
  checkOut: "2026-10-21",
  ...o,
});

const NOW = new Date("2026-10-20T13:05:09Z"); // 14:05:09 in Lisbon (WEST)
const TODAY = "2026-10-20";

/** Child element names of the first `parent` element, in order. */
function childNames(xml: string, parent: string, index = 0): string[] {
  const blocks = xml.match(new RegExp(`<${parent}>([\\s\\S]*?)</${parent}>`, "g")) ?? [];
  const inner = blocks[index].replace(new RegExp(`^<${parent}>|</${parent}>$`, "g"), "");
  return [...inner.matchAll(/<([A-Za-z_]+)>/g)].map((m) => m[1]);
}

function value(xml: string, name: string): string | undefined {
  return new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(xml)?.[1];
}

/** The first Boletim_Alojamento element (Nome also exists in the header). */
function bulletin(xml: string): string {
  return /<Boletim_Alojamento>[\s\S]*?<\/Boletim_Alojamento>/.exec(xml)![0];
}

describe("buildBalXml", () => {
  const xml = buildBalXml(establishment, config, [guest()], 42, NOW);

  it("has the BAL.XSD root, namespace and section order", () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>\n<MovimentoBAL xmlns="http://sef.pt/BAws">')).toBe(true);
    expect(xml.trim().endsWith("</MovimentoBAL>")).toBe(true);
    const order = [...xml.matchAll(/<(Unidade_Hoteleira|Boletim_Alojamento|Envio)>/g)].map((m) => m[1]);
    expect(order).toEqual(["Unidade_Hoteleira", "Boletim_Alojamento", "Envio"]);
  });

  it("writes the establishment header in XSD order", () => {
    expect(childNames(xml, "Unidade_Hoteleira")).toEqual([
      "Codigo_Unidade_Hoteleira", "Estabelecimento", "Nome", "Abreviatura", "Morada", "Localidade",
      "Codigo_Postal", "Zona_Postal", "Telefone", "Fax", "Nome_Contacto", "Email_Contacto",
    ]);
    expect(value(xml, "Codigo_Unidade_Hoteleira")).toBe("123456789");
    expect(value(xml, "Estabelecimento")).toBe("00");
    expect(value(xml, "Codigo_Postal")).toBe("4700");
    expect(value(xml, "Zona_Postal")).toBe("123");
    expect(value(xml, "Telefone")).toBe("253000000");
    expect(xml).toContain("<Fax></Fax>"); // required element, optional value
    expect(value(xml, "Abreviatura")).toBe("Hotel Vice-Rei");
  });

  it("writes the bulletin in XSD order with xs:dateTime dates", () => {
    expect(childNames(xml, "Boletim_Alojamento")).toEqual([
      "Apelido", "Nome", "Nacionalidade", "Data_Nascimento", "Local_Nascimento", "Documento_Identificacao",
      "Pais_Emissor_Documento", "Tipo_Documento", "Data_Entrada", "Data_Saida", "Pais_Residencia_Origem",
      "Local_Residencia_Origem",
    ]);
    expect(value(xml, "Apelido")).toBe("DUPONT");
    expect(value(bulletin(xml), "Nome")).toBe("ÉLODIE MARIE");
    expect(value(xml, "Data_Nascimento")).toBe("1985-03-09T00:00:00");
    expect(value(xml, "Data_Entrada")).toBe("2026-10-18T00:00:00");
    expect(value(xml, "Data_Saida")).toBe("2026-10-21T00:00:00");
  });

  it("writes Envio with the file number and Lisbon time", () => {
    expect(childNames(xml, "Envio")).toEqual(["Numero_Ficheiro", "Data_Movimento"]);
    expect(value(xml, "Numero_Ficheiro")).toBe("42");
    expect(value(xml, "Data_Movimento")).toBe("2026-10-20T14:05:09");
  });

  it("omits the optional elements when empty", () => {
    const x = buildBalXml(
      { ...establishment, email: "" },
      config,
      [guest({ firstNames: "", lastName: "Madonna", birthPlace: "", checkOut: "" })],
      1,
      NOW,
    );
    expect(childNames(x, "Boletim_Alojamento")).toEqual([
      "Apelido", "Nacionalidade", "Data_Nascimento", "Documento_Identificacao", "Pais_Emissor_Documento",
      "Tipo_Documento", "Data_Entrada", "Pais_Residencia_Origem", "Local_Residencia_Origem",
    ]);
    expect(x).not.toContain("Email_Contacto");
  });

  it("puts a single name in Apelido", () => {
    const x = buildBalXml(establishment, config, [guest({ lastName: "", firstNames: "Ronaldinho" })], 1, NOW);
    expect(value(x, "Apelido")).toBe("RONALDINHO");
    expect(childNames(x, "Boletim_Alojamento")).not.toContain("Nome");
  });

  it('escapes & < > " and \' in text', () => {
    const x = buildBalXml(
      { ...establishment, name: `A & B <"C"> D'E` },
      config,
      [guest({ residenceCity: "Rock & <Roll>" })],
      1,
      NOW,
    );
    expect(value(x, "Nome")).toBe("A &amp; B &lt;&quot;C&quot;&gt; D&apos;E");
    expect(value(x, "Local_Residencia_Origem")).toBe("Rock &amp; &lt;Roll&gt;");
    expect(x).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
  });

  it("truncates to the XSD maxLength before escaping", () => {
    const long = "Á".repeat(39) + "&xyz";
    const x = buildBalXml(
      { ...establishment, name: long, contactName: "x".repeat(60) },
      config,
      [guest({ residenceCity: "y".repeat(50), birthPlace: "z".repeat(31) })],
      1,
      NOW,
    );
    expect(value(x, "Nome")).toBe("Á".repeat(39) + "&amp;");
    expect(value(x, "Abreviatura")).toHaveLength(15);
    expect(value(x, "Nome_Contacto")).toHaveLength(40);
    expect(value(x, "Local_Residencia_Origem")).toHaveLength(30);
    expect(value(x, "Local_Nascimento")).toHaveLength(30);
  });

  it("uses SIBA country codes: Germany is D, Kosovo is RKS", () => {
    const x = buildBalXml(
      establishment,
      config,
      [guest({ nationality: "DEU", documentCountry: "deu", residenceCountry: "XKX" })],
      1,
      NOW,
    );
    expect(value(x, "Nacionalidade")).toBe("D");
    expect(value(x, "Pais_Emissor_Documento")).toBe("D");
    expect(value(x, "Pais_Residencia_Origem")).toBe("RKS");
  });

  it("normalises names and document numbers to SIBA's character set", () => {
    const x = buildBalXml(
      establishment,
      config,
      [guest({ lastName: "  müller-o’brien ", firstNames: "Jürgen  Ñandú", documentNumber: "c01x-00 t47" })],
      1,
      NOW,
    );
    expect(value(x, "Apelido")).toBe("MULLER-O&apos;BRIEN");
    expect(value(bulletin(x), "Nome")).toBe("JURGEN NANDÚ");
    expect(value(x, "Documento_Identificacao")).toBe("C01X00T47");
  });

  it("writes one Boletim_Alojamento per guest", () => {
    const x = buildBalXml(establishment, config, [guest(), guest({ guestId: "g2", lastName: "Smith" })], 1, NOW);
    expect(x.match(/<Boletim_Alojamento>/g)).toHaveLength(2);
  });
});

describe("text helpers", () => {
  it("escapeXml drops characters XML 1.0 forbids", () => {
    expect(escapeXml("a\u0001b\tc")).toBe("ab\tc");
  });
  it("truncate counts code points", () => {
    expect(truncate("😀😀😀", 2)).toBe("😀😀");
    expect(truncate("abc", 5)).toBe("abc");
  });
  it("sibaName keeps the Portuguese accented capitals and strips others", () => {
    expect(sibaName("Conceição Ávila")).toBe("CONCEIÇÃO ÁVILA");
    expect(sibaName("Straße Øster Łukasz")).toBe("STRASSE OSTER LUKASZ");
    expect(sibaName("Brontë, Jr.")).toBe("BRONTE JR");
    expect(sibaName("Иван")).toBe("");
  });
  it("sibaDocumentNumber keeps only 0-9 A-Z", () => {
    expect(sibaDocumentNumber(" ab-12 3/4 ")).toBe("AB1234");
  });
  it("sibaPhone strips the +351 prefix", () => {
    expect(sibaPhone("+351 253 000 000")).toBe("253000000");
    expect(sibaPhone("00351253000000")).toBe("253000000");
    expect(sibaPhone("253 000 000")).toBe("253000000");
  });
  it("splitPostalCode", () => {
    expect(splitPostalCode("4700-123")).toEqual({ code: "4700", zone: "123" });
    expect(splitPostalCode("4700123")).toEqual({ code: "4700", zone: "123" });
    expect(splitPostalCode("4700")).toBeNull();
  });
  it("lisbonDateTime follows winter time too", () => {
    expect(lisbonDateTime(new Date("2026-12-01T09:00:00Z"))).toBe("2026-12-01T09:00:00");
    expect(lisbonDateTime(new Date("2026-07-01T23:30:00Z"))).toBe("2026-07-02T00:30:00");
  });
});

describe("NIPC / credentials", () => {
  it("checks the NIF/NIPC check digit", () => {
    expect(isValidNipc("123456789")).toBe(true);
    expect(isValidNipc("500000000")).toBe(true); // remainder 1 → check digit 0
    expect(isValidNipc("504426290")).toBe(true);
    expect(isValidNipc("123456780")).toBe(false);
    expect(isValidNipc("12345678")).toBe(false);
    expect(isValidNipc("12345678a")).toBe(false);
  });

  it("reports credential format errors in Portuguese", () => {
    const { errors } = checkCredentials({
      ...config,
      credentials: { nipc: "123", establishment: "123", accessKey: "12a" },
    });
    expect(errors.map((e) => e.message)).toEqual([
      "O NIPC tem de ter 9 algarismos.",
      "O número de estabelecimento tem de ter 2 algarismos (ex.: 00).",
      "A chave de acesso só tem algarismos.",
    ]);
  });

  it("rejects a bad check digit in live mode but only warns in test mode (SIBA's test unit fails it)", () => {
    const creds = { nipc: "121212121", establishment: "00", accessKey: "999999999" };
    expect(checkCredentials({ ...config, mode: "live", credentials: creds }).errors[0].message).toBe(
      "O NIPC não é válido (dígito de controlo errado).",
    );
    const test = checkCredentials({ ...config, mode: "test", credentials: creds });
    expect(test.errors).toEqual([]);
    expect(test.warnings).toHaveLength(1);
  });

  it("accepts a single-digit establishment as 0N", () => {
    expect(checkCredentials({ ...config, credentials: { ...config.credentials, establishment: "0" } }).errors).toEqual([]);
  });
});

describe("validateBulletin", () => {
  it("accepts a complete bulletin", () => {
    expect(validateBulletin(guest(), TODAY)).toEqual([]);
  });

  it("lists every missing field", () => {
    const empty = guest({
      lastName: "", firstNames: "", nationality: "", birthDate: "", documentType: "", documentNumber: "",
      documentCountry: "", residenceCountry: "", residenceCity: "", checkIn: "", checkOut: "",
    });
    expect(validateBulletin(empty, TODAY)).toEqual([
      "Falta o nome do hóspede.",
      "Falta a nacionalidade.",
      "Falta a data de nascimento.",
      "Documento de identificação em falta.",
      "Falta o tipo de documento.",
      "Falta o país emissor do documento.",
      "Falta o país de residência.",
      "Falta a data de entrada.",
    ]);
  });

  it("checks dates", () => {
    expect(validateBulletin(guest({ birthDate: "1985-02-30" }), TODAY)).toEqual(["Data de nascimento inválida."]);
    expect(validateBulletin(guest({ birthDate: TODAY, checkIn: TODAY }), TODAY)).toEqual([
      "A data de nascimento tem de ser anterior a hoje.",
    ]);
    expect(validateBulletin(guest({ checkIn: "2026-10-21", checkOut: "2026-10-22" }), TODAY)).toEqual([
      "A data de entrada não pode ser futura: só se comunica quem já fez check-in.",
    ]);
    expect(validateBulletin(guest({ checkOut: "2026-10-17" }), TODAY)).toEqual([
      "A data de saída não pode ser anterior à data de entrada.",
    ]);
    expect(validateBulletin(guest({ checkOut: "" }), TODAY)).toEqual([]);
  });

  it("checks document type and number", () => {
    expect(validateBulletin(guest({ documentType: "X" }), TODAY)).toEqual([
      "Tipo de documento inválido (P passaporte, B bilhete de identidade, O outro).",
    ]);
    expect(validateBulletin(guest({ documentNumber: "A".repeat(17) }), TODAY)).toEqual([
      "O número do documento tem mais de 16 caracteres.",
    ]);
    expect(validateBulletin(guest({ documentNumber: " - / " }), TODAY)).toEqual(["Documento de identificação em falta."]);
  });

  it("checks country codes against SIBA's table", () => {
    expect(validateBulletin(guest({ nationality: "FR" }), TODAY)).toEqual([
      'Nacionalidade: código de país inválido "FR" (use o código de 3 letras, ex.: FRA).',
    ]);
    expect(validateBulletin(guest({ residenceCountry: "GIB" }), TODAY)).toEqual([
      "País de residência: Gibraltar não consta da tabela de países do SIBA; use Reino Unido (GBR).",
    ]);
    expect(validateBulletin(guest({ nationality: "DEU", documentCountry: "DEU" }), TODAY)).toEqual([]);
  });

  it("flags Portuguese guests and non-Latin names", () => {
    expect(validateBulletin(guest({ nationality: "PRT" }), TODAY)).toEqual([
      "Hóspede de nacionalidade portuguesa: não se comunica ao SIBA.",
    ]);
    expect(validateBulletin(guest({ lastName: "Иванов", firstNames: "Иван" }), TODAY)).toEqual([
      "O nome tem de ser escrito em caracteres latinos, como no documento.",
    ]);
  });
});

describe("validateEstablishment", () => {
  it("accepts the sample", () => {
    expect(validateEstablishment(establishment)).toEqual([]);
  });
  it("checks postal code and phone", () => {
    expect(validateEstablishment({ ...establishment, postalCode: "4700", phone: "1234" })).toEqual([
      "Código postal do estabelecimento inválido (formato 0000-000).",
      "O telefone do estabelecimento tem de ter 9 algarismos.",
    ]);
  });
});

describe(".DAT file (portal upload)", () => {
  const dat = buildBalDat(establishment, config, [guest({ nationality: "DEU", documentCountry: "DEU", checkOut: "" })], 7, NOW);
  const lines = dat.split("\r\n");

  it("has header, one record per guest and a trailer, CRLF, pipe-terminated", () => {
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe("");
    expect(lines[0]).toBe(
      "0|BA03|123456789|00|HOTEL VICE-REI|RUA EXEMPLO, 12|BRAGA|4700|123|253000000||RECECAO|RECECAO@EXAMPLE.PT|",
    );
    expect(lines[1]).toBe("1|DUPONT|ÉLODIE MARIE|D|LYON|19850309|12AB34567|P|D|FRA|PARIS|20261018||");
    expect(lines[2]).toBe("9|00003|20261020|00007|");
  });

  it("exportBulletinsFile names the file <NIF><Estab><Nº>.DAT and encodes Latin-1", () => {
    const f = exportBulletinsFile(config, establishment, [guest()], 7, { now: NOW });
    expect(f.fileName).toBe("12345678900" + "00007.DAT");
    expect(f.format).toBe("dat");
    expect(Buffer.from(f.bytes).toString("latin1")).toBe(f.content);
    expect(f.bytes.length).toBe(f.content.length); // one byte per character
  });

  it("exportBulletinsFile can return the raw XML", () => {
    const f = exportBulletinsFile(config, establishment, [guest()], 7, { now: NOW, format: "xml" });
    expect(f.fileName).toBe("1234567890000007.xml");
    expect(f.content).toBe(buildBalXml(establishment, config, [guest()], 7, NOW));
    expect(Buffer.from(f.bytes).toString("utf8")).toBe(f.content);
  });
});
