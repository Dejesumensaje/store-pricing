"use client";

import { Loader2, Fuel } from "lucide-react";
import { DataColumn } from "../pricing-table/DataTable";
import { itemCol, idCol } from "../pricing-table/columns/shared";
import { PricingItem, Batch } from "@/types/pricing";
import { deriveItemStatus, hqReviewNeeded } from "@/lib/item-status";
import { fmt, fmtQtyPrice, fmtDateTime } from "@/lib/format";
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

// The run-window for a promo / fuel saver, phrased for a tooltip. Dates now live
// on hover over the tag itself (no standalone calendar icon), so this is the
// tooltip copy rather than a rendered element.
function dateRange(start?: string | null, end?: string | null): string | null {
  if (!start && !end) return null;
  return start && end
    ? `${fmtShortDate(start)} – ${fmtShortDate(end)}`
    : end
    ? `ends ${fmtShortDate(end)}`
    : `from ${fmtShortDate(start)}`;
}

// The scheduled send time for the item, if it sits in a scheduled batch — surfaced
// in a tooltip on the "Scheduled" status pill. Override ids are `${itemId}:${field}`.
function scheduledSendAt(item: PricingItem, batches: Batch[]): string | null {
  const batch = batches.find(
    (b) => b.status === "scheduled" && b.overrideIds.some((id) => id.split(":")[0] === item.id)
  );
  return batch?.scheduledAt ?? null;
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

// A small "HQ" badge sitting next to the item NAME for items HQ has flagged for a
// price change. Provenance ("HQ wants a change here") belongs at the item level —
// the price tag itself stays one clean style regardless of who proposed it. The
// tooltip says why; the "Needs review" pill + amber row carry the call-to-action.
//
// Color economy: HQ wears the Hy-Vee brand teal — the same cool family as the
// "Needs review" status badge (DS informative) — NOT the fuel-saver blue. So the
// brand red stays "your action", fuel stays blue, and "this is HQ's" is teal.
export function HqBadge() {
  return (
    <Tooltip content="HQ recommends a price change — review and decide.">
      <span
        className="shrink-0 cursor-default rounded bg-brand/10 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-brand ring-1 ring-inset ring-brand/20"
        aria-label="HQ recommends a price change"
      >
        HQ
      </span>
    </Tooltip>
  );
}

// The "after" value reads as the physical shelf tag it becomes: white card for a
// base price, yellow card for a retail promo. ONE tag style — whether the value
// is the director's committed decision or HQ's proposal, the tag looks the same;
// the HQ name badge + "Needs review" status carry the "this is a proposal" signal.
const TAG_CHIP: Record<"white" | "yellow", string> = {
  white: "rounded border border-gray-300 bg-white px-1.5 py-0.5 font-semibold text-gray-900",
  yellow: "rounded border border-amber-300 bg-amber-200 px-1.5 py-0.5 font-semibold text-amber-950",
};

// One "original → after" line. No change ⇒ just the current price (muted). New
// items have no current price to strike, so they read "Set {price}".
function MoveLine({
  label,
  original,
  display,
  tag,
  setMode,
}: {
  label?: string;
  original: number | null;
  display: string | null;
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
          <span className={TAG_CHIP[tag]}>{display}</span>
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
  const baseLine = (
    <MoveLine
      label={showRetail ? "Base" : undefined}
      original={item.currentBasePrice}
      display={baseTarget != null ? fmt(baseTarget) : null}
      tag="white"
      setMode={isNew}
    />
  );

  if (!showRetail) return baseLine;

  const retailCurrent = item.currentRetailPrice ?? item.currentBasePrice;
  const decidedRetail = item.newRetailPrice ?? null;
  const recRetail = item.hqReviewPending ? item.recommendedRetailPrice ?? null : null;
  const retailTarget = decidedRetail ?? recRetail;
  const qty = decidedRetail != null ? item.newRetailQty ?? 1 : 1;
  const retailDisplay = retailTarget != null ? (qty > 1 ? fmtQtyPrice(qty, retailTarget) : fmt(retailTarget)) : null;

  // The promo run-window now lives on hover over the yellow retail price itself,
  // not on a separate calendar icon.
  const promoRange =
    item.category_type === "temporary_allowance"
      ? dateRange(item.allowanceStartDate, item.allowanceEndDate)
      : null;
  const retailLine = (
    <MoveLine label="Retail" original={retailCurrent} display={retailDisplay} tag="yellow" />
  );

  return (
    <span className="flex flex-col gap-0.5">
      {baseLine}
      {promoRange ? (
        <Tooltip content={`Promo ${promoRange}`}>
          <span className="inline-flex w-fit cursor-default">{retailLine}</span>
        </Tooltip>
      ) : (
        retailLine
      )}
    </span>
  );
}

// The "+$X fuel" chip — ONE style (the light blue outline), the same whether the
// saver is the director's add, an HQ suggestion, or an unchanged live one. Source
// is communicated at the item level (HQ name badge), not by recoloring the chip.
function FuelChip({ amount }: { amount: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-sm border border-blue-200 bg-blue-50 px-1 py-px text-[10px] font-bold tabular-nums text-blue-700">
      <Fuel aria-hidden="true" className="size-2.5" />+{fmt(amount)}
    </span>
  );
}

// Fuel saver, before→after — rendered as the shopper-facing fuel chip (one light
// style). A store add-on, so the "before" is usually none.
export function FuelSaverCell({ item }: { item: PricingItem }) {
  const current = item.currentFuelSaver ?? null;
  const decided = item.fuelSaver ?? null;
  const recommended = item.hqReviewPending ? item.recommendedFuelSaver ?? null : null;

  const target =
    decided != null && decided !== current ? decided
    : recommended != null && recommended !== current ? recommended
    : null;

  if (current == null && target == null) return <span className="text-sm text-gray-300">—</span>;

  // The fuel-saver run-window lives on hover over the chip itself (no calendar icon).
  const fuelRange = dateRange(item.fuelSaverStartDate, item.fuelSaverEndDate);
  const withDates = (chip: React.ReactNode) =>
    fuelRange ? (
      <Tooltip content={`Fuel saver ${fuelRange}`}>
        <span className="inline-flex cursor-default">{chip}</span>
      </Tooltip>
    ) : (
      chip
    );

  // No change — the steady live chip (or none).
  if (target == null) {
    return current != null && current > 0 ? (
      <span className="flex items-center gap-1.5">{withDates(<FuelChip amount={current} />)}</span>
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
      {withDates(<FuelChip amount={target} />)}
    </span>
  );
}

// Why a send to SAP can read "Failed" — shown on hover so the state isn't alarming.
const FAILED_HELP =
  "The last send to SAP didn't go through. It retries automatically; the price stays at its previous value until it succeeds.";

// The workflow-stage badge (Live / Needs review / Scheduled / Sending / Failed).
// "Needs review" carries a gently pulsing dot to pull the eye to undecided HQ
// proposals; "Scheduled" and "Failed" explain themselves on hover.
export function StatusCell({ item, batches }: { item: PricingItem; batches: Batch[] }) {
  const status = deriveItemStatus(item, batches);
  const isReview = status.label === "Needs review";

  const badge = (
    <Badge tone={status.tone} size="sm">
      <span className="inline-flex items-center gap-1">
        {isReview && (
          <span
            aria-hidden="true"
            className="review-dot inline-block size-1.5 shrink-0 rounded-full bg-current"
          />
        )}
        {status.loading && (
          <Loader2 aria-hidden className="size-3 animate-spin motion-reduce:animate-none" />
        )}
        {status.label}
      </span>
    </Badge>
  );

  // Failed → explain what it means and that it self-heals.
  if (status.label === "Failed") {
    return <Tooltip content={FAILED_HELP}>{wrapTip(badge)}</Tooltip>;
  }

  // Scheduled → surface when it sends, drawn from its scheduled batch.
  if (status.label === "Scheduled") {
    const at = scheduledSendAt(item, batches);
    if (at) return <Tooltip content={`Sends ${fmtDateTime(at)}`}>{wrapTip(badge)}</Tooltip>;
  }

  return badge;
}

// Tooltip triggers want a single focusable/hoverable child — wrap the badge so the
// cursor reads as informational.
function wrapTip(node: React.ReactNode) {
  return <span className="inline-flex cursor-default">{node}</span>;
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
    itemCol((r) => (hqReviewNeeded(r) ? <HqBadge /> : null)),
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
