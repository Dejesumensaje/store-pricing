"use client";

import Image from "next/image";
import { Badge, Checkbox } from "@dejesumensaje/converge-ds-experimental";
import { PricingItem, Batch } from "@/types/pricing";
import { deriveItemStatus } from "@/lib/item-status";
import { pricingStrategyLabel } from "@/lib/change-summary";
import { CurrentSapCell, ChangeSummaryCell } from "./buildStoreColumns";

type Props = {
  rows: PricingItem[];
  batches: Batch[];
  isSelected: (r: PricingItem) => boolean;
  toggle: (r: PricingItem) => void;
  onRowClick: (r: PricingItem) => void;
};

// Phone-only card rendering of the items list — the fixed-width DataTable
// horizontal-scrolls badly on a ~375px screen. Mirrors the table's selected /
// override highlighting and reuses the same Current SAP price + Change summary
// cells and the status badge.
export function MobileItemList({ rows, batches, isSelected, toggle, onRowClick }: Props) {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((item) => {
        const selected = isSelected(item);
        const status = deriveItemStatus(item, batches);
        return (
          <li key={item.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => onRowClick(item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onRowClick(item);
                }
              }}
              className={`flex w-full items-start gap-3 rounded-xl border bg-white p-3 text-left transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                selected ? "border-brand ring-1 ring-brand" : item.hasOverride ? "border-amber-200" : "border-gray-200"
              }`}
            >
              <span onClick={(e) => e.stopPropagation()} className="mt-0.5 inline-flex">
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => toggle(item)}
                  aria-label={`Select ${item.name}`}
                />
              </span>

              <div className="size-10 shrink-0 overflow-hidden rounded-full bg-gray-100 flex items-center justify-center">
                {item.image ? (
                  <Image src={item.image} alt={item.name} width={40} height={40} className="object-cover" />
                ) : (
                  <span className="text-xs text-gray-300">img</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{item.name}</p>
                <p className="mt-0.5 truncate text-xs text-gray-500">
                  {item.id} · {item.category}
                </p>
                <div className="mt-2 flex flex-wrap items-start gap-x-6 gap-y-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-gray-400">Current SAP price</p>
                    <div className="mt-0.5">
                      <CurrentSapCell item={item} />
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-gray-400">Change summary</p>
                    <div className="mt-0.5">
                      <ChangeSummaryCell item={item} />
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {pricingStrategyLabel(item)}
                  </span>
                  <Badge tone={status.tone} size="sm">{status.label}</Badge>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
