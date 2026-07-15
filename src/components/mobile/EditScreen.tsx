"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { Button, useToast } from "@dejesumensaje/converge-ds-experimental";
import { Check, X } from "lucide-react";
import { usePricingStore, useEdlpException } from "@/store/pricing-store";
import { useMobileSessionStore } from "@/store/mobile-session";
import { buildItemsById, evaluateEdlpCeilingChange } from "@/lib/edlp-ceiling";
import { fmt, fmtDateShort, fmtDateRange } from "@/lib/format";
import { perUnit } from "@/lib/pricing-math";
import { isoToday, isoAddDays } from "@/lib/mobile";
import {
  REASON_META,
  STORE_BASE_REASON_OPTIONS,
  STORE_PROMO_REASON_OPTIONS,
  type PriceChangeReason,
} from "@/lib/price-change-reason";
import type { StoreBaseReason, StorePromoReason } from "@/types/pricing";
import { RetailSection } from "./RetailSection";
import { FuelSaverRow } from "./FuelSaverRow";
import { FuelSaverSheet } from "./FuelSaverSheet";
import { BaseDisclosure } from "./BaseDisclosure";
import { ItemInfoPills } from "./ItemInfoPanels";
import { MobileKeypad } from "./MobileKeypad";
import { MetaChip, DateIcon, ReasonIcon, ReasonSheet, EffectiveSheet } from "./MetaChips";

const reasonLabel = (r: string) => REASON_META[r as PriceChangeReason]?.label ?? r;

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
  const updateBaseEffectiveDate = usePricingStore((s) => s.updateBaseEffectiveDate);
  const updateAllowanceDates = usePricingStore((s) => s.updateAllowanceDates);
  const updateFuelSaverDates = usePricingStore((s) => s.updateFuelSaverDates);
  const commitBaseReason = usePricingStore((s) => s.setBaseChangeReason);
  const commitRetailReason = usePricingStore((s) => s.setRetailChangeReason);
  const commitFuelReason = usePricingStore((s) => s.setFuelChangeReason);
  const edlpException = useEdlpException();
  const touchSection = useMobileSessionStore((s) => s.touchSection);
  const setMaintFuelBaseline = useMobileSessionStore((s) => s.setMaintFuelBaseline);
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
  const [savedFlash, setSavedFlash] = useState(false);
  const [fuelBaselineOnOpen, setFuelBaselineOnOpen] = useState<number | null>(null);

  // Dates & reasons ride as local drafts beside the price drafts — the meta
  // chips edit these, and commitDrafts writes them through the same store
  // mutators desktop uses. Prefilled with the item's values or the store
  // defaults (today / one-week window) so a walk never blocks on them.
  const [baseDate, setBaseDate] = useState<string>(isoToday);
  const [retailStart, setRetailStart] = useState<string>(isoToday);
  const [retailEnd, setRetailEnd] = useState<string | null>(null);
  const [fuelStart, setFuelStart] = useState<string>(isoToday);
  const [fuelEnd, setFuelEnd] = useState<string | null>(null);
  const [baseReason, setBaseReason] = useState<string | undefined>(undefined);
  const [retailReason, setRetailReason] = useState<string | undefined>(undefined);
  const [fuelReason, setFuelReason] = useState<string | undefined>(undefined);
  const [metaSheet, setMetaSheet] = useState<{ kind: "date" | "reason"; section: "base" | "retail" | "fuel" } | null>(
    null
  );
  // Snapshot of the chips' values as prefilled on open — "did the director
  // change any paperwork?" is measured against this (see hasChanges).
  const metaBaselineRef = useRef({
    baseDate: "",
    retailStart: "",
    retailEnd: null as string | null,
    fuelStart: "",
    fuelEnd: null as string | null,
    baseReason: undefined as string | undefined,
    retailReason: undefined as string | undefined,
    fuelReason: undefined as string | undefined,
  });

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
    setSavedFlash(false);
    setFuelBaselineOnOpen(item?.fuelSaver ?? null);
    const today = isoToday();
    const meta = {
      baseDate: item?.baseEffectiveDate ?? today,
      retailStart: item?.allowanceStartDate ?? today,
      retailEnd: item?.allowanceEndDate ?? isoAddDays(today, 6),
      fuelStart: item?.fuelSaverStartDate ?? today,
      fuelEnd: item?.fuelSaverEndDate ?? isoAddDays(today, 6),
      baseReason: item?.chosenBaseReason as string | undefined,
      retailReason: item?.chosenRetailReason as string | undefined,
      fuelReason: item?.chosenFuelReason as string | undefined,
    };
    metaBaselineRef.current = meta;
    setBaseDate(meta.baseDate);
    setRetailStart(meta.retailStart);
    setRetailEnd(meta.retailEnd);
    setFuelStart(meta.fuelStart);
    setFuelEnd(meta.fuelEnd);
    setBaseReason(meta.baseReason);
    setRetailReason(meta.retailReason);
    setFuelReason(meta.fuelReason);
    setMetaSheet(null);
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
    else if (activeTarget === "base") setBaseDigits((s) => (s.length >= MAX_DIGITS ? s : s + d));
  };
  const onBackspace = () => {
    if (activeTarget === "retail") setRetailDigits((s) => s.slice(0, -1));
    else if (activeTarget === "base") setBaseDigits((s) => s.slice(0, -1));
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
    // Dates & reasons: written for every section that carries a change
    // (typed just now or already pending), overriding the mutators' defaults
    // with whatever the chips hold.
    if (baseDraftCents != null || item.newBasePrice != null) {
      updateBaseEffectiveDate(item.id, baseDate);
      if (baseReason) commitBaseReason(item.id, baseReason as StoreBaseReason);
    }
    if (retailDraftCents != null || item.newRetailPrice != null) {
      updateAllowanceDates(item.id, retailStart, retailEnd);
      if (retailReason) commitRetailReason(item.id, retailReason as StorePromoReason);
    }
    if (fuelChangedNow || (item.fuelSaver ?? 0) > 0) {
      updateFuelSaverDates(item.id, fuelStart, fuelEnd);
      if (fuelReason) commitFuelReason(item.id, fuelReason as StorePromoReason);
    }
  };

  const fuelChangedNow = item ? (item.fuelSaver ?? null) !== fuelBaselineOnOpen : false;
  // Sections that carry a change (typed this screen or already pending) —
  // these are the ones whose meta chips (dates + reason) are shown. Base's
  // chips render unconditionally inside its expanded editor instead.
  const retailChanged = retailDraftCents != null || item?.newRetailPrice != null;

  // Anything to save from this screen: a typed price draft, a fuel change,
  // or edited paperwork (dates/reason) on a section that carries a change —
  // re-opening an item from the tray just to fix its reason must count.
  const mb = metaBaselineRef.current;
  const metaChanged =
    (retailChanged && (retailStart !== mb.retailStart || retailEnd !== mb.retailEnd || retailReason !== mb.retailReason)) ||
    ((baseDraftCents != null || item?.newBasePrice != null) && (baseDate !== mb.baseDate || baseReason !== mb.baseReason)) ||
    ((fuelChangedNow || (item?.fuelSaver ?? 0) > 0) &&
      (fuelStart !== mb.fuelStart || fuelEnd !== mb.fuelEnd || fuelReason !== mb.fuelReason));
  const hasChanges = baseDraftCents != null || retailDraftCents != null || fuelChangedNow || metaChanged;

  const handleSaveNext = () => {
    if (!canSave || !item) return;
    commitDrafts();
    if (mode === "walk") {
      if (hasChanges) {
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
          section, now stepper-tall) clears the keypad fold at 640px.
          Grouping via proximity: the three price levers cluster at gap-2 (one
          perceptual unit — the editing surface), while identity above and the
          reference pills below sit a full gap-3 apart. */}
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
            wasLabel={`was ${fmt(liveRetail)}`}
            displayCents={retailDisplayCents}
            active={activeTarget === "retail"}
            hasDraft={retailDraftCents != null}
            error={retailError}
            onFocus={() => setActiveTarget("retail")}
            meta={
              retailChanged ? (
                <>
                  <MetaChip
                    icon={DateIcon}
                    label={fmtDateRange(retailStart, retailEnd) ?? "Dates"}
                    ariaLabel="Retail promo window"
                    onClick={() => setMetaSheet({ kind: "date", section: "retail" })}
                  />
                  <MetaChip
                    icon={ReasonIcon}
                    empty={!retailReason}
                    label={retailReason ? reasonLabel(retailReason) : "+ Reason"}
                    ariaLabel="Retail change reason"
                    onClick={() => setMetaSheet({ kind: "reason", section: "retail" })}
                  />
                </>
              ) : undefined
            }
          />

          <FuelSaverRow
            value={item.fuelSaver}
            onOpen={() => {
              // Moving on to fuel ends the typing intent — drop the keypad so
              // the sheet isn't stacked on top of it.
              setActiveTarget(null);
              setFuelSheetOpen(true);
            }}
            meta={
              /* Only for a fuel change made on THIS screen — an untouched
                 live fuel saver must not advertise missing paperwork. */
              fuelChangedNow ? (
                <>
                  <MetaChip
                    icon={DateIcon}
                    label={fmtDateRange(fuelStart, fuelEnd) ?? "Dates"}
                    ariaLabel="Fuel Saver run window"
                    onClick={() => setMetaSheet({ kind: "date", section: "fuel" })}
                  />
                  <MetaChip
                    icon={ReasonIcon}
                    empty={!fuelReason}
                    label={fuelReason ? reasonLabel(fuelReason) : "+ Reason"}
                    ariaLabel="Fuel Saver change reason"
                    onClick={() => setMetaSheet({ kind: "reason", section: "fuel" })}
                  />
                </>
              ) : undefined
            }
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
            meta={
              /* Always present while the editor is open — expanding Base IS
                 the edit intent, so its paperwork is visible from the start. */
              <>
                <MetaChip
                  icon={DateIcon}
                  label={`Effective ${fmtDateShort(baseDate) ?? "today"}`}
                  ariaLabel="Base effective date"
                  onClick={() => setMetaSheet({ kind: "date", section: "base" })}
                />
                <MetaChip
                  icon={ReasonIcon}
                  empty={!baseReason}
                  label={baseReason ? reasonLabel(baseReason) : "+ Reason"}
                  ariaLabel="Base change reason"
                  onClick={() => setMetaSheet({ kind: "reason", section: "base" })}
                />
              </>
            }
          />
          </div>

          <ItemInfoPills item={item} liveRetail={liveRetail} familyItems={familyItems} />
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-100 pb-[env(safe-area-inset-bottom)]">
        {/* The keypad appears only while a price box is focused (tap to
            summon, like the OS keyboard) — the rest of the time the whole
            item is glanceable. Save stays pinned in the thumb zone either
            way. */}
        {activeTarget != null && (
          <div className="keypad-in">
            <MobileKeypad onDigit={onDigit} onBackspace={onBackspace} onHide={() => setActiveTarget(null)} />
          </div>
        )}
        {/* One dismiss affordance only — the header X (plus Android hardware
            back), identical in both modes. No footer Cancel: it sat right
            beside the primary button, inviting mis-taps during fast
            one-handed Save & next runs. */}
        <div className="px-4 py-3">
          {/* Disabled until something actually changed (price, fuel, or
              paperwork) — a red call-to-action with nothing behind it reads
              as a lie, in either mode. Skipping an item has its own paths:
              scan the next one, the header X, or hardware back. */}
          <Button
            variant="primary"
            disabled={!canSave || !hasChanges}
            onClick={handleSaveNext}
            className="h-14 w-full"
          >
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

      <ReasonSheet
        open={metaSheet?.kind === "reason"}
        title={
          metaSheet?.section === "base"
            ? "Base change reason"
            : metaSheet?.section === "fuel"
              ? "Fuel Saver reason"
              : "Retail change reason"
        }
        options={metaSheet?.section === "base" ? STORE_BASE_REASON_OPTIONS : STORE_PROMO_REASON_OPTIONS}
        value={metaSheet?.section === "base" ? baseReason : metaSheet?.section === "fuel" ? fuelReason : retailReason}
        onSelect={(v) => {
          if (metaSheet?.section === "base") setBaseReason(v);
          else if (metaSheet?.section === "fuel") setFuelReason(v);
          else setRetailReason(v);
        }}
        onClose={() => setMetaSheet(null)}
      />

      <EffectiveSheet
        open={metaSheet?.kind === "date"}
        title={
          metaSheet?.section === "base"
            ? "Base effective date"
            : metaSheet?.section === "fuel"
              ? "Fuel Saver run"
              : "Promo window"
        }
        mode={metaSheet?.section === "base" ? "single" : "range"}
        start={metaSheet?.section === "base" ? baseDate : metaSheet?.section === "fuel" ? fuelStart : retailStart}
        end={metaSheet?.section === "fuel" ? fuelEnd : retailEnd}
        onApply={(s, e) => {
          if (metaSheet?.section === "base") {
            setBaseDate(s);
          } else if (metaSheet?.section === "fuel") {
            setFuelStart(s);
            setFuelEnd(e);
          } else {
            setRetailStart(s);
            setRetailEnd(e);
          }
        }}
        onClose={() => setMetaSheet(null)}
      />
    </div>
  );
}
