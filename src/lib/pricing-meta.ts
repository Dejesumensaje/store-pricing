import { PricingCategory, PricingItem } from "@/types/pricing";
import { fmt } from "@/lib/format";

// Fuel saver amounts a store can add. Values are normalized 2-decimal strings so
// the <Select> matches reliably — String(0.5) ("0.5") never equals "0.50", which
// is why the dropdown used to drop the dollar label. Bind the Select with
// `fuelSaverSelectValue(item.fuelSaver)` so the stored number round-trips.
export const FUEL_SAVER_AMOUNTS = [0.1, 0.25, 0.5, 1.0];
export const FUEL_SAVER_OPTIONS: { label: string; value: string }[] = [
  { label: "None", value: "0.00" },
  ...FUEL_SAVER_AMOUNTS.map((v) => ({ label: fmt(v), value: v.toFixed(2) })),
];
export const fuelSaverSelectValue = (n: number | null | undefined) => (n ?? 0).toFixed(2);

// An item still "needs a decision" until the relevant price(s) are committed.
// Mirrors the hasDecision predicate used by buildImpactColumn (columns/shared).
export function needsDecision(item: PricingItem, variant: "base" | "temp"): boolean {
  // Accepting a section as-is (declining its HQ rec) resolves it without a
  // price override — variant picks which section's declined flag applies.
  if (variant === "temp" ? item.retailReviewed : item.baseReviewed) return false;
  if (variant === "temp") return item.newBasePrice == null && item.newRetailPrice == null;
  return item.newBasePrice == null;
}

export const CATEGORY_LABELS: Record<string, string> = {
  base: "Base",
  temporary_allowance: "Temp. allowance",
  everyday_low_price: "EDLP",
  no_change: "No change",
  new_discontinued: "New/Disc.",
};

type BadgeTone = "neutral" | "success" | "negative" | "warning" | "in-progress";

export const PRICE_TYPE_META: Record<
  PricingCategory,
  { label: string; shortLabel: string; tone: BadgeTone; route: string }
> = {
  base: {
    label: "Base price",
    shortLabel: "Base",
    tone: "in-progress",
    route: "/pricing/base",
  },
  temporary_allowance: {
    label: "Temporary allowance",
    shortLabel: "Temp. allowance",
    tone: "warning",
    route: "/pricing/temporary-allowance",
  },
  everyday_low_price: {
    label: "Everyday low price",
    shortLabel: "EDLP",
    tone: "success",
    route: "/pricing/everyday-low-price",
  },
  new_discontinued: {
    label: "New / discontinued",
    shortLabel: "New/Disc.",
    tone: "neutral",
    route: "/pricing/new-discontinued",
  },
  no_change: {
    label: "No change",
    shortLabel: "No change",
    tone: "neutral",
    route: "/pricing/no-change",
  },
};

// Per-type "intent" config: what decision each price type represents, so the
// drawer can anticipate the use case instead of showing a generic price input.
//   helper       one-line description of the decision (shown under the Select)
//   priceLabel   label for the main (base) price input
//   permanent    true = a permanent shelf price (no allowance dates)
//   usesReduction true = offer a "reduction off current" control (ReductionInput)
export const PRICE_TYPE_INTENT: Record<
  PricingCategory,
  { helper: string; priceLabel: string; permanent?: boolean; usesReduction?: boolean }
> = {
  base: {
    helper: "The regular shelf price.",
    priceLabel: "New base price",
    permanent: true,
  },
  temporary_allowance: {
    helper: "Vendor-funded promo set by HQ. You can change the price and dates, not the type.",
    priceLabel: "New base price",
  },
  everyday_low_price: {
    helper: "A permanent markdown to stay consistently low.",
    priceLabel: "New everyday low price",
    permanent: true,
    usesReduction: true,
  },
  no_change: {
    helper: "HQ recommends keeping this price. Edit the price to make a Base change.",
    priceLabel: "New base price",
    permanent: true,
  },
  new_discontinued: {
    // Refined per itemStatus in the drawer (new vs. discontinued).
    helper: "Initial pricing for a new item, or handling for one being removed.",
    priceLabel: "Initial price",
    permanent: true,
  },
};
