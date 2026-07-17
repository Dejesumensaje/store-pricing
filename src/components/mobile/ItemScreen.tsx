"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { Button } from "@dejesumensaje/converge-ds-experimental";
import { Calendar, ChevronDown, ChevronRight, Fuel, Link2, Loader2, RotateCcw, Tag, X } from "lucide-react";
import { usePricingStore, useEdlpException } from "@/store/pricing-store";
import { useMobileSessionStore } from "@/store/mobile-session";
import { buildItemsById, evaluateEdlpCeilingChange } from "@/lib/edlp-ceiling";
import { evaluateBaseChange, validPriceWindow } from "@/lib/relationship-validation";
import { fmt, fmtDateShort, fmtDateRange } from "@/lib/format";
import { perUnit } from "@/lib/pricing-math";
import { fmtSaveAmt } from "@/lib/hq-rec";
import { isoToday, isoAddDays, daysUntil } from "@/lib/mobile";
import {
  REASON_META,
  HQ_BASE_REASON_OPTIONS,
  HQ_PROMO_REASON_OPTIONS,
  STORE_BASE_REASON_OPTIONS,
  STORE_PROMO_REASON_OPTIONS,
  type PriceChangeReason,
} from "@/lib/price-change-reason";
import { baseRecPending, retailRecPending } from "@/lib/item-status";
import type { StoreBaseReason, StorePromoReason, HqBaseReason, HqPromoReason } from "@/types/pricing";
import { PriceRow } from "./PriceRow";
import { HqRecBlock, type HqRecStatus } from "./HqRecBlock";
import { InventoryCard } from "./InventoryCard";
import { SaveOverlay } from "./SaveOverlay";
import { BottomSheet } from "./BottomSheet";
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
  const [overlay, setOverlay] = useState<{ lines: string[]; flyItems?: string[] } | null>(null);
  // Bumped on programmatic value sets (HQ accept, ladder fix) → decision-pop.
  const [pops, setPops] = useState({ retail: 0, base: 0 });
  // "Add deal" on a promo-less item: seeds the retail row with the base price
  // as a dimmed PLACEHOLDER (no draft, nothing commits) and summons the keypad.
  const [dealSeeded, setDealSeeded] = useState(false);
  // Blocked-CTA redirect: which section is being pulsed at, if any.
  const [pulseSection, setPulseSection] = useState<Section | null>(null);
  const [saving, setSaving] = useState(false);
  // ── Draft buffers for the edits that used to hit the store on touch ──────
  // Reversible-draft-editing (docs/plan): fuel, reasons and dates are now
  // staged locally like prices — NOTHING commits until Save (commitDrafts), so
  // backing out (X → discard) never leaks a stranded reason/date/fuel. The
  // `undefined` sentinel means "untouched this visit" — null/0/"" are all
  // legal committed values, so they can't double as the sentinel.
  const [fuelDraft, setFuelDraft] = useState<number | null | undefined>(undefined);
  const [baseReasonDraft, setBaseReasonDraft] = useState<StoreBaseReason | HqBaseReason | undefined>(undefined);
  const [retailReasonDraft, setRetailReasonDraft] = useState<StorePromoReason | HqPromoReason | undefined>(undefined);
  const [fuelReasonDraft, setFuelReasonDraft] = useState<StorePromoReason | HqPromoReason | undefined>(undefined);
  const [baseDateDraft, setBaseDateDraft] = useState<string | null | undefined>(undefined);
  const [retailDatesDraft, setRetailDatesDraft] = useState<{ start: string | null; end: string | null } | undefined>(undefined);
  const [fuelDatesDraft, setFuelDatesDraft] = useState<{ start: string | null; end: string | null } | undefined>(undefined);
  // The one sanctioned dialog: discarding meaningful unsaved work on exit.
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // ── Retail derivations (ported from the old EditScreen) ────────────────
  const liveRetail = item ? item.currentRetailPrice ?? item.currentBasePrice : 0;
  const hasRetail = item ? item.category_type === "temporary_allowance" || item.newRetailPrice != null : false;
  const retailExistingTotal = item ? item.newRetailPrice ?? (hasRetail ? liveRetail * retailQty : 0) : 0;
  const retailDraftCents = retailDigits === "" ? null : parseInt(retailDigits, 10);
  const baseRef = item ? (item.newBasePrice != null ? perUnit(item.newBasePrice, item.newBaseQty) : item.currentBasePrice) : 0;
  // Promo-less items show the base price as the seeded placeholder once "Add
  // deal" is tapped — the first digit replaces it (same contract as every
  // other field), so no phantom draft and no premature validation error.
  const retailDisplayCents =
    retailDraftCents ?? (hasRetail ? Math.round(retailExistingTotal * 100) : Math.round(baseRef * retailQty * 100));

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
  // Effective fuel = draft when touched this visit, else the committed value.
  const effFuel = fuelDraft !== undefined ? fuelDraft : item?.fuelSaver ?? null;
  const fuelVal = effFuel;
  const fuelRecStatus: HqRecStatus = kept.fuel
    ? "kept"
    : fuelVal == null || fuelVal <= 0
      ? "pending"
      : Math.abs(fuelVal - (item?.recommendedFuelSaver ?? 0)) < 0.001
        ? "accepted"
        : "typing";

  // Registers a fuel change in the session (walk) / its own baseline (maint)
  // and writes the value — called ONLY from commitDrafts now (fuel is a local
  // draft until Save, like every other edit).
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

  // ── One-tap reversal, per section — the visible way back the principle asks
  // for. Each resets EVERYTHING that section drafted this visit (value, qty,
  // reason, date, keep-decision, the seeded-deal flag) so the section returns
  // to exactly how it was found. No store writes happened, so this is pure
  // local reset — no confirmation, instant.
  const undoRetail = () => {
    setRetailDigits("");
    setRetailQty(item?.newRetailQty ?? 1);
    setDealSeeded(false);
    setKept((k) => ({ ...k, retail: false }));
    setRetailReasonDraft(undefined);
    setRetailDatesDraft(undefined);
    if (activeTarget === "retail") setActiveTarget(null);
  };
  const undoBase = () => {
    setBaseDigits("");
    setBaseQty(item?.newBaseQty ?? 1);
    setKept((k) => ({ ...k, base: false }));
    setBaseReasonDraft(undefined);
    setBaseDateDraft(undefined);
    if (activeTarget === "base") setActiveTarget(null);
  };
  const undoFuel = () => {
    setFuelDraft(undefined);
    setKept((k) => ({ ...k, fuel: false }));
    setFuelReasonDraft(undefined);
    setFuelDatesDraft(undefined);
  };
  const undoOnHand = () => setOnHandDigits("");
  const undoWeekly = () => setWeeklyDigits("");

  // ── Which sections carry a change (drafted now, or committed earlier this
  // session — walk scopes to the session's touched sections, like the old
  // review step did, so a pre-seeded pending override never surfaces). ─────
  const entry = walkEntries[itemId];
  const baseOverride = overrides.find((o) => o.id === `${itemId}:base` && o.status === "pending");
  const retailOverride = overrides.find((o) => o.id === `${itemId}:retail` && o.status === "pending");
  // A section counts as "changed" only from work done THIS visit: a draft
  // typed now, or (in a walk) a section this session already touched. A
  // pre-seeded pending override must NOT surface as a change at rest — that
  // was making maintenance show the when&why chips (and hide the promo run
  // window) the instant you opened an item, before touching anything. Walk
  // and maintenance now read identically until you actually edit.
  const baseChanged = baseDraftCents != null || (!!baseOverride && mode === "walk" && !!entry?.sections.base);
  const retailChanged = retailDraftCents != null || (!!retailOverride && mode === "walk" && !!entry?.sections.retail);
  const fuelChangedNow = item ? effFuel !== fuelBaselineOnOpen : false;
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
    const draft = s === "base" ? baseReasonDraft : s === "retail" ? retailReasonDraft : fuelReasonDraft;
    const chosen = draft ?? (s === "base" ? item.chosenBaseReason : s === "retail" ? item.chosenRetailReason : item.chosenFuelReason);
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
  // Tighter than hasChanges: ONLY unsaved work from this visit (the local
  // drafts), never a prior-visit commit already in the walk. This gates the
  // discard confirmation, so re-opening an already-edited item and leaving it
  // untouched exits cleanly — no dialog about "unsaved edits" when there are none.
  const hasUnsavedDrafts =
    baseDraftCents != null ||
    retailDraftCents != null ||
    fuelChangedNow ||
    keptAny ||
    inventoryChanged ||
    baseReasonDraft !== undefined ||
    retailReasonDraft !== undefined ||
    fuelReasonDraft !== undefined ||
    baseDateDraft !== undefined ||
    retailDatesDraft !== undefined ||
    fuelDatesDraft !== undefined;

  // ── Keypad routing — one keypad, four targets ───────────────────────────
  // Leaving the retail field with nothing typed collapses a seeded "Add deal"
  // back to its No-deal resting state — the placeholder never lingers as if
  // it were a decision.
  const setTarget = (t: Target) => {
    if (activeTarget === "retail" && t !== "retail" && retailDigits === "") setDealSeeded(false);
    setActiveTarget(t);
  };
  // Tap-outside-to-dismiss: a mis-tap on a value shoots the keypad up, so any
  // tap landing on non-interactive content (the header, the gaps between rows,
  // whitespace) drops it again — the same forgiving "tap the backdrop" gesture
  // as a sheet, so an accidental focus is one tap to undo. Taps on controls
  // (another field, a stepper, a chip, a rec) are owned by those controls and
  // must NOT dismiss, so we bail the moment the target sits inside one. No draft
  // is lost — the digits persist in state; only the keypad hides.
  const dismissKeypadOnBackdrop = (e: React.MouseEvent) => {
    if (activeTarget == null) return;
    if ((e.target as HTMLElement).closest("button, input, a, [role='button']")) return;
    setTarget(null);
  };
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

  // Focusing any field summons the keypad, which shrinks the scroll zone —
  // whichever row is active must stay in view (flow continuity: the lit
  // number and the keypad are one moment). `baseError` is a dep on purpose:
  // a ladder/EDLP strip appearing mid-typing grows the row downward, and the
  // strip (with its fix chip) must not hide behind the keypad — that's where
  // the correction happens.
  const retailRowRef = useRef<HTMLDivElement>(null);
  const baseRowRef = useRef<HTMLDivElement>(null);
  const fuelRowRef = useRef<HTMLDivElement>(null);
  const inventoryRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeTarget === "retail") retailRowRef.current?.scrollIntoView({ block: "nearest" });
    else if (activeTarget === "base") baseRowRef.current?.scrollIntoView({ block: "end" });
    else if (activeTarget === "onhand" || activeTarget === "weekly")
      inventoryRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeTarget, baseError]);

  // The blocked CTA is a pointer, not a wall: tapping it scrolls to the
  // section that's gating the save and pulses it twice. Validation outranks
  // a missing reason (you can't reason about a broken price).
  const redirectToBlocker = () => {
    const target: Section | null = retailError
      ? "retail"
      : baseError
        ? "base"
        : retailChanged && !reasonFor("retail")
          ? "retail"
          : baseChanged && !reasonFor("base")
            ? "base"
            : fuelChanged && !reasonFor("fuel")
              ? "fuel"
              : null;
    if (!target) return;
    const ref = target === "retail" ? retailRowRef : target === "base" ? baseRowRef : fuelRowRef;
    ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    setPulseSection(target);
  };
  useEffect(() => {
    if (pulseSection == null) return;
    const t = setTimeout(() => setPulseSection(null), 1600);
    return () => clearTimeout(t);
  }, [pulseSection]);

  // ── Commit (Save AND the scan-while-editing autosave path) ─────────────
  const commitDrafts = () => {
    if (!item || !canSave) return;
    if (baseDraftCents != null) {
      if (mode === "walk") {
        touchSection(item.id, "base", fuelBaselineOnOpen);
        // Line pricing: the propagated members ride into the walk as their own
        // rows. updateBasePrice already writes each a pending base override, so
        // touching them here is all computeWalkRows needs to surface them —
        // the connected edit lands in the row list, it isn't repriced silently.
        for (const f of familyItems) touchSection(f.id, "base", f.fuelSaver ?? null);
      }
      updateBasePrice(item.id, baseDraftCents / 100, baseQty > 1 ? baseQty : undefined);
    }
    if (retailDraftCents != null) {
      if (mode === "walk") touchSection(item.id, "retail", fuelBaselineOnOpen);
      if (item.category_type !== "temporary_allowance") updatePriceType(item.id, "temporary_allowance");
      updateRetailPrice(item.id, retailQty, retailDraftCents / 100);
    }
    // Fuel — the only draft that carries its own session/baseline bookkeeping.
    // commitFuel does the touchSection/setMaintFuelBaseline pairing so the
    // walk tally and computeWalkRows behave exactly as before; guarded so a
    // no-op fuel never creates a dead walk entry.
    if (fuelChangedNow) commitFuel(effFuel);
    for (const s of ["base", "retail", "fuel"] as const) {
      if (kept[s]) setSectionReviewed(item.id, s, true);
    }
    if (onHandDraft != null) updateOnHand(item.id, onHandDraft);
    if (weeklyDraft != null) updateWeeklyUnits(item.id, weeklyDraft);
    // Dates & reasons LAST — the price/type/fuel mutators above seed default
    // dates and (for a fuel removal) clear the reason, so an explicit pick must
    // land after them to win. Fuel date/reason only when fuel actually stays on.
    if (baseDateDraft !== undefined) updateBaseEffectiveDate(item.id, baseDateDraft);
    if (retailDatesDraft) updateAllowanceDates(item.id, retailDatesDraft.start, retailDatesDraft.end);
    if (fuelDatesDraft && effFuel != null && effFuel > 0) updateFuelSaverDates(item.id, fuelDatesDraft.start, fuelDatesDraft.end);
    if (baseReasonDraft !== undefined) setBaseChangeReason(item.id, baseReasonDraft);
    if (retailReasonDraft !== undefined) setRetailChangeReason(item.id, retailReasonDraft);
    // Fuel reason commits even for a removal (None): the app requires a reason
    // for any fuel change, and this runs AFTER commitFuel — which clears the
    // reason on removal — so the director's pick is what survives.
    if (fuelReasonDraft !== undefined) setFuelChangeReason(item.id, fuelReasonDraft);
  };

  useEffect(() => {
    autoSaveRef.current = commitDrafts;
    return () => {
      autoSaveRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commitDrafts]);

  // ── The CTA state machine — the screen's state lamp, legible at a squint:
  // gray = nothing yet · solid Hy-Vee red = ready to save · outlined red =
  // blocked (the action color with the fill withheld), naming the blocker.
  // Precedence: validation > missing reason > ready > pristine.
  const ctaState: "pristine" | "blockedValidation" | "blockedReason" | "ready" = !canSave
    ? "blockedValidation"
    : !hasChanges
      ? "pristine"
      : missingReason
        ? "blockedReason"
        : "ready";

  const handleSave = () => {
    if (!item || saving) return;
    if (ctaState === "blockedValidation" || ctaState === "blockedReason") {
      redirectToBlocker();
      return;
    }
    if (ctaState !== "ready") return;
    setSaving(true);
    // One beat of spinner in the pressed pill — enough to register the press
    // landed; the overlay stays the real payoff.
    setTimeout(() => {
      commitDrafts();
      if (mode === "maint") {
        confirmItemOverrides(item.id);
        onDone();
        return;
      }
      // The success overlay is a receipt: the item, the deal it now carries,
      // what it dragged along, and where the work went.
      const priceWork = baseDraftCents != null || retailDraftCents != null || fuelChangedNow || entry != null;
      const lines = [item.name];
      if (retailDraftCents != null)
        lines.push(
          retailQty > 1 ? `${retailQty} for ${fmt(retailDraftCents / 100)}` : `${fmt(retailDraftCents / 100)} deal`
        );
      else if (priceWork || keptAny) lines.push("Prices updated");
      const propagated = baseDraftCents != null && familyItems.length > 0;
      if (propagated) lines.push(`${familyItems.length} related items updated`);
      if (inventoryChanged) lines.push("Inventory updated");
      if (keptAny) lines.push("HQ decision recorded");
      if (priceWork) lines.push("Added to Store Walk");
      // A representative sample of the family flies into the pending tray —
      // the receipt line above carries the full count.
      setOverlay({ lines, flyItems: propagated ? familyItems.slice(0, 3).map((f) => f.name) : undefined });
    }, 180);
  };

  // Nothing commits before Save now, so there's nothing to roll back on exit —
  // the parent discards local drafts by remounting. The ONE sanctioned dialog:
  // confirm before throwing away unsaved work; a pristine screen exits directly.
  const handleCancel = () => {
    if (hasUnsavedDrafts) {
      setConfirmDiscard(true);
      return;
    }
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
  // at the moment of cause. They render ONLY under a changed section (their
  // arrival is the information); the reason chip turns red until it's filled,
  // the same hue family as the blocked CTA that points back at it.
  const metaChips = (section: Section, dateLabel: string, reversal?: React.ReactNode) => {
    const reason = reasonFor(section);
    return (
      <div className="rise-in flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setSheet({ kind: "date", section })}
          className="flex min-h-9 select-none touch-manipulation items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 active:bg-gray-50"
        >
          <Calendar className="size-3.5 text-gray-400" aria-hidden="true" />
          {dateLabel}
        </button>
        <button
          type="button"
          onClick={() => setSheet({ kind: "reason", section })}
          className={`flex min-h-9 select-none touch-manipulation items-center gap-1.5 rounded-lg border bg-white px-2.5 text-xs font-medium ${
            reason ? "border-gray-200 text-gray-700 active:bg-gray-50" : "border-red-300 text-red-600 active:bg-red-50"
          }`}
        >
          <Tag className={`size-3.5 ${reason ? "text-gray-400" : "text-red-400"}`} aria-hidden="true" />
          {reason ?? "Add reason"}
        </button>
        {reversal}
      </div>
    );
  };

  // The section-level reversal pill — same "when & why" chip grammar (bordered,
  // iconed), brand-tinted to read as an action. Sits in the metaChips cluster
  // so date · reason · undo are one row. Suppressed when an HQ rec is already
  // showing its own Undo (accepted state) to avoid a duplicate control.
  const undoChip = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-9 select-none touch-manipulation items-center gap-1.5 px-1.5 text-xs font-semibold text-brand active:opacity-70"
    >
      <RotateCcw className="size-3.5 text-brand/70" aria-hidden="true" />
      {label}
    </button>
  );

  // Effective dates = the visit's draft when set, else the committed value —
  // the chips and the resting window read these, so a picked-but-unsaved date
  // shows immediately yet never touches the store until Save.
  const effBaseDate = baseDateDraft !== undefined ? baseDateDraft : item.baseEffectiveDate ?? null;
  const effRetailStart = retailDatesDraft ? retailDatesDraft.start : item.allowanceStartDate ?? null;
  const effRetailEnd = retailDatesDraft ? retailDatesDraft.end : item.allowanceEndDate ?? null;
  const effFuelStart = fuelDatesDraft ? fuelDatesDraft.start : item.fuelSaverStartDate ?? null;
  const effFuelEnd = fuelDatesDraft ? fuelDatesDraft.end : item.fuelSaverEndDate ?? null;

  // Honest defaults for the date chips: the store mutators seed the same
  // values on commit, so the chip never promises something the save won't do.
  const defaultWeek = fmtDateRange(isoToday(), isoAddDays(isoToday(), 6))!;
  const baseDateLabel = fmtDateShort(effBaseDate) ?? "Today";
  const retailDateLabel = fmtDateRange(effRetailStart, effRetailEnd) ?? defaultWeek;
  const fuelDateLabel = fmtDateRange(effFuelStart, effFuelEnd) ?? defaultWeek;

  // An active promo shows its run window at rest — read-only ground, no reason
  // chip yet (that arrives only with a change). Walking the store, the director
  // can spot a deal about to lapse and decide to extend or end it. The window
  // yields the moment an edit begins: the editable when&why chips take over.
  const retailEndsIn = daysUntil(effRetailEnd);
  const retailEndingSoon = retailEndsIn != null && retailEndsIn >= 0 && retailEndsIn <= 3;
  const endsSoonLabel =
    retailEndsIn === 0 ? "ends today" : retailEndsIn === 1 ? "ends tomorrow" : `ends in ${retailEndsIn} days`;
  const retailWindow =
    hasRetail && !retailChanged && effRetailEnd ? (
      <div
        className={`flex items-center gap-1.5 text-xs ${
          retailEndingSoon ? "font-medium text-amber-700" : "text-gray-500"
        }`}
      >
        <Calendar
          className={`size-3.5 ${retailEndingSoon ? "text-amber-500" : "text-gray-400"}`}
          aria-hidden="true"
        />
        <span>
          {fmtDateRange(effRetailStart, effRetailEnd)}
          {retailEndingSoon && ` · ${endsSoonLabel}`}
        </span>
      </div>
    ) : null;

  const famCount = familyItems.length;
  const saveLabel =
    mode === "maint" ? "Send to SAP" : baseDraftCents != null && famCount > 0 ? `Save · ${famCount + 1} items` : "Save & next";

  // Per-section reversal nodes for the metaChips cluster. Only for a change
  // drafted THIS visit (a prior-visit committed change can't be undone from
  // here). A new deal on a promo-less item reverts as "Remove deal" — the
  // requirement's non-destructive language, returning the item to No-deal. The
  // accepted-rec guard hands reversal to HqRecBlock's own Undo in that state.
  const retailReversal =
    retailDraftCents != null && !(retailRecActive && retailRecStatus === "accepted")
      ? undoChip(hasRetail ? "Undo" : "Remove deal", undoRetail)
      : null;
  const baseReversal =
    baseDraftCents != null && !(baseRecActive && baseRecStatus === "accepted") ? undoChip("Undo", undoBase) : null;
  const fuelReversal =
    fuelChangedNow && !(fuelRecActive && fuelRecStatus === "accepted") ? undoChip("Undo", undoFuel) : null;

  // The retail HQ rec renders in the same slot whether the row is a live
  // price or the No-deal resting state — fixed insertion points keep the
  // saccade pattern stable item to item.
  const retailRec =
    retailRecActive && recRetailCents != null ? (
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
        onUndo={() => (retailRecStatus === "kept" ? setKept((k) => ({ ...k, retail: false })) : setRetailDigits(""))}
      />
    ) : null;
  const showNoDeal = !hasRetail && retailDraftCents == null && !dealSeeded;

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

      <div className="flex-1 overflow-y-auto px-4 py-3" onClick={dismissKeypadOnBackdrop}>
        <div className="flex flex-col gap-7">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-gray-900">{item.name}</p>
            <p className="mt-0.5 truncate text-xs text-gray-500">UPC {item.upc}</p>
          </div>

          {/* ── The pricing surface: Retail · Base · Fuel as one continuous
                 field — hierarchy by weight and rhythm, not card chrome. Each
                 section carries its own live margin as light ground, and
                 everything conditional (recs, errors, chips, the line-pricing
                 ripple) attaches under the row that caused it. ── */}
          <section className="flex flex-col gap-6">
            <div ref={retailRowRef} className={pulseSection === "retail" ? "pulse-attention" : undefined}>
              {showNoDeal ? (
                /* No-deal resting state — the truth stated quietly, with the
                   one action that changes it. "Add deal" seeds the base price
                   as a placeholder and summons the keypad; nothing commits
                   until digits land. */
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-gray-400">Retail</span>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[34px] font-semibold leading-none text-gray-300">No deal</span>
                    <button
                      type="button"
                      onClick={() => {
                        setDealSeeded(true);
                        setTarget("retail");
                      }}
                      className="h-10 shrink-0 select-none touch-manipulation rounded-full bg-gray-900 px-4 text-sm font-semibold text-white active:opacity-80"
                    >
                      Add deal
                    </button>
                  </div>
                  {retailRec}
                </div>
              ) : (
                <PriceRow
                  label="Retail"
                  ariaField="retail"
                  hero
                  qty={retailQty}
                  onQtyChange={setRetailQty}
                  displayCents={retailDisplayCents}
                  active={activeTarget === "retail"}
                  hasDraft={retailDraftCents != null}
                  wasLabel={retailDraftCents != null && hasRetail ? `was ${fmt(liveRetail)}` : null}
                  marginPct={margins?.retail ?? null}
                  error={retailError}
                  onFocus={() => setTarget("retail")}
                  popToken={pops.retail}
                >
                  {retailRec}
                  {retailWindow}
                  {retailChanged && metaChips("retail", retailDateLabel, retailReversal)}
                </PriceRow>
              )}
            </div>

            <div ref={baseRowRef} className={pulseSection === "base" ? "pulse-attention" : undefined}>
              <PriceRow
                label="Base price"
                ariaField="base"
                qty={baseQty}
                onQtyChange={setBaseQty}
                displayCents={baseDisplayCents}
                active={activeTarget === "base"}
                hasDraft={baseDraftCents != null}
                wasLabel={baseDraftCents != null ? `was ${fmt(item.currentBasePrice)}` : null}
                marginPct={margins?.base ?? null}
                multiUnitOptIn
                error={baseError}
                onFocus={() => setTarget("base")}
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
                {/* Line pricing: the consequence, attached to its cause and
                    made to ripple. A peek of the first members cascades in
                    old→new so the shared move reads as ONE decision spreading
                    outward; the rest are one tap away. */}
                {baseDraftCents != null && famCount > 0 && (
                  <div className="rise-in flex flex-col gap-1.5">
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
                    {/* Keyed by open/collapsed so expanding replays the cascade;
                        the peek animates once on the first drafted digit, then
                        values update in place (no per-keystroke jitter). */}
                    <ul key={familyOpen ? "open" : "peek"} className="flex flex-col gap-1 pl-5">
                      {(familyOpen ? familyItems : familyItems.slice(0, 3)).map((f, i) => (
                        <li
                          key={f.id}
                          className="line-morph flex items-baseline justify-between gap-2 text-xs"
                          style={{ animationDelay: `${Math.min(i, 20) * 32}ms` }}
                        >
                          <span className="min-w-0 truncate text-gray-600">{f.name}</span>
                          <span className="flex shrink-0 items-baseline gap-1 tabular-nums">
                            <span className="text-gray-400 line-through">
                              {fmt(perUnit(f.newBasePrice ?? f.currentBasePrice, f.newBaseQty))}
                            </span>
                            <ChevronRight className="size-3 self-center text-gray-300" aria-hidden="true" />
                            <span className="font-semibold text-gray-900">{fmt(perUnit(baseDraftCents / 100, baseQty))}</span>
                          </span>
                        </li>
                      ))}
                      {!familyOpen && famCount > 3 && (
                        <li className="pl-0.5 text-xs text-gray-400">+{famCount - 3} more move with it</li>
                      )}
                    </ul>
                  </div>
                )}
                {baseChanged && metaChips("base", baseDateLabel, baseReversal)}
              </PriceRow>
            </div>

            {/* Fuel Saver — the screen's ONE contained region, and it earns
                it: a cents-off program, not a shelf price, so it sits on its
                own inset ground between the shelf prices and inventory. */}
            <div
              ref={fuelRowRef}
              className={`flex flex-col gap-2 rounded-xl bg-gray-50 p-3 ${
                pulseSection === "fuel" ? "pulse-attention" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setTarget(null);
                  setFuelSheetOpen(true);
                }}
                className="flex min-h-9 w-full select-none touch-manipulation items-center gap-2 text-left"
              >
                <Fuel className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
                {/* The program's name is "Fuel Saver" — never shorten it. */}
                <span className="whitespace-nowrap text-sm font-medium text-gray-600">Fuel Saver</span>
                <span className="flex flex-1 items-center justify-end gap-1 text-sm font-semibold tabular-nums text-gray-900">
                  {fuelAmountLabel(effFuel)}
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
                    setFuelDraft(item.recommendedFuelSaver!);
                  }}
                  onKeep={() => {
                    setFuelDraft(undefined);
                    setKept((k) => ({ ...k, fuel: true }));
                  }}
                  onUndo={() => {
                    if (fuelRecStatus === "kept") setKept((k) => ({ ...k, fuel: false }));
                    else setFuelDraft(undefined);
                  }}
                />
              )}
              {fuelChanged && metaChips("fuel", fuelDateLabel, fuelReversal)}
            </div>
          </section>

          <div ref={inventoryRef} className="border-t border-gray-100 pt-5">
            <InventoryCard
              onHand={onHandDisplay}
              onHandActive={activeTarget === "onhand"}
              onHandHasDraft={onHandDraft != null}
              onFocusOnHand={() => setActiveTarget("onhand")}
              onUndoOnHand={onHandDraft != null ? undoOnHand : undefined}
              weekly={weeklyDisplay}
              weeklyDelta={weeklyDisplay - weeklyBaseline}
              weeklyActive={activeTarget === "weekly"}
              weeklyHasDraft={weeklyDraft != null}
              onFocusWeekly={() => setActiveTarget("weekly")}
              onUndoWeekly={weeklyDraft != null ? undoWeekly : undefined}
            />
          </div>

          <ItemInfoPills item={item} liveRetail={liveRetail} familyItems={familyItems} draftBaseUnit={baseUnitDraft} />
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-100 pb-[env(safe-area-inset-bottom)]">
        {activeTarget != null && (
          <div className="keypad-in">
            <MobileKeypad onDigit={onDigit} onBackspace={onBackspace} onHide={() => setTarget(null)} />
          </div>
        )}
        <div className="px-4 py-3">
          {/* The dock CTA — always tappable except pristine/loading. Blocked
              states keep the action hue but withhold the fill and NAME the
              blocker; tapping them scrolls to the cause. */}
          <button
            type="button"
            onClick={handleSave}
            disabled={ctaState === "pristine" || saving}
            aria-label={saving ? "Saving" : undefined}
            className={`flex h-14 w-full select-none touch-manipulation items-center justify-center rounded-full text-base font-semibold transition-colors ${
              ctaState === "pristine"
                ? "bg-gray-100 text-gray-400"
                : ctaState === "ready"
                  ? "bg-hyvee-red text-white active:brightness-90"
                  : "border-2 border-hyvee-red bg-white text-hyvee-red active:bg-red-50"
            }`}
          >
            {saving ? (
              <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : ctaState === "blockedValidation" ? (
              "Resolve pricing issue"
            ) : ctaState === "blockedReason" ? (
              "Add reason codes"
            ) : (
              saveLabel
            )}
          </button>
        </div>
      </div>

      <FuelSaverSheet
        open={fuelSheetOpen}
        value={effFuel}
        onClose={() => setFuelSheetOpen(false)}
        onSelect={(v) => {
          setKept((k) => ({ ...k, fuel: false }));
          setFuelDraft(v);
          // Removing fuel drops its reason (updateFuelSaver clears it on commit).
          if (v == null || v <= 0) setFuelReasonDraft(undefined);
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
            ? baseReasonDraft ?? item.chosenBaseReason
            : sheet?.section === "fuel"
              ? fuelReasonDraft ?? item.chosenFuelReason
              : retailReasonDraft ?? item.chosenRetailReason
        }
        onSelect={(v) => {
          if (sheet?.section === "base") setBaseReasonDraft(v as StoreBaseReason | HqBaseReason);
          else if (sheet?.section === "fuel") setFuelReasonDraft(v as StorePromoReason | HqPromoReason);
          else if (sheet?.section === "retail") setRetailReasonDraft(v as StorePromoReason | HqPromoReason);
        }}
        onClose={() => setSheet(null)}
      />

      <EffectiveSheet
        open={sheet?.kind === "date"}
        title={sheet?.section === "base" ? "Base effective date" : sheet?.section === "fuel" ? "Fuel Saver run" : "Promo window"}
        mode={sheet?.section === "base" ? "single" : "range"}
        start={
          sheet?.section === "base"
            ? effBaseDate ?? isoToday()
            : sheet?.section === "fuel"
              ? effFuelStart ?? isoToday()
              : effRetailStart ?? isoToday()
        }
        end={
          sheet?.section === "fuel"
            ? effFuelEnd ?? isoAddDays(isoToday(), 6)
            : effRetailEnd ?? isoAddDays(isoToday(), 6)
        }
        onApply={(s, e) => {
          if (sheet?.section === "base") setBaseDateDraft(s);
          else if (sheet?.section === "fuel") setFuelDatesDraft({ start: s, end: e });
          else if (sheet?.section === "retail") setRetailDatesDraft({ start: s, end: e });
        }}
        onClose={() => setSheet(null)}
      />

      {/* Leaving with unsaved work is the ONE case the principle sanctions a
          dialog — draft edits themselves never confirm. Backdrop/Escape/X all
          mean "keep editing", the safe default. */}
      <BottomSheet open={confirmDiscard} onClose={() => setConfirmDiscard(false)} title="Discard changes?">
        <div className="flex flex-col gap-2 p-2">
          <p className="px-1 pb-1 text-sm text-gray-600">Your unsaved edits on this item will be lost.</p>
          <Button
            variant="secondary"
            className="h-12 w-full"
            onClick={() => {
              setConfirmDiscard(false);
              onCancel();
            }}
          >
            Discard changes
          </Button>
          <Button variant="primary" className="h-12 w-full" onClick={() => setConfirmDiscard(false)}>
            Keep editing
          </Button>
        </div>
      </BottomSheet>

      {overlay && <SaveOverlay lines={overlay.lines} flyItems={overlay.flyItems} onDone={onDone} />}
    </div>
  );
}
