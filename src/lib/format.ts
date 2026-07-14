export function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

/** "$5.00" for single-unit, "3 for $5.00" when qty > 1. */
export function fmtQtyPrice(qty: number | null | undefined, price: number) {
  return qty != null && qty > 1 ? `${qty} for ${fmt(price)}` : fmt(price);
}

/** Derived per-unit price for a multi-unit deal, e.g. "$1.67/unit". */
export function fmtUnitPrice(qty: number, price: number) {
  return `${fmt(price / qty)}/unit`;
}

/** "2026-05-23" (date-only) → "May 23". */
export function fmtDateShort(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** A date-only range as "May 23 – Jun 5" (or "from …" / "ends …" if half-open). */
export function fmtDateRange(start?: string | null, end?: string | null): string | null {
  if (!start && !end) return null;
  if (start && end) return `${fmtDateShort(start)} – ${fmtDateShort(end)}`;
  return end ? `ends ${fmtDateShort(end)}` : `from ${fmtDateShort(start!)}`;
}

/** Base Price's single Effective Date as "Effective May 23" (null if unset). */
export function fmtEffectiveDate(date?: string | null): string | null {
  return date ? `Effective ${fmtDateShort(date)}` : null;
}

/** Full ISO datetime ("2026-06-10T09:00:00Z") → "Jun 10". */
export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** ISO datetime → "Jun 10, 9:00 AM" (date + time, for batch schedules). */
export function fmtDateTime(iso: string) {
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

/**
 * Compact signed money for impact metrics, scaling the suffix to the magnitude
 * so small values don't collapse to "+0.0M". Input is in millions of dollars:
 * 2.8 → "+$2.8M", 0.04 → "+$40k", 0 → "$0".
 */
export function fmtImpactMoney(millions: number) {
  const d = millions * 1_000_000;
  if (Math.round(d) === 0) return "$0";
  const abs = Math.abs(d);
  const body =
    abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(1)}M`
    : abs >= 1_000 ? `$${Math.round(abs / 1_000)}k`
    : `$${Math.round(abs)}`;
  return `${d >= 0 ? "+" : "−"}${body}`;
}

/**
 * Compact signed unit count for impact metrics. Input is in thousands of units:
 * 500 → "+500k", 1200 → "+1.2M", 0 → "0".
 */
export function fmtImpactUnits(thousands: number) {
  const u = thousands * 1_000;
  if (Math.round(u) === 0) return "0";
  const abs = Math.abs(u);
  const body =
    abs >= 1_000_000 ? `${(abs / 1_000_000).toFixed(1)}M`
    : abs >= 1_000 ? `${Math.round(abs / 1_000)}k`
    : `${Math.round(abs)}`;
  return `${u >= 0 ? "+" : "−"}${body}`;
}
