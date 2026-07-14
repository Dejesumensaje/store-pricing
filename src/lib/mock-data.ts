// ─── INTEGRATION SEAM ────────────────────────────────────────────────────────
// This file is the ONLY data source in the MVP. To connect a real backend:
//   1. Replace the body of loadStoreData() in src/lib/api.ts with a real fetch
//   2. Wire each Zustand action in pricing-store.ts to call commitDecision()
//   3. The API contract is src/types/pricing.ts — PricingItem is what the
//      backend must return; Override is what the store sends on each edit
// ─────────────────────────────────────────────────────────────────────────────

import { PricingItem, Override, CompetitorPrice, ItemRole, Sensitivity, HqBaseReason, HqPromoReason } from "@/types/pricing";
import { STORES, DEFAULT_STORE_ID } from "@/lib/store-config";
import { round2 } from "@/lib/pricing-math";

// Deterministic (no Math.random — hydration must be stable) char-code sum,
// used below to decide which competitors have an active TPR on a given item.
const idCharCodeSum = (id: string) => [...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

// Family pricing: the one seeded family in this catalog — a store editing any
// member's base price updates them all (see updateBasePrice).
const FAMILY_IDS: Record<string, string> = {
  "RBCS5-1": "fl-tortilla",
  "RBCS5-7": "fl-tortilla",
  "RBCS5-8": "fl-tortilla",
};
const FAMILY_NAMES: Record<string, string> = {
  "fl-tortilla": "Reg Tortilla Chips 9–11 oz",
};

// Synthesize believable competitor prices + temp-allowance fields for every
// item, so the drawer always has context and ANY item can be switched to a
// temporary allowance (retail price + fuel saver) on the fly.
function enrichItemContext(item: PricingItem): PricingItem {
  const base = item.currentBasePrice;
  const idSum = idCharCodeSum(item.id);
  // Deterministic TPR presence per competitor — no Math.random, so hydration
  // stays stable. Target never TPRs in this narrative. The featured demo item
  // (Lay's Classic Potato Chips 18oz) is special-cased so the drawer always
  // has a full comparison to show.
  const walmartHasTpr = idSum % 2 === 0 || item.id === "W7BESS";
  const aldiHasTpr = idSum % 5 === 0;
  const competitors: CompetitorPrice[] = [
    {
      name: "Walmart",
      price: round2(base * 0.96),
      ...(walmartHasTpr ? { retailPrice: round2(base * 0.88) } : {}),
      distanceMi: 2.1,
      address: "123 Main St, Madison WI",
    },
    { name: "Target", price: round2(base * 1.04), distanceMi: 3.4, address: "2500 University Ave, Madison WI" },
    {
      name: "Aldi",
      price: round2(base * 0.89),
      ...(aldiHasTpr ? { retailPrice: round2(base * 0.82) } : {}),
      distanceMi: 5.2,
      address: "345 Main St, Madison WI",
    },
  ];
  const familyId = FAMILY_IDS[item.id];
  return {
    ...item,
    competitors,
    familyId,
    // Identity context shown in the drawer's item-info block.
    vendorName: item.vendorName ?? `${item.brand} Distribution`,
    // High-sensitivity SKUs are the prices shoppers watch — flag them KVI.
    isKvi: item.isKvi ?? item.sensitivity === "H",
    priceFamilyName: item.priceFamilyName ?? (familyId ? FAMILY_NAMES[familyId] : undefined),
    // Temp-allowance defaults (retail overrides are seeded explicitly below).
    currentRetailPrice: item.currentRetailPrice ?? item.currentBasePrice,
    allowanceCost: item.allowanceCost ?? round2(item.cost * 0.8),
    recommendedRetailPrice: item.recommendedRetailPrice ?? round2(item.currentBasePrice * 0.85),
    newRetailPrice: item.newRetailPrice ?? null,
    newRetailQty: item.newRetailQty ?? null,
    // A decided Base price always carries an effective date (the store seeds
    // one the moment a price is set) — pending fixtures must honor the same
    // invariant, or Done blocks on a date the user never had a say in.
    baseEffectiveDate: item.baseEffectiveDate ?? (item.newBasePrice != null ? "2026-07-10" : null),
    currentFuelSaver: item.currentFuelSaver ?? null,
    fuelSaver: item.fuelSaver ?? null,
    // Give any seeded fuel saver a one-week run so the table date tooltip has data.
    fuelSaverStartDate: item.fuelSaverStartDate ?? (item.fuelSaver ? "2026-06-24" : null),
    fuelSaverEndDate: item.fuelSaverEndDate ?? (item.fuelSaver ? "2026-06-30" : null),
    // Every promo (temporary allowance) MUST have a start + end window.
    allowanceStartDate: item.allowanceStartDate ?? (item.category_type === "temporary_allowance" ? "2026-06-24" : null),
    allowanceEndDate: item.allowanceEndDate ?? (item.category_type === "temporary_allowance" ? "2026-06-30" : null),
  };
}

const baseItem = {
  aisle: "Aisle 12",
  category: "Snacks",
  subcategory: "Potato chips",
  brand: "Frito-Lay",
  packSize: "11.5oz",
  keyAttributes: ["Nacho cheese", "Popular"],
  nationalVsStore: "National" as const,
  itemRole: "Margin driver" as const,
  sensitivity: "H" as const,
  currentBasePrice: 4.29,
  cost: 2.85,
  recommendedBasePrice: 4.49,
  newBasePrice: null,
  impactSalesValue: 2.8,
  impactSalesPct: 5,
  impactUnitsValue: 500,
  impactUnitsPct: 1,
  impactMarginValue: 0.04,
  impactMarginPct: 4,
  impactConfidence: "High" as const,
  impactGmPct: -0.02,
  hasOverride: false,
  category_type: "base" as const,
};

const baseMockItems: PricingItem[] = [
  {
    ...baseItem,
    id: "W7BESS",
    name: "Lay's Classic Potato Chips 18oz",
    packSize: "18oz",
    keyAttributes: ["Classic", "Family size"],
    itemRole: "Traffic driver",
    category_type: "temporary_allowance",
    currentBasePrice: 4.29,
    cost: 2.85,
    recommendedBasePrice: 4.49,
    // An allowance already live in SAP (retail $3.99 < base) that the store
    // deepens to $3.49 → "Updated Temporary Allowance". See W7BESS:retail seed.
    currentRetailPrice: 3.99,
    newRetailQty: 1,
    newRetailPrice: 3.49,
    retailOverrideStatus: "pending",
    hasOverride: true,
    // A fuel saver already live on the shelf — the table shows it steady (no change).
    currentFuelSaver: 0.1,
    fuelSaver: 0.1,
    // Store-originated retail decision — no HQ rec on this item.
    chosenRetailReason: "local_deal",
  },
  {
    ...baseItem,
    id: "RBCS5-1",
    name: "Doritos Nacho Cheese 11.5oz",
    category_type: "temporary_allowance",
    currentBasePrice: 5.49,
    cost: 3.6,
    recommendedBasePrice: 5.79,
    // Three stacked decisions → "Multiple changes / 3 modifications": a base
    // increase, the 3-for-$12 multi-unit deal, and a fuel saver. See the matching
    // RBCS5-1:base / RBCS5-1:retail seeds in mockOverrides.
    newBasePrice: 5.79,
    baseOverrideStatus: "pending",
    newRetailQty: 3,
    newRetailPrice: 12.0,
    retailOverrideStatus: "pending",
    // A 3-week promo — long enough that the yellow tag reads "Sale price", not
    // "Savings this week".
    allowanceStartDate: "2026-06-24",
    allowanceEndDate: "2026-07-14",
    fuelSaver: 0.1,
    hasOverride: true,
    impactSalesValue: 1.4,
    impactSalesPct: 3,
    impactConfidence: "Medium",
    // Store-originated on all three sections — no HQ rec on this item. Shows
    // a different reason per section on the same row (base ≠ retail ≠ fuel).
    chosenBaseReason: "cost_change",
    chosenRetailReason: "buys",
    chosenFuelReason: "displays",
  },
  {
    ...baseItem,
    id: "RBCS5-2",
    name: "Cheetos Crunchy 8.5oz",
    packSize: "8.5oz",
    keyAttributes: ["Crunchy", "Popular"],
    currentBasePrice: 4.79,
    cost: 3.1,
    recommendedBasePrice: 4.99,
    newBasePrice: 4.89,
    baseOverrideStatus: "pending",
    hasOverride: true,
    // Store-originated — no HQ rec on this item.
    chosenBaseReason: "cost_change",
  },
  {
    ...baseItem,
    id: "RBCS5-3",
    name: "Ruffles Cheddar & Sour Cream 8oz",
    packSize: "8oz",
    keyAttributes: ["Cheddar", "Ridged"],
    currentBasePrice: 4.99,
    cost: 3.25,
    recommendedBasePrice: 5.29,
    newBasePrice: 5.99,
    hasOverride: true,
    baseOverrideStatus: "pending",
    // Deliberately no chosenBaseReason — an in-flight edit still missing its
    // required reason; the drawer blocks Done here until one is picked.
    hasAlert: true,
    impactConfidence: "Low",
    impactSalesValue: -0.6,
    impactSalesPct: -2,
  },
  {
    ...baseItem,
    id: "RBCS5-4",
    name: "Pringles Original 5.2oz",
    brand: "Kellanova",
    packSize: "5.2oz",
    keyAttributes: ["Original", "Canister"],
    category_type: "temporary_allowance",
    currentBasePrice: 2.39,
    cost: 1.55,
    recommendedBasePrice: 2.49,
    itemRole: "Convenience",
    // Seeded retail (temp allowance), edited but not yet committed live — see
    // mockOverrides RBCS5-4:retail.
    newRetailQty: 1,
    newRetailPrice: 1.99,
    retailOverrideStatus: "pending",
    hasOverride: true,
    // Store-originated retail decision — no HQ rec on this item.
    chosenRetailReason: "manager_special",
  },
  {
    ...baseItem,
    id: "RBCS5-9",
    name: "Pepperidge Farm Goldfish 6.6oz",
    brand: "Pepperidge Farm",
    subcategory: "Crackers",
    packSize: "6.6oz",
    keyAttributes: ["Cheddar", "Baked"],
    itemRole: "Traffic driver",
    category_type: "temporary_allowance",
    currentBasePrice: 3.19,
    cost: 1.95,
    recommendedBasePrice: 3.19,
    // A NEW allowance HQ is PROPOSING (no current promo: retail = base). Awaiting
    // the director's decision — accept / set your own / keep current. No override,
    // so it surfaces in the HQ Recommendations queue and previews as "proposed".
    currentRetailPrice: 3.19,
    recommendedRetailPrice: 2.5,
    allowanceStartDate: "2026-06-24",
    allowanceEndDate: "2026-06-30",
  },
  // A batch of clean HQ proposals (no overrides) so the review worklist shows
  // real scale + a mix of routine vs. flagged (big swings / alerts) decisions.
  { ...baseItem, id: "HQ-101", name: "Triscuit Original 8.5oz", brand: "Nabisco", subcategory: "Crackers", packSize: "8.5oz", currentBasePrice: 3.49, cost: 2.1, recommendedBasePrice: 3.69 },
  { ...baseItem, id: "HQ-102", name: "Wheat Thins Original 8oz", brand: "Nabisco", subcategory: "Crackers", packSize: "8oz", currentBasePrice: 3.99, cost: 2.45, recommendedBasePrice: 4.19 },
  { ...baseItem, id: "HQ-103", name: "Pop Secret Butter 6ct", brand: "Pop Secret", subcategory: "Popcorn", packSize: "6ct", currentBasePrice: 4.29, cost: 2.6, recommendedBasePrice: 3.99 },
  // Carries BOTH an HQ base rec (cost change) and an HQ retail rec (vendor
  // allowance) at once — one row, two independent sections, two different
  // reasons.
  { ...baseItem, id: "HQ-104", name: "Orville Redenbacher 6ct", brand: "Orville", subcategory: "Popcorn", packSize: "6ct", category_type: "temporary_allowance", currentBasePrice: 4.49, cost: 2.7, recommendedBasePrice: 4.69, currentRetailPrice: 4.49, recommendedRetailPrice: 3.49, allowanceStartDate: "2026-06-24", allowanceEndDate: "2026-06-30" },
  { ...baseItem, id: "HQ-105", name: "Planters Peanuts 16oz", brand: "Planters", subcategory: "Nuts", packSize: "16oz", currentBasePrice: 5.99, cost: 3.8, recommendedBasePrice: 7.49, itemRole: "Margin driver" },
  { ...baseItem, id: "HQ-106", name: "Jack Link's Jerky 5oz", brand: "Jack Link's", subcategory: "Jerky", packSize: "5oz", currentBasePrice: 8.99, cost: 6.2, recommendedBasePrice: 7.49, sensitivity: "H", hasAlert: true },
  { ...baseItem, id: "HQ-107", name: "SkinnyPop Original 4.4oz", brand: "SkinnyPop", subcategory: "Popcorn", packSize: "4.4oz", category_type: "temporary_allowance", currentBasePrice: 3.29, cost: 1.9, recommendedBasePrice: 3.29, currentRetailPrice: 3.29, recommendedRetailPrice: 2.5, allowanceStartDate: "2026-06-24", allowanceEndDate: "2026-06-30" },
  { ...baseItem, id: "HQ-108", name: "Rold Gold Pretzels 16oz", brand: "Rold Gold", subcategory: "Pretzels", packSize: "16oz", currentBasePrice: 3.79, cost: 2.2, recommendedBasePrice: 3.89 },
  {
    ...baseItem,
    id: "RBCS5-5",
    name: "Tostitos Scoops 10oz",
    packSize: "10oz",
    keyAttributes: ["Scoops", "Party size"],
    // Converted from a regular base price to an everyday low price → strategy is
    // now EDLP, Change Summary "Converted to EDLP". See RBCS5-5:base seed.
    category_type: "everyday_low_price",
    sapStrategy: "base",
    currentBasePrice: 5.19,
    cost: 3.4,
    recommendedBasePrice: 4.99,
    newBasePrice: 4.99,
    hasOverride: true,
    baseOverrideStatus: "pending",
    // Store-originated — no HQ rec on this item.
    chosenBaseReason: "competitor_change",
  },
  {
    ...baseItem,
    id: "RBCS5-6",
    name: "SunChips Harvest Cheddar 7oz",
    packSize: "7oz",
    keyAttributes: ["Whole grain", "Cheddar"],
    currentBasePrice: 4.49,
    cost: 2.95,
    recommendedBasePrice: 4.39,
    newBasePrice: 4.39,
    hasOverride: true,
    baseOverrideStatus: "pending",
    impactConfidence: "Medium",
    // Store-originated — no HQ rec on this item.
    chosenBaseReason: "cost_change",
  },
  {
    ...baseItem,
    id: "RBCS5-7",
    name: "Fritos Original 9.25oz",
    packSize: "9.25oz",
    keyAttributes: ["Original", "Corn"],
    category_type: "everyday_low_price",
    // Aligned with the fl-tortilla family (RBCS5-1 / RBCS5-8).
    currentBasePrice: 5.49,
    cost: 3.6,
    recommendedBasePrice: 5.79,
    itemRole: "Destination",
    // Demos the EDLP ceiling's family-propagation block: current price is
    // comfortably under, but repricing the fl-tortilla family (via RBCS5-1 or
    // RBCS5-8) above ~$6.16 pushes THIS member over its hard ceiling, blocking
    // the whole family commit even though the item being edited isn't EDLP.
    edlpMaxAllowedPrice: 5.6,
  },
  {
    ...baseItem,
    id: "RBCS5-8",
    name: "Kettle Brand Sea Salt 7.5oz",
    brand: "Campbell's",
    packSize: "7.5oz",
    keyAttributes: ["Kettle cooked", "Sea salt"],
    category_type: "base",
    // Aligned with the fl-tortilla family (RBCS5-1 / RBCS5-7).
    currentBasePrice: 5.49,
    cost: 3.6,
    recommendedBasePrice: 5.79,
  },
  {
    ...baseItem,
    id: "RBCS5-10",
    name: "Lay's Classic Potato Chips 7.75oz",
    packSize: "7.75oz",
    keyAttributes: ["Classic", "Single serve"],
    itemRole: "Traffic driver",
    currentBasePrice: 2.99,
    cost: 1.9,
    recommendedBasePrice: 2.99,
  },
  {
    ...baseItem,
    id: "RBCS5-11",
    name: "Lay's Classic Potato Chips 13oz",
    packSize: "13oz",
    keyAttributes: ["Classic", "Share size"],
    itemRole: "Traffic driver",
    currentBasePrice: 3.99,
    cost: 2.55,
    recommendedBasePrice: 3.99,
  },
];

// Featured snack items, each carrying competitor / related / family + temp
// allowance context so the drawer has real data to motivate an override.
const baseCatalog: PricingItem[] = baseMockItems.map(enrichItemContext);

// Overrides use deterministic ids (`${itemId}:${priceField}`) and MUST stay
// consistent with the item fields above — the demo boots from both.
export const mockOverrides: Override[] = [
  {
    id: "RBCS5-2:base",
    itemId: "RBCS5-2",
    itemName: "Cheetos Crunchy 8.5oz",
    changeType: "base",
    priceField: "base",
    currentPrice: 4.79,
    newPrice: 4.89,
    status: "pending",
  },
  {
    id: "RBCS5-3:base",
    itemId: "RBCS5-3",
    itemName: "Ruffles Cheddar & Sour Cream 8oz",
    changeType: "base",
    priceField: "base",
    currentPrice: 4.99,
    newPrice: 5.99,
    status: "pending",
  },
  {
    id: "RBCS5-5:base",
    itemId: "RBCS5-5",
    itemName: "Tostitos Scoops 10oz",
    changeType: "everyday_low_price",
    priceField: "base",
    currentPrice: 5.19,
    newPrice: 4.99,
    status: "pending",
  },
  {
    id: "RBCS5-6:base",
    itemId: "RBCS5-6",
    itemName: "SunChips Harvest Cheddar 7oz",
    changeType: "base",
    priceField: "base",
    currentPrice: 4.49,
    newPrice: 4.39,
    status: "pending",
  },
  {
    id: "RBCS5-1:base",
    itemId: "RBCS5-1",
    itemName: "Doritos Nacho Cheese 11.5oz",
    changeType: "base",
    priceField: "base",
    currentPrice: 5.49,
    newPrice: 5.79,
    status: "pending",
  },
  {
    id: "EDLP-2:base",
    itemId: "EDLP-2",
    itemName: "Great Value Potato Chips 8oz",
    changeType: "everyday_low_price",
    priceField: "base",
    currentPrice: 1.98,
    newPrice: 1.88,
    status: "pending",
  },
  {
    id: "W7BESS:retail",
    itemId: "W7BESS",
    itemName: "Lay's Classic Potato Chips 18oz",
    changeType: "temporary_allowance",
    priceField: "retail",
    currentPrice: 3.99,
    newPrice: 3.49,
    status: "pending",
  },
  {
    id: "RBCS5-1:retail",
    itemId: "RBCS5-1",
    itemName: "Doritos Nacho Cheese 11.5oz",
    changeType: "temporary_allowance",
    priceField: "retail",
    currentPrice: 5.49,
    newPrice: 12.0,
    qty: 3,
    status: "pending",
  },
  {
    id: "RBCS5-4:retail",
    itemId: "RBCS5-4",
    itemName: "Pringles Original 5.2oz",
    changeType: "temporary_allowance",
    priceField: "retail",
    currentPrice: 2.39,
    newPrice: 1.99,
    status: "pending",
  },
];

// ─── Additional category datasets (own ids — not shared with base) ───────────

// `max` = the SAP PMR-managed EDLP maximum allowed price (per-unit); the hard
// ceiling is max × 1.10. Chosen per item to cover every ceiling demo state:
//  EDLP-1 current AND HQ's rec both breach the hard ceiling (accepting the
//    rec gets blocked in commitBase — see HQ_REVIEW_IDS below).
//  EDLP-2 an edited-but-not-yet-live override (see mockOverrides) breaches the
//    hard ceiling with no exception — demos the "Edited" over-ceiling state.
//  EDLP-3 breaches the hard ceiling but carries the seeded per-item exception
//    (see edlpExceptions in the store) — downgraded to a soft warning.
//  EDLP-4 current price sits in the soft zone (over max, within +10%) with no
//    edit at all — demos the passive drawer/cell/facet states.
//  EDLP-5 / EDLP-6 comfortable headroom — the calm control rows.
const edlpCatalog: PricingItem[] = [
  { name: "Great Value Tortilla Chips 13oz", packSize: "13oz", brand: "Great Value", current: 2.98, cost: 1.9, rec: 2.78, max: 2.4 },
  { name: "Great Value Potato Chips 8oz", packSize: "8oz", brand: "Great Value", current: 1.98, cost: 1.25, rec: 1.88, max: 1.65 },
  { name: "Clancy's Wavy Chips 10oz", packSize: "10oz", brand: "Clancy's", current: 2.49, cost: 1.6, rec: 2.29, max: 2.0 },
  { name: "Santitas White Corn 11oz", packSize: "11oz", brand: "Frito-Lay", current: 3.29, cost: 2.1, rec: 2.99, max: 3.05 },
  { name: "Chesters Fries Flamin' Hot 5.25oz", packSize: "5.25oz", brand: "Frito-Lay", current: 2.19, cost: 1.4, rec: 1.99, max: 2.6 },
  { name: "Munchies Snack Mix 8oz", packSize: "8oz", brand: "Frito-Lay", current: 3.49, cost: 2.25, rec: 3.19, max: 4.0 },
].map((it, i): PricingItem => ({
  ...baseItem,
  id: `EDLP-${i + 1}`,
  name: it.name,
  brand: it.brand,
  packSize: it.packSize,
  keyAttributes: ["Value", "Everyday low"],
  nationalVsStore: it.brand === "Great Value" || it.brand === "Clancy's" ? "Store" : "National",
  itemRole: "Traffic driver",
  currentBasePrice: it.current,
  cost: it.cost,
  recommendedBasePrice: it.rec,
  impactConfidence: i % 2 === 0 ? "High" : "Medium",
  category_type: "everyday_low_price" as const,
  edlpMaxAllowedPrice: it.max,
}))
  .map(enrichItemContext)
  // Reprice one already-live EDLP item so the Change Summary shows "Updated EDLP
  // Price" (an EDLP conversion is demoed separately on RBCS5-5). See EDLP-2:base.
  .map((it) =>
    it.id === "EDLP-2"
      // This repricing lands after enrichItemContext, so it must carry its own
      // effective date — a decided Base price is never date-less (see the
      // baseEffectiveDate default in enrichItemContext).
      ? { ...it, newBasePrice: 1.88, baseOverrideStatus: "pending" as const, hasOverride: true, baseEffectiveDate: "2026-07-10" }
      : it
  );

const noChangeCatalog: PricingItem[] = [
  { name: "Tostitos Salsa Medium 15.5oz", packSize: "15.5oz", current: 4.59, cost: 2.9 },
  { name: "Lay's Barbecue 7.75oz", packSize: "7.75oz", current: 4.29, cost: 2.8 },
  { name: "Doritos Cool Ranch 9.25oz", packSize: "9.25oz", current: 5.49, cost: 3.6 },
  { name: "Smartfood White Cheddar 6.75oz", packSize: "6.75oz", current: 4.19, cost: 2.7 },
  { name: "Rold Gold Tiny Twists 16oz", packSize: "16oz", current: 4.49, cost: 2.85 },
  { name: "Cape Cod Original 7.5oz", packSize: "7.5oz", current: 4.39, cost: 2.8 },
].map((it, i): PricingItem => ({
  ...baseItem,
  id: `NC-${i + 1}`,
  name: it.name,
  packSize: it.packSize,
  keyAttributes: ["Stable price"],
  currentBasePrice: it.current,
  cost: it.cost,
  recommendedBasePrice: it.current,
  impactSalesValue: 0,
  impactSalesPct: 0,
  impactConfidence: "High" as const,
  category_type: "no_change" as const,
})).map(enrichItemContext);

const newDiscontinuedCatalog: PricingItem[] = [
  { name: "Doritos Dinamita Flamin' Hot 9.25oz", packSize: "9.25oz", current: 5.49, cost: 3.55, rec: 5.49, status: "new" },
  { name: "Lay's Layers Sour Cream 4.75oz", packSize: "4.75oz", current: 3.99, cost: 2.55, rec: 3.99, status: "new" },
  { name: "PopCorners Kettle 7oz", packSize: "7oz", current: 4.79, cost: 3.05, rec: 4.79, status: "new" },
  { name: "Doritos 3D Crunch 6oz", packSize: "6oz", current: 4.49, cost: 2.9, rec: 3.49, status: "discontinued" },
  { name: "Lay's Poppables 5oz", packSize: "5oz", current: 4.29, cost: 2.75, rec: 2.99, status: "discontinued" },
  { name: "Ruffles Double Crunch 7.25oz", packSize: "7.25oz", current: 4.69, cost: 3.0, rec: 3.29, status: "discontinued" },
].map((it, i): PricingItem => ({
  ...baseItem,
  id: `ND-${i + 1}`,
  name: it.name,
  packSize: it.packSize,
  keyAttributes: it.status === "new" ? ["New item"] : ["Markdown"],
  currentBasePrice: it.current,
  cost: it.cost,
  recommendedBasePrice: it.rec,
  itemStatus: it.status as "new" | "discontinued",
  impactConfidence: "Medium" as const,
  category_type: "new_discontinued" as const,
})).map(enrichItemContext);

// HQ recommendations: HQ proposes a new price for these items. The proposal is
// NOT live in SAP — `currentBasePrice` stays the live (old) price and
// `recommendedBasePrice` carries HQ's proposal, so the director can compare the
// two and decide (accept / override / keep current) before anything changes.
const HQ_REVIEW_IDS = new Set([
  "RBCS5-7", "RBCS5-8", "EDLP-1", "ND-4", "RBCS5-9",
  "HQ-101", "HQ-102", "HQ-103", "HQ-104", "HQ-105", "HQ-106", "HQ-107", "HQ-108",
]);

// Every HQ recommendation carries the reason behind it — the director triages
// the queue by these (competitor moves are time-sensitive, cost changes are
// margin upkeep, HQ pricing reviews can batch for later). Reason is per
// SECTION, not per item: a plain base-price rec carries a Base reason, while a
// temporary allowance's rec is a RETAIL move and carries a Retail reason —
// even though its base price is untouched.
const HQ_BASE_REASON_SEEDS: Record<string, HqBaseReason> = {
  "RBCS5-7": "cost_change",
  "RBCS5-8": "cost_change",
  "HQ-101": "cost_change",
  "HQ-102": "cost_change",
  "HQ-105": "cost_change",
  "EDLP-1": "competitor_change",
  "HQ-103": "competitor_change",
  "HQ-106": "competitor_change",
  "HQ-108": "competitor_change",
  "ND-4": "hq_pricing_review",
  "HQ-104": "cost_change", // also carries a retail rec below — differing reasons, same row
};

// TA/promo recommendations — vendor-funded allowances get "allowance", the
// rest mix across the shared HQ retail/fuel catalog for variety.
const HQ_RETAIL_REASON_SEEDS: Record<string, HqPromoReason> = {
  "RBCS5-9": "displays",
  "HQ-104": "allowance", // vendor-funded TA
  "HQ-107": "wow_buy",
};

// A couple of the already-flagged items ALSO carry an HQ fuel-saver
// recommendation, independent of their base/retail one — proof that a single
// item can surface more than one section's HQ reason at once (see HQ-108:
// a "Competitor change" base reason alongside a "Discontinued" fuel reason).
const HQ_FUEL_REASON_SEEDS: Record<string, { amount: number; reason: HqPromoReason }> = {
  "HQ-102": { amount: 0.10, reason: "wow_buy" },
  "HQ-108": { amount: 0.10, reason: "discontinued" },
};

function applyHqReview(item: PricingItem): PricingItem {
  if (!HQ_REVIEW_IDS.has(item.id)) return item;
  const fuel = HQ_FUEL_REASON_SEEDS[item.id];
  return {
    ...item,
    hqReviewPending: true,
    hqBaseReason: HQ_BASE_REASON_SEEDS[item.id],
    hqRetailReason: HQ_RETAIL_REASON_SEEDS[item.id],
    ...(fuel ? { recommendedFuelSaver: fuel.amount, hqFuelReason: fuel.reason } : {}),
  };
}

// ─── Synthetic catalog (scale) ───────────────────────────────────────────────
// The hand-crafted items above drive the demo flows (families, HQ recs,
// overrides). To exercise the filters at realistic scale we add a broad,
// deterministic catalog of "live" (no-change) SKUs across many categories,
// subcategories and brands — so the Category/Brand facets get a searchable,
// hundreds-of-values feel instead of the single "Snacks" cluster.
const TAXONOMY: { category: string; aisle: string; subcategories: string[] }[] = [
  { category: "Beverages", aisle: "Aisle 7", subcategories: ["Soda", "Bottled water", "Juice", "Sports drinks", "Energy drinks", "Tea"] },
  { category: "Coffee", aisle: "Aisle 8", subcategories: ["Ground coffee", "Coffee pods", "Whole bean", "Instant"] },
  { category: "Dairy", aisle: "Aisle 1", subcategories: ["Milk", "Cheese", "Yogurt", "Butter", "Eggs"] },
  { category: "Frozen", aisle: "Aisle 20", subcategories: ["Pizza", "Ice cream", "Frozen meals", "Frozen vegetables"] },
  { category: "Bakery", aisle: "Aisle 3", subcategories: ["Bread", "Buns & rolls", "Tortillas", "Sweet baked"] },
  { category: "Cereal", aisle: "Aisle 9", subcategories: ["Cold cereal", "Granola", "Oatmeal"] },
  { category: "Pasta & sauce", aisle: "Aisle 10", subcategories: ["Pasta", "Pasta sauce", "Noodles"] },
  { category: "Canned goods", aisle: "Aisle 11", subcategories: ["Soup", "Canned vegetables", "Canned beans", "Canned fruit"] },
  { category: "Condiments", aisle: "Aisle 13", subcategories: ["Ketchup & mustard", "Mayonnaise", "Salad dressing", "Hot sauce"] },
  { category: "Baking", aisle: "Aisle 14", subcategories: ["Flour & sugar", "Baking mixes", "Spices"] },
  { category: "Candy", aisle: "Aisle 15", subcategories: ["Chocolate", "Gummies", "Mints & gum"] },
  { category: "Meat", aisle: "Aisle 30", subcategories: ["Beef", "Poultry", "Pork", "Bacon & sausage"] },
  { category: "Seafood", aisle: "Aisle 31", subcategories: ["Fish", "Shrimp", "Canned tuna"] },
  { category: "Produce", aisle: "Aisle 40", subcategories: ["Fruit", "Vegetables", "Salad kits", "Herbs"] },
  { category: "Health & beauty", aisle: "Aisle 50", subcategories: ["Shampoo", "Toothpaste", "Vitamins", "Skin care"] },
  { category: "Household", aisle: "Aisle 55", subcategories: ["Cleaning", "Paper goods", "Laundry", "Trash bags"] },
  { category: "Pet", aisle: "Aisle 60", subcategories: ["Dog food", "Cat food", "Treats"] },
  { category: "Baby", aisle: "Aisle 62", subcategories: ["Diapers", "Baby food", "Wipes"] },
  { category: "Breakfast", aisle: "Aisle 4", subcategories: ["Syrup & mixes", "Breakfast bars", "Frozen breakfast"] },
];

const SYNTHETIC_BRANDS = [
  "Hy-Vee", "Great Value", "Coca-Cola", "PepsiCo", "Nestlé", "General Mills", "Kraft Heinz",
  "Kellogg's", "Tyson", "Hormel", "Tropicana", "Gatorade", "Dasani", "Folgers", "Quaker",
  "Betty Crocker", "Hershey's", "Mars", "Barilla", "Heinz", "Hidden Valley", "Tide", "Charmin",
  "Bounty", "Purina", "Pampers", "Gerber", "Dove", "Colgate", "Nature Valley", "Cheerios", "Oreo",
];
const SYNTHETIC_SIZES = ["8oz", "12oz", "16oz", "24oz", "1 lb", "2 lb", "6 pk", "12 pk", "24 pk", "32oz", "64oz"];
const SYNTHETIC_ROLES: ItemRole[] = ["Traffic driver", "Margin driver", "Destination", "Convenience"];
const SYNTHETIC_SENS: Sensitivity[] = ["H", "M", "L"];
const ITEMS_PER_CATEGORY = 11;

const syntheticCatalog: PricingItem[] = TAXONOMY.flatMap((cat, ci) =>
  Array.from({ length: ITEMS_PER_CATEGORY }, (_, i): PricingItem => {
    const n = ci * ITEMS_PER_CATEGORY + i + 1;
    const sub = cat.subcategories[i % cat.subcategories.length];
    const brand = SYNTHETIC_BRANDS[(n * 7) % SYNTHETIC_BRANDS.length];
    const size = SYNTHETIC_SIZES[n % SYNTHETIC_SIZES.length];
    const price = round2(1.49 + ((n * 37) % 900) / 100);
    const isStore = brand === "Hy-Vee" || brand === "Great Value";
    return {
      ...baseItem,
      id: `SKU-${1000 + n}`,
      name: `${brand} ${sub} ${size}`,
      aisle: cat.aisle,
      category: cat.category,
      subcategory: sub,
      brand,
      packSize: size,
      keyAttributes: [sub],
      nationalVsStore: isStore ? "Store" : "National",
      itemRole: SYNTHETIC_ROLES[n % SYNTHETIC_ROLES.length],
      sensitivity: SYNTHETIC_SENS[n % SYNTHETIC_SENS.length],
      currentBasePrice: price,
      cost: round2(price * 0.62),
      recommendedBasePrice: price, // no change → Live, no action needed
      newBasePrice: null,
      hasOverride: false,
      category_type: "no_change",
    };
  })
).map(enrichItemContext);

// ─── Unified catalog ─────────────────────────────────────────────────────────
// One list of every item. Each carries its own `category_type` (price type),
// editable in the drawer. The store boots from this; the tabs filter it.
export const mockItems: PricingItem[] = [
  ...baseCatalog,
  ...edlpCatalog,
  ...noChangeCatalog,
  ...newDiscontinuedCatalog,
  ...syntheticCatalog,
].map(applyHqReview);

// Headline count shown on the "All items (N)" pill.
export const TOTAL_ITEM_COUNT = mockItems.length;

// ─── Per-store data (multi-store support) ────────────────────────────────────
// Each store the director manages gets its own slice of items/overrides.
// #1402 is the primary, richly seeded demo store (all the flows above). The other
// stores share the same SKU catalog but boot "clean": prices nudged per store,
// no in-progress edits, their own HQ worklist.

export type StoreSlice = { items: PricingItem[]; overrides: Override[] };

// SKUs HQ is recommending on the primary store — the pool we rotate a per-store
// subset from, so each store shows a different HQ review count.
const HQ_REVIEW_POOL = mockItems.filter((i) => i.hqReviewPending).map((i) => i.id);

// A clean, store-specific copy of an item: no pending/in-flight edits, prices
// scaled by a per-store factor, strategy reset to what's live in SAP.
function cleanForStore(item: PricingItem, factor: number): PricingItem {
  const scale = (n: number | undefined) => (n == null ? undefined : round2(n * factor));
  return {
    ...item,
    currentBasePrice: round2(item.currentBasePrice * factor),
    recommendedBasePrice: round2(item.recommendedBasePrice * factor),
    currentRetailPrice: scale(item.currentRetailPrice),
    recommendedRetailPrice: scale(item.recommendedRetailPrice),
    allowanceCost: scale(item.allowanceCost),
    // Scale the PMR maximum with the rest of the store's prices so a
    // secondary store's ceiling stays proportional (it isn't a store-specific
    // fact the demo needs to control, unlike currentBasePrice).
    edlpMaxAllowedPrice: scale(item.edlpMaxAllowedPrice),
    // Start clean — no decisions carried over from the primary store.
    newBasePrice: null,
    baseOverrideStatus: undefined,
    // No decided base price → no effective date describing it.
    baseEffectiveDate: null,
    newRetailPrice: null,
    newRetailQty: null,
    retailOverrideStatus: undefined,
    hasOverride: false,
    baseReviewed: false,
    retailReviewed: false,
    fuelReviewed: false,
    hqReviewPending: false,
    autoTypedFrom: null,
    // Undo any demo strategy conversion (e.g. Base → EDLP on the primary store).
    category_type: item.sapStrategy ?? item.category_type,
    sapStrategy: undefined,
    // Keep the live fuel saver steady (no pending change).
    fuelSaver: item.currentFuelSaver ?? null,
  };
}

function buildSecondaryStore(index: number): StoreSlice {
  const factor = 1 + index * 0.025; // each store a touch pricier than the last
  const keep = Math.max(2, HQ_REVIEW_POOL.length - index * 3); // fewer HQ recs per store
  const hqSet = new Set(HQ_REVIEW_POOL.slice(0, keep));
  const items = mockItems.map((it) => {
    const clean = cleanForStore(it, factor);
    return hqSet.has(it.id) ? { ...clean, hqReviewPending: true } : clean;
  });
  return { items, overrides: [] };
}

export function buildInitialStoreData(): Record<string, StoreSlice> {
  const data: Record<string, StoreSlice> = {};
  STORES.forEach((store, index) => {
    data[store.id] =
      store.id === DEFAULT_STORE_ID
        ? { items: mockItems, overrides: mockOverrides }
        : buildSecondaryStore(index);
  });
  return data;
}
