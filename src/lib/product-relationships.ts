export type RelationshipType = "family" | "size_parity" | "good_better_best" | "brand_pair";

export type ProductRelationship = {
  id: string;
  type: RelationshipType;
  /** Ordered member ids — order is meaningful (small→large, good→best, private label→national). */
  itemIds: string[];
  /** Display name, e.g. "Reg Tortilla Chips 9–11 oz". */
  name: string;
  /** Per-member chip label keyed by item id ("7.75oz", "Good", "Private label"). */
  memberLabels?: Record<string, string>;
  /** Minimum adjacent-step gap (%) before a narrow-gap warning; overrides the type default. */
  minGapPct?: number;
};

export const RELATIONSHIP_META: Record<
  RelationshipType,
  {
    label: string;
    description: string;
    /** Default minimum adjacent-step gap (%). 0 = gap not enforced for this type. */
    defaultMinGapPct: number;
    /** Why an order inversion can't be saved — shown on the blocking modal card. */
    hardRule: string;
    /** Rationale appended to narrow-gap warnings; `{min}` is interpolated. */
    softRule: string;
  }
> = {
  family: {
    label: "Family",
    description: "One price for the whole family — updating any member updates all.",
    // Family equality is enforced by price propagation, never validated.
    defaultMinGapPct: 0,
    hardRule: "Family members share one price.",
    softRule: "",
  },
  size_parity: {
    label: "Size parity",
    description: "Sizes must price in order — a larger size never below a smaller one.",
    defaultMinGapPct: 5,
    hardRule: "A larger size can never price at or below a smaller one.",
    softRule: "Size steps usually hold ≥{min}% to protect trade-up.",
  },
  good_better_best: {
    label: "Good / Better / Best",
    description: "Quality ladder — each tier steps up in price.",
    defaultMinGapPct: 10,
    hardRule: "A higher tier can never price at or below a lower one — the ladder collapses.",
    softRule: "Tier steps usually hold ≥{min}% to keep the upgrade credible.",
  },
  brand_pair: {
    label: "Private label vs. national",
    description: "The store brand is priced below its national-brand equivalent.",
    defaultMinGapPct: 15,
    hardRule: "The national brand can never price at or below its private label.",
    softRule: "The store-brand gap usually holds ≥{min}% to protect its value position.",
  },
};

export function minGapFor(rel: ProductRelationship): number {
  return rel.minGapPct ?? RELATIONSHIP_META[rel.type].defaultMinGapPct;
}

export const PRODUCT_RELATIONSHIPS: ProductRelationship[] = [
  {
    id: "fl-tortilla",
    type: "family",
    name: "Reg Tortilla Chips 9–11 oz",
    itemIds: ["RBCS5-1", "RBCS5-7", "RBCS5-8"],
  },
  {
    id: "sp-lays-classic",
    type: "size_parity",
    name: "Lay's Classic Potato Chips",
    itemIds: ["RBCS5-10", "RBCS5-11", "W7BESS"],
    memberLabels: { "RBCS5-10": "7.75oz", "RBCS5-11": "13oz", "W7BESS": "18oz" },
  },
  {
    id: "gbb-potato-chips",
    type: "good_better_best",
    name: "Potato chips ladder",
    itemIds: ["EDLP-3", "W7BESS", "RBCS5-8"],
    memberLabels: { "EDLP-3": "Good", "W7BESS": "Better", "RBCS5-8": "Best" },
  },
  {
    id: "bp-tortilla-chips",
    type: "brand_pair",
    name: "Tortilla chips",
    itemIds: ["EDLP-1", "RBCS5-1"],
    memberLabels: { "EDLP-1": "Private label", "RBCS5-1": "National brand" },
  },
  {
    id: "bp-potato-chips",
    type: "brand_pair",
    name: "Potato chips",
    itemIds: ["EDLP-2", "W7BESS"],
    memberLabels: { "EDLP-2": "Private label", "W7BESS": "National brand" },
  },
];

export function relationshipsFor(itemId: string): ProductRelationship[] {
  return PRODUCT_RELATIONSHIPS.filter((r) => r.itemIds.includes(itemId));
}

export function familyRelationshipFor(itemId: string): ProductRelationship | undefined {
  return PRODUCT_RELATIONSHIPS.find((r) => r.type === "family" && r.itemIds.includes(itemId));
}
