"use client";

import { DataColumn } from "../DataTable";
import { PricingItem } from "@/types/pricing";
import { itemInfoColumns } from "./shared";
import { Badge } from "@dejesumensaje/converge-ds-experimental";
import { PRICE_TYPE_META } from "@/lib/pricing-meta";

type SelectionApi = {
  isSelected: (row: PricingItem) => boolean;
  toggle: (row: PricingItem) => void;
  toggleAll: () => void;
  allSelected: boolean;
};

export function buildAllItemsColumns(sel: SelectionApi): DataColumn<PricingItem>[] {
  return [
    ...itemInfoColumns(sel.isSelected, sel.toggle, sel.toggleAll, sel.allSelected),
    {
      id: "priceType",
      group: "item",
      width: 180,
      header: "Price type",
      sortable: true,
      sortAccessor: (r) => PRICE_TYPE_META[r.category_type].label,
      cell: (r) => {
        const meta = PRICE_TYPE_META[r.category_type];
        return <Badge tone={meta.tone} size="sm">{meta.label}</Badge>;
      },
    },
  ];
}
