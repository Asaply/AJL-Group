/**
 * Returns the trimmed URL string if `raw` is a parseable absolute URL with
 * an `http:` or `https:` scheme, otherwise `null`.
 *
 * Used both when accepting user-supplied URLs (project links, avatar URLs)
 * and at render time before putting a stored URL into an `href`/`src`, so
 * `javascript:` / `data:` URLs can never become clickable (stored XSS).
 */
export function parseHttpUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return value;
  } catch {
    return null;
  }
}
