"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { parseClientFiscalForm, parseClientForm, parseContactForm } from "@/lib/clients";
import { parseLogoPath } from "@/lib/client-logo";
import { actionError, logActionError, SAVE_ERROR, DELETE_ERROR, LOAD_ERROR } from "@/lib/action-error";

const LOGO_BUCKET = "client-logos";
const CLIENT_GONE = "Este cliente ya no existe";
const CONTACT_GONE = "Este contacto ya no existe";

function revalidateDashboard() {
  revalidatePath("/", "layout");
}

function roleOrNull(role: string): string | null {
  const trimmed = (role || "").trim();
  return trimmed ? trimmed.slice(0, 200) : null;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}

// ---------- Clients ----------

export async function createClientRecord(formData: FormData): Promise<{ id: string } | { error: string }> {
  const parsed = parseClientForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createSupabase();
  const { data, error } = await supabase.from("clients").insert(parsed.values).select("id").single();
  if (error || !data) return actionError("createClientRecord", error, SAVE_ERROR);
  revalidateDashboard();
  return { id: data.id };
}

export async function updateClient(id: string, formData: FormData) {
  const parsed = parseClientForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createSupabase();
  const { data, error } = await supabase.from("clients").update(parsed.values).eq("id", id).select("id");
  if (error) return actionError("updateClient", error, SAVE_ERROR);
  if (!data || data.length === 0) return { error: CLIENT_GONE };
  revalidateDashboard();
}

export async function updateClientFiscal(id: string, formData: FormData) {
  const parsed = parseClientFiscalForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createSupabase();
  const { data, error } = await supabase.from("clients").update(parsed.values).eq("id", id).select("id");
  if (error) return actionError("updateClientFiscal", error, SAVE_ERROR);
  if (!data || data.length === 0) return { error: CLIENT_GONE };
  revalidateDashboard();
}

export async function updateClientNotes(id: string, notes: string) {
  const value = typeof notes === "string" && notes.trim() ? notes : null;
  const supabase = await createSupabase();
  const { data, error } = await supabase.from("clients").update({ notes: value }).eq("id", id).select("id");
  if (error) return actionError("updateClientNotes", error, SAVE_ERROR);
  if (!data || data.length === 0) return { error: CLIENT_GONE };
  revalidateDashboard();
}

export async function deleteClient(id: string) {
  const supabase = await createSupabase();
  const { data, error } = await supabase.from("clients").delete().eq("id", id).select("logo_path");
  if (error) return actionError("deleteClient", error, DELETE_ERROR);
  if (!data || data.length === 0) return { error: CLIENT_GONE };

  const logo = data[0].logo_path as string | null;
  if (logo) {
    const { error: storageError } = await supabase.storage.from(LOGO_BUCKET).remove([logo]);
    if (storageError) logActionError("deleteClient:logo", storageError);
  }
  revalidateDashboard();
}

export async function setClientLogo(id: string, path: string | null) {
  let next: string | null = null;
  if (path !== null) {
    next = parseLogoPath(id, path);
    if (!next) return { error: "Ruta de logo inválida" };
  }

  const supabase = await createSupabase();
  const { data: current, error: currentError } = await supabase
    .from("clients")
    .select("logo_path")
    .eq("id", id)
    .maybeSingle();
  if (currentError) return actionError("setClientLogo:current", currentError, LOAD_ERROR);
  if (!current) return { error: CLIENT_GONE };

  const { data: updated, error } = await supabase.from("clients").update({ logo_path: next }).eq("id", id).select("id");
  if (error) return actionError("setClientLogo", error, SAVE_ERROR);
  if (!updated || updated.length === 0) return { error: CLIENT_GONE };

  const previous = current.logo_path as string | null;
  if (previous && previous !== next) {
    const { error: storageError } = await supabase.storage.from(LOGO_BUCKET).remove([previous]);
    if (storageError) logActionError("setClientLogo:remove-previous", storageError);
  }
  revalidateDashboard();
}

// ---------- Contacts ----------

export async function addContact(clientId: string, formData: FormData) {
  const parsed = parseContactForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createSupabase();
  const { error } = await supabase.from("client_contacts").insert({ client_id: clientId, ...parsed.values });
  if (error) return actionError("addContact", error, SAVE_ERROR);
  revalidateDashboard();
}

export async function updateContact(id: string, clientId: string, formData: FormData) {
  const parsed = parseContactForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createSupabase();
  const { data, error } = await supabase
    .from("client_contacts")
    .update(parsed.values)
    .eq("id", id)
    .eq("client_id", clientId)
    .select("id");
  if (error) return actionError("updateContact", error, SAVE_ERROR);
  if (!data || data.length === 0) return { error: CONTACT_GONE };
  revalidateDashboard();
}

export async function deleteContact(id: string, clientId: string) {
  const supabase = await createSupabase();
  const { data, error } = await supabase
    .from("client_contacts")
    .delete()
    .eq("id", id)
    .eq("client_id", clientId)
    .select("id");
  if (error) return actionError("deleteContact", error, DELETE_ERROR);
  if (!data || data.length === 0) return { error: CONTACT_GONE };
  revalidateDashboard();
}

export async function setPrimaryContact(id: string, clientId: string) {
  const supabase = await createSupabase();
  const { data: target, error: targetError } = await supabase
    .from("client_contacts")
    .select("id")
    .eq("id", id)
    .eq("client_id", clientId)
    .maybeSingle();
  if (targetError) return actionError("setPrimaryContact:target", targetError, LOAD_ERROR);
  if (!target) return { error: CONTACT_GONE };

  // Clear first: the partial unique index allows at most one primary per client.
  const { error: clearError } = await supabase
    .from("client_contacts")
    .update({ is_primary: false })
    .eq("client_id", clientId)
    .eq("is_primary", true);
  if (clearError) return actionError("setPrimaryContact:clear", clearError, SAVE_ERROR);

  const { error } = await supabase
    .from("client_contacts")
    .update({ is_primary: true })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return actionError("setPrimaryContact", error, SAVE_ERROR);
  revalidateDashboard();
}

// ---------- Contacts ↔ projects ----------

export async function linkProjectContact(projectId: string, contactId: string, role: string) {
  const supabase = await createSupabase();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("client_id")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) return actionError("linkProjectContact:project", projectError, LOAD_ERROR);
  if (!project) return { error: "Este proyecto ya no existe" };
  if (!project.client_id) return { error: "El proyecto no tiene cliente" };

  const { data: contact, error: contactError } = await supabase
    .from("client_contacts")
    .select("id")
    .eq("id", contactId)
    .eq("client_id", project.client_id)
    .maybeSingle();
  if (contactError) return actionError("linkProjectContact:contact", contactError, LOAD_ERROR);
  if (!contact) return { error: "El contacto no pertenece al cliente del proyecto" };

  const { error } = await supabase
    .from("project_contacts")
    .insert({ project_id: projectId, contact_id: contactId, role: roleOrNull(role) });
  if (error) {
    if (isUniqueViolation(error)) return { error: "Este contacto ya está ligado al proyecto" };
    return actionError("linkProjectContact", error, SAVE_ERROR);
  }
  revalidateDashboard();
}

export async function updateProjectContactRole(id: string, projectId: string, role: string) {
  const supabase = await createSupabase();
  const { data, error } = await supabase
    .from("project_contacts")
    .update({ role: roleOrNull(role) })
    .eq("id", id)
    .eq("project_id", projectId)
    .select("id");
  if (error) return actionError("updateProjectContactRole", error, SAVE_ERROR);
  if (!data || data.length === 0) return { error: "Esta liga ya no existe" };
  revalidateDashboard();
}

export async function unlinkProjectContact(id: string, projectId: string) {
  const supabase = await createSupabase();
  const { data, error } = await supabase
    .from("project_contacts")
    .delete()
    .eq("id", id)
    .eq("project_id", projectId)
    .select("id");
  if (error) return actionError("unlinkProjectContact", error, DELETE_ERROR);
  if (!data || data.length === 0) return { error: "Esta liga ya no existe" };
  revalidateDashboard();
}
