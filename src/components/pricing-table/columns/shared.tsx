"use client";

import { DataColumn } from "../DataTable";
import { PricingItem } from "@/types/pricing";
import { Chip, Badge, Checkbox, Tooltip } from "@dejesumensaje/converge-ds-experimental";
import Image from "next/image";
import { Check, AlertCircle } from "lucide-react";
import { PriceCellState } from "../PriceInputCell";

export { fmt } from "@/lib/format";

// Read-only display of a price decision inside the (now non-editable) table.
// `display` = formatted price string, or null when no decision yet.
export function DecisionCell({ display, state }: { display: string | null; state: PriceCellState }) {
  if (display == null) return <span className="text-sm text-gray-300">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-900">
      {display}
      {state === "sent" && <Check className="size-3.5 text-emerald-600" />}
      {state === "alert" && <AlertCircle className="size-3.5 text-orange-500" />}
    </span>
  );
}

export function ImpactBadge({ level }: { level: "High" | "Medium" | "Low" }) {
  const tone = level === "High" ? "negative" : level === "Medium" ? "warning" : "success";
  return <Badge tone={tone} size="sm">{level}</Badge>;
}

type SelHandlers = {
  isSelected: (r: PricingItem) => boolean;
  /** Whether the row can be selected — only items with a decision are. */
  isSelectable?: (r: PricingItem) => boolean;
  toggle: (r: PricingItem) => void;
  toggleAll: () => void;
  allSelected: boolean;
};

export type { SelHandlers };

export function selectCol(h: SelHandlers): DataColumn<PricingItem> {
  return {
    id: "select",
    group: "item",
    width: 44,
    align: "center",
    header: (
      <Checkbox checked={h.allSelected} onCheckedChange={() => h.toggleAll()} aria-label="Select all" />
    ),
    cell: (row) => {
      const selectable = h.isSelectable ? h.isSelectable(row) : true;
      return (
        // Stop the click from bubbling to the row (which opens the edit drawer).
        <span onClick={(e) => e.stopPropagation()} className="inline-flex">
          <Checkbox
            checked={h.isSelected(row)}
            disabled={!selectable}
            onCheckedChange={() => h.toggle(row)}
            aria-label="Select item"
          />
        </span>
      );
    },
  };
}

export function itemCol(): DataColumn<PricingItem> {
  return {
    id: "item",
    group: "item",
    width: 230,
    header: "Item",
    sortable: true,
    sortAccessor: (r) => r.name,
    cell: (r) => (
      <div className="flex items-center gap-2.5">
        <div className="size-9 bg-gray-100 rounded-full flex items-center justify-center shrink-0 overflow-hidden">
          {r.image ? <Image src={r.image} alt={r.name} width={36} height={36} className="object-cover" /> : <span className="text-gray-300 text-xs">img</span>}
        </div>
        <Tooltip content={r.name}>
          <span className="text-sm font-medium text-gray-900 truncate max-w-[150px]">{r.name}</span>
        </Tooltip>
      </div>
    ),
  };
}

export const idCol: DataColumn<PricingItem> = { id: "id", group: "item", width: 90, header: "ID", sortable: true, sortAccessor: (r) => r.id, cell: (r) => <span className="text-sm text-gray-700">{r.id}</span> };
const aisleCol: DataColumn<PricingItem> = { id: "aisle", group: "item", width: 120, header: "Aisle", cell: (r) => <span className="text-sm text-gray-700">{r.aisle}</span> };

// Compact item columns for the change-type (pricing) views — keeps the item
// area narrow so the pinned pricing + impact block stays clean. Full item
// attributes live in the All items master view.
export function compactItemColumns(h: SelHandlers): DataColumn<PricingItem>[] {
  return [selectCol(h), idCol, itemCol(), aisleCol];
}

// Full item columns for the All items master catalog.
export function itemInfoColumns(
  isSelected: (row: PricingItem) => boolean,
  toggle: (row: PricingItem) => void,
  toggleAll: () => void,
  allSelected: boolean
): DataColumn<PricingItem>[] {
  const h = { isSelected, toggle, toggleAll, allSelected };
  return [
    selectCol(h),
    idCol,
    itemCol(),
    aisleCol,
    { id: "category", group: "item", width: 120, header: "Category", cell: (r) => <span className="text-sm text-gray-700">{r.category}</span> },
    { id: "subcategory", group: "item", width: 130, header: "Subcategory", cell: (r) => <span className="text-sm text-gray-700">{r.subcategory}</span> },
    { id: "brand", group: "item", width: 100, header: "Brand", cell: (r) => <span className="text-sm text-gray-700">{r.brand}</span> },
    { id: "packSize", group: "item", width: 90, header: "Pack size", cell: (r) => <span className="text-sm text-gray-700">{r.packSize}</span> },
    {
      id: "keyAttributes",
      group: "item",
      width: 180,
      header: "Key attributes",
      cell: (r) => (
        <div className="flex flex-nowrap gap-1 overflow-hidden">
          {r.keyAttributes.map((a) => <Chip key={a} size="sm">{a}</Chip>)}
        </div>
      ),
    },
    { id: "national", group: "item", width: 140, header: "National vs. store", cell: (r) => <span className="text-sm text-gray-700">{r.nationalVsStore}</span> },
    { id: "role", group: "item", width: 130, header: "Item role", cell: (r) => <span className="text-sm text-gray-700">{r.itemRole}</span> },
  ];
}

// ─── Shared impact column (group "impact", pinned right) ──────────────────────
// Impact reflects the row's DECISION, not the typed value: it stays "—" until
// the user commits a new price, then shows the HQ-precomputed impact with the
// full breakdown in a tooltip.

const signed = (v: number, suffix = "") => `${v >= 0 ? "+" : "−"}${Math.abs(v)}${suffix}`;

export function ImpactBreakdown({ item }: { item: PricingItem }) {
  const rows: [string, string][] = [
    ["Sales", `${signed(item.impactSalesValue, "M")} (${signed(item.impactSalesPct, "%")})`],
    ["Units", `${signed(item.impactUnitsValue, "k")} (${signed(item.impactUnitsPct, "%")})`],
    ["Margin", `${signed(item.impactMarginPct, "%")} (${signed(item.impactMarginValue, "M")})`],
    ["GM %", `${item.impactGmPct.toFixed(2)} (${(item.impactGmPct * 100).toFixed(2)}%)`],
  ];
  return (
    <div className="flex flex-col gap-1 min-w-[160px]">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-4 text-xs">
          <span className="text-gray-300">{label}</span>
          <span className="font-medium tabular-nums">{value}</span>
        </div>
      ))}
      <div className="flex items-center justify-between gap-4 text-xs pt-1 border-t border-white/20">
        <span className="text-gray-300">Confidence</span>
        <span className="font-medium">{item.impactConfidence}</span>
      </div>
    </div>
  );
}

export function buildImpactColumn(
  hasDecision: (r: PricingItem) => boolean
): DataColumn<PricingItem> {
  return {
    id: "impact",
    group: "impact",
    width: 140,
    header: "Impact",
    cell: (r) => {
      if (!hasDecision(r)) {
        return <span className="text-sm text-gray-300">—</span>;
      }
      const positive = r.impactSalesValue >= 0;
      return (
        <Tooltip content={<ImpactBreakdown item={r} />}>
          <span
            className={`inline-flex items-center gap-1 text-sm font-medium cursor-default tabular-nums ${
              positive ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {positive ? "▲" : "▼"} {signed(r.impactSalesValue, "M")} sales
          </span>
        </Tooltip>
      );
    },
  };
}
