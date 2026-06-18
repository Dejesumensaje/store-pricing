"use client";

import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Button, Badge, Select, Modal, AlertModal, DatePicker, useToast } from "@dejesumensaje/converge-ds-experimental";
import { Plus, Send, Layers, Trash2, Inbox } from "lucide-react";
import { BatchCard } from "@/components/batches/BatchCard";
import { BatchDetailDrawer } from "@/components/batches/BatchDetailDrawer";
import { usePricingStore, selectPendingOverrides } from "@/store/pricing-store";
import { buildItemsById, aggregateBatchImpact } from "@/lib/batch-utils";
import { fmt, fmtQtyPrice } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/pricing-meta";

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (d?: Date) => (d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T09:00:00` : null);

type Props = {
  /** Open the New batch flow seeded with these override ids (owned by the page). */
  onNewBatch: (seedIds: string[]) => void;
};

export function BatchTrayView({ onNewBatch }: Props) {
  const toast = useToast();
  const items = usePricingStore((s) => s.items);
  const batches = usePricingStore((s) => s.batches);
  const overrides = usePricingStore((s) => s.overrides);
  const pending = usePricingStore(useShallow(selectPendingOverrides));
  const addToBatch = usePricingStore((s) => s.addToBatch);
  const removeFromLooseTray = usePricingStore((s) => s.removeFromLooseTray);
  const submitBatch = usePricingStore((s) => s.submitBatch);
  const confirmBatch = usePricingStore((s) => s.confirmBatch);
  const scheduleBatch = usePricingStore((s) => s.scheduleBatch);

  const [manageBatchId, setManageBatchId] = useState<string | null>(null);
  const [sendId, setSendId] = useState<string | null>(null);
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);

  const itemsById = useMemo(() => buildItemsById([items]), [items]);
  const impacts = useMemo(
    () => new Map(batches.map((b) => [b.id, aggregateBatchImpact(b, overrides, itemsById)])),
    [batches, overrides, itemsById]
  );

  const draftBatches = batches.filter((b) => b.status === "draft" || b.status === "scheduled");
  const sendBatch = batches.find((b) => b.id === sendId) ?? null;

  return (
    <div className="flex flex-col gap-8">
      {/* Pending edits — not yet grouped into a batch */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Pending edits</h2>
            <Badge tone={pending.length > 0 ? "warning" : "neutral"} size="sm">{pending.length}</Badge>
          </div>
          {pending.length > 0 && (
            <Button variant="primary" size="sm" iconLeft={Plus} onClick={() => onNewBatch(pending.map((o) => o.id))}>
              New batch
            </Button>
          )}
        </div>

        {pending.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white py-12 text-gray-400">
            <Inbox className="size-8 stroke-1" />
            <p className="text-sm">No pending edits. Changes you make show up here.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {pending.map((ov) => (
              <li key={ov.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{ov.itemName}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <Badge tone={ov.priceField === "base" ? "in-progress" : "warning"} size="sm">
                      {ov.priceField === "base" ? "Base" : "Retail"}
                    </Badge>
                    <span className="text-xs text-gray-400">{CATEGORY_LABELS[ov.changeType]}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2 text-sm tabular-nums">
                    <span className="text-gray-400">{fmt(ov.currentPrice)}</span>
                    <span className="text-gray-300">→</span>
                    <span className="font-semibold text-gray-900">{fmtQtyPrice(ov.qty, ov.newPrice)}</span>
                  </div>
                  {draftBatches.length > 0 && (
                    <div className="w-44">
                      <Select
                        label="Add to batch"
                        size="sm"
                        options={draftBatches.map((b) => ({ label: b.name, value: b.id }))}
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
                    onClick={() => removeFromLooseTray(ov.id)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Batches */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Batches</h2>
        {batches.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white py-16 text-gray-400">
            <Layers className="size-10 stroke-1" />
            <p className="text-sm font-medium">No batches yet</p>
            <p className="max-w-xs text-center text-xs">Group pending edits into a batch to schedule or send them to SAP.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {batches.map((b) => (
              <BatchCard
                key={b.id}
                batch={b}
                impact={impacts.get(b.id)!}
                onManage={() => setManageBatchId(b.id)}
                onSchedule={() => {
                  setScheduleId(b.id);
                  setScheduleDate(b.scheduledAt ? new Date(b.scheduledAt) : undefined);
                }}
                onSubmit={() => setSendId(b.id)}
                onConfirm={() => {
                  confirmBatch(b.id);
                  toast.success(`Batch "${b.name}" confirmed by SAP`);
                }}
              />
            ))}
          </div>
        )}
      </section>

      <BatchDetailDrawer batchId={manageBatchId} onOpenChange={(open) => !open && setManageBatchId(null)} />

      <AlertModal
        open={sendBatch != null}
        onOpenChange={(open) => !open && setSendId(null)}
        variant="alert"
        headline={sendBatch ? `Send "${sendBatch.name}" to SAP now?` : ""}
        description="This sends every price change in the batch to SAP immediately. New edits after sending create fresh pending changes."
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setSendId(null)}>Cancel</Button>
            <Button
              variant="primary"
              iconLeft={Send}
              onClick={() => {
                if (sendBatch) {
                  submitBatch(sendBatch.id);
                  toast.success(`Batch "${sendBatch.name}" sent to SAP`);
                }
                setSendId(null);
              }}
            >
              Send to SAP
            </Button>
          </div>
        }
      />

      <Modal
        open={scheduleId != null}
        onOpenChange={(open) => !open && setScheduleId(null)}
        title="Schedule send"
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setScheduleId(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!scheduleDate}
              onClick={() => {
                const iso = toIso(scheduleDate);
                if (scheduleId && iso) {
                  scheduleBatch(scheduleId, iso);
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
          <DatePicker mode="single" value={scheduleDate} onChange={setScheduleDate} min={new Date()} aria-label="Send date" />
        </div>
      </Modal>
    </div>
  );
}
