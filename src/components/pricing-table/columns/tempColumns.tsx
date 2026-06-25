"use client";

import { DataColumn } from "../DataTable";
import { PricingItem } from "@/types/pricing";
import { fmt, compactItemColumns, buildImpactColumn, DecisionCell } from "./shared";
import { fmtDateShort, fmtQtyPrice } from "@/lib/format";
import { derivePriceState } from "../PriceInputCell";

type SelectionApi = {
  isSelected: (row: PricingItem) => boolean;
  toggle: (row: PricingItem) => void;
  toggleAll: () => void;
  allSelected: boolean;
};

export type TempColumnVisibility = {
  fuelSaver: boolean;
  dates: boolean;
};

// TA rows expose BOTH editable prices: the regular base price (regular cost)
// and the allowance retail price (net allowance cost). Start/end dates are
// informative-only in v1.0.
export function buildTempColumns(
  sel: SelectionApi,
  visible: TempColumnVisibility
): DataColumn<PricingItem>[] {
  const cols: DataColumn<PricingItem>[] = [
    ...compactItemColumns(sel),

    // ── Base (pinned) ──
    {
      id: "baseCurrent",
      group: "pricing",
      subgroup: "Base",
      width: 90,
      header: "Current",
      sortable: true,
      sortAccessor: (r) => r.currentBasePrice,
      cell: (r) => <span className="text-sm text-gray-800">{fmt(r.currentBasePrice)}</span>,
    },
    {
      id: "baseCost",
      group: "pricing",
      subgroup: "Base",
      width: 80,
      header: "Cost",
      cell: (r) => <span className="text-sm text-gray-800">{fmt(r.cost)}</span>,
    },
    {
      id: "baseNew",
      group: "pricing",
      subgroup: "Base",
      width: 150,
      header: "New price",
      cell: (r) => (
        <DecisionCell
          display={r.newBasePrice != null ? fmt(r.newBasePrice) : null}
          state={derivePriceState({ value: r.newBasePrice, status: r.baseOverrideStatus, hasAlert: r.hasAlert })}
        />
      ),
    },

    // ── Retail (pinned) ──
    {
      id: "retailCurrent",
      group: "pricing",
      subgroup: "Retail",
      width: 90,
      header: "Current",
      sortable: true,
      sortAccessor: (r) => r.currentRetailPrice ?? r.currentBasePrice,
      cell: (r) => (
        <span className="text-sm text-gray-800">{fmt(r.currentRetailPrice ?? r.currentBasePrice)}</span>
      ),
    },
    {
      id: "retailCost",
      group: "pricing",
      subgroup: "Retail",
      width: 100,
      header: "Allow. cost",
      cell: (r) => <span className="text-sm text-gray-800">{fmt(r.allowanceCost ?? r.cost)}</span>,
    },
    {
      id: "retailNew",
      group: "pricing",
      subgroup: "Retail",
      width: 190,
      header: "New price",
      cell: (r) => (
        <DecisionCell
          display={r.newRetailPrice != null ? fmtQtyPrice(r.newRetailQty, r.newRetailPrice) : null}
          state={derivePriceState({ value: r.newRetailPrice, status: r.retailOverrideStatus })}
        />
      ),
    },
  ];

  if (visible.fuelSaver) {
    cols.push({
      id: "fuelSaver",
      group: "pricing",
      subgroup: "Retail",
      width: 120,
      header: "Fuel saver",
      cell: (r) =>
        r.fuelSaver ? (
          <span className="text-sm text-gray-800">{fmt(r.fuelSaver)}</span>
        ) : (
          <span className="text-sm text-gray-300">—</span>
        ),
    });
  }

  if (visible.dates) {
    cols.push({
      id: "dates",
      group: "pricing",
      subgroup: "Retail",
      width: 120,
      header: "Start – End",
      cell: (r) =>
        r.allowanceStartDate && r.allowanceEndDate ? (
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {fmtDateShort(r.allowanceStartDate)} – {fmtDateShort(r.allowanceEndDate)}
          </span>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        ),
    });
  }

  // ── Impact (pinned) ──
  cols.push(buildImpactColumn((r) => r.newBasePrice != null || r.newRetailPrice != null));

  return cols;
}
