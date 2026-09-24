export const REALTIME_TABLES = ["projects", "project_members", "tasks", "transactions"] as const;

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
