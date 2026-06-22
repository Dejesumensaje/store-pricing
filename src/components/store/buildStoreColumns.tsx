"use client";

import { Info } from "lucide-react";
import { DataColumn } from "../pricing-table/DataTable";
import { selectCol, itemCol, idCol, SelHandlers } from "../pricing-table/columns/shared";
import { PricingItem, Batch } from "@/types/pricing";
import { deriveItemStatus } from "@/lib/item-status";
import { deriveChangeSummary, pricingStrategyLabel, ChangeEntry } from "@/lib/change-summary";
import { fmt } from "@/lib/format";
import { Badge, Tooltip } from "@dejesumensaje/converge-ds-experimental";

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

// Current SAP state only, never pending edits. Only temporary allowances carry a
// retail price distinct from the base/shelf price — those show labeled Base +
// Retail lines; every other type has a single price.
export function CurrentSapCell({ item }: { item: PricingItem }) {
  if (item.category_type !== "temporary_allowance") {
    return <span className="text-sm tabular-nums text-gray-900">{fmt(item.currentBasePrice)}</span>;
  }
  const retail = item.currentRetailPrice ?? item.currentBasePrice;
  return (
    <span className="flex flex-col gap-0.5 text-sm tabular-nums">
      <span className="flex items-center gap-1.5">
        <span className="w-9 shrink-0 text-[10px] uppercase tracking-wide text-gray-500">Base</span>
        <span className="text-gray-900">{fmt(item.currentBasePrice)}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-9 shrink-0 text-[10px] uppercase tracking-wide text-gray-500">Retail</span>
        <span className="text-gray-900">{fmt(retail)}</span>
      </span>
    </span>
  );
}

// One action as two lines: the verb-led type, then its outcome. Some actions
// (e.g. discontinuation) have no price outcome — the second line is omitted.
// Understated weight/size so the column doesn't overpower the rest of the row —
// hierarchy comes from color (action darker, value lighter), not bold/large text.
function EntryLines({ entry }: { entry: ChangeEntry }) {
  return (
    <span className="flex flex-col leading-tight">
      <span className="text-xs text-gray-700">{entry.label}</span>
      {entry.detail && <span className="text-xs tabular-nums text-gray-400">{entry.detail}</span>}
    </span>
  );
}

// The pricing decision the store applied (type + outcome). Independent of the
// workflow status. Items with several modifications collapse to a count and
// reveal the full list on hover/focus.
export function ChangeSummaryCell({ item }: { item: PricingItem }) {
  const summary = deriveChangeSummary(item);

  if (summary.kind === "none") {
    return <span className="text-xs text-gray-400">No change</span>;
  }
  if (summary.kind === "single") {
    return <EntryLines entry={summary.entry} />;
  }
  return (
    <Tooltip
      content={
        <ul className="flex flex-col gap-1 text-left">
          {summary.entries.map((e) => (
            <li key={e.label} className="flex flex-col">
              <span className="text-xs font-medium">{e.label}</span>
              {e.detail && <span className="text-[11px] tabular-nums opacity-80">{e.detail}</span>}
            </li>
          ))}
        </ul>
      }
    >
      <span className="flex cursor-default flex-col leading-tight">
        <span className="inline-flex items-center gap-1 text-xs text-gray-700">
          Multiple changes
          <Info aria-hidden className="size-3 text-gray-400" />
        </span>
        <span className="text-xs text-gray-400">{summary.entries.length} modifications</span>
      </span>
    </Tooltip>
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
    ...optional,
    {
      id: "strategy",
      group: "item",
      width: 160,
      header: "Pricing strategy",
      // The item's current pricing model — never an action (that's Change summary).
      // Neutral chip — color is reserved for the Status column so the two adjacent
      // badges don't read as the same semantic.
      cell: (r) => (
        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {pricingStrategyLabel(r)}
        </span>
      ),
    },
    {
      id: "currentSap",
      group: "item",
      width: 150,
      header: "Current SAP price",
      sortable: true,
      sortAccessor: (r) => r.currentBasePrice,
      cell: (r) => <CurrentSapCell item={r} />,
    },
    {
      id: "changeSummary",
      group: "item",
      width: 200,
      header: "Change summary",
      cell: (r) => <ChangeSummaryCell item={r} />,
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
