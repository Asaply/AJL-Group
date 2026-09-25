"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { actionError, logActionError, SAVE_ERROR, DELETE_ERROR, LOAD_ERROR } from "@/lib/action-error";
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
  const user = await getAuthUser();
  if (!user) return { error: "No autenticado" };

  const title = ((formData.get("title") as string) || "").trim();
  if (!title) return { error: "El título es obligatorio" };

  const assigned_to = formData.get("assigned_to") as string;
  if (!assigned_to) return { error: "Debes asignar el pendiente a un socio" };

  const rawPriority = formData.get("priority") as string;
  const priority: TaskPriority = TASK_PRIORITIES.includes(rawPriority as TaskPriority)
    ? (rawPriority as TaskPriority)
    : "medium";

  const project_id = normalizeProjectId(formData.get("project_id"));
  const deliverable_id = normalizeProjectId(formData.get("deliverable_id"));

  // A project task always hangs from a deliverable; only general tasks go without one.
  if (project_id && !deliverable_id) return { error: "Asigna el pendiente a un entregable del proyecto" };
  if (deliverable_id) {
    if (!project_id) return { error: "El entregable no pertenece a este proyecto" };
    const { data: deliverable, error: dError } = await supabase
      .from("deliverables")
      .select("id")
      .eq("id", deliverable_id)
      .eq("project_id", project_id)
      .maybeSingle();
    if (dError) return actionError("createTask:deliverable", dError, LOAD_ERROR);
    if (!deliverable) return { error: "El entregable no pertenece a este proyecto" };
  }

  const { error } = await supabase.from("tasks").insert({
    title,
    description: (formData.get("description") as string) || null,
    priority,
    due_date: (formData.get("due_date") as string) || null,
    project_id,
    deliverable_id,
    assigned_to,
    created_by: user.id,
  });
  if (error) return actionError("createTask", error, SAVE_ERROR);
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/");
  revalidatePath("/projects", "layout");
}

export async function updateTaskStatus(id: string, status: string) {
  if (!TASK_STATUSES.includes(status as TaskStatus)) {
    return { error: "Estado inválido" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
  if (error) return actionError("updateTaskStatus", error, SAVE_ERROR);
  revalidatePath("/tasks");
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/projects", "layout");
}

export async function deleteTask(id: string) {
  const supabase = await createClient();
  // Collect the attachment paths first (the rows cascade away with the task),
  // delete the task row, and only then remove the Storage objects. If the row
  // delete fails nothing in Storage is touched, so the task keeps working
  // files; if the Storage cleanup fails the worst case is a harmless orphan
  // object, which is just logged.
  const { data: files, error: filesError } = await supabase
    .from("task_attachments")
    .select("storage_path")
    .eq("task_id", id);
  if (filesError) logActionError("deleteTask:files", filesError);

  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return actionError("deleteTask", error, DELETE_ERROR);

  if (files && files.length > 0) {
    const { error: storageError } = await supabase.storage.from("task-files").remove(files.map((f) => f.storage_path));
    if (storageError) logActionError("deleteTask:storage", storageError);
  }
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/");
  revalidatePath("/projects", "layout");
}
