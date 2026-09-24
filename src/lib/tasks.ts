import type { TaskPriority, TaskStatus } from "@/types";

/**
 * Shared task selection logic for widgets that surface a short list of
 * "what needs attention" tasks (e.g. the dashboard home).
 */

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Selects the most urgent, still-open tasks: excludes completed tasks,
 * sorts by priority (urgent first) then by `due_date` ascending (tasks
 * with no due date sort last within their priority), and returns the
 * first `limit`. Does not mutate the input array.
 */
export function selectUrgentTasks<
  T extends { status: TaskStatus; priority: TaskPriority; due_date: string | null }
>(tasks: T[], limit = 5): T[] {
  return tasks
    .filter((t) => t.status !== "completed")
    .sort((a, b) => {
      const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      if (a.due_date === b.due_date) return 0;
      if (a.due_date === null) return 1;
      if (b.due_date === null) return -1;
      return a.due_date < b.due_date ? -1 : 1;
    })
    .slice(0, limit);
}

/**
 * Date-only comparison (LOCAL time) of a `due_date` against `today`.
 * A due date equal to today is not overdue. `due_date` strings are parsed
 * as "YYYY-MM-DD" (as returned by Postgres `date` columns) by splitting
 * the parts rather than via `new Date(str)`, which parses as UTC midnight
 * and can shift a day earlier in timezones behind UTC (e.g. Mexico).
 */
export function isOverdue(dueDate: string | null, today: Date): boolean {
  if (!dueDate) return false;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate);
  const due = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(dueDate);

  const dueLocal = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  return dueLocal < todayLocal;
}
