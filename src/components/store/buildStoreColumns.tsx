"use client";

import { DataColumn } from "../pricing-table/DataTable";
import { selectCol, itemCol, idCol, SelHandlers } from "../pricing-table/columns/shared";
import { PricingItem, Batch, OverrideStatus } from "@/types/pricing";
import { PRICE_TYPE_META } from "@/lib/pricing-meta";
import { deriveItemStatus, hqReviewNeeded } from "@/lib/item-status";
import { fmt, fmtQtyPrice } from "@/lib/format";
import { Badge } from "@dejesumensaje/converge-ds-experimental";

// Optional columns the gear/settings menu can toggle on (off by default).
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

const textCol = (id: string, header: string, value: (r: PricingItem) => string, width = 120): DataColumn<PricingItem> => ({
  id,
  group: "item",
  width,
  header,
  cell: (r) => <span className="text-sm text-gray-700">{value(r)}</span>,
});

const OPTIONAL_DEFS: Record<string, DataColumn<PricingItem>> = {
  aisle: textCol("aisle", "Aisle", (r) => r.aisle),
  subcategory: textCol("subcategory", "Subcategory", (r) => r.subcategory, 130),
  brand: textCol("brand", "Brand", (r) => r.brand, 110),
  packSize: textCol("packSize", "Pack size", (r) => r.packSize, 90),
  national: textCol("national", "National vs. store", (r) => r.nationalVsStore, 140),
  role: textCol("role", "Item role", (r) => r.itemRole, 130),
  cost: textCol("cost", "Cost", (r) => fmt(r.cost), 90),
  sensitivity: textCol("sensitivity", "Sensitivity", (r) => r.sensitivity, 100),
};

// A change is "in-flight" (transition shown old → new) until SAP confirms it.
// Confirmed/absent → the price is settled and shown as a single live value.
const inFlight = (s?: OverrideStatus) => s === "pending" || s === "in_batch" || s === "submitted";

// One price field: a single live value when settled, else current → new.
function PriceLine({
  label,
  current,
  next,
  settled,
}: {
  label?: string;
  current: string;
  next: string;
  settled: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5 text-sm tabular-nums">
      {label && <span className="w-9 shrink-0 text-[10px] uppercase tracking-wide text-gray-400">{label}</span>}
      {settled ? (
        <span className="font-semibold text-gray-900">{next}</span>
      ) : (
        <>
          <span className="text-gray-400 line-through">{current}</span>
          <span aria-hidden="true" className="text-gray-300">→</span>
          <span className="font-semibold text-gray-900">{next}</span>
        </>
      )}
    </span>
  );
}

// Price column. Settled items show a single live price (no strike-through). The
// before → after pattern is reserved for the user's own edits. HQ recommendations
// are already live, so they show just the single live price + an "HQ" badge until
// reviewed. Temporary allowances show the retail deal, plus a labeled Base line
// when base also changed.
export function PriceCell({ item }: { item: PricingItem }) {
  const isTemp = item.category_type === "temporary_allowance";
  const committedRetail = isTemp && item.newRetailPrice != null;
  const committedBase = item.newBasePrice != null;

  // HQ review (already live, nothing overridden) — single live price + HQ badge.
  if (!committedBase && !committedRetail && hqReviewNeeded(item)) {
    return (
      <span className="flex items-center gap-1.5 text-sm tabular-nums">
        <span className="font-semibold text-gray-900">{fmt(item.currentBasePrice)}</span>
        <Badge tone="in-progress" size="sm">HQ</Badge>
      </span>
    );
  }

  if (isTemp) {
    const curRetail = item.currentRetailPrice ?? item.currentBasePrice;
    return (
      <span className="flex flex-col gap-0.5">
        <PriceLine
          label="Retail"
          current={fmt(curRetail)}
          next={committedRetail ? fmtQtyPrice(item.newRetailQty, item.newRetailPrice!) : fmt(curRetail)}
          settled={!committedRetail || !inFlight(item.retailOverrideStatus)}
        />
        {committedBase && (
          <PriceLine
            label="Base"
            current={fmt(item.currentBasePrice)}
            next={fmt(item.newBasePrice!)}
            settled={!inFlight(item.baseOverrideStatus)}
          />
        )}
      </span>
    );
  }

  if (committedBase) {
    return (
      <PriceLine
        current={fmt(item.currentBasePrice)}
        next={fmt(item.newBasePrice!)}
        settled={!inFlight(item.baseOverrideStatus)}
      />
    );
  }
  return <span className="text-sm tabular-nums text-gray-700">{fmt(item.currentBasePrice)}</span>;
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
    ...optional,
    {
      id: "price",
      group: "item",
      width: 160,
      header: "Price",
      sortable: true,
      sortAccessor: (r) => r.newBasePrice ?? r.currentBasePrice,
      cell: (r) => <PriceCell item={r} />,
    },
    {
      id: "priceType",
      group: "item",
      width: 160,
      header: "Price type",
      // Neutral chip — color is reserved for the Status column so the two adjacent
      // badges don't read as the same semantic.
      cell: (r) => (
        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {PRICE_TYPE_META[r.category_type].label}
        </span>
      ),
    },
    {
      id: "status",
      group: "item",
      width: 120,
      header: "Status",
      cell: (r) => {
        const status = deriveItemStatus(r, batches);
        return <Badge tone={status.tone} size="sm">{status.label}</Badge>;
      },
    },
  ];
}
