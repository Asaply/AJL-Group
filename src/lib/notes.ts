/**
 * Pure helpers for the notes module (RLS-aware ownership check + title
 * normalization shared between the create/update server actions).
 */

export function canEditNote(note: { author_id: string }, userId: string): boolean {
  return note.author_id === userId;
}

export function normalizeNoteTitle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}
