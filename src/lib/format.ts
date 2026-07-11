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

/** "2026-05-23" (date-only) → "May 23". Returns null for a falsy input. */
export function fmtDateShort(iso?: string | null): string | null {
  if (!iso) return null;
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

