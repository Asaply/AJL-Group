/**
 * Pure date logic for the calendar view. Kept free of React/Next.js so it
 * can be unit tested in isolation from rendering concerns.
 */

/** Formats a local (year, monthIndex, day) triple as a "YYYY-MM-DD" key. */
export function toDateKey(year: number, monthIndex: number, day: number): string {
  const month = monthIndex + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Builds the cells for a month grid, Sunday-start: `null` for the leading
 * blanks before the 1st, then `1..daysInMonth`.
 */
export function buildMonthCells(year: number, monthIndex: number): (number | null)[] {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();

  const cells: (number | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(day);
  }
  return cells;
}

/** Groups tasks by their `due_date` key, skipping tasks with a null due_date. */
export function groupTasksByDate<T extends { due_date: string | null }>(
  tasks: T[]
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const task of tasks) {
    if (!task.due_date) continue;
    const existing = grouped.get(task.due_date);
    if (existing) {
      existing.push(task);
    } else {
      grouped.set(task.due_date, [task]);
    }
  }
  return grouped;
}
