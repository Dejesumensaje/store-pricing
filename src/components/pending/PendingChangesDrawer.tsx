"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import { Drawer, Button, Badge, AlertModal, useToast } from "@dejesumensaje/converge-ds-experimental";
import { usePricingStore, selectPendingOverrides } from "@/store/pricing-store";
import { NewBatchModal } from "./NewBatchModal";
import { fmt, fmtQtyPrice } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/pricing-meta";
import { Trash2, Send, Plus, Inbox } from "lucide-react";

// Global pending-changes drawer, mounted once in Providers. Every committed
// price edit lands here instantly; heavier batch management lives in /loose-tray.
export function PendingChangesDrawer() {
  const router = useRouter();
  const toast = useToast();

  const open = usePricingStore((s) => s.isPendingDrawerOpen);
  const setOpen = usePricingStore((s) => s.setPendingDrawerOpen);
  const pending = usePricingStore(useShallow(selectPendingOverrides));
  const totalUnsent = usePricingStore(
    (s) => s.overrides.filter((o) => o.status !== "submitted").length
  );
  const removeFromLooseTray = usePricingStore((s) => s.removeFromLooseTray);
  const createBatch = usePricingStore((s) => s.createBatch);
  const submitAll = usePricingStore((s) => s.submitAll);

  const [newBatchOpen, setNewBatchOpen] = useState(false);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);

  const handleSendAll = () => {
    const count = totalUnsent;
    submitAll();
    setConfirmSendOpen(false);
    setOpen(false);
    toast.success(`${count} price change${count !== 1 ? "s" : ""} sent to SAP`);
  };

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title="Pending changes"
        size="md"
        headerActions={
          pending.length > 0 ? <Badge tone="warning" size="sm">{pending.length}</Badge> : undefined
        }
        footer={
          <div className="flex items-center gap-2">
            <Button
              variant="tertiary"
              onClick={() => {
                setOpen(false);
                router.push("/loose-tray");
              }}
            >
              Manage in Loose Tray
            </Button>
            <Button
              variant="secondary"
              iconLeft={Plus}
              disabled={pending.length === 0}
              onClick={() => setNewBatchOpen(true)}
            >
              Create batch
            </Button>
            <Button
              variant="primary"
              iconLeft={Send}
              disabled={totalUnsent === 0}
              onClick={() => setConfirmSendOpen(true)}
            >
              Send all{totalUnsent > 0 ? ` (${totalUnsent})` : ""}
            </Button>
          </div>
        }
      >
        {pending.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-gray-400">
            <Inbox className="size-10 stroke-1" />
            <p className="text-sm font-medium">No pending changes</p>
            <p className="text-xs text-center max-w-[220px]">
              Edit a price in any table and it shows up here, ready to batch or send.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col">
            {pending.map((ov) => (
              <li
                key={ov.id}
                className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{ov.itemName}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
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
                <Button
                  variant="tertiary"
                  size="sm"
                  iconLeft={Trash2}
                  aria-label={`Discard change for ${ov.itemName}`}
                  onClick={() => removeFromLooseTray(ov.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </Drawer>

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
        open={confirmSendOpen}
        onOpenChange={setConfirmSendOpen}
        variant="alert"
        headline={`Send ${totalUnsent} price change${totalUnsent !== 1 ? "s" : ""} to SAP?`}
        description="This sends every pending and batched change. New edits after sending create fresh pending changes."
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setConfirmSendOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" iconLeft={Send} onClick={handleSendAll}>
              Send all
            </Button>
          </div>
        }
      />
    </>
  );
}
