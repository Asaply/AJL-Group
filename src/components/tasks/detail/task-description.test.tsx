import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { TaskDetail } from "@/types";

const updateTaskField = vi.fn().mockResolvedValue(undefined);
vi.mock("@/app/(dashboard)/tasks/detail-actions", () => ({
  updateTaskField: (...args: unknown[]) => updateTaskField(...args),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { TaskDescription } from "./task-description";

function makeDetail(overrides: Partial<TaskDetail["task"]> = {}): TaskDetail {
  return {
    task: {
      id: "t1",
      title: "Ajustar login",
      description: null,
      priority: "medium",
      status: "pending",
      due_date: null,
      project_id: null,
      deliverable_id: null,
      assigned_to: "u1",
      created_by: "u1",
      created_at: "2026-09-24T00:00:00Z",
      updated_at: "2026-09-24T00:00:00Z",
      ...overrides,
    },
    checklist: [],
    links: [],
    comments: [],
    events: [],
    attachments: [],
    users: [],
    projects: [],
    deliverables: [],
    currentUserId: "u1",
  };
}

describe("TaskDescription", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    updateTaskField.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("flushes a pending edit on unmount before the debounce fires", () => {
    const detail = makeDetail();
    const { unmount } = render(<TaskDescription detail={detail} reload={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Descripción"), { target: { value: "Nueva descripción" } });
    vi.advanceTimersByTime(500); // well under the 1000ms debounce

    unmount();

    expect(updateTaskField).toHaveBeenCalledTimes(1);
    expect(updateTaskField).toHaveBeenCalledWith("t1", "description", "Nueva descripción");
  });

  it("does not call updateTaskField on unmount when nothing was edited", () => {
    const detail = makeDetail();
    const { unmount } = render(<TaskDescription detail={detail} reload={vi.fn()} />);

    unmount();

    expect(updateTaskField).not.toHaveBeenCalled();
  });

  it("saves once after the debounce elapses and does not save again on unmount", async () => {
    const detail = makeDetail();
    const { unmount } = render(<TaskDescription detail={detail} reload={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Descripción"), { target: { value: "Nueva descripción" } });
    await vi.advanceTimersByTimeAsync(1000);

    expect(updateTaskField).toHaveBeenCalledTimes(1);
    expect(updateTaskField).toHaveBeenCalledWith("t1", "description", "Nueva descripción");

    unmount();

    expect(updateTaskField).toHaveBeenCalledTimes(1);
  });
});
