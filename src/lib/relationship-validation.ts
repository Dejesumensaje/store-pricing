import { PricingItem } from "@/types/pricing";
import {
  ProductRelationship,
  RELATIONSHIP_META,
  relationshipsFor,
  minGapFor,
} from "./product-relationships";
import { perUnit, fmtPct } from "./pricing-math";
import { fmt } from "./format";

export type ViolationKind = "hard" | "soft";

export type Violation = {
  kind: ViolationKind;
  relationship: ProductRelationship;
  /** The member whose price is (or would be) out of line — the one being changed. */
  offenderId: string;
  comparatorId: string;
  /** Effective per-unit prices used in the comparison. */
  offenderPrice: number;
  comparatorPrice: number;
  /** Gap (%) of the higher-ranked member over the lower-ranked one. */
  gapPct: number;
  /** The threshold that tripped (soft only). */
  minGapPct?: number;
  /** Full sentence for the modal card / warning banner. */
  message: string;
  /** Other members of the relationship (drives the "Affected:" line). */
  affectedIds: string[];
};

export type BaseChangeEvaluation = {
  hard: Violation[];
  soft: Violation[];
  /** The edited item plus its family members — the ids the commit will reprice. */
  changedIds: string[];
  /** Dedup union of hard-violated relationships' other members — Scale targets. */
  scaleTargets: string[];
  /** proposedPerUnit / currentBasePrice − 1 (fraction, e.g. −0.6503). */
  deltaPct: number;
};

// Effective per-unit base price: the proposal under evaluation if this id is
// part of it, else the pending decision, else the live price.
function effectivePerUnit(item: PricingItem, proposed?: Map<string, number>): number {
  const p = proposed?.get(item.id);
  if (p != null) return p;
  return item.newBasePrice != null ? perUnit(item.newBasePrice, item.newBaseQty) : item.currentBasePrice;
}

// Member name for messages, with the rank label appended when it adds meaning
// ("Best", "National brand") — size labels already live in the item name.
function memberName(rel: ProductRelationship, item: PricingItem): string {
  const label = rel.memberLabels?.[item.id];
  if (label && !item.name.toLowerCase().includes(label.toLowerCase())) return `${item.name} (${label})`;
  return item.name;
}

// Walk every non-family relationship's adjacent pairs (index order = rank
// order: small→large, good→best, private label→national) and collect order
// inversions (hard) and narrow gaps (soft). A pair is only evaluated when one
// of its sides is in `mustInclude` — pre-existing problems elsewhere in a
// ladder never block an unrelated member's edit.
function checkRelationships(
  rels: ProductRelationship[],
  mustInclude: Set<string>,
  primaryId: string,
  itemsById: Map<string, PricingItem>,
  proposed?: Map<string, number>
): Violation[] {
  const violations: Violation[] = [];
  for (const rel of rels) {
    // Line-priced equality is enforced by price propagation, never validated here.
    if (rel.type === "family") continue;
    const meta = RELATIONSHIP_META[rel.type];
    const minGap = minGapFor(rel);
    for (let i = 0; i < rel.itemIds.length - 1; i++) {
      const low = itemsById.get(rel.itemIds[i]);
      const high = itemsById.get(rel.itemIds[i + 1]);
      if (!low || !high) continue;
      if (!mustInclude.has(low.id) && !mustInclude.has(high.id)) continue;

      const lowPrice = effectivePerUnit(low, proposed);
      const highPrice = effectivePerUnit(high, proposed);
      // Compare in whole cents so float noise can't flip a verdict.
      const lowCents = Math.round(lowPrice * 100);
      const highCents = Math.round(highPrice * 100);
      const gapPct = lowCents > 0 ? (highCents / lowCents - 1) * 100 : 0;

      // The offender is the side being changed; when both are, the edited item.
      const offenderIsHigh =
        mustInclude.has(high.id) && (high.id === primaryId || !mustInclude.has(low.id));
      const offender = offenderIsHigh ? high : low;
      const comparator = offenderIsHigh ? low : high;
      const offenderPrice = offenderIsHigh ? highPrice : lowPrice;
      const comparatorPrice = offenderIsHigh ? lowPrice : highPrice;

      const base = {
        relationship: rel,
        offenderId: offender.id,
        comparatorId: comparator.id,
        offenderPrice,
        comparatorPrice,
        gapPct,
        affectedIds: rel.itemIds.filter((id) => id !== offender.id),
      };
      if (highCents <= lowCents) {
        violations.push({
          ...base,
          kind: "hard",
          message: `${memberName(rel, offender)} would land at ${fmt(offenderPrice)} — at or ${offenderIsHigh ? "below" : "above"} ${memberName(rel, comparator)} (${fmt(comparatorPrice)}). ${meta.hardRule}`,
        });
      } else if (minGap > 0 && gapPct < minGap - 0.05) {
        violations.push({
          ...base,
          kind: "soft",
          minGapPct: minGap,
          message: `Narrow gap — only ${fmtPct(gapPct)} ${offenderIsHigh ? "above" : "below"} ${memberName(rel, comparator)} (${fmt(comparatorPrice)}). ${meta.softRule.replace("{min}", String(minGap))}`,
        });
      }
    }
  }
  return violations;
}

// The ids a base-price commit on `item` will actually reprice — the item plus
// every family member (mirrors the propagation in updateBasePrice; edlp-ceiling.ts
// carries its own private copy of this grouping).
export function familyGroupIds(item: PricingItem, itemsById: Map<string, PricingItem>): string[] {
  if (!item.familyId) return [item.id];
  return [...itemsById.values()].filter((i) => i.familyId === item.familyId).map((i) => i.id);
}

function relationshipsTouching(ids: string[]): ProductRelationship[] {
  const seen = new Map<string, ProductRelationship>();
  for (const id of ids) for (const rel of relationshipsFor(id)) seen.set(rel.id, rel);
  return [...seen.values()];
}

/** Pre-commit check of a proposed base price (per-unit) for `itemId`. */
export function evaluateBaseChange(
  itemId: string,
  proposedPerUnit: number,
  itemsById: Map<string, PricingItem>
): BaseChangeEvaluation {
  const item = itemsById.get(itemId);
  if (!item) return { hard: [], soft: [], changedIds: [], scaleTargets: [], deltaPct: 0 };

  const changedIds = familyGroupIds(item, itemsById);
  const proposed = new Map(changedIds.map((id) => [id, proposedPerUnit]));
  const violations = checkRelationships(
    relationshipsTouching(changedIds),
    new Set(changedIds),
    itemId,
    itemsById,
    proposed
  );
  const hard = violations.filter((v) => v.kind === "hard");
  const soft = violations.filter((v) => v.kind === "soft");

  const deltaPct = item.currentBasePrice > 0 ? proposedPerUnit / item.currentBasePrice - 1 : 0;
  // Scale repositions every member of each hard-violated relationship by the
  // same %, preserving the ladder's internal gaps. Without a meaningful delta
  // there is nothing to scale.
  const scaleTargets =
    deltaPct === 0
      ? []
      : [
          ...new Set(
            hard.flatMap((v) => v.relationship.itemIds).filter((id) => !changedIds.includes(id))
          ),
        ];

  return { hard, soft, changedIds, scaleTargets, deltaPct };
}

/**
 * The per-unit price range for `itemId` (and its family — they share one
 * price) that satisfies every relationship it belongs to at FULL validity
 * (order + minimum gaps), against the members' pending-or-live prices.
 * `min`/`max` are null when that side is unconstrained. Returns null when the
 * bounds cross — no single price can satisfy every ladder.
 */
export type PriceWindow = { min: number | null; max: number | null };

export function validPriceWindow(
  itemId: string,
  itemsById: Map<string, PricingItem>
): PriceWindow | null {
  const item = itemsById.get(itemId);
  if (!item) return { min: null, max: null };
  const changed = new Set(familyGroupIds(item, itemsById));

  let min: number | null = null;
  let max: number | null = null;
  for (const rel of relationshipsTouching([...changed])) {
    if (rel.type === "family") continue;
    const g = minGapFor(rel) / 100;
    for (let i = 0; i < rel.itemIds.length - 1; i++) {
      const low = itemsById.get(rel.itemIds[i]);
      const high = itemsById.get(rel.itemIds[i + 1]);
      if (!low || !high) continue;
      const lowChanged = changed.has(low.id);
      const highChanged = changed.has(high.id);
      // Two family members on adjacent ranks would always collide (they share
      // one price) — not solvable by choosing the price; skip.
      if (lowChanged === highChanged) continue;
      if (highChanged) {
        // We are the higher rank: stay at least the gap above the comparator.
        const bound = Math.ceil(effectivePerUnit(low) * (1 + g) * 100) / 100;
        min = min == null ? bound : Math.max(min, bound);
      } else {
        // We are the lower rank: stay at least the gap below the comparator.
        const bound = Math.floor((effectivePerUnit(high) / (1 + g)) * 100) / 100;
        max = max == null ? bound : Math.min(max, bound);
      }
    }
  }
  if (min != null && max != null && min > max) return null;
  return { min, max };
}

export type RepairChange = {
  itemId: string;
  /** Pending-or-live per-unit price before the repair. */
  from: number;
  /** Per-unit price after the repair. */
  to: number;
};

export type RepairPlan = {
  changes: RepairChange[];
  /** Violations still present after the plan — ladders that mutually conflict. */
  residuals: Violation[];
};

/**
 * Minimal repair for a hard break: keep the edited item at its proposed
 * per-unit price and move ONLY the neighbors that must move, each just far
 * enough to restore rank order plus the minimum gap. Repairs cascade — a
 * moved neighbor is re-checked against its own other relationships (bounded
 * passes) and moving a family member carries its whole family. A neighbor
 * pulled in two opposite directions is left alone and reported in
 * `residuals` instead.
 */
export function planLadderRepair(
  itemId: string,
  proposedPerUnit: number,
  itemsById: Map<string, PricingItem>
): RepairPlan {
  const item = itemsById.get(itemId);
  if (!item) return { changes: [], residuals: [] };
  const anchors = new Set(familyGroupIds(item, itemsById));
  // Working per-unit prices: the proposal on the anchors, repairs as they land.
  const working = new Map<string, number>();
  for (const id of anchors) working.set(id, proposedPerUnit);
  const direction = new Map<string, 1 | -1>();

  const priceOf = (m: PricingItem) => working.get(m.id) ?? effectivePerUnit(m);
  // Repairing a family member reprices its whole family (updateBasePrice propagates).
  const applyRepair = (target: PricingItem, to: number, dir: 1 | -1) => {
    const ids = familyGroupIds(target, itemsById);
    for (const id of ids) {
      working.set(id, to);
      direction.set(id, dir);
    }
  };

  for (let pass = 0; pass < 30; pass++) {
    let touched = false;
    for (const rel of relationshipsTouching([...working.keys()])) {
      if (rel.type === "family") continue;
      const g = minGapFor(rel) / 100;
      for (let i = 0; i < rel.itemIds.length - 1; i++) {
        const low = itemsById.get(rel.itemIds[i]);
        const high = itemsById.get(rel.itemIds[i + 1]);
        if (!low || !high) continue;
        // Same scoping as validation: pre-existing problems in untouched
        // corners of a ladder are not this repair's to fix.
        if (!working.has(low.id) && !working.has(high.id)) continue;
        const lowC = Math.round(priceOf(low) * 100);
        const highC = Math.round(priceOf(high) * 100);
        if (highC > lowC && (highC / lowC - 1) * 100 >= g * 100 - 0.05) continue;

        // The violated pair: hold the anchored/already-repaired side, move the
        // other just enough. An item may be re-repaired further in the SAME
        // direction (a cascade tightening); an opposite pull is a conflict.
        const lowHeld = anchors.has(low.id) || working.has(low.id);
        const highHeld = anchors.has(high.id) || working.has(high.id);
        let target: PricingItem;
        let to: number;
        let dir: 1 | -1;
        if (highHeld && !anchors.has(low.id) && (!lowHeld || direction.get(low.id) === -1)) {
          target = low;
          to = Math.floor((priceOf(high) / (1 + g)) * 100) / 100;
          dir = -1;
          if (working.has(low.id) && to >= priceOf(low)) continue; // already low enough
        } else if (lowHeld && !anchors.has(high.id) && (!highHeld || direction.get(high.id) === 1)) {
          target = high;
          to = Math.ceil(priceOf(low) * (1 + g) * 100) / 100;
          dir = 1;
          if (working.has(high.id) && to <= priceOf(high)) continue; // already high enough
        } else {
          continue; // both sides pinned in conflicting directions → residual
        }
        applyRepair(target, to, dir);
        touched = true;
      }
    }
    if (!touched) break;
  }

  const changes: RepairChange[] = [...working.entries()]
    .filter(([id]) => !anchors.has(id))
    .map(([id, to]) => {
      const m = itemsById.get(id)!;
      return { itemId: id, from: effectivePerUnit(m), to };
    });

  const residuals = checkRelationships(
    relationshipsTouching([...working.keys()]),
    new Set(working.keys()),
    itemId,
    itemsById,
    working
  );

  return { changes, residuals };
}

/**
 * Soft violations present in the CURRENT committed prices — derived state for
 * the persistent warning banner and the relationship-row highlights. Only
 * relationships where the item (or a family member) carries a pending base
 * change are evaluated, so untouched items never warn.
 */
export function committedSoftWarnings(
  itemId: string,
  itemsById: Map<string, PricingItem>
): Violation[] {
  const item = itemsById.get(itemId);
  if (!item) return [];
  const pendingIds = familyGroupIds(item, itemsById).filter(
    (id) => itemsById.get(id)?.newBasePrice != null
  );
  if (pendingIds.length === 0) return [];
  return checkRelationships(
    relationshipsTouching(pendingIds),
    new Set(pendingIds),
    itemId,
    itemsById
  ).filter((v) => v.kind === "soft");
}
