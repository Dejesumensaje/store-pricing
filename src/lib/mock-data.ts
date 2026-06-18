import { PricingItem, Override, Batch, SummaryMetrics, CategorySummary, CompetitorPrice } from "@/types/pricing";

const round2 = (n: number) => Math.round(n * 100) / 100;

// Items that share a line-price group (priced together as a line).
const LINE_PRICE_GROUPS: Record<string, string> = {
  "RBCS5-1": "fl-tortilla",
  "RBCS5-5": "fl-tortilla",
  "RBCS5-7": "fl-tortilla",
};

// A few hand-picked "frequently priced together" relationships.
const RELATED_ITEMS: Record<string, string[]> = {
  "W7BESS": ["RBCS5-1", "RBCS5-2", "RBCS5-8"],
  "RBCS5-1": ["RBCS5-5", "RBCS5-7", "W7BESS"],
  "RBCS5-2": ["RBCS5-3", "RBCS5-6", "W7BESS"],
  "RBCS5-5": ["RBCS5-1", "RBCS5-7"],
  "RBCS5-7": ["RBCS5-1", "RBCS5-5"],
};

// Synthesize believable competitor shelf prices around the current base price.
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
  };
}

export const mockSummaryMetrics: SummaryMetrics = {
  salesCurrent: 220,
  salesNew: 229,
  salesImpactPct: 4.2,
  unitsCurrent: 10.2,
  unitsNew: 10.5,
  unitsImpactPct: 3.2,
  marginCurrent: 39,
  marginNew: 39.5,
  marginImpactPct: 1.3,
  transactionsCurrent: 4.5,
  transactionsNew: 4.6,
  transactionsImpactPct: 2.1,
  ciVsCompCurrent: 1.0,
  ciVsCompNew: 1.08,
};

export const mockCategories: CategorySummary[] = [
  {
    type: "base",
    label: "Base",
    description: "Permanent regular price changes (new everyday shelf price).",
    newPricesFromHQ: 10,
    priceOverrides: 0,
    alerts: 5,
  },
  {
    type: "temporary_allowance",
    label: "Temporary allowance",
    description: "Temporary price reductions funded by a vendor (often promotions).",
    newPricesFromHQ: 10,
    priceOverrides: 5,
    alerts: 5,
  },
  {
    type: "everyday_low_price",
    label: "Everyday low price",
    description: "Strategic permanent reductions to make an item consistently cheaper.",
    newPricesFromHQ: 10,
    priceOverrides: 0,
    alerts: 3,
  },
  {
    type: "no_change",
    label: "No change",
    description: "Items with no recommended price change - current pricing remains.",
    newPricesFromHQ: 0,
    priceOverrides: 0,
    alerts: 0,
  },
  {
    type: "new_discontinued",
    label: "New / Discontinued",
    description: "Initial pricing for new items or price handling for items being removed.",
    newPricesFromHQ: 10,
    priceOverrides: 0,
    alerts: 0,
  },
];

const baseItem = {
  aisle: "Potato chips",
  category: "Potato chips",
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
    currentBasePrice: 4.29,
    cost: 2.85,
    recommendedBasePrice: 4.49,
  },
  {
    ...baseItem,
    id: "RBCS5-1",
    name: "Doritos Nacho Cheese 11.5oz",
    currentBasePrice: 5.49,
    cost: 3.6,
    recommendedBasePrice: 5.79,
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
    currentBasePrice: 2.39,
    cost: 1.55,
    recommendedBasePrice: 2.49,
    itemRole: "Convenience",
  },
  {
    ...baseItem,
    id: "RBCS5-5",
    name: "Tostitos Scoops 10oz",
    packSize: "10oz",
    keyAttributes: ["Scoops", "Party size"],
    currentBasePrice: 5.19,
    cost: 3.4,
    recommendedBasePrice: 5.49,
    newBasePrice: 5.29,
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
    recommendedBasePrice: 4.69,
    newBasePrice: 4.59,
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
    currentBasePrice: 3.99,
    cost: 2.6,
    recommendedBasePrice: 4.19,
    itemRole: "Destination",
  },
  {
    ...baseItem,
    id: "RBCS5-8",
    name: "Kettle Brand Sea Salt 7.5oz",
    brand: "Campbell's",
    packSize: "7.5oz",
    keyAttributes: ["Kettle cooked", "Sea salt"],
    currentBasePrice: 4.19,
    cost: 2.75,
    recommendedBasePrice: 4.39,
  },
];

// Every base item carries competitor / related / line-price context so the
// item drawer has something real to motivate a store-level override.
export const mockItems: PricingItem[] = baseMockItems.map(enrichItemContext);

// TA items mirror the base catalog (same ids — base price is shared), adding
// the retail/allowance side. Retail overrides only exist in this list.
export const mockTempAllowanceItems: PricingItem[] = mockItems.map((item): PricingItem => {
  const ta: PricingItem = {
    ...item,
    category_type: "temporary_allowance",
    currentRetailPrice: item.currentBasePrice,
    allowanceCost: Math.round(item.cost * 0.8 * 100) / 100,
    recommendedRetailPrice: Math.round(item.currentBasePrice * 0.85 * 100) / 100,
    newRetailPrice: null,
    newRetailQty: null,
    fuelSaver: 0.5,
    allowanceStartDate: "2026-05-23",
    allowanceEndDate: "2026-06-01",
  };
  if (item.id === "RBCS5-1") {
    return { ...ta, newRetailQty: 3, newRetailPrice: 12.0, retailOverrideStatus: "pending", hasOverride: true };
  }
  if (item.id === "RBCS5-4") {
    return { ...ta, newRetailQty: 1, newRetailPrice: 1.99, retailOverrideStatus: "submitted" };
  }
  return ta;
});

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
    changeType: "base",
    priceField: "base",
    currentPrice: 5.19,
    newPrice: 5.29,
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
    newPrice: 4.59,
    status: "in_batch",
    batchId: "batch-2",
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

export const mockEdlpItems: PricingItem[] = [
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
}));

export const mockNoChangeItems: PricingItem[] = [
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
}));

export const mockNewDiscontinuedItems: PricingItem[] = [
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
}));

// ─── Master "All items" catalog ──────────────────────────────────────────────
// The triage landing: every item with its Price type badge. The change-type
// pills filter this list; the total count drives "All items (N)".
export const TOTAL_ITEM_COUNT = 1260;

const PRICE_TYPE_CYCLE: PricingItem["category_type"][] = [
  "temporary_allowance",
  "base",
  "temporary_allowance",
  "everyday_low_price",
  "new_discontinued",
  "no_change",
  "base",
  "everyday_low_price",
  "no_change",
];

export const mockAllItems: PricingItem[] = mockItems.map((item, i) => ({
  ...item,
  category_type: PRICE_TYPE_CYCLE[i % PRICE_TYPE_CYCLE.length],
}));
