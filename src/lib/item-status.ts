import { Batch, OverrideStatus, PricingItem } from "@/types/pricing";

type BadgeTone = "neutral" | "success" | "negative" | "warning" | "in-progress";

export type ItemStatus = { label: string; tone: BadgeTone };

const STATUS: Record<string, ItemStatus> = {
  live: { label: "Live", tone: "success" },
  edited: { label: "Edited", tone: "warning" },
  in_batch: { label: "In batch", tone: "in-progress" },
  scheduled: { label: "Scheduled", tone: "neutral" },
  sent: { label: "Sent", tone: "neutral" },
  confirmed: { label: "Confirmed", tone: "success" },
};

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
  if (statuses.length === 0) return STATUS.live;

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
