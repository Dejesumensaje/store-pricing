// Multi-store fan-out: replicate one store's price changes onto other stores the
// director manages. Semantics (per the plan): the RESULTING ABSOLUTE PRICE is
// copied to each target — relative reductions are NOT re-derived per store. This
// is pure/testable logic; the store (pricing-store) drives it, the modal previews
// it. A "source" is one price decision from the active store; a "plan" classifies
// how it lands in a given target store.
import { PricingItem, Override, PriceField, PricingCategory } from "@/types/pricing";
import { StoreSlice } from "@/lib/mock-data";

const round2 = (n: number) => Math.round(n * 100) / 100;

// One price change from the active store, ready to replicate elsewhere. For a
// retail (temporary allowance) change the promo window travels with the price.
export type FanoutSource = {
  itemId: string;
  itemName: string;
  priceField: PriceField;
  changeType: PricingCategory;
  newPrice: number;
  qty?: number;
  allowanceStartDate?: string | null;
  allowanceEndDate?: string | null;
};

export type PlanEntry = {
  itemId: string;
  itemName: string;
  priceField: PriceField;
  newPrice: number;
  qty?: number;
  currentPrice: number;
};

// How a set of sources lands in one target store.
export type StorePlan = {
  applied: PlanEntry[]; // clean — no existing unsent change on that field
  conflicts: PlanEntry[]; // target already has an unsent change → will overwrite
  missing: { itemId: string; itemName: string }[]; // SKU not carried by this store
  locked: { itemId: string; itemName: string; priceField: PriceField }[]; // in flight to SAP
};

const fieldStatus = (item: PricingItem, field: PriceField) =>
  field === "base" ? item.baseOverrideStatus : item.retailOverrideStatus;

// Sent to SAP and not failed → the price is in flight and can't be re-changed yet.
const isLocked = (item: PricingItem, field: PriceField) =>
  fieldStatus(item, field) === "submitted" && !item.sendFailed;

const hasActiveOverride = (item: PricingItem, field: PriceField) => {
  const s = fieldStatus(item, field);
  return s === "pending" || s === "in_batch";
};

const currentFor = (item: PricingItem, field: PriceField) =>
  field === "base" ? item.currentBasePrice : item.currentRetailPrice ?? item.currentBasePrice;

const normQty = (qty?: number) => (qty != null && qty > 1 ? qty : undefined);

// Classify how each source lands in a target store (no mutation).
export function computeStorePlan(slice: StoreSlice, sources: FanoutSource[]): StorePlan {
  const byId = new Map(slice.items.map((i) => [i.id, i]));
  const plan: StorePlan = { applied: [], conflicts: [], missing: [], locked: [] };
  for (const src of sources) {
    const item = byId.get(src.itemId);
    if (!item) {
      plan.missing.push({ itemId: src.itemId, itemName: src.itemName });
      continue;
    }
    if (isLocked(item, src.priceField)) {
      plan.locked.push({ itemId: item.id, itemName: item.name, priceField: src.priceField });
      continue;
    }
    const entry: PlanEntry = {
      itemId: item.id,
      itemName: item.name,
      priceField: src.priceField,
      newPrice: src.newPrice,
      qty: normQty(src.qty),
      currentPrice: currentFor(item, src.priceField),
    };
    (hasActiveOverride(item, src.priceField) ? plan.conflicts : plan.applied).push(entry);
  }
  return plan;
}

// Apply the plan to a target slice: write/overwrite overrides for applied +
// conflicts (conflict = overwrite, per decision), reflect the new prices onto the
// items, and group the created overrides under `batchId`. Returns the mutated
// slice plus the ids created (the replicated batch's overrideIds). missing/locked
// sources are skipped.
export function applyFanoutToSlice(
  slice: StoreSlice,
  sources: FanoutSource[],
  batchId: string,
  now: number
): { slice: StoreSlice; createdIds: string[] } {
  const plan = computeStorePlan(slice, sources);
  const srcByKey = new Map(sources.map((s) => [`${s.itemId}:${s.priceField}`, s]));
  const createdIds = [...plan.applied, ...plan.conflicts].map((e) => `${e.itemId}:${e.priceField}`);
  const createdSet = new Set(createdIds);

  const itemById = new Map(slice.items.map((i) => [i.id, i]));

  // Overrides: drop any we're overwriting, then add the fresh in_batch copies.
  const overrides: Override[] = slice.overrides.filter((o) => !createdSet.has(o.id));
  for (const key of createdIds) {
    const src = srcByKey.get(key)!;
    const item = itemById.get(src.itemId)!;
    overrides.push({
      id: key,
      itemId: src.itemId,
      itemName: item.name,
      changeType: src.changeType,
      priceField: src.priceField,
      currentPrice: currentFor(item, src.priceField),
      newPrice: src.newPrice,
      qty: normQty(src.qty),
      status: "in_batch",
      batchId,
      updatedAt: now,
    });
  }

  // Items: reflect each applied/conflict change onto its item.
  const items = slice.items.map((item) => {
    let next = item;
    for (const field of ["base", "retail"] as PriceField[]) {
      const key = `${item.id}:${field}`;
      if (!createdSet.has(key)) continue;
      const src = srcByKey.get(key)!;
      if (field === "base") {
        next = { ...next, newBasePrice: src.newPrice, newBaseQty: normQty(src.qty) ?? 1, baseOverrideStatus: "in_batch", hasOverride: true };
        if (next.category_type === "no_change") {
          next = { ...next, category_type: "base", autoTypedFrom: "no_change" };
        }
      } else {
        next = {
          ...next,
          newRetailPrice: src.newPrice,
          newRetailQty: normQty(src.qty) ?? 1,
          retailOverrideStatus: "in_batch",
          hasOverride: true,
          allowanceStartDate: src.allowanceStartDate ?? next.allowanceStartDate,
          allowanceEndDate: src.allowanceEndDate ?? next.allowanceEndDate,
        };
        if (next.category_type !== "temporary_allowance") {
          next = {
            ...next,
            category_type: "temporary_allowance",
            currentRetailPrice: next.currentRetailPrice ?? next.currentBasePrice,
            allowanceCost: next.allowanceCost ?? round2(next.cost * 0.8),
            recommendedRetailPrice: next.recommendedRetailPrice ?? round2(next.currentBasePrice * 0.85),
          };
        }
      }
    }
    return next;
  });

  // One override lives in exactly one batch — strip the created ids from any other
  // batch in this slice (the new batch itself is appended by the caller).
  const batches = slice.batches.map((b) => ({
    ...b,
    overrideIds: b.overrideIds.filter((oid) => !createdSet.has(oid)),
  }));

  return { slice: { items, overrides, batches }, createdIds };
}

// Build fan-out sources from the active store's selected overrides (pulling the
// promo window off each retail item so it travels with the price).
export function buildFanoutSources(overrides: Override[], items: PricingItem[]): FanoutSource[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return overrides.map((o) => {
    const item = byId.get(o.itemId);
    return {
      itemId: o.itemId,
      itemName: o.itemName,
      priceField: o.priceField,
      changeType: o.changeType,
      newPrice: o.newPrice,
      qty: o.qty,
      allowanceStartDate: o.priceField === "retail" ? item?.allowanceStartDate : undefined,
      allowanceEndDate: o.priceField === "retail" ? item?.allowanceEndDate : undefined,
    };
  });
}

// Undo a replicated batch in one store: remove its batch + overrides and revert
// the affected items' price fields. Used when a store is dropped from a group.
export function revertFanoutInSlice(slice: StoreSlice, batchId: string): StoreSlice {
  const removed = slice.overrides.filter((o) => o.batchId === batchId);
  const removedIds = new Set(removed.map((o) => o.id));
  const overrides = slice.overrides.filter((o) => !removedIds.has(o.id));
  const isActive = (s?: string) => s === "pending" || s === "in_batch";
  const items = slice.items.map((item) => {
    let next = item;
    for (const ov of removed) {
      if (ov.itemId !== item.id) continue;
      next =
        ov.priceField === "base"
          ? { ...next, newBasePrice: null, newBaseQty: null, baseOverrideStatus: undefined }
          : { ...next, newRetailPrice: null, newRetailQty: null, retailOverrideStatus: undefined };
    }
    if (next === item) return item;
    return { ...next, hasOverride: isActive(next.baseOverrideStatus) || isActive(next.retailOverrideStatus) };
  });
  const batches = slice.batches.filter((b) => b.id !== batchId);
  return { items, overrides, batches };
}

export type StoreFanoutResult = { storeId: string; plan: StorePlan };
export type FanoutSummary = {
  perStore: StoreFanoutResult[];
  totalStores: number;
  cleanStores: number; // stores where everything applies with no conflict/skip
  totalApplied: number;
  totalConflicts: number;
  totalMissing: number;
  totalLocked: number;
};

// Preview the fan-out across the chosen target stores. The active store is clean
// by definition (these are its own changes), so it's counted as all-applied.
export function planFanout(
  sources: FanoutSource[],
  targetStoreIds: string[],
  activeStoreId: string,
  activeSlice: StoreSlice,
  stash: Record<string, StoreSlice>
): FanoutSummary {
  const perStore: StoreFanoutResult[] = targetStoreIds.map((storeId) => {
    if (storeId === activeStoreId) {
      const byId = new Map(activeSlice.items.map((i) => [i.id, i]));
      const applied: PlanEntry[] = sources.map((src) => {
        const item = byId.get(src.itemId);
        return {
          itemId: src.itemId,
          itemName: src.itemName,
          priceField: src.priceField,
          newPrice: src.newPrice,
          qty: normQty(src.qty),
          currentPrice: item ? currentFor(item, src.priceField) : src.newPrice,
        };
      });
      return { storeId, plan: { applied, conflicts: [], missing: [], locked: [] } };
    }
    return { storeId, plan: computeStorePlan(stash[storeId], sources) };
  });

  const sum = (fn: (p: StorePlan) => number) => perStore.reduce((n, s) => n + fn(s.plan), 0);
  const cleanStores = perStore.filter(
    (s) => s.plan.conflicts.length === 0 && s.plan.missing.length === 0 && s.plan.locked.length === 0
  ).length;
  return {
    perStore,
    totalStores: targetStoreIds.length,
    cleanStores,
    totalApplied: sum((p) => p.applied.length),
    totalConflicts: sum((p) => p.conflicts.length),
    totalMissing: sum((p) => p.missing.length),
    totalLocked: sum((p) => p.locked.length),
  };
}
