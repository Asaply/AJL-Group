"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { percentageTotal, exceedsHundred } from "@/lib/finance";

function validatePercentage(percentage: number): string | null {
  if (!Number.isFinite(percentage)) return "El porcentaje debe ser un número válido";
  if (percentage < 0 || percentage > 100) return "El porcentaje debe estar entre 0 y 100";
  return null;
}

export async function createProject(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").insert({
    name: formData.get("name") as string,
    client: formData.get("client") as string,
    status: (formData.get("status") as string) || "active",
    start_date: formData.get("start_date") as string,
    end_date: (formData.get("end_date") as string) || null,
    budget: parseFloat(formData.get("budget") as string) || 0,
    production_cost: parseFloat(formData.get("production_cost") as string) || 0,
  });
  if (error) return { error: error.message };
  revalidatePath("/projects");
}

export async function updateProject(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      name: formData.get("name") as string,
      client: formData.get("client") as string,
      status: formData.get("status") as string,
      progress: parseInt(formData.get("progress") as string) || 0,
      start_date: formData.get("start_date") as string,
      end_date: (formData.get("end_date") as string) || null,
      budget: parseFloat(formData.get("budget") as string) || 0,
      production_cost: parseFloat(formData.get("production_cost") as string) || 0,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
}

export async function deleteProject(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/projects");
}

export async function addProjectLink(projectId: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("project_links").insert({
    project_id: projectId,
    label: formData.get("label") as string,
    url: formData.get("url") as string,
  });
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteProjectLink(linkId: string, projectId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("project_links").delete().eq("id", linkId);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
}

export async function addProjectMember(projectId: string, formData: FormData) {
  const supabase = await createClient();

  const rawPercentage = parseFloat(formData.get("profit_percentage") as string);
  const profit_percentage = Number.isFinite(rawPercentage) ? rawPercentage : 33.33;

  const percentageError = validatePercentage(profit_percentage);
  if (percentageError) return { error: percentageError };

  const { data: existingMembers, error: fetchError } = await supabase
    .from("project_members")
    .select("profit_percentage")
    .eq("project_id", projectId);
  if (fetchError) return { error: fetchError.message };

  const total = percentageTotal([...(existingMembers || []), { profit_percentage }]);
  if (exceedsHundred(total)) {
    return { error: "La suma de porcentajes no puede exceder 100%" };
  }

  const { error } = await supabase.from("project_members").insert({
    project_id: projectId,
    user_id: formData.get("user_id") as string,
    role_description: (formData.get("role_description") as string) || null,
    profit_percentage,
  });
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
}

export async function updateMemberPercentage(memberId: string, projectId: string, percentage: number) {
  const percentageError = validatePercentage(percentage);
  if (percentageError) return { error: percentageError };

  const supabase = await createClient();

  const { data: existingMembers, error: fetchError } = await supabase
    .from("project_members")
    .select("id, profit_percentage")
    .eq("project_id", projectId);
  if (fetchError) return { error: fetchError.message };

  const otherMembers = (existingMembers || []).filter((m) => m.id !== memberId);
  const total = percentageTotal([...otherMembers, { profit_percentage: percentage }]);
  if (exceedsHundred(total)) {
    return { error: "La suma de porcentajes no puede exceder 100%" };
  }

  const { error } = await supabase
    .from("project_members")
    .update({ profit_percentage: percentage })
    .eq("id", memberId);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
}

export async function removeProjectMember(memberId: string, projectId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("project_members").delete().eq("id", memberId);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
}
