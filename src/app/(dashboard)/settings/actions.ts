"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseProfileForm } from "@/lib/profile";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
    return { error: "No se pudo actualizar el perfil" };
  }

  revalidatePath("/", "layout");
  return { success: true };
}
