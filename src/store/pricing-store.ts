"use client";

import { create } from "zustand";
import { PricingItem, Override, OverrideStatus, PriceField, PricingCategory, StoreOriginReason } from "@/types/pricing";
import { buildInitialStoreData, StoreSlice } from "@/lib/mock-data";
import { STORES, DEFAULT_STORE_ID, storeById, Store } from "@/lib/store-config";
import { hqReviewNeeded } from "@/lib/item-status";
import { EdlpException } from "@/lib/edlp-ceiling";

type PricingStore = {
  // The store currently in view. Its items/overrides are the top-level
  // fields below (the "working set"); every other store sits in `stash`.
  activeStoreId: string;
  stash: Record<string, StoreSlice>;
  setActiveStore: (id: string) => void;
  items: PricingItem[];
  overrides: Override[];
  // Per-store EDLP ceiling exception, granted by AVP – Pricing. Lives outside
  // the stash working-set mechanism — it's keyed by storeId directly, so it
  // survives store switching. Store users can only view it; there is no
  // grant/edit action here.
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
};

const isActive = (s?: OverrideStatus) => s === "pending";

function withOverrideFlags(item: PricingItem): PricingItem {
  return { ...item, hasOverride: isActive(item.baseOverrideStatus) || isActive(item.retailOverrideStatus) };
}

// Upsert/remove the override for one price field of an item. Override ids are
// deterministic (`${itemId}:${field}`), so re-edits update in place.
function upsertOverride(
  state: { overrides: Override[] },
  item: PricingItem,
  field: PriceField,
  newPrice: number | null,
  qty?: number
): { overrides: Override[]; status: OverrideStatus | undefined } {
  const id = `${item.id}:${field}`;
  const existing = state.overrides.find((o) => o.id === id);

  // A price of $0 (or negative) isn't a valid shelf price — treat it as "no
  // decision" so an empty field or a 100%-off reduction never commits "→ $0.00".
  if (newPrice != null && newPrice <= 0) newPrice = null;

  if (newPrice == null) {
    return {
      overrides: state.overrides.filter((o) => o.id !== id),
      status: undefined,
    };
  }

  const normalizedQty = qty != null && qty > 1 ? qty : undefined;

  if (existing && isActive(existing.status)) {
    return {
      overrides: state.overrides.map((o) =>
        o.id === id ? { ...o, newPrice, qty: normalizedQty, updatedAt: Date.now() } : o
      ),
      status: existing.status,
    };
  }

  // No override yet, or the previous one was already confirmed → fresh pending.
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
    status: "pending",
  };
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
  // the target store's slice is loaded — so unconfirmed work in each store is preserved.
  setActiveStore: (id) =>
    set((state) => {
      if (id === state.activeStoreId) return {};
      const target = state.stash[id];
      if (!target) return {};
      const nextStash = { ...state.stash };
      nextStash[state.activeStoreId] = { items: state.items, overrides: state.overrides };
      delete nextStash[id];
      return {
        activeStoreId: id,
        stash: nextStash,
        items: target.items,
        overrides: target.overrides,
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
      const statusById: Record<string, OverrideStatus | undefined> = {};
      for (const id of groupIds) {
        const it = state.items.find((i) => i.id === id);
        if (!it) continue;
        const r = upsertOverride({ overrides }, it, "base", newPrice, normQty ?? undefined);
        overrides = r.overrides;
        statusById[id] = r.status;
      }
      return {
        items: state.items.map((item) => {
          if (!groupIds.includes(item.id)) return item;
          let next: PricingItem = { ...item, newBasePrice: newPrice, newBaseQty: normQty, baseOverrideStatus: statusById[item.id] };
          // Deciding on an HQ rec (accept or override) reviews it for good — it
          // must not return to the queue when the override later goes confirmed.
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
      };
    }),

  updateRetailPrice: (itemId, qty, price) =>
    set((state) => {
      const source = state.items.find((i) => i.id === itemId);
      if (!source) return {};
      const normQty = price == null ? null : Math.max(1, Math.floor(qty) || 1);
      const { overrides, status } = upsertOverride(state, source, "retail", price, normQty ?? undefined);
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
        items: state.items.map(clear),
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

// Per-store work summary for the switcher: unconfirmed changes + HQ
// recommendations still awaiting the director's call.
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
      unsent: ov.filter((o) => o.status === "pending").length,
      hqCount: it.filter(hqReviewNeeded).length,
    };
  });
};
