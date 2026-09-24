import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Task } from "@/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/tasks",
  useSearchParams: () => new URLSearchParams("priority=high"),
}));
vi.mock("@/app/(dashboard)/tasks/actions", () => ({ updateTaskStatus: vi.fn(), deleteTask: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { TaskCard } from "./task-card";

const task: Task = {
  id: "t1", title: "Ajustar login", description: null, priority: "medium", status: "pending",
  due_date: null, project_id: null, deliverable_id: null, assigned_to: "u1", created_by: "u1",
  created_at: "2026-09-24T00:00:00Z", updated_at: "2026-09-24T00:00:00Z",
  checklist: [{ done: true }, { done: false }], attachments: [{ count: 2 }],
};

describe("TaskCard", () => {
  beforeEach(() => push.mockClear());

  it("opens the detail panel when the card is clicked, keeping other params", () => {
    render(<TaskCard task={task} />);
    fireEvent.click(screen.getByText("Ajustar login"));
    expect(push).toHaveBeenCalledWith("/tasks?priority=high&task=t1", { scroll: false });
  });

  it("opens with Enter for keyboard users", () => {
    render(<TaskCard task={task} />);
    fireEvent.keyDown(screen.getByRole("button", { name: /Ajustar login/ }), { key: "Enter" });
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("does not open when interacting with the status select", () => {
    // Separate render from the delete-button case below: Radix Select applies
    // aria-hidden to everything outside the open listbox's DOM path (a real,
    // unconditional accessibility behavior, independent of our code), which
    // would make the delete button unreachable via role queries if both
    // interactions shared one still-open dropdown.
    render(<TaskCard task={task} />);
    fireEvent.click(screen.getByRole("combobox"));
    expect(push).not.toHaveBeenCalled();
  });

  it("does not open when interacting with the delete button", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<TaskCard task={task} />);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar pendiente" }));
    expect(push).not.toHaveBeenCalled();
  });

  it("shows checklist progress and attachment count", () => {
    render(<TaskCard task={task} />);
    expect(screen.getByText("☑ 1/2")).toBeInTheDocument();
    expect(screen.getByText("📎 2")).toBeInTheDocument();
  });
});
