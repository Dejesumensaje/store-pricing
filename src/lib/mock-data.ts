import { PricingItem, Override, Batch, CompetitorPrice, ItemRole, Sensitivity } from "@/types/pricing";

const round2 = (n: number) => Math.round(n * 100) / 100;

// Items that share a line-price group: priced together as a line (same price).
// Their base/recommended prices are kept aligned below so the line is coherent.
const LINE_PRICE_GROUPS: Record<string, string> = {
  "RBCS5-1": "fl-tortilla",
  "RBCS5-7": "fl-tortilla",
  "RBCS5-8": "fl-tortilla",
};

// A few hand-picked "frequently priced together" relationships.
const RELATED_ITEMS: Record<string, string[]> = {
  "W7BESS": ["RBCS5-1", "RBCS5-2", "RBCS5-8"],
  "RBCS5-1": ["RBCS5-5", "RBCS5-7", "W7BESS"],
  "RBCS5-2": ["RBCS5-3", "RBCS5-6", "W7BESS"],
  "RBCS5-5": ["RBCS5-1", "RBCS5-7"],
  "RBCS5-7": ["RBCS5-1", "RBCS5-5"],
};

// Synthesize believable competitor prices + temp-allowance fields for every
// item, so the drawer always has context and ANY item can be switched to a
// temporary allowance (retail price + fuel saver) on the fly.
function enrichItemContext(item: PricingItem): PricingItem {
  const base = item.currentBasePrice;
  const competitors: CompetitorPrice[] = [
    { name: "Walmart", price: round2(base * 0.96), distanceMi: 2.1 },
    { name: "Target", price: round2(base * 1.04), distanceMi: 3.4 },
    { name: "Aldi", price: round2(base * 0.89), distanceMi: 5.2 },
  ];
  return {
    ...item,
    competitors,
    relatedItemIds: RELATED_ITEMS[item.id],
    linePriceGroup: LINE_PRICE_GROUPS[item.id],
    // Temp-allowance defaults (retail overrides are seeded explicitly below).
    currentRetailPrice: item.currentRetailPrice ?? item.currentBasePrice,
    allowanceCost: item.allowanceCost ?? round2(item.cost * 0.8),
    recommendedRetailPrice: item.recommendedRetailPrice ?? round2(item.currentBasePrice * 0.85),
    newRetailPrice: item.newRetailPrice ?? null,
    newRetailQty: item.newRetailQty ?? null,
    fuelSaver: item.fuelSaver ?? null,
    allowanceStartDate: item.allowanceStartDate ?? null,
    allowanceEndDate: item.allowanceEndDate ?? null,
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
    fuelSaver: 0.1,
    hasOverride: true,
    impactSalesValue: 1.4,
    impactSalesPct: 3,
    impactConfidence: "Medium",
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
    baseOverrideStatus: "submitted",
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
    // Seeded retail (temp allowance) — see mockOverrides RBCS5-4:retail.
    newRetailQty: 1,
    newRetailPrice: 1.99,
    retailOverrideStatus: "submitted",
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
  { ...baseItem, id: "HQ-104", name: "Orville Redenbacher 6ct", brand: "Orville", subcategory: "Popcorn", packSize: "6ct", category_type: "temporary_allowance", currentBasePrice: 4.49, cost: 2.7, recommendedBasePrice: 4.49, currentRetailPrice: 4.49, recommendedRetailPrice: 3.49, allowanceStartDate: "2026-06-24", allowanceEndDate: "2026-06-30" },
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
    baseOverrideStatus: "in_batch",
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
    baseOverrideStatus: "in_batch",
    impactConfidence: "Medium",
  },
  {
    ...baseItem,
    id: "RBCS5-7",
    name: "Fritos Original 9.25oz",
    packSize: "9.25oz",
    keyAttributes: ["Original", "Corn"],
    category_type: "everyday_low_price",
    // Aligned with the fl-tortilla line price (RBCS5-1 / RBCS5-8).
    currentBasePrice: 5.49,
    cost: 3.6,
    recommendedBasePrice: 5.79,
    itemRole: "Destination",
  },
  {
    ...baseItem,
    id: "RBCS5-8",
    name: "Kettle Brand Sea Salt 7.5oz",
    brand: "Campbell's",
    packSize: "7.5oz",
    keyAttributes: ["Kettle cooked", "Sea salt"],
    category_type: "base",
    // Aligned with the fl-tortilla line price (RBCS5-1 / RBCS5-7).
    currentBasePrice: 5.49,
    cost: 3.6,
    recommendedBasePrice: 5.79,
  },
];

// Featured snack items, each carrying competitor / related / line-price + temp
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
    status: "submitted",
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
    status: "in_batch",
    batchId: "batch-1",
  },
  {
    id: "RBCS5-6:base",
    itemId: "RBCS5-6",
    itemName: "SunChips Harvest Cheddar 7oz",
    changeType: "base",
    priceField: "base",
    currentPrice: 4.49,
    newPrice: 4.39,
    status: "in_batch",
    batchId: "batch-2",
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
    status: "submitted",
  },
];

export const mockBatches: Batch[] = [
  {
    id: "batch-1",
    name: "Tuesday, ad prep",
    status: "draft",
    overrideIds: ["RBCS5-5:base"],
    createdAt: "2026-06-10T09:00:00Z",
  },
  {
    id: "batch-2",
    name: "Friday endcap reset",
    status: "draft",
    overrideIds: ["RBCS5-6:base"],
    createdAt: "2026-06-10T14:00:00Z",
  },
];

// ─── Additional category datasets (own ids — not shared with base) ───────────

const edlpCatalog: PricingItem[] = [
  { name: "Great Value Tortilla Chips 13oz", packSize: "13oz", brand: "Great Value", current: 2.98, cost: 1.9, rec: 2.78 },
  { name: "Great Value Potato Chips 8oz", packSize: "8oz", brand: "Great Value", current: 1.98, cost: 1.25, rec: 1.88 },
  { name: "Clancy's Wavy Chips 10oz", packSize: "10oz", brand: "Clancy's", current: 2.49, cost: 1.6, rec: 2.29 },
  { name: "Santitas White Corn 11oz", packSize: "11oz", brand: "Frito-Lay", current: 3.29, cost: 2.1, rec: 2.99 },
  { name: "Chesters Fries Flamin' Hot 5.25oz", packSize: "5.25oz", brand: "Frito-Lay", current: 2.19, cost: 1.4, rec: 1.99 },
  { name: "Munchies Snack Mix 8oz", packSize: "8oz", brand: "Frito-Lay", current: 3.49, cost: 2.25, rec: 3.19 },
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
}))
  .map(enrichItemContext)
  // Reprice one already-live EDLP item so the Change Summary shows "Updated EDLP
  // Price" (an EDLP conversion is demoed separately on RBCS5-5). See EDLP-2:base.
  .map((it) =>
    it.id === "EDLP-2"
      ? { ...it, newBasePrice: 1.88, baseOverrideStatus: "pending" as const, hasOverride: true }
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
// two and decide (accept / override / keep current) before anything is sent.
const HQ_REVIEW_IDS = new Set([
  "RBCS5-7", "RBCS5-8", "EDLP-1", "ND-4", "RBCS5-9",
  "HQ-101", "HQ-102", "HQ-103", "HQ-104", "HQ-105", "HQ-106", "HQ-107", "HQ-108",
]);

function applyHqReview(item: PricingItem): PricingItem {
  if (!HQ_REVIEW_IDS.has(item.id)) return item;
  return { ...item, hqReviewPending: true };
}

// ─── Synthetic catalog (scale) ───────────────────────────────────────────────
// The hand-crafted items above drive the demo flows (line groups, HQ recs,
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
