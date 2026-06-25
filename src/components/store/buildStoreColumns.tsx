"use client";

import { Loader2, Fuel, CalendarClock } from "lucide-react";
import { DataColumn } from "../pricing-table/DataTable";
import { itemCol, idCol } from "../pricing-table/columns/shared";
import { PricingItem, Batch } from "@/types/pricing";
import { deriveItemStatus } from "@/lib/item-status";
import { deriveDecision, DECISION_META } from "@/lib/change-summary";
import { fmt, fmtQtyPrice } from "@/lib/format";
import { Badge, Tooltip } from "@dejesumensaje/converge-ds-experimental";

// Optional columns the gear/settings menu can toggle on (off by default). The
// default table already shows the before→after Price + Fuel saver cells, so the
// opt-in list is just supporting attributes (aisle, brand, cost, …).
export const STORE_OPTIONAL_COLUMNS: { id: string; label: string }[] = [
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
  aisle: textCol("aisle", "Aisle", (r) => r.aisle),
  subcategory: textCol("subcategory", "Subcategory", (r) => r.subcategory, 130),
  brand: textCol("brand", "Brand", (r) => r.brand, 110),
  packSize: textCol("packSize", "Pack size", (r) => r.packSize, 90),
  national: textCol("national", "National vs. store", (r) => r.nationalVsStore, 140),
  role: textCol("role", "Item role", (r) => r.itemRole, 130),
  cost: textCol("cost", "Cost", (r) => fmt(r.cost), 90, (r) => r.cost),
  sensitivity: textCol("sensitivity", "Sensitivity", (r) => r.sensitivity, 100),
};

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

// A subtle calendar icon whose tooltip shows a date window — used in the table to
// surface promo / fuel-saver run dates without spending a column on them.
function DatesTip({ start, end, label }: { start?: string | null; end?: string | null; label: string }) {
  if (!start && !end) return null;
  const range =
    start && end ? `${fmtShortDate(start)} – ${fmtShortDate(end)}`
    : end ? `ends ${fmtShortDate(end)}`
    : `from ${fmtShortDate(start)}`;
  return (
    <Tooltip content={`${label} ${range}`}>
      <span className="inline-flex shrink-0 cursor-default text-gray-400" aria-label={`${label} ${range}`}>
        <CalendarClock className="size-3.5" aria-hidden="true" />
      </span>
    </Tooltip>
  );
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

// Who set the "after" value in a price/fuel move: the director (a solid tag) or
// HQ (a dashed "proposed" tag in the SAME color family + a subtle "HQ" marker).
type MoveSource = "user" | "hq" | null;

// A subtle "HQ" marker placed AFTER a proposed value, so the value keeps its
// white/yellow tag-color convention while still signalling provenance. The
// tooltip explains it; it never recolors the price itself.
function HqMarker() {
  return (
    <Tooltip content="Recommended by HQ — open the item to accept or change it.">
      <span
        className="cursor-default rounded bg-blue-50 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-blue-600 ring-1 ring-inset ring-blue-100"
        aria-label="Recommended by HQ"
      >
        HQ
      </span>
    </Tooltip>
  );
}

// The "after" value reads as the physical shelf tag it becomes: white card for a
// base price, yellow card for a retail promo. The director's committed decision
// is the SOLID tag; an HQ proposal (not yet on the shelf) is the DASHED, lighter
// "proposed" variant of the same color — so the wall-of-yellow convention holds.
const TAG_CHIP: Record<"white" | "yellow", { solid: string; proposed: string }> = {
  white: {
    solid: "rounded border border-gray-300 bg-white px-1.5 py-0.5 font-semibold text-gray-900",
    proposed: "rounded border border-dashed border-gray-300 bg-gray-50 px-1.5 py-0.5 font-semibold text-gray-700",
  },
  yellow: {
    solid: "rounded border border-amber-300 bg-amber-200 px-1.5 py-0.5 font-semibold text-amber-950",
    proposed: "rounded border border-dashed border-amber-300 bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900",
  },
};

// One "original → after" line. No change ⇒ just the current price (muted). New
// items have no current price to strike, so they read "Set {price}".
function MoveLine({
  label,
  original,
  display,
  source,
  tag,
  setMode,
}: {
  label?: string;
  original: number | null;
  display: string | null;
  source: MoveSource;
  tag: "white" | "yellow";
  setMode?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5 text-sm tabular-nums">
      {label && <span className="w-9 shrink-0 text-[10px] uppercase tracking-wide text-gray-500">{label}</span>}
      {display == null ? (
        <span className={tag === "yellow" ? "text-amber-700" : "text-gray-500"}>{original != null ? fmt(original) : "—"}</span>
      ) : (
        <>
          {setMode ? (
            <span className="text-gray-400">Set</span>
          ) : original != null ? (
            <>
              <span className="text-gray-400 line-through">{fmt(original)}</span>
              <span aria-hidden="true" className="text-gray-300">→</span>
            </>
          ) : null}
          {source === "hq" ? (
            <>
              <span className={TAG_CHIP[tag].proposed}>{display}</span>
              <HqMarker />
            </>
          ) : (
            <span className={TAG_CHIP[tag].solid}>{display}</span>
          )}
        </>
      )}
    </span>
  );
}

// A retail/promo row is worth showing only when the item actually has one.
function hasRetailRow(item: PricingItem): boolean {
  return item.category_type === "temporary_allowance" || item.newRetailPrice != null;
}

// Magnitude of the base move, for the column's sort (biggest changes first).
function baseMovePct(item: PricingItem): number {
  const target = item.newBasePrice ?? (item.hqReviewPending ? item.recommendedBasePrice : null);
  if (target == null || !(item.currentBasePrice > 0)) return 0;
  return Math.abs((target - item.currentBasePrice) / item.currentBasePrice) * 100;
}

// The before→after price cell. Base row always; a Retail row stacks beneath it
// when the item carries a promo. Each row shows what was live → the new value,
// with the director's decision in bold and an undecided HQ proposal in a pill.
export function PriceCell({ item }: { item: PricingItem }) {
  const isNew = item.category_type === "new_discontinued" && item.itemStatus === "new";
  const showRetail = hasRetailRow(item);

  const baseTarget = item.newBasePrice != null ? item.newBasePrice : item.hqReviewPending ? item.recommendedBasePrice : null;
  const baseSource: MoveSource =
    item.newBasePrice != null ? "user" : item.hqReviewPending && item.recommendedBasePrice != null ? "hq" : null;
  const baseLine = (
    <MoveLine
      label={showRetail ? "Base" : undefined}
      original={item.currentBasePrice}
      display={baseTarget != null ? fmt(baseTarget) : null}
      source={baseSource}
      tag="white"
      setMode={isNew}
    />
  );

  if (!showRetail) return baseLine;

  const retailCurrent = item.currentRetailPrice ?? item.currentBasePrice;
  const decidedRetail = item.newRetailPrice ?? null;
  const recRetail = item.hqReviewPending ? item.recommendedRetailPrice ?? null : null;
  const retailTarget = decidedRetail ?? recRetail;
  const retailSource: MoveSource = decidedRetail != null ? "user" : recRetail != null ? "hq" : null;
  const qty = decidedRetail != null ? item.newRetailQty ?? 1 : 1;
  const retailDisplay = retailTarget != null ? (qty > 1 ? fmtQtyPrice(qty, retailTarget) : fmt(retailTarget)) : null;

  return (
    <span className="flex flex-col gap-0.5">
      {baseLine}
      <span className="flex items-center gap-1.5">
        <MoveLine label="Retail" original={retailCurrent} display={retailDisplay} source={retailSource} tag="yellow" />
        {item.category_type === "temporary_allowance" && (
          <DatesTip start={item.allowanceStartDate} end={item.allowanceEndDate} label="Promo" />
        )}
      </span>
    </span>
  );
}

// The blue "+$X fuel" chip — the same visual the shopper sees on the tag (and the
// drawer preview). `muted` = a fuel saver already live (no change this round).
function FuelChip({ amount, muted }: { amount: number; muted?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-sm px-1 py-px text-[10px] font-bold tabular-nums ${
        muted ? "border border-blue-200 bg-blue-50 text-blue-700" : "bg-blue-600 text-white"
      }`}
    >
      <Fuel aria-hidden="true" className="size-2.5" />+{fmt(amount)}
    </span>
  );
}

// Fuel saver, before→after — rendered as the shopper-facing fuel chip. A store
// add-on, so the "before" is usually none; the director's add is a solid chip,
// an HQ suggestion a muted chip + "HQ" marker, an unchanged live saver a muted chip.
export function FuelSaverCell({ item }: { item: PricingItem }) {
  const current = item.currentFuelSaver ?? null;
  const decided = item.fuelSaver ?? null;
  const recommended = item.hqReviewPending ? item.recommendedFuelSaver ?? null : null;

  const target =
    decided != null && decided !== current ? decided
    : recommended != null && recommended !== current ? recommended
    : null;
  const source: MoveSource =
    decided != null && decided !== current ? "user"
    : recommended != null && recommended !== current ? "hq"
    : null;

  if (current == null && target == null) return <span className="text-sm text-gray-300">—</span>;

  const dates = <DatesTip start={item.fuelSaverStartDate} end={item.fuelSaverEndDate} label="Fuel saver" />;

  // No change — the steady live chip (or none).
  if (target == null) {
    return current != null && current > 0 ? (
      <span className="flex items-center gap-1.5">
        <FuelChip amount={current} muted />
        {dates}
      </span>
    ) : (
      <span className="text-sm text-gray-300">—</span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 text-sm">
      {current != null && current > 0 && (
        <>
          <span className="text-xs tabular-nums text-gray-400 line-through">+{fmt(current)}</span>
          <span aria-hidden="true" className="text-gray-300">→</span>
        </>
      )}
      {source === "hq" ? (
        <>
          <FuelChip amount={target} muted />
          <HqMarker />
        </>
      ) : (
        <FuelChip amount={target} />
      )}
      {dates}
    </span>
  );
}

// Workflow status + the director's decision, merged into one column. The colored
// badge is the workflow stage (Live / Needs review / Scheduled / Sending / Failed).
// The HQ-relative decision (Accepted / Overridden / Kept current) rides below as a
// quiet qualifier only when it adds something the status doesn't already imply.
export function StatusCell({ item, batches }: { item: PricingItem; batches: Batch[] }) {
  const status = deriveItemStatus(item, batches);
  const decision = deriveDecision(item);
  const qualifier =
    decision === "accepted" || decision === "overridden" || decision === "kept_current"
      ? DECISION_META[decision]?.label
      : null;

  return (
    // items-start so the Badge keeps its content width (a flex-col child would
    // otherwise stretch to fill the column).
    <span className="flex flex-col items-start gap-0.5">
      <Badge tone={status.tone} size="sm">
        <span className="inline-flex items-center gap-1">
          {status.loading && (
            <Loader2 aria-hidden className="size-3 animate-spin motion-reduce:animate-none" />
          )}
          {status.label}
        </span>
      </Badge>
      {qualifier && <span className="text-xs text-gray-500">{qualifier}</span>}
    </span>
  );
}

// Minimal default columns + optional ones toggled via the gear menu. Decisions
// are made in the drawer (and forced into a batch), so the table is read-only —
// no select column / bulk bar.
export function buildStoreColumns(
  batches: Batch[],
  visibleCols: Set<string>
): DataColumn<PricingItem>[] {
  const optional = STORE_OPTIONAL_COLUMNS.filter((c) => visibleCols.has(c.id)).map((c) => OPTIONAL_DEFS[c.id]);

  return [
    idCol,
    itemCol(),
    textCol("category", "Category", (r) => r.category, 140),
    {
      id: "price",
      group: "item",
      width: 210,
      header: "Price",
      sortable: true,
      // Sort by magnitude of the move so a click surfaces the biggest changes
      // (calm, no-change rows settle together at the bottom).
      sortAccessor: (r) => baseMovePct(r),
      cell: (r) => <PriceCell item={r} />,
    },
    {
      id: "fuelSaver",
      group: "item",
      width: 140,
      header: "Fuel saver",
      sortable: true,
      sortAccessor: (r) => r.fuelSaver ?? r.currentFuelSaver ?? -1,
      cell: (r) => <FuelSaverCell item={r} />,
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
