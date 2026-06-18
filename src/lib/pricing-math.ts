/**
 * Gross margin as a percentage of the selling price: (price − cost) / price.
 * Returns 0 for a non-positive price to avoid divide-by-zero noise.
 */
export function grossMarginPct(price: number, cost: number): number {
  if (price <= 0) return 0;
  return ((price - cost) / price) * 100;
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
