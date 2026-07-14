"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Drawer, Button, Badge, Select, Tooltip, useToast } from "@dejesumensaje/converge-ds-experimental";
import { DateRangeField } from "../shared/DateRangeField";
import { DatePickerField } from "../shared/DatePickerField";
import { usePricingStore, useCompetitorOrder, useEdlpException } from "@/store/pricing-store";
import { PricingCategory, PricingItem, OverrideStatus, Batch, StoreBaseReason, StorePromoReason, HqBaseReason, HqPromoReason } from "@/types/pricing";
import { RetailReductionField } from "./RetailReductionField";
import { BaseReductionField } from "./BaseReductionField";
import { BasePriceMethodField } from "./BasePriceMethodField";
import { BatchPickerModal } from "../store/BatchPickerModal";
import { HqBadge } from "../store/buildStoreColumns";
import { ShelfTagPreview } from "./ShelfTagPreview";
import { ProductRelationships } from "./ProductRelationships";
import { CollapsibleSection } from "./CollapsibleSection";
import { BlockedPriceChangeModal } from "./BlockedPriceChangeModal";
import { BasePriceSoftWarningModal } from "./BasePriceSoftWarningModal";
import { RetailPriceWarningModal } from "./RetailPriceWarningModal";
import { EdlpCeilingBlockedModal } from "./EdlpCeilingBlockedModal";
import { EdlpCeilingWarningModal } from "./EdlpCeilingWarningModal";
import { evaluateBaseChange, committedSoftWarnings, BaseChangeEvaluation } from "@/lib/relationship-validation";
import { evaluateEdlpCeilingChange, committedEdlpCeilingState, EdlpChangeEvaluation } from "@/lib/edlp-ceiling";
import {
  REASON_META,
  PriceChangeReason,
  changeReasonFor,
  STORE_BASE_REASON_OPTIONS,
  STORE_PROMO_REASON_OPTIONS,
  HQ_BASE_REASON_OPTIONS,
  HQ_PROMO_REASON_OPTIONS,
} from "@/lib/price-change-reason";
import { orderCompetitors } from "@/lib/competitors";
import { ImpactBreakdown } from "./columns/shared";
import { hqRecRationale } from "@/lib/hq-rec";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { PRICE_TYPE_INTENT, FUEL_SAVER_OPTIONS, fuelSaverSelectValue } from "@/lib/pricing-meta";
import { deriveItemStatus, hqReviewNeeded, baseRecPending, retailRecPending, fuelRecPending } from "@/lib/item-status";
import { fmt, fmtQtyPrice, fmtDateTime, fmtDateRange, fmtEffectiveDate } from "@/lib/format";
import { grossMarginPct, fmtPct, fmtPpDelta, perUnit, round2, fmtSignedPct, promoDurationDays } from "@/lib/pricing-math";
import { buildItemsById } from "@/lib/batch-utils";
import { RotateCcw, Trash2, Check, Package, Link2, Lock, Info, Pencil, CalendarClock, AlertCircle, AlertTriangle } from "lucide-react";

type Props = {
  itemId: string | null;
  /** Which flow opened the drawer — sets the footer's primary action. */
  flow: "all" | "hq";
  /** Open batches the per-item "Add to batch" menu can target. */
  openBatches: Batch[];
  /** Assign this item's pending change(s) to a batch (owned by the page). */
  onAddToBatch: (batchId: string, overrideIds: string[]) => void;
  /** Start a new batch seeded with these override ids (owned by the page). */
  onNewBatch: (seedIds: string[]) => void;
  onClose: () => void;
};

function Field({
  label,
  action,
  required,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-h-6 items-center justify-between gap-3">
        <span className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>}
        </span>
        {action}
      </div>
      {children}
    </div>
  );
}

function MarginRow({ label, current, next }: { label: string; current: number; next: number }) {
  const delta = next - current;
  const tone = delta > 0.05 ? "text-emerald-600" : delta < -0.05 ? "text-red-600" : "text-gray-500";
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-gray-500">{label}</span>
      <div className="flex items-center gap-2 tabular-nums">
        <span className="text-gray-500">{fmtPct(current)}</span>
        <span aria-hidden="true" className="text-gray-300">→</span>
        <span className="font-semibold text-gray-900">{fmtPct(next)}</span>
        <span className={`w-16 text-right font-medium ${tone}`}>{fmtPpDelta(delta)}</span>
      </div>
    </div>
  );
}

// One reason selector for all three sections' edit forms. The catalog is
// contextual to the section AND its origin — an HQ-originated section
// (accepted rec or custom price on a pending rec) re-picks from its HQ
// catalog; a store-originated one from its store catalog. Always editable:
// accepting a rec seeds the reason, it doesn't lock it. No default — the
// Select opens unselected and Done blocks while a decided price has no reason
// (`missing` renders that blocked state after a failed Done).
function ReasonSelect({
  options,
  value,
  missing,
  disabled,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  missing: boolean;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    // .reason-select: globals.css appends a red required asterisk to the DS
    // Select's floating label — the label prop is a plain string, so the
    // asterisk can't be a styled node here. Same required signal (and same
    // red) as the date fields' Field asterisk, since Done blocks on both alike.
    <div className="reason-select" data-reason-missing={missing || undefined}>
      <Select
        label="Change reason"
        size="sm"
        disabled={disabled}
        options={options}
        value={value}
        placeholder="Select a reason"
        error={missing}
        errorMessage={missing ? "Select a reason for this change." : undefined}
        onChange={(v) => onChange(v as string)}
      />
    </div>
  );
}

// Non-blocking informational note for a promo period running longer than two
// weeks — Retail and Fuel Saver only (Base has no period to be "long").
// Deliberately a low-key blue Info treatment, NOT the amber triangle: amber +
// AlertTriangle is reserved for cautions that ask the director to reconsider
// (the EDLP soft-ceiling banner); this is purely a heads-up and never blocks.
function LongPromoNotice({ days }: { days: number }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs">
      <Info className="size-4 shrink-0 text-blue-600" aria-hidden="true" />
      <span className="text-blue-900">
        This promotion runs {days} days — longer than the typical two-week window.
      </span>
    </div>
  );
}

// Compact read-only trace shown after the director has decided against (or
// declined) an HQ recommendation — keeps HQ's proposal visible even once a
// different, store-originated decision has replaced it.
function HqRef({ price, reasonKey, prefix = "", suffix = "" }: { price: number; reasonKey?: PriceChangeReason | null; prefix?: string; suffix?: string }) {
  const label = reasonKey ? REASON_META[reasonKey]?.label : null;
  return (
    <p className="mt-1.5 text-xs tabular-nums text-gray-500">
      HQ recommended {prefix}{fmt(price)}{suffix}{label ? ` · ${label}` : ""}
    </p>
  );
}

export function ItemEditDrawer({
  itemId,
  flow,
  openBatches,
  onAddToBatch,
  onNewBatch,
  onClose,
}: Props) {
  const items = usePricingStore((s) => s.items);
  const batches = usePricingStore((s) => s.batches);
  const updateBasePrice = usePricingStore((s) => s.updateBasePrice);
  const updateBaseEffectiveDate = usePricingStore((s) => s.updateBaseEffectiveDate);
  const updateRetailPrice = usePricingStore((s) => s.updateRetailPrice);
  const updateFuelSaver = usePricingStore((s) => s.updateFuelSaver);
  const updateFuelSaverDates = usePricingStore((s) => s.updateFuelSaverDates);
  const updatePriceType = usePricingStore((s) => s.updatePriceType);
  const updateAllowanceDates = usePricingStore((s) => s.updateAllowanceDates);
  const setSectionReviewed = usePricingStore((s) => s.setSectionReviewed);
  const setBaseChangeReason = usePricingStore((s) => s.setBaseChangeReason);
  const setRetailChangeReason = usePricingStore((s) => s.setRetailChangeReason);
  const setFuelChangeReason = usePricingStore((s) => s.setFuelChangeReason);
  const removeFromLooseTray = usePricingStore((s) => s.removeFromLooseTray);
  const moveOverrideToBatch = usePricingStore((s) => s.moveOverrideToBatch);
  const toast = useToast();
  // The active store's director-set competitor order, if any (falls back to
  // HQ_DEFAULT_ORDER inside orderCompetitors when undefined).
  const competitorOrder = useCompetitorOrder();
  // The active store's EDLP ceiling exception, if AVP – Pricing granted one.
  // View-only here — store users never grant/edit it (see SettingsDrawer).
  const edlpException = useEdlpException();

  const item = items.find((i) => i.id === itemId) ?? null;
  const isTemp = item?.category_type === "temporary_allowance";
  // HQ pushed this price (already live). Frames the reference grid + identity note.
  const isHq = item?.hqReviewPending === true;
  // A store-originated item: cost and/or a competitor moved, with NO HQ rec. The
  // director reacts directly (set a price) — informational only, decoupled from
  // Change Reason (each decided section picks its own reason regardless of lens).
  const storeOrigin = !isHq && (item?.storeSignals?.length ?? 0) > 0;
  const isEdlp = item?.category_type === "everyday_low_price";
  // A brand-new item has no current price to keep — it gets a "set opening price"
  // prompt instead of a read-only "current price" row.
  const isNewItem = item?.category_type === "new_discontinued" && item?.itemStatus === "new";
  // Sent to SAP, not yet confirmed: the change is in flight and nothing can be
  // altered until SAP accepts it. An item that's Sending (any submitted field) is
  // FULLY locked — base, retail AND fuel saver, regardless of which field is the
  // one in flight. So a single `sending` flag locks every section.
  // sendFailed items retain overrideStatus "submitted" but the send never landed —
  // the price is not live in SAP, so the director must be able to edit and retry.
  const sending =
    !item?.sendFailed &&
    (item?.baseOverrideStatus === "submitted" || item?.retailOverrideStatus === "submitted");
  const baseLocked = sending;
  const retailLocked = sending;
  // Per-type intent (labels + helper copy). New/discontinued is refined by itemStatus.
  const intent = item
    ? item.category_type === "new_discontinued"
      ? item.itemStatus === "discontinued"
        ? { helper: "Being removed — set a clearance price.", priceLabel: "Clearance price" }
        : { helper: "New item — set its opening price.", priceLabel: "Initial price" }
      : PRICE_TYPE_INTENT[item.category_type]
    : null;

  // Conscious-edit for fuel saver: like base/retail, the amount picker only
  // appears once the director deliberately Adds/Changes it; otherwise the section
  // shows the current value ($0.00 when none) read-only.
  const [editingFuelSaver, setEditingFuelSaver] = useState(false);
  // Conscious-edit: the editable price input only appears once the director
  // deliberately chooses to set/change a price (vs. accepting or keeping). Until
  // then the section shows the current price read-only — no premature input.
  const [editingBase, setEditingBase] = useState(false);
  // Accept-first: a TA with an HQ rec opens on the recommendation; this flips to
  // the reduction-method chooser once the director chooses to set their own price.
  const [changingRetail, setChangingRetail] = useState(false);
  // When a non-TA item is converted to TA by opening the retail editor, remember
  // the original type so we can revert it if the director closes without a price.
  const [preConversionType, setPreConversionType] = useState<PricingCategory | null>(null);
  const [confirmRevert, setConfirmRevert] = useState<"base" | "retail" | null>(null);
  const [batchPromptOpen, setBatchPromptOpen] = useState(false);
  const [movePickerOpen, setMovePickerOpen] = useState(false);
  // A proposed base price that failed hard validation — parked here (NOT
  // committed) while the blocking modal asks the director to revert or scale.
  const [blockedProposal, setBlockedProposal] = useState<{
    total: number;
    qty?: number;
    evaluation: BaseChangeEvaluation;
  } | null>(null);
  // A base price that has soft violations (narrow gaps vs related SKUs) — parked
  // while the soft-warning dialog asks the director to cancel or proceed.
  const [softProposal, setSoftProposal] = useState<{
    total: number;
    qty?: number;
    evaluation: BaseChangeEvaluation;
    suggestedPrice: number;
  } | null>(null);
  // A proposed base price that breaches an EDLP item's hard ceiling (>10% over
  // the SAP PMR maximum) with no active exception — parked (NOT committed)
  // while the blocking modal asks the director to revert or use the max.
  const [edlpBlockedProposal, setEdlpBlockedProposal] = useState<{
    total: number;
    qty?: number;
    evaluation: EdlpChangeEvaluation;
  } | null>(null);
  // A proposed base price in the EDLP soft zone (over max, within +10% — or an
  // exception-covered hard breach) — parked while the warning dialog asks the
  // director to cancel, use the max, or proceed anyway.
  const [edlpSoftProposal, setEdlpSoftProposal] = useState<{
    total: number;
    qty?: number;
    evaluation: EdlpChangeEvaluation;
  } | null>(null);
  // Inline error for hard retail validation failures (zero/negative, at or above
  // base). The refs mirror state so handleDone can read rejections synchronously
  // — state updates from onBlur and the Done onClick run in the same event flush.
  const [retailValidationError, setRetailValidationError] = useState<string | null>(null);
  // Inline error for hard base validation failures (zero/negative).
  const [baseValidationError, setBaseValidationError] = useState<string | null>(null);
  // Flipped on when Done is blocked by a decided price with no change reason —
  // renders the offending reason Selects in their error state. Quiet until
  // then: an open form mid-edit shouldn't shout "missing" before the director
  // has had a chance to pick.
  const [showReasonErrors, setShowReasonErrors] = useState(false);
  const retailRejectedRef = useRef(false);
  const baseRejectedRef = useRef(false);
  // A proposed retail price that exceeded the 50% soft-warning threshold — parked
  // while the warning dialog asks the director to cancel, use the suggested price,
  // or proceed anyway.
  const [pendingRetailProposal, setPendingRetailProposal] = useState<{
    qty: number;
    price: number;
    suggestedPrice: number;
  } | null>(null);
  // Last COMPLETE promo windows (both ends picked). A mid-pick range edit
  // (new start chosen, end not yet — DateRangeField clears the end on the
  // first click) abandoned via × / Escape rolls back to these in handleClose,
  // so no close path can persist the half-open window Done rejects.
  const lastAllowanceRange = useRef<{ start: string; end: string } | null>(null);
  const lastFuelRange = useRef<{ start: string; end: string } | null>(null);
  useEffect(() => {
    if (item?.allowanceStartDate && item?.allowanceEndDate)
      lastAllowanceRange.current = { start: item.allowanceStartDate, end: item.allowanceEndDate };
    if (item?.fuelSaverStartDate && item?.fuelSaverEndDate)
      lastFuelRange.current = { start: item.fuelSaverStartDate, end: item.fuelSaverEndDate };
  }, [item?.allowanceStartDate, item?.allowanceEndDate, item?.fuelSaverStartDate, item?.fuelSaverEndDate]);
  useEffect(() => {
    setEditingFuelSaver(false);
    setEditingBase(false);
    setChangingRetail(false);
    setPreConversionType(null);
    setConfirmRevert(null);
    setBatchPromptOpen(false);
    setMovePickerOpen(false);
    setBlockedProposal(null);
    setRetailValidationError(null);
    setBaseValidationError(null);
    setShowReasonErrors(false);
    retailRejectedRef.current = false;
    baseRejectedRef.current = false;
    setPendingRetailProposal(null);
    setSoftProposal(null);
    setEdlpBlockedProposal(null);
    setEdlpSoftProposal(null);
    // (lastAllowanceRange / lastFuelRange deliberately not reset here: their
    // capture effect re-runs whenever the dates change, so switching items
    // re-captures — and a value-identical leftover restores the same values.)
  }, [itemId]);

  // Silently discard any half-open editing state before closing. Called from Done,
  // the × button, and Escape — any close path. Four cases:
  // 1. Retail form open but no price committed → revert the TA type conversion
  //    that startPromo() made.
  // 2. Base form open but no price committed → clear any orphaned base reason.
  // 3. Fuel form open but no amount set → clear any orphaned fuel reason/dates.
  // 4. Mid-pick promo range on a committed price → roll back to the last
  //    complete window (see below).
  const handleClose = () => {
    if (item) {
      if (changingRetail && item.newRetailPrice == null) {
        if (preConversionType != null) updatePriceType(item.id, preConversionType);
        updateRetailPrice(item.id, 1, null);
      }
      if (editingBase && item.newBasePrice == null) {
        updateBasePrice(item.id, null);
      }
      if (editingFuelSaver && (item.fuelSaver == null || item.fuelSaver <= 0)) {
        updateFuelSaver(item.id, null);
      }
      // 4. A committed promo with a mid-pick range (new start chosen, end not
      //    yet — the first calendar click clears the end) → roll back to the
      //    last complete window, so × / Escape can't persist the half-open
      //    state Done rejects. Falls back to a same-day window only if no
      //    complete range was ever seen (unreachable in practice: setting the
      //    price seeds both dates).
      if (item.newRetailPrice != null && item.allowanceStartDate && !item.allowanceEndDate) {
        const prev = lastAllowanceRange.current;
        updateAllowanceDates(item.id, prev?.start ?? item.allowanceStartDate, prev?.end ?? item.allowanceStartDate);
      }
      if (item.fuelSaver != null && item.fuelSaver > 0 && item.fuelSaverStartDate && !item.fuelSaverEndDate) {
        const prev = lastFuelRange.current;
        updateFuelSaverDates(item.id, prev?.start ?? item.fuelSaverStartDate, prev?.end ?? item.fuelSaverStartDate);
      }
    }
    onClose();
  };

  // Deliberately no auto-advance — hopping to the next item added noise without helping the decide-then-send task.
  const advance = () => handleClose();

  const itemsById = useMemo(() => buildItemsById([items]), [items]);
  const relatedItems = (item?.relatedItemIds ?? [])
    .map((id) => itemsById.get(id))
    .filter((i): i is PricingItem => i != null);
  const familyItems = item?.familyId
    ? [...itemsById.values()].filter((i) => i.familyId === item.familyId && i.id !== item.id)
    : [];

  // Soft constraint warnings in the committed prices (narrow gaps vs related
  // items) — derived every render, so the banner persists while the violation
  // exists and disappears the moment the price is fixed or reverted.
  const softWarnings = item ? committedSoftWarnings(item.id, itemsById) : [];

  // The EDLP ceiling state of the item's CURRENTLY committed price — derived
  // every render (same pattern as softWarnings), drives the in-drawer banner
  // and the price field's amber cell state. "ok" for every non-EDLP item.
  const edlpCeilingState = item ? committedEdlpCeilingState(item, edlpException) : null;

  // Commit a base price. Family items share one price, so the store
  // propagates to the whole family — tell the user and offer a one-click Undo.
  // Hard constraint violations (order inversions vs related items) block the
  // commit: the proposal parks in `blockedProposal` and a modal asks the
  // director to revert or scale. Clearing a price (null) restores the current
  // price, which can't break a ladder — no validation on that path.
  const commitBase = (v: number | null, qty?: number) => {
    if (!item) return;
    baseRejectedRef.current = false;
    if (v != null) {
      const proposedPerUnit = perUnit(v, qty);
      if (proposedPerUnit <= 0) {
        setBaseValidationError("Base price must be greater than $0.00.");
        baseRejectedRef.current = true;
        return;
      }
      // EDLP ceiling is a SAP compliance hard stop — checked before pricing
      // fundamentals (relationships), since a price that isn't SAP-legal
      // shouldn't even get to the ladder/gap conversation.
      const edlpEvaluation = evaluateEdlpCeilingChange(item.id, proposedPerUnit, itemsById, edlpException);
      if (edlpEvaluation.hard.length > 0) {
        setEdlpBlockedProposal({ total: v, qty, evaluation: edlpEvaluation });
        baseRejectedRef.current = true;
        return;
      }
      const evaluation = evaluateBaseChange(item.id, proposedPerUnit, itemsById);
      if (evaluation.hard.length > 0) {
        setBlockedProposal({ total: v, qty, evaluation });
        baseRejectedRef.current = true;
        return;
      }
      if (evaluation.soft.length > 0) {
        // Compute the least-intrusive price that satisfies every violated gap.
        // offender < comparator → offender must go lower: floor(comp / (1 + gap%))
        // offender > comparator → offender must go higher: ceil(comp × (1 + gap%))
        // Using floor/ceil (not round) ensures the result is strictly inside the
        // threshold after cent-rounding.
        const highSuggestions: number[] = [];
        const lowSuggestions: number[] = [];
        for (const sv of evaluation.soft) {
          const g = (sv.minGapPct ?? 0) / 100;
          if (sv.offenderPrice > sv.comparatorPrice) {
            highSuggestions.push(Math.ceil(sv.comparatorPrice * (1 + g) * 100) / 100);
          } else {
            lowSuggestions.push(Math.floor(sv.comparatorPrice / (1 + g) * 100) / 100);
          }
        }
        let suggestedPrice: number;
        if (highSuggestions.length > 0 && lowSuggestions.length === 0) {
          suggestedPrice = Math.max(...highSuggestions);
        } else if (lowSuggestions.length > 0 && highSuggestions.length === 0) {
          suggestedPrice = Math.min(...lowSuggestions);
        } else {
          // Mixed directions (item is in the middle of a ladder, both ends narrow).
          // Pick the boundary closer to the proposed per-unit price.
          const proposed = perUnit(v, qty);
          const bestHigh = Math.max(...highSuggestions);
          const bestLow = Math.min(...lowSuggestions);
          suggestedPrice = Math.abs(proposed - bestHigh) < Math.abs(proposed - bestLow) ? bestHigh : bestLow;
        }
        setSoftProposal({ total: v, qty, evaluation, suggestedPrice });
        baseRejectedRef.current = true;
        return;
      }
      if (edlpEvaluation.soft.length > 0) {
        setEdlpSoftProposal({ total: v, qty, evaluation: edlpEvaluation });
        baseRejectedRef.current = true;
        return;
      }
    }
    setBaseValidationError(null);
    const prevPrice = item.newBasePrice ?? null;
    const prevQty = item.newBaseQty ?? undefined;
    updateBasePrice(item.id, v, qty);
    if (familyItems.length > 0 && v != null) {
      toast.success(`Updated the whole family (${familyItems.length + 1} items)`, {
        action: { label: "Undo", onClick: () => updateBasePrice(item.id, prevPrice, prevQty) },
      });
    }
  };

  // Validate and commit a retail price. Hard stops (zero/negative, at or above
  // base) show an inline error and keep the editor open. A discount greater than
  // 50% of the base parks the proposal and opens a soft-warning dialog.
  const commitRetail = (qty: number, price: number | null) => {
    if (!item) return;
    setRetailValidationError(null);
    retailRejectedRef.current = false;
    if (price == null) {
      updateRetailPrice(item.id, qty, null);
      return;
    }
    const baseRef = item.newBasePrice != null ? perUnit(item.newBasePrice, item.newBaseQty) : item.currentBasePrice;
    const unitPrice = perUnit(price, qty);
    if (unitPrice <= 0) {
      setRetailValidationError("Retail price must be greater than $0.00.");
      retailRejectedRef.current = true;
      return;
    }
    // A retail price equal to the base is not a discount — it must be strictly
    // lower. Shows the same inline error as the above-base case so the director
    // knows why and can correct the value.
    if (unitPrice >= baseRef) {
      setRetailValidationError(`Retail price must be lower than the base price (${fmt(baseRef)}).`);
      retailRejectedRef.current = true;
      return;
    }
    const discountPct = (baseRef - unitPrice) / baseRef;
    if (discountPct > 0.5) {
      setPendingRetailProposal({ qty, price, suggestedPrice: round2(baseRef * 0.9) });
      retailRejectedRef.current = true;
      return;
    }
    updateRetailPrice(item.id, qty, price);
  };

  // Resolve a blocked proposal by committing it AND repositioning the affected
  // SKUs by the same % — the ladder keeps its shape. Calls updateBasePrice
  // directly (not commitBase): scaled prices are NOT re-validated against
  // their own other relationships (single pass, accepted prototype limit) and
  // the family toast is suppressed in favor of one summary toast.
  const scaleBlocked = () => {
    if (!item || !blockedProposal) return;
    const { total, qty, evaluation } = blockedProposal;
    updateBasePrice(item.id, total, qty);
    const done = new Set(evaluation.changedIds);
    let scaled = 0;
    for (const id of evaluation.scaleTargets) {
      if (done.has(id)) continue;
      const target = itemsById.get(id);
      if (!target) continue;
      // The % applies to the live price; an existing pending edit on the
      // target is replaced in place (its batch membership is preserved).
      updateBasePrice(id, round2(target.currentBasePrice * (1 + evaluation.deltaPct)));
      scaled++;
      done.add(id);
      // A scaled family member propagates to its siblings — don't write twice.
      if (target.familyId) {
        for (const f of itemsById.values()) if (f.familyId === target.familyId) done.add(f.id);
      }
    }
    toast.success(
      `Price saved — scaled ${scaled} related SKU${scaled === 1 ? "" : "s"} by ${fmtSignedPct(evaluation.deltaPct)}`
    );
    setBlockedProposal(null);
    baseRejectedRef.current = false;
    setEditingBase(false);
  };

  // Commit the edited item's own PMR maximum instead of the proposed price —
  // the one-click fix offered by both EDLP ceiling modals. Only offered when
  // the edited item itself is the breaching member (see canUseMax in each
  // modal), so `find` below is guaranteed to hit.
  const applyEdlpMax = (evaluation: EdlpChangeEvaluation, qty: number | undefined, onDone: () => void) => {
    if (!item) return;
    const v = [...evaluation.hard, ...evaluation.soft].find((x) => x.itemId === item.id);
    if (!v) return;
    const total = qty != null && qty > 1 ? round2(v.maxAllowed * qty) : v.maxAllowed;
    const prevPrice = item.newBasePrice ?? null;
    const prevQty = item.newBaseQty ?? undefined;
    updateBasePrice(item.id, total, qty);
    if (familyItems.length > 0) {
      toast.success(`Price set to the EDLP maximum (${fmt(v.maxAllowed)}) — updated the whole family (${familyItems.length + 1} items)`, {
        action: { label: "Undo", onClick: () => updateBasePrice(item.id, prevPrice, prevQty) },
      });
    } else {
      toast.success(`Price set to the EDLP maximum (${fmt(v.maxAllowed)})`);
    }
    onDone();
  };

  // Revert one price field back to its current value. Base and retail are
  // independent changes, so each input reverts only its own. A pending (not-yet-
  // batched) edit reverts directly — cheap and reversible; once it's in a batch or
  // sent, confirm first.
  const inBatchOrSent = (s?: OverrideStatus) => s === "in_batch" || s === "submitted";
  const revertField = (field: "base" | "retail") => {
    if (!item) return;
    const status = field === "base" ? item.baseOverrideStatus : item.retailOverrideStatus;
    if (inBatchOrSent(status)) {
      setConfirmRevert(field);
      return;
    }
    // Family members share one price — reverting one member must revert them
    // all, or the family the UI advertises as "one price" falls out of sync.
    if (field === "base" && item.familyId) {
      updateBasePrice(item.id, null);
      return;
    }
    removeFromLooseTray(`${item.id}:${field}`);
  };

  // Exit the retail editing form without touching the committed state.
  // Two cases: (A) new promo — nothing committed yet, so revert the TA
  // type conversion startPromo() made and return to the "No promo" idle
  // state; (B) editing an existing promo — just close the form, keeping
  // the committed price. No confirmation needed in either case: A has no
  // committed data to lose; B explicitly preserves what's saved.
  const cancelRetailEditing = () => {
    if (item && item.newRetailPrice == null) {
      if (preConversionType != null) updatePriceType(item.id, preConversionType);
      updateRetailPrice(item.id, 1, null);
      setPreConversionType(null);
    }
    setChangingRetail(false);
    setRetailValidationError(null);
  };

  // Exit the base editing form without touching the committed state. If no
  // price was committed yet, clear any orphaned reason updateBasePrice may
  // have written.
  const cancelBaseEditing = () => {
    if (item && item.newBasePrice == null) {
      updateBasePrice(item.id, null);
    }
    setEditingBase(false);
    setBaseValidationError(null);
  };

  // Exit the fuel saver editing form without touching the committed state.
  // If no amount was committed yet, clear any orphaned reason/dates.
  const cancelFuelEditing = () => {
    if (item && (item.fuelSaver == null || item.fuelSaver <= 0)) {
      updateFuelSaver(item.id, null);
    }
    setEditingFuelSaver(false);
  };

  const status = item ? deriveItemStatus(item, batches) : null;

  // This item's not-yet-batched edits — the unit the footer batches or saves.
  const myPendingIds = item
    ? [
        item.baseOverrideStatus === "pending" ? `${item.id}:base` : null,
        item.retailOverrideStatus === "pending" ? `${item.id}:retail` : null,
      ].filter((x): x is string => x != null)
    : [];
  const hasPendingOverride = myPendingIds.length > 0;

  // This item's changes that already sit in a (scheduled) batch — surfaced so the
  // director can see WHERE it's queued and move it to another / a new batch.
  const inBatchIds = item
    ? [
        item.baseOverrideStatus === "in_batch" ? `${item.id}:base` : null,
        item.retailOverrideStatus === "in_batch" ? `${item.id}:retail` : null,
      ].filter((x): x is string => x != null)
    : [];
  const myBatch = inBatchIds.length > 0
    ? batches.find((b) => inBatchIds.some((id) => b.overrideIds.includes(id))) ?? null
    : null;

  // A decided section may not finish without a reason — no default, no silent
  // save. Computed here so Done and each section's Select agree on the state.
  const baseReasonMissing = item != null && item.newBasePrice != null && changeReasonFor(item, "base") == null;
  const retailReasonMissing = item != null && item.newRetailPrice != null && changeReasonFor(item, "retail") == null;
  const fuelReasonMissing =
    item != null && item.fuelSaver != null && item.fuelSaver > 0 && changeReasonFor(item, "fuel") == null;

  // Reject the Base recommendation — keep the current SAP price. Reversible,
  // and scoped to the Base section: a pending retail/fuel rec stays pending.
  const keepCurrent = () => {
    if (!item) return;
    const id = item.id;
    setSectionReviewed(id, "base", true);
    toast.success("Kept current price", {
      description: "Recommendation rejected — nothing sent to SAP.",
      action: { label: "Undo", onClick: () => setSectionReviewed(id, "base", false) },
    });
    // Close only when this was the item's last open decision — with a retail
    // or fuel rec still pending, the drawer stays so those keep their turn.
    if (!hqReviewNeeded({ ...item, baseReviewed: true })) advance();
  };

  // Finishing: a saved change isn't lost, but the director still owes one decision
  // — which batch (or none) it goes in. Rather than a cramped footer split-button,
  // ask in a small modal. Timing and change-reason are a hard-stop tier checked
  // BEFORE that prompt ever opens — no silent save with a missing "why"/"when".
  const handleDone = () => {
    // If a price commit was just rejected or parked for a dialog (base or retail)
    // in the same event flush, state hasn't re-rendered yet — read the refs.
    if (retailRejectedRef.current || baseRejectedRef.current) return;
    if (item) {
      // Each section's timing is required once that section has a decided
      // price/amount — same hard-stop tier as price validation. In practice
      // this only fires mid-edit (e.g. a promo range with a start picked but no
      // end yet): a decided/collapsed section always carries the default dates
      // the store seeds the moment the price/amount was set.
      const baseTimingMissing = item.newBasePrice != null && !item.baseEffectiveDate;
      const retailTimingMissing =
        item.newRetailPrice != null && (!item.allowanceStartDate || !item.allowanceEndDate);
      const fuelTimingMissing =
        item.fuelSaver != null && item.fuelSaver > 0 && (!item.fuelSaverStartDate || !item.fuelSaverEndDate);
      if (baseTimingMissing || retailTimingMissing || fuelTimingMissing) {
        // Never a silent no-op on the primary action: say what's missing and
        // bring the offending field into view (it carries aria-invalid).
        toast.error(
          baseTimingMissing
            ? "Pick the date the base price takes effect to finish."
            : retailTimingMissing
            ? "Pick a start and end date for the promo to finish."
            : "Pick a start and end date for the fuel saver to finish."
        );
        document
          .querySelector('[aria-invalid="true"]')
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      // Same hard-stop tier for the change reason: a decided price may not be
      // saved without one (no default fills it in silently).
      if (baseReasonMissing || retailReasonMissing || fuelReasonMissing) {
        setShowReasonErrors(true);
        // A decided (collapsed) section doesn't render its reason field —
        // reopen the offending form so the Select is on screen to fix.
        if (baseReasonMissing) setEditingBase(true);
        if (retailReasonMissing) setChangingRetail(true);
        if (fuelReasonMissing) setEditingFuelSaver(true);
        toast.error("Select a change reason to finish.");
        // The reopened form isn't in the DOM yet this flush — scroll next frame.
        requestAnimationFrame(() => {
          document
            .querySelector('[data-reason-missing="true"]')
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
        return;
      }
    }
    if (hasPendingOverride) setBatchPromptOpen(true);
    else handleClose();
  };
  const closeAfterBatch = () => {
    setBatchPromptOpen(false);
    onClose();
  };

  // The base (white-tag) price input — shown only once the director chooses to
  // edit. Shared by plain base, EDLP, and new/discontinued items.
  const baseInputBlock = () => {
    if (!item) return null;
    const priceLabel = item.category_type === "new_discontinued" ? intent?.priceLabel ?? "New base price" : "New base price";
    // The input's ghost placeholder = the value you'd most likely type: HQ's
    // proposal when one is pending (or a new item's suggested opening price),
    // otherwise the CURRENT price — never a stray recommendation the director
    // isn't acting on (which read as a confusing "$4.49" on a $4.29 item).
    const basePlaceholder = isNewItem || baseRecPending(item) ? item.recommendedBasePrice : item.currentBasePrice;
    return (
      <div className="flex flex-col gap-4">
        <Field label={priceLabel}>
          {isEdlp ? (
            // EDLP is a markdown decision — like a temporary allowance, the
            // director picks HOW to apply it (% off / $ off / exact).
            <BaseReductionField
              reference={item.currentBasePrice}
              recommended={basePlaceholder}
              value={item.newBasePrice}
              status={item.baseOverrideStatus}
              hasAlert={item.hasAlert}
              overEdlpMax={edlpCeilingState != null && edlpCeilingState.level !== "ok"}
              ariaLabel={priceLabel}
              onCommit={commitBase}
            />
          ) : (
            <>
              <BasePriceMethodField
                recommended={basePlaceholder}
                qty={item.newBaseQty ?? null}
                price={item.newBasePrice}
                status={item.baseOverrideStatus}
                hasAlert={item.hasAlert}
                onCommit={(qty, price) => commitBase(price, qty)}
              />
              {isHq && item.newBasePrice != null && (
                <p className="mt-1.5 text-xs tabular-nums text-gray-500">
                  HQ recommended {fmt(item.recommendedBasePrice)} · new price{" "}
                  <span className="font-medium text-gray-700">{fmtQtyPrice(item.newBaseQty, item.newBasePrice)}</span>
                </p>
              )}
            </>
          )}
          {baseValidationError && (
            <span className="text-xs font-medium text-red-500">
              {baseValidationError}
            </span>
          )}
        </Field>
        {(() => {
          // Base is open-ended — one Effective Date, no end. SAP's validity
          // end (12/31/9999) and NOW()-on-today are backend-only concerns
          // with no field here (see baseEffectiveDate).
          const baseDateMissing = item.newBasePrice != null && !item.baseEffectiveDate;
          return (
            <Field label="Effective date" required>
              <DatePickerField
                value={item.baseEffectiveDate}
                onChange={(d) => updateBaseEffectiveDate(item.id, d)}
                error={baseDateMissing}
                placeholder="Select a date"
                aria-label="Effective date"
                aria-describedby={baseDateMissing ? "base-effective-date-error" : undefined}
              />
              {baseDateMissing && (
                <span id="base-effective-date-error" className="text-xs font-medium text-red-500">
                  Pick the date this price takes effect.
                </span>
              )}
            </Field>
          );
        })()}
        {(() => {
          // Reason sits below the timing: what → when → why. HQ-originated
          // (accepted rec or custom price on a pending rec) seeds from HQ's
          // reason and re-picks from the HQ catalog; a declined-then-repriced
          // section is store-originated again.
          const hqOrigin = item.hqBaseReason != null && !item.baseReviewed;
          return (
            <ReasonSelect
              options={hqOrigin ? HQ_BASE_REASON_OPTIONS : STORE_BASE_REASON_OPTIONS}
              value={item.chosenBaseReason ?? (hqOrigin ? item.hqBaseReason! : "")}
              missing={showReasonErrors && baseReasonMissing}
              onChange={(v) => setBaseChangeReason(item.id, v as StoreBaseReason | HqBaseReason)}
            />
          );
        })()}
        {familyItems.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <Link2 className="size-3.5 text-brand" aria-hidden="true" /> Family price — updating this updates all {familyItems.length + 1} items in
            {" "}
            {item.priceFamilyName ? <>“{item.priceFamilyName}”</> : "the family"}
          </p>
        )}
        <div className="flex justify-end">
          <Button variant="tertiary" size="sm" onClick={cancelBaseEditing}>
            Cancel
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
    <Drawer
      open={item != null}
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
      title={item?.name ?? "Item"}
      size="lg"
      className="max-md:!w-full"
      headerActions={status ? <Badge tone={status.tone} size="sm">{status.label}</Badge> : undefined}
      footer={
        // The decision (accept / set a price / keep current) lives in the body now,
        // so the footer is just "Done". When a change is pending, Done asks where it
        // should go (a small batch prompt) instead of a cramped split-button.
        <div className="flex items-center justify-between gap-3">
          {hasPendingOverride ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600">
              <Check className="size-4 text-emerald-600" aria-hidden="true" />
              Change saved · add to a batch to send
            </span>
          ) : (
            <span />
          )}
          <Button variant="primary" onClick={handleDone}>
            Done
          </Button>
        </div>
      }
    >
      {item && (
        <div key={item.id} className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
              {item.image ? (
                <Image src={item.image} alt={item.name} width={64} height={64} className="object-cover" />
              ) : (
                <Package className="size-6 text-gray-300" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0 flex flex-col gap-1.5">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                <dt className="text-gray-400">SKU</dt>
                <dd className="font-medium tabular-nums text-gray-700">{item.id}</dd>
                <dt className="text-gray-400">Vendor</dt>
                <dd className="text-gray-700">{item.vendorName ?? item.brand}</dd>
                <dt className="text-gray-400">Unit cost</dt>
                <dd className="tabular-nums text-gray-700">
                  {fmt(item.cost)}
                </dd>
                {item.priceFamilyName && (
                  <>
                    <dt className="text-gray-400">Family</dt>
                    <dd className="text-gray-700">{item.priceFamilyName}</dd>
                  </>
                )}
              </dl>
              <div className="flex flex-wrap items-center gap-1">
                {hqReviewNeeded(item) && (
                  // Only sections still pending — a decided section's reason no
                  // longer advertises an open decision.
                  <HqBadge
                    reasons={[
                      baseRecPending(item) ? item.hqBaseReason : null,
                      retailRecPending(item) ? item.hqRetailReason : null,
                      fuelRecPending(item) ? item.hqFuelReason : null,
                    ].filter((r): r is NonNullable<typeof r> => r != null)}
                  />
                )}
                <Badge tone="neutral" size="sm">{item.itemRole}</Badge>
                {isEdlp && (
                  <Tooltip content="Everyday low price — a permanent markdown to stay consistently low.">
                    <span className="inline-flex cursor-default"><Badge tone="success" size="sm">EDLP</Badge></span>
                  </Tooltip>
                )}
                {item.isKvi && (
                  <Tooltip content="Key value item — a price shoppers know and compare; changes are high-visibility.">
                    <span className="inline-flex cursor-default"><Badge tone="warning" size="sm">KVI</Badge></span>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>

          <ShelfTagPreview key={`${item.id}-${item.newBasePrice ?? 'none'}-${item.newBaseQty ?? 1}`} item={item} />

          {sending && (
            <div className="-mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
              <Lock className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
              <span className="text-amber-900">
                Sent to SAP — locked until SAP confirms it. Nothing here can be changed yet.
              </span>
            </div>
          )}
          {/* Send failed — NOT locked: the price never made it to SAP, so the
              director can edit the price and re-submit via a batch. */}
          {item?.sendFailed && (
            <div className="-mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs">
              <AlertCircle className="size-4 shrink-0 text-red-600" aria-hidden="true" />
              <span className="text-red-900">
                Send failed — this price is <strong>not live in SAP</strong>. Edit it below and add it to a batch to retry.
              </span>
            </div>
          )}

          {/* Store-originated context: no HQ recommendation — the director reacts to a
              cost or competitor move directly. One line per signal the item carries.
              Purely informational (decoupled from Change Reason). */}
          {storeOrigin && (
            <div className="-mt-2 flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
              <Info className="size-4 shrink-0 text-brand" aria-hidden="true" />
              <div className="flex flex-col gap-1 text-gray-700">
                {item.storeSignals?.includes("cost_change") && (
                  <span>
                    <span className="font-medium text-gray-800">Cost change — </span>
                    unit cost is now <span className="tabular-nums">{fmt(item.cost)}</span>. Review the shelf price to protect margin.
                  </span>
                )}
                {item.storeSignals?.includes("competitor_move") && (() => {
                  const top = orderCompetitors(item.competitors ?? [], competitorOrder)[0];
                  return (
                    <span>
                      <span className="font-medium text-gray-800">Competitor move — </span>
                      {top
                        ? <>{top.name} is at <span className="tabular-nums">{fmt(top.price)}</span> nearby. Review your shelf price.</>
                        : "a nearby competitor moved. Review your shelf price."}
                    </span>
                  );
                })()}
              </div>
            </div>
          )}

          {myBatch && (
            <div className="-mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand/20 bg-brand/5 px-3 py-2.5">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                <span className="inline-flex items-center gap-1.5 text-gray-700">
                  <Package className="size-4 shrink-0 text-brand" aria-hidden="true" />
                  In batch <span className="font-medium text-gray-900">{myBatch.name}</span>
                </span>
                {myBatch.scheduledAt && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                    <CalendarClock className="size-3.5" aria-hidden="true" /> Sends {fmtDateTime(myBatch.scheduledAt)}
                  </span>
                )}
              </div>
              {/* Mixed state guard: one override can be in flight (sending) while the
                  other still sits in a batch. The sending lock covers the whole item,
                  so re-batching is disabled too — consistent with the lock banner. */}
              <Button variant="tertiary" size="sm" disabled={sending} onClick={() => setMovePickerOpen(true)}>
                Change batch
              </Button>
            </div>
          )}

          {(() => {
            const rec = item.recommendedBasePrice;
            const decided = item.newBasePrice != null;
            const baseHasRec = baseRecPending(item);
            const effectiveBase = decided ? perUnit(item.newBasePrice!, item.newBaseQty) : item.currentBasePrice;
            const baseRecRef = !baseHasRec && rec != null && Math.abs(rec - item.currentBasePrice) > 0.005 && Math.abs(effectiveBase - rec) > 0.005;
            return (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-gray-700">
                  Base price <span className="font-normal text-gray-400">· white tag</span>
                </h3>
                <div className={`rounded-xl border border-gray-200 bg-gray-50 px-4 py-3${item.sendFailed ? " ring-2 ring-orange-300" : ""}`}>
                  {baseLocked ? (
                    // Sent to SAP — read-only until SAP confirms. Show the change if
                    // there is one, otherwise just the (unchanged) current price.
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm tabular-nums">
                        <Lock className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
                        {item.newBasePrice != null ? (
                          <>
                            <span className="text-gray-400 line-through">{fmt(item.currentBasePrice)}</span>
                            <span aria-hidden="true" className="text-gray-300">→</span>
                            <span className="text-base font-semibold text-gray-900">{fmtQtyPrice(item.newBaseQty, item.newBasePrice)}</span>
                          </>
                        ) : (
                          <span className="text-base font-semibold text-gray-900">{fmt(item.currentBasePrice)}</span>
                        )}
                      </div>
                      <span className="text-xs font-medium text-gray-500">Locked</span>
                    </div>
                  ) : editingBase ? (
                    baseInputBlock()
                  ) : decided ? (
                    <>
                    <div className="decision-pop flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 text-sm tabular-nums">
                          <Check className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                          {!isNewItem && (
                            <>
                              <span className="text-gray-400 line-through">{fmt(item.currentBasePrice)}</span>
                              <span aria-hidden="true" className="text-gray-300">→</span>
                            </>
                          )}
                          <span className="text-base font-semibold text-gray-900">{fmtQtyPrice(item.newBaseQty, item.newBasePrice ?? item.currentBasePrice)}</span>
                        </div>
                        {(() => {
                          const reason = changeReasonFor(item, "base");
                          if (!reason) return null;
                          return <p className="pl-6 text-xs text-gray-400">reason · <span className="font-medium text-gray-600">{REASON_META[reason].label}</span></p>;
                        })()}
                        {fmtEffectiveDate(item.baseEffectiveDate) && (
                          <span className="flex items-center gap-1 pl-6 text-xs text-gray-500">
                            <CalendarClock className="size-3 shrink-0 text-gray-400" aria-hidden="true" />
                            {fmtEffectiveDate(item.baseEffectiveDate)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button variant="secondary" size="sm" iconLeft={Pencil} onClick={() => setEditingBase(true)}>Change</Button>
                        <Button
                          variant="tertiary"
                          size="sm"
                          iconLeft={RotateCcw}
                          onClick={() => { revertField("base"); setEditingBase(false); }}
                        >
                          Revert
                        </Button>
                      </div>
                    </div>
                    {rec != null && baseRecRef && <HqRef price={rec} reasonKey={item.hqBaseReason} />}
                    </>
                  ) : baseHasRec ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-baseline gap-2 text-sm tabular-nums">
                        <span className="text-gray-500">Current {fmt(item.currentBasePrice)}</span>
                        <span aria-hidden="true" className="text-gray-300">→</span>
                        <span className="font-semibold text-gray-900">HQ recommends {fmt(rec)}</span>
                      </div>
                      {item.hqBaseReason && (
                        <p className="text-xs text-gray-400">reason · <span className="font-medium text-gray-600">{REASON_META[item.hqBaseReason].label}</span></p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="primary" size="sm" iconLeft={Check} onClick={() => commitBase(rec)}>
                          Accept {fmt(rec)}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => setEditingBase(true)}>
                          Set a different price
                        </Button>
                        <Button variant="secondary" size="sm" onClick={keepCurrent}>
                          Keep current
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                    <div className="flex items-center justify-between gap-3">
                      {isNewItem ? (
                        <span className="text-sm text-gray-600">{intent?.helper ?? "Set the opening price."}</span>
                      ) : (
                        <div className="flex items-baseline gap-2 tabular-nums">
                          <span className="text-xs text-gray-500">Current price</span>
                          <span className="text-base font-semibold text-gray-900">{fmt(item.currentBasePrice)}</span>
                        </div>
                      )}
                      <Button variant="secondary" size="sm" iconLeft={Pencil} onClick={() => setEditingBase(true)}>
                        {isNewItem ? "Set price" : "Change price"}
                      </Button>
                    </div>
                    {rec != null && baseRecRef && <HqRef price={rec} reasonKey={item.hqBaseReason} />}
                    </>
                  )}
                  {softWarnings.length > 0 && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
                      <AlertTriangle className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
                      <div className="flex flex-col gap-1 tabular-nums text-amber-900">
                        {softWarnings.map((w) => (
                          <span key={`${w.relationship.id}:${w.offenderId}:${w.comparatorId}`}>{w.message}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {edlpCeilingState && edlpCeilingState.level === "hard" && (
                    // A committed price already past the hard stop with no exception —
                    // predates the guardrail; new commits at this level are blocked.
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs">
                      <AlertCircle className="size-4 shrink-0 text-red-600" aria-hidden="true" />
                      <span className="tabular-nums text-red-900">
                        Exceeds the +10% hard ceiling ({fmt(edlpCeilingState.hardCeiling)}) over the SAP PMR maximum ({fmt(edlpCeilingState.maxAllowed)}) — contact AVP – Pricing for a store-level exception.
                      </span>
                    </div>
                  )}
                  {edlpCeilingState && edlpCeilingState.level === "soft" && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
                      <AlertTriangle className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
                      <span className="tabular-nums text-amber-900">
                        {edlpCeilingState.overHardCeiling
                          ? <>Covered by a store exception — priced above the SAP PMR maximum ({fmt(edlpCeilingState.maxAllowed)}), over the hard ceiling ({fmt(edlpCeilingState.hardCeiling)}).</>
                          : <>Priced above the SAP PMR maximum ({fmt(edlpCeilingState.maxAllowed)}) — within the +10% allowance ({fmt(edlpCeilingState.hardCeiling)}).</>}
                      </span>
                    </div>
                  )}
                </div>
              </section>
            );
          })()}

          {(() => {
            const recRetail = item.recommendedRetailPrice ?? item.currentBasePrice;
            // % / $ reductions are taken off the base (white-tag) price — the new
            // base if the director set one, otherwise the current base. A pack-size
            // base ("3 for $6.00") reduces off its per-unit price.
            const baseRef = item.newBasePrice != null ? perUnit(item.newBasePrice, item.newBaseQty) : item.currentBasePrice;
            const curRetail = item.currentRetailPrice ?? item.currentBasePrice;
            const retailDecided = item.newRetailPrice != null;
            // Accept-first only for a TA whose HQ promo rec is still undecided.
            const retailHasRec = retailRecPending(item);
            const acceptFirst = retailHasRec && !changingRetail && !retailDecided;
            const effectiveRetail = retailDecided ? perUnit(item.newRetailPrice!, item.newRetailQty ?? 1) : curRetail;
            const retailRecRef = isTemp && !retailHasRec && item.recommendedRetailPrice != null && Math.abs(effectiveRetail - item.recommendedRetailPrice) > 0.005;
            // A plain item gets converted to a TA the moment a promo is set.
            // Remember the original type so handleClose can revert it if the
            // director closes without committing a price.
            const startPromo = () => {
              if (!isTemp) {
                setPreConversionType(item.category_type);
                updatePriceType(item.id, "temporary_allowance");
              }
              setChangingRetail(true);
            };
            return (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-gray-700">
                  Retail price <span className="font-normal text-gray-400">· yellow tag</span>
                </h3>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="flex flex-col gap-4">
                    {retailLocked ? (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2 text-sm tabular-nums">
                            <Lock className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
                            {item.newRetailPrice != null ? (
                              <>
                                <span className="text-gray-400 line-through">{fmt(curRetail)}</span>
                                <span aria-hidden="true" className="text-gray-300">→</span>
                                <span className="text-base font-semibold text-gray-900">{fmtQtyPrice(item.newRetailQty, item.newRetailPrice)}</span>
                              </>
                            ) : (
                              <span className="text-base font-semibold text-gray-900">{isTemp ? fmt(curRetail) : "No promo"}</span>
                            )}
                          </div>
                          {item.newRetailPrice != null && fmtDateRange(item.allowanceStartDate, item.allowanceEndDate) && (
                            <span className="flex items-center gap-1 pl-6 text-xs text-gray-500">
                              <CalendarClock className="size-3 shrink-0 text-gray-400" aria-hidden="true" />
                              {fmtDateRange(item.allowanceStartDate, item.allowanceEndDate)}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-medium text-gray-500">Locked</span>
                      </div>
                    ) : acceptFirst ? (
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-baseline gap-2 text-sm tabular-nums">
                          <span className="text-gray-500">Current {fmt(curRetail)}</span>
                          <span aria-hidden="true" className="text-gray-300">→</span>
                          <span className="font-semibold text-gray-900">HQ recommends {fmt(recRetail)}</span>
                        </div>
                        {item.hqRetailReason && (
                          <p className="text-xs text-gray-400">reason · <span className="font-medium text-gray-600">{REASON_META[item.hqRetailReason].label}</span></p>
                        )}
                        {hqRecRationale(item, "retail") && (
                          <p className="text-sm text-gray-600">{hqRecRationale(item, "retail")}</p>
                        )}
                        <div className="decision-pop flex flex-wrap items-center gap-2">
                          <Button variant="primary" size="sm" iconLeft={Check} onClick={() => updateRetailPrice(item.id, 1, recRetail)}>
                            Accept {fmt(recRetail)}
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => setChangingRetail(true)}>
                            Set a different price
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => {
                            setSectionReviewed(item.id, "retail", true);
                            toast.success("No promotion", {
                              description: "HQ recommendation declined — no yellow ticket.",
                              action: { label: "Undo", onClick: () => setSectionReviewed(item.id, "retail", false) },
                            });
                          }}>
                            No promotion
                          </Button>
                        </div>
                      </div>
                    ) : retailDecided && !changingRetail ? (
                      <>
                      <div className="decision-pop flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2 text-sm tabular-nums">
                            <Check className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                            <span className="text-gray-400 line-through">{fmt(curRetail)}</span>
                            <span aria-hidden="true" className="text-gray-300">→</span>
                            <span className="text-base font-semibold text-gray-900">{fmtQtyPrice(item.newRetailQty, item.newRetailPrice ?? curRetail)}</span>
                          </div>
                          {(() => {
                            const reason = changeReasonFor(item, "retail");
                            if (!reason) return null;
                            return <p className="pl-6 text-xs text-gray-400">reason · <span className="font-medium text-gray-600">{REASON_META[reason].label}</span></p>;
                          })()}
                          {fmtDateRange(item.allowanceStartDate, item.allowanceEndDate) && (
                            <span className="flex items-center gap-1 pl-6 text-xs text-gray-500">
                              <CalendarClock className="size-3 shrink-0 text-gray-400" aria-hidden="true" />
                              {fmtDateRange(item.allowanceStartDate, item.allowanceEndDate)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button variant="secondary" size="sm" iconLeft={Pencil} onClick={() => setChangingRetail(true)}>Change</Button>
                          {(() => {
                            // One undo-affordance rule across sections: "Revert"
                            // (RotateCcw) restores a prior live value; "Remove"
                            // (Trash2) deletes an additive promo that had none.
                            // A promo newly created on a non-TA item
                            // (retailAutoTypedFrom remembers the conversion) has
                            // no prior TPR, so undoing it is a removal back to
                            // "No promo".
                            const isRemoval = item.retailAutoTypedFrom != null;
                            return (
                              <Button
                                variant="tertiary"
                                size="sm"
                                iconLeft={isRemoval ? Trash2 : RotateCcw}
                                onClick={() => revertField("retail")}
                              >
                                {isRemoval ? "Remove" : "Revert"}
                              </Button>
                            );
                          })()}
                        </div>
                      </div>
                      {item.recommendedRetailPrice != null && retailRecRef && <HqRef price={item.recommendedRetailPrice} reasonKey={item.hqRetailReason} />}
                      </>
                    ) : !changingRetail ? (
                      <>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-baseline gap-2 tabular-nums">
                          <span className="text-xs text-gray-500">{isTemp ? "Current" : "No promo"}</span>
                          <span className="text-base font-semibold text-gray-900">{isTemp ? fmt(curRetail) : "—"}</span>
                        </div>
                        <Button variant="secondary" size="sm" iconLeft={Pencil} onClick={startPromo}>
                          Set promo price
                        </Button>
                      </div>
                      {item.recommendedRetailPrice != null && retailRecRef && <HqRef price={item.recommendedRetailPrice} reasonKey={item.hqRetailReason} />}
                      </>
                    ) : (
                      <>
                        <Field
                          label="New retail price"
                        >
                          <RetailReductionField
                            baseReference={baseRef}
                            recommendedPrice={retailHasRec ? recRetail : curRetail}
                            qty={item.newRetailQty ?? null}
                            price={item.newRetailPrice ?? null}
                            status={item.retailOverrideStatus}
                            onCommit={(qty, price) => commitRetail(qty, price)}
                          />
                          {retailValidationError && (
                            <span className="text-xs font-medium text-red-500">
                              {retailValidationError}
                            </span>
                          )}
                          {item.recommendedRetailPrice != null && item.newRetailPrice != null && Math.abs(perUnit(item.newRetailPrice, item.newRetailQty ?? 1) - item.recommendedRetailPrice) > 0.005 && (
                            <p className="mt-1.5 text-xs tabular-nums text-gray-500">
                              HQ recommended {fmt(item.recommendedRetailPrice)} · new price{" "}
                              <span className="font-medium text-gray-700">{fmtQtyPrice(item.newRetailQty, item.newRetailPrice)}</span>
                            </p>
                          )}
                        </Field>

                        {(() => {
                          // A promo must carry a date range — flag it required and
                          // show the error state until both ends are picked.
                          const promoDatesMissing =
                            item.newRetailPrice != null &&
                            (!item.allowanceStartDate || !item.allowanceEndDate);
                          // >14 days is a non-blocking heads-up, not a validation
                          // error — Retail and Fuel Saver may run long promos and
                          // may overlap each other freely; this is advisory only.
                          const promoDays = promoDurationDays(item.allowanceStartDate, item.allowanceEndDate);
                          const isLongPromo = promoDays != null && promoDays > 14;
                          return (
                            <Field label="Promo period" required>
                              <DateRangeField
                                start={item.allowanceStartDate}
                                end={item.allowanceEndDate}
                                onChange={(s, e) => updateAllowanceDates(item.id, s, e)}
                                error={promoDatesMissing}
                                aria-label="Promo date range"
                                aria-describedby={promoDatesMissing ? "promo-period-error" : undefined}
                              />
                              {promoDatesMissing && (
                                <span id="promo-period-error" className="text-xs font-medium text-red-500">
                                  Pick a start and end date for the promo.
                                </span>
                              )}
                              {isLongPromo && <LongPromoNotice days={promoDays!} />}
                            </Field>
                          );
                        })()}
                        {(() => {
                          // Reason below the timing — same what → when → why
                          // order as the base form, editable even when HQ's
                          // reason seeded it.
                          const hqOrigin = item.hqRetailReason != null && !item.retailReviewed;
                          return (
                            <ReasonSelect
                              options={hqOrigin ? HQ_PROMO_REASON_OPTIONS : STORE_PROMO_REASON_OPTIONS}
                              value={item.chosenRetailReason ?? (hqOrigin ? item.hqRetailReason! : "")}
                              missing={showReasonErrors && retailReasonMissing}
                              onChange={(v) => setRetailChangeReason(item.id, v as StorePromoReason | HqPromoReason)}
                            />
                          );
                        })()}
                        <div className="flex justify-end">
                          <Button variant="tertiary" size="sm" onClick={cancelRetailEditing}>
                            Cancel
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </section>
            );
          })()}

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-gray-700">Fuel saver</h3>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              {sending ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2 text-sm tabular-nums">
                      <Lock className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
                      {item.fuelSaver != null && item.fuelSaver > 0 ? (
                        <span className="text-base font-semibold text-gray-900">+{fmt(item.fuelSaver)} fuel</span>
                      ) : (
                        <span className="text-gray-500">No fuel saver</span>
                      )}
                    </div>
                    {item.fuelSaver != null && item.fuelSaver > 0 && fmtDateRange(item.fuelSaverStartDate, item.fuelSaverEndDate) && (
                      <span className="flex items-center gap-1 pl-6 text-xs text-gray-500">
                        <CalendarClock className="size-3 shrink-0 text-gray-400" aria-hidden="true" />
                        {fmtDateRange(item.fuelSaverStartDate, item.fuelSaverEndDate)}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-medium text-gray-500">Locked</span>
                </div>
              ) : (() => {
                const fuelDecided = item.fuelSaver != null && item.fuelSaver > 0;
                const fuelHadPrior = item.currentFuelSaver != null && item.currentFuelSaver > 0;
                const fuelPeriod = fmtDateRange(item.fuelSaverStartDate, item.fuelSaverEndDate);
                // Accept-first for an undecided HQ fuel-saver rec — same why →
                // what → decide unit as base/retail, so a fuel reason advertised
                // in the table/badge is always actionable here.
                const fuelRec = fuelRecPending(item) ? item.recommendedFuelSaver! : null;
                const fuelRecAmt = item.recommendedFuelSaver != null && item.recommendedFuelSaver > 0 ? item.recommendedFuelSaver : null;
                const effectiveFuel = fuelDecided ? (item.fuelSaver ?? 0) : (fuelHadPrior ? (item.currentFuelSaver ?? 0) : 0);
                const fuelRecRef = !fuelRecPending(item) && fuelRecAmt != null && Math.abs(effectiveFuel - fuelRecAmt) > 0.005;
                if (!editingFuelSaver && !fuelDecided && fuelRec != null) {
                  return (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-baseline gap-2 text-sm tabular-nums">
                        <span className="text-gray-500">
                          Current {fuelHadPrior ? `+${fmt(item.currentFuelSaver ?? 0)}` : "none"}
                        </span>
                        <span aria-hidden="true" className="text-gray-300">→</span>
                        <span className="font-semibold text-gray-900">HQ recommends +{fmt(fuelRec)} fuel</span>
                      </div>
                      {item.hqFuelReason && (
                        <p className="text-xs text-gray-400">reason · <span className="font-medium text-gray-600">{REASON_META[item.hqFuelReason].label}</span></p>
                      )}
                      <div className="decision-pop flex flex-wrap items-center gap-2">
                        <Button variant="primary" size="sm" iconLeft={Check} onClick={() => updateFuelSaver(item.id, fuelRec)}>
                          Accept +{fmt(fuelRec)}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => setEditingFuelSaver(true)}>
                          Set a different amount
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => {
                          setSectionReviewed(item.id, "fuel", true);
                          toast.success("No fuel saver", {
                            description: "HQ recommendation declined.",
                            action: { label: "Undo", onClick: () => setSectionReviewed(item.id, "fuel", false) },
                          });
                        }}>
                          No fuel saver
                        </Button>
                      </div>
                    </div>
                  );
                }
                if (!editingFuelSaver) {
                  return fuelDecided ? (
                    <>
                    <div className="decision-pop flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 text-sm tabular-nums">
                          <Check className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                          {fuelHadPrior && (
                            <>
                              <span className="text-gray-400 line-through">+{fmt(item.currentFuelSaver ?? 0)}</span>
                              <span aria-hidden="true" className="text-gray-300">→</span>
                            </>
                          )}
                          <span className="text-base font-semibold text-gray-900">+{fmt(item.fuelSaver ?? 0)} fuel</span>
                        </div>
                        {(() => {
                          const reason = changeReasonFor(item, "fuel");
                          if (!reason) return null;
                          return <p className="pl-6 text-xs text-gray-400">reason · <span className="font-medium text-gray-600">{REASON_META[reason].label}</span></p>;
                        })()}
                        {fuelPeriod && (
                          <span className="flex items-center gap-1 pl-6 text-xs text-gray-500">
                            <CalendarClock className="size-3 shrink-0 text-gray-400" aria-hidden="true" />
                            {fuelPeriod}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button variant="secondary" size="sm" iconLeft={Pencil} onClick={() => setEditingFuelSaver(true)}>Change</Button>
                        <Button
                          variant="tertiary"
                          size="sm"
                          iconLeft={Trash2}
                          onClick={() => updateFuelSaver(item.id, null)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                    {fuelRecAmt != null && fuelRecRef && <HqRef price={fuelRecAmt} reasonKey={item.hqFuelReason} prefix="+" suffix=" fuel" />}
                    </>
                  ) : (
                    <>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-baseline gap-2 tabular-nums">
                        <span className="text-xs text-gray-500">No fuel saver</span>
                        <span className="text-base font-semibold text-gray-900">{fmt(0)}</span>
                      </div>
                      <Button variant="secondary" size="sm" iconLeft={Pencil} onClick={() => setEditingFuelSaver(true)}>
                        Add fuel saver
                      </Button>
                    </div>
                    {fuelRecAmt != null && fuelRecRef && <HqRef price={fuelRecAmt} reasonKey={item.hqFuelReason} prefix="+" suffix=" fuel" />}
                    </>
                  );
                }
                return (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Select
                        options={FUEL_SAVER_OPTIONS}
                        value={fuelSaverSelectValue(item.fuelSaver)}
                        onChange={(v) => {
                          if (v === '0.00' || v === '0' || parseFloat(v as string) === 0) {
                            updateFuelSaver(item.id, null);
                            setEditingFuelSaver(false);
                          } else {
                            updateFuelSaver(item.id, parseFloat(v as string));
                          }
                        }}
                        label="Fuel saver"
                        size="sm"
                      />
                      {fuelRecAmt != null && fuelDecided && Math.abs((item.fuelSaver ?? 0) - fuelRecAmt) > 0.005 && (
                        <p className="text-xs tabular-nums text-gray-500">
                          HQ recommended +{fmt(fuelRecAmt)} · adding{" "}
                          <span className="font-medium text-gray-700">+{fmt(item.fuelSaver ?? 0)} fuel</span>
                        </p>
                      )}
                    </div>
                    {fuelDecided && (() => {
                      // Same required-period model as Retail's promo period —
                      // a fuel saver must carry a start + end window too.
                      const fuelDatesMissing = !item.fuelSaverStartDate || !item.fuelSaverEndDate;
                      // >14 days is advisory only — Fuel Saver and Retail may
                      // overlap and either may run long with no blocking check.
                      const fuelDays = promoDurationDays(item.fuelSaverStartDate, item.fuelSaverEndDate);
                      const isLongPromo = fuelDays != null && fuelDays > 14;
                      return (
                        <Field label="Fuel saver period" required>
                          <DateRangeField
                            start={item.fuelSaverStartDate}
                            end={item.fuelSaverEndDate}
                            onChange={(s, e) => updateFuelSaverDates(item.id, s, e)}
                            error={fuelDatesMissing}
                            aria-label="Fuel saver date range"
                            aria-describedby={fuelDatesMissing ? "fuel-period-error" : undefined}
                          />
                          {fuelDatesMissing && (
                            <span id="fuel-period-error" className="text-xs font-medium text-red-500">
                              Pick a start and end date for the fuel saver.
                            </span>
                          )}
                          {isLongPromo && <LongPromoNotice days={fuelDays!} />}
                        </Field>
                      );
                    })()}
                    {fuelDecided && (() => {
                      // Reason below the timing — same what → when → why order
                      // as the base and retail forms, editable even when HQ's
                      // reason seeded it. Gated (like the period field) on an
                      // amount being chosen: a reason is only required once
                      // fuelSaver > 0, so a required-marked "why" must not
                      // appear while the amount still reads "None".
                      const hqOrigin = item.hqFuelReason != null && !item.fuelReviewed;
                      return (
                        <ReasonSelect
                          options={hqOrigin ? HQ_PROMO_REASON_OPTIONS : STORE_PROMO_REASON_OPTIONS}
                          value={item.chosenFuelReason ?? (hqOrigin ? item.hqFuelReason! : "")}
                          missing={showReasonErrors && fuelReasonMissing}
                          onChange={(v) => setFuelChangeReason(item.id, v as StorePromoReason | HqPromoReason)}
                        />
                      );
                    })()}
                    <div className="flex justify-end">
                      <Button variant="tertiary" size="sm" onClick={cancelFuelEditing}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </section>

          <ProductRelationships item={item} itemsById={itemsById} relatedFallback={relatedItems} softViolations={softWarnings} />

          <CollapsibleSection title="Projected impact">
            {(() => {
              if (isTemp) {
                const curRetail = item.currentRetailPrice ?? item.currentBasePrice;
                const allowanceCost = item.allowanceCost ?? item.cost;
                const u =
                  item.newRetailPrice != null
                    ? item.newRetailPrice / Math.max(1, item.newRetailQty ?? 1)
                    : (retailRecPending(item) ? item.recommendedRetailPrice : null) ?? curRetail;
                const fuel = item.fuelSaver ?? 0;
                return (
                  <div className="mb-3 flex flex-col gap-2 border-b border-gray-100 pb-3">
                    <MarginRow label="Retail margin" current={grossMarginPct(curRetail, allowanceCost)} next={grossMarginPct(u, allowanceCost)} />
                    {fuel > 0 && (
                      <MarginRow label="Incl. fuel saver" current={grossMarginPct(curRetail, allowanceCost)} next={grossMarginPct(u - fuel, allowanceCost)} />
                    )}
                  </div>
                );
              }
              return (
                <div className="mb-3 flex flex-col gap-2 border-b border-gray-100 pb-3">
                  <MarginRow
                    label="Gross margin"
                    current={grossMarginPct(item.currentBasePrice, item.cost)}
                    next={grossMarginPct(item.newBasePrice != null ? perUnit(item.newBasePrice, item.newBaseQty) : baseRecPending(item) ? item.recommendedBasePrice : item.currentBasePrice, item.cost)}
                  />
                </div>
              );
            })()}
            <ImpactBreakdown item={item} />
          </CollapsibleSection>

          {item.competitors && item.competitors.length > 0 && (() => {
            // Compare per-unit — a pack-size base competes on its unit price.
            const ourPrice = item.newBasePrice != null ? perUnit(item.newBasePrice, item.newBaseQty) : item.currentBasePrice;
            return (
              <CollapsibleSection title="Competitor prices" count={item.competitors.length}>
                <div className="-mx-4 -my-3">
                  <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50">
                    <span className="text-xs font-medium text-gray-500">Our price</span>
                    <span className="text-sm font-semibold tabular-nums text-gray-900">{fmt(ourPrice)}</span>
                  </div>
                  {orderCompetitors(item.competitors, competitorOrder).map((c) => {
                    const diff = ourPrice - c.price;
                    return (
                      <div key={c.name} className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-100 last:border-0">
                        <div className="min-w-0">
                          <span className="text-sm text-gray-700">{c.name}</span>
                          {c.distanceMi != null && <span className="ml-2 text-xs text-gray-500">{c.distanceMi} mi</span>}
                        </div>
                        <div className="flex items-center gap-2 tabular-nums">
                          <span className="text-sm text-gray-700">{fmt(c.price)}</span>
                          <span className={`w-24 text-right text-xs font-medium ${diff > 0 ? "text-red-600" : diff < 0 ? "text-emerald-600" : "text-gray-500"}`}>
                            {diff > 0 ? `+${fmt(diff)} higher` : diff < 0 ? `${fmt(diff)} lower` : "matches"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleSection>
            );
          })()}

        </div>
      )}
    </Drawer>
    <BlockedPriceChangeModal
      open={blockedProposal != null}
      evaluation={blockedProposal?.evaluation ?? null}
      itemsById={itemsById}
      onRevert={() => {
        // Nothing was committed — collapsing the editor drops the stale draft.
        setBlockedProposal(null);
        baseRejectedRef.current = false;
        setEditingBase(false);
      }}
      onScale={scaleBlocked}
    />
    <RetailPriceWarningModal
      open={pendingRetailProposal != null}
      proposedQty={pendingRetailProposal?.qty ?? 1}
      proposedPrice={pendingRetailProposal?.price ?? 0}
      suggestedPrice={pendingRetailProposal?.suggestedPrice ?? 0}
      onCancel={() => { setPendingRetailProposal(null); retailRejectedRef.current = false; }}
      onUseSuggested={() => {
        if (!item || !pendingRetailProposal) return;
        updateRetailPrice(item.id, 1, pendingRetailProposal.suggestedPrice);
        setPendingRetailProposal(null);
        retailRejectedRef.current = false;
      }}
      onProceed={() => {
        if (!item || !pendingRetailProposal) return;
        updateRetailPrice(item.id, pendingRetailProposal.qty, pendingRetailProposal.price);
        setPendingRetailProposal(null);
        retailRejectedRef.current = false;
      }}
    />
    <BasePriceSoftWarningModal
      open={softProposal != null}
      evaluation={softProposal?.evaluation ?? null}
      proposedPrice={perUnit(softProposal?.total ?? 0, softProposal?.qty)}
      suggestedPrice={softProposal?.suggestedPrice ?? 0}
      itemsById={itemsById}
      onCancel={() => { setSoftProposal(null); baseRejectedRef.current = false; setEditingBase(false); }}
      onUseSuggested={() => {
        if (!item || !softProposal) return;
        const prevPrice = item.newBasePrice ?? null;
        const prevQty = item.newBaseQty ?? undefined;
        updateBasePrice(item.id, softProposal.suggestedPrice);
        if (familyItems.length > 0) {
          toast.success(`Updated the whole family (${familyItems.length + 1} items)`, {
            action: { label: "Undo", onClick: () => updateBasePrice(item.id, prevPrice, prevQty) },
          });
        }
        setSoftProposal(null);
        baseRejectedRef.current = false;
      }}
      onProceed={() => {
        if (!item || !softProposal) return;
        const prevPrice = item.newBasePrice ?? null;
        const prevQty = item.newBaseQty ?? undefined;
        updateBasePrice(item.id, softProposal.total, softProposal.qty);
        if (familyItems.length > 0) {
          toast.success(`Updated the whole family (${familyItems.length + 1} items)`, {
            action: { label: "Undo", onClick: () => updateBasePrice(item.id, prevPrice, prevQty) },
          });
        }
        setSoftProposal(null);
        baseRejectedRef.current = false;
      }}
    />
    <EdlpCeilingBlockedModal
      open={edlpBlockedProposal != null}
      evaluation={edlpBlockedProposal?.evaluation ?? null}
      editedItemId={item?.id ?? null}
      onRevert={() => {
        // Nothing was committed — collapsing the editor drops the stale draft.
        setEdlpBlockedProposal(null);
        baseRejectedRef.current = false;
        setEditingBase(false);
      }}
      onUseMax={() => {
        if (!edlpBlockedProposal) return;
        applyEdlpMax(edlpBlockedProposal.evaluation, edlpBlockedProposal.qty, () => {
          setEdlpBlockedProposal(null);
          baseRejectedRef.current = false;
          setEditingBase(false);
        });
      }}
    />
    <EdlpCeilingWarningModal
      open={edlpSoftProposal != null}
      evaluation={edlpSoftProposal?.evaluation ?? null}
      proposedPrice={perUnit(edlpSoftProposal?.total ?? 0, edlpSoftProposal?.qty)}
      editedItemId={item?.id ?? null}
      onCancel={() => { setEdlpSoftProposal(null); baseRejectedRef.current = false; setEditingBase(false); }}
      onUseMax={() => {
        if (!edlpSoftProposal) return;
        applyEdlpMax(edlpSoftProposal.evaluation, edlpSoftProposal.qty, () => {
          setEdlpSoftProposal(null);
          baseRejectedRef.current = false;
        });
      }}
      onProceed={() => {
        if (!item || !edlpSoftProposal) return;
        const prevPrice = item.newBasePrice ?? null;
        const prevQty = item.newBaseQty ?? undefined;
        updateBasePrice(item.id, edlpSoftProposal.total, edlpSoftProposal.qty);
        if (familyItems.length > 0) {
          toast.success(`Updated the whole family (${familyItems.length + 1} items)`, {
            action: { label: "Undo", onClick: () => updateBasePrice(item.id, prevPrice, prevQty) },
          });
        }
        setEdlpSoftProposal(null);
        baseRejectedRef.current = false;
      }}
    />
    <ConfirmDialog
      open={confirmRevert != null}
      onOpenChange={(o) => { if (!o) setConfirmRevert(null); }}
      headline="Revert this price change?"
      description={
        item
          ? confirmRevert === "base" && familyItems.length > 0
            ? `All ${familyItems.length + 1} items in ${item.priceFamilyName ? `“${item.priceFamilyName}”` : "this family"} return to their current base price and leave their batch.`
            : `${item.name} returns to its current ${confirmRevert === "retail" ? "retail" : "base"} price and leaves its batch.`
          : undefined
      }
      confirmLabel="Revert"
      destructive
      onConfirm={() => {
        if (!item || !confirmRevert) return;
        if (confirmRevert === "base" && item.familyId) updateBasePrice(item.id, null);
        else removeFromLooseTray(`${item.id}:${confirmRevert}`);
      }}
    />

    <BatchPickerModal
      open={batchPromptOpen}
      onOpenChange={(o) => { if (!o) setBatchPromptOpen(false); }}
      description="Your change is saved. Add it to a scheduled batch to control when it reaches SAP."
      openBatches={openBatches}
      count={new Set(myPendingIds.map((id) => id.split(":")[0])).size}
      onAddToBatch={(id) => { onAddToBatch(id, myPendingIds); closeAfterBatch(); }}
      onNewBatch={() => { onNewBatch(myPendingIds); closeAfterBatch(); }}
    />

    <BatchPickerModal
      open={movePickerOpen}
      onOpenChange={(o) => { if (!o) setMovePickerOpen(false); }}
      title="Change batch"
      description="Move this change to a different scheduled batch, or create a new one."
      openBatches={openBatches.filter((b) => b.id !== myBatch?.id)}
      count={1}
      onAddToBatch={(id) => {
        inBatchIds.forEach((oid) => moveOverrideToBatch(oid, id));
        const name = batches.find((b) => b.id === id)?.name ?? "batch";
        toast.success(`Moved to ${name}`);
        setMovePickerOpen(false);
      }}
      onNewBatch={() => { onNewBatch(inBatchIds); setMovePickerOpen(false); }}
    />
    </>
  );
}
