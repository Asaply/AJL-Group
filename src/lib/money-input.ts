/**
 * Pure helpers for money inputs: live thousands grouping ("1,234.5") while
 * typing, and the plain number string ("1234.5") the server actions parse.
 */

const DECIMALS = 2;

export function formatMoneyInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const pointAt = cleaned.indexOf(".");
  const hasPoint = pointAt !== -1;
  const intDigits = hasPoint ? cleaned.slice(0, pointAt) : cleaned;
  const decimals = hasPoint ? cleaned.slice(pointAt + 1).replace(/\./g, "").slice(0, DECIMALS) : "";

  if (!intDigits && !hasPoint) return "";
  const intPart = (intDigits.replace(/^0+(?=\d)/, "") || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return hasPoint ? `${intPart}.${decimals}` : intPart;
}

/** On blur: "1,500." / "1,500.00" -> "1,500", "1,500.5" -> "1,500.50". Decimals only when they matter. */
export function finalizeMoneyInput(display: string): string {
  const formatted = formatMoneyInput(display);
  const [intPart, decimals] = formatted.split(".");
  if (decimals === undefined) return formatted;
  if (/^0*$/.test(decimals)) return intPart;
  return `${intPart}.${decimals.padEnd(DECIMALS, "0")}`;
}

export function unformatMoney(display: string): string {
  return display.replace(/,/g, "");
}

/** Caret position in `formatted` that sits after as many digits/points as `caret` did in `raw`. */
export function caretAfterFormat(raw: string, caret: number, formatted: string): number {
  const significant = raw.slice(0, caret).replace(/[^0-9.]/g, "").length;
  if (significant === 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] !== ",") seen++;
    if (seen === significant) return i + 1;
  }
  return formatted.length;
}
