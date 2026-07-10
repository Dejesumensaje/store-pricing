import {
  PricingItem,
  HqBaseReason,
  HqPromoReason,
  StoreBaseReason,
  StorePromoReason,
} from "@/types/pricing";

/**
 * Every reason any pricing section can carry, across all four catalogs (HQ
 * Base, HQ Retail/Fuel, Store Base, Store Retail/Fuel). Several values are
 * shared verbatim between an HQ catalog and its store counterpart (e.g.
 * "allowance") — same concept, same label, regardless of who picked it; the
 * section + the HQ pill / provenance channel elsewhere in the UI carry origin.
 */
export type PriceChangeReason = HqBaseReason | HqPromoReason | StoreBaseReason | StorePromoReason;

// HQ's Base catalog, in menu order (also doubles as the base-change-reason
// facet source on the dashboard, since only HQ base recs populate that facet).
export const HQ_BASE_REASONS: HqBaseReason[] = ["cost_change", "competitor_change", "hq_pricing_review", "other"];
// HQ's Retail catalog, shared verbatim by Fuel Saver.
export const HQ_PROMO_REASONS: HqPromoReason[] = ["discontinued", "allowance", "displays", "wow_buy"];

// `summary`/`summaryOne` are the plural/singular noun phrases for count
// breakdowns ("5 cost changes" / "1 cost change") — see countedReasonSummary.
export const REASON_META: Record<PriceChangeReason, { label: string; summary: string; summaryOne: string }> = {
  cost_change: { label: "Cost change", summary: "cost changes", summaryOne: "cost change" },
  competitor_change: { label: "Competitor change", summary: "competitor changes", summaryOne: "competitor change" },
  hq_pricing_review: { label: "HQ pricing review", summary: "HQ pricing reviews", summaryOne: "HQ pricing review" },
  other: { label: "Other", summary: "other reasons", summaryOne: "other reason" },
  discontinued: { label: "Discontinued", summary: "discontinuations", summaryOne: "discontinuation" },
  allowance: { label: "Allowance", summary: "allowances", summaryOne: "allowance" },
  displays: { label: "Displays", summary: "displays", summaryOne: "display" },
  wow_buy: { label: "WOW Buy / E-Buy", summary: "WOW Buy / E-Buy", summaryOne: "WOW Buy / E-Buy" },
  manager_special: { label: "Manager special", summary: "manager specials", summaryOne: "manager special" },
  soon_to_expiry: { label: "Soon to expiry", summary: "soon-to-expiry markdowns", summaryOne: "soon-to-expiry markdown" },
  obsolete_inventory: { label: "Obsolete inventory", summary: "obsolete-inventory markdowns", summaryOne: "obsolete-inventory markdown" },
  discontinued_mc060220: { label: "Discontinued (MC-060-220)", summary: "MC-060-220 discontinuations", summaryOne: "MC-060-220 discontinuation" },
  buys: { label: "Buys", summary: "buys", summaryOne: "buy" },
  excess_stock: { label: "Excess stock", summary: "excess-stock markdowns", summaryOne: "excess-stock markdown" },
  local_deal: { label: "Local deal (one-time)", summary: "local deals", summaryOne: "local deal" },
  four_by_four: { label: "4x4 program", summary: "4x4 program items", summaryOne: "4x4 program item" },
};

// "3 cost changes" / "1 cost change" — count-aware phrase for summary lines,
// so count-of-1 buckets (common under the per-section model) read as prose.
export function countedReasonSummary(reason: PriceChangeReason, n: number): string {
  const meta = REASON_META[reason];
  return `${n} ${n === 1 ? meta.summaryOne : meta.summary}`;
}

// Store Base: 3 reasons, defaults to "Other" — no blocking validation, so an
// unset store base reason still resolves to a label (see changeReasonFor).
export const STORE_BASE_REASON_DEFAULT: StoreBaseReason = "other";
export const STORE_BASE_REASON_OPTIONS: { value: StoreBaseReason; label: string }[] = [
  { value: "cost_change", label: REASON_META.cost_change.label },
  { value: "competitor_change", label: REASON_META.competitor_change.label },
  { value: "other", label: REASON_META.other.label },
];

// Store Retail / Fuel Saver: 11 shared reasons, no default — the Select opens
// unselected with a placeholder until the director picks one.
export const STORE_PROMO_REASON_OPTIONS: { value: StorePromoReason; label: string }[] = [
  { value: "manager_special", label: REASON_META.manager_special.label },
  { value: "soon_to_expiry", label: REASON_META.soon_to_expiry.label },
  { value: "obsolete_inventory", label: REASON_META.obsolete_inventory.label },
  { value: "discontinued_mc060220", label: REASON_META.discontinued_mc060220.label },
  { value: "allowance", label: REASON_META.allowance.label },
  { value: "buys", label: REASON_META.buys.label },
  { value: "displays", label: REASON_META.displays.label },
  { value: "excess_stock", label: REASON_META.excess_stock.label },
  { value: "local_deal", label: REASON_META.local_deal.label },
  { value: "wow_buy", label: REASON_META.wow_buy.label },
  { value: "four_by_four", label: REASON_META.four_by_four.label },
];

/**
 * The reason behind ONE pricing section's decision — Base, Retail, or Fuel
 * Saver. Sections are independent: an item can carry a Base reason and a
 * Retail reason at once, from different catalogs, and they need not agree.
 *
 * HQ-recommended sections: `hqBaseReason`/`hqRetailReason`/`hqFuelReason` is
 * the section's reason whenever it's been decided — accepting the
 * recommendation AND setting a custom price both keep the HQ reason, since
 * either way the recommendation is still the section's origin; only the final
 * price differs. Rejecting (keep current) clears the HQ reason field itself
 * (see pricing-store's acceptNoChange), so a rejected/undecided section
 * resolves to the store-origin fallback below (empty for that item, since a
 * store choice was never made either).
 *
 * Store-origin sections: the director's stored chosen*Reason if set. Base
 * defaults to "other" the moment a price is set; Retail and Fuel Saver have no
 * default and stay `null` (unselected) until the director actively picks one —
 * that's a deliberate non-blocking state, not a bug.
 */
export function changeReasonFor(item: PricingItem, section: "base" | "retail" | "fuel"): PriceChangeReason | null {
  if (section === "base") {
    if (item.newBasePrice == null) return null;
    return item.hqBaseReason ?? item.chosenBaseReason ?? STORE_BASE_REASON_DEFAULT;
  }
  if (section === "retail") {
    if (item.newRetailPrice == null) return null;
    return item.hqRetailReason ?? item.chosenRetailReason ?? null;
  }
  // fuel
  if (item.fuelSaver == null || item.fuelSaver <= 0) return null;
  return item.hqFuelReason ?? item.chosenFuelReason ?? null;
}
