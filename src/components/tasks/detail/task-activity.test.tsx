import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { TaskDetail } from "@/types";

vi.mock("@/app/(dashboard)/tasks/detail-actions", () => ({
  addComment: vi.fn(), updateComment: vi.fn(), deleteComment: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { TaskActivity } from "./task-activity";
import { addComment } from "@/app/(dashboard)/tasks/detail-actions";

const leo = { id: "u1", name: "Leo" };
const alan = { id: "u2", name: "Alan" };

const detail = {
  task: { id: "t1" },
  currentUserId: "u1",
  users: [leo, alan],
  projects: [],
  deliverables: [],
  events: [
    { id: "e1", task_id: "t1", actor_id: "u2", field: "status", old_value: "pending", new_value: "in_progress", created_at: "2026-09-24T09:00:00Z" },
  ],
  comments: [
    { id: "c1", task_id: "t1", author_id: "u1", body: "Mío", created_at: "2026-09-24T10:00:00Z", updated_at: "2026-09-24T10:00:00Z", author: leo },
    { id: "c2", task_id: "t1", author_id: "u2", body: "De Alan", created_at: "2026-09-24T11:00:00Z", updated_at: "2026-09-24T11:30:00Z", author: alan },
  ],
} as unknown as TaskDetail;

describe("TaskActivity", () => {
  it("renders events as sentences", () => {
    render(<TaskActivity detail={detail} reload={vi.fn()} />);
    expect(screen.getByText("Alan cambió el estado Pendiente → En Progreso")).toBeInTheDocument();
  });

  it("shows edit/delete only on the current user's comments", () => {
    render(<TaskActivity detail={detail} reload={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: "Editar comentario" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Eliminar comentario" })).toHaveLength(1);
  });

  it("marks edited comments", () => {
    render(<TaskActivity detail={detail} reload={vi.fn()} />);
    expect(screen.getAllByText("(editado)")).toHaveLength(1);
  });

  it("guards against a double-submit from key-repeat", () => {
    (addComment as unknown as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    render(<TaskActivity detail={detail} reload={vi.fn()} />);
    const textarea = screen.getByRole("textbox", { name: "Nuevo comentario" });
    fireEvent.change(textarea, { target: { value: "hola" } });
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });
    expect(addComment).toHaveBeenCalledTimes(1);
  });

  it("resyncs the edit draft when the comment body changes while not editing", () => {
    const { rerender } = render(<TaskActivity detail={detail} reload={vi.fn()} />);
    const updatedDetail = {
      ...detail,
      comments: detail.comments.map((c) => (c.id === "c1" ? { ...c, body: "Nuevo cuerpo" } : c)),
    } as unknown as TaskDetail;
    rerender(<TaskActivity detail={updatedDetail} reload={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar comentario" }));
    expect(screen.getByRole("textbox", { name: "Texto del comentario" })).toHaveValue("Nuevo cuerpo");
  });
});
