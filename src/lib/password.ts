export const MIN_PASSWORD_LENGTH = 6;

export type ParsePasswordFormResult =
  | { ok: true; current_password: string; new_password: string }
  | { ok: false; error: string };

export function parsePasswordForm(formData: FormData): ParsePasswordFormResult {
  const current_password = (formData.get("current_password") as string) || "";
  if (!current_password) return { ok: false, error: "Escribe tu contraseña actual" };

  const new_password = (formData.get("new_password") as string) || "";
  if (new_password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` };
  }

  const confirm_password = (formData.get("confirm_password") as string) || "";
  if (new_password !== confirm_password) return { ok: false, error: "Las contraseñas no coinciden" };

  if (new_password === current_password) return { ok: false, error: "La nueva contraseña debe ser distinta a la actual" };

  return { ok: true, current_password, new_password };
}
