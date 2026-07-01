"use client";

import { useState, useEffect } from "react";
import { Drawer, Button, Badge, Select, Checkbox, useToast } from "@dejesumensaje/converge-ds-experimental";
import { Trash2, Send, Inbox, CalendarClock, ClipboardCopy, Check, Store as StoreIcon, Pencil } from "lucide-react";
import { usePricingStore } from "@/store/pricing-store";
import { STORES } from "@/lib/store-config";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { fmt, fmtQtyPrice, fmtDate, fmtDateTime } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/pricing-meta";

type Props = {
  batchId: string | null;
  onOpenChange: (open: boolean) => void;
};

export function BatchDetailDrawer({ batchId, onOpenChange }: Props) {
  const toast = useToast();
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [sapCopied, setSapCopied] = useState(false);
  const [editingStores, setEditingStores] = useState(false);
  const [draftTargets, setDraftTargets] = useState<Set<string>>(new Set());
  const [confirmRemoveStores, setConfirmRemoveStores] = useState(false);
  // Captured when the remove-confirm opens, so its copy doesn't recompute to 0
  // after the edit commits.
  const [pendingRemovedCount, setPendingRemovedCount] = useState(0);
  const batches = usePricingStore((s) => s.batches);
  const overrides = usePricingStore((s) => s.overrides);
  const activeStoreId = usePricingStore((s) => s.activeStoreId);
  const removeFromLooseTray = usePricingStore((s) => s.removeFromLooseTray);
  const moveOverrideToBatch = usePricingStore((s) => s.moveOverrideToBatch);
  const submitBatch = usePricingStore((s) => s.submitBatch);
  const setBatchTargetStores = usePricingStore((s) => s.setBatchTargetStores);

  // Leave store-edit mode whenever the drawer switches batches.
  useEffect(() => setEditingStores(false), [batchId]);

  const batch = batches.find((b) => b.id === batchId) ?? null;
  const batchOverrides = overrides.filter((o) => o.batchId === batchId);
  // Distinct items in the batch — the send confirm counts items, matching the
  // Batches-list dialog so both entry points read identically.
  const batchItemCount = new Set(batchOverrides.map((o) => o.itemId)).size;
  // Scheduled batches are still editable (not yet sent to SAP).
  const isScheduled = batch?.status === "scheduled";
  // Multi-store fan-out: the stores this batch applies to (defaults to origin).
  const originId = batch?.originStoreId ?? activeStoreId;
  const currentTargetIds = batch?.targetStoreIds?.length ? batch.targetStoreIds : batch ? [originId] : [];
  const targetStores = STORES.filter((s) => currentTargetIds.includes(s.id));
  const isMultiStore = currentTargetIds.length > 1;

  const startEditStores = () => {
    setDraftTargets(new Set(currentTargetIds));
    setEditingStores(true);
  };
  const commitStoreEdit = () => {
    setBatchTargetStores(batch!.id, Array.from(draftTargets));
    setEditingStores(false);
    setConfirmRemoveStores(false);
    toast.success(`Now applies to ${new Set([originId, ...draftTargets]).size} store(s)`);
  };
  const saveStoreEdit = () => {
    const removed = currentTargetIds.filter((id) => !draftTargets.has(id) && id !== originId);
    if (removed.length > 0) {
      setPendingRemovedCount(removed.length);
      setConfirmRemoveStores(true);
    } else commitStoreEdit();
  };

  // Other scheduled batches this change could be moved into.
  const otherScheduledBatches = batches.filter((b) => b.id !== batchId && b.status === "scheduled");

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
            <span className="inline-flex items-center gap-3">
              <span>Created {fmtDate(batch.createdAt)}</span>
              {batch.scheduledAt && (
                <span className="inline-flex items-center gap-1 text-gray-600">
                  <CalendarClock className="size-3.5" aria-hidden="true" /> Sends {fmtDateTime(batch.scheduledAt)}
                </span>
              )}
            </span>
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

          {(isScheduled || isMultiStore) && (
            <div className="flex flex-col gap-2 rounded-lg border border-brand/20 bg-brand/5 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
                  <StoreIcon className="size-3.5 text-brand" aria-hidden="true" />
                  Applies to {currentTargetIds.length} store{currentTargetIds.length !== 1 ? "s" : ""}
                </span>
                {isScheduled && !editingStores && (
                  <Button variant="tertiary" size="sm" iconLeft={Pencil} onClick={startEditStores}>
                    Edit stores
                  </Button>
                )}
              </div>

              {!editingStores ? (
                <div className="flex flex-wrap gap-1.5">
                  {targetStores.map((s) => (
                    <Badge key={s.id} tone="neutral" size="sm">{s.name}</Badge>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {STORES.map((store) => {
                      // Origin and the store you're viewing from stay in the group.
                      const locked = store.id === originId || store.id === activeStoreId;
                      return (
                        <label
                          key={store.id}
                          className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-colors ${
                            draftTargets.has(store.id) ? "border-brand/40 bg-white" : "border-gray-200 bg-white/60"
                          } ${locked ? "" : "cursor-pointer hover:bg-white"}`}
                        >
                          <Checkbox
                            checked={draftTargets.has(store.id)}
                            disabled={locked}
                            onCheckedChange={(c) =>
                              setDraftTargets((prev) => {
                                const next = new Set(prev);
                                c === true ? next.add(store.id) : next.delete(store.id);
                                return next;
                              })
                            }
                            aria-label={store.name}
                          />
                          <span className="truncate text-gray-800">{store.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setEditingStores(false)}>
                      Cancel
                    </Button>
                    <Button variant="primary" size="sm" onClick={saveStoreEdit}>
                      Save stores
                    </Button>
                  </div>
                </div>
              )}
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

                  {isScheduled && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {otherScheduledBatches.length > 0 && (
                        <div className="w-48">
                          <Select
                            label="Move to another batch"
                            size="sm"
                            options={otherScheduledBatches.map((b) => ({ label: b.name, value: b.id }))}
                            value=""
                            onChange={(v) => {
                              const targetBatch = otherScheduledBatches.find((b) => b.id === v);
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
      headline={isMultiStore ? `Send "${batch?.name}" to ${currentTargetIds.length} stores now?` : `Send "${batch?.name}" to SAP now?`}
      description={`This sends changes to ${batchItemCount} item${batchItemCount !== 1 ? "s" : ""}${isMultiStore ? ` across ${currentTargetIds.length} stores` : ""} to SAP immediately — bypassing the scheduled date. Updated prices will be visible in stores within 1 hour, or on the next business day.`}
      confirmLabel={isMultiStore ? "Send to all stores now" : "Send to SAP now"}
      onConfirm={() => {
        if (!batch) return;
        submitBatch(batch.id);
        toast.success(
          `"${batch.name}" sent to SAP — ${batchOverrides.length} item${batchOverrides.length !== 1 ? "s" : ""} · sends ${fmtDateTime(batch.scheduledAt ?? new Date().toISOString())}`
        );
        onOpenChange(false);
      }}
    />

    <ConfirmDialog
      open={confirmRemoveStores}
      onOpenChange={(o) => { if (!o) setConfirmRemoveStores(false); }}
      headline="Remove stores from this batch?"
      description={`${pendingRemovedCount} store${pendingRemovedCount !== 1 ? "s" : ""} will be dropped and their scheduled price changes reverted. This cannot be undone.`}
      confirmLabel="Remove and revert"
      destructive
      onConfirm={commitStoreEdit}
    />
    </>
  );
}
