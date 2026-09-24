import { describe, expect, it } from "vitest";
import { toDateKey, buildMonthCells, groupTasksByDate } from "./calendar";

describe("toDateKey", () => {
  it("formats year/month/day as YYYY-MM-DD", () => {
    expect(toDateKey(2026, 8, 24)).toBe("2026-09-24");
  });

  it("zero-pads single-digit month and day", () => {
    expect(toDateKey(2026, 0, 5)).toBe("2026-01-05");
  });

  it("zero-pads month only when day is double-digit", () => {
    expect(toDateKey(2026, 1, 15)).toBe("2026-02-15");
  });

  it("handles December (month index 11)", () => {
    expect(toDateKey(2026, 11, 31)).toBe("2026-12-31");
  });
});

describe("buildMonthCells", () => {
  it("September 2026 starts on Tuesday: 2 leading nulls, 30 days", () => {
    const cells = buildMonthCells(2026, 8);
    expect(cells.slice(0, 2)).toEqual([null, null]);
    expect(cells.slice(2)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(cells).toHaveLength(32);
  });

  it("February 2028 is a leap year: 29 days", () => {
    const cells = buildMonthCells(2028, 1);
    const days = cells.filter((c): c is number => c !== null);
    expect(days).toHaveLength(29);
    expect(days[days.length - 1]).toBe(29);
  });

  it("February 2027 is not a leap year: 28 days", () => {
    const cells = buildMonthCells(2027, 1);
    const days = cells.filter((c): c is number => c !== null);
    expect(days).toHaveLength(28);
    expect(days[days.length - 1]).toBe(28);
  });

  it("leading nulls match the first weekday of the month (Sunday-start)", () => {
    // January 2026 starts on Thursday (weekday index 4)
    const cells = buildMonthCells(2026, 0);
    expect(cells.slice(0, 4)).toEqual([null, null, null, null]);
    expect(cells[4]).toBe(1);
  });

  it("no leading nulls when month starts on Sunday", () => {
    // November 2026 starts on Sunday
    const cells = buildMonthCells(2026, 10);
    expect(cells[0]).toBe(1);
  });
});

describe("groupTasksByDate", () => {
  it("groups tasks by their due_date key", () => {
    const tasks = [
      { id: "1", due_date: "2026-09-24" },
      { id: "2", due_date: "2026-09-24" },
      { id: "3", due_date: "2026-09-25" },
    ];
    const grouped = groupTasksByDate(tasks);
    expect(grouped.get("2026-09-24")).toEqual([tasks[0], tasks[1]]);
    expect(grouped.get("2026-09-25")).toEqual([tasks[2]]);
    expect(grouped.size).toBe(2);
  });

  it("skips tasks with null due_date", () => {
    const tasks = [
      { id: "1", due_date: null },
      { id: "2", due_date: "2026-09-24" },
    ];
    const grouped = groupTasksByDate(tasks);
    expect(grouped.size).toBe(1);
    expect(grouped.get("2026-09-24")).toEqual([tasks[1]]);
  });

  it("returns an empty map for an empty array", () => {
    expect(groupTasksByDate([]).size).toBe(0);
  });
});
