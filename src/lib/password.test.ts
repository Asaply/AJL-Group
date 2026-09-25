import { describe, expect, it } from "vitest";
import { parsePasswordForm } from "./password";

function fd(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [k, v] of Object.entries(fields)) formData.set(k, v);
  return formData;
}

describe("parsePasswordForm", () => {
  it("accepts a valid, matching new password", () => {
    const result = parsePasswordForm(
      fd({ current_password: "old-secret", new_password: "new-secret", confirm_password: "new-secret" })
    );
    expect(result).toEqual({ ok: true, current_password: "old-secret", new_password: "new-secret" });
  });

  it("requires the current password", () => {
    const result = parsePasswordForm(fd({ current_password: "", new_password: "new-secret", confirm_password: "new-secret" }));
    expect(result).toEqual({ ok: false, error: "Escribe tu contraseña actual" });
  });

  it("requires the new password to be at least 6 characters", () => {
    const result = parsePasswordForm(fd({ current_password: "old-secret", new_password: "abc12", confirm_password: "abc12" }));
    expect(result).toEqual({ ok: false, error: "La nueva contraseña debe tener al menos 6 caracteres" });
  });

  it("requires the confirmation to match", () => {
    const result = parsePasswordForm(fd({ current_password: "old-secret", new_password: "new-secret", confirm_password: "different" }));
    expect(result).toEqual({ ok: false, error: "Las contraseñas no coinciden" });
  });

  it("rejects a new password identical to the current one", () => {
    const result = parsePasswordForm(fd({ current_password: "same-pass", new_password: "same-pass", confirm_password: "same-pass" }));
    expect(result).toEqual({ ok: false, error: "La nueva contraseña debe ser distinta a la actual" });
  });
});
