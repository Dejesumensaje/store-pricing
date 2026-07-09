import { Batch, OverrideStatus, PricingItem } from "@/types/pricing";

type BadgeTone = "neutral" | "success" | "negative" | "warning" | "in-progress";

export type ItemStatus = { label: string; tone: BadgeTone; loading?: boolean };

const STATUS: Record<string, ItemStatus> = {
  live: { label: "Live", tone: "success" },
  // An HQ recommendation the director hasn't decided on yet. The proposal is NOT
  // live — the item still carries its current SAP price; this flags that a
  // decision (accept / override / keep current) is owed.
  review: { label: "Needs review", tone: "warning" },
  // In a batch, waiting to be sent — every decision lands here (batching is
  // mandatory); there is no loose "ready to send". Informative blue (not
  // neutral gray, which read as disabled) — matches the batch-level "Ready to
  // send" pill.
  inBatch: { label: "In batch", tone: "in-progress" },
  // Sent to SAP, not live until SAP confirms — the spinner (loading) signals it's
  // in flight; neutral gray keeps it calm (amber read as a warning).
  sent: { label: "Sending", tone: "neutral", loading: true },
  // Submitted, but the price hasn't gone live yet because the promo's own start
  // date hasn't arrived — genuine date-based scheduling (see hasFutureAllowance),
  // unrelated to batch membership.
  scheduled: { label: "Scheduled", tone: "in-progress" },
  // The last send to SAP failed (reverts to Live after 3 days or retries). Visual
  // state only in this prototype.
  failed: { label: "Failed", tone: "negative" },
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
export function deriveItemStatus(item: PricingItem, _batches: Batch[]): ItemStatus {
  const statuses = [item.baseOverrideStatus, item.retailOverrideStatus].filter(
    (s): s is OverrideStatus => s != null
  );
  // No committed change: Live unless HQ is still waiting on the store's review.
  if (statuses.length === 0) return hqReviewNeeded(item) ? STATUS.review : STATUS.live;

  // A failed send takes priority over the in-flight/confirmed state below.
  if (item.sendFailed) return STATUS.failed;

  // Every change lands in a batch (batching is mandatory on Done), so a decided
  // change reads "In batch" — both once it's actually in one and in the brief
  // pre-batch moment. There is no loose "ready to send" state.
  if (statuses.includes("pending") || statuses.includes("in_batch")) return STATUS.inBatch;

  if (statuses.includes("submitted")) {
    return hasFutureAllowance(item) ? STATUS.scheduled : STATUS.sent;
  }

  return STATUS.confirmed;
}
