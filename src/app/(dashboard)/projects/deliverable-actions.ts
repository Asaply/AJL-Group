"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exceedsHundred } from "@/lib/finance";
import { deliverableStatus, moveItem, weightTotal } from "@/lib/deliverables";
import { parseDeliverableForm } from "@/lib/deliverable-form";
import { actionError, SAVE_ERROR, DELETE_ERROR, LOAD_ERROR } from "@/lib/action-error";

const WEIGHT_SUM_ERROR = "La suma de pesos no puede exceder 100%";

/** Deliverables drive project progress, which is shown on the dashboard, projects and finance. */
function revalidateDashboard() {
  revalidatePath("/", "layout");
}

export async function createDeliverable(projectId: string, formData: FormData) {
  const parsed = parseDeliverableForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("deliverables")
    .select("weight, position")
    .eq("project_id", projectId);
  if (fetchError) return actionError("createDeliverable:fetch", fetchError, LOAD_ERROR);

  const rows = existing || [];
  if (exceedsHundred(weightTotal([...rows, { weight: parsed.values.weight }]))) {
    return { error: WEIGHT_SUM_ERROR };
  }
  const position = rows.reduce((max, r) => Math.max(max, r.position), -1) + 1;

  const { error } = await supabase
    .from("deliverables")
    .insert({ project_id: projectId, ...parsed.values, position });
  if (error) return actionError("createDeliverable", error, SAVE_ERROR);
  revalidateDashboard();
}

export async function updateDeliverable(id: string, projectId: string, formData: FormData) {
  const parsed = parseDeliverableForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("deliverables")
    .select("id, weight")
    .eq("project_id", projectId);
  if (fetchError) return actionError("updateDeliverable:fetch", fetchError, LOAD_ERROR);

  const others = (existing || []).filter((d) => d.id !== id);
  if (exceedsHundred(weightTotal([...others, { weight: parsed.values.weight }]))) {
    return { error: WEIGHT_SUM_ERROR };
  }

  const { error } = await supabase
    .from("deliverables")
    .update(parsed.values)
    .eq("id", id)
    .eq("project_id", projectId);
  if (error) return actionError("updateDeliverable", error, SAVE_ERROR);
  revalidateDashboard();
}

export async function moveDeliverable(id: string, projectId: string, direction: "up" | "down") {
  const supabase = await createClient();
  const { data: rows, error: fetchError } = await supabase
    .from("deliverables")
    .select("id")
    .eq("project_id", projectId)
    .order("position")
    .order("created_at");
  if (fetchError) return actionError("moveDeliverable:fetch", fetchError, LOAD_ERROR);

  const order = moveItem((rows || []).map((r) => r.id), id, direction);
  const results = await Promise.all(
    order.map((deliverableId, position) =>
      supabase.from("deliverables").update({ position }).eq("id", deliverableId).eq("project_id", projectId)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return actionError("moveDeliverable", failed.error, SAVE_ERROR);
  revalidateDashboard();
}

export async function approveDeliverable(id: string, projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const [{ data: deliverable, error: dError }, { data: tasks, error: tError }] = await Promise.all([
    supabase.from("deliverables").select("approved_at").eq("id", id).eq("project_id", projectId).single(),
    supabase.from("tasks").select("status").eq("deliverable_id", id),
  ]);
  if (dError || !deliverable) return actionError("approveDeliverable:fetch", dError, LOAD_ERROR);
  if (tError) return actionError("approveDeliverable:tasks", tError, LOAD_ERROR);

  const { status } = deliverableStatus(deliverable, tasks || []);
  if (status === "approved") return { error: "El entregable ya está aprobado" };
  if (status !== "ready") return { error: "Aún hay pendientes abiertos" };

  const { error } = await supabase
    .from("deliverables")
    .update({ approved_at: new Date().toISOString(), approved_by: user.id })
    .eq("id", id)
    .eq("project_id", projectId);
  if (error) return actionError("approveDeliverable", error, SAVE_ERROR);
  revalidateDashboard();
}

export async function revokeDeliverable(id: string, projectId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("deliverables")
    .update({ approved_at: null, approved_by: null })
    .eq("id", id)
    .eq("project_id", projectId);
  if (error) return actionError("revokeDeliverable", error, SAVE_ERROR);
  revalidateDashboard();
}

export async function setTaskDeliverable(
  taskId: string,
  deliverableId: string | null,
  projectId: string
) {
  const supabase = await createClient();

  if (deliverableId) {
    const { data: deliverable, error: dError } = await supabase
      .from("deliverables")
      .select("id")
      .eq("id", deliverableId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (dError) return actionError("setTaskDeliverable:fetch", dError, LOAD_ERROR);
    if (!deliverable) return { error: "El entregable no pertenece a este proyecto" };
  }

  const { data, error } = await supabase
    .from("tasks")
    .update({ deliverable_id: deliverableId })
    .eq("id", taskId)
    .eq("project_id", projectId)
    .select("id");
  if (error) return actionError("setTaskDeliverable", error, SAVE_ERROR);
  if (!data || data.length === 0) return { error: "El pendiente no pertenece a este proyecto" };
  revalidateDashboard();
}

export async function deleteDeliverable(id: string, projectId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("deliverables").delete().eq("id", id).eq("project_id", projectId);
  if (error) return actionError("deleteDeliverable", error, DELETE_ERROR);
  revalidateDashboard();
}
