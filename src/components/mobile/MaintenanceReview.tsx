"use client";

import { Button } from "@dejesumensaje/converge-ds-experimental";
import { usePricingStore } from "@/store/pricing-store";
import { useMobileSessionStore } from "@/store/mobile-session";
import { MoveLine } from "@/components/store/buildStoreColumns";
import { FuelMoveLine } from "./FuelMove";
import { fmtQtyPrice } from "@/lib/format";

type Props = {
  itemId: string;
  onBack: () => void;
  onSent: () => void;
};

// The recap screen for Item Maintenance's confidence-over-throughput flow:
// old→new per changed section, a locked "Effective: Immediately" row (room
// for a future date picker), and the big "Send to SAP" commit.
export function MaintenanceReview({ itemId, onBack, onSent }: Props) {
  const items = usePricingStore((s) => s.items);
  const overrides = usePricingStore((s) => s.overrides);
  const confirmItemOverrides = usePricingStore((s) => s.confirmItemOverrides);
  // Maintenance keeps its own fuel baseline (set on scan / first fuel edit) —
  // reading the walk session here would tie the two modes back together.
  const fuelBaselines = useMobileSessionStore((s) => s.maintFuelBaselines);

  const item = items.find((i) => i.id === itemId);
  if (!item) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-white px-6 text-center">
        <p className="text-sm text-gray-500">Item not found.</p>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
      </div>
    );
  }

  const baseOverride = overrides.find((o) => o.id === `${itemId}:base` && o.status === "pending");
  const retailOverride = overrides.find((o) => o.id === `${itemId}:retail` && o.status === "pending");
  const fuelBaseline = fuelBaselines[itemId];
  const fuelChanged = fuelBaseline !== undefined && (item.fuelSaver ?? null) !== fuelBaseline;
  const nothingChanged = !baseOverride && !retailOverride && !fuelChanged;

  // No toast here — the very next screen (MaintenanceSuccess) IS the "Sent to
  // SAP" confirmation; a toast would duplicate it and, at the bottom of a
  // narrow mobile viewport, visually collide with that screen's own
  // full-width primary button.
  const handleSend = () => {
    confirmItemOverrides(itemId);
    onSent();
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <button onClick={onBack} className="text-sm font-medium text-gray-500">
          Back
        </button>
        <span className="text-sm font-semibold text-gray-900">Review change</span>
        <span className="w-10" aria-hidden="true" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="text-base font-semibold text-gray-900">{item.name}</p>
        <p className="mt-0.5 text-xs text-gray-500">
          {item.size ?? item.packSize} · UPC {item.upc}
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {/* Desktop's shelf-tag convention: base lands on a white tag,
              retail on a yellow promo tag, fuel on the blue chip. */}
          {baseOverride && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Base</p>
              <div className="mt-1.5">
                <MoveLine
                  original={baseOverride.currentPrice}
                  display={fmtQtyPrice(item.newBaseQty, item.newBasePrice ?? item.currentBasePrice)}
                  tag="white"
                />
              </div>
            </div>
          )}
          {retailOverride && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Retail</p>
              <div className="mt-1.5">
                <MoveLine
                  original={retailOverride.currentPrice}
                  display={fmtQtyPrice(item.newRetailQty, item.newRetailPrice ?? item.currentBasePrice)}
                  tag="yellow"
                />
              </div>
            </div>
          )}
          {fuelChanged && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Fuel Saver</p>
              <div className="mt-1.5">
                <FuelMoveLine from={fuelBaseline ?? null} to={item.fuelSaver ?? null} changed />
              </div>
            </div>
          )}
          {nothingChanged && <p className="text-sm text-gray-600">No changes to send yet.</p>}

          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm">
            <span className="font-medium text-gray-500">Effective</span>
            <span className="font-semibold text-gray-900">Immediately</span>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-100 p-4 pb-[env(safe-area-inset-bottom)]">
        <Button variant="primary" className="h-14 w-full" disabled={nothingChanged} onClick={handleSend}>
          Send to SAP
        </Button>
      </div>
    </div>
  );
}
