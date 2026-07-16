"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { Button } from "@dejesumensaje/converge-ds-experimental";
import { AlertCircle, Calendar, Check, ChevronDown, ChevronRight, Fuel, Link2, X } from "lucide-react";
import { usePricingStore, useEdlpException } from "@/store/pricing-store";
import { useMobileSessionStore } from "@/store/mobile-session";
import { buildItemsById, evaluateEdlpCeilingChange } from "@/lib/edlp-ceiling";
import { evaluateBaseChange, validPriceWindow } from "@/lib/relationship-validation";
import { fmt, fmtDateShort, fmtDateRange } from "@/lib/format";
import { perUnit } from "@/lib/pricing-math";
import { fmtSaveAmt } from "@/lib/hq-rec";
import { isoToday, isoAddDays } from "@/lib/mobile";
import {
  REASON_META,
  HQ_BASE_REASON_OPTIONS,
  HQ_PROMO_REASON_OPTIONS,
  STORE_BASE_REASON_OPTIONS,
  STORE_PROMO_REASON_OPTIONS,
  type PriceChangeReason,
} from "@/lib/price-change-reason";
import { baseRecPending, retailRecPending } from "@/lib/item-status";
import type { StoreBaseReason, StorePromoReason } from "@/types/pricing";
import { PriceRow } from "./PriceRow";
import { HqRecBlock, type HqRecStatus } from "./HqRecBlock";
import { InventoryCard } from "./InventoryCard";
import { SaveOverlay } from "./SaveOverlay";
import { MobileKeypad } from "./MobileKeypad";
import { FuelSaverSheet } from "./FuelSaverSheet";
import { fuelAmountLabel } from "./FuelMove";
import { ItemInfoPills } from "./ItemInfoPanels";
import { ReasonSheet, EffectiveSheet } from "./MetaChips";

type Target = "retail" | "base" | "onhand" | "weekly" | null;
type Section = "base" | "retail" | "fuel";

type Props = {
  itemId: string;
  mode: "walk" | "maint";
  autoSaveRef: RefObject<(() => void) | null>;
  /** Walk: overlay finished → back to the scanner. Maint: → success screen. */
  onDone: () => void;
  onCancel: () => void;
};

// Price buffers go to $9,999.99; the integer fields (on hand / weekly) to 9999.
const MAX_PRICE_DIGITS = 6;
const MAX_INT_DIGITS = 4;

const reasonLabelOf = (r: string) => REASON_META[r as PriceChangeReason]?.label ?? r;

// THE unified item screen — one decision card, no steps (design doc:
// docs/mobile-unified-item-screen.md). Two postures of one surface: calm
// reading (everything glanceable) and focused editing (keypad summoned, one
// field lit). Values, dates, reasons, HQ recs, ladder validation, inventory
// and the line-pricing preview all live here; Save is the single commit.
export function ItemScreen({ itemId, mode, autoSaveRef, onDone, onCancel }: Props) {
  const items = usePricingStore((s) => s.items);
  const overrides = usePricingStore((s) => s.overrides);
  const updateRetailPrice = usePricingStore((s) => s.updateRetailPrice);
  const updateBasePrice = usePricingStore((s) => s.updateBasePrice);
  const updatePriceType = usePricingStore((s) => s.updatePriceType);
  const updateFuelSaver = usePricingStore((s) => s.updateFuelSaver);
  const updateOnHand = usePricingStore((s) => s.updateOnHand);
  const updateWeeklyUnits = usePricingStore((s) => s.updateWeeklyUnits);
  const setSectionReviewed = usePricingStore((s) => s.setSectionReviewed);
  const updateBaseEffectiveDate = usePricingStore((s) => s.updateBaseEffectiveDate);
  const updateAllowanceDates = usePricingStore((s) => s.updateAllowanceDates);
  const updateFuelSaverDates = usePricingStore((s) => s.updateFuelSaverDates);
  const setBaseChangeReason = usePricingStore((s) => s.setBaseChangeReason);
  const setRetailChangeReason = usePricingStore((s) => s.setRetailChangeReason);
  const setFuelChangeReason = usePricingStore((s) => s.setFuelChangeReason);
  const confirmItemOverrides = usePricingStore((s) => s.confirmItemOverrides);
  const edlpException = useEdlpException();
  const touchSection = useMobileSessionStore((s) => s.touchSection);
  const setMaintFuelBaseline = useMobileSessionStore((s) => s.setMaintFuelBaseline);
  const walkEntries = useMobileSessionStore((s) => s.walkEntries);
  const maintFuelBaselines = useMobileSessionStore((s) => s.maintFuelBaselines);

  const item = items.find((i) => i.id === itemId) ?? null;
  const itemsById = useMemo(() => buildItemsById([items]), [items]);
  const familyItems = useMemo(
    () =>
      item?.familyId ? [...itemsById.values()].filter((i) => i.familyId === item.familyId && i.id !== item.id) : [],
    [item, itemsById]
  );

  // MobileShell remounts this screen per item (`key={itemId}`), so plain
  // initializers are the per-item reset — including scan-while-editing.
  const [activeTarget, setActiveTarget] = useState<Target>(null);
  const [retailDigits, setRetailDigits] = useState("");
  const [retailQty, setRetailQty] = useState(item?.newRetailQty ?? 1);
  const [baseDigits, setBaseDigits] = useState("");
  const [baseQty, setBaseQty] = useState(item?.newBaseQty ?? 1);
  const [onHandDigits, setOnHandDigits] = useState("");
  const [weeklyDigits, setWeeklyDigits] = useState("");
  // "Keep current" decisions are STAGED here (recorded on Save) so X/back
  // discards them like any other unsaved work — one cancel semantics.
  const [kept, setKept] = useState<Record<Section, boolean>>({ base: false, retail: false, fuel: false });
  const [fuelSheetOpen, setFuelSheetOpen] = useState(false);
  const [fuelBaselineOnOpen] = useState<number | null>(item?.fuelSaver ?? null);
  const [sheet, setSheet] = useState<{ kind: "date" | "reason"; section: Section } | null>(null);
  const [familyOpen, setFamilyOpen] = useState(false);
  const [overlayLines, setOverlayLines] = useState<string[] | null>(null);
  // Bumped on programmatic value sets (HQ accept, ladder fix) → decision-pop.
  const [pops, setPops] = useState({ retail: 0, base: 0 });

  // ── Retail derivations (ported from the old EditScreen) ────────────────
  const liveRetail = item ? item.currentRetailPrice ?? item.currentBasePrice : 0;
  const hasRetail = item ? item.category_type === "temporary_allowance" || item.newRetailPrice != null : false;
  const retailExistingTotal = item ? item.newRetailPrice ?? (hasRetail ? liveRetail * retailQty : 0) : 0;
  const retailDraftCents = retailDigits === "" ? null : parseInt(retailDigits, 10);
  const retailDisplayCents = retailDraftCents ?? Math.round(retailExistingTotal * 100);
  const baseRef = item ? (item.newBasePrice != null ? perUnit(item.newBasePrice, item.newBaseQty) : item.currentBasePrice) : 0;

  const retailError = useMemo(() => {
    if (retailDraftCents == null) return null;
    const unit = perUnit(retailDraftCents / 100, retailQty);
    if (unit <= 0) return "Must be greater than $0.00.";
    if (unit >= baseRef) return `Must be lower than base (${fmt(baseRef)}${retailQty > 1 ? "/unit" : ""}).`;
    return null;
  }, [retailDraftCents, retailQty, baseRef]);

  // ── Base derivations: EDLP ceiling (kept) + ladder validation (new) ────
  const baseExistingTotal = item ? item.newBasePrice ?? item.currentBasePrice * baseQty : 0;
  const baseDraftCents = baseDigits === "" ? null : parseInt(baseDigits, 10);
  const baseDisplayCents = baseDraftCents ?? Math.round(baseExistingTotal * 100);
  const baseUnitDraft = baseDraftCents != null ? perUnit(baseDraftCents / 100, baseQty) : null;

  const baseEdlp = useMemo(() => {
    if (!item || baseUnitDraft == null) return null;
    return evaluateEdlpCeilingChange(item.id, baseUnitDraft, itemsById, edlpException);
  }, [item, baseUnitDraft, itemsById, edlpException]);

  // Ladder (line-pricing order) validation, evaluated per keystroke — the
  // desktop's pre-commit check brought to mobile as an inline pattern.
  const ladder = useMemo(() => {
    if (!item || baseUnitDraft == null || baseUnitDraft <= 0) return null;
    return evaluateBaseChange(item.id, baseUnitDraft, itemsById);
  }, [item, baseUnitDraft, itemsById]);

  const ladderWindow = useMemo(() => {
    if (!item || !ladder || ladder.hard.length === 0) return null;
    return validPriceWindow(item.id, itemsById);
  }, [item, ladder, itemsById]);

  // The one price (per-unit) that repairs the break — feeds the fix chip.
  const ladderFix = useMemo(() => {
    if (!ladder || ladder.hard.length === 0 || baseUnitDraft == null || !ladderWindow) return null;
    if (ladderWindow.min != null && baseUnitDraft < ladderWindow.min) return ladderWindow.min;
    if (ladderWindow.max != null && baseUnitDraft > ladderWindow.max) return ladderWindow.max;
    return null;
  }, [ladder, ladderWindow, baseUnitDraft]);

  const ladderError = useMemo(() => {
    if (!ladder || ladder.hard.length === 0) return null;
    const rel = ladder.hard[0].relationship;
    if (ladderFix != null && baseUnitDraft != null) {
      return baseUnitDraft < ladderFix
        ? `Breaks the ${rel.name} ladder — needs at least ${fmt(ladderFix)}.`
        : `Breaks the ${rel.name} ladder — must stay under ${fmt(ladderFix)}.`;
    }
    return `Breaks the ${rel.name} ladder — no single price fits every ladder; fix on desktop.`;
  }, [ladder, ladderFix, baseUnitDraft]);

  const baseError = useMemo(() => {
    if (baseDraftCents == null || baseUnitDraft == null) return null;
    if (baseUnitDraft <= 0) return "Must be greater than $0.00.";
    if (baseEdlp && baseEdlp.hard.length > 0) {
      return `Exceeds the +10% ceiling (${fmt(baseEdlp.hard[0].hardCeiling)}) over the SAP maximum.`;
    }
    return ladderError;
  }, [baseDraftCents, baseUnitDraft, baseEdlp, ladderError]);

  const baseNotices = useMemo(() => {
    const notes: string[] = [];
    if (baseEdlp && baseEdlp.hard.length === 0 && baseEdlp.soft.length > 0) {
      notes.push(`Above the SAP maximum (${fmt(baseEdlp.soft[0].maxAllowed)}) — within the +10% allowance.`);
    }
    if (ladder && ladder.hard.length === 0 && ladder.soft.length > 0) {
      const v = ladder.soft[0];
      const comp = itemsById.get(v.comparatorId);
      notes.push(
        `Narrow gap vs ${comp?.name ?? "its ladder neighbor"} (${fmt(v.comparatorPrice)}) — usually ≥${v.minGapPct}%.`
      );
    }
    return notes;
  }, [baseEdlp, ladder, itemsById]);

  // ── Margins — the connective tissue between Retail and Base ────────────
  // One calculation PER price, not a blended number: the promo margin runs
  // the retail price against the vendor-funded allowance cost, the base
  // margin runs base against unit cost (same math as desktop Financials).
  // Each recomputes live as its own price is typed.
  const margins = useMemo(() => {
    if (!item) return null;
    const retailUnit =
      retailDraftCents != null
        ? perUnit(retailDraftCents / 100, retailQty)
        : item.newRetailPrice != null
          ? perUnit(item.newRetailPrice, item.newRetailQty)
          : hasRetail
            ? item.currentRetailPrice ?? null
            : null;
    const baseUnit = baseUnitDraft ?? baseRef;
    const retailCost = item.allowanceCost ?? item.cost;
    return {
      retail: retailUnit != null && retailUnit > 0 ? ((retailUnit - retailCost) / retailUnit) * 100 : null,
      base: baseUnit > 0 ? ((baseUnit - item.cost) / baseUnit) * 100 : null,
    };
  }, [item, retailDraftCents, retailQty, baseUnitDraft, baseRef, hasRetail]);

  // ── HQ recommendations, per section (absent for most items) ────────────
  const recBaseCents = item ? Math.round(item.recommendedBasePrice * 100) : 0;
  const recRetailCents = item?.recommendedRetailPrice != null ? Math.round(item.recommendedRetailPrice * 100) : null;
  const baseRecActive = item != null && baseRecPending(item);
  const retailRecActive = item != null && retailRecPending(item);
  // Fuel keeps its own visibility: the item-status helper turns false the
  // moment a value is set, but the block must survive into its accepted/
  // overridden postures (the proposal is permanent — ADR-0047).
  const fuelRecActive = item != null && !!item.hqReviewPending && (item.recommendedFuelSaver ?? 0) > 0 && !item.fuelReviewed;

  const baseRecStatus: HqRecStatus = kept.base
    ? "kept"
    : baseDraftCents == null
      ? "pending"
      : baseQty === 1 && baseDraftCents === recBaseCents
        ? "accepted"
        : "typing";
  const retailRecStatus: HqRecStatus = kept.retail
    ? "kept"
    : retailDraftCents == null
      ? "pending"
      : retailQty === 1 && retailDraftCents === recRetailCents
        ? "accepted"
        : "typing";
  const fuelVal = item?.fuelSaver ?? null;
  const fuelRecStatus: HqRecStatus = kept.fuel
    ? "kept"
    : fuelVal == null || fuelVal <= 0
      ? "pending"
      : Math.abs(fuelVal - (item?.recommendedFuelSaver ?? 0)) < 0.001
        ? "accepted"
        : "typing";

  // Registers a fuel change in the session (walk) / its own baseline (maint)
  // before committing — shared by the sheet, the rec accept, and undo.
  const commitFuel = (value: number | null) => {
    if (!item) return;
    if (mode === "walk") touchSection(item.id, "fuel", fuelBaselineOnOpen);
    else setMaintFuelBaseline(item.id, fuelBaselineOnOpen);
    updateFuelSaver(item.id, value);
  };

  const acceptBaseRec = () => {
    setBaseQty(1);
    setBaseDigits(String(recBaseCents));
    setKept((k) => ({ ...k, base: false }));
    setPops((p) => ({ ...p, base: p.base + 1 }));
  };
  const acceptRetailRec = () => {
    if (recRetailCents == null) return;
    setRetailQty(1);
    setRetailDigits(String(recRetailCents));
    setKept((k) => ({ ...k, retail: false }));
    setPops((p) => ({ ...p, retail: p.retail + 1 }));
  };

  // ── Which sections carry a change (drafted now, or committed earlier this
  // session — walk scopes to the session's touched sections, like the old
  // review step did, so a pre-seeded pending override never surfaces). ─────
  const entry = walkEntries[itemId];
  const baseOverride = overrides.find((o) => o.id === `${itemId}:base` && o.status === "pending");
  const retailOverride = overrides.find((o) => o.id === `${itemId}:retail` && o.status === "pending");
  const baseChanged = baseDraftCents != null || (!!baseOverride && (mode === "maint" || !!entry?.sections.base));
  const retailChanged = retailDraftCents != null || (!!retailOverride && (mode === "maint" || !!entry?.sections.retail));
  const fuelChangedNow = item ? (item.fuelSaver ?? null) !== fuelBaselineOnOpen : false;
  const fuelChanged =
    fuelChangedNow ||
    (mode === "walk"
      ? !!entry?.sections.fuel && (item?.fuelSaver ?? null) !== (entry.fuelBaseline ?? null)
      : itemId in maintFuelBaselines && (item?.fuelSaver ?? null) !== (maintFuelBaselines[itemId] ?? null));

  // Draft-aware reason resolution (mirrors changeReasonFor, which only works
  // on committed prices): the director's pick wins; an HQ-originated section
  // (rec pending, not declined/kept) inherits HQ's reason — so Accept needs
  // zero extra taps.
  const recOriginated = (s: Section) => {
    if (!item?.hqReviewPending || kept[s]) return false;
    if (s === "base") return !!item.hqBaseReason && !item.baseReviewed;
    if (s === "retail") return !!item.hqRetailReason && !item.retailReviewed;
    return !!item.hqFuelReason && !item.fuelReviewed;
  };
  const reasonFor = (s: Section): string | null => {
    if (!item) return null;
    const chosen = s === "base" ? item.chosenBaseReason : s === "retail" ? item.chosenRetailReason : item.chosenFuelReason;
    if (chosen) return reasonLabelOf(chosen);
    if (recOriginated(s)) {
      const hq = s === "base" ? item.hqBaseReason : s === "retail" ? item.hqRetailReason : item.hqFuelReason;
      return hq ? reasonLabelOf(hq) : null;
    }
    return null;
  };

  const missingReason =
    (baseChanged && !reasonFor("base")) || (retailChanged && !reasonFor("retail")) || (fuelChanged && !reasonFor("fuel"));

  // ── Inventory ───────────────────────────────────────────────────────────
  const onHandDraft = onHandDigits === "" ? null : parseInt(onHandDigits, 10);
  const weeklyDraft = weeklyDigits === "" ? null : parseInt(weeklyDigits, 10);
  const onHandDisplay = onHandDraft ?? item?.onHand ?? 0;
  const weeklyBaseline = item?.weeklyUnits ?? 0;
  const weeklyDisplay = weeklyDraft ?? item?.newWeeklyUnits ?? weeklyBaseline;
  const inventoryChanged =
    (onHandDraft != null && onHandDraft !== (item?.onHand ?? 0)) ||
    (weeklyDraft != null && weeklyDraft !== (item?.newWeeklyUnits ?? weeklyBaseline));

  const canSave = retailError == null && baseError == null;
  const keptAny = kept.base || kept.retail || kept.fuel;
  const hasChanges =
    baseDraftCents != null ||
    retailDraftCents != null ||
    fuelChangedNow ||
    keptAny ||
    inventoryChanged ||
    (mode === "walk" && entry != null);

  // ── Keypad routing — one keypad, four targets ───────────────────────────
  const onDigit = (d: string) => {
    if (activeTarget === "retail") setRetailDigits((s) => (s.length >= MAX_PRICE_DIGITS ? s : s + d));
    else if (activeTarget === "base") setBaseDigits((s) => (s.length >= MAX_PRICE_DIGITS ? s : s + d));
    else if (activeTarget === "onhand") setOnHandDigits((s) => (s.length >= MAX_INT_DIGITS ? s : s + d));
    else if (activeTarget === "weekly") setWeeklyDigits((s) => (s.length >= MAX_INT_DIGITS ? s : s + d));
  };
  const onBackspace = () => {
    if (activeTarget === "retail") setRetailDigits((s) => s.slice(0, -1));
    else if (activeTarget === "base") setBaseDigits((s) => s.slice(0, -1));
    else if (activeTarget === "onhand") setOnHandDigits((s) => s.slice(0, -1));
    else if (activeTarget === "weekly") setWeeklyDigits((s) => s.slice(0, -1));
  };

  // Base and Inventory sit low in the scroll zone; focusing them summons the
  // keypad, which shrinks it — keep the focused editor in view. `baseError`
  // is a dep on purpose: a ladder/EDLP strip appearing mid-typing grows the
  // row downward, and the strip (with its fix chip) must not hide behind the
  // keypad — that's where the correction happens.
  const baseRowRef = useRef<HTMLDivElement>(null);
  const inventoryRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeTarget === "base") baseRowRef.current?.scrollIntoView({ block: "end" });
    else if (activeTarget === "onhand" || activeTarget === "weekly")
      inventoryRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeTarget, baseError]);

  // ── Commit (Save AND the scan-while-editing autosave path) ─────────────
  const commitDrafts = () => {
    if (!item || !canSave) return;
    if (baseDraftCents != null) {
      if (mode === "walk") touchSection(item.id, "base", fuelBaselineOnOpen);
      updateBasePrice(item.id, baseDraftCents / 100, baseQty > 1 ? baseQty : undefined);
    }
    if (retailDraftCents != null) {
      if (mode === "walk") touchSection(item.id, "retail", fuelBaselineOnOpen);
      if (item.category_type !== "temporary_allowance") updatePriceType(item.id, "temporary_allowance");
      updateRetailPrice(item.id, retailQty, retailDraftCents / 100);
    }
    for (const s of ["base", "retail", "fuel"] as const) {
      if (kept[s]) setSectionReviewed(item.id, s, true);
    }
    if (onHandDraft != null) updateOnHand(item.id, onHandDraft);
    if (weeklyDraft != null) updateWeeklyUnits(item.id, weeklyDraft);
  };

  useEffect(() => {
    autoSaveRef.current = commitDrafts;
    return () => {
      autoSaveRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commitDrafts]);

  const handleSave = () => {
    if (!item || !canSave || !hasChanges || missingReason) return;
    commitDrafts();
    if (mode === "maint") {
      confirmItemOverrides(item.id);
      onDone();
      return;
    }
    // The success overlay states each consequence as its own line — what
    // changed, what it dragged along, and where the work went.
    const priceWork = baseDraftCents != null || retailDraftCents != null || fuelChangedNow || entry != null;
    const lines = ["Item updated"];
    if (baseDraftCents != null && familyItems.length > 0) lines.push(`${familyItems.length} related items updated`);
    if (inventoryChanged) lines.push("Inventory updated");
    if (keptAny) lines.push("HQ decision recorded");
    if (priceWork) lines.push("Added to Store Walk");
    setOverlayLines(lines);
  };

  const handleCancel = () => {
    if (item && fuelChangedNow) updateFuelSaver(item.id, fuelBaselineOnOpen);
    onCancel();
  };

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

  // ── Small local pieces ──────────────────────────────────────────────────

  // Date + reason chips for one changed section — the "when & why" attached
  // at the moment of cause. The reason chip is the screen's one amber
  // obligation; dates show their honest defaults.
  const metaChips = (section: Section, dateLabel: string) => {
    const reason = reasonFor(section);
    return (
      <div className="rise-in flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setSheet({ kind: "date", section })}
          className="flex min-h-9 select-none touch-manipulation items-center gap-1 rounded-full bg-gray-100 px-2.5 text-xs font-medium text-gray-700 active:bg-gray-200"
        >
          <Calendar className="size-3.5 text-gray-400" aria-hidden="true" />
          {dateLabel}
        </button>
        <button
          type="button"
          onClick={() => setSheet({ kind: "reason", section })}
          className={`flex min-h-9 select-none touch-manipulation items-center gap-1 rounded-full px-2.5 text-xs font-medium ${
            reason ? "bg-gray-100 text-gray-700 active:bg-gray-200" : "bg-amber-100 text-amber-900 active:bg-amber-200"
          }`}
        >
          {reason ? (
            <Check className="size-3.5 text-emerald-600" aria-hidden="true" />
          ) : (
            <AlertCircle className="size-3.5" aria-hidden="true" />
          )}
          {reason ?? "Reason"}
        </button>
      </div>
    );
  };

  // Honest defaults for the date chips: the store mutators seed the same
  // values on commit, so the chip never promises something the save won't do.
  const defaultWeek = fmtDateRange(isoToday(), isoAddDays(isoToday(), 6))!;
  const baseDateLabel = fmtDateShort(item.baseEffectiveDate) ?? "Today";
  const retailDateLabel = fmtDateRange(item.allowanceStartDate, item.allowanceEndDate) ?? defaultWeek;
  const fuelDateLabel = fmtDateRange(item.fuelSaverStartDate, item.fuelSaverEndDate) ?? defaultWeek;

  const famCount = familyItems.length;
  const saveLabel =
    mode === "maint" ? "Send to SAP" : baseDraftCents != null && famCount > 0 ? `Save · ${famCount + 1} items` : "Save";

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-2 py-1.5">
        <button onClick={handleCancel} aria-label="Cancel" className="rounded-full p-2.5 text-gray-500 hover:bg-gray-100 hover:text-gray-600">
          <X className="size-6" aria-hidden="true" />
        </button>
        <span className="text-sm font-semibold text-gray-900">{mode === "walk" ? "Store Walk" : "Item Maintenance"}</span>
        {/* Balancing spacer — no step indicator: there are no steps. */}
        <span className="w-11" aria-hidden="true" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex flex-col gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-gray-900">{item.name}</p>
            <p className="mt-0.5 truncate text-xs text-gray-500">
              {item.size ?? item.packSize} · UPC {item.upc}
            </p>
          </div>

          {/* ── The pricing card: Retail · Margin · Base · Fuel, one surface.
                 Everything conditional (recs, errors, chips, family strip)
                 attaches under the row that caused it. ── */}
          <section className="divide-y divide-gray-100 rounded-xl border border-gray-300 bg-white">
            <PriceRow
              label="Retail"
              hero
              qty={retailQty}
              onQtyChange={setRetailQty}
              displayCents={retailDisplayCents}
              active={activeTarget === "retail"}
              hasDraft={retailDraftCents != null}
              dimZero
              wasLabel={retailDraftCents != null && hasRetail ? `was ${fmt(liveRetail)}` : null}
              subLabel={hasRetail ? null : `no promo yet · base ${fmt(baseRef)}`}
              error={retailError}
              onFocus={() => setActiveTarget("retail")}
              popToken={pops.retail}
            >
              {retailRecActive && recRetailCents != null && (
                <HqRecBlock
                  status={retailRecStatus}
                  currentLabel={fmt(liveRetail)}
                  recLabel={fmt(recRetailCents / 100)}
                  down={recRetailCents / 100 < liveRetail}
                  saveNote={
                    liveRetail - recRetailCents / 100 > 0.005 ? `save ${fmtSaveAmt(liveRetail - recRetailCents / 100)}` : null
                  }
                  reasonLabel={item.hqRetailReason ? reasonLabelOf(item.hqRetailReason) : null}
                  onAccept={acceptRetailRec}
                  onKeep={() => {
                    setRetailDigits("");
                    setKept((k) => ({ ...k, retail: true }));
                  }}
                  onUndo={() =>
                    retailRecStatus === "kept" ? setKept((k) => ({ ...k, retail: false })) : setRetailDigits("")
                  }
                />
              )}
              {retailChanged && metaChips("retail", retailDateLabel)}
            </PriceRow>

            {/* Margins — one per price (retail vs. allowance cost, base vs.
                unit cost), each recomputing live as its own price is typed. */}
            {margins && margins.base != null && (
              <div className="flex items-baseline gap-3 px-3 py-2">
                <span className="w-14 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-700">Margin</span>
                <span className="flex items-baseline gap-3 text-sm tabular-nums">
                  {margins.retail != null && (
                    <span>
                      <span className="text-gray-500">Retail </span>
                      <span className="font-semibold text-gray-900">{margins.retail.toFixed(1)}%</span>
                    </span>
                  )}
                  <span>
                    <span className="text-gray-500">Base </span>
                    <span className="font-semibold text-gray-900">{margins.base.toFixed(1)}%</span>
                  </span>
                </span>
              </div>
            )}

            <div ref={baseRowRef}>
              <PriceRow
                label="Base"
                qty={baseQty}
                onQtyChange={setBaseQty}
                displayCents={baseDisplayCents}
                active={activeTarget === "base"}
                hasDraft={baseDraftCents != null}
                wasLabel={baseDraftCents != null ? `was ${fmt(item.currentBasePrice)}` : null}
                multiUnitOptIn
                error={baseError}
                onFocus={() => setActiveTarget("base")}
                popToken={pops.base}
              >
                {/* Ladder quick fix — correction at the point of error, keypad
                    still up. The chip states the exact price it will set. */}
                {ladderFix != null && (
                  <button
                    type="button"
                    onClick={() => {
                      setBaseDigits(String(Math.round(ladderFix * baseQty * 100)));
                      setPops((p) => ({ ...p, base: p.base + 1 }));
                    }}
                    className="min-h-9 select-none touch-manipulation self-start rounded-full bg-gray-900 px-3 text-xs font-semibold text-white active:opacity-80"
                  >
                    Use {fmt(ladderFix * baseQty)}
                    {baseQty > 1 ? ` (${baseQty} for)` : ""}
                  </button>
                )}
                {baseNotices.map((n) => (
                  <span key={n} className="text-xs font-medium text-amber-700">
                    {n}
                  </span>
                ))}
                {baseRecActive && (
                  <HqRecBlock
                    status={baseRecStatus}
                    currentLabel={fmt(item.currentBasePrice)}
                    recLabel={fmt(item.recommendedBasePrice)}
                    down={item.recommendedBasePrice < item.currentBasePrice}
                    saveNote={
                      item.currentBasePrice - item.recommendedBasePrice > 0.005
                        ? `save ${fmtSaveAmt(item.currentBasePrice - item.recommendedBasePrice)}`
                        : null
                    }
                    reasonLabel={item.hqBaseReason ? reasonLabelOf(item.hqBaseReason) : null}
                    onAccept={acceptBaseRec}
                    onKeep={() => {
                      setBaseDigits("");
                      setKept((k) => ({ ...k, base: true }));
                    }}
                    onUndo={() => (baseRecStatus === "kept" ? setKept((k) => ({ ...k, base: false })) : setBaseDigits(""))}
                  />
                )}
                {/* Line pricing: the consequence preview, attached to its
                    cause. One line collapsed; the names one tap away. */}
                {baseDraftCents != null && famCount > 0 && (
                  <div className="rise-in flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => setFamilyOpen((o) => !o)}
                      className="flex min-h-9 select-none touch-manipulation items-center gap-1.5 self-start text-xs font-medium text-gray-600 active:opacity-70"
                    >
                      <Link2 className="size-3.5 text-gray-400" aria-hidden="true" />
                      Also updates {famCount} related item{famCount === 1 ? "" : "s"}
                      <ChevronDown
                        className={`size-3.5 text-gray-400 transition-transform ${familyOpen ? "rotate-180" : ""}`}
                        aria-hidden="true"
                      />
                    </button>
                    {familyOpen && (
                      <ul className="flex flex-col gap-1 pl-5">
                        {familyItems.map((f) => (
                          <li key={f.id} className="flex items-baseline justify-between gap-2 text-xs text-gray-600">
                            <span className="min-w-0 truncate">{f.name}</span>
                            <span className="shrink-0 font-semibold tabular-nums text-gray-900">
                              {fmt(perUnit(baseDraftCents / 100, baseQty))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {baseChanged && metaChips("base", baseDateLabel)}
              </PriceRow>
            </div>

            {/* Fuel Saver — same row grammar; the sheet does the picking. */}
            <div className="flex flex-col gap-2 px-3 py-2.5">
              <button
                type="button"
                onClick={() => {
                  setActiveTarget(null);
                  setFuelSheetOpen(true);
                }}
                className="flex min-h-9 w-full select-none touch-manipulation items-center gap-3 text-left"
              >
                {/* The program's name is "Fuel Saver" — never shorten it. */}
                <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-gray-700">
                  <Fuel className="size-3.5 text-gray-400" aria-hidden="true" />
                  Fuel Saver
                </span>
                <span className="flex flex-1 items-center justify-end gap-1 text-sm font-semibold tabular-nums text-gray-900">
                  {fuelAmountLabel(item.fuelSaver)}
                  <ChevronRight className="size-4 text-gray-400" aria-hidden="true" />
                </span>
              </button>
              {fuelRecActive && (
                <HqRecBlock
                  status={fuelRecStatus}
                  currentLabel={fuelAmountLabel(fuelBaselineOnOpen)}
                  recLabel={fmt(item.recommendedFuelSaver!)}
                  down={false}
                  reasonLabel={item.hqFuelReason ? reasonLabelOf(item.hqFuelReason) : null}
                  onAccept={() => {
                    setKept((k) => ({ ...k, fuel: false }));
                    commitFuel(item.recommendedFuelSaver!);
                  }}
                  onKeep={() => {
                    if (fuelChangedNow) commitFuel(fuelBaselineOnOpen);
                    setKept((k) => ({ ...k, fuel: true }));
                  }}
                  onUndo={() => {
                    if (fuelRecStatus === "kept") setKept((k) => ({ ...k, fuel: false }));
                    else commitFuel(fuelBaselineOnOpen);
                  }}
                />
              )}
              {fuelChanged && metaChips("fuel", fuelDateLabel)}
            </div>
          </section>

          <div ref={inventoryRef}>
            <InventoryCard
              onHand={onHandDisplay}
              onHandActive={activeTarget === "onhand"}
              onHandHasDraft={onHandDraft != null}
              onFocusOnHand={() => setActiveTarget("onhand")}
              weekly={weeklyDisplay}
              weeklyDelta={weeklyDisplay - weeklyBaseline}
              weeklyActive={activeTarget === "weekly"}
              weeklyHasDraft={weeklyDraft != null}
              onFocusWeekly={() => setActiveTarget("weekly")}
            />
          </div>

          <ItemInfoPills item={item} liveRetail={liveRetail} familyItems={familyItems} />
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-100 pb-[env(safe-area-inset-bottom)]">
        {activeTarget != null && (
          <div className="keypad-in">
            <MobileKeypad onDigit={onDigit} onBackspace={onBackspace} onHide={() => setActiveTarget(null)} />
          </div>
        )}
        <div className="px-4 py-3">
          {hasChanges && missingReason && (
            <p className="pb-2 text-center text-xs font-medium text-amber-700">
              {mode === "walk" ? "Add a change reason to save" : "Add a change reason to send"}
            </p>
          )}
          <Button variant="primary" disabled={!canSave || !hasChanges || !!missingReason} onClick={handleSave} className="h-14 w-full">
            {saveLabel}
          </Button>
        </div>
      </div>

      <FuelSaverSheet
        open={fuelSheetOpen}
        value={item.fuelSaver}
        onClose={() => setFuelSheetOpen(false)}
        onSelect={(v) => {
          setKept((k) => ({ ...k, fuel: false }));
          commitFuel(v);
        }}
      />

      <ReasonSheet
        open={sheet?.kind === "reason"}
        title={
          sheet?.section === "base" ? "Base change reason" : sheet?.section === "fuel" ? "Fuel Saver reason" : "Retail change reason"
        }
        options={
          sheet?.section === "base"
            ? recOriginated("base")
              ? HQ_BASE_REASON_OPTIONS
              : STORE_BASE_REASON_OPTIONS
            : recOriginated(sheet?.section ?? "retail")
              ? HQ_PROMO_REASON_OPTIONS
              : STORE_PROMO_REASON_OPTIONS
        }
        value={
          sheet?.section === "base"
            ? item.chosenBaseReason
            : sheet?.section === "fuel"
              ? item.chosenFuelReason
              : item.chosenRetailReason
        }
        onSelect={(v) => {
          if (sheet?.section === "base") setBaseChangeReason(itemId, v as StoreBaseReason);
          else if (sheet?.section === "fuel") setFuelChangeReason(itemId, v as StorePromoReason);
          else if (sheet?.section === "retail") setRetailChangeReason(itemId, v as StorePromoReason);
        }}
        onClose={() => setSheet(null)}
      />

      <EffectiveSheet
        open={sheet?.kind === "date"}
        title={sheet?.section === "base" ? "Base effective date" : sheet?.section === "fuel" ? "Fuel Saver run" : "Promo window"}
        mode={sheet?.section === "base" ? "single" : "range"}
        start={
          sheet?.section === "base"
            ? item.baseEffectiveDate ?? isoToday()
            : sheet?.section === "fuel"
              ? item.fuelSaverStartDate ?? isoToday()
              : item.allowanceStartDate ?? isoToday()
        }
        end={
          sheet?.section === "fuel"
            ? item.fuelSaverEndDate ?? isoAddDays(isoToday(), 6)
            : item.allowanceEndDate ?? isoAddDays(isoToday(), 6)
        }
        onApply={(s, e) => {
          if (sheet?.section === "base") updateBaseEffectiveDate(itemId, s);
          else if (sheet?.section === "fuel") updateFuelSaverDates(itemId, s, e);
          else if (sheet?.section === "retail") updateAllowanceDates(itemId, s, e);
        }}
        onClose={() => setSheet(null)}
      />

      {overlayLines && <SaveOverlay lines={overlayLines} onDone={onDone} />}
    </div>
  );
}
