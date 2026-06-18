"use client";

import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Button, Badge, AlertModal, useToast } from "@dejesumensaje/converge-ds-experimental";
import { Plus, Send, Layers } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { AppHeader } from "@/components/layout/AppHeader";
import { BatchCard } from "@/components/batches/BatchCard";
import { BatchDetailDrawer } from "@/components/batches/BatchDetailDrawer";
import { NewBatchModal } from "@/components/pending/NewBatchModal";
import { usePricingStore, selectPendingOverrides } from "@/store/pricing-store";
import { buildItemsById, aggregateBatchImpact } from "@/lib/batch-utils";

export default function BatchesPage() {
  const toast = useToast();

  const batches = usePricingStore((s) => s.batches);
  const overrides = usePricingStore((s) => s.overrides);
  const pending = usePricingStore(useShallow(selectPendingOverrides));
  const baseItems = usePricingStore((s) => s.baseItems);
  const tempAllowanceItems = usePricingStore((s) => s.tempAllowanceItems);
  const edlpItems = usePricingStore((s) => s.edlpItems);
  const noChangeItems = usePricingStore((s) => s.noChangeItems);
  const newDiscontinuedItems = usePricingStore((s) => s.newDiscontinuedItems);
  const createBatch = usePricingStore((s) => s.createBatch);
  const submitBatch = usePricingStore((s) => s.submitBatch);
  const confirmBatch = usePricingStore((s) => s.confirmBatch);

  const [manageBatchId, setManageBatchId] = useState<string | null>(null);
  const [newBatchOpen, setNewBatchOpen] = useState(false);
  const [sendAllId, setSendAllId] = useState<string | null>(null);

  const itemsById = useMemo(
    () => buildItemsById([baseItems, tempAllowanceItems, edlpItems, noChangeItems, newDiscontinuedItems]),
    [baseItems, tempAllowanceItems, edlpItems, noChangeItems, newDiscontinuedItems]
  );

  const impacts = useMemo(
    () => new Map(batches.map((b) => [b.id, aggregateBatchImpact(b, overrides, itemsById)])),
    [batches, overrides, itemsById]
  );

  const counts = useMemo(() => {
    const c = { draft: 0, submitted: 0, confirmed: 0 };
    for (const b of batches) c[b.status] += 1;
    return c;
  }, [batches]);

  const pendingCount = pending.length;
  const sendAllBatch = batches.find((b) => b.id === sendAllId) ?? null;

  return (
    <AppShell>
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-gray-50">
        <AppHeader alertCount={pendingCount} />

        <main className="flex-1 px-8 py-6 max-w-[1400px] mx-auto w-full">
          <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Batches</h1>
              <p className="mt-1 text-sm text-gray-500">
                Group reviewed price changes into batches and send them to SAP.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Badge tone="neutral">{counts.draft} draft</Badge>
                <Badge tone="warning">{counts.submitted} submitted</Badge>
                <Badge tone="success">{counts.confirmed} confirmed</Badge>
              </div>
            </div>
            <Button variant="primary" iconLeft={Plus} onClick={() => setNewBatchOpen(true)}>
              New batch{pendingCount > 0 ? ` (${pendingCount} pending)` : ""}
            </Button>
          </div>

          {batches.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white py-20 text-gray-400">
              <Layers className="size-10 stroke-1" />
              <p className="text-sm font-medium">No batches yet</p>
              <p className="max-w-xs text-center text-xs">
                Create a batch to group price changes for bulk submission to SAP.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {batches.map((b) => (
                <BatchCard
                  key={b.id}
                  batch={b}
                  impact={impacts.get(b.id)!}
                  onManage={() => setManageBatchId(b.id)}
                  onSubmit={() => setSendAllId(b.id)}
                  onConfirm={() => {
                    confirmBatch(b.id);
                    toast.success(`Batch "${b.name}" confirmed by SAP`);
                  }}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      <BatchDetailDrawer
        batchId={manageBatchId}
        onOpenChange={(open) => !open && setManageBatchId(null)}
      />

      <NewBatchModal
        open={newBatchOpen}
        onOpenChange={setNewBatchOpen}
        candidates={pending}
        onCreate={(name, ids) => {
          createBatch(name, ids);
          toast.success(`Batch "${name}" created`, {
            description: `${ids.length} price change${ids.length !== 1 ? "s" : ""} grouped`,
          });
        }}
      />

      <AlertModal
        open={sendAllBatch != null}
        onOpenChange={(open) => !open && setSendAllId(null)}
        variant="alert"
        headline={sendAllBatch ? `Send "${sendAllBatch.name}" to SAP?` : ""}
        description="This sends every price change in the batch to SAP. New edits after sending create fresh pending changes."
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setSendAllId(null)}>Cancel</Button>
            <Button
              variant="primary"
              iconLeft={Send}
              onClick={() => {
                if (sendAllBatch) {
                  submitBatch(sendAllBatch.id);
                  toast.success(`Batch "${sendAllBatch.name}" sent to SAP`);
                }
                setSendAllId(null);
              }}
            >
              Send to SAP
            </Button>
          </div>
        }
      />
    </AppShell>
  );
}
