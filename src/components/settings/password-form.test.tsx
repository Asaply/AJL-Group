import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const updatePassword = vi.fn();
vi.mock("@/app/(dashboard)/settings/actions", () => ({
  updatePassword: (...args: unknown[]) => updatePassword(...args),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { PasswordForm } from "./password-form";
import { toast } from "sonner";

function fillAndSubmit(current: string, next: string, confirm: string) {
  fireEvent.change(screen.getByLabelText("Contraseña actual"), { target: { value: current } });
  fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: next } });
  fireEvent.change(screen.getByLabelText("Confirmar nueva contraseña"), { target: { value: confirm } });
  fireEvent.click(screen.getByRole("button", { name: "Cambiar contraseña" }));
}

describe("PasswordForm", () => {
  it("submits the three fields and clears them on success", async () => {
    updatePassword.mockResolvedValueOnce({ success: true });
    render(<PasswordForm />);
    fillAndSubmit("old-secret", "new-secret", "new-secret");

    await waitFor(() =>
      expect(updatePassword).toHaveBeenCalledWith(expect.any(FormData))
    );
    const sent = updatePassword.mock.calls[0][0] as FormData;
    expect(sent.get("current_password")).toBe("old-secret");
    expect(sent.get("new_password")).toBe("new-secret");

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Contraseña actualizada"));
    await waitFor(() => expect((screen.getByLabelText("Contraseña actual") as HTMLInputElement).value).toBe(""));
  });

  it("shows the server error and keeps the fields filled on failure", async () => {
    updatePassword.mockResolvedValueOnce({ error: "La contraseña actual no es correcta" });
    render(<PasswordForm />);
    fillAndSubmit("wrong", "new-secret", "new-secret");

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("La contraseña actual no es correcta"));
    expect((screen.getByLabelText("Contraseña actual") as HTMLInputElement).value).toBe("wrong");
  });
});
