import { APP_TIME_ZONE } from "@/lib/constants";
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
 * Returns the "YYYY-MM-DD" calendar date key for the given instant, as
 * observed in `timeZone` (default: the app's operating time zone).
 *
 * This must NOT use `Date#getFullYear`/`getMonth`/`getDate`, which read the
 * *host* system's local time zone — on Vercel that's UTC, not Mexico
 * (UTC-6, no DST). Between ~18:00 and 23:59 Mexico time, UTC has already
 * rolled over to the next calendar day, which would misclassify "today"'s
 * tasks as overdue. `Intl.DateTimeFormat` with an explicit `timeZone`
 * sidesteps the host's zone entirely.
 */
export function todayKey(now: Date = new Date(), timeZone: string = APP_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Date-key comparison of a `due_date` ("YYYY-MM-DD") against `today`
 * (also a "YYYY-MM-DD" key, typically from `todayKey()`). A due date equal
 * to today is not overdue. Both are lexicographically comparable strings
 * in the same format, so a plain string compare suffices.
 */
export function isOverdue(dueDate: string | null, today: string): boolean {
  if (!dueDate) return false;
  return dueDate < today;
}
