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
    // Family equality is enforced by price propagation, never validated here.
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
// every family member (mirrors the propagation in updateBasePrice). Exported
// for edlp-ceiling.ts, which needs the same family group to check every
// propagated member against its own EDLP maximum.
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

/**
 * Catalog-wide read of `committedSoftWarnings`: the ids of every item that
 * currently carries an unresolved narrow-gap warning — powers the "Pricing
 * conflicts" filter facet so a director can see these before batching,
 * without opening each item's drawer one by one.
 */
export function itemIdsWithSoftViolations(
  items: PricingItem[],
  itemsById: Map<string, PricingItem>
): Set<string> {
  return new Set(
    items
      .filter((item) => committedSoftWarnings(item.id, itemsById).length > 0)
      .map((item) => item.id)
  );
}
