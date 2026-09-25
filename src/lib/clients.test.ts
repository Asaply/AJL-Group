import { describe, expect, it } from "vitest";
import {
  clientColor, clientInitials, clientSummary, escapeIlike, isValidRfc,
  parseClientFiscalForm, parseClientForm, parseContactForm, whatsappLink,
} from "./clients";
import { PROJECT_COLORS } from "./colors";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("isValidRfc", () => {
  it("accepts persona moral (12) and física (13)", () => {
    expect(isValidRfc("ABC010203XY1")).toBe(true);
    expect(isValidRfc("GODE561231GR8")).toBe(true);
    expect(isValidRfc("ÑAB010203XY1")).toBe(true);
  });
  it("rejects bad shapes", () => {
    expect(isValidRfc("ABC0102XY1")).toBe(false);
    expect(isValidRfc("abc010203xy1")).toBe(false);
    expect(isValidRfc("ABCDE010203XY1")).toBe(false);
  });
});

describe("parseClientForm", () => {
  it("trims, defaults status to active and nulls blanks", () => {
    expect(parseClientForm(fd({ name: "  ACME  ", status: "", industry: " ", website: "", city: "CDMX" }))).toEqual({
      ok: true,
      values: { name: "ACME", status: "active", industry: null, website: null, city: "CDMX" },
    });
  });
  it("requires a name", () => {
    expect(parseClientForm(fd({ name: " " }))).toEqual({ ok: false, error: "El nombre es obligatorio" });
  });
  it("validates status and website", () => {
    expect(parseClientForm(fd({ name: "A", status: "vip" }))).toEqual({ ok: false, error: "Estado inválido" });
    expect(parseClientForm(fd({ name: "A", website: "javascript:alert(1)" }))).toEqual({ ok: false, error: "El sitio web no es válido" });
    const ok = parseClientForm(fd({ name: "A", status: "prospect", website: "https://acme.mx" }));
    expect(ok.ok && ok.values.website).toBe("https://acme.mx");
    expect(ok.ok && ok.values.status).toBe("prospect");
  });
});

describe("parseClientFiscalForm", () => {
  it("uppercases a valid RFC and nulls blanks", () => {
    expect(parseClientFiscalForm(fd({ legal_name: "ACME SA de CV", rfc: " abc010203xy1 ", tax_regime: "", tax_address: "", cfdi_use: "G03" }))).toEqual({
      ok: true,
      values: { legal_name: "ACME SA de CV", rfc: "ABC010203XY1", tax_regime: null, tax_address: null, cfdi_use: "G03" },
    });
  });
  it("rejects an invalid RFC", () => {
    expect(parseClientFiscalForm(fd({ rfc: "123" }))).toEqual({ ok: false, error: "El RFC no es válido" });
  });
  it("accepts an empty RFC", () => {
    const r = parseClientFiscalForm(fd({ rfc: "" }));
    expect(r.ok && r.values.rfc).toBeNull();
  });
});

describe("parseContactForm", () => {
  it("accepts a full contact", () => {
    expect(parseContactForm(fd({
      name: " Ana López ", position: "Directora", email: "ana@acme.mx", phone: "(81) 1234-5678",
      whatsapp: "+52 81 1234 5678", notes: "",
    }))).toEqual({
      ok: true,
      values: { name: "Ana López", position: "Directora", email: "ana@acme.mx", phone: "(81) 1234-5678", whatsapp: "+52 81 1234 5678", notes: null },
    });
  });
  it("requires a name", () => {
    expect(parseContactForm(fd({ name: "" }))).toEqual({ ok: false, error: "El nombre es obligatorio" });
  });
  it("validates email, phone and whatsapp", () => {
    expect(parseContactForm(fd({ name: "A", email: "ana@" }))).toEqual({ ok: false, error: "El email no es válido" });
    expect(parseContactForm(fd({ name: "A", phone: "12345" }))).toEqual({ ok: false, error: "El teléfono no es válido" });
    expect(parseContactForm(fd({ name: "A", phone: "81-abc-1234" }))).toEqual({ ok: false, error: "El teléfono no es válido" });
    expect(parseContactForm(fd({ name: "A", whatsapp: "1234567890123456" }))).toEqual({ ok: false, error: "El WhatsApp no es válido" });
  });
});

describe("whatsappLink", () => {
  it("adds 52 to 10-digit Mexican numbers", () => {
    expect(whatsappLink("81 1234 5678")).toBe("https://wa.me/528112345678");
  });
  it("keeps numbers that already have a country code", () => {
    expect(whatsappLink("+52 81 1234 5678")).toBe("https://wa.me/528112345678");
    expect(whatsappLink("+1 (415) 555-0100")).toBe("https://wa.me/14155550100");
  });
  it("returns null for too short or too long", () => {
    expect(whatsappLink("12345")).toBeNull();
    expect(whatsappLink("1234567890123456")).toBeNull();
  });
});

describe("clientInitials", () => {
  it("skips honorifics and uses two words", () => {
    expect(clientInitials("Dr.Alejandro Nevarez")).toBe("AN");
    expect(clientInitials("Lic. María José Pérez")).toBe("MJ");
    expect(clientInitials("acme")).toBe("A");
    expect(clientInitials("  ")).toBe("?");
  });
});

describe("clientColor", () => {
  it("is stable and from the palette", () => {
    expect(clientColor("ACME")).toBe(clientColor("ACME"));
    expect(PROJECT_COLORS).toContain(clientColor("ACME"));
  });
});

describe("escapeIlike", () => {
  it("escapes wildcards and neutralizes PostgREST separators", () => {
    expect(escapeIlike("50%_off")).toBe("50\\%\\_off");
    expect(escapeIlike("a,b(c)")).toBe("a b c ");
  });
});

describe("clientSummary", () => {
  it("combines project money, transactions and counts", () => {
    expect(
      clientSummary(
        [
          { budget: "1000", production_cost: "400", status: "active" },
          { budget: 500, production_cost: 100, status: "completed" },
        ],
        [
          { type: "income", amount: "300" },
          { type: "expense", amount: 50 },
        ]
      )
    ).toEqual({
      income: 1500, cost: 500, margin: 1000,
      txIncome: 300, txExpense: 50, txNet: 250,
      projectCount: 2, activeProjectCount: 1,
    });
  });
});
