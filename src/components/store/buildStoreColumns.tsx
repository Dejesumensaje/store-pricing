"use client";

import { DataColumn } from "../pricing-table/DataTable";
import { selectCol, itemCol, idCol, SelHandlers } from "../pricing-table/columns/shared";
import { PricingItem, Batch } from "@/types/pricing";
import { PRICE_TYPE_META } from "@/lib/pricing-meta";
import { deriveItemStatus } from "@/lib/item-status";
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

// Current → new price. New = committed override; falls back to a muted HQ
// recommendation hint when HQ suggests a change the user hasn't acted on yet.
function PriceCell({ item }: { item: PricingItem }) {
  const isTemp = item.category_type === "temporary_allowance";
  const committedRetail = isTemp && item.newRetailPrice != null;
  const committedBase = item.newBasePrice != null;
  const hqSuggests = !item.reviewed && !committedBase && item.recommendedBasePrice !== item.currentBasePrice;

  if (committedRetail) {
    return (
      <span className="flex items-center gap-1.5 text-sm tabular-nums">
        <span className="text-gray-400 line-through">{fmt(item.currentRetailPrice ?? item.currentBasePrice)}</span>
        <span className="text-gray-300">›</span>
        <span className="font-semibold text-gray-900">{fmtQtyPrice(item.newRetailQty, item.newRetailPrice!)}</span>
      </span>
    );
  }
  if (committedBase) {
    return (
      <span className="flex items-center gap-1.5 text-sm tabular-nums">
        <span className="text-gray-400 line-through">{fmt(item.currentBasePrice)}</span>
        <span className="text-gray-300">›</span>
        <span className="font-semibold text-gray-900">{fmt(item.newBasePrice!)}</span>
      </span>
    );
  }
  if (hqSuggests) {
    return (
      <span className="flex items-center gap-1.5 text-sm tabular-nums">
        <span className="text-gray-500">{fmt(item.currentBasePrice)}</span>
        <span className="text-gray-300">›</span>
        <span className="font-medium text-brand">{fmt(item.recommendedBasePrice)}</span>
      </span>
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
      cell: (r) => {
        const meta = PRICE_TYPE_META[r.category_type];
        return <Badge tone={meta.tone} size="sm">{meta.label}</Badge>;
      },
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
