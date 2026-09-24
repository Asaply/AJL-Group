import { describe, expect, it } from "vitest";
import { checklistProgress, parseTaskField } from "./task-update";

describe("parseTaskField", () => {
  it("rejects fields that are not editable", () => {
    expect(parseTaskField("created_by", "x")).toEqual({ ok: false, error: "Campo no editable" });
    expect(parseTaskField("id", "x")).toEqual({ ok: false, error: "Campo no editable" });
  });

  it("trims and requires the title", () => {
    expect(parseTaskField("title", "  Login  ")).toEqual({ ok: true, field: "title", value: "Login" });
    expect(parseTaskField("title", "   ")).toEqual({ ok: false, error: "El título es obligatorio" });
  });

  it("keeps description markdown as-is and maps blank to null", () => {
    expect(parseTaskField("description", "- a\n- b\n")).toEqual({ ok: true, field: "description", value: "- a\n- b\n" });
    expect(parseTaskField("description", "  ")).toEqual({ ok: true, field: "description", value: null });
  });

  it("validates status and priority against their enums", () => {
    expect(parseTaskField("status", "in_progress")).toEqual({ ok: true, field: "status", value: "in_progress" });
    expect(parseTaskField("status", "done")).toEqual({ ok: false, error: "Estado inválido" });
    expect(parseTaskField("priority", "urgent")).toEqual({ ok: true, field: "priority", value: "urgent" });
    expect(parseTaskField("priority", "max")).toEqual({ ok: false, error: "Prioridad inválida" });
  });

  it("accepts a real date or blank for due_date", () => {
    expect(parseTaskField("due_date", "2026-09-30")).toEqual({ ok: true, field: "due_date", value: "2026-09-30" });
    expect(parseTaskField("due_date", "")).toEqual({ ok: true, field: "due_date", value: null });
    expect(parseTaskField("due_date", "2026-02-30")).toEqual({ ok: false, error: "La fecha límite no es válida" });
  });

  it("requires assigned_to", () => {
    expect(parseTaskField("assigned_to", "u1")).toEqual({ ok: true, field: "assigned_to", value: "u1" });
    expect(parseTaskField("assigned_to", "")).toEqual({ ok: false, error: "Debes asignar el pendiente a un socio" });
  });

  it("maps blank or 'none' project/deliverable to null", () => {
    expect(parseTaskField("project_id", "p1")).toEqual({ ok: true, field: "project_id", value: "p1" });
    expect(parseTaskField("project_id", "none")).toEqual({ ok: true, field: "project_id", value: null });
    expect(parseTaskField("deliverable_id", "")).toEqual({ ok: true, field: "deliverable_id", value: null });
  });

  it("rejects non-string values", () => {
    expect(parseTaskField("title", 42)).toEqual({ ok: false, error: "Valor inválido" });
  });
});

describe("checklistProgress", () => {
  it("counts done items", () => {
    expect(checklistProgress([])).toEqual({ done: 0, total: 0 });
    expect(checklistProgress([{ done: true }, { done: false }, { done: true }])).toEqual({ done: 2, total: 3 });
  });
});
