import { describe, expect, it } from "vitest";
import { InvoiceError } from "../types";
import { getInvoiceProvider, INVOICE_PROVIDERS, validatePortugueseNif } from "./index";
import { exactNetUnitPrice, grossTotal, netLine, redact, resolveCustomerVat, round2 } from "./shared";

describe("validatePortugueseNif", () => {
  it("accepts valid NIFs, including the final-consumer one and PT-prefixed input", () => {
    for (const nif of ["999999990", "501964843", "123456789", "PT 501 964 843", "500-100-144"]) {
      expect(validatePortugueseNif(nif), nif).toBe(true);
    }
  });

  it("rejects bad check digits, wrong lengths and leading zero", () => {
    for (const nif of ["999999991", "501964846", "12345678", "1234567890", "012345678", "abcdefghi", ""]) {
      expect(validatePortugueseNif(nif), nif).toBe(false);
    }
  });
});

describe("resolveCustomerVat", () => {
  it("uses 999999990 when no NIF is given", () => {
    expect(resolveCustomerVat({ name: "", vat: "", country: "PT" })).toEqual({
      vat: "999999990",
      isFinalConsumer: true,
    });
  });

  it("throws invalid_vat for a bad Portuguese NIF", () => {
    try {
      resolveCustomerVat({ name: "X", vat: "123456780", country: "PT" });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(InvoiceError);
      expect((err as InvoiceError).code).toBe("invalid_vat");
      expect((err as InvoiceError).message).toBe("NIF inválido.");
    }
  });

  it("passes foreign tax ids through without the PT checksum", () => {
    expect(resolveCustomerVat({ name: "X", vat: "ESB 12345678", country: "ES" }).vat).toBe("ESB12345678");
  });
});

describe("netLine", () => {
  /** Both ways a program may rebuild a line from net prices. */
  function rebuilt(l: { quantity: number; unitPrice: number }, rate: number) {
    const net = l.unitPrice * l.quantity;
    return [round2(net * (1 + rate / 100)), round2(round2(net) + round2((net * rate) / 100))];
  }

  it("rebuilds every gross line total to the cent", () => {
    const failures: string[] = [];
    for (const rate of [6, 13, 23]) {
      for (let cents = 1; cents <= 40000; cents += 7) {
        const gross = cents / 100;
        for (const quantity of [1, 2, 3, 5, 7, 10, 14, 30]) {
          const line = netLine({ description: "x", quantity, unitPriceGross: gross, vatRate: rate });
          const target = round2(gross * quantity);
          const [a, b] = rebuilt(line, rate);
          if (a !== target || b !== target) failures.push(`${gross}x${quantity}@${rate}%`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("keeps the quantity when a 4-decimal unit price exists", () => {
    expect(netLine({ description: "Quarto", quantity: 3, unitPriceGross: 89.9, vatRate: 6 })).toEqual({
      description: "Quarto",
      quantity: 3,
      unitPrice: 84.8113,
    });
  });

  it("collapses to quantity 1 when no 4-decimal unit price reproduces the total", () => {
    // 14 × 347,00 € at 13%: 307.0796 gives 4857.99 and 307.0797 gives 4858.01.
    expect(exactNetUnitPrice(347, 13, 14)).toBeUndefined();
    const line = netLine({ description: "Quarto", quantity: 14, unitPriceGross: 347, vatRate: 13 });
    expect(line.quantity).toBe(1);
    expect(line.description).toBe("Quarto (14 × 347,00 €)");
    expect(rebuilt(line, 13)).toEqual([4858, 4858]);
  });

  it("returns the gross price untouched when there is no VAT", () => {
    expect(netLine({ description: "Taxa", quantity: 3, unitPriceGross: 2, vatRate: 0 }).unitPrice).toBe(2);
  });
});

describe("grossTotal and round2", () => {
  it("rounds half away from zero despite binary floats", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
  });

  it("sums line totals", () => {
    expect(
      grossTotal([
        { description: "a", quantity: 3, unitPriceGross: 89.9, vatRate: 6 },
        { description: "b", quantity: 2, unitPriceGross: 2, vatRate: 0 },
      ]),
    ).toBe(273.7);
  });
});

describe("redact", () => {
  it("hides secrets and credential query parameters", () => {
    const msg = redact("x?api_key=abc123&y=1 token SECRETVALUE", ["SECRETVALUE"]);
    expect(msg).not.toContain("abc123");
    expect(msg).not.toContain("SECRETVALUE");
  });
});

describe("registry", () => {
  it("lists the three providers and finds them by id", () => {
    expect(INVOICE_PROVIDERS.map((p) => p.id)).toEqual(["invoicexpress", "moloni", "vendus"]);
    expect(getInvoiceProvider("vendus").name).toBe("Vendus");
    expect(() => getInvoiceProvider("nope")).toThrow(InvoiceError);
  });
});
