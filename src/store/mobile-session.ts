"use client";

import { create } from "zustand";
import type { Override, PricingItem } from "@/types/pricing";

// A walk-session edit is tracked per SECTION, not per item: an item can carry
// pre-seeded pending overrides (mock-data's mockOverrides) on sections the
// director never touched this walk, and those must not surface in — or be
// discardable from — the session tray. Only sections recorded here belong to
// this session.
type WalkSections = { base: boolean; retail: boolean; fuel: boolean };

type WalkEntry = {
  sections: WalkSections;
  // Fuel Saver carries no Override record (see pricing-store.ts), so there's
  // no "current price" to diff against for the tray's old→new line or for
  // discarding a fuel-only edit. Snapshot the value the FIRST time fuel is
  // touched this session (idempotent — later touches don't overwrite it) and
  // restore to it on discard/cancel.
  fuelBaseline: number | null;
};

type MobileSessionStore = {
  // Store Walk ONLY — Item Maintenance never writes here (its edits are sent
  // immediately, they aren't "pending walk work"), so the walk counter/tray
  // can't be polluted by a maintenance session.
  walkOrder: string[];
  walkEntries: Record<string, WalkEntry>;
  touchSection: (itemId: string, section: keyof WalkSections, fuelBaseline: number | null) => void;
  untouch: (itemId: string) => void;
  clear: () => void;
  // Item Maintenance's own fuel baseline, kept apart from the walk session so
  // the recap/success screens can diff fuel without registering the item as
  // walk work. Reset on each fresh scan into maint-edit (see MobileShell) so
  // a previously-sent fuel change doesn't read as changed again.
  maintFuelBaselines: Record<string, number | null>;
  setMaintFuelBaseline: (itemId: string, value: number | null, opts?: { reset?: boolean }) => void;
};

export const useMobileSessionStore = create<MobileSessionStore>((set) => ({
  walkOrder: [],
  walkEntries: {},
  touchSection: (itemId, section, fuelBaseline) =>
    set((state) => {
      const existing = state.walkEntries[itemId];
      return {
        walkOrder: existing ? state.walkOrder : [...state.walkOrder, itemId],
        walkEntries: {
          ...state.walkEntries,
          [itemId]: {
            sections: { ...(existing?.sections ?? { base: false, retail: false, fuel: false }), [section]: true },
            fuelBaseline: existing ? existing.fuelBaseline : fuelBaseline,
          },
        },
      };
    }),
  untouch: (itemId) =>
    set((state) => {
      const walkEntries = { ...state.walkEntries };
      delete walkEntries[itemId];
      return { walkOrder: state.walkOrder.filter((id) => id !== itemId), walkEntries };
    }),
  clear: () => set({ walkOrder: [], walkEntries: {} }),
  maintFuelBaselines: {},
  setMaintFuelBaseline: (itemId, value, opts) =>
    set((state) =>
      opts?.reset || !(itemId in state.maintFuelBaselines)
        ? { maintFuelBaselines: { ...state.maintFuelBaselines, [itemId]: value } }
        : state
    ),
}));

export type WalkRow = {
  item: PricingItem;
  baseOverride: Override | undefined;
  retailOverride: Override | undefined;
  fuelChanged: boolean;
  fuelBaseline: number | null;
};

// The ONE definition of "this walk's edits" — the tray renders these rows and
// the waiting screen's counter pill shows their length, so the two can never
// disagree (e.g. a cancelled fuel change leaves a touched entry behind, but
// with no surviving diff it produces no row and counts for nothing).
export function computeWalkRows(
  items: PricingItem[],
  overrides: Override[],
  walkOrder: string[],
  walkEntries: Record<string, WalkEntry>
): WalkRow[] {
  return walkOrder
    .map((id) => {
      const item = items.find((i) => i.id === id);
      const entry = walkEntries[id];
      if (!item || !entry) return null;
      // A section shows only if it was edited THIS session AND the edit still
      // survives (pending override / fuel differing from the baseline).
      const baseOverride = entry.sections.base
        ? overrides.find((o) => o.id === `${id}:base` && o.status === "pending")
        : undefined;
      const retailOverride = entry.sections.retail
        ? overrides.find((o) => o.id === `${id}:retail` && o.status === "pending")
        : undefined;
      const fuelChanged = entry.sections.fuel && (item.fuelSaver ?? null) !== entry.fuelBaseline;
      if (!baseOverride && !retailOverride && !fuelChanged) return null;
      return { item, baseOverride, retailOverride, fuelChanged, fuelBaseline: entry.fuelBaseline };
    })
    .filter((r): r is WalkRow => r != null);
}
