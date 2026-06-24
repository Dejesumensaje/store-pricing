"use client";

import { Info, Loader2 } from "lucide-react";
import { DataColumn } from "../pricing-table/DataTable";
import { selectCol, itemCol, idCol, SelHandlers, DecisionCell } from "../pricing-table/columns/shared";
import { derivePriceState } from "../pricing-table/PriceInputCell";
import { PricingItem, Batch } from "@/types/pricing";
import { deriveItemStatus } from "@/lib/item-status";
import { deriveDecision, DECISION_META, changeEntries } from "@/lib/change-summary";
import { fmt, fmtQtyPrice } from "@/lib/format";
import { Badge, Tooltip } from "@dejesumensaje/converge-ds-experimental";

// Optional columns the gear/settings menu can toggle on (off by default). The
// default table stays minimal (ID, item, category, status) so it scans cleanly;
// the decision columns (change type + the three prices) lead the opt-in list for
// directors who want to triage without opening each row.
export const STORE_OPTIONAL_COLUMNS: { id: string; label: string }[] = [
  { id: "currentSap", label: "Current SAP" },
  { id: "hqRec", label: "HQ rec" },
  { id: "yourPrice", label: "New price" },
  { id: "aisle", label: "Aisle" },
  { id: "subcategory", label: "Subcategory" },
  { id: "brand", label: "Brand" },
  { id: "packSize", label: "Pack size" },
  { id: "national", label: "National vs. store" },
  { id: "role", label: "Item role" },
  { id: "cost", label: "Cost" },
  { id: "sensitivity", label: "Sensitivity" },
];

const textCol = (
  id: string,
  header: string,
  value: (r: PricingItem) => string,
  width = 120,
  sortAccessor: (r: PricingItem) => string | number = value
): DataColumn<PricingItem> => ({
  id,
  group: "item",
  width,
  header,
  sortable: true,
  sortAccessor,
  cell: (r) => <span className="text-sm text-gray-700">{value(r)}</span>,
});

const OPTIONAL_DEFS: Record<string, DataColumn<PricingItem>> = {
  // Decision columns — opt-in triage info (off by default; the decision itself
  // happens in the drawer). "New price" is the director's committed price.
  currentSap: {
    id: "currentSap",
    group: "item",
    width: 130,
    header: "Current SAP",
    sortable: true,
    sortAccessor: (r) => r.currentBasePrice,
    cell: (r) => <CurrentSapCell item={r} />,
  },
  hqRec: {
    id: "hqRec",
    group: "item",
    width: 130,
    header: "HQ rec",
    sortable: true,
    sortAccessor: (r) => displayPrice(r).recommended ?? Number.NEGATIVE_INFINITY,
    cell: (r) => <HqRecCell item={r} />,
  },
  yourPrice: {
    id: "yourPrice",
    group: "item",
    width: 130,
    header: "New price",
    sortable: true,
    sortAccessor: (r) => displayPrice(r).decided ?? Number.NEGATIVE_INFINITY,
    cell: (r) => <YourPriceCell item={r} />,
  },
  aisle: textCol("aisle", "Aisle", (r) => r.aisle),
  subcategory: textCol("subcategory", "Subcategory", (r) => r.subcategory, 130),
  brand: textCol("brand", "Brand", (r) => r.brand, 110),
  packSize: textCol("packSize", "Pack size", (r) => r.packSize, 90),
  national: textCol("national", "National vs. store", (r) => r.nationalVsStore, 140),
  role: textCol("role", "Item role", (r) => r.itemRole, 130),
  cost: textCol("cost", "Cost", (r) => fmt(r.cost), 90, (r) => r.cost),
  sensitivity: textCol("sensitivity", "Sensitivity", (r) => r.sensitivity, 100),
};

// The three prices a director compares, resolved to the field that matters for
// the item's type: retail for temporary allowances, base otherwise. `recommended`
// is HQ's proposal — only present when HQ has a pending recommendation (it's NOT
// the item's live price). `decided` is the director's committed price (or null).
export function displayPrice(item: PricingItem): {
  current: number;
  recommended: number | null;
  decided: number | null;
} {
  const isTemp = item.category_type === "temporary_allowance";
  const current = isTemp ? item.currentRetailPrice ?? item.currentBasePrice : item.currentBasePrice;
  const decided = isTemp ? item.newRetailPrice ?? null : item.newBasePrice;
  const rec = isTemp ? item.recommendedRetailPrice ?? null : item.recommendedBasePrice;
  return { current, recommended: item.hqReviewPending ? rec : null, decided };
}

// One labeled line for the two-price (TA) layout.
function PriceLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-9 shrink-0 text-[10px] uppercase tracking-wide text-gray-500">{label}</span>
      {children}
    </span>
  );
}

// Stacks the base + retail lines a TA needs (every other type renders one value).
function TwoPriceLines({ base, retail }: { base: React.ReactNode; retail: React.ReactNode }) {
  return (
    <span className="flex flex-col gap-0.5 text-sm tabular-nums">
      <PriceLine label="Base">{base}</PriceLine>
      <PriceLine label="Retail">{retail}</PriceLine>
    </span>
  );
}

// Current SAP price. A TA carries two distinct live prices — base/shelf + the
// allowance retail — so show both, labeled; every other type has a single price.
export function CurrentSapCell({ item }: { item: PricingItem }) {
  if (item.category_type !== "temporary_allowance") {
    return <span className="text-sm tabular-nums text-gray-900">{fmt(item.currentBasePrice)}</span>;
  }
  return (
    <TwoPriceLines
      base={<span className="text-gray-900">{fmt(item.currentBasePrice)}</span>}
      retail={<span className="text-gray-900">{fmt(item.currentRetailPrice ?? item.currentBasePrice)}</span>}
    />
  );
}

// HQ's recommendation ("—" when none). A TA shows the recommended base + retail.
export function HqRecCell({ item }: { item: PricingItem }) {
  if (!item.hqReviewPending) return <span className="text-sm text-gray-300">—</span>;
  if (item.category_type !== "temporary_allowance") {
    return <span className="text-sm tabular-nums text-gray-700">{fmt(item.recommendedBasePrice)}</span>;
  }
  return (
    <TwoPriceLines
      base={<span className="text-gray-700">{fmt(item.recommendedBasePrice)}</span>}
      retail={<span className="text-gray-700">{fmt(item.recommendedRetailPrice ?? item.currentBasePrice)}</span>}
    />
  );
}

// Format the director's committed price — a multi-unit deal shows "N for $X".
function fmtDecided(item: PricingItem, decided: number): string {
  const qty = item.category_type === "temporary_allowance" ? item.newRetailQty ?? 1 : 1;
  return qty > 1 ? fmtQtyPrice(qty, decided) : fmt(decided);
}

// One field's committed price (or "—") with the read-only sent/alert marker.
function decidedCell(
  display: string | null,
  value: number | null,
  status: PricingItem["baseOverrideStatus"],
  hasAlert: boolean
) {
  return <DecisionCell display={display} state={derivePriceState({ value, status, hasAlert })} />;
}

// The director's price decision(s) (or "—"). A TA can decide on base and retail
// independently, so each renders on its own line; only the retail line shows a
// multi-unit deal as "N for $X" (the base is always a single price).
export function YourPriceCell({ item }: { item: PricingItem }) {
  const baseDisplay = item.newBasePrice != null ? fmt(item.newBasePrice) : null;
  if (item.category_type !== "temporary_allowance") {
    return decidedCell(baseDisplay, item.newBasePrice, item.baseOverrideStatus, !!item.hasAlert);
  }
  const retailVal = item.newRetailPrice ?? null;
  const retailDisplay = retailVal != null ? fmtDecided(item, retailVal) : null;
  return (
    <TwoPriceLines
      base={decidedCell(baseDisplay, item.newBasePrice, item.baseOverrideStatus, !!item.hasAlert)}
      retail={decidedCell(retailDisplay, retailVal, item.retailOverrideStatus, false)}
    />
  );
}

// The physical shelf tag a price change maps to, so the table reads like the
// aisle: temporary allowances are the yellow promo tags, base/no-change are the
// white shelf tags, EDLP is a permanent reduction (white family, but its own
// program), new items get a fresh tag, discontinued ones go to clearance.
export type ShelfTagKind = "yellow" | "white" | "edlp" | "new" | "clearance";

export function shelfTagKind(item: PricingItem): ShelfTagKind {
  switch (item.category_type) {
    case "temporary_allowance":
      return "yellow";
    case "everyday_low_price":
      return "edlp";
    case "new_discontinued":
      return item.itemStatus === "discontinued" ? "clearance" : "new";
    default:
      return "white"; // base + no_change
  }
}

// Store-grounded tag colors. `swatch` paints the little tag chip; `pill` tints
// the target price so promos/lifecycle pop in the Price column ("a wall of
// yellow" = this week's deals) while routine white-tag changes stay calm.
export const SHELF_TAG_META: Record<ShelfTagKind, { label: string; swatch: string; text: string; pill: string }> = {
  yellow: { label: "Yellow tag", swatch: "bg-amber-300 border-amber-400", text: "text-amber-900", pill: "bg-amber-100 text-amber-900" },
  white: { label: "White tag", swatch: "bg-white border-gray-300", text: "text-gray-600", pill: "" },
  edlp: { label: "EDLP", swatch: "bg-white border-gray-300", text: "text-gray-600", pill: "" },
  new: { label: "New", swatch: "bg-emerald-300 border-emerald-400", text: "text-emerald-800", pill: "bg-emerald-100 text-emerald-800" },
  clearance: { label: "Clearance", swatch: "bg-rose-300 border-rose-400", text: "text-rose-800", pill: "bg-rose-100 text-rose-800" },
};

export function fmtShortDate(iso?: string | null): string | null {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// The shelf-tag chip: a colored tag swatch + label. The lens a director scans on
// — which etiqueta am I touching, and what should I prioritize.
export function ShelfTagCell({ item }: { item: PricingItem }) {
  const meta = SHELF_TAG_META[shelfTagKind(item)];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={`size-3 shrink-0 rounded-[3px] border ${meta.swatch}`} />
      <span className={`text-xs font-medium ${meta.text}`}>{meta.label}</span>
    </span>
  );
}

// The one number a director triages on: where the price is moving. Resolves the
// row's target — the director's decision wins, else HQ's pending proposal, else
// the price holds — and the per-unit % move off the current price (a multi-unit
// deal divides across its quantity).
function priceMove(item: PricingItem) {
  const { current, recommended, decided } = displayPrice(item);
  const qty = item.category_type === "temporary_allowance" ? item.newRetailQty ?? 1 : 1;
  const target = decided ?? recommended;
  const unit = target == null ? current : decided != null ? target / Math.max(1, qty) : target;
  const pct = current > 0 && target != null ? ((unit - current) / current) * 100 : 0;
  return { current, target, qty, decided, pct };
}

// Adaptive price cell: "current → target" with direction + magnitude when a
// change is in flight; a muted current price when nothing's moving. The target
// is tinted to its shelf tag (yellow promo / clearance / new), and a yellow tag
// surfaces its end date — so the Price column previews the actual shelf.
export function PriceMoveCell({ item }: { item: PricingItem }) {
  const { current, target, qty, decided, pct } = priceMove(item);
  const meta = SHELF_TAG_META[shelfTagKind(item)];
  const isNew = item.category_type === "new_discontinued" && item.itemStatus === "new";
  const endsOn = item.category_type === "temporary_allowance" ? fmtShortDate(item.allowanceEndDate) : null;

  if (target == null) {
    return <span className="text-sm tabular-nums text-gray-400">{fmt(current)}</span>;
  }

  const targetDisplay = decided != null && qty > 1 ? fmtQtyPrice(qty, target) : fmt(target);
  const rounded = Math.round(pct);
  // The tinted target chip — the visual echo of the shelf tag.
  const targetChip = (
    <span className={`rounded px-1.5 py-0.5 font-semibold text-gray-900 ${meta.pill}`}>{targetDisplay}</span>
  );

  return (
    <span className="flex items-center gap-1.5 text-sm tabular-nums">
      {isNew ? (
        <>
          <span className="text-gray-400">Set</span>
          {targetChip}
        </>
      ) : (
        <>
          <span className="text-gray-400">{fmt(current)}</span>
          <span aria-hidden="true" className="text-gray-300">→</span>
          {targetChip}
          {rounded !== 0 && (
            <span className="text-xs text-gray-500">
              {rounded < 0 ? "↓" : "↑"}
              {Math.abs(rounded)}%
            </span>
          )}
        </>
      )}
      {endsOn && <span className="text-xs text-amber-700">· ends {endsOn}</span>}
    </span>
  );
}

// Workflow status + the director's decision, merged into one column. The colored
// badge is the workflow stage (the scanning signal: Live / Needs review / Edited
// / In batch / Pending SAP). The HQ-relative decision (Accepted / Overridden /
// Kept current) rides below as a quiet qualifier only when it adds something the
// status doesn't already imply — Pending and a plain director "Changed" are left
// off so untouched Live rows stay calm. A ⓘ next to the badge reveals the full
// breakdown when several fields changed at once.
export function StatusCell({ item, batches }: { item: PricingItem; batches: Batch[] }) {
  const status = deriveItemStatus(item, batches);
  const decision = deriveDecision(item);
  const qualifier =
    decision === "accepted" || decision === "overridden" || decision === "kept_current"
      ? DECISION_META[decision]?.label
      : null;
  const entries = changeEntries(item);
  const multi = entries.length >= 2;

  return (
    <span className="flex flex-col gap-0.5">
      <span className="inline-flex items-center gap-1.5">
        <Badge tone={status.tone} size="sm">
          <span className="inline-flex items-center gap-1">
            {status.loading && (
              <Loader2 aria-hidden className="size-3 animate-spin motion-reduce:animate-none" />
            )}
            {status.label}
          </span>
        </Badge>
        {multi && (
          <Tooltip
            content={
              <ul className="flex flex-col gap-1 text-left">
                {entries.map((e) => (
                  <li key={e.kind} className="flex flex-col">
                    <span className="text-xs font-medium">{e.label}</span>
                    {e.detail && <span className="text-[11px] tabular-nums opacity-80">{e.detail}</span>}
                  </li>
                ))}
              </ul>
            }
          >
            <span className="inline-flex cursor-default" aria-label="Multiple changes — hover for details">
              <Info aria-hidden className="size-3.5 text-gray-400" />
            </span>
          </Tooltip>
        )}
      </span>
      {qualifier && <span className="text-xs text-gray-500">{qualifier}</span>}
    </span>
  );
}

// Minimal default columns + optional ones toggled via the gear menu.
export function buildStoreColumns(
  sel: SelHandlers,
  batches: Batch[],
  visibleCols: Set<string>
): DataColumn<PricingItem>[] {
  const optional = STORE_OPTIONAL_COLUMNS.filter((c) => visibleCols.has(c.id)).map((c) => OPTIONAL_DEFS[c.id]);

  return [
    selectCol(sel),
    idCol,
    itemCol(),
    textCol("category", "Category", (r) => r.category, 140),
    {
      id: "tag",
      group: "item",
      width: 120,
      header: "Tag",
      sortable: true,
      // Sort groups the shelf by tag family (yellow promos together, etc.).
      sortAccessor: (r) => SHELF_TAG_META[shelfTagKind(r)].label,
      cell: (r) => <ShelfTagCell item={r} />,
    },
    {
      id: "price",
      group: "item",
      width: 190,
      header: "Price",
      sortable: true,
      // Sort by magnitude of the move so a click surfaces the biggest changes
      // (calm, no-change rows settle together at the bottom).
      sortAccessor: (r) => Math.abs(priceMove(r).pct),
      cell: (r) => <PriceMoveCell item={r} />,
    },
    ...optional,
    {
      id: "status",
      group: "item",
      width: 150,
      header: "Status",
      sortable: true,
      sortAccessor: (r) => deriveItemStatus(r, batches).label,
      cell: (r) => <StatusCell item={r} batches={batches} />,
    },
  ];
}
