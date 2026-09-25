"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseTaskField } from "@/lib/task-update";
import { parseAttachmentMeta } from "@/lib/attachments";
import { moveItem } from "@/lib/deliverables";
import { parseHttpUrl } from "@/lib/url";
import { actionError, logActionError, SAVE_ERROR, DELETE_ERROR, LOAD_ERROR } from "@/lib/action-error";
import type { TaskDetail } from "@/types";

const BUCKET = "task-files";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function revalidateDashboard() {
  revalidatePath("/", "layout");
}

export async function getTaskDetail(id: string): Promise<{ detail: TaskDetail } | { error: string }> {
  // A malformed ?task= param would otherwise surface as a Postgres uuid cast error.
  if (typeof id !== "string" || !UUID_RE.test(id)) return { error: "Pendiente no encontrado" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const [task, checklist, links, comments, events, attachments, users, projects, deliverables] = await Promise.all([
    supabase
      .from("tasks")
      .select("*, assignee:users!assigned_to(*), project:projects(*), deliverable:deliverables(*)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("task_checklist_items").select("*").eq("task_id", id).order("position").order("created_at"),
    supabase.from("task_links").select("*").eq("task_id", id).order("created_at"),
    supabase.from("task_comments").select("*, author:users(*)").eq("task_id", id).order("created_at"),
    supabase.from("task_events").select("*, actor:users(*)").eq("task_id", id).order("created_at"),
    supabase.from("task_attachments").select("*, uploader:users(*)").eq("task_id", id).order("created_at"),
    supabase.from("users").select("*").order("name"),
    supabase.from("projects").select("*").order("name"),
    supabase.from("deliverables").select("*").order("position"),
  ]);

  const failed = [task, checklist, links, comments, events, attachments, users, projects, deliverables].find(
    (r) => r.error
  );
  if (failed?.error) return actionError("getTaskDetail", failed.error, LOAD_ERROR);
  if (!task.data) return { error: "Pendiente no encontrado" };

  return {
    detail: {
      task: task.data,
      checklist: checklist.data || [],
      links: links.data || [],
      comments: comments.data || [],
      events: events.data || [],
      attachments: attachments.data || [],
      users: users.data || [],
      projects: projects.data || [],
      deliverables: deliverables.data || [],
      currentUserId: user.id,
    },
  };
}

export async function updateTaskField(id: string, field: string, value: string | null) {
  const parsed = parseTaskField(field, value);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const patch: Record<string, string | null> = { [parsed.field]: parsed.value };

  if (parsed.field === "project_id" || parsed.field === "deliverable_id") {
    const { data: current, error: currentError } = await supabase
      .from("tasks")
      .select("project_id, deliverable_id")
      .eq("id", id)
      .maybeSingle();
    if (currentError) return actionError("updateTaskField:current", currentError, LOAD_ERROR);
    if (!current) return { error: "Pendiente no encontrado" };

    const projectId = parsed.field === "project_id" ? parsed.value : current.project_id;
    const deliverableId = parsed.field === "deliverable_id" ? parsed.value : current.deliverable_id;

    if (deliverableId) {
      let belongs = false;
      if (projectId) {
        const { data: deliverable, error: dError } = await supabase
          .from("deliverables")
          .select("id")
          .eq("id", deliverableId)
          .eq("project_id", projectId)
          .maybeSingle();
        if (dError) return actionError("updateTaskField:deliverable", dError, LOAD_ERROR);
        belongs = !!deliverable;
      }
      if (!belongs) {
        if (parsed.field === "deliverable_id") return { error: "El entregable no pertenece a este proyecto" };
        patch.deliverable_id = null; // moving projects drops a deliverable from the old project
      }
    }
  }

  const { data, error } = await supabase.from("tasks").update(patch).eq("id", id).select("id");
  if (error) return actionError("updateTaskField", error, SAVE_ERROR);
  if (!data || data.length === 0) return { error: "Pendiente no encontrado" };
  revalidateDashboard();
}

// ---------- Checklist ----------

export async function addChecklistItem(taskId: string, text: string) {
  const trimmed = (text || "").trim();
  if (!trimmed) return { error: "El paso no puede estar vacío" };

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("task_checklist_items")
    .select("position")
    .eq("task_id", taskId);
  if (fetchError) return actionError("addChecklistItem:fetch", fetchError, LOAD_ERROR);
  const position = (existing || []).reduce((max, r) => Math.max(max, r.position), -1) + 1;

  const { error } = await supabase.from("task_checklist_items").insert({ task_id: taskId, text: trimmed, position });
  if (error) return actionError("addChecklistItem", error, SAVE_ERROR);
  revalidateDashboard();
}

export async function updateChecklistItem(id: string, taskId: string, patch: { text?: string; done?: boolean }) {
  const update: { text?: string; done?: boolean } = {};
  if (patch.text !== undefined) {
    const trimmed = patch.text.trim();
    if (!trimmed) return { error: "El paso no puede estar vacío" };
    update.text = trimmed;
  }
  if (patch.done !== undefined) update.done = patch.done;
  if (Object.keys(update).length === 0) return;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_checklist_items")
    .update(update)
    .eq("id", id)
    .eq("task_id", taskId)
    .select("id");
  if (error) return actionError("updateChecklistItem", error, SAVE_ERROR);
  if (!data || data.length === 0) return { error: "Este paso ya no existe" };
  revalidateDashboard();
}

export async function moveChecklistItem(id: string, taskId: string, direction: "up" | "down") {
  const supabase = await createClient();
  const { data: rows, error: fetchError } = await supabase
    .from("task_checklist_items")
    .select("id")
    .eq("task_id", taskId)
    .order("position")
    .order("created_at");
  if (fetchError) return actionError("moveChecklistItem:fetch", fetchError, LOAD_ERROR);

  const order = moveItem((rows || []).map((r) => r.id), id, direction);
  const results = await Promise.all(
    order.map((itemId, position) =>
      supabase.from("task_checklist_items").update({ position }).eq("id", itemId).eq("task_id", taskId)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return actionError("moveChecklistItem", failed.error, SAVE_ERROR);
  revalidateDashboard();
}

export async function deleteChecklistItem(id: string, taskId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_checklist_items")
    .delete()
    .eq("id", id)
    .eq("task_id", taskId)
    .select("id");
  if (error) return actionError("deleteChecklistItem", error, DELETE_ERROR);
  if (!data || data.length === 0) return { error: "Este paso ya no existe" };
  revalidateDashboard();
}

// ---------- Links ----------

export async function addTaskLink(taskId: string, formData: FormData) {
  const label = ((formData.get("label") as string) || "").trim();
  if (!label) return { error: "La etiqueta es obligatoria" };
  const url = parseHttpUrl(formData.get("url"));
  if (!url) return { error: "La URL no es válida" };

  const supabase = await createClient();
  const { error } = await supabase.from("task_links").insert({ task_id: taskId, label, url });
  if (error) return actionError("addTaskLink", error, SAVE_ERROR);
  revalidateDashboard();
}

export async function deleteTaskLink(id: string, taskId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("task_links").delete().eq("id", id).eq("task_id", taskId).select("id");
  if (error) return actionError("deleteTaskLink", error, DELETE_ERROR);
  if (!data || data.length === 0) return { error: "Este link ya no existe" };
  revalidateDashboard();
}

// ---------- Comments ----------

export async function addComment(taskId: string, body: string) {
  const trimmed = (body || "").trim();
  if (!trimmed) return { error: "El comentario no puede estar vacío" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase.from("task_comments").insert({ task_id: taskId, author_id: user.id, body: trimmed });
  if (error) return actionError("addComment", error, SAVE_ERROR);
  revalidateDashboard();
}

export async function updateComment(id: string, taskId: string, body: string) {
  const trimmed = (body || "").trim();
  if (!trimmed) return { error: "El comentario no puede estar vacío" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_comments")
    .update({ body: trimmed })
    .eq("id", id)
    .eq("task_id", taskId)
    .select("id");
  if (error) return actionError("updateComment", error, SAVE_ERROR);
  if (!data || data.length === 0) return { error: "No puedes editar este comentario" };
  revalidateDashboard();
}

export async function deleteComment(id: string, taskId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_comments")
    .delete()
    .eq("id", id)
    .eq("task_id", taskId)
    .select("id");
  if (error) return actionError("deleteComment", error, DELETE_ERROR);
  if (!data || data.length === 0) return { error: "No puedes eliminar este comentario" };
  revalidateDashboard();
}

// ---------- Attachments ----------

export async function registerAttachment(
  taskId: string,
  meta: { storage_path: string; file_name: string; size_bytes: number; mime_type: string | null }
) {
  // Server actions receive untrusted input: check types and require the exact
  // path the client builds, so a row can't point at another task's object.
  const parsed = parseAttachmentMeta(taskId, meta);
  if (!parsed.ok) return { error: parsed.error };
  const { storage_path, file_name, size_bytes, mime_type } = parsed.value;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase.from("task_attachments").insert({
    task_id: taskId,
    uploaded_by: user.id,
    storage_path,
    file_name,
    size_bytes,
    mime_type,
  });
  if (error) return actionError("registerAttachment", error, SAVE_ERROR);
  revalidateDashboard();
}

export async function deleteAttachment(id: string, taskId: string) {
  const supabase = await createClient();
  // RLS lets only the uploader delete the row; the object is removed only if the row was.
  const { data, error } = await supabase
    .from("task_attachments")
    .delete()
    .eq("id", id)
    .eq("task_id", taskId)
    .select("storage_path");
  if (error) return actionError("deleteAttachment", error, DELETE_ERROR);
  if (!data || data.length === 0) return { error: "No puedes eliminar este archivo" };

  const { error: storageError } = await supabase.storage.from(BUCKET).remove(data.map((r) => r.storage_path));
  if (storageError) logActionError("deleteAttachment:storage", storageError);
  revalidateDashboard();
}

export async function getAttachmentUrl(
  id: string,
  taskId: string,
  download: boolean
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("task_attachments")
    .select("storage_path, file_name")
    .eq("id", id)
    .eq("task_id", taskId)
    .maybeSingle();
  if (error) return actionError("getAttachmentUrl", error, LOAD_ERROR);
  if (!row) return { error: "Archivo no encontrado" };

  const { data, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, 60, download ? { download: row.file_name } : undefined);
  if (signError || !data) {
    return actionError("getAttachmentUrl:sign", signError ?? new Error("createSignedUrl returned no data"), LOAD_ERROR);
  }
  return { url: data.signedUrl };
}
