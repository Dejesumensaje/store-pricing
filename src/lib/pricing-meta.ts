import { PricingCategory, PricingItem } from "@/types/pricing";

// An item still "needs a decision" until the relevant price(s) are committed.
// Mirrors the hasDecision predicate used by buildImpactColumn (columns/shared).
export function needsDecision(item: PricingItem, variant: "base" | "temp"): boolean {
  // Accepting an item as-is resolves it without a price override.
  if (item.reviewed) return false;
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
    helper: "Permanent regular shelf price for this item.",
    priceLabel: "New base price",
    permanent: true,
  },
  temporary_allowance: {
    helper: "Vendor-funded temporary reduction. Set the promo price and dates.",
    priceLabel: "New base price",
  },
  everyday_low_price: {
    helper: "Strategic permanent markdown to stay consistently cheaper.",
    priceLabel: "New everyday low price",
    permanent: true,
    usesReduction: true,
  },
  no_change: {
    helper: "HQ recommends keeping the current price. Editing the price switches this to a Base price change.",
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

// Change-type pills, in display order. "all" is the master view.
export const CHANGE_TYPE_TABS: { value: string; label: string; route: string }[] = [
  { value: "all", label: "All items", route: "/all-items" },
  { value: "base", label: "Base prices changes", route: "/pricing/base" },
  { value: "temporary_allowance", label: "Temporary allowances changes", route: "/pricing/temporary-allowance" },
  { value: "everyday_low_price", label: "Everyday low prices changes", route: "/pricing/everyday-low-price" },
  { value: "new_discontinued", label: "New / discontinued", route: "/pricing/new-discontinued" },
  { value: "no_change", label: "No change", route: "/pricing/no-change" },
];
