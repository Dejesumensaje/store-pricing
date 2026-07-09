"use client";

import { useState, useMemo } from "react";
import { Drawer, Button, Badge, Select, useToast } from "@dejesumensaje/converge-ds-experimental";
import { Trash2, Send, Inbox, ClipboardCopy, Check, AlertTriangle } from "lucide-react";
import { usePricingStore, useEdlpException } from "@/store/pricing-store";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { fmt, fmtQtyPrice, fmtDate } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/pricing-meta";
import { buildItemsById } from "@/lib/batch-utils";
import { batchBlockedByEdlpCeiling } from "@/lib/edlp-ceiling";

type Props = {
  batchId: string | null;
  onOpenChange: (open: boolean) => void;
};

export function BatchDetailDrawer({ batchId, onOpenChange }: Props) {
  const toast = useToast();
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [sapCopied, setSapCopied] = useState(false);
  const batches = usePricingStore((s) => s.batches);
  const overrides = usePricingStore((s) => s.overrides);
  const items = usePricingStore((s) => s.items);
  const removeFromLooseTray = usePricingStore((s) => s.removeFromLooseTray);
  const moveOverrideToBatch = usePricingStore((s) => s.moveOverrideToBatch);
  const submitBatch = usePricingStore((s) => s.submitBatch);
  const edlpException = useEdlpException();
  const itemsById = useMemo(() => buildItemsById([items]), [items]);

  const batch = batches.find((b) => b.id === batchId) ?? null;
  const batchOverrides = overrides.filter((o) => o.batchId === batchId);
  // Distinct items in the batch — the send confirm counts items, matching the
  // Batches-list dialog so both entry points read identically.
  const batchItemCount = new Set(batchOverrides.map((o) => o.itemId)).size;
  // Ready-to-send batches are still editable (not yet sent to SAP).
  const isReadyToSend = batch?.status === "scheduled";
  // EDLP ceiling backstop: an over-ceiling override with no active exception
  // blocks the send entirely — exceptions can be revoked after a batch was
  // created, so this is re-checked here, not just at commit time.
  const ceilingBlocked = batchBlockedByEdlpCeiling(batchOverrides, itemsById, edlpException);

  // Other ready-to-send batches this change could be moved into.
  const otherOpenBatches = batches.filter((b) => b.id !== batchId && b.status === "scheduled");

  return (
    <>
    <Drawer
      open={batch != null}
      onOpenChange={onOpenChange}
      title={batch?.name ?? "Batch"}
      size="md"
      className="max-md:!w-full"
      headerActions={
        batch ? (
          <Badge tone={batch.status === "confirmed" ? "success" : batch.status === "submitted" ? "warning" : "neutral"} size="sm">
            {batch.status === "confirmed" ? "Live" : batch.status === "submitted" ? "Sending" : "Ready to send"}
          </Badge>
        ) : undefined
      }
      footer={
        batch ? (
          <div className="flex items-center gap-2">
            <Button variant="tertiary" onClick={() => onOpenChange(false)}>Close</Button>
            <div className="flex-1" />
            {isReadyToSend && (
              <Button
                variant="primary"
                iconLeft={Send}
                disabled={batchOverrides.length === 0 || ceilingBlocked}
                onClick={() => setConfirmSend(true)}
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
            <span>Created {fmtDate(batch.createdAt)}</span>
            {batch.sapReference && (
              <span className="inline-flex items-center gap-1">
                SAP ref{" "}
                <span className="font-mono font-medium text-gray-600">{batch.sapReference}</span>
                <button
                  type="button"
                  aria-label="Copy SAP reference"
                  className="ml-0.5 rounded p-0.5 text-gray-400 hover:text-gray-700 transition-colors"
                  onClick={() => {
                    navigator.clipboard.writeText(batch.sapReference!);
                    setSapCopied(true);
                    setTimeout(() => setSapCopied(false), 2000);
                  }}
                >
                  {sapCopied ? (
                    <Check className="size-3 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <ClipboardCopy className="size-3" aria-hidden="true" />
                  )}
                </button>
              </span>
            )}
          </div>

          {isReadyToSend && ceilingBlocked && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs">
              <AlertTriangle className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
              <span className="text-amber-900">
                Contains an EDLP price over the SAP maximum with no active exception — sending is
                blocked until it&apos;s fixed or a store exception is granted.
              </span>
            </div>
          )}

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

                  {isReadyToSend && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {otherOpenBatches.length > 0 && (
                        <div className="w-48">
                          <Select
                            label="Move to another batch"
                            size="sm"
                            options={otherOpenBatches.map((b) => ({ label: b.name, value: b.id }))}
                            value=""
                            onChange={(v) => {
                              const targetBatch = otherOpenBatches.find((b) => b.id === v);
                              moveOverrideToBatch(ov.id, v as string);
                              if (targetBatch) toast.success(`Moved to "${targetBatch.name}"`);
                            }}
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
                        onClick={() => setConfirmRemoveId(ov.id)}
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

    <ConfirmDialog
      open={confirmRemoveId != null}
      onOpenChange={(open) => { if (!open) setConfirmRemoveId(null); }}
      headline="Remove from batch and discard this price change?"
      description="The price will revert to its previous value. This cannot be undone."
      confirmLabel="Remove and discard"
      destructive
      onConfirm={() => { if (confirmRemoveId) removeFromLooseTray(confirmRemoveId); }}
    />

    <ConfirmDialog
      open={confirmSend}
      onOpenChange={setConfirmSend}
      headline={`Send "${batch?.name}" to SAP now?`}
      description={`This sends changes to ${batchItemCount} item${batchItemCount !== 1 ? "s" : ""} to SAP immediately. Updated prices will be visible in stores within 1 hour, or on the next business day.`}
      confirmLabel="Send to SAP now"
      onConfirm={() => {
        if (!batch) return;
        submitBatch(batch.id);
        toast.success(`"${batch.name}" sent to SAP — ${batchOverrides.length} item${batchOverrides.length !== 1 ? "s" : ""}`);
        onOpenChange(false);
      }}
    />
    </>
  );
}
