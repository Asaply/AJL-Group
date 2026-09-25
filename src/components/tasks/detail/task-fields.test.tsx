import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { TaskDetail } from "@/types";

const updateTaskField = vi.fn().mockResolvedValue(undefined);
vi.mock("@/app/(dashboard)/tasks/detail-actions", () => ({
  updateTaskField: (...args: unknown[]) => updateTaskField(...args),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { TaskFields } from "./task-fields";

function makeDetail(due_date: string | null = null): TaskDetail {
  return {
    task: {
      id: "t1",
      title: "Ajustar login",
      description: null,
      priority: "medium",
      status: "pending",
      due_date,
      project_id: null,
      deliverable_id: null,
      assigned_to: "u1",
      created_by: "u1",
      created_at: "2026-09-24T00:00:00Z",
      updated_at: "2026-09-24T00:00:00Z",
    },
    checklist: [],
    links: [],
    comments: [],
    events: [],
    attachments: [],
    users: [{ id: "u1", name: "Leo" }],
    projects: [],
    deliverables: [],
    currentUserId: "u1",
  } as unknown as TaskDetail;
}

describe("TaskFields due date", () => {
  beforeEach(() => {
    updateTaskField.mockClear();
  });

  it("does not save while a year is being typed, and saves once on blur", async () => {
    render(<TaskFields detail={makeDetail()} reload={vi.fn()} />);
    const input = screen.getByLabelText("Fecha límite") as HTMLInputElement;
    input.focus();

    // browsers emit these intermediate values while the year is typed digit by digit
    fireEvent.change(input, { target: { value: "0002-01-15" } });
    fireEvent.change(input, { target: { value: "0020-01-15" } });
    fireEvent.change(input, { target: { value: "0202-01-15" } });
    fireEvent.change(input, { target: { value: "2026-01-15" } });
    expect(updateTaskField).not.toHaveBeenCalled();

    fireEvent.blur(input);
    await Promise.resolve();
    expect(updateTaskField).toHaveBeenCalledTimes(1);
    expect(updateTaskField).toHaveBeenCalledWith("t1", "due_date", "2026-01-15");
  });

  it("does not save on blur when the year is before 1900", () => {
    render(<TaskFields detail={makeDetail("2026-01-15")} reload={vi.fn()} />);
    const input = screen.getByLabelText("Fecha límite") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "0202-01-15" } });
    fireEvent.blur(input);
    expect(updateTaskField).not.toHaveBeenCalled();
  });

  it("saves a cleared date as empty and skips unchanged values", () => {
    render(<TaskFields detail={makeDetail("2026-01-15")} reload={vi.fn()} />);
    const input = screen.getByLabelText("Fecha límite") as HTMLInputElement;
    fireEvent.blur(input);
    expect(updateTaskField).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(updateTaskField).toHaveBeenCalledWith("t1", "due_date", "");
  });
});
