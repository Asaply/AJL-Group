import { round2 } from "@/lib/finance";
import type { ParseResult } from "@/lib/project-form";

export interface DeliverableFormValues {
  title: string;
  weight: number;
}

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function parseDeliverableForm(formData: FormData): ParseResult<DeliverableFormValues> {
  const title = str(formData, "title");
  if (!title) return { ok: false, error: "El título es obligatorio" };

  const rawWeight = str(formData, "weight");
  const weight = rawWeight ? Number(rawWeight) : NaN;
  if (!Number.isFinite(weight) || weight < 0 || weight > 100) {
    return { ok: false, error: "Peso inválido" };
  }

  return { ok: true, values: { title, weight: round2(weight) } };
}
