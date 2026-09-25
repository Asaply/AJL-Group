import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { TaskDetail } from "@/types";

vi.mock("@/app/(dashboard)/tasks/detail-actions", () => ({
  addComment: vi.fn(), updateComment: vi.fn(), deleteComment: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { TaskActivity } from "./task-activity";

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
});
