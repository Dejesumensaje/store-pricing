"use client";

import { create } from "zustand";
import { PricingItem, Override, Batch, OverrideStatus, PriceField, PricingCategory } from "@/types/pricing";
import { mockItems, mockOverrides, mockBatches } from "@/lib/mock-data";

type PricingStore = {
  // One unified catalog — every item carries its own price type (category_type).
  items: PricingItem[];
  overrides: Override[];
  batches: Batch[];
  // Price edits — every commit upserts a pending override automatically
  updateBasePrice: (itemId: string, newPrice: number | null) => void;
  updateRetailPrice: (itemId: string, qty: number, price: number | null) => void;
  updateFuelSaver: (itemId: string, value: number | null) => void;
  updateFuelSaverDates: (itemId: string, start: string | null, end: string | null) => void;
  updatePriceType: (itemId: string, type: PricingCategory) => void;
  updateAllowanceDates: (itemId: string, start: string | null, end: string | null) => void;
  // Accept an item as-is (no price change) — clears it from the HQ queue.
  acceptNoChange: (itemId: string) => void;
  // Set/unset an item's reviewed flag (powers the "Keep HQ price" undo).
  setReviewed: (itemId: string, value: boolean) => void;
  // Pending list / batches
  removeFromLooseTray: (overrideId: string) => void;
  removeFromBatch: (overrideId: string) => void;
  addToBatch: (batchId: string, overrideIds: string[]) => void;
  moveOverrideToBatch: (overrideId: string, targetBatchId: string) => void;
  // Every batch is born scheduled — date + time is required, no draft state.
  createBatch: (name: string, overrideIds: string[], scheduledAt: string) => void;
  scheduleBatch: (batchId: string, scheduledAt: string) => void;
  submitBatch: (batchId: string) => void;
  confirmBatch: (batchId: string) => void;
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

  // A price of $0 (or negative) isn't a valid shelf price — treat it as "no
  // decision" so an empty field or a 100%-off reduction never commits "→ $0.00".
  if (newPrice != null && newPrice <= 0) newPrice = null;

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
        o.id === id ? { ...o, newPrice, qty: normalizedQty, updatedAt: Date.now() } : o
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
    updatedAt: Date.now(),
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
  items: mockItems,
  overrides: mockOverrides,
  batches: mockBatches,

  updateBasePrice: (itemId, newPrice) =>
    set((state) => {
      const source = state.items.find((i) => i.id === itemId);
      if (!source) return {};
      // Line price: items in a line share one price — editing one applies to all.
      const groupIds = source.linePriceGroup
        ? state.items.filter((i) => i.linePriceGroup === source.linePriceGroup).map((i) => i.id)
        : [itemId];
      let overrides = state.overrides;
      let batches = state.batches;
      const statusById: Record<string, OverrideStatus | undefined> = {};
      for (const id of groupIds) {
        const it = state.items.find((i) => i.id === id);
        if (!it) continue;
        const r = upsertOverride({ overrides, batches }, it, "base", newPrice);
        overrides = r.overrides;
        batches = r.batches;
        statusById[id] = r.status;
      }
      return {
        items: state.items.map((item) => {
          if (!groupIds.includes(item.id)) return item;
          let next: PricingItem = { ...item, newBasePrice: newPrice, baseOverrideStatus: statusById[item.id] };
          // Deciding on an HQ rec (accept or override) reviews it for good — it
          // must not return to the queue when the override later goes submitted.
          if (newPrice != null && item.hqReviewPending) next.reviewed = true;
          if (newPrice != null && item.category_type === "no_change") {
            // Editing a "no change" item IS a base price change — promote it,
            // remembering the original type so we can revert if the edit is cleared.
            next = { ...next, category_type: "base", autoTypedFrom: "no_change" };
          } else if (newPrice == null && item.autoTypedFrom != null) {
            // Edit cleared — revert the auto-switch once nothing else overrides the item.
            const stillOverridden = overrides.some((o) => o.itemId === item.id);
            if (!stillOverridden) next = { ...next, category_type: item.autoTypedFrom, autoTypedFrom: null };
          }
          return withOverrideFlags(next);
        }),
        overrides,
        batches,
      };
    }),

  updateRetailPrice: (itemId, qty, price) =>
    set((state) => {
      const source = state.items.find((i) => i.id === itemId);
      if (!source) return {};
      const normQty = price == null ? null : Math.max(1, Math.floor(qty) || 1);
      const { overrides, batches, status } = upsertOverride(state, source, "retail", price, normQty ?? undefined);
      // A promo MUST have a start + end window — default to a one-week run if the
      // item doesn't already carry one.
      const today = new Date();
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      const weekOut = new Date(today.getTime() + 6 * 86400000);
      return {
        items: state.items.map((item) =>
          item.id === itemId
            ? withOverrideFlags({
                ...item,
                newRetailQty: normQty,
                newRetailPrice: price,
                retailOverrideStatus: status,
                // Deciding on an HQ rec reviews it for good (see updateBasePrice).
                reviewed: price != null && item.hqReviewPending ? true : item.reviewed,
                allowanceStartDate: price != null ? item.allowanceStartDate ?? iso(today) : item.allowanceStartDate,
                allowanceEndDate: price != null ? item.allowanceEndDate ?? iso(weekOut) : item.allowanceEndDate,
              })
            : item
        ),
        overrides,
        batches,
      };
    }),

  updateFuelSaver: (itemId, value) =>
    set((state) => ({
      items: state.items.map((item) => {
        if (item.id !== itemId) return item;
        // Clearing the fuel saver clears its dates too; setting one defaults the
        // window to a one-week run if none is set yet.
        if (value == null || value <= 0) {
          return { ...item, fuelSaver: null, fuelSaverStartDate: null, fuelSaverEndDate: null };
        }
        const today = new Date();
        const iso = (d: Date) => d.toISOString().slice(0, 10);
        const weekOut = new Date(today.getTime() + 6 * 86400000);
        return {
          ...item,
          fuelSaver: value,
          fuelSaverStartDate: item.fuelSaverStartDate ?? iso(today),
          fuelSaverEndDate: item.fuelSaverEndDate ?? iso(weekOut),
        };
      }),
    })),

  updateFuelSaverDates: (itemId, start, end) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === itemId ? { ...item, fuelSaverStartDate: start, fuelSaverEndDate: end } : item
      ),
    })),

  // Switching an item's price type. Moving to a temporary allowance ensures the
  // retail/allowance fields exist so the drawer can render them.
  updatePriceType: (itemId, type) =>
    set((state) => ({
      items: state.items.map((item) => {
        if (item.id !== itemId) return item;
        // Picking a type by hand is an explicit choice — drop the auto-switch memory.
        if (type === "temporary_allowance") {
          // Default the promo window to a one-week run starting today so the
          // yellow tag has dates the moment a plain item is converted.
          const today = new Date();
          const iso = (d: Date) => d.toISOString().slice(0, 10);
          const weekOut = new Date(today.getTime() + 6 * 86400000);
          return {
            ...item,
            category_type: type,
            autoTypedFrom: null,
            currentRetailPrice: item.currentRetailPrice ?? item.currentBasePrice,
            allowanceCost: item.allowanceCost ?? Math.round(item.cost * 0.8 * 100) / 100,
            recommendedRetailPrice: item.recommendedRetailPrice ?? Math.round(item.currentBasePrice * 0.85 * 100) / 100,
            allowanceStartDate: item.allowanceStartDate ?? iso(today),
            allowanceEndDate: item.allowanceEndDate ?? iso(weekOut),
          };
        }
        return { ...item, category_type: type, autoTypedFrom: null };
      }),
    })),

  updateAllowanceDates: (itemId, start, end) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === itemId ? { ...item, allowanceStartDate: start, allowanceEndDate: end } : item
      ),
    })),

  acceptNoChange: (itemId) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === itemId ? { ...item, reviewed: true } : item)),
    })),

  setReviewed: (itemId, value) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === itemId ? { ...item, reviewed: value } : item)),
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
        items: state.items.map(clear),
      };
    }),

  // Remove from batch → back to pending (stays in the tray)
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
        items: applyStatusToItems(state.items, affected, "pending"),
      };
    }),

  addToBatch: (batchId, overrideIds) =>
    set((state) => {
      const affected = state.overrides.filter((o) => overrideIds.includes(o.id));
      return {
        overrides: state.overrides.map((o) =>
          overrideIds.includes(o.id) ? { ...o, status: "in_batch", batchId } : o
        ),
        // An override lives in exactly one batch: add to the target and strip it
        // from any other batch (so re-assigning an already-batched change moves it).
        batches: state.batches.map((b) =>
          b.id === batchId
            ? { ...b, overrideIds: [...new Set([...b.overrideIds, ...overrideIds])] }
            : { ...b, overrideIds: b.overrideIds.filter((id) => !overrideIds.includes(id)) }
        ),
        items: applyStatusToItems(state.items, affected, "in_batch"),
      };
    }),

  // Move an override from its current batch to another draft batch (stays in_batch).
  moveOverrideToBatch: (overrideId, targetBatchId) =>
    set((state) => ({
      overrides: state.overrides.map((o) =>
        o.id === overrideId ? { ...o, status: "in_batch", batchId: targetBatchId } : o
      ),
      batches: state.batches.map((b) => {
        if (b.id === targetBatchId) {
          return { ...b, overrideIds: [...new Set([...b.overrideIds, overrideId])] };
        }
        if (b.overrideIds.includes(overrideId)) {
          return { ...b, overrideIds: b.overrideIds.filter((id) => id !== overrideId) };
        }
        return b;
      }),
    })),

  createBatch: (name, overrideIds, scheduledAt) =>
    set((state) => {
      const newBatch: Batch = {
        id: `batch-${Date.now()}`,
        name,
        status: "scheduled",
        overrideIds,
        createdAt: new Date().toISOString(),
        scheduledAt,
      };
      const affected = state.overrides.filter((o) => overrideIds.includes(o.id));
      return {
        // Strip the seeded ids from any batch they were already in — one override
        // belongs to exactly one batch (so creating a batch can move a change).
        batches: [
          ...state.batches.map((b) => ({ ...b, overrideIds: b.overrideIds.filter((id) => !overrideIds.includes(id)) })),
          newBatch,
        ],
        overrides: state.overrides.map((o) =>
          overrideIds.includes(o.id) ? { ...o, status: "in_batch", batchId: newBatch.id } : o
        ),
        items: applyStatusToItems(state.items, affected, "in_batch"),
      };
    }),

  // Schedule a draft batch to send at a future date/time (overrides stay in_batch).
  scheduleBatch: (batchId, scheduledAt) =>
    set((state) => ({
      batches: state.batches.map((b) =>
        b.id === batchId ? { ...b, status: "scheduled", scheduledAt } : b
      ),
    })),

  submitBatch: (batchId) =>
    set((state) => {
      const affected = state.overrides.filter((o) => o.batchId === batchId);
      return {
        batches: state.batches.map((b) =>
          b.id === batchId ? { ...b, status: "submitted", submittedAt: new Date().toISOString() } : b
        ),
        overrides: state.overrides.map((o) => (o.batchId === batchId ? { ...o, status: "submitted" } : o)),
        items: applyStatusToItems(state.items, affected, "submitted"),
      };
    }),

  // Post-SAP acknowledgment: a submitted batch is confirmed back by SAP.
  confirmBatch: (batchId) =>
    set((state) => {
      const affected = state.overrides.filter((o) => o.batchId === batchId);
      const sapReference = `SAP-${batchId.replace(/^batch-/, "").slice(-6).toUpperCase()}`;
      return {
        batches: state.batches.map((b) =>
          b.id === batchId
            ? { ...b, status: "confirmed", confirmedAt: new Date().toISOString(), sapReference }
            : b
        ),
        overrides: state.overrides.map((o) => (o.batchId === batchId ? { ...o, status: "confirmed" } : o)),
        items: applyStatusToItems(state.items, affected, "confirmed"),
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
