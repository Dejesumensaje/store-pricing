import { buildInitialStoreData, StoreSlice } from "./mock-data";
import { PricingItem } from "@/types/pricing";

// ─── Read: initial data load ──────────────────────────────────────────────────
// Returns price-review data for all stores.
//
// MVP: runs synchronously from mock-data.ts.
//
// Backend: replace the body with a real fetch, e.g.:
//   const res = await fetch('/api/stores/price-review');
//   return res.json() as Record<string, StoreSlice>;
// Then change the call site in pricing-store.ts to async initialization
// (add a loading state + initialize() action to the Zustand store).
export function loadStoreData(): Record<string, StoreSlice> {
  return buildInitialStoreData();
}

// ─── Write: persist a director's decision ────────────────────────────────────
// Called after each local state mutation in pricing-store.ts.
//
// Backend: PATCH /api/items/:itemId — body is the changed fields.
// Each Zustand action (updateBasePrice, updateRetailPrice, updateFuelSaver,
// setSectionReviewed, setBaseChangeReason, setRetailChangeReason,
// setFuelChangeReason) should call this after updating local
// state so the decision is persisted even if the page is reloaded.
export async function commitDecision(
  _itemId: string,
  _patch: Partial<PricingItem>
): Promise<void> {
  // no-op until backend is wired
}
