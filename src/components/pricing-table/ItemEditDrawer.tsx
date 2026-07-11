"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Drawer, Button, Badge, Select, Tooltip, useToast } from "@dejesumensaje/converge-ds-experimental";
import { DateRangeField } from "../shared/DateRangeField";
import { DateField } from "../shared/DateField";
import { usePricingStore, useEdlpException } from "@/store/pricing-store";
import { PricingCategory, PricingItem, StoreBaseReason, StorePromoReason } from "@/types/pricing";
import { RetailReductionField } from "./RetailReductionField";
import { BaseReductionField } from "./BaseReductionField";
import { BasePriceMethodField } from "./BasePriceMethodField";
import { HqBadge } from "../store/buildStoreColumns";
import { ShelfTagPreview } from "./ShelfTagPreview";
import { CollapsibleSection } from "./CollapsibleSection";
import { ProductRelationships } from "./ProductRelationships";
import { RetailPriceWarningModal } from "./RetailPriceWarningModal";
import { EdlpCeilingBlockedModal } from "./EdlpCeilingBlockedModal";
import { EdlpCeilingWarningModal } from "./EdlpCeilingWarningModal";
import { evaluateEdlpCeilingChange, committedEdlpCeilingState, EdlpChangeEvaluation } from "@/lib/edlp-ceiling";
import {
  REASON_META,
  PriceChangeReason,
  changeReasonFor,
  STORE_BASE_REASON_OPTIONS,
  STORE_BASE_REASON_DEFAULT,
  STORE_PROMO_REASON_OPTIONS,
} from "@/lib/price-change-reason";
import { orderCompetitors } from "@/lib/competitors";
import { hqRecRationale } from "@/lib/hq-rec";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { PRICE_TYPE_INTENT, FUEL_SAVER_OPTIONS, fuelSaverSelectValue } from "@/lib/pricing-meta";
import { deriveItemStatus, hqReviewNeeded } from "@/lib/item-status";
import { fmt, fmtQtyPrice, fmtDateRange, fmtEffectiveDate } from "@/lib/format";
import { perUnit, round2, promoDurationDays } from "@/lib/pricing-math";
import { buildItemsById } from "@/lib/edlp-ceiling";
import { RotateCcw, Trash2, Check, Package, Link2, Pencil, CalendarClock, AlertCircle, AlertTriangle } from "lucide-react";

type Props = {
  itemId: string | null;
  /** Which flow opened the drawer — sets the footer's primary action. */
  flow: "all" | "hq";
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

// Non-blocking informational note for a promo period running longer than two
// weeks — Retail and Fuel Saver only (Base has no period to be "long"). Same
// amber tone/shape as the EDLP soft-ceiling banner below; the director can
// still proceed, this is advisory only.
function LongPromoNotice({ days }: { days: number }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
      <AlertTriangle className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
      <span className="text-amber-900">
        This promotion runs {days} days — longer than the typical two-week window.
      </span>
    </div>
  );
}

// The "why" that leads an HQ decision block. Lives inside the accept-first
// unit itself (why → what → decide) — never a standalone banner, and never
// competing with the price, which stays the largest/boldest element below it.
//
// Base and Fuel Saver recs get the reason label alone: the rationale sentence
// for those moves is a pure numeric restatement of the Current → Recommends
// line right below, so printing it would say the same numbers twice. Retail
// (TA) recs keep the sentence — vendor funding, savings, and the run window
// are information the what-line doesn't carry.
function HqRationale({ item, section }: { item: PricingItem; section: "base" | "retail" | "fuel" }) {
  const hqReason =
    section === "base" ? item.hqBaseReason : section === "fuel" ? item.hqFuelReason : item.hqRetailReason;
  const label = hqReason ? REASON_META[hqReason].label : null;
  if (section !== "retail") {
    return label ? <p className="text-xs font-medium text-gray-500">{label}</p> : null;
  }
  return (
    <p className="text-sm text-gray-600">
      {label && <span className="font-medium text-gray-700">{label}</span>}
      {label ? " — " : ""}
      {hqRecRationale(item, "retail")}
    </p>
  );
}

// Compact read-only trace shown after the Director has decided against an HQ
// recommendation — keeps the Proposed layer visible per the ticket decision
// workspace model (inputs are permanent).
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
  onClose,
}: Props) {
  const items = usePricingStore((s) => s.items);
  const updateBasePrice = usePricingStore((s) => s.updateBasePrice);
  const updateBaseEffectiveDate = usePricingStore((s) => s.updateBaseEffectiveDate);
  const updateRetailPrice = usePricingStore((s) => s.updateRetailPrice);
  const updateFuelSaver = usePricingStore((s) => s.updateFuelSaver);
  const updateFuelSaverDates = usePricingStore((s) => s.updateFuelSaverDates);
  const updatePriceType = usePricingStore((s) => s.updatePriceType);
  const updateAllowanceDates = usePricingStore((s) => s.updateAllowanceDates);
  const acceptNoChange = usePricingStore((s) => s.acceptNoChange);
  const setReviewed = usePricingStore((s) => s.setReviewed);
  const setBaseChangeReason = usePricingStore((s) => s.setBaseChangeReason);
  const setRetailChangeReason = usePricingStore((s) => s.setRetailChangeReason);
  const setFuelChangeReason = usePricingStore((s) => s.setFuelChangeReason);
  const removeFromLooseTray = usePricingStore((s) => s.removeFromLooseTray);
  const toast = useToast();
  // The active store's EDLP ceiling exception, if AVP – Pricing granted one.
  // View-only here — store users never grant/edit it.
  const edlpException = useEdlpException();

  const item = items.find((i) => i.id === itemId) ?? null;
  const isTemp = item?.category_type === "temporary_allowance";
  // HQ pushed this price (already live). Frames the reference grid + identity note.
  const isHq = item?.hqReviewPending === true;
  const isEdlp = item?.category_type === "everyday_low_price";
  // A brand-new item has no current price to keep — it gets a "set opening price"
  // prompt instead of a read-only "current price" row.
  const isNewItem = item?.category_type === "new_discontinued" && item?.itemStatus === "new";
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
  // Inline error for hard retail validation failures (zero/negative, above base).
  // The refs mirror state so handleDone can read rejections synchronously — state
  // updates from onBlur and the Done onClick run in the same event flush.
  const [retailValidationError, setRetailValidationError] = useState<string | null>(null);
  // Inline error for hard base validation failures (zero/negative).
  const [baseValidationError, setBaseValidationError] = useState<string | null>(null);
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
  useEffect(() => {
    setEditingFuelSaver(false);
    setEditingBase(false);
    setChangingRetail(false);
    setPreConversionType(null);
    setConfirmRevert(null);
    setRetailValidationError(null);
    setBaseValidationError(null);
    retailRejectedRef.current = false;
    baseRejectedRef.current = false;
    setPendingRetailProposal(null);
    setEdlpBlockedProposal(null);
    setEdlpSoftProposal(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  // Silently discard any half-open editing form before closing. Called from Done,
  // the × button, and Escape — any close path. Three cases:
  // 1. Retail form open but no price committed → revert the TA type conversion
  //    that startPromo() made, and clear any orphaned retail reason.
  // 2. Base form open but no price committed → clear the orphaned base reason.
  // 3. Fuel form open but no amount set → clear the orphaned fuel reason.
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
    }
    onClose();
  };

  // Deliberately no auto-advance — hopping to the next item added noise without helping the decide-then-send task.
  const advance = () => handleClose();

  const itemsById = useMemo(() => buildItemsById([items]), [items]);
  const familyItems = item?.familyId
    ? [...itemsById.values()].filter((i) => i.familyId === item.familyId && i.id !== item.id)
    : [];

  // The EDLP ceiling state of the item's CURRENTLY committed price — derived
  // every render, drives the in-drawer banner and the price field's amber
  // cell state. "ok" for every non-EDLP item.
  const edlpCeilingState = item ? committedEdlpCeilingState(item, edlpException) : null;

  // Commit a base price. Family items share one price, so the store
  // propagates to the whole family — tell the user and offer a one-click Undo.
  // The EDLP ceiling is a SAP compliance hard stop, checked before the commit
  // lands. Clearing a price (null) restores the current price — no
  // validation on that path.
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
      const edlpEvaluation = evaluateEdlpCeilingChange(item.id, proposedPerUnit, itemsById, edlpException);
      if (edlpEvaluation.hard.length > 0) {
        setEdlpBlockedProposal({ total: v, qty, evaluation: edlpEvaluation });
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
    // lower. Previously the equal case silently collapsed the editor; now it
    // shows the same inline error as the above-base case so the director knows
    // why and can correct the value rather than wondering why the form closed.
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

  // Exit the base editing form without touching the committed state.
  // If no price was committed yet (the form was opened but nothing saved),
  // clear any orphaned reason that updateBasePrice may have written.
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
  // independent changes, so each input reverts only its own. A pending
  // (Edited, not-yet-live) edit reverts directly — cheap and reversible; a
  // confirmed (Live) price confirms first since it's already in effect.
  const revertField = (field: "base" | "retail") => {
    if (!item) return;
    const status = field === "base" ? item.baseOverrideStatus : item.retailOverrideStatus;
    if (status === "confirmed") {
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

  const status = item ? deriveItemStatus(item) : null;
  // An HQ rec still awaiting the store's decision.
  const showAccept = item != null && hqReviewNeeded(item);

  // This item has a not-yet-committed (Edited) change.
  const hasPendingOverride =
    item != null && (item.baseOverrideStatus === "pending" || item.retailOverrideStatus === "pending");

  // Reject the recommendation — keep the current SAP price. Reversible.
  const keepCurrent = () => {
    if (!item) return;
    const id = item.id;
    acceptNoChange(id);
    toast.success("Kept current price", {
      description: "Recommendation rejected — the current price is unchanged.",
      action: { label: "Undo", onClick: () => setReviewed(id, false) },
    });
    advance();
  };

  // Finishing: commit and close. A pending price commit that was just rejected
  // or parked for a dialog (base or retail) in the same event flush hasn't
  // re-rendered yet — read the refs so Done doesn't close past a validation error.
  const handleDone = () => {
    if (retailRejectedRef.current || baseRejectedRef.current) return;
    // Each section's timing is required once that section has a decided
    // price/amount — same hard-stop tier as price validation. In practice
    // this only fires mid-edit (e.g. a promo range with a start picked but no
    // end yet): a decided/collapsed section always carries the default dates
    // the store seeds the moment the price/amount was set.
    if (item) {
      const baseTimingMissing = item.newBasePrice != null && !item.baseEffectiveDate;
      const retailTimingMissing =
        item.newRetailPrice != null && (!item.allowanceStartDate || !item.allowanceEndDate);
      const fuelTimingMissing =
        item.fuelSaver != null && item.fuelSaver > 0 && (!item.fuelSaverStartDate || !item.fuelSaverEndDate);
      if (baseTimingMissing || retailTimingMissing || fuelTimingMissing) return;
    }
    handleClose();
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
    const basePlaceholder = isNewItem || hqReviewNeeded(item) ? item.recommendedBasePrice : item.currentBasePrice;
    return (
      <div className="flex flex-col gap-4">
        {/* One abandon control per edit form (Cancel, bottom-right) — same rule
            as the retail and fuel forms. Revert lives only in the decided view. */}
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
              {isHq && item.newBasePrice != null && Math.abs(perUnit(item.newBasePrice, item.newBaseQty) - (item.recommendedBasePrice ?? 0)) > 0.005 && (
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
        {item.hqBaseReason ? (
          // Custom price on an HQ-recommended section keeps the HQ reason as
          // its origin — read-only context here, not an editable selector.
          <p className="text-sm text-gray-500">
            Reason: <span className="font-medium text-gray-700">{REASON_META[item.hqBaseReason].label}</span>
          </p>
        ) : (
          // Part of setting the price, not a post-hoc afterthought — the director
          // picks why alongside what, before the price is even committed.
          <Select
            label="Change reason"
            size="sm"
            options={STORE_BASE_REASON_OPTIONS}
            value={item.chosenBaseReason ?? STORE_BASE_REASON_DEFAULT}
            onChange={(v) => setBaseChangeReason(item.id, v as StoreBaseReason)}
          />
        )}
        {(() => {
          // Base is open-ended — one Effective Date, no end. SAP's validity
          // end (12/31/9999) and NOW()-on-today are backend-only concerns
          // with no field here (see baseEffectiveDate).
          const baseDateMissing = item.newBasePrice != null && !item.baseEffectiveDate;
          return (
            <Field label="Effective date" required>
              <DateField
                value={item.baseEffectiveDate}
                onChange={(d) => updateBaseEffectiveDate(item.id, d)}
                error={baseDateMissing}
                aria-label="Effective date"
              />
              {baseDateMissing && (
                <span className="text-xs font-medium text-red-500">
                  Pick the date this price takes effect.
                </span>
              )}
            </Field>
          );
        })()}
        {familyItems.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <Link2 className="size-3.5 text-brand" aria-hidden="true" /> Family price — updating this updates all {familyItems.length + 1} items in
            {" "}
            {item.priceFamilyName ? <>"{item.priceFamilyName}"</> : "the family"}
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
        // so the footer is just "Done", which simply closes the drawer.
        <div className="flex items-center justify-between gap-3">
          {hasPendingOverride ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600">
              <Check className="size-4 text-emerald-600" aria-hidden="true" />
              Change saved
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
                  // Same reasons-in-tooltip as the table's badge — the drawer
                  // header shouldn't say less than the row that opened it.
                  <HqBadge
                    reasons={[item.hqBaseReason, item.hqRetailReason, item.hqFuelReason].filter(
                      (r): r is NonNullable<typeof r> => r != null
                    )}
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

          {(() => {
            const rec = item.recommendedBasePrice;
            const decided = item.newBasePrice != null;
            const baseHasRec = showAccept && item.recommendedBasePrice != null && Math.abs(rec - item.currentBasePrice) > 0.005;
            const effectiveBase = decided ? perUnit(item.newBasePrice!, item.newBaseQty) : item.currentBasePrice;
            const baseRecRef = !showAccept && rec != null && Math.abs(rec - item.currentBasePrice) > 0.005 && Math.abs(effectiveBase - rec) > 0.005;
            return (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-gray-700">
                  Base price <span className="font-normal text-gray-400">· white tag</span>
                </h3>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                  {editingBase ? (
                    baseInputBlock()
                  ) : decided ? (
                    <>
                    <div className="decision-pop flex items-center justify-between gap-3">
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
                          {(() => {
                            // Plain caption, deliberately not a second edit affordance —
                            // "Change" is the one path back into the editor (which
                            // carries the reason picker for store-origin items).
                            const reason = changeReasonFor(item, "base");
                            if (!reason) return null;
                            return <span className="text-xs text-gray-500">· {REASON_META[reason].label}</span>;
                          })()}
                        </div>
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
            const retailHasRec = isTemp && showAccept && item.recommendedRetailPrice != null;
            const acceptFirst = retailHasRec && !changingRetail && !retailDecided;
            const effectiveRetail = retailDecided ? perUnit(item.newRetailPrice!, item.newRetailQty ?? 1) : curRetail;
            const retailRecRef = isTemp && !showAccept && item.recommendedRetailPrice != null && Math.abs(effectiveRetail - item.recommendedRetailPrice) > 0.005;
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
                    {acceptFirst ? (
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
                        </div>
                      </div>
                    ) : retailDecided && !changingRetail ? (
                      <>
                      <div className="decision-pop flex items-center justify-between gap-3">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2 text-sm tabular-nums">
                            <Check className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                            <span className="text-gray-400 line-through">{fmt(curRetail)}</span>
                            <span aria-hidden="true" className="text-gray-300">→</span>
                            <span className="text-base font-semibold text-gray-900">{fmtQtyPrice(item.newRetailQty, item.newRetailPrice ?? curRetail)}</span>
                            {(() => {
                              // Plain caption — same one-edit-path rule as the base
                              // section's; "Change" reopens the editor + reason picker.
                              const reason = changeReasonFor(item, "retail");
                              if (!reason) return null;
                              return <span className="text-xs text-gray-500">· {REASON_META[reason].label}</span>;
                            })()}
                          </div>
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
                            // One undo-affordance rule across all three sections:
                            // "Revert" (RotateCcw) restores a prior live value;
                            // "Remove" (Trash2) deletes an additive promo that had
                            // none — same signifier the fuel saver uses. A promo
                            // newly created on a non-TA item (retailAutoTypedFrom
                            // remembers the conversion) has no prior TPR, so
                            // undoing it is a removal back to "No promo".
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
                          {isTemp && <span className="text-base font-semibold text-gray-900">{fmt(curRetail)}</span>}
                        </div>
                        <Button variant="secondary" size="sm" iconLeft={Pencil} onClick={startPromo}>
                          Set promo price
                        </Button>
                      </div>
                      {item.recommendedRetailPrice != null && retailRecRef && <HqRef price={item.recommendedRetailPrice} reasonKey={item.hqRetailReason} />}
                      </>
                    ) : (
                      <>
                        <Field label="New retail price">
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

                        {item.hqRetailReason ? (
                          // Custom price on an HQ-recommended section keeps the HQ
                          // reason as its origin — read-only context, not a selector.
                          <p className="text-sm text-gray-500">
                            Reason: <span className="font-medium text-gray-700">{REASON_META[item.hqRetailReason].label}</span>
                          </p>
                        ) : (
                          // Part of setting the price, not a post-hoc afterthought —
                          // the director picks why alongside what, before the price
                          // is even committed. Retail has no default — starts
                          // unselected until the director actively picks one.
                          <Select
                            label="Change reason"
                            size="sm"
                            options={STORE_PROMO_REASON_OPTIONS}
                            value={item.chosenRetailReason ?? ""}
                            placeholder="Select a reason"
                            onChange={(v) => setRetailChangeReason(item.id, v as StorePromoReason)}
                          />
                        )}

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
                              />
                              {promoDatesMissing && (
                                <span className="text-xs font-medium text-red-500">
                                  Pick a start and end date for the promo.
                                </span>
                              )}
                              {isLongPromo && <LongPromoNotice days={promoDays!} />}
                            </Field>
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
              {(() => {
                const fuelDecided = item.fuelSaver != null && item.fuelSaver > 0;
                const fuelHadPrior = item.currentFuelSaver != null && item.currentFuelSaver > 0;
                const fuelPeriod = fmtDateRange(item.fuelSaverStartDate, item.fuelSaverEndDate);
                // Accept-first for an undecided HQ fuel-saver rec — same why →
                // what → decide unit as base/retail, so a fuel reason advertised
                // in the table/badge is always actionable here.
                const fuelRec =
                  showAccept && item.recommendedFuelSaver != null && item.recommendedFuelSaver > 0
                    ? item.recommendedFuelSaver
                    : null;
                const fuelRecAmt = item.recommendedFuelSaver != null && item.recommendedFuelSaver > 0 ? item.recommendedFuelSaver : null;
                const effectiveFuel = fuelDecided ? (item.fuelSaver ?? 0) : (fuelHadPrior ? (item.currentFuelSaver ?? 0) : 0);
                const fuelRecRef = !showAccept && fuelRecAmt != null && Math.abs(effectiveFuel - fuelRecAmt) > 0.005;
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
                      </div>
                    </div>
                  );
                }
                if (!editingFuelSaver) {
                  return fuelDecided ? (
                    <>
                    <div className="decision-pop flex items-center justify-between gap-3">
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
                          {(() => {
                            // Plain caption, same one-edit-path rule as base/retail's —
                            // "Change" reopens the editor + reason picker.
                            const reason = changeReasonFor(item, "fuel");
                            if (!reason) return null;
                            return <span className="text-xs text-gray-500">· {REASON_META[reason].label}</span>;
                          })()}
                        </div>
                        {fuelPeriod && (
                          <span className="flex items-center gap-1 pl-6 text-xs text-gray-500">
                            <CalendarClock className="size-3 shrink-0 text-gray-400" aria-hidden="true" />
                            {fuelPeriod}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button variant="secondary" size="sm" iconLeft={Pencil} onClick={() => setEditingFuelSaver(true)}>Change</Button>
                        {/* "Remove" (Trash2), not "Revert": this deletes the fuel
                            saver outright (there is no revert-to-prior operation) —
                            the same removal signifier retail uses when undoing a
                            newly created promo. */}
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
                    {item.hqFuelReason ? (
                      // Custom price on an HQ-recommended section keeps the HQ
                      // reason as its origin — read-only context, not a selector.
                      <p className="text-sm text-gray-500">
                        Reason: <span className="font-medium text-gray-700">{REASON_META[item.hqFuelReason].label}</span>
                      </p>
                    ) : fuelDecided ? (
                      // The reason is asked only once an amount exists — like the
                      // period field below, "why" follows "what". No default —
                      // starts unselected until the director actively picks one.
                      <Select
                        label="Change reason"
                        size="sm"
                        options={STORE_PROMO_REASON_OPTIONS}
                        value={item.chosenFuelReason ?? ""}
                        placeholder="Select a reason"
                        onChange={(v) => setFuelChangeReason(item.id, v as StorePromoReason)}
                      />
                    ) : null}
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
                          />
                          {fuelDatesMissing && (
                            <span className="text-xs font-medium text-red-500">
                              Pick a start and end date for the fuel saver.
                            </span>
                          )}
                          {isLongPromo && <LongPromoNotice days={fuelDays!} />}
                        </Field>
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

          <ProductRelationships item={item} itemsById={itemsById} />

          {item.competitors && item.competitors.length > 0 && (() => {
            // Compare per-unit — a pack-size base competes on its unit price.
            const ourBase = item.newBasePrice != null ? perUnit(item.newBasePrice, item.newBaseQty) : item.currentBasePrice;
            // Our active TPR, if any — decided override first, else the live
            // allowance price. A plain base item has no active TPR even
            // though currentRetailPrice is seeded (it defaults to base).
            const ourTpr = item.newRetailPrice != null
              ? perUnit(item.newRetailPrice, item.newRetailQty)
              : item.category_type === "temporary_allowance"
                ? item.currentRetailPrice ?? null
                : null;
            const orderedCompetitors = orderCompetitors(item.competitors);
            const showTprColumn = ourTpr != null || orderedCompetitors.some((c) => c.retailPrice != null);
            const diffLabel = (diff: number, theirPrice: number) => {
              if (diff === 0) return "matches";
              const pct = ((diff / theirPrice) * 100).toFixed(1);
              return diff > 0 ? `+${pct}% higher` : `${pct}% lower`;
            };
            const diffClass = (diff: number) =>
              diff > 0 ? "text-red-600" : diff < 0 ? "text-emerald-600" : "text-gray-500";
            return (
              <CollapsibleSection title="Competitor prices" count={item.competitors.length}>
                <div className="-mx-4 -my-3">
                  {showTprColumn ? (
                    <>
                      <div className="flex items-start justify-between gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50">
                        <span className="text-xs font-medium text-gray-500">Our price</span>
                        <div className="flex gap-3">
                          <div className="w-24 text-right">
                            <div className="text-[11px] text-gray-500">Base</div>
                            <div className="text-sm font-semibold tabular-nums text-gray-900">{fmt(ourBase)}</div>
                          </div>
                          <div className="w-24 text-right">
                            <div className="text-[11px] text-gray-500">Retail</div>
                            <div className="text-sm font-semibold tabular-nums text-gray-900">
                              {ourTpr != null ? fmt(ourTpr) : "—"}
                            </div>
                          </div>
                        </div>
                      </div>
                      {orderedCompetitors.map((c) => {
                        const baseDiff = ourBase - c.price;
                        const hasCompetitorTpr = c.retailPrice != null;
                        const tprDiff = hasCompetitorTpr && ourTpr != null ? ourTpr - c.retailPrice! : null;
                        const meta = [
                          c.distanceMi != null ? `${c.distanceMi} mi` : null,
                          c.address ?? null,
                        ].filter(Boolean).join(" · ");
                        return (
                          <div key={c.name} className="flex items-start justify-between gap-3 px-4 py-1.5 border-b border-gray-100 last:border-0">
                            <div className="min-w-0">
                              <span className="text-sm text-gray-700">{c.name}</span>
                              {meta && <div className="truncate text-xs text-gray-500">{meta}</div>}
                            </div>
                            <div className="flex gap-3 tabular-nums">
                              <div className="w-24 text-right">
                                <div className="text-sm text-gray-700">{fmt(c.price)}</div>
                                <div className={`text-xs font-medium ${diffClass(baseDiff)}`}>{diffLabel(baseDiff, c.price)}</div>
                              </div>
                              <div className="w-24 text-right">
                                {hasCompetitorTpr ? (
                                  <>
                                    <div className="text-sm text-gray-700">{fmt(c.retailPrice!)}</div>
                                    {tprDiff != null && (
                                      <div className={`text-xs font-medium ${diffClass(tprDiff)}`}>{diffLabel(tprDiff, c.retailPrice!)}</div>
                                    )}
                                  </>
                                ) : (
                                  <div className="text-sm text-gray-400">—</div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50">
                        <span className="text-xs font-medium text-gray-500">Our price</span>
                        <span className="text-sm font-semibold tabular-nums text-gray-900">{fmt(ourBase)}</span>
                      </div>
                      {orderedCompetitors.map((c) => {
                        const diff = ourBase - c.price;
                        const meta = [
                          c.distanceMi != null ? `${c.distanceMi} mi` : null,
                          c.address ?? null,
                        ].filter(Boolean).join(" · ");
                        return (
                          <div key={c.name} className="flex items-start justify-between gap-3 px-4 py-1.5 border-b border-gray-100 last:border-0">
                            <div className="min-w-0">
                              <span className="text-sm text-gray-700">{c.name}</span>
                              {meta && <div className="truncate text-xs text-gray-500">{meta}</div>}
                            </div>
                            <div className="flex items-center gap-2 tabular-nums">
                              <span className="text-sm text-gray-700">{fmt(c.price)}</span>
                              <span className={`w-24 text-right text-xs font-medium ${diffClass(diff)}`}>
                                {diffLabel(diff, c.price)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </CollapsibleSection>
            );
          })()}

        </div>
      )}
    </Drawer>
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
            ? `All ${familyItems.length + 1} items in ${item.priceFamilyName ? `"${item.priceFamilyName}"` : "this family"} return to their current base price.`
            : `${item.name} returns to its current ${confirmRevert === "retail" ? "retail" : "base"} price.`
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
    </>
  );
}
