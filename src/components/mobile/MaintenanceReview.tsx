"use client";

import { useState } from "react";
import { Button } from "@dejesumensaje/converge-ds-experimental";
import { usePricingStore } from "@/store/pricing-store";
import { useMobileSessionStore } from "@/store/mobile-session";
import { MoveLine } from "@/components/store/buildStoreColumns";
import { FuelMoveLine } from "./FuelMove";
import { fmtQtyPrice, fmtDateShort, fmtDateRange } from "@/lib/format";
import {
  REASON_META,
  STORE_BASE_REASON_OPTIONS,
  STORE_PROMO_REASON_OPTIONS,
  type PriceChangeReason,
} from "@/lib/price-change-reason";
import type { StoreBaseReason, StorePromoReason } from "@/types/pricing";
import { MetaChip, ReasonIcon, ReasonSheet } from "./MetaChips";

type Props = {
  itemId: string;
  onBack: () => void;
  onSent: () => void;
};

const reasonLabel = (r: string) => REASON_META[r as PriceChangeReason]?.label ?? r;

// The recap screen for Item Maintenance's confidence-over-throughput flow:
// "check & complete the paperwork, then send" — old→new per changed section
// with its effective date and change reason. Reasons are settable right here
// and REQUIRED before Send: this goes straight to SAP, so unlike a Store
// Walk there is no desktop review downstream to catch a missing reason.
export function MaintenanceReview({ itemId, onBack, onSent }: Props) {
  const items = usePricingStore((s) => s.items);
  const overrides = usePricingStore((s) => s.overrides);
  const confirmItemOverrides = usePricingStore((s) => s.confirmItemOverrides);
  const commitBaseReason = usePricingStore((s) => s.setBaseChangeReason);
  const commitRetailReason = usePricingStore((s) => s.setRetailChangeReason);
  const commitFuelReason = usePricingStore((s) => s.setFuelChangeReason);
  // Maintenance keeps its own fuel baseline (set on scan / first fuel edit) —
  // reading the walk session here would tie the two modes back together.
  const fuelBaselines = useMobileSessionStore((s) => s.maintFuelBaselines);

  const [reasonSheet, setReasonSheet] = useState<"base" | "retail" | "fuel" | null>(null);

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

  // Every changed section must carry a reason before this can reach SAP.
  const missingReason =
    (baseOverride && !item.chosenBaseReason) ||
    (retailOverride && !item.chosenRetailReason) ||
    (fuelChanged && !item.chosenFuelReason);

  const reasonChip = (section: "base" | "retail" | "fuel", value: string | undefined) => (
    <MetaChip
      icon={ReasonIcon}
      empty={!value}
      label={value ? reasonLabel(value) : "+ Reason"}
      ariaLabel={`${section === "base" ? "Base" : section === "retail" ? "Retail" : "Fuel Saver"} change reason`}
      onClick={() => setReasonSheet(section)}
    />
  );

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
            <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Base</p>
                <p className="text-xs text-gray-600">Effective {fmtDateShort(item.baseEffectiveDate) ?? "today"}</p>
              </div>
              <MoveLine
                original={baseOverride.currentPrice}
                display={fmtQtyPrice(item.newBaseQty, item.newBasePrice ?? item.currentBasePrice)}
                tag="white"
              />
              <div className="flex">{reasonChip("base", item.chosenBaseReason)}</div>
            </div>
          )}
          {retailOverride && (
            <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Retail</p>
                <p className="text-xs text-gray-600">{fmtDateRange(item.allowanceStartDate, item.allowanceEndDate)}</p>
              </div>
              <MoveLine
                original={retailOverride.currentPrice}
                display={fmtQtyPrice(item.newRetailQty, item.newRetailPrice ?? item.currentBasePrice)}
                tag="yellow"
              />
              <div className="flex">{reasonChip("retail", item.chosenRetailReason)}</div>
            </div>
          )}
          {fuelChanged && (
            <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Fuel Saver</p>
                <p className="text-xs text-gray-600">{fmtDateRange(item.fuelSaverStartDate, item.fuelSaverEndDate)}</p>
              </div>
              <FuelMoveLine from={fuelBaseline ?? null} to={item.fuelSaver ?? null} changed />
              <div className="flex">{reasonChip("fuel", item.chosenFuelReason)}</div>
            </div>
          )}
          {nothingChanged && <p className="text-sm text-gray-600">No changes to send yet.</p>}
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-100 p-4 pb-[env(safe-area-inset-bottom)]">
        {!nothingChanged && missingReason && (
          <p className="pb-2 text-center text-xs font-medium text-amber-700">Add a change reason to send</p>
        )}
        <Button
          variant="primary"
          className="h-14 w-full"
          disabled={nothingChanged || !!missingReason}
          onClick={handleSend}
        >
          Send to SAP
        </Button>
      </div>

      <ReasonSheet
        open={reasonSheet != null}
        title={
          reasonSheet === "base" ? "Base change reason" : reasonSheet === "fuel" ? "Fuel Saver reason" : "Retail change reason"
        }
        options={reasonSheet === "base" ? STORE_BASE_REASON_OPTIONS : STORE_PROMO_REASON_OPTIONS}
        value={
          reasonSheet === "base"
            ? item.chosenBaseReason
            : reasonSheet === "fuel"
              ? item.chosenFuelReason
              : item.chosenRetailReason
        }
        onSelect={(v) => {
          if (reasonSheet === "base") commitBaseReason(itemId, v as StoreBaseReason);
          else if (reasonSheet === "fuel") commitFuelReason(itemId, v as StorePromoReason);
          else if (reasonSheet === "retail") commitRetailReason(itemId, v as StorePromoReason);
        }}
        onClose={() => setReasonSheet(null)}
      />
    </div>
  );
}
