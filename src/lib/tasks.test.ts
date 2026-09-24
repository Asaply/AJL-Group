import { describe, expect, it } from "vitest";
import { selectUrgentTasks, isOverdue, todayKey } from "./tasks";
import type { TaskPriority, TaskStatus } from "@/types";

interface MinimalTask {
  id: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
}

function task(overrides: Partial<MinimalTask> & { id: string }): MinimalTask {
  return {
    status: "pending",
    priority: "medium",
    due_date: null,
    ...overrides,
  };
}

describe("selectUrgentTasks", () => {
  it("excludes completed tasks", () => {
    const tasks = [
      task({ id: "1", status: "completed", priority: "urgent" }),
      task({ id: "2", status: "pending", priority: "low" }),
    ];
    const result = selectUrgentTasks(tasks);
    expect(result.map((t) => t.id)).toEqual(["2"]);
  });

  it("sorts by priority urgent -> high -> medium -> low", () => {
    const tasks = [
      task({ id: "low", priority: "low" }),
      task({ id: "urgent", priority: "urgent" }),
      task({ id: "medium", priority: "medium" }),
      task({ id: "high", priority: "high" }),
    ];
    const result = selectUrgentTasks(tasks);
    expect(result.map((t) => t.id)).toEqual(["urgent", "high", "medium", "low"]);
  });

  it("breaks priority ties by due_date ascending", () => {
    const tasks = [
      task({ id: "later", priority: "urgent", due_date: "2026-10-05" }),
      task({ id: "sooner", priority: "urgent", due_date: "2026-09-25" }),
      task({ id: "middle", priority: "urgent", due_date: "2026-10-01" }),
    ];
    const result = selectUrgentTasks(tasks);
    expect(result.map((t) => t.id)).toEqual(["sooner", "middle", "later"]);
  });

  it("sorts tasks with null due_date after tasks with a due_date, within the same priority", () => {
    const tasks = [
      task({ id: "no-date", priority: "urgent", due_date: null }),
      task({ id: "has-date", priority: "urgent", due_date: "2026-12-01" }),
    ];
    const result = selectUrgentTasks(tasks);
    expect(result.map((t) => t.id)).toEqual(["has-date", "no-date"]);
  });

  it("limits results to the given limit, default 5", () => {
    const tasks = Array.from({ length: 8 }, (_, i) => task({ id: `t${i}`, priority: "urgent" }));
    expect(selectUrgentTasks(tasks)).toHaveLength(5);
    expect(selectUrgentTasks(tasks, 3)).toHaveLength(3);
    expect(selectUrgentTasks(tasks, 10)).toHaveLength(8);
  });

  it("does not mutate the input array", () => {
    const tasks = [
      task({ id: "b", priority: "low" }),
      task({ id: "a", priority: "urgent" }),
    ];
    const snapshot = [...tasks];
    selectUrgentTasks(tasks);
    expect(tasks).toEqual(snapshot);
  });
});

describe("todayKey", () => {
  it("returns the Mexico-City calendar date, which lags UTC in the evening", () => {
    // 2026-09-25T02:00:00Z is 2026-09-24 20:00 in Mexico City (UTC-6, no DST).
    expect(todayKey(new Date("2026-09-25T02:00:00Z"))).toBe("2026-09-24");
  });

  it("returns the Mexico-City calendar date at UTC midday", () => {
    // 2026-09-24T12:00:00Z is 2026-09-24 06:00 in Mexico City.
    expect(todayKey(new Date("2026-09-24T12:00:00Z"))).toBe("2026-09-24");
  });

  it("accepts an explicit time zone override", () => {
    // 2026-09-25T02:00:00Z is already 2026-09-25 in UTC.
    expect(todayKey(new Date("2026-09-25T02:00:00Z"), "UTC")).toBe("2026-09-25");
  });
});

describe("isOverdue", () => {
  const today = "2026-09-24";

  it("returns true for a due_date in the past (yesterday)", () => {
    expect(isOverdue("2026-09-23", today)).toBe(true);
  });

  it("returns false for a due_date that is today", () => {
    expect(isOverdue("2026-09-24", today)).toBe(false);
  });

  it("returns false for a due_date in the future (tomorrow)", () => {
    expect(isOverdue("2026-09-25", today)).toBe(false);
  });

  it("returns false for a null due_date", () => {
    expect(isOverdue(null, today)).toBe(false);
  });
});
