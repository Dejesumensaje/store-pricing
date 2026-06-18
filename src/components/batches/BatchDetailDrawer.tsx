"use client";

import { Drawer, Button, Badge, Select, useToast } from "@dejesumensaje/converge-ds-experimental";
import { ArrowLeft, Trash2, Send, CheckCircle2, Inbox } from "lucide-react";
import { usePricingStore } from "@/store/pricing-store";
import { fmt, fmtQtyPrice, fmtDate } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/pricing-meta";

type Props = {
  batchId: string | null;
  onOpenChange: (open: boolean) => void;
};

export function BatchDetailDrawer({ batchId, onOpenChange }: Props) {
  const toast = useToast();
  const batches = usePricingStore((s) => s.batches);
  const overrides = usePricingStore((s) => s.overrides);
  const removeFromBatch = usePricingStore((s) => s.removeFromBatch);
  const removeFromLooseTray = usePricingStore((s) => s.removeFromLooseTray);
  const moveOverrideToBatch = usePricingStore((s) => s.moveOverrideToBatch);
  const submitBatch = usePricingStore((s) => s.submitBatch);
  const confirmBatch = usePricingStore((s) => s.confirmBatch);

  const batch = batches.find((b) => b.id === batchId) ?? null;
  const batchOverrides = overrides.filter((o) => o.batchId === batchId);
  const isDraft = batch?.status === "draft";

  // Other draft batches this override could be moved into.
  const otherDraftBatches = batches.filter((b) => b.id !== batchId && b.status === "draft");

  return (
    <Drawer
      open={batch != null}
      onOpenChange={onOpenChange}
      title={batch?.name ?? "Batch"}
      size="md"
      headerActions={
        batch ? (
          <Badge tone={batch.status === "confirmed" ? "success" : batch.status === "submitted" ? "warning" : "neutral"} size="sm">
            {batch.status === "confirmed" ? "Confirmed" : batch.status === "submitted" ? "Submitted" : "Draft"}
          </Badge>
        ) : undefined
      }
      footer={
        batch ? (
          <div className="flex items-center gap-2">
            <Button variant="tertiary" onClick={() => onOpenChange(false)}>Close</Button>
            <div className="flex-1" />
            {batch.status === "draft" && (
              <Button
                variant="primary"
                iconLeft={Send}
                disabled={batchOverrides.length === 0}
                onClick={() => {
                  submitBatch(batch.id);
                  toast.success(`Batch "${batch.name}" sent to SAP`);
                }}
              >
                Send to SAP ({batchOverrides.length})
              </Button>
            )}
            {batch.status === "submitted" && (
              <Button
                variant="secondary"
                iconLeft={CheckCircle2}
                onClick={() => {
                  confirmBatch(batch.id);
                  toast.success(`Batch "${batch.name}" confirmed by SAP`);
                }}
              >
                Mark confirmed
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      {!batch ? null : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Created {fmtDate(batch.createdAt)}</span>
            {batch.sapReference && (
              <span>SAP ref <span className="font-medium text-gray-600">{batch.sapReference}</span></span>
            )}
          </div>

          {batchOverrides.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-gray-400">
              <Inbox className="size-10 stroke-1" />
              <p className="text-sm font-medium">No items in this batch</p>
            </div>
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
                        <span className="text-xs text-gray-400">{CATEGORY_LABELS[ov.changeType]}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm shrink-0">
                      <span className="text-gray-400">{fmt(ov.currentPrice)}</span>
                      <span className="text-gray-300">→</span>
                      <span className="font-semibold text-gray-900">{fmtQtyPrice(ov.qty, ov.newPrice)}</span>
                    </div>
                  </div>

                  {isDraft && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button variant="tertiary" size="sm" iconLeft={ArrowLeft} onClick={() => removeFromBatch(ov.id)}>
                        Move to pending
                      </Button>
                      {otherDraftBatches.length > 0 && (
                        <div className="w-48">
                          <Select
                            label="Move to another batch"
                            size="sm"
                            options={otherDraftBatches.map((b) => ({ label: b.name, value: b.id }))}
                            value=""
                            onChange={(v) => moveOverrideToBatch(ov.id, v as string)}
                            placeholder="Move to batch…"
                          />
                        </div>
                      )}
                      <div className="flex-1" />
                      <Button
                        variant="tertiary"
                        size="sm"
                        iconLeft={Trash2}
                        aria-label={`Discard ${ov.itemName}`}
                        onClick={() => removeFromLooseTray(ov.id)}
                      />
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
