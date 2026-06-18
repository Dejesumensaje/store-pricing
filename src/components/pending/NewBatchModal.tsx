"use client";

import { useMemo, useState, useEffect } from "react";
import { Button, Modal, Checkbox, Input, SearchInput } from "@dejesumensaje/converge-ds-experimental";
import { Override } from "@/types/pricing";
import { fmt, fmtQtyPrice } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/pricing-meta";

export function toggleSetItem(
  prev: Set<string>,
  id: string,
  checked: boolean | "indeterminate"
): Set<string> {
  const next = new Set(prev);
  checked === true ? next.add(id) : next.delete(id);
  return next;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pending overrides available to group into the new batch. */
  candidates: Override[];
  /** Override ids pre-checked when the modal opens. */
  initialSelectedIds?: string[];
  onCreate: (name: string, overrideIds: string[]) => void;
};

// Shared by the pending-changes drawer and the Loose Tray page.
export function NewBatchModal({ open, onOpenChange, candidates, initialSelectedIds, onCreate }: Props) {
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setName("");
      setSearch("");
      setChecked(new Set(initialSelectedIds ?? []));
    }
  }, [open, initialSelectedIds]);

  const filtered = useMemo(() => {
    if (!search.trim()) return candidates;
    const q = search.toLowerCase();
    return candidates.filter((o) => o.itemName.toLowerCase().includes(q));
  }, [candidates, search]);

  const handleCreate = () => {
    if (!name.trim() || checked.size === 0) return;
    onCreate(name.trim(), Array.from(checked));
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New batch"
      size="md"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreate} disabled={!name.trim() || checked.size === 0}>
            Create batch ({checked.size} item{checked.size !== 1 ? "s" : ""})
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Batch name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Tuesday, ad prep"
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Select items to include</p>
          <SearchInput
            value={search}
            onValueChange={setSearch}
            aria-label="Search items for batch"
            className="mb-2 w-full"
          />
          {candidates.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No pending items available.</p>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
              {filtered.map((ov) => (
                <label
                  key={ov.id}
                  className={`flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 transition-colors ${
                    checked.has(ov.id) ? "bg-blue-50" : ""
                  }`}
                >
                  <Checkbox
                    checked={checked.has(ov.id)}
                    onCheckedChange={(c) => setChecked((prev) => toggleSetItem(prev, ov.id, c))}
                    aria-label={ov.itemName}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{ov.itemName}</p>
                    <p className="text-xs text-gray-400">
                      {CATEGORY_LABELS[ov.changeType]} · {ov.priceField === "base" ? "Base" : "Retail"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm shrink-0">
                    <span className="text-gray-400">{fmt(ov.currentPrice)}</span>
                    <span className="text-gray-300">→</span>
                    <span className="font-semibold text-gray-700">{fmtQtyPrice(ov.qty, ov.newPrice)}</span>
                  </div>
                </label>
              ))}
            </div>
          )}
          {checked.size > 0 && (
            <p className="text-xs text-blue-600 mt-2">
              {checked.size} item{checked.size !== 1 ? "s" : ""} selected
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
