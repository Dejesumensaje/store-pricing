import { Batch, OverrideStatus, PricingItem } from "@/types/pricing";

type BadgeTone = "neutral" | "success" | "negative" | "warning" | "in-progress";

export type ItemStatus = { label: string; tone: BadgeTone; loading?: boolean };

const STATUS: Record<string, ItemStatus> = {
  live: { label: "Live", tone: "success" },
  // An HQ recommendation the director hasn't decided on yet. The proposal is NOT
  // live — the item still carries its current SAP price; this flags that a
  // decision (accept / override / keep current) is owed.
  review: { label: "Needs review", tone: "in-progress" },
  // Decided — ready to send to SAP.
  edited: { label: "Ready to send", tone: "warning" },
  in_batch: { label: "Scheduled", tone: "in-progress" },
  scheduled: { label: "Scheduled", tone: "neutral" },
  // Sent to SAP, not live until SAP confirms — a subtle spinner signals it's in
  // flight.
  sent: { label: "Sending", tone: "warning", loading: true },
  // SAP confirmed the change — the price is live.
  confirmed: { label: "Live", tone: "success" },
};

// An HQ recommendation the store hasn't decided on yet — neither kept ("Keep
// current") nor accepted/overridden. Shared by the page (HQ tab filter + count),
// the price cell, and the drawer's decision actions.
export const hqReviewNeeded = (i: PricingItem) =>
  !!i.hqReviewPending && !i.reviewed && !i.hasOverride;

// A temp allowance whose effective date hasn't arrived yet is "Scheduled" even
// after it's sent — the new price only goes live on the start date.
function hasFutureAllowance(item: PricingItem): boolean {
  if (item.category_type !== "temporary_allowance" || !item.allowanceStartDate) return false;
  return new Date(`${item.allowanceStartDate}T00:00:00`).getTime() > Date.now();
}

// Reduce an item's base + retail override statuses (and its batch) to one
// display status for the Status column.
export function deriveItemStatus(item: PricingItem, batches: Batch[]): ItemStatus {
  const statuses = [item.baseOverrideStatus, item.retailOverrideStatus].filter(
    (s): s is OverrideStatus => s != null
  );
  // No committed change: Live unless HQ is still waiting on the store's review.
  if (statuses.length === 0) return hqReviewNeeded(item) ? STATUS.review : STATUS.live;

  if (statuses.includes("pending")) return STATUS.edited;

  if (statuses.includes("in_batch")) {
    const batch = batches.find(
      (b) => b.overrideIds.includes(`${item.id}:base`) || b.overrideIds.includes(`${item.id}:retail`)
    );
    if (batch?.status === "scheduled" || hasFutureAllowance(item)) return STATUS.scheduled;
    return STATUS.in_batch;
  }

  if (statuses.includes("submitted")) {
    return hasFutureAllowance(item) ? STATUS.scheduled : STATUS.sent;
  }

  return STATUS.confirmed;
}
