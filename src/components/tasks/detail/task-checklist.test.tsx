import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { TaskDetail } from "@/types";

const updateChecklistItem = vi.fn().mockResolvedValue(undefined);
const addChecklistItem = vi.fn();
vi.mock("@/app/(dashboard)/tasks/detail-actions", () => ({
  updateChecklistItem: (...args: unknown[]) => updateChecklistItem(...args),
  addChecklistItem: (...args: unknown[]) => addChecklistItem(...args),
  moveChecklistItem: vi.fn(),
  deleteChecklistItem: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

function never() {
  return new Promise<undefined>(() => {});
}

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

  it("checks the box before the server answers", () => {
    updateChecklistItem.mockImplementationOnce(never);
    render(<TaskChecklist detail={detail} reload={vi.fn()} />);
    const box = screen.getByRole("checkbox", { name: "Configurar OAuth" });
    fireEvent.click(box);
    expect(box).toBeChecked();
    expect(screen.getByText("2/2")).toBeInTheDocument();
  });

  it("unchecks again when the server rejects the change", async () => {
    updateChecklistItem.mockResolvedValueOnce({ error: "No se pudo guardar" });
    render(<TaskChecklist detail={detail} reload={vi.fn()} />);
    const box = screen.getByRole("checkbox", { name: "Configurar OAuth" });
    fireEvent.click(box);
    await waitFor(() => expect(box).not.toBeChecked());
  });

  it("lists a new step before the server answers", async () => {
    addChecklistItem.mockImplementationOnce(never);
    render(<TaskChecklist detail={detail} reload={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Nuevo paso"), { target: { value: "Desplegar" } });
    fireEvent.submit(screen.getByLabelText("Nuevo paso").closest("form")!);
    expect(await screen.findByText("Desplegar")).toBeInTheDocument();
    expect(addChecklistItem).toHaveBeenCalledWith("t1", "Desplegar");
  });
});
