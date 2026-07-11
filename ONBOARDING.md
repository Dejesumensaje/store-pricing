# Store Pricing — Developer Onboarding

## What this is

A store director's workspace for reviewing and acting on HQ price recommendations. The director sees every item that needs a pricing decision — accept HQ's recommendation, override it, or keep the current price — before changes are sent to SAP.

Single-page Next.js app. All state lives in Zustand. No backend yet: data comes from `src/lib/mock-data.ts`. The integration seam that connects to a real backend is clearly marked.

Branch `mvp` = v0.0 handoff. No batch submission, no auth, no settings.

---

## Quick start

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # verify production build
npx tsc --noEmit  # verify types
```

---

## Architecture map

```
src/types/pricing.ts                         ← THE API contract — PricingItem is what the backend returns
src/lib/mock-data.ts                         ← all mock data; THE integration seam (see below)
src/lib/api.ts                               ← service layer — swap this file to connect a real backend
src/store/pricing-store.ts                   ← Zustand store; each action will need an API write counterpart
src/app/page.tsx                             ← single route; all top-level filter/drawer state lives here
src/components/pricing-table/
  ItemEditDrawer.tsx                         ← main decision workspace per item (~1,200 lines)
  DataTable.tsx                              ← virtualised table with sticky columns
  columns/shared.tsx                         ← shared column primitives (itemCol, idCol)
src/components/store/
  buildStoreColumns.tsx                      ← column definitions (price, tag, status, reason…)
  MobileItemList.tsx                         ← mobile card list (mirrors table columns)
  StorePricingHeader.tsx                     ← KPI strip + action bar
src/components/filters/
  FilterDrawer.tsx                           ← filter panel (facets, chips, reset)
  FilterChips.tsx                            ← active-filter chip strip
src/lib/
  change-summary.ts                          ← derives what changed per item (for filter + summary)
  item-status.ts                             ← derives Live / Needs review / Edited status badge
  price-change-reason.ts                     ← reason-code catalogs per pricing section
  edlp-ceiling.ts                            ← EDLP PMR ceiling evaluation (hard/soft breach)
  pricing-math.ts                            ← perUnit, round2, promoDurationDays
  format.ts                                  ← currency, date, qty formatting helpers
  pricing-meta.ts                            ← PRICE_TYPE_META, PRICE_TYPE_INTENT, FUEL_SAVER_OPTIONS
  competitors.ts                             ← orderCompetitors (Walmart/Aldi first by default)
  product-relationships.ts                   ← family / size-parity / good-better-best relationships
docs/DECISIONS.md                            ← ADR log — read this before touching domain logic
```

---

## Domain model

Three ticket types, each decided independently:

| Tag | Type | Field group |
|-----|------|-------------|
| White | Base price | `currentBasePrice` / `newBasePrice` |
| Yellow | Temporary allowance (promo) | `currentRetailPrice` / `newRetailPrice` |
| — | Fuel saver | `currentFuelSaver` / `fuelSaver` |

An item moves through three lifecycle states (see `src/lib/item-status.ts`):

- **Needs review** — HQ has a pending recommendation (`hqReviewPending: true`)
- **Edited** — director has set a price locally (pending send)
- **Live** — current shelf price, no pending action

The director's decision is local until the "Send" batch flow is built (v0.1, out of scope here).

**Family pricing:** items sharing a `familyId` are priced as a unit — editing any member's base price updates all members. See `updateBasePrice` in `pricing-store.ts`.

---

## The integration seam

The entire app initializes from one call:

```ts
// src/lib/api.ts  ← THIS is where you connect the backend
export function loadStoreData(): Record<string, StoreSlice>
// StoreSlice = { items: PricingItem[]; overrides: Override[] }
```

`pricing-store.ts` calls `loadStoreData()` at module load. To connect a real backend:

1. **Replace the body of `loadStoreData()`** in `src/lib/api.ts` with a real fetch.  
   The backend must return `PricingItem[]` per store (shape: `src/types/pricing.ts`).

2. **Change initialization to async** — the Zustand store currently initializes synchronously.  
   With a real backend you'll need loading state; consider `zustand/middleware` + an `initialize()` action.

3. **Wire write actions** — call `commitDecision()` (also in `src/lib/api.ts`) inside each Zustand action  
   (`updateBasePrice`, `updateRetailPrice`, `updateFuelSaver`, `acceptNoChange`, etc.).  
   Currently it's a no-op stub.

---

## API contract

`src/types/pricing.ts → PricingItem` is what the backend must return per item.

**Read-only from backend (never written by the store):**
```
id, name, aisle, category, subcategory, brand, packSize
itemRole, sensitivity, nationalVsStore, vendorName?, isKvi?, priceFamilyName?
currentBasePrice, cost, recommendedBasePrice, edlpMaxAllowedPrice?
currentRetailPrice?, allowanceCost?, recommendedRetailPrice?, recommendedFuelSaver?
currentFuelSaver?, itemStatus?, category_type, sapStrategy?
hqReviewPending?, hqBaseReason?, hqRetailReason?, hqFuelReason?
competitors: CompetitorPrice[], familyId?
impactSalesValue, impactSalesPct, impactUnitsValue, impactUnitsPct
impactMarginValue, impactMarginPct, impactGmPct, impactConfidence
```

**Director-writable (mutated locally; sync to backend via `commitDecision`):**
```
newBasePrice, newBaseQty, baseEffectiveDate, chosenBaseReason
newRetailPrice, newRetailQty, allowanceStartDate, allowanceEndDate, chosenRetailReason
fuelSaver, fuelSaverStartDate, fuelSaverEndDate, chosenFuelReason
reviewed, hasOverride, baseOverrideStatus, retailOverrideStatus
```

**Write operations → Zustand actions to wire:**

| User action | Store action | Backend endpoint |
|---|---|---|
| Set base price | `updateBasePrice` | `PATCH /items/:id` |
| Set retail price | `updateRetailPrice` | `PATCH /items/:id` |
| Set fuel saver | `updateFuelSaver` | `PATCH /items/:id` |
| Accept HQ rec | `acceptNoChange` | `PATCH /items/:id` |
| Set reason code | `setBaseChangeReason` / `setRetailChangeReason` / `setFuelChangeReason` | `PATCH /items/:id` |
| Switch store | `setActiveStore` | `GET /stores/:id/items` |

---

## What is NOT in this MVP

| Feature | Status | Notes |
|---|---|---|
| Batch submission / Send to SAP | Out of scope | Designed in `docs/multi-store-plan.md` |
| User auth / sessions | Out of scope | — |
| Settings, notifications | Out of scope | — |
| Audit log | Out of scope | — |
| Real-time collaboration | Out of scope | — |
| Pagination / server-side filtering | Out of scope | All filtering is client-side |

---

## Key decisions (read before touching domain logic)

Full ADR log: `docs/DECISIONS.md`. Most critical:

- **Per-section reason codes** — Base, Retail, and Fuel Saver each have independent reason catalogs. HQ's reason is read-only; the director's is editable per section. See `src/lib/price-change-reason.ts`.
- **EDLP ceiling** — items can be priced at most 10% over the SAP PMR maximum (`edlpMaxAllowedPrice`). Hard breach = blocked; soft breach = warning with proceed option. Logic in `src/lib/edlp-ceiling.ts`.
- **Family pricing** — any base price edit fans out to all items sharing `familyId`. Intentional; not a bug.
- **`no_change` → `base` auto-promotion** — typing a base price on a "no change" item auto-switches its `category_type` and reverts if the edit is cleared. See `autoTypedFrom` field.
- **`temporary_allowance` auto-conversion** — a plain item typed into the retail field gets converted to TA. `retailAutoTypedFrom` records the original type for revert. See `updatePriceType`.
- **Custom price preserves HQ reason** — if the director overrides with a price equal to HQ's rec, the system treats it as "accepted" not "overridden". Tolerance: ±$0.005.
