"use client";

import { Fuel, AlertTriangle } from "lucide-react";
import { DataColumn } from "../pricing-table/DataTable";
import { itemCol, idCol } from "../pricing-table/columns/shared";
import { PricingItem, HqBaseReason, HqPromoReason } from "@/types/pricing";
import { deriveItemStatus, hqReviewNeeded, baseRecPending, retailRecPending, fuelRecPending } from "@/lib/item-status";
import { REASON_META, PriceChangeReason } from "@/lib/price-change-reason";
import { fmt, fmtQtyPrice, fmtDateShort } from "@/lib/format";
import { perUnit } from "@/lib/pricing-math";
import { committedEdlpCeilingState } from "@/lib/edlp-ceiling";
import { useEdlpException } from "@/store/pricing-store";
import { Badge, Tooltip } from "@dejesumensaje/converge-ds-experimental";

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

// The run-window for a promo / fuel saver, phrased for a tooltip. Dates now live
// on hover over the tag itself (no standalone calendar icon), so this is the
// tooltip copy rather than a rendered element.
function dateRange(start?: string | null, end?: string | null): string | null {
  if (!start && !end) return null;
  return start && end
    ? `${fmtDateShort(start)} – ${fmtDateShort(end)}`
    : end
    ? `ends ${fmtDateShort(end)}`
    : `from ${fmtDateShort(start)}`;
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
// tooltip says why; the "Needs review" pill + red row rail carry the call-to-action.
//
// HQ wears the Hy-Vee red — HQ *is* Hy-Vee headquarters, so the brand red reads as
// "this came from HQ, look here". A subtle pulse (.hq-pulse) draws the eye without
// shouting. The change reason rides along in the tooltip — secondary info, on
// demand, never its own table furniture.
export function HqBadge({ reasons }: { reasons?: PriceChangeReason[] }) {
  // An item's HQ recommendation can span several sections (Base, Retail, Fuel
  // Saver) at once, each with its own reason — list them all rather than
  // picking one and hiding the rest.
  const labels = (reasons ?? []).map((r) => REASON_META[r].label);
  const why = labels.length > 0 ? `${labels.join(", ")} — HQ recommends a price change.` : "HQ recommends a price change.";
  return (
    <Tooltip content={`${why} Review and decide.`}>
      <span
        className="hq-pulse shrink-0 cursor-default rounded bg-hyvee-red/10 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-hyvee-red ring-1 ring-inset ring-hyvee-red/30"
        aria-label={why}
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
// Exported: the mobile session tray / maintenance recap reuse the exact same
// tag treatment so a price move reads identically on the handheld and here.
export const TAG_CHIP: Record<"white" | "yellow", string> = {
  white: "whitespace-nowrap rounded border border-gray-300 bg-white px-1.5 py-0.5 font-semibold text-gray-900",
  yellow: "whitespace-nowrap rounded border border-amber-300 bg-amber-200 px-1.5 py-0.5 font-semibold text-amber-950",
};

// One "original → after" line. No change ⇒ just the current price (muted). New
// items have no current price to strike, so they read "Set {price}".
// Exported for the mobile surfaces (see TAG_CHIP).
export function MoveLine({
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

function hasRetailRow(item: PricingItem): boolean {
  return item.category_type === "temporary_allowance" || item.newRetailPrice != null;
}

function baseMovePct(item: PricingItem): number {
  // A pack-size base moves by its per-unit price, not the deal total.
  const target =
    item.newBasePrice != null
      ? perUnit(item.newBasePrice, item.newBaseQty)
      : baseRecPending(item)
        ? item.recommendedBasePrice
        : null;
  if (target == null || !(item.currentBasePrice > 0)) return 0;
  return Math.abs((target - item.currentBasePrice) / item.currentBasePrice) * 100;
}

export function PriceCell({ item }: { item: PricingItem }) {
  const isNew = item.category_type === "new_discontinued" && item.itemStatus === "new";
  const showRetail = hasRetailRow(item);

  // EDLP ceiling — same "Over EDLP max" indicator the drawer's price input
  // shows, so over-max items are visible in the catalog without opening them.
  // committedEdlpCeilingState is "ok" for anything non-EDLP, so this is inert
  // for the rest of the table.
  const edlpException = useEdlpException();
  const edlpLevel = committedEdlpCeilingState(item, edlpException).level;
  const edlpIndicator =
    edlpLevel !== "ok" ? (
      <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
        <AlertTriangle className="size-3" aria-hidden="true" /> Over EDLP max
      </span>
    ) : null;

  // baseRecPending already filters out a rec whose target equals the current
  // base (retail-only recommendations seed these) — NOT a base move, so no
  // "$3.19 → $3.19" strikethrough. It also stops advertising a rec the
  // director declined or already decided (per-section, not per-item).
  const recBase = baseRecPending(item) ? item.recommendedBasePrice : null;
  const baseTarget = item.newBasePrice != null ? item.newBasePrice : recBase;
  // Only a decided base can be a pack-size deal (HQ recs are always single-unit).
  const baseQty = item.newBasePrice != null ? item.newBaseQty ?? 1 : 1;
  const baseLine = (
    <MoveLine
      label={showRetail ? "Base" : undefined}
      original={item.currentBasePrice}
      display={baseTarget != null ? (baseQty > 1 ? fmtQtyPrice(baseQty, baseTarget) : fmt(baseTarget)) : null}
      tag="white"
      setMode={isNew}
    />
  );

  if (!showRetail) {
    return edlpIndicator ? (
      <span className="flex flex-col gap-0.5">
        {baseLine}
        {edlpIndicator}
      </span>
    ) : (
      baseLine
    );
  }

  const retailCurrent = item.currentRetailPrice ?? item.currentBasePrice;
  const decidedRetail = item.newRetailPrice ?? null;
  const recRetail = retailRecPending(item) ? item.recommendedRetailPrice ?? null : null;
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
    <span className="flex flex-col gap-1">
      <span className="flex flex-col gap-0.5">
        {baseLine}
        {edlpIndicator}
      </span>
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

export function FuelSaverCell({ item }: { item: PricingItem }) {
  const current = item.currentFuelSaver ?? null;
  const decided = item.fuelSaver ?? null;
  // fuelRecPending (not hqReviewPending) — the rec chip is only advertised
  // while THIS section is still actionable, matching the drawer's fuel
  // accept-first block, so the table never promises a decision the drawer no
  // longer offers (a pending base rec alone doesn't re-advertise fuel).
  const recommended = fuelRecPending(item) ? item.recommendedFuelSaver ?? null : null;

  const target =
    decided != null && decided !== current ? decided
    : recommended != null && recommended !== current ? recommended
    : null;

  if (current == null && target == null) return null;

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
    ) : null;
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

export function StatusCell({ item }: { item: PricingItem }) {
  const status = deriveItemStatus(item);
  const isReview = status.label === "Needs review";

  return (
    <Badge tone={status.tone} size="sm">
      <span className="inline-flex items-center gap-1">
        {isReview && (
          <span
            aria-hidden="true"
            className="review-dot inline-block size-1.5 shrink-0 rounded-full bg-current"
          />
        )}
        {status.label}
      </span>
    </Badge>
  );
}

// No select column — decisions happen in the drawer, applied directly.
export function buildStoreColumns(visibleCols: Set<string>): DataColumn<PricingItem>[] {
  const optional = STORE_OPTIONAL_COLUMNS.filter((c) => visibleCols.has(c.id)).map((c) => OPTIONAL_DEFS[c.id]);

  return [
    idCol,
    itemCol((r) =>
      hqReviewNeeded(r) ? (
        // Only sections still pending — a decided section's reason no longer
        // advertises an open decision (mirrors the drawer header's badge).
        <HqBadge
          reasons={[
            baseRecPending(r) ? r.hqBaseReason : null,
            retailRecPending(r) ? r.hqRetailReason : null,
            fuelRecPending(r) ? r.hqFuelReason : null,
          ].filter((x): x is HqBaseReason | HqPromoReason => x != null)}
        />
      ) : null
    ),
    textCol("category", "Category", (r) => r.category, 140),
    {
      id: "price",
      group: "item",
      width: 210,
      header: (
        <span title="Sorts by percentage change magnitude, largest first">Price</span>
      ),
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
      sortAccessor: (r) => deriveItemStatus(r).label,
      cell: (r) => <StatusCell item={r} />,
    },
  ];
}
