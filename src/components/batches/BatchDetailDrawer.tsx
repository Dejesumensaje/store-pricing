"use client";

import { Drawer, Button, Badge, Select, useToast } from "@dejesumensaje/converge-ds-experimental";
import { Trash2, Send, Inbox, CalendarClock } from "lucide-react";
import { usePricingStore } from "@/store/pricing-store";
import { EmptyState } from "@/components/shared/EmptyState";
import { fmt, fmtQtyPrice, fmtDate, fmtDateTime } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/pricing-meta";

type Props = {
  batchId: string | null;
  onOpenChange: (open: boolean) => void;
};

export function BatchDetailDrawer({ batchId, onOpenChange }: Props) {
  const toast = useToast();
  const batches = usePricingStore((s) => s.batches);
  const overrides = usePricingStore((s) => s.overrides);
  const removeFromLooseTray = usePricingStore((s) => s.removeFromLooseTray);
  const moveOverrideToBatch = usePricingStore((s) => s.moveOverrideToBatch);
  const submitBatch = usePricingStore((s) => s.submitBatch);

  const batch = batches.find((b) => b.id === batchId) ?? null;
  const batchOverrides = overrides.filter((o) => o.batchId === batchId);
  // Scheduled batches are still editable (not yet sent to SAP).
  const isScheduled = batch?.status === "scheduled";

  // Other scheduled batches this change could be moved into.
  const otherScheduledBatches = batches.filter((b) => b.id !== batchId && b.status === "scheduled");

  return (
    <Drawer
      open={batch != null}
      onOpenChange={onOpenChange}
      title={batch?.name ?? "Batch"}
      size="md"
      className="max-md:!w-full"
      headerActions={
        batch ? (
          <Badge tone={batch.status === "confirmed" ? "success" : batch.status === "submitted" ? "warning" : "neutral"} size="sm">
            {batch.status === "confirmed" ? "Live" : batch.status === "submitted" ? "Sending" : "Scheduled"}
          </Badge>
        ) : undefined
      }
      footer={
        batch ? (
          <div className="flex items-center gap-2">
            <Button variant="tertiary" onClick={() => onOpenChange(false)}>Close</Button>
            <div className="flex-1" />
            {isScheduled && (
              <Button
                variant="primary"
                iconLeft={Send}
                disabled={batchOverrides.length === 0}
                onClick={() => {
                  submitBatch(batch.id);
                  toast.success(`Batch "${batch.name}" sent to SAP`);
                  onOpenChange(false);
                }}
              >
                Send to SAP now ({batchOverrides.length})
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      {!batch ? null : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
            <span className="inline-flex items-center gap-3">
              <span>Created {fmtDate(batch.createdAt)}</span>
              {batch.scheduledAt && (
                <span className="inline-flex items-center gap-1 text-gray-600">
                  <CalendarClock className="size-3.5" aria-hidden="true" /> Sends {fmtDateTime(batch.scheduledAt)}
                </span>
              )}
            </span>
            {batch.sapReference && (
              <span>SAP ref <span className="font-medium text-gray-600">{batch.sapReference}</span></span>
            )}
          </div>

          {batchOverrides.length === 0 ? (
            <EmptyState icon={Inbox} title="No items in this batch" bordered={false} />
          ) : (
            <ul className="flex flex-col gap-2">
              {batchOverrides.map((ov) => (
                <li key={ov.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{ov.itemName}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Badge tone={ov.priceField === "base" ? "in-progress" : "warning"} size="sm">
                          {ov.priceField === "base" ? "Base" : "Retail"}
                        </Badge>
                        <span className="text-xs text-gray-500">{CATEGORY_LABELS[ov.changeType]}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm shrink-0">
                      <span className="text-gray-500">{fmt(ov.currentPrice)}</span>
                      <span aria-hidden="true" className="text-gray-300">→</span>
                      <span className="font-semibold text-gray-900">{fmtQtyPrice(ov.qty, ov.newPrice)}</span>
                    </div>
                  </div>

                  {isScheduled && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {otherScheduledBatches.length > 0 && (
                        <div className="w-48">
                          <Select
                            label="Move to another batch"
                            size="sm"
                            options={otherScheduledBatches.map((b) => ({ label: b.name, value: b.id }))}
                            value=""
                            onChange={(v) => moveOverrideToBatch(ov.id, v as string)}
                            placeholder="Move to batch…"
                          />
                        </div>
                      )}
                      <div className="flex-1" />
                      {/* No loose state to fall back to — removing reverts the change. */}
                      <Button
                        variant="tertiary"
                        size="sm"
                        iconLeft={Trash2}
                        aria-label={`Remove ${ov.itemName} (reverts the change)`}
                        onClick={() => removeFromLooseTray(ov.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Drawer>
  );
}
