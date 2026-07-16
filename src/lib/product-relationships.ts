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
    itemIds: ["RBCS5-1", "RBCS5-7", "RBCS5-8", "NC-3", "ND-1"],
  },
  {
    id: "fl-lays-snacks",
    type: "family",
    name: "Lay's snacks 4.75–7.75 oz",
    itemIds: ["NC-2", "ND-5"],
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
  // Broad snacks coverage (2026-07-16): in a real assortment almost every SKU
  // sits in SOME ladder or line — the catalog should read that way too. Every
  // group below is VALID at its seeded (pending-or-live) prices, including
  // after accepting any member's HQ rec; minGapPct overrides keep tight-but-
  // legitimate seeded gaps from warning out of the box.
  {
    id: "gbb-crackers",
    type: "good_better_best",
    name: "Crackers ladder",
    itemIds: ["RBCS5-9", "HQ-101", "HQ-102"],
    memberLabels: { "RBCS5-9": "Good", "HQ-101": "Better", "HQ-102": "Best" },
    minGapPct: 8,
  },
  {
    id: "sp-popcorn",
    type: "size_parity",
    name: "Popcorn",
    itemIds: ["HQ-107", "HQ-103", "HQ-104"],
    memberLabels: { "HQ-107": "4.4oz", "HQ-103": "6ct", "HQ-104": "6ct XL" },
    minGapPct: 4,
  },
  {
    id: "gbb-pretzels",
    type: "good_better_best",
    name: "Pretzels ladder",
    itemIds: ["HQ-108", "NC-5"],
    memberLabels: { "HQ-108": "Good", "NC-5": "Better" },
  },
  {
    id: "sp-cheese-grain",
    type: "size_parity",
    name: "Cheese & grain snacks",
    itemIds: ["NC-4", "RBCS5-6", "RBCS5-2"],
    memberLabels: { "NC-4": "6.75oz", "RBCS5-6": "7oz", "RBCS5-2": "8.5oz" },
    minGapPct: 4,
  },
  {
    id: "sp-ruffles",
    type: "size_parity",
    name: "Ruffles",
    itemIds: ["ND-6", "RBCS5-3"],
    memberLabels: { "ND-6": "7.25oz", "RBCS5-3": "8oz" },
  },
  {
    id: "gbb-tortilla-party",
    type: "good_better_best",
    name: "Party tortilla chips",
    itemIds: ["EDLP-4", "RBCS5-5"],
    memberLabels: { "EDLP-4": "Good", "RBCS5-5": "Better" },
  },
  {
    id: "gbb-snacksize",
    type: "good_better_best",
    name: "Snack-size chips",
    itemIds: ["EDLP-5", "RBCS5-4"],
    memberLabels: { "EDLP-5": "Good", "RBCS5-4": "Better" },
    minGapPct: 8,
  },
  {
    id: "gbb-nuts-mix",
    type: "good_better_best",
    name: "Nuts & snack mix",
    itemIds: ["EDLP-6", "HQ-105"],
    memberLabels: { "EDLP-6": "Good", "HQ-105": "Better" },
  },
  {
    id: "gbb-kettle",
    type: "good_better_best",
    name: "Kettle chips",
    itemIds: ["NC-6", "RBCS5-8"],
    memberLabels: { "NC-6": "Good", "RBCS5-8": "Better" },
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

/**
 * Append (or replace, by id) generated relationships — used by mock-data to
 * register the synthetic catalog's per-subcategory families and size ladders
 * at module load. Id-keyed upsert keeps dev Fast Refresh re-evaluations from
 * duplicating entries.
 */
export function registerRelationships(rels: ProductRelationship[]): void {
  for (const rel of rels) {
    const at = PRODUCT_RELATIONSHIPS.findIndex((r) => r.id === rel.id);
    if (at >= 0) PRODUCT_RELATIONSHIPS[at] = rel;
    else PRODUCT_RELATIONSHIPS.push(rel);
  }
}

export function relationshipsFor(itemId: string): ProductRelationship[] {
  return PRODUCT_RELATIONSHIPS.filter((r) => r.itemIds.includes(itemId));
}

/** The minimum % gap this relationship enforces between adjacent ranks. */
export function minGapFor(rel: ProductRelationship): number {
  return rel.minGapPct ?? RELATIONSHIP_META[rel.type].defaultMinGapPct;
}

