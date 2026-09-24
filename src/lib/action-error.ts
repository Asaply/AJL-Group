/**
 * Server-action error handling. Raw Supabase/Postgres errors (constraint
 * names, column names, SQL details) are logged server-side only; the UI
 * receives a generic Spanish message.
 */

export const SAVE_ERROR = "No se pudo guardar. Intenta de nuevo.";
export const DELETE_ERROR = "No se pudo eliminar. Intenta de nuevo.";
export const LOAD_ERROR = "No se pudo cargar la información. Intenta de nuevo.";

/** Logs a raw error server-side, tagged with the action name. */
export function logActionError(context: string, error: unknown): void {
  console.error(`[${context}]`, error);
}

/**
 * Logs the raw error and returns the generic `{ error }` result. For actions
 * whose success result is another object shape, call `logActionError` and
 * return an `{ error }` literal instead so TypeScript keeps the union
 * narrowable at the call site.
 */
export function actionError(context: string, error: unknown, message: string): { error: string } {
  logActionError(context, error);
  return { error: message };
}

/** Postgres `foreign_key_violation` (SQLSTATE 23503). */
export function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "23503";
}
