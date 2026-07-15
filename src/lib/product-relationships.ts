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
  /** Minimum % gap between adjacent ranks; falls back to the type default. */
  minGapPct?: number;
};

export const RELATIONSHIP_META: Record<
  RelationshipType,
  {
    label: string;
    /** Default minimum % gap between adjacent ranks (0 = never gap-checked). */
    defaultMinGapPct: number;
    /** Appended to hard (order-inversion) violation messages. */
    hardRule: string;
    /** Appended to soft (narrow-gap) violation messages; {min} interpolated. */
    softRule: string;
  }
> = {
  family: {
    label: "Line pricing",
    // Equality is enforced by price propagation, never validated as a gap.
    defaultMinGapPct: 0,
    hardRule: "Line-priced items share one price.",
    softRule: "",
  },
  size_parity: {
    label: "Size groups",
    defaultMinGapPct: 5,
    hardRule: "A larger size can never price at or below a smaller one.",
    softRule: "Size steps usually hold ≥{min}% to protect trade-up.",
  },
  good_better_best: {
    label: "Good better best",
    defaultMinGapPct: 10,
    hardRule: "A higher tier can never price at or below a lower one — the ladder collapses.",
    softRule: "Tier steps usually hold ≥{min}% to keep the upgrade credible.",
  },
  brand_pair: {
    label: "Private Label / National brand",
    defaultMinGapPct: 15,
    hardRule: "The national brand can never price at or below its private label.",
    softRule: "The private-label gap usually holds ≥{min}% to protect its value position.",
  },
};

/** Display order for rendering per-relationship sections. */
export const RELATIONSHIP_TYPE_ORDER: RelationshipType[] = [
  "family",
  "brand_pair",
  "good_better_best",
  "size_parity",
];

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
  {
    // Large-group fixture: real relationships can span dozens of items, and
    // the break UI must stay usable at that size (windowed member lists).
    // SKU-1001..1022 seed with monotonically increasing prices, so the rank
    // order below is already a valid ladder.
    id: "sp-center-store-band",
    type: "size_parity",
    name: "Center-store price band",
    itemIds: Array.from({ length: 22 }, (_, i) => `SKU-${1001 + i}`),
  },
];

export function relationshipsFor(itemId: string): ProductRelationship[] {
  return PRODUCT_RELATIONSHIPS.filter((r) => r.itemIds.includes(itemId));
}

/** The minimum % gap this relationship enforces between adjacent ranks. */
export function minGapFor(rel: ProductRelationship): number {
  return rel.minGapPct ?? RELATIONSHIP_META[rel.type].defaultMinGapPct;
}

