"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeNoteTitle } from "@/lib/notes";

export async function createNote(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const title = normalizeNoteTitle(formData.get("title"));
  if (!title) return { error: "El título es obligatorio" };

  const { data, error } = await supabase
    .from("notes")
    .insert({
      title,
      content: "",
      is_shared: formData.get("is_shared") === "true",
      author_id: user.id,
    })
    .select()
    .single();
  if (error) return { error: error.message };
  revalidatePath("/notes");
  return { id: data.id };
}

export async function updateNote(id: string, content: string, title?: string) {
  const supabase = await createClient();

  const update: Record<string, string> = { content };
  if (title !== undefined) {
    const normalizedTitle = normalizeNoteTitle(title);
    if (!normalizedTitle) return { error: "El título es obligatorio" };
    update.title = normalizedTitle;
  }

  const { data, error } = await supabase.from("notes").update(update).eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "No tienes permiso para editar esta nota" };
  }
  revalidatePath("/notes");
}

export async function deleteNote(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.from("notes").delete().eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "No tienes permiso para eliminar esta nota" };
  }
  revalidatePath("/notes");
}
