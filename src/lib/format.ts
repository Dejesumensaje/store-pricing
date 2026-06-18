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

/** "2026-05-23" → "May 23". */
export function fmtDateShort(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
