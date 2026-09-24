/**
 * Project color palette. Mid-saturation colors that stay legible as dots,
 * stripes and progress bars in both light and dark themes.
 */
export const DEFAULT_PROJECT_COLOR = "#6366F1";

export const PROJECT_COLORS = [
  "#6366F1", // indigo
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#EF4444", // red
  "#F97316", // orange
  "#EAB308", // yellow
  "#84CC16", // lime
  "#22C55E", // green
  "#14B8A6", // teal
  "#06B6D4", // cyan
  "#3B82F6", // blue
  "#64748B", // slate
] as const;

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

/** Only "#RRGGBB" is accepted (it ends up in inline styles); returns uppercase or null. */
export function parseHexColor(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return HEX_RE.test(value) ? value.toUpperCase() : null;
}

/** First palette color not already used; cycles by count once all are taken. */
export function nextPaletteColor(used: string[]): string {
  const taken = new Set(used.map((c) => c.toUpperCase()));
  const free = PROJECT_COLORS.find((c) => !taken.has(c));
  return free ?? PROJECT_COLORS[used.length % PROJECT_COLORS.length];
}
