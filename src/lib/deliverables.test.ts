import { describe, expect, it } from "vitest";
import { deliverableStatus, moveItem, projectProgress, weightTotal } from "./deliverables";

const done = { status: "completed" as const };
const open = { status: "pending" as const };
const doing = { status: "in_progress" as const };

describe("deliverableStatus", () => {
  it("is pending with no linked tasks", () => {
    expect(deliverableStatus({ approved_at: null }, [])).toEqual({
      status: "pending", openTasks: 0, totalTasks: 0, approvedWithOpenTasks: false,
    });
  });

  it("is pending while any task is not completed", () => {
    expect(deliverableStatus({ approved_at: null }, [done, doing]).status).toBe("pending");
    expect(deliverableStatus({ approved_at: null }, [done, doing]).openTasks).toBe(1);
  });

  it("is ready when every linked task is completed", () => {
    expect(deliverableStatus({ approved_at: null }, [done, done])).toEqual({
      status: "ready", openTasks: 0, totalTasks: 2, approvedWithOpenTasks: false,
    });
  });

  it("is approved when approved_at is set, regardless of tasks", () => {
    expect(deliverableStatus({ approved_at: "2026-09-24T10:00:00Z" }, []).status).toBe("approved");
    expect(deliverableStatus({ approved_at: "2026-09-24T10:00:00Z" }, [done]).approvedWithOpenTasks).toBe(false);
  });

  it("flags an approved deliverable whose tasks were reopened", () => {
    expect(deliverableStatus({ approved_at: "2026-09-24T10:00:00Z" }, [done, open])).toEqual({
      status: "approved", openTasks: 1, totalTasks: 2, approvedWithOpenTasks: true,
    });
  });
});

describe("projectProgress", () => {
  it("is null without deliverables", () => {
    expect(projectProgress([])).toBeNull();
  });

  it("is 0 when nothing is approved", () => {
    expect(projectProgress([{ weight: 50, approved_at: null }, { weight: 50, approved_at: null }])).toBe(0);
  });

  it("sums approved weights, accepting numeric strings", () => {
    expect(
      projectProgress([
        { weight: "20.00", approved_at: "2026-09-24T10:00:00Z" },
        { weight: 30, approved_at: "2026-09-25T10:00:00Z" },
        { weight: 50, approved_at: null },
      ])
    ).toBe(50);
  });

  it("rounds to an integer", () => {
    expect(projectProgress([{ weight: 33.33, approved_at: "x" }, { weight: 66.67, approved_at: null }])).toBe(33);
  });

  it("clamps to 100 when weights overshoot", () => {
    expect(projectProgress([{ weight: 80, approved_at: "x" }, { weight: 40, approved_at: "y" }])).toBe(100);
  });

  it("treats non-numeric weights as 0", () => {
    expect(projectProgress([{ weight: "abc", approved_at: "x" }])).toBe(0);
  });
});

describe("weightTotal", () => {
  it("sums weights to 2 decimals", () => {
    expect(weightTotal([{ weight: "33.33" }, { weight: 33.33 }, { weight: 33.33 }])).toBe(99.99);
    expect(weightTotal([])).toBe(0);
  });
});

describe("moveItem", () => {
  const ids = ["a", "b", "c"];

  it("moves an item up or down by one", () => {
    expect(moveItem(ids, "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveItem(ids, "b", "down")).toEqual(["a", "c", "b"]);
  });

  it("is a no-op at the edges or for unknown ids", () => {
    expect(moveItem(ids, "a", "up")).toEqual(ids);
    expect(moveItem(ids, "c", "down")).toEqual(ids);
    expect(moveItem(ids, "z", "up")).toEqual(ids);
  });

  it("does not mutate the input", () => {
    const input = [...ids];
    moveItem(input, "b", "up");
    expect(input).toEqual(ids);
  });
});
