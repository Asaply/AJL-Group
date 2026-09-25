export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export const LOGO_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const;

type LogoMime = keyof typeof LOGO_MIME;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UUID_RE = new RegExp(`^${UUID}$`);

export function validateLogo(file: { size: number; type: string }): string | null {
  if (!(file.type in LOGO_MIME) || file.size <= 0 || file.size > MAX_LOGO_BYTES) {
    return "El logo debe ser PNG, JPG o WEBP de máximo 2 MB";
  }
  return null;
}

export function logoPath(clientId: string, id: string, mime: string): string {
  return `${clientId}/${id}.${LOGO_MIME[mime as LogoMime]}`;
}

/** Returns the path only if it is exactly `<clientId>/<uuid>.<png|jpg|webp>`. */
export function parseLogoPath(clientId: string, path: unknown): string | null {
  if (typeof path !== "string" || !UUID_RE.test(clientId)) return null;
  const re = new RegExp(`^${clientId}/${UUID}\\.(png|jpg|webp)$`);
  return re.test(path) ? path : null;
}

export function logoUrl(
  path: string | null,
  baseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
): string | null {
  if (!path) return null;
  return `${baseUrl}/storage/v1/object/public/client-logos/${path}`;
}
