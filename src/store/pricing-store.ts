"use client";

import { create } from "zustand";
import { PricingItem, Override, Batch, OverrideStatus, PriceField } from "@/types/pricing";
import {
  mockItems,
  mockTempAllowanceItems,
  mockEdlpItems,
  mockNoChangeItems,
  mockNewDiscontinuedItems,
  mockOverrides,
  mockBatches,
} from "@/lib/mock-data";

type PricingStore = {
  baseItems: PricingItem[];
  tempAllowanceItems: PricingItem[];
  edlpItems: PricingItem[];
  noChangeItems: PricingItem[];
  newDiscontinuedItems: PricingItem[];
  overrides: Override[];
  batches: Batch[];
  // UI
  isPendingDrawerOpen: boolean;
  setPendingDrawerOpen: (open: boolean) => void;
  // Price edits — every commit upserts a pending override automatically
  updateBasePrice: (itemId: string, newPrice: number | null) => void;
  updateRetailPrice: (itemId: string, qty: number, price: number | null) => void;
  updateFuelSaver: (itemId: string, value: number | null) => void;
  // Pending list / batches
  removeFromLooseTray: (overrideId: string) => void;
  removeFromBatch: (overrideId: string) => void;
  addToBatch: (batchId: string, overrideIds: string[]) => void;
  createBatch: (name: string, overrideIds: string[]) => void;
  submitBatch: (batchId: string) => void;
  submitAll: () => void;
};

const isActive = (s?: OverrideStatus) => s === "pending" || s === "in_batch";

function withOverrideFlags(item: PricingItem): PricingItem {
  return { ...item, hasOverride: isActive(item.baseOverrideStatus) || isActive(item.retailOverrideStatus) };
}

// Upsert/remove the override for one price field of an item. Override ids are
// deterministic (`${itemId}:${field}`), so re-edits update in place — including
// overrides already grouped in a draft batch (the batch sees the new price).
function upsertOverride(
  state: { overrides: Override[]; batches: Batch[] },
  item: PricingItem,
  field: PriceField,
  newPrice: number | null,
  qty?: number
): { overrides: Override[]; batches: Batch[]; status: OverrideStatus | undefined } {
  const id = `${item.id}:${field}`;
  const existing = state.overrides.find((o) => o.id === id);

  if (newPrice == null) {
    return {
      overrides: state.overrides.filter((o) => o.id !== id),
      batches: state.batches.map((b) =>
        b.overrideIds.includes(id) ? { ...b, overrideIds: b.overrideIds.filter((oid) => oid !== id) } : b
      ),
      status: undefined,
    };
  }

  const normalizedQty = qty != null && qty > 1 ? qty : undefined;

  if (existing && isActive(existing.status)) {
    return {
      overrides: state.overrides.map((o) =>
        o.id === id ? { ...o, newPrice, qty: normalizedQty } : o
      ),
      batches: state.batches,
      status: existing.status,
    };
  }

  // No override yet, or the previous one was already submitted → fresh pending.
  const fresh: Override = {
    id,
    itemId: item.id,
    itemName: item.name,
    changeType: item.category_type,
    priceField: field,
    currentPrice: field === "base" ? item.currentBasePrice : item.currentRetailPrice ?? item.currentBasePrice,
    newPrice,
    qty: normalizedQty,
    status: "pending",
  };
  return {
    overrides: [...state.overrides.filter((o) => o.id !== id), fresh],
    batches: state.batches,
    status: "pending",
  };
}

// Reflect override statuses back onto the items so cells can render
// "sent"/highlight states without per-cell lookups.
function applyStatusToItems(
  items: PricingItem[],
  affected: Override[],
  status: OverrideStatus
): PricingItem[] {
  return items.map((item) => {
    let next = item;
    for (const ov of affected) {
      if (ov.itemId !== item.id) continue;
      next =
        ov.priceField === "base"
          ? { ...next, baseOverrideStatus: status }
          : { ...next, retailOverrideStatus: status };
    }
    return next === item ? item : withOverrideFlags(next);
  });
}

export const usePricingStore = create<PricingStore>((set) => ({
  baseItems: mockItems,
  tempAllowanceItems: mockTempAllowanceItems,
  edlpItems: mockEdlpItems,
  noChangeItems: mockNoChangeItems,
  newDiscontinuedItems: mockNewDiscontinuedItems,
  overrides: mockOverrides,
  batches: mockBatches,

  isPendingDrawerOpen: false,
  setPendingDrawerOpen: (open) => set({ isPendingDrawerOpen: open }),

  updateBasePrice: (itemId, newPrice) =>
    set((state) => {
      // Base price is shared across views; the override's changeType comes from
      // the catalog the item primarily belongs to (base → edlp → TA).
      const source =
        state.baseItems.find((i) => i.id === itemId) ??
        state.edlpItems.find((i) => i.id === itemId) ??
        state.tempAllowanceItems.find((i) => i.id === itemId);
      if (!source) return {};
      const { overrides, batches, status } = upsertOverride(state, source, "base", newPrice);
      const patch = (item: PricingItem) =>
        item.id === itemId
          ? withOverrideFlags({ ...item, newBasePrice: newPrice, baseOverrideStatus: status })
          : item;
      return {
        baseItems: state.baseItems.map(patch),
        edlpItems: state.edlpItems.map(patch),
        tempAllowanceItems: state.tempAllowanceItems.map(patch),
        overrides,
        batches,
      };
    }),

  updateRetailPrice: (itemId, qty, price) =>
    set((state) => {
      const source = state.tempAllowanceItems.find((i) => i.id === itemId);
      if (!source) return {};
      const normQty = price == null ? null : Math.max(1, Math.floor(qty) || 1);
      const { overrides, batches, status } = upsertOverride(
        state,
        source,
        "retail",
        price,
        normQty ?? undefined
      );
      return {
        tempAllowanceItems: state.tempAllowanceItems.map((item) =>
          item.id === itemId
            ? withOverrideFlags({ ...item, newRetailQty: normQty, newRetailPrice: price, retailOverrideStatus: status })
            : item
        ),
        overrides,
        batches,
      };
    }),

  updateFuelSaver: (itemId, value) =>
    set((state) => ({
      tempAllowanceItems: state.tempAllowanceItems.map((item) =>
        item.id === itemId ? { ...item, fuelSaver: value } : item
      ),
    })),

  // Discarding a pending change also clears the edit from the table cell.
  removeFromLooseTray: (overrideId) =>
    set((state) => {
      const ov = state.overrides.find((o) => o.id === overrideId);
      const clear = (item: PricingItem) => {
        if (!ov || item.id !== ov.itemId) return item;
        const next =
          ov.priceField === "base"
            ? { ...item, newBasePrice: null, baseOverrideStatus: undefined }
            : { ...item, newRetailPrice: null, newRetailQty: null, retailOverrideStatus: undefined };
        return withOverrideFlags(next);
      };
      return {
        overrides: state.overrides.filter((o) => o.id !== overrideId),
        batches: state.batches.map((b) => ({
          ...b,
          overrideIds: b.overrideIds.filter((id) => id !== overrideId),
        })),
        baseItems: state.baseItems.map(clear),
        edlpItems: state.edlpItems.map(clear),
        tempAllowanceItems: state.tempAllowanceItems.map(clear),
      };
    }),

  // Remove from batch → back to pending (stays in loose tray)
  removeFromBatch: (overrideId) =>
    set((state) => {
      const affected = state.overrides.filter((o) => o.id === overrideId);
      return {
        overrides: state.overrides.map((o) =>
          o.id === overrideId ? { ...o, status: "pending", batchId: undefined } : o
        ),
        batches: state.batches.map((b) => ({
          ...b,
          overrideIds: b.overrideIds.filter((id) => id !== overrideId),
        })),
        baseItems: applyStatusToItems(state.baseItems, affected, "pending"),
        edlpItems: applyStatusToItems(state.edlpItems, affected, "pending"),
        tempAllowanceItems: applyStatusToItems(state.tempAllowanceItems, affected, "pending"),
      };
    }),

  addToBatch: (batchId, overrideIds) =>
    set((state) => {
      const affected = state.overrides.filter((o) => overrideIds.includes(o.id));
      return {
        overrides: state.overrides.map((o) =>
          overrideIds.includes(o.id) ? { ...o, status: "in_batch", batchId } : o
        ),
        batches: state.batches.map((b) =>
          b.id === batchId
            ? { ...b, overrideIds: [...new Set([...b.overrideIds, ...overrideIds])] }
            : b
        ),
        baseItems: applyStatusToItems(state.baseItems, affected, "in_batch"),
        edlpItems: applyStatusToItems(state.edlpItems, affected, "in_batch"),
        tempAllowanceItems: applyStatusToItems(state.tempAllowanceItems, affected, "in_batch"),
      };
    }),

  createBatch: (name, overrideIds) =>
    set((state) => {
      const newBatch: Batch = {
        id: `batch-${Date.now()}`,
        name,
        status: "draft",
        overrideIds,
        createdAt: new Date().toISOString(),
      };
      const affected = state.overrides.filter((o) => overrideIds.includes(o.id));
      return {
        batches: [...state.batches, newBatch],
        overrides: state.overrides.map((o) =>
          overrideIds.includes(o.id) ? { ...o, status: "in_batch", batchId: newBatch.id } : o
        ),
        baseItems: applyStatusToItems(state.baseItems, affected, "in_batch"),
        edlpItems: applyStatusToItems(state.edlpItems, affected, "in_batch"),
        tempAllowanceItems: applyStatusToItems(state.tempAllowanceItems, affected, "in_batch"),
      };
    }),

  submitBatch: (batchId) =>
    set((state) => {
      const affected = state.overrides.filter((o) => o.batchId === batchId);
      return {
        batches: state.batches.map((b) => (b.id === batchId ? { ...b, status: "submitted" } : b)),
        overrides: state.overrides.map((o) =>
          o.batchId === batchId ? { ...o, status: "submitted" } : o
        ),
        baseItems: applyStatusToItems(state.baseItems, affected, "submitted"),
        edlpItems: applyStatusToItems(state.edlpItems, affected, "submitted"),
        tempAllowanceItems: applyStatusToItems(state.tempAllowanceItems, affected, "submitted"),
      };
    }),

  submitAll: () =>
    set((state) => {
      const affected = state.overrides.filter((o) => o.status !== "submitted");
      return {
        overrides: state.overrides.map((o) => ({ ...o, status: "submitted" as const })),
        batches: state.batches.map((b) => ({ ...b, status: "submitted" as const })),
        baseItems: applyStatusToItems(state.baseItems, affected, "submitted"),
        edlpItems: applyStatusToItems(state.edlpItems, affected, "submitted"),
        tempAllowanceItems: applyStatusToItems(state.tempAllowanceItems, affected, "submitted"),
      };
    }),
}));

// ─── Selectors ────────────────────────────────────────────────────────────────
// selectPendingOverrides returns a fresh array — consume it with
// useShallow(...) from "zustand/react/shallow" to avoid re-render loops.
export const selectPendingOverrides = (s: PricingStore) =>
  s.overrides.filter((o) => o.status === "pending");
export const selectPendingCount = (s: PricingStore) =>
  s.overrides.reduce((n, o) => n + (o.status === "pending" ? 1 : 0), 0);
