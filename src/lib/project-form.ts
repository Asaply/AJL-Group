import type { ProjectStatus } from "@/types";
import { parseHexColor } from "@/lib/colors";

/**
 * Pure parsing/validation for the project server actions. Kept free of
 * Supabase/Next.js so it can be unit tested in isolation.
 */

export const PROJECT_STATUSES: ProjectStatus[] = ["active", "paused", "completed"];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** True for a real calendar date in "YYYY-MM-DD" form (rejects 2026-02-30). */
export function isValidDateKey(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Blank → 0; otherwise must be a finite number >= 0. Returns null when invalid. */
function parseMoney(raw: string): number | null {
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export interface ProjectFormValues {
  name: string;
  client_id: string | null;
  status: ProjectStatus;
  start_date: string;
  end_date: string | null;
  budget: number;
  production_cost: number;
  color: string;
}

export type ParseResult<T> = { ok: true; values: T } | { ok: false; error: string };

export function parseProjectForm(
  formData: FormData,
  mode: "create" | "update"
): ParseResult<ProjectFormValues> {
  const name = str(formData, "name");
  if (!name) return { ok: false, error: "El nombre es obligatorio" };

  const rawClient = str(formData, "client_id");
  const client_id = rawClient && rawClient !== "none" ? rawClient : null;

  const rawStatus = str(formData, "status");
  let status: ProjectStatus;
  if (PROJECT_STATUSES.includes(rawStatus as ProjectStatus)) {
    status = rawStatus as ProjectStatus;
  } else if (mode === "create") {
    status = "active";
  } else {
    return { ok: false, error: "Estado inválido" };
  }

  const start_date = str(formData, "start_date");
  if (!isValidDateKey(start_date)) return { ok: false, error: "La fecha de inicio no es válida" };

  const rawEnd = str(formData, "end_date");
  let end_date: string | null = null;
  if (rawEnd) {
    if (!isValidDateKey(rawEnd)) return { ok: false, error: "La fecha de fin no es válida" };
    if (rawEnd < start_date) {
      return { ok: false, error: "La fecha de fin no puede ser anterior a la fecha de inicio" };
    }
    end_date = rawEnd;
  }

  const budget = parseMoney(str(formData, "budget"));
  if (budget === null) return { ok: false, error: "El presupuesto debe ser un número mayor o igual a 0" };

  const production_cost = parseMoney(str(formData, "production_cost"));
  if (production_cost === null) {
    return { ok: false, error: "El costo de producción debe ser un número mayor o igual a 0" };
  }

  const color = parseHexColor(formData.get("color"));
  if (!color) return { ok: false, error: "Color inválido" };

  const values: ProjectFormValues = { name, client_id, status, start_date, end_date, budget, production_cost, color };

  return { ok: true, values };
}

export function validatePercentage(percentage: number): string | null {
  if (!Number.isFinite(percentage)) return "Porcentaje inválido";
  if (percentage < 0 || percentage > 100) return "El porcentaje debe estar entre 0 y 100";
  return null;
}

export interface MemberFormValues {
  user_id: string;
  role_description: string | null;
  profit_percentage: number;
}

export function parseMemberForm(formData: FormData): ParseResult<MemberFormValues> {
  const user_id = str(formData, "user_id");
  if (!user_id) return { ok: false, error: "Debes seleccionar un socio" };

  const rawPercentage = str(formData, "profit_percentage");
  const profit_percentage = rawPercentage ? Number(rawPercentage) : NaN;
  const percentageError = validatePercentage(profit_percentage);
  if (percentageError) return { ok: false, error: percentageError };

  const role_description = str(formData, "role_description") || null;

  return { ok: true, values: { user_id, role_description, profit_percentage } };
}
