"use client";

import { useEffect, useMemo, useState } from "react";
import type { RefObject } from "react";
import { Button, useToast } from "@dejesumensaje/converge-ds-experimental";
import { X } from "lucide-react";
import { usePricingStore, useEdlpException } from "@/store/pricing-store";
import { useMobileSessionStore } from "@/store/mobile-session";
import { buildItemsById, evaluateEdlpCeilingChange } from "@/lib/edlp-ceiling";
import { fmt } from "@/lib/format";
import { perUnit } from "@/lib/pricing-math";
import { RetailSection } from "./RetailSection";
import { FuelSaverRow } from "./FuelSaverRow";
import { FuelSaverSheet } from "./FuelSaverSheet";
import { BaseDisclosure } from "./BaseDisclosure";
import { ItemInfoPills } from "./ItemInfoPanels";
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

// STEP 1 of 2 — "how much". This screen edits only the values: retail,
// fuel saver, base. Dates and change reasons (the "when & why") live on the
// review step (ChangeReviewScreen) that follows. Opens directly in edit
// mode — no Edit button/pencil tax like the desktop drawer.
export function EditScreen({ itemId, mode, autoSaveRef, onSaveNext, onCancel }: Props) {
  const items = usePricingStore((s) => s.items);
  const updateRetailPrice = usePricingStore((s) => s.updateRetailPrice);
  const updateBasePrice = usePricingStore((s) => s.updateBasePrice);
  const updatePriceType = usePricingStore((s) => s.updatePriceType);
  const updateFuelSaver = usePricingStore((s) => s.updateFuelSaver);
  const edlpException = useEdlpException();
  const touchSection = useMobileSessionStore((s) => s.touchSection);
  const setMaintFuelBaseline = useMobileSessionStore((s) => s.setMaintFuelBaseline);
  const walkEntries = useMobileSessionStore((s) => s.walkEntries);
  const toast = useToast();

  const item = items.find((i) => i.id === itemId) ?? null;
  const itemsById = useMemo(() => buildItemsById([items]), [items]);
  const familyItems = item?.familyId
    ? [...itemsById.values()].filter((i) => i.familyId === item.familyId && i.id !== item.id)
    : [];

  // null = no field focused, keypad hidden. The screen opens with the whole
  // item glanceable; tapping a price box summons the keypad (à la the OS
  // keyboard appearing on input focus).
  const [activeTarget, setActiveTarget] = useState<"retail" | "base" | null>(null);
  const [retailDigits, setRetailDigits] = useState("");
  const [retailQty, setRetailQty] = useState(1);
  const [baseDigits, setBaseDigits] = useState("");
  const [baseQty, setBaseQty] = useState(1);
  const [baseOpen, setBaseOpen] = useState(false);
  const [fuelSheetOpen, setFuelSheetOpen] = useState(false);
  const [fuelBaselineOnOpen, setFuelBaselineOnOpen] = useState<number | null>(null);

  // Reset edit state whenever a new item opens — including scan-while-
  // editing, which mounts a fresh EditScreen via MobileShell's `key={itemId}`.
  useEffect(() => {
    setActiveTarget(null);
    setRetailDigits("");
    setRetailQty(item?.newRetailQty ?? 1);
    setBaseDigits("");
    setBaseQty(item?.newBaseQty ?? 1);
    setBaseOpen(false);
    setFuelSheetOpen(false);
    setFuelBaselineOnOpen(item?.fuelSaver ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  // `liveRetail` is the price before ANY override (this session's or a
  // pre-existing pending one) — the fixed "was" reference.
  const liveRetail = item ? item.currentRetailPrice ?? item.currentBasePrice : 0;
  // Whether a promo actually EXISTS (live TA or pending retail edit). The
  // enrichment layer mirrors currentRetailPrice from base on every item, so
  // the honest signal is the category type — same rule the desktop table
  // uses for its retail row. Without a promo, the readout starts at $0.00:
  // creating the first promo is a blank slate, not an edit of the base
  // price masquerading as one.
  const hasRetail = item ? item.category_type === "temporary_allowance" || item.newRetailPrice != null : false;
  // Mirrors the Base pattern below: the readout shows a TOTAL for `retailQty`
  // units — a pending "N for $X" resumes as-is, otherwise the live per-unit
  // price scaled by the chosen qty until a draft is typed.
  const retailExistingTotal = item ? item.newRetailPrice ?? (hasRetail ? liveRetail * retailQty : 0) : 0;
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
    else if (activeTarget === "base") setBaseDigits((s) => (s.length >= MAX_DIGITS ? s : s + d));
  };
  const onBackspace = () => {
    if (activeTarget === "retail") setRetailDigits((s) => s.slice(0, -1));
    else if (activeTarget === "base") setBaseDigits((s) => s.slice(0, -1));
  };

  // Commit whatever valid drafts exist, without navigating — shared by
  // Next AND the scan-while-editing autosave path (MobileShell calls this
  // via autoSaveRef right before opening the newly scanned item). Values
  // only: the store mutators default the dates; the review step edits them.
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

  const fuelChangedNow = item ? (item.fuelSaver ?? null) !== fuelBaselineOnOpen : false;
  // "Next" needs something to review: a value changed on this screen, or —
  // walk only — the item already carries session work (re-opening from the
  // tray to fix its dates/reason must still reach the review step).
  const hasChanges =
    baseDraftCents != null || retailDraftCents != null || fuelChangedNow || (mode === "walk" && walkEntries[itemId] != null);

  const handleNext = () => {
    if (!canSave || !item) return;
    commitDrafts();
    onSaveNext(); // → review step ("when & why")
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

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-2 py-1.5">
        {/* Generous target — this X (plus hardware back) is the only cancel
            affordance on the screen. */}
        <button onClick={handleCancel} aria-label="Cancel" className="rounded-full p-2.5 text-gray-500 hover:bg-gray-100 hover:text-gray-600">
          <X className="size-6" aria-hidden="true" />
        </button>
        <span className="text-sm font-semibold text-gray-900">{mode === "walk" ? "Store Walk" : "Item Maintenance"}</span>
        {/* Step indicator — the two-step split must read without color. */}
        <span className="w-11 pr-1 text-right text-xs font-medium tabular-nums text-gray-400">1 / 2</span>
      </div>

      {/* py-3 + gap-3: tight enough that the full Retail card (the primary
          section, stepper-tall) clears the keypad fold at 640px. Grouping
          via proximity: the three price levers cluster at gap-2 (one
          perceptual unit — the editing surface), while identity above and
          the reference pills below sit a full gap-3 apart. */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex flex-col gap-3">
          {/* Identity zone — two lines, no chrome: name, then size · UPC ·
              OH on one meta line. Prices live in the section cards below. */}
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-gray-900">{item.name}</p>
            <p className="mt-0.5 truncate text-xs text-gray-500">
              {item.size ?? item.packSize} · UPC {item.upc} · <span className="font-medium text-gray-700">OH: {item.onHand ?? "—"}</span>
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <RetailSection
              qty={retailQty}
              onQtyChange={setRetailQty}
              subLabel={hasRetail ? null : `no promo yet · base ${fmt(baseRef)}`}
              displayCents={retailDisplayCents}
              active={activeTarget === "retail"}
              hasDraft={retailDraftCents != null}
              error={retailError}
              onFocus={() => setActiveTarget("retail")}
            />

            <FuelSaverRow
              value={item.fuelSaver}
              onOpen={() => {
                // Moving on to fuel ends the typing intent — drop the keypad
                // so the sheet isn't stacked on top of it.
                setActiveTarget(null);
                setFuelSheetOpen(true);
              }}
            />

            <BaseDisclosure
              open={baseOpen}
              onToggle={() => {
                // Expanding Base IS the intent to edit it — summon the keypad
                // targeted at base without a second tap. One-way: once open it
                // stays open for this item (the next scan resets it).
                setBaseOpen(true);
                setActiveTarget("base");
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
          </div>

          <ItemInfoPills item={item} liveRetail={liveRetail} familyItems={familyItems} />
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-100 pb-[env(safe-area-inset-bottom)]">
        {/* The keypad appears only while a price box is focused (tap to
            summon, like the OS keyboard) — the rest of the time the whole
            item is glanceable. Next stays pinned in the thumb zone either
            way. */}
        {activeTarget != null && (
          <div className="keypad-in">
            <MobileKeypad onDigit={onDigit} onBackspace={onBackspace} onHide={() => setActiveTarget(null)} />
          </div>
        )}
        <div className="px-4 py-3">
          {/* Disabled until something actually changed — a red call-to-action
              with nothing behind it reads as a lie. Skipping an item has its
              own paths: scan the next one, the header X, or hardware back. */}
          <Button variant="primary" disabled={!canSave || !hasChanges} onClick={handleNext} className="h-14 w-full">
            Next
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
          // same baseline in its own slot so the review step can diff fuel
          // without touching the walk session.
          if (mode === "walk") touchSection(item.id, "fuel", fuelBaselineOnOpen);
          else setMaintFuelBaseline(item.id, fuelBaselineOnOpen);
          updateFuelSaver(item.id, v);
        }}
      />
    </div>
  );
}
