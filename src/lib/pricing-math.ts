/** Per-unit price of a possibly multi-unit deal total ("3 for $6.00" → $2.00). */
export function perUnit(total: number, qty?: number | null): number {
  return total / Math.max(1, qty ?? 1);
}

/** Round to cents. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Inclusive day count of a date-only (YYYY-MM-DD) promo window — same start
 * and end = 1 day. Null if either end is missing. Drives the Retail / Fuel
 * Saver "long promotion" informational warning (>14 days).
 */
export function promoDurationDays(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
}
