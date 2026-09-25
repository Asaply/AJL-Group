import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const createClientRecord = vi.fn().mockResolvedValue({ id: "new-id" });
vi.mock("@/app/(dashboard)/clients/actions", () => ({
  createClientRecord: (fd: FormData) => createClientRecord(fd),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { ClientSelect } from "./client-select";

describe("ClientSelect", () => {
  it("creates a client from the mini dialog and selects it", async () => {
    const { container } = render(<ClientSelect clients={[{ id: "c1", name: "ACME" }]} defaultValue={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Nuevo cliente" }));
    fireEvent.change(screen.getByLabelText("Nombre del cliente"), { target: { value: "Kairos SA" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear cliente" }));
    await waitFor(() => expect(createClientRecord).toHaveBeenCalled());
    const sent = createClientRecord.mock.calls[0][0] as FormData;
    expect(sent.get("name")).toBe("Kairos SA");
    await waitFor(() =>
      expect((container.querySelector('input[name="client_id"]') as HTMLInputElement).value).toBe("new-id")
    );
  });
});
