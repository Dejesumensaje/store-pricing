"use client";

import Image from "next/image";
import { PricingItem, Batch } from "@/types/pricing";
import { PriceCell, FuelSaverCell, StatusCell } from "./buildStoreColumns";
import { hqReviewNeeded } from "@/lib/item-status";

type Props = {
  rows: PricingItem[];
  batches: Batch[];
  onRowClick: (r: PricingItem) => void;
};

// Phone-only card rendering of the items list — the fixed-width DataTable
// horizontal-scrolls badly on a ~375px screen. Read-only (decisions happen in the
// drawer); reuses the same price + fuel + status cells.
export function MobileItemList({ rows, batches, onRowClick }: Props) {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((item) => {
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
                hqReviewNeeded(item)
                  ? "border-brand border-l-4 bg-brand/5"
                  : item.hasOverride
                  ? "border-amber-200"
                  : "border-gray-200"
              }`}
            >
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
                <div className="mt-2 flex items-start gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-gray-400">Price</p>
                    <div className="mt-0.5">
                      <PriceCell item={item} />
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-gray-400">Fuel saver</p>
                    <div className="mt-0.5">
                      <FuelSaverCell item={item} />
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusCell item={item} batches={batches} />
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
