import { describe, expect, it } from "vitest";
import { parseProjectForm, parseMemberForm, validatePercentage, isValidDateKey } from "./project-form";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

const base = {
  name: "  Video  ",
  client_id: "c1",
  status: "paused",
  start_date: "2026-09-01",
  end_date: "2026-10-01",
  budget: "1000.50",
  production_cost: "200",
  color: "#6366f1",
};

describe("isValidDateKey", () => {
  it("accepts a real YYYY-MM-DD date", () => {
    expect(isValidDateKey("2026-02-28")).toBe(true);
    expect(isValidDateKey("2028-02-29")).toBe(true);
  });

  it("rejects wrong formats and impossible dates", () => {
    expect(isValidDateKey("2026-2-1")).toBe(false);
    expect(isValidDateKey("01/02/2026")).toBe(false);
    expect(isValidDateKey("2026-02-30")).toBe(false);
    expect(isValidDateKey("2026-13-01")).toBe(false);
    expect(isValidDateKey("")).toBe(false);
  });
});

describe("parseProjectForm (create)", () => {
  it("trims and parses a valid form", () => {
    expect(parseProjectForm(fd(base), "create")).toEqual({
      ok: true,
      values: {
        name: "Video",
        client_id: "c1",
        status: "paused",
        start_date: "2026-09-01",
        end_date: "2026-10-01",
        budget: 1000.5,
        production_cost: 200,
        color: "#6366F1",
      },
    });
  });

  it("normalizes the color to uppercase hex", () => {
    const result = parseProjectForm(fd(base), "create");
    expect(result.ok && result.values.color).toBe("#6366F1");
  });

  it("rejects a missing or invalid color", () => {
    const error = { ok: false, error: "Color inválido" };
    const noColor = { ...base } as Record<string, string>;
    delete noColor.color;
    expect(parseProjectForm(fd(noColor), "create")).toEqual(error);
    expect(parseProjectForm(fd({ ...base, color: "red" }), "update")).toEqual(error);
    expect(parseProjectForm(fd({ ...base, color: "#FFF" }), "create")).toEqual(error);
  });

  it("never includes progress", () => {
    const result = parseProjectForm(fd({ ...base, progress: "40" } as Record<string, string>), "update");
    expect(result.ok && "progress" in result.values).toBe(false);
  });

  it("falls back to active for a missing/invalid status on create", () => {
    const r1 = parseProjectForm(fd({ ...base, status: "" }), "create");
    const r2 = parseProjectForm(fd({ ...base, status: "bogus" }), "create");
    expect(r1.ok && r1.values.status).toBe("active");
    expect(r2.ok && r2.values.status).toBe("active");
  });

  it("requires name", () => {
    expect(parseProjectForm(fd({ ...base, name: "   " }), "create")).toEqual({ ok: false, error: "El nombre es obligatorio" });
  });

  it("maps blank or 'none' client_id to null", () => {
    const blank = parseProjectForm(fd({ ...base, client_id: "" }), "create");
    expect(blank.ok && blank.values.client_id).toBeNull();
    const none = parseProjectForm(fd({ ...base, client_id: "none" }), "update");
    expect(none.ok && none.values.client_id).toBeNull();
  });

  it("requires a valid start_date", () => {
    expect(parseProjectForm(fd({ ...base, start_date: "" }), "create")).toEqual({ ok: false, error: "La fecha de inicio no es válida" });
    expect(parseProjectForm(fd({ ...base, start_date: "mañana" }), "create")).toEqual({ ok: false, error: "La fecha de inicio no es válida" });
  });

  it("treats a blank end_date as null", () => {
    const result = parseProjectForm(fd({ ...base, end_date: "" }), "create");
    expect(result.ok && result.values.end_date).toBeNull();
  });

  it("rejects a malformed end_date", () => {
    expect(parseProjectForm(fd({ ...base, end_date: "2026/10/01" }), "create")).toEqual({ ok: false, error: "La fecha de fin no es válida" });
  });

  it("rejects an end_date before start_date but allows the same day", () => {
    expect(parseProjectForm(fd({ ...base, end_date: "2026-08-31" }), "create")).toEqual({
      ok: false,
      error: "La fecha de fin no puede ser anterior a la fecha de inicio",
    });
    expect(parseProjectForm(fd({ ...base, end_date: "2026-09-01" }), "create").ok).toBe(true);
  });

  it("defaults blank money fields to 0", () => {
    const result = parseProjectForm(fd({ ...base, budget: "", production_cost: "" }), "create");
    expect(result.ok && [result.values.budget, result.values.production_cost]).toEqual([0, 0]);
  });

  it("rejects negative or non-numeric money fields", () => {
    expect(parseProjectForm(fd({ ...base, budget: "-1" }), "create")).toEqual({ ok: false, error: "El presupuesto debe ser un número mayor o igual a 0" });
    expect(parseProjectForm(fd({ ...base, budget: "abc" }), "create")).toEqual({ ok: false, error: "El presupuesto debe ser un número mayor o igual a 0" });
    expect(parseProjectForm(fd({ ...base, production_cost: "-5" }), "create")).toEqual({ ok: false, error: "El costo de producción debe ser un número mayor o igual a 0" });
    expect(parseProjectForm(fd({ ...base, production_cost: "Infinity" }), "create")).toEqual({ ok: false, error: "El costo de producción debe ser un número mayor o igual a 0" });
  });
});

describe("parseProjectForm (update)", () => {
  it("rejects an invalid status instead of defaulting", () => {
    expect(parseProjectForm(fd({ ...base, status: "bogus" }), "update")).toEqual({ ok: false, error: "Estado inválido" });
    expect(parseProjectForm(fd({ ...base, status: "" }), "update")).toEqual({ ok: false, error: "Estado inválido" });
  });
});

describe("validatePercentage", () => {
  it("accepts 0..100", () => {
    expect(validatePercentage(0)).toBeNull();
    expect(validatePercentage(33.33)).toBeNull();
    expect(validatePercentage(100)).toBeNull();
  });

  it("rejects NaN / non-finite", () => {
    expect(validatePercentage(NaN)).toBe("Porcentaje inválido");
    expect(validatePercentage(Infinity)).toBe("Porcentaje inválido");
  });

  it("rejects out of range", () => {
    expect(validatePercentage(-0.01)).toBe("El porcentaje debe estar entre 0 y 100");
    expect(validatePercentage(100.5)).toBe("El porcentaje debe estar entre 0 y 100");
  });
});

describe("parseMemberForm", () => {
  it("parses a valid member form", () => {
    expect(parseMemberForm(fd({ user_id: "u1", role_description: "  Editor ", profit_percentage: "33.33" }))).toEqual({
      ok: true,
      values: { user_id: "u1", role_description: "Editor", profit_percentage: 33.33 },
    });
  });

  it("stores a blank role as null", () => {
    const result = parseMemberForm(fd({ user_id: "u1", role_description: "  ", profit_percentage: "50" }));
    expect(result.ok && result.values.role_description).toBeNull();
  });

  it("requires a user", () => {
    expect(parseMemberForm(fd({ user_id: "", profit_percentage: "50" }))).toEqual({ ok: false, error: "Debes seleccionar un socio" });
  });

  it("rejects a blank or non-numeric percentage instead of defaulting", () => {
    expect(parseMemberForm(fd({ user_id: "u1", profit_percentage: "" }))).toEqual({ ok: false, error: "Porcentaje inválido" });
    expect(parseMemberForm(fd({ user_id: "u1", profit_percentage: "abc" }))).toEqual({ ok: false, error: "Porcentaje inválido" });
    expect(parseMemberForm(fd({ user_id: "u1" }))).toEqual({ ok: false, error: "Porcentaje inválido" });
  });

  it("rejects an out-of-range percentage", () => {
    expect(parseMemberForm(fd({ user_id: "u1", profit_percentage: "150" }))).toEqual({ ok: false, error: "El porcentaje debe estar entre 0 y 100" });
  });
});
