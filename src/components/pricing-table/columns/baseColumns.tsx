"use client";

import { DataColumn } from "../DataTable";
import { PricingItem } from "@/types/pricing";
import { fmt, compactItemColumns, buildImpactColumn, DecisionCell } from "./shared";
import { derivePriceState } from "../PriceInputCell";
import { Info } from "lucide-react";

type SelectionApi = {
  isSelected: (row: PricingItem) => boolean;
  toggle: (row: PricingItem) => void;
  toggleAll: () => void;
  allSelected: boolean;
};

export function buildBaseColumns(sel: SelectionApi): DataColumn<PricingItem>[] {
  return [
    ...compactItemColumns(sel),

    // ── Base price breakdown (pinned) ──
    {
      id: "current",
      group: "pricing",
      width: 110,
      header: "Current",
      sortable: true,
      sortAccessor: (r) => r.currentBasePrice,
      cell: (r) => <span className="text-sm text-gray-800">{fmt(r.currentBasePrice)}</span>,
    },
    {
      id: "cost",
      group: "pricing",
      width: 90,
      header: "Cost",
      sortable: true,
      sortAccessor: (r) => r.cost,
      cell: (r) => <span className="text-sm text-gray-800">{fmt(r.cost)}</span>,
    },
    {
      id: "recommended",
      group: "pricing",
      width: 130,
      header: "Recommended",
      sortable: true,
      sortAccessor: (r) => r.recommendedBasePrice,
      cell: (r) => <span className="text-sm text-gray-800">{fmt(r.recommendedBasePrice)}</span>,
    },
    {
      id: "newBase",
      group: "pricing",
      width: 150,
      header: "New base price",
      cell: (r) => (
        <DecisionCell
          display={r.newBasePrice != null ? fmt(r.newBasePrice) : null}
          state={derivePriceState({ value: r.newBasePrice, status: r.baseOverrideStatus, hasAlert: r.hasAlert })}
        />
      ),
    },
    {
      id: "change",
      group: "pricing",
      width: 120,
      header: (
        <span className="flex items-center gap-1">
          Change <Info className="size-3 text-gray-400" />
        </span>
      ),
      cell: (r) => {
        const effective = r.newBasePrice ?? r.recommendedBasePrice;
        const diff = effective - r.currentBasePrice;
        return (
          <span className={`text-sm font-medium ${diff >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {diff >= 0 ? "+ " : "- "}{fmt(Math.abs(diff))}
          </span>
        );
      },
    },

    // ── Impact (pinned) ──
    buildImpactColumn((r) => r.newBasePrice != null),
  ];
}
