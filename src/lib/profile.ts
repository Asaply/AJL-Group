export type ParseProfileFormResult =
  | { ok: true; name: string; avatar_url: string | null }
  | { ok: false; error: string };

export function parseProfileForm(formData: FormData): ParseProfileFormResult {
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) {
    return { ok: false, error: "El nombre es obligatorio" };
  }

  const avatar_url = (formData.get("avatar_url") as string) || "";
  if (!avatar_url) {
    return { ok: true, name, avatar_url: null };
  }

  try {
    const url = new URL(avatar_url);
    if (!["http:", "https:"].includes(url.protocol)) {
      return { ok: false, error: "La URL del avatar no es válida" };
    }
    return { ok: true, name, avatar_url };
  } catch {
    return { ok: false, error: "La URL del avatar no es válida" };
  }
}
