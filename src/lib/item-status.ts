import { Batch, OverrideStatus, PricingItem } from "@/types/pricing";

type BadgeTone = "neutral" | "success" | "negative" | "warning" | "in-progress";

export type ItemStatus = { label: string; tone: BadgeTone };

const STATUS: Record<string, ItemStatus> = {
  live: { label: "Live", tone: "success" },
  // Live in SAP via an HQ-pushed price the store hasn't acknowledged or overridden
  // yet. It IS live — this only flags that it still wants the director's review.
  // (The HQ origin is already clear from the tab + the price cell's HQ badge.)
  review: { label: "Needs review", tone: "in-progress" },
  edited: { label: "Edited", tone: "warning" },
  in_batch: { label: "In batch", tone: "in-progress" },
  scheduled: { label: "Scheduled", tone: "neutral" },
  // Sent to SAP but not yet acknowledged — not live until SAP confirms.
  sent: { label: "Pending SAP", tone: "warning" },
  // SAP confirmed the change — the price is now live.
  confirmed: { label: "Live", tone: "success" },
};

// An HQ-pushed price (already live in SAP) the store hasn't acted on yet —
// neither acknowledged ("Keep HQ price") nor overridden. Shared by the page (HQ
// tab filter + count), the price cell, and the drawer's "Keep HQ price" escape.
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
