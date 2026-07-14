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

export const REASON_META: Record<PriceChangeReason, { label: string }> = {
  cost_change: { label: "Cost change" },
  competitor_change: { label: "Competitor change" },
  hq_pricing_review: { label: "HQ pricing review" },
  other: { label: "Other" },
  discontinued: { label: "Discontinued" },
  allowance: { label: "Allowance" },
  displays: { label: "Displays" },
  wow_buy: { label: "WOW Buy / E-Buy" },
  manager_special: { label: "Manager special" },
  soon_to_expiry: { label: "Soon to expiry" },
  obsolete_inventory: { label: "Obsolete inventory" },
  discontinued_mc060220: { label: "Discontinued (MC-060-220)" },
  buys: { label: "Buys" },
  excess_stock: { label: "Excess stock" },
  local_deal: { label: "Local deal (one-time)" },
  four_by_four: { label: "4x4 program" },
};

// The HQ catalogs as Select options — shown when the director re-picks the
// reason of an HQ-originated section (accepted rec or custom price on a
// pending rec): the change's origin is still HQ, so its catalog applies.
export const HQ_BASE_REASON_OPTIONS = HQ_BASE_REASONS.map((r) => ({ value: r, label: REASON_META[r].label }));
export const HQ_PROMO_REASON_OPTIONS = HQ_PROMO_REASONS.map((r) => ({ value: r, label: REASON_META[r].label }));

// Store Base: 3 reasons, no default — the Select opens unselected with a
// placeholder until the director picks one (Done blocks while missing).
export const STORE_BASE_REASON_OPTIONS: { value: StoreBaseReason; label: string }[] = [
  { value: "cost_change", label: REASON_META.cost_change.label },
  { value: "competitor_change", label: REASON_META.competitor_change.label },
  { value: "other", label: REASON_META.other.label },
];

// Store Retail / Fuel Saver: 11 shared reasons, no default — the Select opens
// unselected with a placeholder until the director picks one. Grouped
// (product sign-off 2026-07-14) so the flat list scans by intent: deal-driven
// reasons first (the common case for promos/fuel), inventory-driven second.
// Within each group the original catalog order is kept.
const DEALS = "Deals & programs";
const INVENTORY = "Inventory";
export const STORE_PROMO_REASON_OPTIONS: { value: StorePromoReason; label: string; category: string }[] = [
  { value: "manager_special", label: REASON_META.manager_special.label, category: DEALS },
  { value: "allowance", label: REASON_META.allowance.label, category: DEALS },
  { value: "buys", label: REASON_META.buys.label, category: DEALS },
  { value: "displays", label: REASON_META.displays.label, category: DEALS },
  { value: "local_deal", label: REASON_META.local_deal.label, category: DEALS },
  { value: "wow_buy", label: REASON_META.wow_buy.label, category: DEALS },
  { value: "four_by_four", label: REASON_META.four_by_four.label, category: DEALS },
  { value: "soon_to_expiry", label: REASON_META.soon_to_expiry.label, category: INVENTORY },
  { value: "obsolete_inventory", label: REASON_META.obsolete_inventory.label, category: INVENTORY },
  { value: "discontinued_mc060220", label: REASON_META.discontinued_mc060220.label, category: INVENTORY },
  { value: "excess_stock", label: REASON_META.excess_stock.label, category: INVENTORY },
];

/**
 * The reason behind ONE pricing section's decision — Base, Retail, or Fuel
 * Saver. Sections are independent: an item can carry a Base reason and a
 * Retail reason at once, from different catalogs, and they need not agree.
 *
 * Resolution: the director's explicit pick (`chosen*Reason`) wins; otherwise
 * an HQ-originated section (accepted rec or custom price on a pending rec)
 * inherits the HQ reason — the recommendation is still the section's origin,
 * only the final price differs. A DECLINED section (`*Reviewed`) severs that
 * origin: a later price change there is a fresh store-originated decision, so
 * the HQ reason no longer applies (the hq*Reason field itself stays put for
 * provenance traces like HqRef).
 *
 * No section has a default — an unresolved reason returns null, and the
 * drawer blocks Done while a decided price has one.
 */
export function changeReasonFor(item: PricingItem, section: "base" | "retail" | "fuel"): PriceChangeReason | null {
  if (section === "base") {
    if (item.newBasePrice == null) return null;
    return item.chosenBaseReason ?? (item.baseReviewed ? null : item.hqBaseReason) ?? null;
  }
  if (section === "retail") {
    if (item.newRetailPrice == null) return null;
    return item.chosenRetailReason ?? (item.retailReviewed ? null : item.hqRetailReason) ?? null;
  }
  // fuel
  if (item.fuelSaver == null || item.fuelSaver <= 0) return null;
  return item.chosenFuelReason ?? (item.fuelReviewed ? null : item.hqFuelReason) ?? null;
}
