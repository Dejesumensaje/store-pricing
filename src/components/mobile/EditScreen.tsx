"use client";

import { useEffect, useMemo, useState } from "react";
import type { RefObject } from "react";
import { Button, useToast } from "@dejesumensaje/converge-ds-experimental";
import { Check, Package, X } from "lucide-react";
import { usePricingStore, useEdlpException } from "@/store/pricing-store";
import { useMobileSessionStore } from "@/store/mobile-session";
import { buildItemsById, evaluateEdlpCeilingChange } from "@/lib/edlp-ceiling";
import { fmt } from "@/lib/format";
import { perUnit } from "@/lib/pricing-math";
import { RetailSection } from "./RetailSection";
import { FuelSaverRow } from "./FuelSaverRow";
import { FuelSaverSheet } from "./FuelSaverSheet";
import { BaseDisclosure } from "./BaseDisclosure";
import { DetailsDisclosure } from "./DetailsDisclosure";
import { MobileKeypad } from "./MobileKeypad";

type Props = {
  itemId: string;
  mode: "walk" | "maint";
  autoSaveRef: RefObject<(() => void) | null>;
  onSaveNext: () => void;
  onCancel: () => void;
};

// Up to $9,999.99 — comfortably above any shelf price, keeps the buffer from
// growing unbounded if a digit key sticks.
const MAX_DIGITS = 6;

// The single edit surface for both modes — Store Walk's "Save & next" and
// Item Maintenance's "Review change" differ only in their primary button and
// what happens after a valid commit (see handleSaveNext). Opens directly in
// edit mode — no Edit button/pencil tax like the desktop drawer.
export function EditScreen({ itemId, mode, autoSaveRef, onSaveNext, onCancel }: Props) {
  const items = usePricingStore((s) => s.items);
  const updateRetailPrice = usePricingStore((s) => s.updateRetailPrice);
  const updateBasePrice = usePricingStore((s) => s.updateBasePrice);
  const updatePriceType = usePricingStore((s) => s.updatePriceType);
  const updateFuelSaver = usePricingStore((s) => s.updateFuelSaver);
  const edlpException = useEdlpException();
  const touchSection = useMobileSessionStore((s) => s.touchSection);
  const setMaintFuelBaseline = useMobileSessionStore((s) => s.setMaintFuelBaseline);
  const toast = useToast();

  const item = items.find((i) => i.id === itemId) ?? null;
  const itemsById = useMemo(() => buildItemsById([items]), [items]);
  const familyItems = item?.familyId
    ? [...itemsById.values()].filter((i) => i.familyId === item.familyId && i.id !== item.id)
    : [];

  const [activeTarget, setActiveTarget] = useState<"retail" | "base">("retail");
  const [retailDigits, setRetailDigits] = useState("");
  const [retailQty, setRetailQty] = useState(1);
  const [baseDigits, setBaseDigits] = useState("");
  const [baseQty, setBaseQty] = useState(1);
  const [baseOpen, setBaseOpen] = useState(false);
  const [fuelSheetOpen, setFuelSheetOpen] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [fuelBaselineOnOpen, setFuelBaselineOnOpen] = useState<number | null>(null);

  // Reset edit state whenever a new item opens — including scan-while-
  // editing, which mounts a fresh EditScreen via MobileShell's `key={itemId}`.
  useEffect(() => {
    setActiveTarget("retail");
    setRetailDigits("");
    setRetailQty(item?.newRetailQty ?? 1);
    setBaseDigits("");
    setBaseQty(item?.newBaseQty ?? 1);
    setBaseOpen(false);
    setFuelSheetOpen(false);
    setSavedFlash(false);
    setFuelBaselineOnOpen(item?.fuelSaver ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  // `liveRetail` is the price before ANY override (this session's or a
  // pre-existing pending one) — the fixed "was" reference. `effectiveRetail`
  // is what the big readout resumes editing from: a pending price if one
  // exists, otherwise the live price. Using `effectiveRetail` for both would
  // make "was $X" read as a no-op the moment an item already carries a
  // pending retail edit (see W7BESS's seeded temp allowance).
  const liveRetail = item ? item.currentRetailPrice ?? item.currentBasePrice : 0;
  // Mirrors the Base pattern below: the readout shows a TOTAL for `retailQty`
  // units — a pending "N for $X" resumes as-is, otherwise the live per-unit
  // price scaled by the chosen qty until a draft is typed.
  const retailExistingTotal = item ? item.newRetailPrice ?? liveRetail * retailQty : 0;
  const retailDraftCents = retailDigits === "" ? null : parseInt(retailDigits, 10);
  const retailDisplayCents = retailDraftCents ?? Math.round(retailExistingTotal * 100);
  const baseRef = item ? (item.newBasePrice != null ? perUnit(item.newBasePrice, item.newBaseQty) : item.currentBasePrice) : 0;

  // Ported from ItemEditDrawer's commitRetail hard-stop validation — the
  // per-unit price must be > 0 and strictly under the base reference. No
  // soft-discount dialog on mobile: warning/block modals stay desktop-only.
  const retailError = useMemo(() => {
    if (retailDraftCents == null) return null;
    const unit = perUnit(retailDraftCents / 100, retailQty);
    if (unit <= 0) return "Must be greater than $0.00.";
    if (unit >= baseRef) return `Must be lower than base (${fmt(baseRef)}${retailQty > 1 ? "/unit" : ""}).`;
    return null;
  }, [retailDraftCents, retailQty, baseRef]);

  const baseExistingTotal = item ? item.newBasePrice ?? item.currentBasePrice * baseQty : 0;
  const baseDraftCents = baseDigits === "" ? null : parseInt(baseDigits, 10);
  const baseDisplayCents = baseDraftCents ?? Math.round(baseExistingTotal * 100);

  // EDLP ceiling is the one guard ported to mobile (a SAP compliance hard
  // stop, not a pricing-fundamentals judgment call) — hard breach blocks
  // inline, soft breach commits with a notice. No ladder/relationship
  // validation on mobile (see the plan's NOT-ported list).
  const baseEdlp = useMemo(() => {
    if (!item || baseDraftCents == null) return null;
    const unit = perUnit(baseDraftCents / 100, baseQty);
    return evaluateEdlpCeilingChange(item.id, unit, itemsById, edlpException);
  }, [item, baseDraftCents, baseQty, itemsById, edlpException]);

  const baseError = useMemo(() => {
    if (baseDraftCents == null) return null;
    const unit = perUnit(baseDraftCents / 100, baseQty);
    if (unit <= 0) return "Must be greater than $0.00.";
    if (baseEdlp && baseEdlp.hard.length > 0) {
      return `Exceeds the +10% ceiling (${fmt(baseEdlp.hard[0].hardCeiling)}) over the SAP maximum.`;
    }
    return null;
  }, [baseDraftCents, baseQty, baseEdlp]);

  const baseNotice =
    baseEdlp && baseEdlp.hard.length === 0 && baseEdlp.soft.length > 0
      ? `Above the SAP maximum (${fmt(baseEdlp.soft[0].maxAllowed)}) — within the +10% allowance.`
      : null;

  const canSave = retailError == null && baseError == null;

  const onDigit = (d: string) => {
    if (activeTarget === "retail") setRetailDigits((s) => (s.length >= MAX_DIGITS ? s : s + d));
    else setBaseDigits((s) => (s.length >= MAX_DIGITS ? s : s + d));
  };
  const onBackspace = () => {
    if (activeTarget === "retail") setRetailDigits((s) => s.slice(0, -1));
    else setBaseDigits((s) => s.slice(0, -1));
  };

  // Commit whatever valid drafts exist, without navigating — shared by
  // Save & next / Review change AND the scan-while-editing autosave path
  // (MobileShell calls this via autoSaveRef right before opening the newly
  // scanned item).
  const commitDrafts = () => {
    if (!item || !canSave) return;
    if (baseDraftCents != null) {
      // Session tracking is Store Walk-only: Item Maintenance edits are sent
      // immediately, so they must never inflate the walk counter or surface
      // as discardable rows in the walk tray.
      if (mode === "walk") touchSection(item.id, "base", fuelBaselineOnOpen);
      const total = baseDraftCents / 100;
      updateBasePrice(item.id, total, baseQty > 1 ? baseQty : undefined);
      if (familyItems.length > 0) toast.success(`Updated the whole family (${familyItems.length + 1} items)`);
    }
    if (retailDraftCents != null) {
      if (mode === "walk") touchSection(item.id, "retail", fuelBaselineOnOpen);
      // Retail commit mirrors desktop: convert to a temporary allowance
      // first (if not already one) so the retail fields exist, then set the
      // price — see pricing-store.ts's updatePriceType/updateRetailPrice.
      if (item.category_type !== "temporary_allowance") updatePriceType(item.id, "temporary_allowance");
      updateRetailPrice(item.id, retailQty, retailDraftCents / 100);
    }
  };

  const handleSaveNext = () => {
    if (!canSave || !item) return;
    const savedSomething =
      baseDraftCents != null || retailDraftCents != null || (item.fuelSaver ?? null) !== fuelBaselineOnOpen;
    commitDrafts();
    if (mode === "walk") {
      if (savedSomething) {
        setSavedFlash(true);
        setTimeout(onSaveNext, 600);
      } else {
        onSaveNext();
      }
    } else {
      onSaveNext(); // -> maint-review recap
    }
  };

  const handleCancel = () => {
    if (item && (item.fuelSaver ?? null) !== fuelBaselineOnOpen) {
      updateFuelSaver(item.id, fuelBaselineOnOpen);
    }
    onCancel();
  };

  useEffect(() => {
    autoSaveRef.current = commitDrafts;
    return () => {
      autoSaveRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commitDrafts]);

  if (!item) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-white px-6 text-center">
        <p className="text-sm text-gray-500">Item not found.</p>
        <Button variant="secondary" onClick={onCancel}>
          Back
        </Button>
      </div>
    );
  }

  if (savedFlash) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-white">
        <span className="flex size-16 items-center justify-center rounded-full bg-emerald-100">
          <Check className="size-8 text-emerald-600" aria-hidden="true" />
        </span>
        <p className="text-lg font-semibold text-gray-900">Saved</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-2 py-1.5">
        {/* Generous target — this X (plus hardware back) is the only cancel
            affordance on the screen. */}
        <button onClick={handleCancel} aria-label="Cancel" className="rounded-full p-2.5 text-gray-500 hover:bg-gray-100 hover:text-gray-600">
          <X className="size-6" aria-hidden="true" />
        </button>
        <span className="text-sm font-semibold text-gray-900">{mode === "walk" ? "Store Walk" : "Item Maintenance"}</span>
        <span className="w-11" aria-hidden="true" />
      </div>

      {/* py-3 + gap-3: tight enough that the full Retail card (the primary
          section, now stepper-tall) clears the keypad fold at 640px. */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex flex-col gap-3">
          {/* Identity zone — glanceable: name, size · UPC, On Hand, current retail. */}
          <div className="flex items-start gap-3">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50">
              <Package className="size-6 text-gray-300" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-gray-900">{item.name}</p>
              <p className="mt-0.5 truncate text-xs text-gray-500">
                {item.size ?? item.packSize} · UPC {item.upc}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  On hand {item.onHand ?? "—"}
                </span>
                {/* The live shelf price — the same reference the Retail
                    section's "was" line uses, so the two prominent prices
                    on screen never disagree (base lives in its disclosure). */}
                <span className="text-lg font-bold tabular-nums text-gray-900">{fmt(liveRetail)}</span>
              </div>
            </div>
          </div>

          {mode === "walk" && <p className="text-xs text-gray-600">Applies after desktop review</p>}

          <RetailSection
            qty={retailQty}
            onQtyChange={setRetailQty}
            wasLabel={`was ${fmt(liveRetail)}`}
            displayCents={retailDisplayCents}
            active={activeTarget === "retail"}
            hasDraft={retailDraftCents != null}
            error={retailError}
            onFocus={() => setActiveTarget("retail")}
          />

          <BaseDisclosure
            open={baseOpen}
            onToggle={() => {
              // Expanding Base IS the intent to edit it — retarget the keypad
              // immediately so digits land there without a second tap (and
              // hand it back to Retail on collapse).
              const next = !baseOpen;
              setBaseOpen(next);
              setActiveTarget(next ? "base" : "retail");
            }}
            currentLabel={`Base price · ${fmt(baseRef)}`}
            active={activeTarget === "base"}
            displayCents={baseDisplayCents}
            qty={baseQty}
            onQtyChange={setBaseQty}
            onFocus={() => setActiveTarget("base")}
            hasDraft={baseDraftCents != null}
            error={baseError}
            notice={baseNotice}
            familyNote={familyItems.length > 0 ? `Family price — updates all ${familyItems.length + 1} items` : null}
          />

          <FuelSaverRow value={item.fuelSaver} onOpen={() => setFuelSheetOpen(true)} />

          <DetailsDisclosure item={item} />
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-100 pb-[env(safe-area-inset-bottom)]">
        <MobileKeypad onDigit={onDigit} onBackspace={onBackspace} />
        {/* One dismiss affordance only — the header X (plus Android hardware
            back), identical in both modes. No footer Cancel: it sat right
            beside the primary button, inviting mis-taps during fast
            one-handed Save & next runs. */}
        <div className="px-4 py-3">
          <Button variant="primary" disabled={!canSave} onClick={handleSaveNext} className="h-14 w-full">
            {mode === "walk" ? "Save & next" : "Review change"}
          </Button>
        </div>
      </div>

      <FuelSaverSheet
        open={fuelSheetOpen}
        value={item.fuelSaver}
        onClose={() => setFuelSheetOpen(false)}
        onSelect={(v) => {
          // Walk: register the fuel edit in the session (with the value the
          // screen opened on as the revert point). Maintenance: record the
          // same baseline in its own slot so the recap can diff fuel without
          // touching the walk session.
          if (mode === "walk") touchSection(item.id, "fuel", fuelBaselineOnOpen);
          else setMaintFuelBaseline(item.id, fuelBaselineOnOpen);
          updateFuelSaver(item.id, v);
        }}
      />
    </div>
  );
}
