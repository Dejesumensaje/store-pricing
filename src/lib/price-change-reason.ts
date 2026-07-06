import { PricingItem, HqChangeReason, StoreOriginReason } from "@/types/pricing";
import { perUnit } from "./pricing-math";

/**
 * Every reason a price change can carry: HQ's three, plus the store-originated
 * ones (cost- / competitor-based) and the "local ad hoc" fallback. HQ reasons
 * are derived from the recommendation; store-origin reasons are stored on the
 * item (a store change has no recommendation to derive from).
 */
export type PriceChangeReason = HqChangeReason | StoreOriginReason;

export const HQ_REASONS: HqChangeReason[] = ["cost_change", "competitor_move", "category_review"];

// `summary` is the plural noun phrase for count breakdowns ("5 cost changes").
export const REASON_META: Record<PriceChangeReason, { label: string; summary: string }> = {
  cost_change: { label: "Cost changes", summary: "cost changes" },
  competitor_move: { label: "Competitor changed price", summary: "competitor moves" },
  category_review: { label: "Category review", summary: "category reviews" },
  local_ad_hoc: { label: "Local ad hoc", summary: "local ad hoc" },
  store_cost: { label: "Cost-based change", summary: "cost-based changes" },
  store_competitor: { label: "Competitor-based change", summary: "competitor-based changes" },
};

// The reasons a director can pick for a store-originated change, in menu order.
export const STORE_REASON_OPTIONS: { value: StoreOriginReason; label: string }[] = [
  { value: "store_cost", label: REASON_META.store_cost.label },
  { value: "store_competitor", label: REASON_META.store_competitor.label },
  { value: "local_ad_hoc", label: REASON_META.local_ad_hoc.label },
];

const approxEq = (a: number, b: number) => Math.abs(a - b) < 0.005;

/** Whether the director has actually set a price on the item (base or retail). */
const hasChange = (item: PricingItem) => item.newBasePrice != null || item.newRetailPrice != null;

/**
 * The default store-origin reason for an item, biased by the lens it was opened
 * from: the Cost lens → cost-based, the Competitor lens → competitor-based. With
 * no lens context, fall back to the item's own signal (cost wins if it carries both).
 */
export function defaultStoreReason(
  item: PricingItem,
  originView?: "all" | "hq" | "cost" | "competitor"
): StoreOriginReason {
  if (originView === "cost") return "store_cost";
  if (originView === "competitor") return "store_competitor";
  const signals = item.storeSignals ?? [];
  if (signals.includes("competitor_move") && !signals.includes("cost_change")) return "store_competitor";
  return "store_cost";
}

/**
 * The reason behind an item's price decision.
 *
 * HQ items: derived, never stored — a decided price that matches HQ's proposal
 * keeps HQ's reason; any deviation is a local ad hoc call.
 *
 * Store-originated items (an item carrying `storeSignals` with no HQ rec): the
 * director's stored `chosenChangeReason` if set, otherwise the signal-based
 * default. Only once a price is actually set — an untouched item has no reason.
 *
 * Plain local edits (no HQ rec, no store signal) return null, as before.
 */
export function changeReasonFor(item: PricingItem): PriceChangeReason | null {
  const hq = item.hqChangeReason;
  if (hq) {
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
  // Store-originated: a reason applies only once the director has made a change.
  if (!hasChange(item)) return null;
  if (item.chosenChangeReason) return item.chosenChangeReason;
  if (item.storeSignals?.length) return defaultStoreReason(item);
  return null;
}
