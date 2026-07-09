export type PricingCategory =
  | "base"
  | "temporary_allowance"
  | "everyday_low_price"
  | "no_change"
  | "new_discontinued";

export type ItemRole = "Traffic driver" | "Margin driver" | "Destination" | "Convenience";

/** A competitor's shelf price for the same (or equivalent) item. */
export type CompetitorPrice = {
  name: string;
  price: number;
  /** Distance to the competitor store, in miles. */
  distanceMi?: number;
};
export type NationalVsStore = "National" | "Store";
/** Why HQ proposed a price change. A director's own price is a "local ad hoc"
 *  decision — that value is derived, never stored (see price-change-reason.ts). */
export type HqChangeReason = "cost_change" | "competitor_move" | "category_review";
/**
 * A store-level trigger that motivates a director-initiated change with NO HQ
 * recommendation — the item's cost moved, or a competitor moved. Powers the
 * "Cost changes" / "Competitor moves" view lenses. (Category reviews are always
 * HQ-driven, so they never appear here.)
 */
export type StoreChangeReason = "cost_change" | "competitor_move";
/**
 * The reason a director attaches to a store-originated change. Auto-populated
 * from the lens the item was opened from, then editable (see price-change-reason.ts).
 */
export type StoreOriginReason = "store_cost" | "store_competitor" | "local_ad_hoc";
export type Sensitivity = "H" | "M" | "L";
export type ImpactLevel = "High" | "Medium" | "Low";
export type OverrideStatus = "pending" | "in_batch" | "submitted" | "confirmed";
export type BatchStatus = "scheduled" | "submitted" | "confirmed";

export type PricingItem = {
  id: string;
  image?: string;
  name: string;
  aisle: string;
  category: string;
  subcategory: string;
  brand: string;
  packSize: string;
  keyAttributes: string[];
  nationalVsStore: NationalVsStore;
  itemRole: ItemRole;
  sensitivity: Sensitivity;
  /** Supplier/vendor of record (distinct from the consumer brand). */
  vendorName?: string;
  /** Known Value Item — a price shoppers watch closely. Drives a drawer badge. */
  isKvi?: boolean;
  /** Display name of the price family this item belongs to (e.g. "Reg Chips 11.5 oz"). */
  priceFamilyName?: string;
  // Base price fields
  currentBasePrice: number;
  cost: number;
  recommendedBasePrice: number;
  newBasePrice: number | null; // null = using recommended
  /**
   * SAP PMR-managed maximum allowed price (per-unit), for EDLP items only —
   * the store can price up to 10% over this before the hard stop kicks in
   * (see `lib/edlp-ceiling.ts`). Undefined for every other category_type.
   */
  edlpMaxAllowedPrice?: number;
  /** Total price for `newBaseQty` units (pack-size deal). qty 1 (or null) = single-unit price. */
  newBaseQty?: number | null;
  // Temp allowance fields (only for temporary_allowance category)
  currentRetailPrice?: number;
  /** Net cost during the allowance period (vendor-funded discount applied). */
  allowanceCost?: number;
  recommendedRetailPrice?: number;
  /** Total price for `newRetailQty` units. qty 1 (or null) = single-unit price. */
  newRetailPrice?: number | null;
  newRetailQty?: number | null;
  /** Fuel saver currently live on the shelf (the "before" in the table column). */
  currentFuelSaver?: number | null;
  /** HQ-proposed fuel saver, when one is recommended (renders as an HQ pill). */
  recommendedFuelSaver?: number | null;
  /** The director's chosen fuel saver (the "after"). null/0 = none. */
  fuelSaver?: number | null;
  /** The window the fuel saver runs (independent of the allowance window). */
  fuelSaverStartDate?: string | null;
  fuelSaverEndDate?: string | null;
  allowanceStartDate?: string | null;
  allowanceEndDate?: string | null;
  // New / discontinued
  itemStatus?: "new" | "discontinued";
  // Context that motivates a store-level price override (shown in the drawer)
  competitors?: CompetitorPrice[];
  /** Ids of items frequently bought/priced together (cross-sell context). */
  relatedItemIds?: string[];
  /**
   * Family key. Items sharing a family are priced as one — editing any
   * member updates the whole family.
   */
  familyId?: string;
  // Impact (computed/received from HQ)
  impactSalesValue: number;
  impactSalesPct: number;
  impactUnitsValue: number;
  impactUnitsPct: number;
  impactMarginValue: number;
  impactMarginPct: number;
  impactConfidence: ImpactLevel;
  impactGmPct: number;
  // Override tracking (one status per editable price field)
  hasOverride: boolean;
  baseOverrideStatus?: OverrideStatus;
  retailOverrideStatus?: OverrideStatus;
  hasAlert?: boolean;
  /** Accepted as-is (no changes) — removes the item from the review queue. */
  reviewed?: boolean;
  /**
   * HQ has a recommendation for this item awaiting the director's decision. The
   * proposal is NOT live in SAP — `recommendedBasePrice` holds HQ's proposed
   * price while `currentBasePrice` stays the live price. The director decides:
   * accept (apply the rec), override (apply their own price), or keep current
   * (reject). Accept/override create a pending change to send; keep sends nothing.
   * The queue clears the item once it's decided.
   */
  hqReviewPending?: boolean;
  /** The reason HQ attached to its recommendation (set alongside hqReviewPending). */
  hqChangeReason?: HqChangeReason;
  /**
   * Store-level triggers awaiting the director's reaction, with NO HQ
   * recommendation (cost moved and/or a competitor moved). Drives the item's
   * membership in the "Cost changes" / "Competitor moves" view lenses. An item
   * can carry both.
   */
  storeSignals?: StoreChangeReason[];
  /**
   * The director's chosen reason for a store-originated change. Auto-populated
   * from the opening lens (see `setChangeReason`), then editable in the drawer.
   * Unlike HQ reasons this IS stored, because a store change has no recommendation
   * to derive the reason from.
   */
  chosenChangeReason?: StoreOriginReason;
  /**
   * Demo-only: the last send to SAP failed. Renders a "Failed" status badge.
   * Visual state only — no real retry/timed-revert is wired.
   */
  sendFailed?: boolean;
  category_type: PricingCategory;
  /**
   * The pricing strategy currently live in SAP. `category_type` is the strategy
   * now assigned to the item (possibly a pending change); when `sapStrategy`
   * differs, the store converted the item's strategy (e.g. Base → EDLP), which
   * the Change Summary surfaces as "Converted to …". Defaults to `category_type`.
   */
  sapStrategy?: PricingCategory;
  /**
   * Set when the price type was auto-switched on edit (e.g. `no_change` → `base`
   * when the user typed a price). Lets us revert to the original type if the
   * edit is cleared. Cleared the moment the user picks a type manually.
   */
  autoTypedFrom?: PricingCategory | null;
};

export type PriceField = "base" | "retail";

// Override id is deterministic: `${itemId}:${priceField}` — an item can carry
// at most one base and one retail override, and edits upsert in place.
export type Override = {
  id: string;
  itemId: string;
  itemName: string;
  changeType: PricingCategory;
  priceField: PriceField;
  currentPrice: number;
  /** Total price for `qty` units when qty > 1 (multi-unit deal). */
  newPrice: number;
  qty?: number;
  sequence?: string;
  status: OverrideStatus;
  batchId?: string;
  /** Last time this edit was touched — drives recent-first ordering in All items. */
  updatedAt?: number;
};

export type Batch = {
  id: string;
  name: string;
  status: BatchStatus;
  overrideIds: string[];
  createdAt: string;
  /**
   * Multi-store fan-out. A director who runs several stores can apply one batch
   * to many of them at once. The batch is authored in `originStoreId` and
   * replicated into each target store's slice; the copies share a `groupId` so
   * scheduling/sending acts on the whole group. Absent on legacy/single-store
   * batches (treated as origin-only).
   */
  originStoreId?: string;
  targetStoreIds?: string[];
  groupId?: string;
  /**
   * Future send date/time (ISO, `YYYY-MM-DDTHH:mm:00`). Required in practice —
   * every batch is created already scheduled (date + time); SAP sends then.
   */
  scheduledAt?: string;
  /** Set when the batch is sent to SAP. */
  submittedAt?: string;
  /** SAP reference returned on confirmation (post-submit acknowledgment). */
  sapReference?: string;
  confirmedAt?: string;
};

export type SummaryMetrics = {
  salesCurrent: number;
  salesNew: number;
  salesImpactPct: number;
  unitsCurrent: number;
  unitsNew: number;
  unitsImpactPct: number;
  marginCurrent: number;
  marginNew: number;
  marginImpactPct: number;
  transactionsCurrent: number;
  transactionsNew: number;
  transactionsImpactPct: number;
  ciVsCompCurrent: number;
  ciVsCompNew: number;
};

export type CategorySummary = {
  type: PricingCategory;
  label: string;
  description: string;
  newPricesFromHQ: number;
  priceOverrides: number;
  alerts: number;
};
