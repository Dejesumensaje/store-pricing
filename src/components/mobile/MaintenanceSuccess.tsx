"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "@dejesumensaje/converge-ds-experimental";
import { usePricingStore } from "@/store/pricing-store";
import { useMobileSessionStore } from "@/store/mobile-session";
import { TAG_CHIP } from "@/components/store/buildStoreColumns";
import { FuelChip } from "./FuelMove";
import { fmt, fmtQtyPrice } from "@/lib/format";

type Props = {
  itemId: string;
  onScanNext: () => void;
};

// Checkmark + summary, then straight back to waiting for the next scan.
export function MaintenanceSuccess({ itemId, onScanNext }: Props) {
  const items = usePricingStore((s) => s.items);
  const overrides = usePricingStore((s) => s.overrides);
  const fuelBaselines = useMobileSessionStore((s) => s.maintFuelBaselines);
  const item = items.find((i) => i.id === itemId);

  const baseOverride = overrides.find((o) => o.id === `${itemId}:base`);
  const retailOverride = overrides.find((o) => o.id === `${itemId}:retail`);
  const fuelBaseline = fuelBaselines[itemId];
  const fuelChanged = item != null && fuelBaseline !== undefined && (item.fuelSaver ?? null) !== fuelBaseline;

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="flex size-20 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="size-10 text-emerald-600" aria-hidden="true" />
        </span>
        <div>
          <p className="text-lg font-semibold text-gray-900">Sent to SAP</p>
          {item && <p className="mt-1 text-sm text-gray-500">{item.name}</p>}
        </div>
        {item && (
          /* Desktop's shelf-tag convention — white base tag, yellow promo
             tag, blue fuel chip — same as the review recap it just confirmed. */
          <div className="flex flex-col gap-2 text-sm tabular-nums text-gray-700">
            {baseOverride && (
              <p className="flex items-center justify-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wide text-gray-500">Base</span>
                <span className={TAG_CHIP.white}>{fmtQtyPrice(item.newBaseQty, item.newBasePrice ?? item.currentBasePrice)}</span>
              </p>
            )}
            {retailOverride && (
              <p className="flex items-center justify-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wide text-gray-500">Retail</span>
                <span className={TAG_CHIP.yellow}>{fmtQtyPrice(item.newRetailQty, item.newRetailPrice ?? item.currentBasePrice)}</span>
              </p>
            )}
            {fuelChanged && (
              <p className="flex items-center justify-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wide text-gray-500">Fuel</span>
                {item.fuelSaver && item.fuelSaver > 0 ? (
                  <FuelChip value={item.fuelSaver} />
                ) : (
                  <span className="text-gray-500">None</span>
                )}
              </p>
            )}
            {!baseOverride && !retailOverride && !fuelChanged && <p className="text-gray-600">{fmt(item.currentBasePrice)}</p>}
          </div>
        )}
      </div>
      <div className="shrink-0 border-t border-gray-100 p-4 pb-[env(safe-area-inset-bottom)]">
        <Button variant="primary" className="h-14 w-full" onClick={onScanNext}>
          Scan next item
        </Button>
      </div>
    </div>
  );
}
