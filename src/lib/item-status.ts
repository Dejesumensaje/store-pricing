import { OverrideStatus, PricingItem } from "@/types/pricing";

type BadgeTone = "neutral" | "success" | "negative" | "warning" | "in-progress";

export type ItemStatus = { label: string; tone: BadgeTone };

const STATUS: Record<string, ItemStatus> = {
  live: { label: "Live", tone: "success" },
  // An HQ recommendation the director hasn't decided on yet. The proposal is NOT
  // live — the item still carries its current SAP price; this flags that a
  // decision (accept / override / keep current) is owed.
  review: { label: "Needs review", tone: "warning" },
  // A local change the director has made but not yet committed as live — an
  // in-progress edit, not a warning or a disabled state.
  edited: { label: "Edited", tone: "in-progress" },
  // Confirmed live — the price is in effect.
  confirmed: { label: "Live", tone: "success" },
};

// One helper per pricing section: TRUE while that section carries an HQ
// recommendation the director hasn't decided — neither accepted/overridden (a
// new price/amount exists) nor declined (the section's reviewed flag). Sections
// are independent: declining the fuel saver leaves a pending base rec pending.
export const baseRecPending = (i: PricingItem) =>
  !!i.hqReviewPending &&
  Math.abs(i.recommendedBasePrice - i.currentBasePrice) > 0.005 &&
  i.newBasePrice == null &&
  !i.baseReviewed;

export const retailRecPending = (i: PricingItem) =>
  !!i.hqReviewPending &&
  i.category_type === "temporary_allowance" &&
  i.recommendedRetailPrice != null &&
  i.newRetailPrice == null &&
  !i.retailReviewed;

export const fuelRecPending = (i: PricingItem) =>
  !!i.hqReviewPending &&
  (i.recommendedFuelSaver ?? 0) > 0 &&
  (i.fuelSaver == null || i.fuelSaver <= 0) &&
  !i.fuelReviewed;

// An HQ recommendation the store hasn't fully decided on yet — any rec-bearing
// section still pending. Shared by the page (HQ tab filter + count), the price
// cell, and the drawer's decision actions.
export const hqReviewNeeded = (i: PricingItem) =>
  baseRecPending(i) || retailRecPending(i) || fuelRecPending(i);

// Reduce an item's base + retail override statuses to one display status for
// the Status column: an in-progress local change reads "Edited"; otherwise
// it's "Live", unless HQ is still waiting on the store's review.
export function deriveItemStatus(item: PricingItem): ItemStatus {
  const statuses = [item.baseOverrideStatus, item.retailOverrideStatus].filter(
    (s): s is OverrideStatus => s != null
  );
  if (statuses.length === 0) return hqReviewNeeded(item) ? STATUS.review : STATUS.live;

  if (statuses.includes("pending")) return STATUS.edited;

  return STATUS.confirmed;
}
