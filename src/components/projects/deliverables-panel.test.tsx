import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Deliverable, Task } from "@/types";

vi.mock("@/app/(dashboard)/projects/deliverable-actions", () => ({
  approveDeliverable: vi.fn(),
  revokeDeliverable: vi.fn(),
  updateDeliverable: vi.fn(),
  moveDeliverable: vi.fn(),
  deleteDeliverable: vi.fn(),
  createDeliverable: vi.fn(),
  setTaskDeliverable: vi.fn(),
}));
vi.mock("@/app/(dashboard)/tasks/actions", () => ({ createTask: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/projects/p1",
  useSearchParams: () => new URLSearchParams(),
}));

import { DeliverablesPanel } from "./deliverables-panel";
import { approveDeliverable, moveDeliverable, setTaskDeliverable } from "@/app/(dashboard)/projects/deliverable-actions";

const never = () => new Promise<undefined>(() => {});

const deliverable: Deliverable = {
  id: "d1", project_id: "p1", title: "Login", weight: 100,
  approved_at: null, approved_by: null, position: 0, created_at: "2026-09-24T00:00:00Z",
};

const floating: Task = {
  id: "t1", title: "Suelto", description: null, priority: "medium", status: "pending",
  due_date: null, project_id: "p1", deliverable_id: null, assigned_to: "u1", created_by: "u1",
  created_at: "2026-09-24T00:00:00Z", updated_at: "2026-09-24T00:00:00Z",
};

function renderPanel(deliverables: Deliverable[], tasks: Task[]) {
  return render(
    <DeliverablesPanel
      projectId="p1" color="#000" deliverables={deliverables} tasks={tasks} users={[]} projects={[]}
    />
  );
}

describe("DeliverablesPanel", () => {
  it("flags tasks without a deliverable and links one on choice", () => {
    renderPanel([deliverable], [floating]);
    expect(screen.getByText(/1 pendiente sin entregable/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Entregable para Suelto"), { target: { value: "d1" } });
    expect(setTaskDeliverable).toHaveBeenCalledWith("t1", "d1", "p1");
  });

  it("asks to create a deliverable when the project has none", () => {
    renderPanel([], [floating]);
    expect(screen.getByText("Crea un entregable para ligarlo")).toBeInTheDocument();
  });

  it("shows no warning when every task has a deliverable", () => {
    renderPanel([deliverable], [{ ...floating, deliverable_id: "d1" }]);
    expect(screen.queryByText(/sin entregable/)).toBeNull();
  });

  it("moves the progress bar the moment a deliverable is approved", () => {
    vi.mocked(approveDeliverable).mockImplementationOnce(never);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPanel([deliverable], [{ ...floating, deliverable_id: "d1", status: "completed" }]);
    expect(screen.getByText("0%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aprobar" }));
    // "100%" now shows twice: the deliverable's weight and the progress bar.
    expect(screen.queryByText("0%")).toBeNull();
    expect(screen.getAllByText("100%")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Revocar" })).toBeInTheDocument();
  });

  it("clears the unlinked warning before the server answers", () => {
    vi.mocked(setTaskDeliverable).mockImplementationOnce(never);
    renderPanel([deliverable], [floating]);
    fireEvent.change(screen.getByLabelText("Entregable para Suelto"), { target: { value: "d1" } });
    expect(screen.queryByText(/sin entregable/)).toBeNull();
  });

  it("reorders deliverables at once", () => {
    vi.mocked(moveDeliverable).mockImplementation(never);
    const second = { ...deliverable, id: "d2", title: "Pagos", position: 1, weight: 0 };
    renderPanel([deliverable, second], []);
    fireEvent.click(screen.getAllByRole("button", { name: "Bajar" })[0]);
    const titles = screen.getAllByText(/^(Login|Pagos)$/).map((el) => el.textContent);
    expect(titles).toEqual(["Pagos", "Login"]);
  });
});
