import { describe, expect, it } from "vitest";
import { caretAfterFormat, finalizeMoneyInput, formatMoneyInput, unformatMoney } from "./money-input";

describe("formatMoneyInput", () => {
  it("groups thousands with commas", () => {
    expect(formatMoneyInput("100000")).toBe("100,000");
    expect(formatMoneyInput("1234567")).toBe("1,234,567");
    expect(formatMoneyInput("999")).toBe("999");
  });

  it("keeps up to two decimals and a trailing point while typing", () => {
    expect(formatMoneyInput("1500.")).toBe("1,500.");
    expect(formatMoneyInput("1500.5")).toBe("1,500.5");
    expect(formatMoneyInput("1500.567")).toBe("1,500.56");
  });

  it("drops anything that is not a digit or the first point", () => {
    expect(formatMoneyInput("$1,2a3.4.5")).toBe("123.45");
    expect(formatMoneyInput("")).toBe("");
  });

  it("strips leading zeros but keeps a lone zero", () => {
    expect(formatMoneyInput("000123")).toBe("123");
    expect(formatMoneyInput("0")).toBe("0");
    expect(formatMoneyInput(".5")).toBe("0.5");
  });
});

describe("finalizeMoneyInput", () => {
  it("pads decimals to two and drops a dangling point or zero cents", () => {
    expect(finalizeMoneyInput("100000.00")).toBe("100,000");
    expect(finalizeMoneyInput("1,500.5")).toBe("1,500.50");
    expect(finalizeMoneyInput("1,500.")).toBe("1,500");
    expect(finalizeMoneyInput("1,500")).toBe("1,500");
  });
});

describe("unformatMoney", () => {
  it("removes grouping commas", () => {
    expect(unformatMoney("1,234,567.89")).toBe("1234567.89");
  });
});

describe("caretAfterFormat", () => {
  it("keeps the caret after the same number of digits", () => {
    // typed "1000|" -> "1,000|"
    expect(caretAfterFormat("1000", 4, "1,000")).toBe(5);
    // caret after the "2" in "12|34" -> "1,2|34"
    expect(caretAfterFormat("1234", 2, "1,234")).toBe(3);
    expect(caretAfterFormat("", 0, "")).toBe(0);
  });
});
