"use client";

import { Modal, Button } from "@dejesumensaje/converge-ds-experimental";
import { Package, ArrowRight, Plus } from "lucide-react";
import { Batch } from "@/types/pricing";

// One batch-assignment surface, shared by every entry point (the item drawer's
// Done, the bulk ActionBar, and the Review worklist) so "add to a batch" looks
// and reads the same everywhere. Presentational: it emits the choice; the caller
// performs the assignment and closes.
export function BatchPickerModal({
  open,
  onOpenChange,
  openBatches,
  count,
  title = "Add to a batch?",
  description,
  onAddToBatch,
  onNewBatch,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  openBatches: Batch[];
  /** How many item changes are being assigned (for the copy). */
  count: number;
  title?: string;
  description?: string;
  /** Assign to an existing batch. The caller closes the modal. */
  onAddToBatch: (batchId: string) => void;
  /** Start a new (scheduled) batch seeded with these changes. The caller closes. */
  onNewBatch: () => void;
}) {
  const noun = count === 1 ? "this change" : `these ${count} changes`;
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="sm"
      className="max-md:!max-w-[calc(100vw-1.5rem)]"
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-600">
          {description ?? `Add ${noun} to a batch to control when it reaches SAP.`}
        </p>

        {openBatches.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-gray-500">Add to a batch</p>
            {openBatches.map((b) => {
              const items = new Set(b.overrideIds.map((id) => id.split(":")[0])).size;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onAddToBatch(b.id)}
                  className="group flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-brand/40 hover:bg-brand/5"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Package className="size-4 shrink-0 text-brand" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="truncate text-sm font-medium text-gray-900">{b.name}</span>
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        {items} item{items !== 1 ? "s" : ""}
                      </span>
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-gray-300 transition-colors group-hover:text-brand" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        )}

        <Button variant="secondary" iconLeft={Plus} onClick={onNewBatch}>
          Create a new batch with this change
        </Button>
      </div>
    </Modal>
  );
}
