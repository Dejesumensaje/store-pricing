"use client";

import { create } from "zustand";
import { PricingItem, Override, Batch, OverrideStatus, PriceField, PricingCategory, StoreOriginReason } from "@/types/pricing";
import { buildInitialStoreData, StoreSlice } from "@/lib/mock-data";
import { STORES, DEFAULT_STORE_ID, storeById, Store } from "@/lib/store-config";
import { hqReviewNeeded } from "@/lib/item-status";
import { applyFanoutToSlice, buildFanoutSources, revertFanoutInSlice } from "@/lib/store-fanout";
import { EdlpException, batchBlockedByEdlpCeiling } from "@/lib/edlp-ceiling";
import { buildItemsById } from "@/lib/batch-utils";

type PricingStore = {
  // The store currently in view. Its items/overrides/batches are the top-level
  // fields below (the "working set"); every other store sits in `stash`.
  activeStoreId: string;
  stash: Record<string, StoreSlice>;
  setActiveStore: (id: string) => void;
  items: PricingItem[];
  overrides: Override[];
  batches: Batch[];
  // Per-store EDLP ceiling exception, granted by AVP – Pricing. Lives outside
  // the stash working-set mechanism — it's keyed by storeId directly, so it
  // survives store switching. Store users can only view it (see
  // SettingsDrawer); there is no grant/edit action here.
  edlpExceptions: Record<string, EdlpException>;
  updateBasePrice: (itemId: string, newPrice: number | null, qty?: number) => void;
  updateRetailPrice: (itemId: string, qty: number, price: number | null) => void;
  updateFuelSaver: (itemId: string, value: number | null) => void;
  updateFuelSaverDates: (itemId: string, start: string | null, end: string | null) => void;
  updatePriceType: (itemId: string, type: PricingCategory) => void;
  updateAllowanceDates: (itemId: string, start: string | null, end: string | null) => void;
  // Accept an item as-is (no price change) — clears it from the HQ queue.
  acceptNoChange: (itemId: string) => void;
  // Set the director's chosen reason for a store-originated change (cost/competitor).
  setChangeReason: (itemId: string, reason: StoreOriginReason) => void;
  // Set/unset an item's reviewed flag (powers the "Keep HQ price" undo).
  setReviewed: (itemId: string, value: boolean) => void;
  removeFromLooseTray: (overrideId: string) => void;
  removeFromBatch: (overrideId: string) => void;
  addToBatch: (batchId: string, overrideIds: string[]) => void;
  moveOverrideToBatch: (overrideId: string, targetBatchId: string) => void;
  // Every batch is born scheduled — date + time is required, no draft state.
  // `targetStoreIds` fans the batch out to several of the director's stores at
  // once (defaults to just the active store).
  createBatch: (name: string, overrideIds: string[], scheduledAt: string, targetStoreIds?: string[]) => void;
  scheduleBatch: (batchId: string, scheduledAt: string) => void;
  submitBatch: (batchId: string) => void;
  // Change which stores a (scheduled) batch applies to: adds replicate the price
  // into new stores, removals revert those stores' copies. Origin is always kept.
  setBatchTargetStores: (batchId: string, targetStoreIds: string[]) => void;
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

// Boot every store's data; the active store becomes the working set, the rest
// go to the stash. Switching stores swaps a slice in and out (see setActiveStore).
const initialData = buildInitialStoreData();
const initialStash: Record<string, StoreSlice> = {};
for (const s of STORES) if (s.id !== DEFAULT_STORE_ID) initialStash[s.id] = initialData[s.id];
const initialActive = initialData[DEFAULT_STORE_ID];

export const usePricingStore = create<PricingStore>((set) => ({
  activeStoreId: DEFAULT_STORE_ID,
  stash: initialStash,
  items: initialActive.items,
  overrides: initialActive.overrides,
  batches: initialActive.batches,
  // Seed one per-item exception on the primary demo store, covering EDLP-3 —
  // enough to demo the "hard breach downgraded to soft, still visible" path
  // without inventing a grant flow (there isn't one; only AVP – Pricing grants).
  edlpExceptions: {
    [DEFAULT_STORE_ID]: {
      scope: ["EDLP-3"],
      approvedBy: "Priya Anand — AVP, Pricing",
      grantedAt: "2026-06-18T15:00:00Z",
      note: "Temporary competitive match while PMR max is under review.",
    },
  },

  // Switch the store in view. The current working set is stashed under its id and
  // the target store's slice is loaded — so unsent work in each store is preserved.
  setActiveStore: (id) =>
    set((state) => {
      if (id === state.activeStoreId) return {};
      const target = state.stash[id];
      if (!target) return {};
      const nextStash = { ...state.stash };
      nextStash[state.activeStoreId] = { items: state.items, overrides: state.overrides, batches: state.batches };
      delete nextStash[id];
      return {
        activeStoreId: id,
        stash: nextStash,
        items: target.items,
        overrides: target.overrides,
        batches: target.batches,
      };
    }),

  updateBasePrice: (itemId, newPrice, qty) =>
    set((state) => {
      const source = state.items.find((i) => i.id === itemId);
      if (!source) return {};
      // Pack-size deal: `newPrice` is the total for `normQty` units (mirrors retail).
      const normQty = newPrice == null ? null : Math.max(1, Math.floor(qty ?? 1) || 1);
      // Family price: items in a family share one price — editing one applies to all.
      const groupIds = source.familyId
        ? state.items.filter((i) => i.familyId === source.familyId).map((i) => i.id)
        : [itemId];
      let overrides = state.overrides;
      let batches = state.batches;
      const statusById: Record<string, OverrideStatus | undefined> = {};
      for (const id of groupIds) {
        const it = state.items.find((i) => i.id === id);
        if (!it) continue;
        const r = upsertOverride({ overrides, batches }, it, "base", newPrice, normQty ?? undefined);
        overrides = r.overrides;
        batches = r.batches;
        statusById[id] = r.status;
      }
      return {
        items: state.items.map((item) => {
          if (!groupIds.includes(item.id)) return item;
          let next: PricingItem = { ...item, newBasePrice: newPrice, newBaseQty: normQty, baseOverrideStatus: statusById[item.id] };
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

  setChangeReason: (itemId, reason) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === itemId ? { ...item, chosenChangeReason: reason } : item)),
    })),

  // Discarding a pending change also clears the edit from the table cell.
  removeFromLooseTray: (overrideId) =>
    set((state) => {
      const ov = state.overrides.find((o) => o.id === overrideId);
      const clear = (item: PricingItem) => {
        if (!ov || item.id !== ov.itemId) return item;
        const next =
          ov.priceField === "base"
            ? { ...item, newBasePrice: null, newBaseQty: null, baseOverrideStatus: undefined }
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

  createBatch: (name, overrideIds, scheduledAt, targetStoreIds) =>
    set((state) => {
      const now = Date.now();
      const createdAt = new Date().toISOString();
      const baseBatchId = `batch-${now}`;
      // Target stores always include the active one (where the changes were made).
      const targets = [...new Set([state.activeStoreId, ...(targetStoreIds ?? [])])];
      const multiStore = targets.length > 1;
      const groupId = multiStore ? `grp-${now}` : undefined;
      const meta = { originStoreId: state.activeStoreId, targetStoreIds: targets, groupId };

      // ── Active store: group the selected overrides into the new batch. ──
      const activeBatch: Batch = {
        id: baseBatchId,
        name,
        status: "scheduled",
        overrideIds,
        createdAt,
        scheduledAt,
        ...meta,
      };
      const affected = state.overrides.filter((o) => overrideIds.includes(o.id));
      const activeUpdate = {
        batches: [
          // One override belongs to exactly one batch — strip these ids elsewhere.
          ...state.batches.map((b) => ({ ...b, overrideIds: b.overrideIds.filter((id) => !overrideIds.includes(id)) })),
          activeBatch,
        ],
        overrides: state.overrides.map((o) =>
          overrideIds.includes(o.id) ? { ...o, status: "in_batch" as const, batchId: baseBatchId } : o
        ),
        items: applyStatusToItems(state.items, affected, "in_batch"),
      };

      if (!multiStore) return activeUpdate;

      // ── Other target stores: replicate the resulting prices into each slice. ──
      const sources = buildFanoutSources(affected, state.items);
      const nextStash = { ...state.stash };
      for (const storeId of targets) {
        if (storeId === state.activeStoreId) continue;
        const slice = nextStash[storeId];
        if (!slice) continue;
        const replicaBatchId = `${baseBatchId}::${storeId}`;
        const { slice: nextSlice, createdIds } = applyFanoutToSlice(slice, sources, replicaBatchId, now);
        const replicaBatch: Batch = {
          id: replicaBatchId,
          name,
          status: "scheduled",
          overrideIds: createdIds,
          createdAt,
          scheduledAt,
          ...meta,
        };
        nextStash[storeId] = { ...nextSlice, batches: [...nextSlice.batches, replicaBatch] };
      }
      return { ...activeUpdate, stash: nextStash };
    }),

  // Schedule a draft batch to send at a future date/time (overrides stay in_batch).
  // A multi-store batch reschedules its whole group across every target store.
  scheduleBatch: (batchId, scheduledAt) =>
    set((state) => {
      const groupId = state.batches.find((b) => b.id === batchId)?.groupId;
      const match = (b: Batch) => b.id === batchId || (groupId != null && b.groupId === groupId);
      const reschedule = (batches: Batch[]) =>
        batches.map((b) => (match(b) ? { ...b, status: "scheduled" as const, scheduledAt } : b));
      const update: Partial<PricingStore> = { batches: reschedule(state.batches) };
      if (groupId != null) {
        const nextStash = { ...state.stash };
        for (const [sid, slice] of Object.entries(state.stash)) {
          if (slice.batches.some(match)) nextStash[sid] = { ...slice, batches: reschedule(slice.batches) };
        }
        update.stash = nextStash;
      }
      return update;
    }),

  // Send a batch to SAP. A multi-store batch sends its whole group — each target
  // store's replica goes to SAP together.
  submitBatch: (batchId) =>
    set((state) => {
      const groupId = state.batches.find((b) => b.id === batchId)?.groupId;
      const submittedAt = new Date().toISOString();
      const match = (b: Batch) => b.id === batchId || (groupId != null && b.groupId === groupId);

      // EDLP ceiling backstop: refuse the whole send if ANY targeted store's
      // slice carries an over-ceiling override with no active exception for
      // that store. Exceptions can be revoked after a batch was scheduled, so
      // this is re-checked here, not just at commit time — a no-op is the
      // safe default (the UI disables the Send button for the same reason).
      const sliceBlocked = (slice: StoreSlice, storeId: string) => {
        const ids = new Set(slice.batches.filter(match).map((b) => b.id));
        const affected = slice.overrides.filter((o) => o.batchId != null && ids.has(o.batchId));
        if (affected.length === 0) return false;
        const itemsById = buildItemsById([slice.items]);
        return batchBlockedByEdlpCeiling(affected, itemsById, state.edlpExceptions[storeId]);
      };
      if (sliceBlocked({ items: state.items, overrides: state.overrides, batches: state.batches }, state.activeStoreId)) {
        return {};
      }
      for (const [sid, slice] of Object.entries(state.stash)) {
        if (slice.batches.some(match) && sliceBlocked(slice, sid)) return {};
      }

      const submitSlice = (slice: StoreSlice): StoreSlice => {
        const ids = new Set(slice.batches.filter(match).map((b) => b.id));
        const affected = slice.overrides.filter((o) => o.batchId != null && ids.has(o.batchId));
        return {
          items: applyStatusToItems(slice.items, affected, "submitted"),
          overrides: slice.overrides.map((o) =>
            o.batchId != null && ids.has(o.batchId) ? { ...o, status: "submitted" } : o
          ),
          batches: slice.batches.map((b) => (match(b) ? { ...b, status: "submitted" as const, submittedAt } : b)),
        };
      };
      const active = submitSlice({ items: state.items, overrides: state.overrides, batches: state.batches });
      const update: Partial<PricingStore> = { items: active.items, overrides: active.overrides, batches: active.batches };
      if (groupId != null) {
        const nextStash = { ...state.stash };
        for (const [sid, slice] of Object.entries(state.stash)) {
          if (slice.batches.some(match)) nextStash[sid] = submitSlice(slice);
        }
        update.stash = nextStash;
      }
      return update;
    }),

  setBatchTargetStores: (batchId, nextTargetIds) =>
    set((state) => {
      // Locate the batch (it may live in the active working set or a stashed store).
      let viewedStoreId = state.activeStoreId;
      let viewedSlice: StoreSlice = { items: state.items, overrides: state.overrides, batches: state.batches };
      if (!state.batches.some((b) => b.id === batchId)) {
        const hit = Object.entries(state.stash).find(([, sl]) => sl.batches.some((b) => b.id === batchId));
        if (!hit) return {};
        [viewedStoreId, viewedSlice] = [hit[0], hit[1]];
      }
      const batch = viewedSlice.batches.find((b) => b.id === batchId)!;
      if (batch.status !== "scheduled") return {}; // stores are locked once sent

      const origin = batch.originStoreId ?? viewedStoreId;
      const oldTargets = batch.targetStoreIds ?? [origin];
      const groupId = batch.groupId ?? `grp-${Date.now()}`;
      const baseBatchId = batchId.includes("::") ? batchId.split("::")[0] : batchId;
      const now = Date.now();
      const replicaId = (sid: string) => (sid === origin ? baseBatchId : `${baseBatchId}::${sid}`);

      const targets = [...new Set([origin, ...nextTargetIds])];
      const toAdd = targets.filter((s) => !oldTargets.includes(s));
      const toRemove = oldTargets.filter((s) => !targets.includes(s) && s !== origin);

      // Replicate the batch's (absolute) prices into any newly added stores.
      const sources = buildFanoutSources(
        viewedSlice.overrides.filter((o) => o.batchId === batchId),
        viewedSlice.items
      );

      let activeSlice: StoreSlice = { items: state.items, overrides: state.overrides, batches: state.batches };
      const nextStash: Record<string, StoreSlice> = { ...state.stash };
      const getSlice = (sid: string) => (sid === state.activeStoreId ? activeSlice : nextStash[sid]);
      const setSlice = (sid: string, sl: StoreSlice) => {
        if (sid === state.activeStoreId) activeSlice = sl;
        else nextStash[sid] = sl;
      };

      for (const sid of toAdd) {
        const sl = getSlice(sid);
        if (!sl) continue;
        const rid = replicaId(sid);
        const { slice, createdIds } = applyFanoutToSlice(sl, sources, rid, now);
        const replica: Batch = {
          id: rid,
          name: batch.name,
          status: "scheduled",
          overrideIds: createdIds,
          createdAt: batch.createdAt,
          scheduledAt: batch.scheduledAt,
          originStoreId: origin,
          targetStoreIds: targets,
          groupId,
        };
        setSlice(sid, { ...slice, batches: [...slice.batches, replica] });
      }
      for (const sid of toRemove) {
        const sl = getSlice(sid);
        if (!sl) continue;
        setSlice(sid, revertFanoutInSlice(sl, replicaId(sid)));
      }

      // Refresh group metadata on every surviving member (badge hides when single).
      const finalGroupId = targets.length > 1 ? groupId : undefined;
      const patch = (batches: Batch[]) =>
        batches.map((b) =>
          b.id === batchId || (b.groupId != null && b.groupId === groupId)
            ? { ...b, targetStoreIds: targets, groupId: finalGroupId }
            : b
        );
      activeSlice = { ...activeSlice, batches: patch(activeSlice.batches) };
      for (const sid of Object.keys(nextStash)) nextStash[sid] = { ...nextStash[sid], batches: patch(nextStash[sid].batches) };

      return { items: activeSlice.items, overrides: activeSlice.overrides, batches: activeSlice.batches, stash: nextStash };
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

// selectPendingOverrides returns a fresh array — use with useShallow() to avoid re-render loops.
export const selectPendingOverrides = (s: PricingStore) =>
  s.overrides.filter((o) => o.status === "pending");
export const selectPendingCount = (s: PricingStore) =>
  s.overrides.reduce((n, o) => n + (o.status === "pending" ? 1 : 0), 0);

// The store currently in view (stable object from STORES).
export const useActiveStore = (): Store =>
  usePricingStore((s) => storeById(s.activeStoreId) ?? STORES[0]);

// The active store's EDLP ceiling exception, if AVP – Pricing has granted one.
export const useEdlpException = (): EdlpException | undefined =>
  usePricingStore((s) => s.edlpExceptions[s.activeStoreId]);

// Per-store work summary for the switcher: unsent changes (pending or in a
// scheduled batch) + HQ recommendations still awaiting the director's call.
export type StoreSummary = { store: Store; unsent: number; hqCount: number };
export const useStoreSummaries = (): StoreSummary[] => {
  const activeStoreId = usePricingStore((s) => s.activeStoreId);
  const items = usePricingStore((s) => s.items);
  const overrides = usePricingStore((s) => s.overrides);
  const stash = usePricingStore((s) => s.stash);
  return STORES.map((store) => {
    const slice = store.id === activeStoreId ? { items, overrides } : stash[store.id];
    const ov = slice?.overrides ?? [];
    const it = slice?.items ?? [];
    return {
      store,
      unsent: ov.filter((o) => o.status === "pending" || o.status === "in_batch").length,
      hqCount: it.filter(hqReviewNeeded).length,
    };
  });
};
