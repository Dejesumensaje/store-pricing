import { PricingItem } from "@/types/pricing";
import { perUnit } from "./pricing-math";

// The ids a base-price commit on `item` will actually reprice — the item plus
// every family member (mirrors the propagation in updateBasePrice).
function familyGroupIds(item: PricingItem, itemsById: Map<string, PricingItem>): string[] {
  if (!item.familyId) return [item.id];
  return [...itemsById.values()].filter((i) => i.familyId === item.familyId).map((i) => i.id);
}

/**
 * Build an id → item lookup across every catalog. Base price is shared, so the
 * same id can appear in multiple arrays; the first wins (impact fields are
 * identical across copies).
 */
export function buildItemsById(catalogs: PricingItem[][]): Map<string, PricingItem> {
  const map = new Map<string, PricingItem>();
  for (const catalog of catalogs) {
    for (const item of catalog) {
      if (!map.has(item.id)) map.set(item.id, item);
    }
  }
  return map;
}

/**
 * A store-level exception to the EDLP hard stop, granted by AVP – Pricing —
 * store users can only view it, never grant or edit it.
 * `scope: "store"` covers every EDLP item in the store; an item-id array
 * covers only those items. An active exception downgrades a hard breach to a
 * soft warning — never silent (see evaluateEdlpCeiling).
 */
export type EdlpExceptionScope = "store" | string[];
export type EdlpException = {
  scope: EdlpExceptionScope;
  approvedBy: string;
  /** ISO datetime the exception was granted. */
  grantedAt: string;
  note?: string;
};

function exceptionCovers(exception: EdlpException | undefined, itemId: string): boolean {
  if (!exception) return false;
  return exception.scope === "store" || exception.scope.includes(itemId);
}

export type EdlpCeilingLevel = "ok" | "soft" | "hard";

export type EdlpCeilingResult = {
  level: EdlpCeilingLevel;
  /** SAP PMR maximum allowed price (per-unit). 0 when the item carries none. */
  maxAllowed: number;
  /** maxAllowed × 1.10, rounded to the cent — the hard stop. */
  hardCeiling: number;
  exceptionActive: boolean;
  /** True whenever the price is strictly over hardCeiling — even when an
   *  exception downgrades `level` to "soft". Lets the UI say "over the hard
   *  ceiling" only when it actually is, instead of inferring from `level`. */
  overHardCeiling: boolean;
};

const OK: EdlpCeilingResult = { level: "ok", maxAllowed: 0, hardCeiling: 0, exceptionActive: false, overHardCeiling: false };

/**
 * Evaluate one EDLP item's proposed (or current) per-unit price against its
 * SAP PMR maximum. Strict >10% is a hard stop; exactly +10% passes as soft.
 * An active exception covering the item downgrades a hard breach to soft —
 * visible (a badge/banner), never silent. Cents-rounded throughout so float
 * noise can't flip a verdict.
 */
export function evaluateEdlpCeiling(
  item: PricingItem,
  proposedPerUnit: number,
  exception: EdlpException | undefined
): EdlpCeilingResult {
  if (item.category_type !== "everyday_low_price" || item.edlpMaxAllowedPrice == null) return OK;

  const maxCents = Math.round(item.edlpMaxAllowedPrice * 100);
  const ceilingCents = Math.round(maxCents * 1.1);
  const proposedCents = Math.round(proposedPerUnit * 100);
  const maxAllowed = maxCents / 100;
  const hardCeiling = ceilingCents / 100;
  const exceptionActive = exceptionCovers(exception, item.id);

  if (proposedCents <= maxCents) return { level: "ok", maxAllowed, hardCeiling, exceptionActive, overHardCeiling: false };
  if (proposedCents <= ceilingCents) return { level: "soft", maxAllowed, hardCeiling, exceptionActive, overHardCeiling: false };
  return { level: exceptionActive ? "soft" : "hard", maxAllowed, hardCeiling, exceptionActive, overHardCeiling: true };
}

// Effective per-unit base price the item currently carries — the pending
// decision if there is one, else the live price.
function effectivePerUnit(item: PricingItem): number {
  return item.newBasePrice != null ? perUnit(item.newBasePrice, item.newBaseQty) : item.currentBasePrice;
}

/**
 * The ceiling state of an item's CURRENTLY committed price — derived every
 * render, drives the in-drawer banner and the table/cell badge. Untouched,
 * in-range items are always "ok".
 */
export function committedEdlpCeilingState(
  item: PricingItem,
  exception: EdlpException | undefined
): EdlpCeilingResult {
  return evaluateEdlpCeiling(item, effectivePerUnit(item), exception);
}

/**
 * Catalog-wide scan of items currently priced over their EDLP maximum (soft
 * or hard, exception or not) — powers the "Over EDLP max" filter facet.
 */
export function itemIdsOverEdlpCeiling(
  items: PricingItem[],
  exception: EdlpException | undefined
): Set<string> {
  return new Set(
    items.filter((item) => committedEdlpCeilingState(item, exception).level !== "ok").map((item) => item.id)
  );
}

export type EdlpViolation = {
  itemId: string;
  itemName: string;
  proposedPerUnit: number;
  maxAllowed: number;
  hardCeiling: number;
  exceptionActive: boolean;
  /** See EdlpCeilingResult.overHardCeiling — true even when an exception
   *  keeps the violation in the `soft` bucket. */
  overHardCeiling: boolean;
};

export type EdlpChangeEvaluation = {
  /** Members whose propagated price would hard-breach with no exception coverage. */
  hard: EdlpViolation[];
  /** Members in the soft zone (over max but within +10%, or exception-covered). */
  soft: EdlpViolation[];
  /** The ids a commit on `itemId` reprices — itself, plus family members. */
  changedIds: string[];
};

/**
 * Pre-commit check of a proposed base price (per-unit) for `itemId` against
 * every EDLP member the commit would reprice — itself, or (via family price
 * propagation) any EDLP sibling. A non-EDLP item with no EDLP family members
 * always comes back clean.
 */
export function evaluateEdlpCeilingChange(
  itemId: string,
  proposedPerUnit: number,
  itemsById: Map<string, PricingItem>,
  exception: EdlpException | undefined
): EdlpChangeEvaluation {
  const item = itemsById.get(itemId);
  if (!item) return { hard: [], soft: [], changedIds: [] };

  const changedIds = familyGroupIds(item, itemsById);
  const hard: EdlpViolation[] = [];
  const soft: EdlpViolation[] = [];
  for (const id of changedIds) {
    const member = itemsById.get(id);
    if (!member) continue;
    const result = evaluateEdlpCeiling(member, proposedPerUnit, exception);
    if (result.level === "ok") continue;
    const violation: EdlpViolation = {
      itemId: member.id,
      itemName: member.name,
      proposedPerUnit,
      maxAllowed: result.maxAllowed,
      hardCeiling: result.hardCeiling,
      exceptionActive: result.exceptionActive,
      overHardCeiling: result.overHardCeiling,
    };
    (result.level === "hard" ? hard : soft).push(violation);
  }
  return { hard, soft, changedIds };
}
