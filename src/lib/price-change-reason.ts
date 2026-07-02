import { PricingItem, HqChangeReason } from "@/types/pricing";
import { perUnit } from "./pricing-math";

/** HQ's three reasons plus the derived local one for director overrides. */
export type PriceChangeReason = HqChangeReason | "local_ad_hoc";

export const HQ_REASONS: HqChangeReason[] = ["cost_change", "competitor_move", "category_review"];

// `summary` is the plural noun phrase for count breakdowns ("5 cost changes").
export const REASON_META: Record<PriceChangeReason, { label: string; summary: string }> = {
  cost_change: { label: "Cost changes", summary: "cost changes" },
  competitor_move: { label: "Competitor changed price", summary: "competitor moves" },
  category_review: { label: "Category review", summary: "category reviews" },
  local_ad_hoc: { label: "Local ad hoc", summary: "local ad hoc" },
};

const approxEq = (a: number, b: number) => Math.abs(a - b) < 0.005;

/**
 * The reason behind an HQ item's price decision, derived — never stored:
 * a decided price that matches HQ's proposal keeps HQ's reason; any deviation
 * is by definition a local ad hoc call. Items without an HQ recommendation
 * return null (no reason taxonomy applies to plain local edits).
 */
export function changeReasonFor(item: PricingItem): PriceChangeReason | null {
  const hq = item.hqChangeReason;
  if (!hq) return null;
  if (item.newBasePrice != null) {
    const accepted =
      (item.newBaseQty ?? 1) <= 1 &&
      approxEq(perUnit(item.newBasePrice, item.newBaseQty), item.recommendedBasePrice);
    if (!accepted) return "local_ad_hoc";
  }
  if (item.newRetailPrice != null) {
    const accepted =
      (item.newRetailQty ?? 1) <= 1 &&
      item.recommendedRetailPrice != null &&
      approxEq(item.newRetailPrice, item.recommendedRetailPrice);
    if (!accepted) return "local_ad_hoc";
  }
  return hq;
}
