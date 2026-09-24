import { parseHttpUrl } from "@/lib/url";

export type ParseProfileFormResult =
  | { ok: true; name: string; avatar_url: string | null }
  | { ok: false; error: string };

export function parseProfileForm(formData: FormData): ParseProfileFormResult {
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) {
    return { ok: false, error: "El nombre es obligatorio" };
  }

  const rawAvatar = ((formData.get("avatar_url") as string) || "").trim();
  if (!rawAvatar) {
    return { ok: true, name, avatar_url: null };
  }

  const avatar_url = parseHttpUrl(rawAvatar);
  if (!avatar_url) {
    return { ok: false, error: "La URL del avatar no es válida" };
  }
  return { ok: true, name, avatar_url };
}
