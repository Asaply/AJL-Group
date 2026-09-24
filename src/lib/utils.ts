import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a MXN currency value with the "$" prefix and always 2 decimals.
 * Accepts strings because Postgres `numeric` columns arrive over the wire
 * as strings (e.g. "1234.50") rather than JS numbers.
 */
export function formatCurrency(value: number | string): string {
  const numeric = typeof value === "string" ? Number(value) : value;
  const safeValue = Number.isFinite(numeric) ? numeric : 0;

  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeValue);
}

/**
 * Formats a date string for display in es-MX.
 *
 * Date-only strings ("YYYY-MM-DD", as returned by Postgres `date` columns)
 * are parsed as a LOCAL date by splitting the parts, not via `new Date(str)`
 * — that parses as UTC midnight, which shifts a day earlier in timezones
 * behind UTC (e.g. Mexico).
 *
 * Full ISO timestamps are parsed normally since they already carry explicit
 * time/offset information.
 */
export function formatDate(date: string): string {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const localDate = new Date(Number(year), Number(month) - 1, Number(day));
    return localDate.toLocaleDateString("es-MX");
  }

  return new Date(date).toLocaleDateString("es-MX");
}
