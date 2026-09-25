/**
 * Pure helpers shared by project and client files (upload validation, path
 * building, doc-type labels, and server-side meta parsing). Mirrors
 * `src/lib/attachments.ts` (task attachments) but generalized over which
 * entity ("project" | "client") owns the file.
 */

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export type EntityKind = "project" | "client";

export const DOC_TYPES = ["contrato", "acuerdo_nda", "cotizacion", "factura", "otro"] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  contrato: "Contrato",
  acuerdo_nda: "Acuerdo / NDA",
  cotizacion: "Cotización",
  factura: "Factura",
  otro: "Otro",
};

export function validateDocType(value: unknown): value is DocType {
  return typeof value === "string" && (DOC_TYPES as readonly string[]).includes(value);
}

export function validateUpload(file: { size: number }): string | null {
  if (file.size <= 0) return "El archivo está vacío";
  if (file.size > MAX_FILE_BYTES) return "El archivo supera 25 MB";
  return null;
}

/** Same sanitizing as task attachments: ASCII letters/digits/._-, max 100 chars. */
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

export function storagePath(entity: EntityKind, ownerId: string, fileName: string, id: string): string {
  return `${entity}/${ownerId}/${id}-${sanitizeFileName(fileName)}`;
}

/** The text shown for a file's type: the fixed label, or the custom one for "otro". */
export function describeFileLabel(file: { doc_type: string; custom_label: string | null }): string {
  if (file.doc_type === "otro" && file.custom_label?.trim()) return file.custom_label.trim();
  return DOC_TYPE_LABELS[file.doc_type as DocType] ?? file.doc_type;
}

export type FileMeta = {
  storage_path: string;
  file_name: string;
  size_bytes: number;
  mime_type: string | null;
  doc_type: DocType;
  custom_label: string | null;
};

const FILE_PATH_RE = /^([^/]+)\/([^/]+)\/([0-9a-f-]{36})-(.+)$/;

/**
 * Validates file metadata sent by the client before it is registered. The
 * path must be exactly what `storagePath` would build: this entity kind,
 * this owner's folder, a UUID and an already-sanitized name.
 */
export function parseFileMeta(
  entity: EntityKind,
  ownerId: string,
  meta: unknown
): { ok: true; value: FileMeta } | { ok: false; error: string } {
  if (typeof meta !== "object" || meta === null) return { ok: false, error: "Archivo inválido" };
  const { storage_path, file_name, size_bytes, mime_type, doc_type, custom_label } = meta as Record<
    string,
    unknown
  >;
  if (
    typeof storage_path !== "string" ||
    typeof file_name !== "string" ||
    typeof size_bytes !== "number" ||
    (mime_type !== null && typeof mime_type !== "string") ||
    (custom_label !== null && typeof custom_label !== "string")
  ) {
    return { ok: false, error: "Archivo inválido" };
  }

  const match = FILE_PATH_RE.exec(storage_path);
  if (!match || match[1] !== entity || match[2] !== ownerId) return { ok: false, error: "Ruta de archivo inválida" };
  const [, , , uuid, rest] = match;
  if (rest.includes("/") || rest !== sanitizeFileName(rest) || storagePath(entity, ownerId, rest, uuid) !== storage_path) {
    return { ok: false, error: "Ruta de archivo inválida" };
  }

  if (!Number.isFinite(size_bytes) || size_bytes <= 0 || size_bytes > MAX_FILE_BYTES) {
    return { ok: false, error: "El archivo supera 25 MB" };
  }

  if (!validateDocType(doc_type)) return { ok: false, error: "Tipo de documento inválido" };

  const trimmedLabel = custom_label?.trim() || null;
  if (doc_type === "otro" && !trimmedLabel) return { ok: false, error: "Escribe una etiqueta para este tipo de archivo" };

  return {
    ok: true,
    value: {
      storage_path,
      file_name: file_name.trim().slice(0, 255) || "archivo",
      size_bytes,
      mime_type: mime_type ? mime_type.slice(0, 255) : null,
      doc_type,
      custom_label: doc_type === "otro" ? trimmedLabel : null,
    },
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
