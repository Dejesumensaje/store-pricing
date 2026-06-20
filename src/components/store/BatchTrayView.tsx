"use client";

import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Button, Badge, Select, Modal, ToggleGroup, useToast } from "@dejesumensaje/converge-ds-experimental";
import { Plus, Layers, Trash2, Inbox, CalendarClock, CheckCircle2 } from "lucide-react";
import { BatchCard } from "@/components/batches/BatchCard";
import { BatchDetailDrawer } from "@/components/batches/BatchDetailDrawer";
import { SendToSapModal } from "@/components/store/SendToSapModal";
import { DateField, todayIso } from "@/components/shared/DateField";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { usePricingStore, selectPendingOverrides } from "@/store/pricing-store";
import { buildItemsById, aggregateBatchImpact } from "@/lib/batch-utils";
import { fmt, fmtQtyPrice } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/pricing-meta";
import { Batch, Override } from "@/types/pricing";

type Segment = "pending" | "scheduled" | "sent";

type Props = {
  /** Open the New batch flow seeded with these override ids (owned by the page). */
  onNewBatch: (seedIds: string[]) => void;
  activeBatchId: string | null;
  onSetActiveBatch: (batchId: string | null) => void;
};

export function BatchTrayView({ onNewBatch, activeBatchId, onSetActiveBatch }: Props) {
  const toast = useToast();
  const items = usePricingStore((s) => s.items);
  const batches = usePricingStore((s) => s.batches);
  const overrides = usePricingStore((s) => s.overrides);
  const pending = usePricingStore(useShallow(selectPendingOverrides));
  const addToBatch = usePricingStore((s) => s.addToBatch);
  const removeFromLooseTray = usePricingStore((s) => s.removeFromLooseTray);
  const updateBasePrice = usePricingStore((s) => s.updateBasePrice);
  const updateRetailPrice = usePricingStore((s) => s.updateRetailPrice);
  const submitBatch = usePricingStore((s) => s.submitBatch);
  const sendAllPending = usePricingStore((s) => s.sendAllPending);
  const scheduleBatch = usePricingStore((s) => s.scheduleBatch);

  const [segment, setSegment] = useState<Segment>("pending");
  const [manageBatchId, setManageBatchId] = useState<string | null>(null);
  const [sendId, setSendId] = useState<string | null>(null);
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState<string | null>(null);
  const [confirmSendAll, setConfirmSendAll] = useState(false);

  const itemsById = useMemo(() => buildItemsById([items]), [items]);
  const impacts = useMemo(
    () => new Map(batches.map((b) => [b.id, aggregateBatchImpact(b, overrides, itemsById)])),
    [batches, overrides, itemsById]
  );

  const draftBatches = batches.filter((b) => b.status === "draft");
  const scheduledBatches = batches.filter((b) => b.status === "scheduled");
  const sentBatches = batches.filter((b) => b.status === "submitted" || b.status === "confirmed");
  const openBatches = [...draftBatches, ...scheduledBatches];
  const sendBatch = batches.find((b) => b.id === sendId) ?? null;

  // Discarding a pending edit is cheap and reversible — skip the modal, just toast
  // with an Undo that re-applies the price.
  const discardEdit = (ov: Override) => {
    removeFromLooseTray(ov.id);
    toast.success("Price change discarded", {
      action: {
        label: "Undo",
        onClick: () =>
          ov.priceField === "base"
            ? updateBasePrice(ov.itemId, ov.newPrice)
            : updateRetailPrice(ov.itemId, ov.qty ?? 1, ov.newPrice),
      },
    });
  };

  // Shared card renderer so each segment stays consistent.
  const renderCard = (b: Batch, opts?: { active?: boolean }) => (
    <BatchCard
      key={b.id}
      batch={b}
      impact={impacts.get(b.id)!}
      isActive={opts?.active ? b.id === activeBatchId : undefined}
      onSetActive={opts?.active ? () => onSetActiveBatch(b.id) : undefined}
      onManage={() => setManageBatchId(b.id)}
      onSchedule={() => {
        setScheduleId(b.id);
        setScheduleDate(b.scheduledAt ? b.scheduledAt.slice(0, 10) : null);
      }}
      onSubmit={() => setSendId(b.id)}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="-mx-1 overflow-x-auto px-1">
        <ToggleGroup
          aria-label="Batch lifecycle"
          value={segment}
          onValueChange={(v) => setSegment(v as Segment)}
          options={[
            { value: "pending", label: `Pending (${pending.length + draftBatches.length})` },
            { value: "scheduled", label: `Scheduled (${scheduledBatches.length})` },
            { value: "sent", label: `Sent (${sentBatches.length})` },
          ]}
        />
      </div>

      {/* ── Pending: unbatched edits + draft batches ──────────────────────── */}
      {segment === "pending" && (
        <div className="flex flex-col gap-8">
          <section>
            <div className="mb-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-gray-900">Ready to send</h2>
                <Badge tone={pending.length > 0 ? "warning" : "neutral"} size="sm">{pending.length}</Badge>
              </div>
              {pending.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setConfirmSendAll(true)}>
                    Send all to SAP
                  </Button>
                  <Button variant="primary" size="sm" iconLeft={Plus} onClick={() => onNewBatch(pending.map((o) => o.id))}>
                    New batch
                  </Button>
                </div>
              )}
            </div>
            {pending.length === 0 ? (
              <EmptyState icon={Inbox} title="Nothing to send yet" hint="Price changes land here, ready to send — on their own or in a batch." />
            ) : (
              <ul className="flex flex-col gap-2">
                {pending.map((ov) => (
                  <li key={ov.id} className="flex flex-col items-start gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 md:flex-row md:items-center md:justify-between md:gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{ov.itemName}</p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <Badge tone={ov.priceField === "base" ? "in-progress" : "warning"} size="sm">
                          {ov.priceField === "base" ? "Base" : "Retail"}
                        </Badge>
                        <span className="text-xs text-gray-400">{CATEGORY_LABELS[ov.changeType]}</span>
                      </div>
                    </div>
                    <div className="flex w-full flex-wrap items-center gap-3 md:w-auto md:shrink-0">
                      <div className="flex items-center gap-2 text-sm tabular-nums">
                        <span className="text-gray-400">{fmt(ov.currentPrice)}</span>
                        <span aria-hidden="true" className="text-gray-300">→</span>
                        <span className="font-semibold text-gray-900">{fmtQtyPrice(ov.qty, ov.newPrice)}</span>
                      </div>
                      {openBatches.length > 0 && (
                        <div className="w-full md:w-44">
                          <Select
                            label="Add to batch"
                            size="sm"
                            options={openBatches.map((b) => ({ label: b.name, value: b.id }))}
                            value=""
                            onChange={(v) => addToBatch(v as string, [ov.id])}
                            placeholder="Add to batch…"
                          />
                        </div>
                      )}
                      <Button
                        variant="tertiary"
                        size="sm"
                        iconLeft={Trash2}
                        aria-label={`Discard ${ov.itemName}`}
                        onClick={() => discardEdit(ov)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-gray-900">Draft batches</h2>
            {draftBatches.length === 0 ? (
              <EmptyState icon={Layers} title="No draft batches" hint="Group changes into a batch to schedule or send together." />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {draftBatches.map((b) => renderCard(b, { active: true }))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── Scheduled ─────────────────────────────────────────────────────── */}
      {segment === "scheduled" && (
        scheduledBatches.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No scheduled batches" hint="Scheduled batches wait here until their send date." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {scheduledBatches.map((b) => renderCard(b, { active: true }))}
          </div>
        )
      )}

      {/* ── Sent ──────────────────────────────────────────────────────────── */}
      {segment === "sent" && (
        sentBatches.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="No batches sent yet" hint="Sent batches show up here with their status." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sentBatches.map((b) => renderCard(b))}
          </div>
        )
      )}

      <ConfirmDialog
        open={confirmSendAll}
        onOpenChange={(open) => !open && setConfirmSendAll(false)}
        headline={`Send ${pending.length} change${pending.length !== 1 ? "s" : ""} to SAP?`}
        description="Sent without a batch; live once SAP confirms."
        confirmLabel="Send to SAP"
        onConfirm={() => {
          const n = pending.length;
          sendAllPending();
          toast.success(`Sent ${n} change${n !== 1 ? "s" : ""} to SAP — pending confirmation`);
          setSegment("sent");
        }}
      />

      <BatchDetailDrawer batchId={manageBatchId} onOpenChange={(open) => !open && setManageBatchId(null)} />

      <SendToSapModal
        batch={sendBatch}
        itemCount={sendBatch ? sendBatch.overrideIds.length : 0}
        onOpenChange={(open) => !open && setSendId(null)}
        onSend={(id) => {
          submitBatch(id);
          toast.success("Sent to SAP — pending confirmation");
        }}
      />

      <Modal
        open={scheduleId != null}
        onOpenChange={(open) => !open && setScheduleId(null)}
        title="Schedule send"
        size="sm"
        className="max-md:!max-w-[calc(100vw-1.5rem)]"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setScheduleId(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!scheduleDate}
              onClick={() => {
                if (scheduleId && scheduleDate) {
                  scheduleBatch(scheduleId, `${scheduleDate}T09:00:00`);
                  toast.success("Batch scheduled");
                }
                setScheduleId(null);
              }}
            >
              Schedule
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-600">Pick the date this batch should be sent to SAP.</p>
          <DateField value={scheduleDate} onChange={setScheduleDate} min={todayIso()} aria-label="Send date" />
        </div>
      </Modal>
    </div>
  );
}
