"use client";

import { ChevronLeft, Trash2 } from "lucide-react";
import { Button } from "@dejesumensaje/converge-ds-experimental";
import { usePricingStore } from "@/store/pricing-store";
import { computeWalkRows, useMobileSessionStore, type WalkRow } from "@/store/mobile-session";
import { MoveLine } from "@/components/store/buildStoreColumns";
import { FuelMoveLine } from "./FuelMove";
import { fmtQtyPrice } from "@/lib/format";

type Props = {
  onEditItem: (itemId: string) => void;
  onEndWalk: () => void;
  onBack: () => void;
};

// Full-screen sheet: THIS session's edits only — computeWalkRows scopes each
// row to the sections actually edited this walk, so pre-seeded mockOverrides
// on other sections of a touched item never show up here (and can't be
// discarded from here). Fuel has no Override record, so its old→new comes
// from the session baseline snapshot; base/retail reuse the pending
// Override's `currentPrice`.
export function SessionTray({ onEditItem, onEndWalk, onBack }: Props) {
  const items = usePricingStore((s) => s.items);
  const overrides = usePricingStore((s) => s.overrides);
  const updateBasePrice = usePricingStore((s) => s.updateBasePrice);
  const updateFuelSaver = usePricingStore((s) => s.updateFuelSaver);
  const removeFromLooseTray = usePricingStore((s) => s.removeFromLooseTray);
  const walkOrder = useMobileSessionStore((s) => s.walkOrder);
  const walkEntries = useMobileSessionStore((s) => s.walkEntries);
  const untouch = useMobileSessionStore((s) => s.untouch);

  const rows = computeWalkRows(items, overrides, walkOrder, walkEntries);

  // Reverts ONLY the sections this session edited (rows carry no override for
  // untouched sections), reusing desktop's own revert semantics: base via the
  // family-aware clear, retail via removeFromLooseTray (which also undoes the
  // TA auto-conversion), fuel back to the session baseline.
  const discard = (row: WalkRow) => {
    if (row.baseOverride) updateBasePrice(row.item.id, null);
    if (row.retailOverride) removeFromLooseTray(`${row.item.id}:retail`);
    if (row.fuelChanged) updateFuelSaver(row.item.id, row.fuelBaseline ?? null);
    untouch(row.item.id);
  };

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
        <span className="shrink-0 text-sm font-semibold text-gray-900">
          Session — {rows.length} item{rows.length === 1 ? "" : "s"}
        </span>
        <span className="flex-1" aria-hidden="true" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {rows.length === 0 ? (
          <p className="mt-10 text-center text-sm text-gray-600">No edits yet this walk.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li key={row.item.id}>
                <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <button onClick={() => onEditItem(row.item.id)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-medium text-gray-900">{row.item.name}</p>
                    {/* Desktop's shelf-tag convention, one stacked line per
                        section: base becomes a white tag, retail a yellow
                        promo tag, fuel the blue chip — the same MoveLine the
                        catalog table renders. Unchanged fuel still rides
                        along as the steady chip (context, not an edit). */}
                    <div className="mt-1 flex flex-col gap-1">
                      {row.baseOverride && (
                        <MoveLine
                          label="Base"
                          original={row.baseOverride.currentPrice}
                          display={fmtQtyPrice(row.item.newBaseQty, row.item.newBasePrice ?? row.item.currentBasePrice)}
                          tag="white"
                        />
                      )}
                      {row.retailOverride && (
                        <MoveLine
                          label="Retail"
                          original={row.retailOverride.currentPrice}
                          display={fmtQtyPrice(row.item.newRetailQty, row.item.newRetailPrice ?? row.item.currentBasePrice)}
                          tag="yellow"
                        />
                      )}
                      <FuelMoveLine
                        label="Fuel"
                        from={row.fuelBaseline}
                        to={row.item.fuelSaver ?? null}
                        changed={row.fuelChanged}
                      />
                    </div>
                  </button>
                  <button
                    onClick={() => discard(row)}
                    aria-label={`Discard changes to ${row.item.name}`}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-gray-100 p-4 pb-[env(safe-area-inset-bottom)]">
        {/* Two explicit lines rather than relying on the label to wrap — the
            full sentence doesn't fit on one line at 360px. */}
        <Button variant="primary" className="h-auto min-h-14 w-full flex-col gap-0 whitespace-normal py-2 leading-tight" onClick={onEndWalk}>
          <span>End walk</span>
          <span className="text-xs font-normal opacity-90">
            {rows.length} change{rows.length === 1 ? "" : "s"} pending desktop review
          </span>
        </Button>
      </div>
    </div>
  );
}
