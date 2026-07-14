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
};

export const RELATIONSHIP_META: Record<RelationshipType, { label: string }> = {
  family: { label: "Line pricing" },
  size_parity: { label: "Size groups" },
  good_better_best: { label: "Good better best" },
  brand_pair: { label: "Private Label / National brand" },
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
];

export function relationshipsFor(itemId: string): ProductRelationship[] {
  return PRODUCT_RELATIONSHIPS.filter((r) => r.itemIds.includes(itemId));
}

