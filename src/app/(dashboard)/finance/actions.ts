"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TransactionType } from "@/types";

const TRANSACTION_TYPES: TransactionType[] = ["income", "expense"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function createTransaction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const project_id = formData.get("project_id") as string;
  if (!project_id) return { error: "El proyecto es obligatorio" };

  const rawType = formData.get("type") as string;
  if (!TRANSACTION_TYPES.includes(rawType as TransactionType)) {
    return { error: "El tipo de transacción no es válido" };
  }
  const type = rawType as TransactionType;

  const amount = parseFloat(formData.get("amount") as string);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "El monto debe ser un número mayor a 0" };
  }

  const description = ((formData.get("description") as string) || "").trim();
  if (!description) return { error: "La descripción es obligatoria" };

  const date = formData.get("date") as string;
  if (!date || !DATE_RE.test(date)) {
    return { error: "La fecha no es válida" };
  }

  const { error } = await supabase.from("transactions").insert({
    project_id,
    type,
    amount,
    description,
    date,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/finance");
  revalidatePath("/");
}

export async function deleteTransaction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/finance");
  revalidatePath("/");
}
