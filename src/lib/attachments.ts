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
  const base = (name.split(/[\\/]/).pop() ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
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

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImage(mime: string | null): boolean {
  return !!mime && mime.startsWith("image/");
}
