import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/app/(dashboard)/clients/actions", () => ({
  createClientRecord: vi.fn(),
  updateClient: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

// Same rationale as client-filters.test.tsx: Radix's Select needs browser
// layout APIs (hasPointerCapture, scrollIntoView, ResizeObserver) that jsdom
// doesn't implement, and this repo has no existing precedent for driving it
// in tests. We swap in a native <select> that preserves the same
// value/onValueChange contract, so the status change is genuinely exercised
// (rather than only testing the onOpenChange reset path in isolation).
vi.mock("@/components/ui/select", () => {
  function Select({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: ReactNode;
  }) {
    return (
      <select aria-label="Estado" value={value} onChange={(e) => onValueChange(e.target.value)}>
        {children}
      </select>
    );
  }
  function Passthrough({ children }: { children: ReactNode }) {
    return <>{children}</>;
  }
  function SelectItem({ value, children }: { value: string; children: ReactNode }) {
    return <option value={value}>{children}</option>;
  }
  return {
    Select,
    SelectTrigger: Passthrough,
    SelectContent: Passthrough,
    SelectValue: () => null,
    SelectItem,
  };
});

import { ClientFormDialog } from "./client-form-dialog";

describe("ClientFormDialog", () => {
  it("resets the status to the default each time the create dialog is reopened", () => {
    render(<ClientFormDialog trigger={<button>Nuevo cliente</button>} />);

    fireEvent.click(screen.getByText("Nuevo cliente"));
    const select = screen.getByLabelText("Estado") as HTMLSelectElement;
    expect(select.value).toBe("active");

    fireEvent.change(select, { target: { value: "inactive" } });
    expect(select.value).toBe("inactive");

    // Close without submitting, via the dialog's built-in close button.
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    fireEvent.click(screen.getByText("Nuevo cliente"));
    const reopenedSelect = screen.getByLabelText("Estado") as HTMLSelectElement;
    expect(reopenedSelect.value).toBe("active");
  });

  it("resets the status to the client's own status each time the edit dialog is reopened", () => {
    const client = { id: "c1", name: "Acme", status: "inactive" } as unknown as Parameters<
      typeof ClientFormDialog
    >[0]["client"];

    render(<ClientFormDialog client={client} trigger={<button>Editar</button>} />);

    fireEvent.click(screen.getByText("Editar"));
    const select = screen.getByLabelText("Estado") as HTMLSelectElement;
    expect(select.value).toBe("inactive");

    fireEvent.change(select, { target: { value: "active" } });
    expect(select.value).toBe("active");

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    fireEvent.click(screen.getByText("Editar"));
    const reopenedSelect = screen.getByLabelText("Estado") as HTMLSelectElement;
    expect(reopenedSelect.value).toBe("inactive");
  });
});
