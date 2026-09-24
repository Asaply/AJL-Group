"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { percentageTotal, exceedsHundred } from "@/lib/finance";
import { parseProjectForm, parseMemberForm, validatePercentage } from "@/lib/project-form";
import { parseHttpUrl } from "@/lib/url";
import { actionError, isForeignKeyViolation, SAVE_ERROR, DELETE_ERROR, LOAD_ERROR } from "@/lib/action-error";

const PERCENTAGE_SUM_ERROR = "La suma de porcentajes no puede exceder 100%";

/**
 * Project data (status, budget, members, links) feeds the dashboard home,
 * finance, tasks and calendar views, so every project mutation revalidates
 * the whole dashboard layout rather than individual paths.
 */
function revalidateDashboard() {
  revalidatePath("/", "layout");
}

export async function createProject(formData: FormData) {
  const parsed = parseProjectForm(formData, "create");
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("projects").insert(parsed.values);
  if (error) return actionError("createProject", error, SAVE_ERROR);
  revalidateDashboard();
}

export async function updateProject(id: string, formData: FormData) {
  const parsed = parseProjectForm(formData, "update");
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("projects").update(parsed.values).eq("id", id);
  if (error) return actionError("updateProject", error, SAVE_ERROR);
  revalidateDashboard();
}

export async function deleteProject(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) {
    // transactions.project_id is ON DELETE RESTRICT: a project with
    // recorded transactions cannot be deleted until they are removed.
    if (isForeignKeyViolation(error)) {
      console.error("[deleteProject]", error);
      return {
        error: "No se puede eliminar: el proyecto tiene transacciones registradas. Elimínalas primero.",
      };
    }
    return actionError("deleteProject", error, DELETE_ERROR);
  }
  revalidateDashboard();
}

export async function addProjectLink(projectId: string, formData: FormData) {
  const label = ((formData.get("label") as string) || "").trim();
  if (!label) return { error: "La etiqueta es obligatoria" };

  const url = parseHttpUrl(formData.get("url"));
  if (!url) return { error: "La URL no es válida" };

  const supabase = await createClient();
  const { error } = await supabase.from("project_links").insert({
    project_id: projectId,
    label,
    url,
  });
  if (error) return actionError("addProjectLink", error, SAVE_ERROR);
  revalidateDashboard();
}

export async function deleteProjectLink(linkId: string, projectId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("project_links").delete().eq("id", linkId).eq("project_id", projectId);
  if (error) return actionError("deleteProjectLink", error, DELETE_ERROR);
  revalidateDashboard();
}

export async function addProjectMember(projectId: string, formData: FormData) {
  const parsed = parseMemberForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { user_id, role_description, profit_percentage } = parsed.values;

  const supabase = await createClient();

  const { data: existingMembers, error: fetchError } = await supabase
    .from("project_members")
    .select("profit_percentage")
    .eq("project_id", projectId);
  if (fetchError) return actionError("addProjectMember:fetch", fetchError, LOAD_ERROR);

  const total = percentageTotal([...(existingMembers || []), { profit_percentage }]);
  if (exceedsHundred(total)) return { error: PERCENTAGE_SUM_ERROR };

  const { error } = await supabase.from("project_members").insert({
    project_id: projectId,
    user_id,
    role_description,
    profit_percentage,
  });
  if (error) return actionError("addProjectMember", error, SAVE_ERROR);
  revalidateDashboard();
}

export async function updateMemberPercentage(memberId: string, projectId: string, percentage: number) {
  const percentageError = validatePercentage(percentage);
  if (percentageError) return { error: percentageError };

  const supabase = await createClient();

  const { data: existingMembers, error: fetchError } = await supabase
    .from("project_members")
    .select("id, profit_percentage")
    .eq("project_id", projectId);
  if (fetchError) return actionError("updateMemberPercentage:fetch", fetchError, LOAD_ERROR);

  const otherMembers = (existingMembers || []).filter((m) => m.id !== memberId);
  const total = percentageTotal([...otherMembers, { profit_percentage: percentage }]);
  if (exceedsHundred(total)) return { error: PERCENTAGE_SUM_ERROR };

  const { error } = await supabase
    .from("project_members")
    .update({ profit_percentage: percentage })
    .eq("id", memberId);
  if (error) return actionError("updateMemberPercentage", error, SAVE_ERROR);
  revalidateDashboard();
}

export async function removeProjectMember(memberId: string, projectId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("project_members").delete().eq("id", memberId).eq("project_id", projectId);
  if (error) return actionError("removeProjectMember", error, DELETE_ERROR);
  revalidateDashboard();
}
