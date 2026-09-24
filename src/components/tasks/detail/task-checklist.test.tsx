import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { TaskDetail } from "@/types";

const updateChecklistItem = vi.fn().mockResolvedValue(undefined);
vi.mock("@/app/(dashboard)/tasks/detail-actions", () => ({
  updateChecklistItem: (...args: unknown[]) => updateChecklistItem(...args),
  addChecklistItem: vi.fn(),
  moveChecklistItem: vi.fn(),
  deleteChecklistItem: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { TaskChecklist } from "./task-checklist";

const detail = {
  task: { id: "t1" },
  checklist: [
    { id: "c1", task_id: "t1", text: "Configurar OAuth", done: false, position: 0, created_at: "x" },
    { id: "c2", task_id: "t1", text: "Probar", done: true, position: 1, created_at: "x" },
  ],
} as unknown as TaskDetail;

describe("TaskChecklist", () => {
  it("shows progress", () => {
    render(<TaskChecklist detail={detail} reload={vi.fn()} />);
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("toggles an item", async () => {
    const reload = vi.fn();
    render(<TaskChecklist detail={detail} reload={reload} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Configurar OAuth" }));
    await waitFor(() => expect(updateChecklistItem).toHaveBeenCalledWith("c1", "t1", { done: true }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });
});
