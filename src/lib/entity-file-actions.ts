/**
 * Server-side implementation shared by project and client file actions.
 * Not itself a "use server" module — `src/app/(dashboard)/projects/file-actions.ts`
 * and `.../clients/file-actions.ts` are the thin "use server" wrappers that
 * call these with their table name and owner column (Supabase's `.from()`
 * needs the table name as a plain string, so one implementation covers both).
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { actionError, logActionError, SAVE_ERROR, DELETE_ERROR, LOAD_ERROR } from "@/lib/action-error";
import { parseFileMeta, validateDocType, type EntityKind } from "@/lib/entity-files";
import type { DocType } from "@/types";

const BUCKET = "entity-files";

export type EntityFilesConfig = {
  table: "project_files" | "client_files";
  ownerColumn: "project_id" | "client_id";
  entity: EntityKind;
};

function revalidateDashboard() {
  revalidatePath("/", "layout");
}

export async function registerEntityFile(
  cfg: EntityFilesConfig,
  ownerId: string,
  meta: {
    storage_path: string;
    file_name: string;
    size_bytes: number;
    mime_type: string | null;
    doc_type: string;
    custom_label: string | null;
  }
) {
  const parsed = parseFileMeta(cfg.entity, ownerId, meta);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase.from(cfg.table).insert({
    [cfg.ownerColumn]: ownerId,
    uploaded_by: user.id,
    ...parsed.value,
  });
  if (error) return actionError(`registerEntityFile:${cfg.table}`, error, SAVE_ERROR);
  revalidateDashboard();
}

export async function softDeleteEntityFile(cfg: EntityFilesConfig, id: string, ownerId: string) {
  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) return { error: "No autenticado" };

  // Soft delete: the row stays (with who/when) so it can show struck-through
  // in the list; only the storage object is actually removed.
  const { data, error } = await supabase
    .from(cfg.table)
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq("id", id)
    .eq(cfg.ownerColumn, ownerId)
    .is("deleted_at", null)
    .select("storage_path")
    .maybeSingle();
  if (error) return actionError(`softDeleteEntityFile:${cfg.table}`, error, DELETE_ERROR);
  if (!data) return { error: "Archivo no encontrado" };

  const { error: storageError } = await supabase.storage.from(BUCKET).remove([data.storage_path]);
  if (storageError) logActionError(`softDeleteEntityFile:${cfg.table}:storage`, storageError);
  revalidateDashboard();
}

export async function updateEntityFileType(
  cfg: EntityFilesConfig,
  id: string,
  ownerId: string,
  docType: string,
  customLabel: string | null
) {
  if (!validateDocType(docType)) return { error: "Tipo de documento inválido" };
  const trimmedLabel = customLabel?.trim() || null;
  if (docType === "otro" && !trimmedLabel) return { error: "Escribe una etiqueta para este tipo de archivo" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(cfg.table)
    .update({ doc_type: docType as DocType, custom_label: docType === "otro" ? trimmedLabel : null })
    .eq("id", id)
    .eq(cfg.ownerColumn, ownerId)
    .is("deleted_at", null)
    .select("id");
  if (error) return actionError(`updateEntityFileType:${cfg.table}`, error, SAVE_ERROR);
  if (!data || data.length === 0) return { error: "Archivo no encontrado" };
  revalidateDashboard();
}

export async function getEntityFileUrl(
  cfg: EntityFilesConfig,
  id: string,
  ownerId: string,
  download: boolean
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from(cfg.table)
    .select("storage_path, file_name")
    .eq("id", id)
    .eq(cfg.ownerColumn, ownerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return actionError(`getEntityFileUrl:${cfg.table}`, error, LOAD_ERROR);
  if (!row) return { error: "Archivo no encontrado" };

  const { data, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, 60, download ? { download: row.file_name } : undefined);
  if (signError || !data) {
    return actionError(
      `getEntityFileUrl:${cfg.table}:sign`,
      signError ?? new Error("createSignedUrl returned no data"),
      LOAD_ERROR
    );
  }
  return { url: data.signedUrl };
}
