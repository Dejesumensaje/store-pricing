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
  /**
   * The competitor's active TPR/promo shelf price for this item, when one is
   * currently running. Absent = no TPR currently running at that competitor
   * (they're selling at their base `price`).
   */
  retailPrice?: number;
  /** Distance to the competitor store, in miles. */
  distanceMi?: number;
  /** Street address of the competitor store, e.g. "123 Main St, Madison WI". */
  address?: string;
};
export type NationalVsStore = "National" | "Store";
/**
 * Change Reason is per pricing-section, not per item — Base, Retail, and Fuel
 * Saver each carry their own reason, from their own catalog (see
 * price-change-reason.ts). HQ's reason is set alongside its recommendation for
 * that section; a director's store-originated reason is picked in the drawer.
 */
/** HQ's reason for a Base price recommendation. */
export type HqBaseReason = "cost_change" | "competitor_change" | "hq_pricing_review" | "other";
/** HQ's reason for a Retail or Fuel Saver recommendation — one shared catalog. */
export type HqPromoReason = "discontinued" | "allowance" | "displays" | "wow_buy";
/** A director's reason for a store-originated Base price change — no default; required before Done. */
export type StoreBaseReason = "cost_change" | "competitor_change" | "other";
/** A director's reason for a store-originated Retail or Fuel Saver change — one shared catalog, no default. */
export type StorePromoReason =
  | "manager_special"
  | "soon_to_expiry"
  | "obsolete_inventory"
  | "discontinued_mc060220"
  | "allowance"
  | "buys"
  | "displays"
  | "excess_stock"
  | "local_deal"
  | "wow_buy"
  | "four_by_four";
export type Sensitivity = "H" | "M" | "L";
export type ImpactLevel = "High" | "Medium" | "Low";
export type OverrideStatus = "pending" | "confirmed";

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
  /**
   * The date the store's Base price change takes effect — required once a
   * price is set. Today or any future date; Base prices are open-ended, so
   * there is no end date to collect here — the backend sends 12/31/9999 as
   * SAP's validity end automatically, and NOW() in place of a "today" pick.
   * Both are backend-only details with no UI representation.
   */
  baseEffectiveDate?: string | null;
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
  /**
   * The director declined THIS section's HQ recommendation ("Keep current" /
   * "No promotion" / "No fuel saver"). Scoped per section — declining the fuel
   * saver must not decide a pending base or retail rec on the same item. A
   * section is decided when it has a new price/amount OR its declined flag;
   * the item leaves the review queue when every rec-bearing section is decided
   * (see item-status.ts). A declined section's later price change is a fresh
   * store-originated decision — its HQ reason no longer applies (the hq*Reason
   * field itself is kept immutable for provenance traces).
   */
  baseReviewed?: boolean;
  retailReviewed?: boolean;
  fuelReviewed?: boolean;
  /**
   * HQ has a recommendation for this item awaiting the director's decision. The
   * proposal is NOT live in SAP — `recommendedBasePrice` holds HQ's proposed
   * price while `currentBasePrice` stays the live price. The director decides:
   * accept (apply the rec), override (apply their own price), or keep current
   * (reject). Accept/override create a pending change to send; keep sends nothing.
   * The queue clears the item once it's decided.
   */
  hqReviewPending?: boolean;
  /** The reason HQ attached to its Base price recommendation (set alongside recommendedBasePrice). */
  hqBaseReason?: HqBaseReason;
  /** The reason HQ attached to its Retail price recommendation (set alongside recommendedRetailPrice). */
  hqRetailReason?: HqPromoReason;
  /** The reason HQ attached to its Fuel Saver recommendation (set alongside recommendedFuelSaver). */
  hqFuelReason?: HqPromoReason;
  /**
   * The director's chosen reason for a Base price change, editable in the
   * drawer. No default — starts unselected (placeholder) until the director
   * actively picks one; the drawer blocks Done while a decided price has no
   * reason. Store-originated changes pick from the Store Base catalog; an
   * HQ-originated section (accepted rec or custom price on a pending rec)
   * starts from the HQ reason and may be re-picked from the HQ Base catalog —
   * when set, the chosen reason wins over hq*Reason (see changeReasonFor).
   */
  chosenBaseReason?: StoreBaseReason | HqBaseReason;
  /**
   * The director's chosen reason for a Retail price change — same rules as
   * chosenBaseReason, with the Store Promo / HQ Promo catalogs.
   */
  chosenRetailReason?: StorePromoReason | HqPromoReason;
  /**
   * The director's chosen reason for a Fuel Saver change — same rules as
   * chosenRetailReason (the promo catalogs are shared).
   */
  chosenFuelReason?: StorePromoReason | HqPromoReason;
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
  /**
   * Set when a plain (non-TA) item is converted to `temporary_allowance` via
   * `updatePriceType`. Stores the original `category_type` so that
   * `removeFromLooseTray` can restore it when a committed retail price is
   * reverted — including across drawer close/reopen, where component-local
   * `preConversionType` state is reset. Cleared once the revert completes or
   * the type is set back to non-TA.
   */
  retailAutoTypedFrom?: PricingCategory | null;
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
  /** Last time this edit was touched — drives recent-first ordering in All items. */
  updatedAt?: number;
};

