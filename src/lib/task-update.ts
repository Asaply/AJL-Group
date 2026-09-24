import { isValidDateKey } from "@/lib/project-form";

export const EDITABLE_TASK_FIELDS = [
  "title",
  "description",
  "status",
  "priority",
  "due_date",
  "assigned_to",
  "project_id",
  "deliverable_id",
] as const;

export type EditableTaskField = (typeof EDITABLE_TASK_FIELDS)[number];

export type ParseFieldResult =
  | { ok: true; field: EditableTaskField; value: string | null }
  | { ok: false; error: string };

const STATUSES = ["pending", "in_progress", "completed"];
const PRIORITIES = ["urgent", "high", "medium", "low"];

/** Validates a single-field edit coming from the task detail panel. */
export function parseTaskField(field: string, value: unknown): ParseFieldResult {
  if (!(EDITABLE_TASK_FIELDS as readonly string[]).includes(field)) {
    return { ok: false, error: "Campo no editable" };
  }
  const f = field as EditableTaskField;
  if (value !== null && value !== undefined && typeof value !== "string") {
    return { ok: false, error: "Valor inválido" };
  }
  const raw = typeof value === "string" ? value : "";
  const trimmed = raw.trim();
  const ok = (v: string | null): ParseFieldResult => ({ ok: true, field: f, value: v });
  const fail = (error: string): ParseFieldResult => ({ ok: false, error });

  switch (f) {
    case "title":
      return trimmed ? ok(trimmed) : fail("El título es obligatorio");
    case "description":
      return ok(trimmed ? raw : null);
    case "status":
      return STATUSES.includes(trimmed) ? ok(trimmed) : fail("Estado inválido");
    case "priority":
      return PRIORITIES.includes(trimmed) ? ok(trimmed) : fail("Prioridad inválida");
    case "due_date":
      if (!trimmed) return ok(null);
      return isValidDateKey(trimmed) ? ok(trimmed) : fail("La fecha límite no es válida");
    case "assigned_to":
      return trimmed ? ok(trimmed) : fail("Debes asignar el pendiente a un socio");
    case "project_id":
    case "deliverable_id":
      return ok(trimmed && trimmed !== "none" ? trimmed : null);
  }
}

export function checklistProgress(items: { done: boolean }[]): { done: number; total: number } {
  return { done: items.filter((i) => i.done).length, total: items.length };
}
