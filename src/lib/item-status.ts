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

// An HQ recommendation the store hasn't decided on yet — neither kept ("Keep
// current") nor accepted/overridden. Shared by the page (HQ tab filter + count),
// the price cell, and the drawer's decision actions.
export const hqReviewNeeded = (i: PricingItem) =>
  !!i.hqReviewPending && !i.reviewed && !i.hasOverride;

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
