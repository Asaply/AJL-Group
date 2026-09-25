"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { parseProfileForm } from "@/lib/profile";
import { parsePasswordForm } from "@/lib/password";
import { logActionError } from "@/lib/action-error";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) return { error: "No autenticado" };

  const parsed = parseProfileForm(formData);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const { data, error } = await supabase.from("users")
    .update({
      name: parsed.name,
      avatar_url: parsed.avatar_url,
    })
    .eq("id", user.id)
    .select("id");

  if (error || !data || data.length === 0) {
    logActionError("updateProfile", error ?? "no row updated");
    return { error: "No se pudo actualizar el perfil" };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) return { error: "No autenticado" };

  const parsed = parsePasswordForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { data: profile } = await supabase.from("users").select("email").eq("id", user.id).single();
  if (!profile) return { error: "No se pudo verificar tu contraseña actual" };

  // Confirm the caller actually knows the current password before changing it
  // — otherwise anyone at a shared, already-signed-in computer could take
  // over a partner's account just by opening Ajustes.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: parsed.current_password,
  });
  if (reauthError) return { error: "La contraseña actual no es correcta" };

  const { error } = await supabase.auth.updateUser({ password: parsed.new_password });
  if (error) {
    logActionError("updatePassword", error);
    return { error: "No se pudo actualizar la contraseña" };
  }

  return { success: true };
}
