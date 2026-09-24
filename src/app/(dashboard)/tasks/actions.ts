"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TaskPriority, TaskStatus } from "@/types";

const TASK_PRIORITIES: TaskPriority[] = ["urgent", "high", "medium", "low"];
const TASK_STATUSES: TaskStatus[] = ["pending", "in_progress", "completed"];

function normalizeProjectId(raw: FormDataEntryValue | null): string | null {
  const value = raw as string | null;
  if (!value || value === "none") return null;
  return value;
}

export async function createTask(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const title = ((formData.get("title") as string) || "").trim();
  if (!title) return { error: "El título es obligatorio" };

  const assigned_to = formData.get("assigned_to") as string;
  if (!assigned_to) return { error: "Debes asignar el pendiente a un socio" };

  const rawPriority = formData.get("priority") as string;
  const priority: TaskPriority = TASK_PRIORITIES.includes(rawPriority as TaskPriority)
    ? (rawPriority as TaskPriority)
    : "medium";

  const { error } = await supabase.from("tasks").insert({
    title,
    description: (formData.get("description") as string) || null,
    priority,
    due_date: (formData.get("due_date") as string) || null,
    project_id: normalizeProjectId(formData.get("project_id")),
    assigned_to,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/");
  revalidatePath("/projects", "layout");
}

export async function updateTaskStatus(id: string, status: string) {
  if (!TASK_STATUSES.includes(status as TaskStatus)) {
    return { error: "Status inválido" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tasks");
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/projects", "layout");
}

export async function deleteTask(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/");
  revalidatePath("/projects", "layout");
}
