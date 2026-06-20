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
export type Sensitivity = "H" | "M" | "L";
export type ImpactLevel = "High" | "Medium" | "Low";
export type OverrideStatus = "pending" | "in_batch" | "submitted" | "confirmed";
export type BatchStatus = "draft" | "scheduled" | "submitted" | "confirmed";

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
  // Base price fields
  currentBasePrice: number;
  cost: number;
  recommendedBasePrice: number;
  newBasePrice: number | null; // null = using recommended
  // Temp allowance fields (only for temporary_allowance category)
  currentRetailPrice?: number;
  /** Net cost during the allowance period (vendor-funded discount applied). */
  allowanceCost?: number;
  recommendedRetailPrice?: number;
  /** Total price for `newRetailQty` units. qty 1 (or null) = single-unit price. */
  newRetailPrice?: number | null;
  newRetailQty?: number | null;
  fuelSaver?: number | null;
  allowanceStartDate?: string | null;
  allowanceEndDate?: string | null;
  // New / discontinued
  itemStatus?: "new" | "discontinued";
  // Context that motivates a store-level price override (shown in the drawer)
  competitors?: CompetitorPrice[];
  /** Ids of items frequently bought/priced together (cross-sell context). */
  relatedItemIds?: string[];
  /**
   * Line-price group key. Items sharing a key are priced as a line — editing
   * one suggests propagating the same price across the group.
   */
  linePriceGroup?: string;
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
   * HQ pushed this price and it's ALREADY live in SAP. The store reviews it:
   * keep (no-op, nothing sent) or override (sent). The queue clears the item
   * once it's reviewed or overridden.
   */
  hqReviewPending?: boolean;
  category_type: PricingCategory;
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
};

export type Batch = {
  id: string;
  name: string;
  status: BatchStatus;
  overrideIds: string[];
  createdAt: string;
  /** Future send date/time (ISO). Set when the batch is scheduled instead of sent now. */
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
