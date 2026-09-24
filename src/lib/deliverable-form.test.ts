import { describe, expect, it } from "vitest";
import { parseDeliverableForm } from "./deliverable-form";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("parseDeliverableForm", () => {
  it("trims the title and parses the weight", () => {
    expect(parseDeliverableForm(fd({ title: "  Login  ", weight: "30" }))).toEqual({
      ok: true,
      values: { title: "Login", weight: 30 },
    });
  });

  it("rounds weight to 2 decimals and accepts 0 and 100", () => {
    expect(parseDeliverableForm(fd({ title: "A", weight: "33.333" }))).toEqual({
      ok: true, values: { title: "A", weight: 33.33 },
    });
    expect(parseDeliverableForm(fd({ title: "A", weight: "0" })).ok).toBe(true);
    expect(parseDeliverableForm(fd({ title: "A", weight: "100" })).ok).toBe(true);
  });

  it("requires a title", () => {
    expect(parseDeliverableForm(fd({ title: "   ", weight: "10" }))).toEqual({
      ok: false, error: "El título es obligatorio",
    });
  });

  it("rejects blank, non-numeric or out-of-range weights", () => {
    const error = { ok: false, error: "Peso inválido" };
    expect(parseDeliverableForm(fd({ title: "A", weight: "" }))).toEqual(error);
    expect(parseDeliverableForm(fd({ title: "A", weight: "abc" }))).toEqual(error);
    expect(parseDeliverableForm(fd({ title: "A", weight: "-1" }))).toEqual(error);
    expect(parseDeliverableForm(fd({ title: "A", weight: "100.5" }))).toEqual(error);
    expect(parseDeliverableForm(fd({ title: "A" }))).toEqual(error);
  });
});
