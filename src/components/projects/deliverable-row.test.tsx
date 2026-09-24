import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Deliverable, Task } from "@/types";

vi.mock("@/app/(dashboard)/projects/deliverable-actions", () => ({
  approveDeliverable: vi.fn(),
  revokeDeliverable: vi.fn(),
  updateDeliverable: vi.fn(),
  moveDeliverable: vi.fn(),
  deleteDeliverable: vi.fn(),
}));
vi.mock("@/app/(dashboard)/tasks/actions", () => ({ createTask: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { DeliverableRow } from "./deliverable-row";

const deliverable: Deliverable = {
  id: "d1", project_id: "p1", title: "Login", weight: 30,
  approved_at: null, approved_by: null, position: 0, created_at: "2026-09-24T00:00:00Z",
};

function task(status: Task["status"]): Task {
  return {
    id: `t-${status}-${Math.random()}`, title: "T", description: null, priority: "medium", status,
    due_date: null, project_id: "p1", deliverable_id: "d1", assigned_to: "u1", created_by: "u1",
    created_at: "2026-09-24T00:00:00Z",
  };
}

function renderRow(d: Deliverable, tasks: Task[]) {
  return render(
    <DeliverableRow
      deliverable={d} tasks={tasks} canMoveUp={false} canMoveDown={false}
      users={[]} projects={[]} deliverables={[d]}
    />
  );
}

describe("DeliverableRow", () => {
  it("disables Aprobar while tasks are open", () => {
    renderRow(deliverable, [task("completed"), task("pending")]);
    expect(screen.getByRole("button", { name: "Aprobar" })).toBeDisabled();
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("disables Aprobar when there are no linked tasks", () => {
    renderRow(deliverable, []);
    expect(screen.getByRole("button", { name: "Aprobar" })).toBeDisabled();
  });

  it("enables Aprobar when every linked task is completed", () => {
    renderRow(deliverable, [task("completed"), task("completed")]);
    expect(screen.getByRole("button", { name: "Aprobar" })).toBeEnabled();
    expect(screen.getByText("Listo para revisión")).toBeInTheDocument();
  });

  it("shows Revocar and the reopened warning for an approved deliverable", () => {
    renderRow({ ...deliverable, approved_at: "2026-09-24T10:00:00Z" }, [task("pending")]);
    expect(screen.queryByRole("button", { name: "Aprobar" })).toBeNull();
    expect(screen.getByRole("button", { name: "Revocar" })).toBeInTheDocument();
    expect(screen.getByText("⚠️ Aprobado con pendientes abiertos")).toBeInTheDocument();
  });
});
