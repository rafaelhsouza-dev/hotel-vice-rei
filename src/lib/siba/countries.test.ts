import { describe, expect, it } from "vitest";
import {
  alpha2ToAlpha3,
  alpha3ToAlpha2,
  countryNamePt,
  isAlpha3,
  ISO_COUNTRIES,
  requiresBulletin,
  SIBA_COUNTRIES,
  SIBA_DOCUMENT_TYPES,
  TERRITORY_SOVEREIGN,
  toSibaCountryCode,
} from "./countries";

describe("ISO 3166-1", () => {
  it("has the 249 assigned codes, unique", () => {
    expect(ISO_COUNTRIES).toHaveLength(249);
    expect(new Set(ISO_COUNTRIES.map((c) => c.alpha2)).size).toBe(249);
    expect(new Set(ISO_COUNTRIES.map((c) => c.alpha3)).size).toBe(249);
    for (const c of ISO_COUNTRIES) {
      expect(c.alpha2).toMatch(/^[A-Z]{2}$/);
      expect(c.alpha3).toMatch(/^[A-Z]{3}$/);
      expect(c.namePt.length).toBeGreaterThan(1);
    }
  });

  it("converts and checks codes", () => {
    expect(isAlpha3("fra")).toBe(true);
    expect(isAlpha3("XKX")).toBe(true);
    expect(isAlpha3("FR")).toBe(false);
    expect(isAlpha3("ZZZ")).toBe(false);
    expect(alpha2ToAlpha3("de")).toBe("DEU");
    expect(alpha2ToAlpha3("GB")).toBe("GBR");
    expect(alpha2ToAlpha3("XX")).toBeUndefined();
    expect(alpha3ToAlpha2("PRT")).toBe("PT");
    expect(countryNamePt("NLD")).toBe("Países Baixos");
  });
});

describe("SIBA ICAO table", () => {
  it("has the 208 entries published by SIBA", () => {
    expect(SIBA_COUNTRIES).toHaveLength(208);
    expect(SIBA_COUNTRIES.find((c) => c.code === "D")?.namePt).toBe("Alemanha");
  });

  it("every SIBA code except D and RKS is an ISO alpha-3", () => {
    const odd = SIBA_COUNTRIES.map((c) => c.code).filter((c) => !isAlpha3(c));
    expect(odd.sort()).toEqual(["D", "RKS"]);
  });

  it("every ISO code is either in SIBA's table or a known territory", () => {
    for (const c of ISO_COUNTRIES) {
      if (toSibaCountryCode(c.alpha3) === null) expect(TERRITORY_SOVEREIGN).toHaveProperty(c.alpha3);
    }
    for (const sovereign of Object.values(TERRITORY_SOVEREIGN)) {
      if (sovereign) expect(toSibaCountryCode(sovereign)).toBe(sovereign);
    }
  });

  it("maps ISO to SIBA codes", () => {
    expect(toSibaCountryCode("DEU")).toBe("D");
    expect(toSibaCountryCode("D")).toBe("D");
    expect(toSibaCountryCode("XKX")).toBe("RKS");
    expect(toSibaCountryCode("fra")).toBe("FRA");
    expect(toSibaCountryCode("GIB")).toBeNull();
    expect(toSibaCountryCode("")).toBeNull();
  });
});

describe("requiresBulletin", () => {
  it("is false only for Portuguese nationals", () => {
    expect(requiresBulletin("PRT")).toBe(false);
    expect(requiresBulletin(" prt ")).toBe(false);
    expect(requiresBulletin("ESP")).toBe(true); // EU citizens are foreigners too
    expect(requiresBulletin("BRA")).toBe(true);
    expect(requiresBulletin("")).toBe(true); // unknown: ask, don't skip
  });
});

describe("document types", () => {
  it("are SIBA's P, B, O", () => {
    expect(SIBA_DOCUMENT_TYPES.map((t) => t.code)).toEqual(["P", "B", "O"]);
  });
});
