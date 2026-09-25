export const REALTIME_TABLES = ["projects", "project_links", "project_members", "tasks", "transactions", "deliverables", "clients", "client_contacts", "project_contacts", "project_files", "client_files"] as const;

/** Child tables of a task; the detail panel subscribes to these filtered by task_id. */
export const TASK_DETAIL_TABLES = [
  "task_checklist_items",
  "task_links",
  "task_comments",
  "task_events",
  "task_attachments",
] as const;

export function createDebouncedRefresh(
  refresh: () => void,
  delayMs: number
): { trigger(): void; cancel(): void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return {
    trigger() {
      // Cancel any existing timeout
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      // Schedule a new call after the delay (trailing-edge debounce)
      timeoutId = setTimeout(() => {
        refresh();
        timeoutId = null;
      }, delayMs);
    },
    cancel() {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
  };
}
