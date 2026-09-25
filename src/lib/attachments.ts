export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export function validateUpload(file: { size: number }): string | null {
  if (file.size <= 0) return "El archivo está vacío";
  if (file.size > MAX_ATTACHMENT_BYTES) return "El archivo supera 25 MB";
  return null;
}

/**
 * Storage-safe file name: last path segment only, ASCII letters/digits/._-,
 * no leading dots, max 100 chars. The original name is kept in the DB row.
 */
export function sanitizeFileName(name: string): string {
  const base = (name.split(/[\\/]/).pop() ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cleaned = base
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/^[.-]+/, "")
    .slice(0, 100);
  return cleaned || "archivo";
}

export function storagePath(taskId: string, fileName: string, id: string): string {
  return `${taskId}/${id}-${sanitizeFileName(fileName)}`;
}

export type AttachmentMeta = {
  storage_path: string;
  file_name: string;
  size_bytes: number;
  mime_type: string | null;
};

const ATTACHMENT_PATH_RE = /^([^/]+)\/([0-9a-f-]{36})-(.+)$/;

/**
 * Validates attachment metadata sent by the client before it is registered.
 * The path must be exactly what `storagePath` would build for this task: the
 * task's folder, a UUID and an already-sanitized name (so no `/`, no `..`
 * traversal, no other task's prefix).
 */
export function parseAttachmentMeta(
  taskId: string,
  meta: unknown
): { ok: true; value: AttachmentMeta } | { ok: false; error: string } {
  if (typeof meta !== "object" || meta === null) return { ok: false, error: "Archivo inválido" };
  const { storage_path, file_name, size_bytes, mime_type } = meta as Record<string, unknown>;
  if (
    typeof storage_path !== "string" ||
    typeof file_name !== "string" ||
    typeof size_bytes !== "number" ||
    (mime_type !== null && typeof mime_type !== "string")
  ) {
    return { ok: false, error: "Archivo inválido" };
  }

  const match = ATTACHMENT_PATH_RE.exec(storage_path);
  if (!match || match[1] !== taskId) return { ok: false, error: "Ruta de archivo inválida" };
  const [, , uuid, rest] = match;
  if (rest.includes("/") || rest !== sanitizeFileName(rest) || storagePath(taskId, rest, uuid) !== storage_path) {
    return { ok: false, error: "Ruta de archivo inválida" };
  }

  if (!Number.isFinite(size_bytes) || size_bytes <= 0 || size_bytes > MAX_ATTACHMENT_BYTES) {
    return { ok: false, error: "El archivo supera 25 MB" };
  }

  return {
    ok: true,
    value: {
      storage_path,
      file_name: file_name.trim().slice(0, 255) || "archivo",
      size_bytes,
      mime_type: mime_type ? mime_type.slice(0, 255) : null,
    },
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImage(mime: string | null): boolean {
  return !!mime && mime.startsWith("image/");
}
