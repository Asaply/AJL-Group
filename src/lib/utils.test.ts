import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate } from "./utils";

describe("formatCurrency", () => {
  it("formats a number with 2 decimals and rounds correctly", () => {
    expect(formatCurrency(1234.5)).toContain("1,234.50");
  });

  it("accepts a numeric string (Postgres numeric columns arrive as strings)", () => {
    expect(formatCurrency("1234.5")).toContain("1,234.50");
  });

  it("formats 0 with 2 decimals", () => {
    expect(formatCurrency(0)).toContain("0.00");
  });

  it("formats a non-finite / NaN input as 0", () => {
    expect(formatCurrency(NaN)).toContain("0.00");
    expect(formatCurrency("not-a-number")).toContain("0.00");
  });

  it("prefixes the value with a currency sign", () => {
    expect(formatCurrency(100)).toMatch(/\$/);
  });
});

describe("formatDate", () => {
  it("parses a date-only string as the same local calendar day (no UTC day-shift)", () => {
    // Regression: `new Date("2026-09-24")` parses as UTC midnight, which
    // renders as 2026-09-23 in timezones behind UTC (e.g. Mexico). This must
    // stay 24/9/2026 regardless of the host machine's timezone.
    expect(formatDate("2026-09-24")).toBe("24/9/2026");
  });

  it("falls back to normal Date parsing for full ISO timestamps", () => {
    const result = formatDate("2026-09-24T15:30:00.000Z");
    expect(result).toBe(new Date("2026-09-24T15:30:00.000Z").toLocaleDateString("es-MX"));
  });
});
