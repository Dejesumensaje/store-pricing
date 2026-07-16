"use client";

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@dejesumensaje/converge-ds-experimental";
import { usePricingStore } from "@/store/pricing-store";
import { useMobileSessionStore } from "@/store/mobile-session";
import { fmt, fmtQtyPrice, fmtDateShort, fmtDateRange } from "@/lib/format";
import {
  REASON_META,
  STORE_BASE_REASON_OPTIONS,
  STORE_PROMO_REASON_OPTIONS,
  type PriceChangeReason,
} from "@/lib/price-change-reason";
import type { StoreBaseReason, StorePromoReason } from "@/types/pricing";
import { fuelAmountLabel } from "./FuelMove";
import { ReasonSheet, EffectiveSheet } from "./MetaChips";

type Section = "base" | "retail" | "fuel";
type Props = {
  itemId: string;
  mode: "walk" | "maint";
  onBack: () => void;
  onDone: () => void;
};

const reasonLabel = (r: string) => REASON_META[r as PriceChangeReason]?.label ?? r;

// STEP 2 of 2 — "when & why". Step 1 committed the values; this screen
// lists each change (old → new) and attaches its dates and change reason.
// Deliberately monochrome: each change is its own bordered block with the
// same two field rows, so the structure reads in black and white.
//
// Change reasons are MANDATORY in both modes (user decision 2026-07-16):
// the primary action stays disabled until every listed change carries one.
export function ChangeReviewScreen({ itemId, mode, onBack, onDone }: Props) {
  const items = usePricingStore((s) => s.items);
  const overrides = usePricingStore((s) => s.overrides);
  const confirmItemOverrides = usePricingStore((s) => s.confirmItemOverrides);
  const updateBaseEffectiveDate = usePricingStore((s) => s.updateBaseEffectiveDate);
  const updateAllowanceDates = usePricingStore((s) => s.updateAllowanceDates);
  const updateFuelSaverDates = usePricingStore((s) => s.updateFuelSaverDates);
  const commitBaseReason = usePricingStore((s) => s.setBaseChangeReason);
  const commitRetailReason = usePricingStore((s) => s.setRetailChangeReason);
  const commitFuelReason = usePricingStore((s) => s.setFuelChangeReason);
  const walkEntries = useMobileSessionStore((s) => s.walkEntries);
  const maintFuelBaselines = useMobileSessionStore((s) => s.maintFuelBaselines);

  const [sheet, setSheet] = useState<{ kind: "date" | "reason"; section: Section } | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

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

  // Which sections changed. Walk scopes to THIS session's touched sections
  // (a seeded pending override the director never touched must not appear);
  // maintenance scopes to the pending overrides + its own fuel baseline.
  const entry = walkEntries[itemId];
  const baseOverride = overrides.find((o) => o.id === `${itemId}:base` && o.status === "pending");
  const retailOverride = overrides.find((o) => o.id === `${itemId}:retail` && o.status === "pending");
  const fuelBaseline = mode === "walk" ? entry?.fuelBaseline : maintFuelBaselines[itemId];
  const showBase = !!baseOverride && (mode === "maint" || !!entry?.sections.base);
  const showRetail = !!retailOverride && (mode === "maint" || !!entry?.sections.retail);
  const showFuel =
    (mode === "walk" ? !!entry?.sections.fuel : fuelBaseline !== undefined) &&
    (item.fuelSaver ?? null) !== (fuelBaseline ?? null);
  const nothing = !showBase && !showRetail && !showFuel;

  const missingReason =
    (showBase && !item.chosenBaseReason) ||
    (showRetail && !item.chosenRetailReason) ||
    (showFuel && !item.chosenFuelReason);

  const handlePrimary = () => {
    if (mode === "maint") {
      confirmItemOverrides(itemId);
      onDone();
    } else {
      setSavedFlash(true);
      setTimeout(onDone, 600);
    }
  };

  // One field row — full-width target, label left, value right. The rows are
  // the whole grammar of this screen: every change block repeats them.
  const fieldRow = (label: string, value: string, empty: boolean, ariaLabel: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex min-h-12 w-full select-none touch-manipulation items-center justify-between gap-3 border-t border-gray-200 px-1 py-2 text-left active:bg-gray-50"
    >
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`flex min-w-0 items-center gap-1 text-sm font-semibold ${empty ? "text-gray-400" : "text-gray-900"}`}>
        <span className="truncate">{value}</span>
        <ChevronRight className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
      </span>
    </button>
  );

  const moveLine = (oldLabel: string, newLabel: string) => (
    <p className="text-base tabular-nums text-gray-900">
      <span className="text-gray-400 line-through">{oldLabel}</span>{" "}
      <span aria-hidden="true" className="text-gray-400">
        →
      </span>{" "}
      <span className="font-bold">{newLabel}</span>
    </p>
  );

  if (savedFlash) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-white">
        <span className="pop-in flex size-16 items-center justify-center rounded-full bg-emerald-100">
          <Check className="size-8 text-emerald-600" aria-hidden="true" />
        </span>
        <p className="rise-in text-lg font-semibold text-gray-900" style={{ animationDelay: "80ms" }}>
          Saved
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center border-b border-gray-100 px-2 py-1.5">
        <div className="flex flex-1 justify-start">
          <button
            onClick={onBack}
            className="-ml-1 flex min-h-11 select-none touch-manipulation items-center gap-0.5 rounded-lg pl-1 pr-2.5 text-sm font-medium text-gray-500 active:bg-gray-100"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
            Back
          </button>
        </div>
        <span className="shrink-0 text-sm font-semibold text-gray-900">When &amp; why</span>
        <div className="flex flex-1 justify-end">
          <span className="pr-2 text-xs font-medium tabular-nums text-gray-400">2 / 2</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="text-sm font-semibold text-gray-900">{item.name}</p>
        <p className="mt-0.5 text-xs text-gray-500">
          {item.size ?? item.packSize} · UPC {item.upc}
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {showBase && baseOverride && (
            <div className="rounded-xl border border-gray-300 bg-white px-3 pt-3 pb-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">Base price</p>
              <div className="mb-2 mt-1">
                {moveLine(fmt(baseOverride.currentPrice), fmtQtyPrice(item.newBaseQty, item.newBasePrice ?? item.currentBasePrice))}
              </div>
              {fieldRow(
                "Effective",
                fmtDateShort(item.baseEffectiveDate) ?? "Today",
                false,
                "Base effective date",
                () => setSheet({ kind: "date", section: "base" })
              )}
              {fieldRow(
                "Reason",
                item.chosenBaseReason ? reasonLabel(item.chosenBaseReason) : "Choose…",
                !item.chosenBaseReason,
                "Base change reason",
                () => setSheet({ kind: "reason", section: "base" })
              )}
            </div>
          )}

          {showRetail && retailOverride && (
            <div className="rounded-xl border border-gray-300 bg-white px-3 pt-3 pb-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">Retail</p>
              <div className="mb-2 mt-1">
                {moveLine(fmt(retailOverride.currentPrice), fmtQtyPrice(item.newRetailQty, item.newRetailPrice ?? item.currentBasePrice))}
              </div>
              {fieldRow(
                "Dates",
                fmtDateRange(item.allowanceStartDate, item.allowanceEndDate) ?? "Set dates",
                false,
                "Retail dates",
                () => setSheet({ kind: "date", section: "retail" })
              )}
              {fieldRow(
                "Reason",
                item.chosenRetailReason ? reasonLabel(item.chosenRetailReason) : "Choose…",
                !item.chosenRetailReason,
                "Retail change reason",
                () => setSheet({ kind: "reason", section: "retail" })
              )}
            </div>
          )}

          {showFuel && (
            <div className="rounded-xl border border-gray-300 bg-white px-3 pt-3 pb-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">Fuel Saver</p>
              <div className="mb-2 mt-1">{moveLine(fuelAmountLabel(fuelBaseline), fuelAmountLabel(item.fuelSaver))}</div>
              {fieldRow(
                "Dates",
                fmtDateRange(item.fuelSaverStartDate, item.fuelSaverEndDate) ?? "Set dates",
                false,
                "Fuel Saver dates",
                () => setSheet({ kind: "date", section: "fuel" })
              )}
              {fieldRow(
                "Reason",
                item.chosenFuelReason ? reasonLabel(item.chosenFuelReason) : "Choose…",
                !item.chosenFuelReason,
                "Fuel Saver change reason",
                () => setSheet({ kind: "reason", section: "fuel" })
              )}
            </div>
          )}

          {nothing && <p className="mt-8 text-center text-sm text-gray-600">Nothing to review.</p>}
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-100 p-4 pb-[env(safe-area-inset-bottom)]">
        {!nothing && missingReason && (
          <p className="pb-2 text-center text-xs font-medium text-amber-700">
            {mode === "walk" ? "Add a change reason to save" : "Add a change reason to send"}
          </p>
        )}
        <Button variant="primary" className="h-14 w-full" disabled={nothing || !!missingReason} onClick={handlePrimary}>
          {mode === "walk" ? "Save & next" : "Send to SAP"}
        </Button>
      </div>

      <ReasonSheet
        open={sheet?.kind === "reason"}
        title={
          sheet?.section === "base" ? "Base change reason" : sheet?.section === "fuel" ? "Fuel Saver reason" : "Retail change reason"
        }
        options={sheet?.section === "base" ? STORE_BASE_REASON_OPTIONS : STORE_PROMO_REASON_OPTIONS}
        value={
          sheet?.section === "base"
            ? item.chosenBaseReason
            : sheet?.section === "fuel"
              ? item.chosenFuelReason
              : item.chosenRetailReason
        }
        onSelect={(v) => {
          if (sheet?.section === "base") commitBaseReason(itemId, v as StoreBaseReason);
          else if (sheet?.section === "fuel") commitFuelReason(itemId, v as StorePromoReason);
          else if (sheet?.section === "retail") commitRetailReason(itemId, v as StorePromoReason);
        }}
        onClose={() => setSheet(null)}
      />

      <EffectiveSheet
        open={sheet?.kind === "date"}
        title={sheet?.section === "base" ? "Base effective date" : sheet?.section === "fuel" ? "Fuel Saver run" : "Promo window"}
        mode={sheet?.section === "base" ? "single" : "range"}
        start={
          sheet?.section === "base"
            ? item.baseEffectiveDate ?? ""
            : sheet?.section === "fuel"
              ? item.fuelSaverStartDate ?? ""
              : item.allowanceStartDate ?? ""
        }
        end={sheet?.section === "fuel" ? item.fuelSaverEndDate : item.allowanceEndDate}
        onApply={(s, e) => {
          if (sheet?.section === "base") updateBaseEffectiveDate(itemId, s);
          else if (sheet?.section === "fuel") updateFuelSaverDates(itemId, s, e);
          else if (sheet?.section === "retail") updateAllowanceDates(itemId, s, e);
        }}
        onClose={() => setSheet(null)}
      />
    </div>
  );
}
