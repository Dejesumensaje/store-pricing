/**
 * Gross margin as a percentage of the selling price: (price − cost) / price.
 * Returns 0 for a non-positive price to avoid divide-by-zero noise.
 */
export function grossMarginPct(price: number, cost: number): number {
  if (price <= 0) return 0;
  return ((price - cost) / price) * 100;
}

/** Per-unit price of a possibly multi-unit deal total ("3 for $6.00" → $2.00). */
export function perUnit(total: number, qty?: number | null): number {
  return total / Math.max(1, qty ?? 1);
}

/** "39.5%" */
export function fmtPct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

/** Signed percentage-point delta, e.g. "+1.3pp" / "−0.4pp". */
export function fmtPpDelta(value: number, digits = 1): string {
  const sign = value >= 0 ? "+" : "−";
  return `${sign}${Math.abs(value).toFixed(digits)}pp`;
}

/** Round to cents. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Signed percentage from a fraction, e.g. −0.6503 → "−65.0%", 0.047 → "+4.7%". */
export function fmtSignedPct(fraction: number, digits = 1): string {
  const sign = fraction >= 0 ? "+" : "−";
  return `${sign}${Math.abs(fraction * 100).toFixed(digits)}%`;
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
