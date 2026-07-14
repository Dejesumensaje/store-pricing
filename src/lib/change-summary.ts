import { PricingItem, PricingCategory } from "@/types/pricing";
import { fmt, fmtQtyPrice } from "./format";
import { perUnit } from "./pricing-math";

// ─── Pricing strategy (the item's current pricing model) ─────────────────────
// Distinct from the Change Summary: this names the model, never an action.
export function pricingStrategyLabel(item: PricingItem): string {
  switch (item.category_type) {
    case "everyday_low_price":
      return "EDLP";
    case "temporary_allowance":
      return "TA";
    case "new_discontinued":
      return item.itemStatus === "discontinued" ? "Disc." : "New";
    case "base":
    case "no_change":
    default:
      return "Base";
  }
}

// The unabbreviated change-type name, shown on hover over the short pill.
export function pricingStrategyFullLabel(item: PricingItem): string {
  switch (item.category_type) {
    case "everyday_low_price":
      return "Everyday Low Price";
    case "temporary_allowance":
      return "Temporary Allowance";
    case "new_discontinued":
      return item.itemStatus === "discontinued" ? "Discontinued" : "New Item";
    case "base":
    case "no_change":
    default:
      return "Base Price";
  }
}

// ─── Change Summary (the action the user performed) ──────────────────────────

// Every distinct pricing action. Each maps to a verb-led label + outcome, and to
// a coarser group used for filtering (CHANGE_FILTER_GROUP).
export type ChangeKind =
  | "base_increase"
  | "base_decrease"
  | "retail_update"
  | "temp_created"
  | "temp_updated"
  | "multi_unit"
  | "fuel_saver"
  | "edlp_converted"
  | "edlp_updated"
  | "initial_price"
  | "discontinued";

// A single action: its kind, a verb-led label, and the resulting value (may be
// empty, e.g. discontinuation has no price outcome).
export type ChangeEntry = { kind: ChangeKind; label: string; detail: string };

// The director's decision on an item, relative to HQ's recommendation. Replaces
// the old per-type verb summary — the price outcome lives in the price columns,
// so this only says what was decided.
export type DecisionState = "pending" | "accepted" | "overridden" | "kept_current" | "changed" | "none";

type DecisionTone = "neutral" | "success" | "negative" | "warning" | "in-progress";

export const DECISION_META: Record<DecisionState, { label: string; tone: DecisionTone } | null> = {
  pending: { label: "Pending", tone: "in-progress" },
  accepted: { label: "Accepted", tone: "success" },
  overridden: { label: "Overridden", tone: "warning" },
  kept_current: { label: "Kept current", tone: "neutral" },
  changed: { label: "Changed", tone: "in-progress" },
  none: null,
};

const transition = (from: number, to: number) => `${fmt(from)} → ${fmt(to)}`;
const sapStrategyOf = (item: PricingItem): PricingCategory => item.sapStrategy ?? item.category_type;

// The base-line action (base price / EDLP / lifecycle). New & discontinued items
// carry an inherent action; every other strategy only counts a committed change.
function baseLineEntry(item: PricingItem): ChangeEntry | null {
  if (item.category_type === "new_discontinued") {
    if (item.itemStatus === "discontinued") {
      return { kind: "discontinued", label: "Marked for Discontinuation", detail: "" };
    }
    return {
      kind: "initial_price",
      label: "Set Initial Price",
      detail: item.newBasePrice != null ? fmtQtyPrice(item.newBaseQty, item.newBasePrice) : fmt(item.currentBasePrice),
    };
  }

  if (item.newBasePrice == null) return null;

  if (item.category_type === "everyday_low_price") {
    // Converted when EDLP isn't the item's live SAP strategy; otherwise repriced.
    if (sapStrategyOf(item) !== "everyday_low_price") {
      return { kind: "edlp_converted", label: "Converted to EDLP", detail: fmt(item.newBasePrice) };
    }
    return { kind: "edlp_updated", label: "Updated EDLP Price", detail: transition(item.currentBasePrice, item.newBasePrice) };
  }

  // A pack-size deal is a change even at the same per-unit price; direction
  // compares per-unit (the total of "3 for $6.00" says nothing on its own).
  const qty = item.newBaseQty ?? 1;
  if (qty <= 1 && item.newBasePrice === item.currentBasePrice) return null;
  const up = perUnit(item.newBasePrice, qty) > item.currentBasePrice;
  return {
    kind: up ? "base_increase" : "base_decrease",
    label: up ? "Increased Base Price" : "Decreased Base Price",
    detail: `${fmt(item.currentBasePrice)} → ${fmtQtyPrice(qty, item.newBasePrice)}`,
  };
}

// The retail-line action: a multi-unit deal, a temporary allowance (created vs.
// updated depending on whether one is already live), or a plain retail reprice.
function retailEntry(item: PricingItem): ChangeEntry | null {
  if (item.newRetailPrice == null) return null;
  const qty = item.newRetailQty ?? 1;
  if (qty > 1) {
    return { kind: "multi_unit", label: "Created Multi-Unit Promotion", detail: fmtQtyPrice(qty, item.newRetailPrice) };
  }
  if (item.category_type === "temporary_allowance") {
    const curRetail = item.currentRetailPrice ?? item.currentBasePrice;
    // An allowance is already live when the current retail differs from base.
    if (item.currentRetailPrice != null && item.currentRetailPrice !== item.currentBasePrice) {
      return {
        kind: "temp_updated",
        label: "Updated Temporary Allowance",
        detail: `Retail ${transition(curRetail, item.newRetailPrice)}`,
      };
    }
    return { kind: "temp_created", label: "Created Temporary Allowance", detail: `Retail ${fmt(item.newRetailPrice)}` };
  }
  const curRetail = item.currentRetailPrice ?? item.currentBasePrice;
  return { kind: "retail_update", label: "Updated Retail Price", detail: transition(curRetail, item.newRetailPrice) };
}

function fuelSaverEntry(item: PricingItem): ChangeEntry | null {
  if (item.fuelSaver == null || item.fuelSaver <= 0) return null;
  return { kind: "fuel_saver", label: "Added Fuel Saver", detail: `+${fmt(item.fuelSaver)}` };
}

// All actions the store applied to this item, in display order.
export function changeEntries(item: PricingItem): ChangeEntry[] {
  return [baseLineEntry(item), retailEntry(item), fuelSaverEntry(item)].filter(
    (e): e is ChangeEntry => e != null
  );
}

// What the director decided about an item, relative to HQ's recommendation. The
// relevant price field is retail for temporary allowances, base otherwise.
// Independent of the workflow status (see deriveItemStatus).
export function deriveDecision(item: PricingItem): DecisionState {
  const isTemp = item.category_type === "temporary_allowance";
  const decided = isTemp ? item.newRetailPrice ?? null : item.newBasePrice;
  const recommended = isTemp ? item.recommendedRetailPrice ?? null : item.recommendedBasePrice;
  const hasDecision = decided != null;

  if (item.hqReviewPending) {
    if (hasDecision) {
      const matches = recommended != null && Math.abs(decided - recommended) < 0.005;
      return matches ? "accepted" : "overridden";
    }
    return item.reviewed ? "kept_current" : "pending";
  }
  // No HQ recommendation — a director-initiated change, or nothing.
  return hasDecision ? "changed" : "none";
}

// ─── Change-type filtering (AC7) ─────────────────────────────────────────────
// Each action kind rolls up to a filterable group. Multi-change items expose all
// of their groups, so they match when filtering by any one of them.
const CHANGE_FILTER_GROUP: Record<ChangeKind, string> = {
  base_increase: "Base price changes",
  base_decrease: "Base price changes",
  retail_update: "Retail price changes",
  temp_created: "Temporary allowances (promo)",
  temp_updated: "Temporary allowances (promo)",
  multi_unit: "Multi-unit promotions",
  fuel_saver: "Fuel saver",
  edlp_converted: "Everyday low price (EDLP) changes",
  edlp_updated: "Everyday low price (EDLP) changes",
  initial_price: "Initial prices",
  discontinued: "Discontinuations",
};

export const NO_CHANGE_FILTER = "No change";

// Filter options in display order. Items with no changes fall under "No change".
export const CHANGE_FILTER_OPTIONS: string[] = [
  "Base price changes",
  "Retail price changes",
  "Temporary allowances (promo)",
  "Multi-unit promotions",
  "Everyday low price (EDLP) changes",
  "Fuel saver",
  "Initial prices",
  "Discontinuations",
  NO_CHANGE_FILTER,
];

// The set of filter groups an item belongs to (for the "Change type" facet).
export function itemChangeGroups(item: PricingItem): string[] {
  const entries = changeEntries(item);
  if (entries.length === 0) return [NO_CHANGE_FILTER];
  return [...new Set(entries.map((e) => CHANGE_FILTER_GROUP[e.kind]))];
}
