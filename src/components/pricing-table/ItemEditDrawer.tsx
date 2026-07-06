"use client";

import { useMemo, useState, useEffect } from "react";
import Image from "next/image";
import { Drawer, Button, Badge, Select, Tooltip, useToast } from "@dejesumensaje/converge-ds-experimental";
import { DateRangeField } from "../shared/DateRangeField";
import { usePricingStore } from "@/store/pricing-store";
import { PricingItem, OverrideStatus, Batch, StoreOriginReason } from "@/types/pricing";
import { RetailReductionField } from "./RetailReductionField";
import { BaseReductionField } from "./BaseReductionField";
import { BasePriceMethodField } from "./BasePriceMethodField";
import { BatchPickerModal } from "../store/BatchPickerModal";
import { HqBadge } from "../store/buildStoreColumns";
import { ShelfTagPreview } from "./ShelfTagPreview";
import { ProductRelationships } from "./ProductRelationships";
import { CollapsibleSection } from "./CollapsibleSection";
import { BlockedPriceChangeModal } from "./BlockedPriceChangeModal";
import { evaluateBaseChange, committedSoftWarnings, BaseChangeEvaluation } from "@/lib/relationship-validation";
import { REASON_META, changeReasonFor, defaultStoreReason, STORE_REASON_OPTIONS } from "@/lib/price-change-reason";
import { orderCompetitors } from "@/lib/competitors";
import { ImpactBreakdown } from "./columns/shared";
import { hqRecRationale } from "@/lib/hq-rec";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { PRICE_TYPE_INTENT, FUEL_SAVER_OPTIONS, fuelSaverSelectValue } from "@/lib/pricing-meta";
import { deriveItemStatus, hqReviewNeeded } from "@/lib/item-status";
import { fmt, fmtQtyPrice, fmtDateTime, fmtDateRange } from "@/lib/format";
import { grossMarginPct, fmtPct, fmtPpDelta, perUnit, round2, fmtSignedPct } from "@/lib/pricing-math";
import { buildItemsById } from "@/lib/batch-utils";
import { RotateCcw, Trash2, Check, Package, Link2, Lock, Info, Pencil, CalendarClock, AlertCircle, AlertTriangle } from "lucide-react";

type Props = {
  itemId: string | null;
  /** Which flow opened the drawer — sets the footer's primary action. */
  flow: "all" | "hq";
  /**
   * The view lens the drawer was opened from. For a store-originated item it
   * seeds the default change reason (Cost lens → cost-based, Competitor → comp-based).
   */
  originView?: "all" | "hq" | "cost" | "competitor";
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


export function ItemEditDrawer({
  itemId,
  flow,
  originView = "all",
  openBatches,
  onAddToBatch,
  onNewBatch,
  onClose,
}: Props) {
  const items = usePricingStore((s) => s.items);
  const batches = usePricingStore((s) => s.batches);
  const updateBasePrice = usePricingStore((s) => s.updateBasePrice);
  const updateRetailPrice = usePricingStore((s) => s.updateRetailPrice);
  const updateFuelSaver = usePricingStore((s) => s.updateFuelSaver);
  const updateFuelSaverDates = usePricingStore((s) => s.updateFuelSaverDates);
  const updatePriceType = usePricingStore((s) => s.updatePriceType);
  const updateAllowanceDates = usePricingStore((s) => s.updateAllowanceDates);
  const acceptNoChange = usePricingStore((s) => s.acceptNoChange);
  const setReviewed = usePricingStore((s) => s.setReviewed);
  const setChangeReason = usePricingStore((s) => s.setChangeReason);
  const removeFromLooseTray = usePricingStore((s) => s.removeFromLooseTray);
  const moveOverrideToBatch = usePricingStore((s) => s.moveOverrideToBatch);
  const toast = useToast();

  const item = items.find((i) => i.id === itemId) ?? null;
  const isTemp = item?.category_type === "temporary_allowance";
  // HQ pushed this price (already live). Frames the reference grid + identity note.
  const isHq = item?.hqReviewPending === true;
  // A store-originated item: cost and/or a competitor moved, with NO HQ rec. The
  // director reacts directly (set a price) and picks a reason — vs. HQ's accept-first.
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
  useEffect(() => {
    setEditingFuelSaver(false);
    setEditingBase(false);
    setChangingRetail(false);
    setConfirmRevert(null);
    setBatchPromptOpen(false);
    setMovePickerOpen(false);
    setBlockedProposal(null);
    // Capture the opening lens as the default reason for a store-originated item,
    // so the reason auto-populates from context (Cost lens → cost-based, etc.).
    // Only if the director hasn't already chosen one — never overwrite their call.
    if (item && !isHq && (item.storeSignals?.length ?? 0) > 0 && !item.chosenChangeReason) {
      setChangeReason(item.id, defaultStoreReason(item, originView));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  // Deliberately no auto-advance — hopping to the next item added noise without helping the decide-then-send task.
  const advance = () => onClose();

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

  // Commit a base price. Family items share one price, so the store
  // propagates to the whole family — tell the user and offer a one-click Undo.
  // Hard constraint violations (order inversions vs related items) block the
  // commit: the proposal parks in `blockedProposal` and a modal asks the
  // director to revert or scale. Clearing a price (null) restores the current
  // price, which can't break a ladder — no validation on that path.
  const commitBase = (v: number | null, qty?: number) => {
    if (!item) return;
    if (v != null) {
      const evaluation = evaluateBaseChange(item.id, perUnit(v, qty), itemsById);
      if (evaluation.hard.length > 0) {
        setBlockedProposal({ total: v, qty, evaluation });
        return;
      }
    }
    const prevPrice = item.newBasePrice ?? null;
    const prevQty = item.newBaseQty ?? undefined;
    updateBasePrice(item.id, v, qty);
    if (familyItems.length > 0 && v != null) {
      toast.success(`Updated the whole family (${familyItems.length + 1} items)`, {
        action: { label: "Undo", onClick: () => updateBasePrice(item.id, prevPrice, prevQty) },
      });
    }
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
    setEditingBase(false);
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

  const status = item ? deriveItemStatus(item, batches) : null;
  // An HQ rec still awaiting the store's decision.
  const showAccept = item != null && hqReviewNeeded(item);

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

  // Reject the recommendation — keep the current SAP price. Nothing is sent. Reversible.
  const keepCurrent = () => {
    if (!item) return;
    const id = item.id;
    acceptNoChange(id);
    toast.success("Kept current price", {
      description: "Recommendation rejected — nothing sent to SAP.",
      action: { label: "Undo", onClick: () => setReviewed(id, false) },
    });
    advance();
  };

  // Finishing: a saved change isn't lost, but the director still owes one decision
  // — which batch (or none) it goes in. Rather than a cramped footer split-button,
  // ask in a small modal. No pending change → just close.
  const handleDone = () => {
    if (hasPendingOverride) setBatchPromptOpen(true);
    else onClose();
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
    // Revert always lives in the field's top-right action slot (consistent with
    // the retail field), not crowding the input row.
    const revertAction = item.newBasePrice != null ? (
      <Button
        variant="tertiary"
        size="sm"
        iconLeft={RotateCcw}
        aria-label="Revert to current base price"
        onClick={() => { revertField("base"); setEditingBase(false); }}
      />
    ) : undefined;
    // The input's ghost placeholder = the value you'd most likely type: HQ's
    // proposal when one is pending (or a new item's suggested opening price),
    // otherwise the CURRENT price — never a stray recommendation the director
    // isn't acting on (which read as a confusing "$4.49" on a $4.29 item).
    const basePlaceholder = isNewItem || hqReviewNeeded(item) ? item.recommendedBasePrice : item.currentBasePrice;
    return (
      <div className="flex flex-col gap-4">
        <Field label={priceLabel} action={revertAction}>
          {isEdlp ? (
            // EDLP is a markdown decision — like a temporary allowance, the
            // director picks HOW to apply it (% off / $ off / exact).
            <BaseReductionField
              reference={item.currentBasePrice}
              recommended={basePlaceholder}
              value={item.newBasePrice}
              status={item.baseOverrideStatus}
              hasAlert={item.hasAlert}
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
        </Field>
        {familyItems.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <Link2 className="size-3.5 text-brand" aria-hidden="true" /> Family price — updating this updates all {familyItems.length + 1} items in
            {" "}
            {item.priceFamilyName ? <>“{item.priceFamilyName}”</> : "the family"}
          </p>
        )}
      </div>
    );
  };

  return (
    <>
    <Drawer
      open={item != null}
      onOpenChange={(o) => {
        if (!o) onClose();
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
                {hqReviewNeeded(item) && <HqBadge />}
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

          {hqReviewNeeded(item) && (
            <div className="-mt-2 flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
              <Info className="size-4 shrink-0 text-brand" aria-hidden="true" />
              <span className="text-gray-700">
                {/* The change reason leads the sentence — context, not a chip. */}
                {item.hqChangeReason && (
                  <span className="font-medium text-gray-800">{REASON_META[item.hqChangeReason].label} — </span>
                )}
                {hqRecRationale(item)}
              </span>
            </div>
          )}

          {/* Store-originated context: no HQ recommendation — the director reacts to a
              cost or competitor move directly. One line per signal the item carries. */}
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
                  const top = orderCompetitors(item.competitors ?? [])[0];
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
              <Button variant="tertiary" size="sm" onClick={() => setMovePickerOpen(true)}>
                Change batch
              </Button>
            </div>
          )}

          {(() => {
            const rec = item.recommendedBasePrice;
            const decided = item.newBasePrice != null;
            const baseHasRec = showAccept && item.recommendedBasePrice != null && Math.abs(rec - item.currentBasePrice) > 0.005;
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
                    <div className="decision-pop flex items-center justify-between gap-3">
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
                          // Store-originated reason is shown as an editable select below.
                          if (storeOrigin) return null;
                          const reason = changeReasonFor(item);
                          return reason && <span className="text-xs text-gray-500">· {REASON_META[reason].label}</span>;
                        })()}
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
                  ) : baseHasRec ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-baseline gap-2 text-sm tabular-nums">
                        <span className="text-gray-500">Current {fmt(item.currentBasePrice)}</span>
                        <span aria-hidden="true" className="text-gray-300">→</span>
                        <span className="font-semibold text-gray-900">HQ recommends {fmt(rec)}</span>
                      </div>
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
                </div>
              </section>
            );
          })()}

          {/* Store-originated change reason — auto-populated from the opening lens,
              editable here. Appears once the director has actually set a price. */}
          {storeOrigin && (item.newBasePrice != null || item.newRetailPrice != null) && (
            <div className="w-[240px]">
              <Select
                label="Change reason"
                size="sm"
                options={STORE_REASON_OPTIONS}
                value={item.chosenChangeReason ?? defaultStoreReason(item, originView)}
                onChange={(v) => setChangeReason(item.id, v as StoreOriginReason)}
              />
            </div>
          )}

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
            // A plain item gets converted to a TA the moment a promo is set.
            const startPromo = () => {
              if (!isTemp) updatePriceType(item.id, "temporary_allowance");
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
                      <div className="decision-pop flex flex-wrap items-center gap-2">
                        <Button variant="primary" size="sm" iconLeft={Check} onClick={() => updateRetailPrice(item.id, 1, recRetail)}>
                          Accept {fmt(recRetail)}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => setChangingRetail(true)}>
                          Set a different price
                        </Button>
                      </div>
                    ) : retailDecided && !changingRetail ? (
                      <div className="decision-pop flex items-center justify-between gap-3">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2 text-sm tabular-nums">
                            <Check className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                            <span className="text-gray-400 line-through">{fmt(curRetail)}</span>
                            <span aria-hidden="true" className="text-gray-300">→</span>
                            <span className="text-base font-semibold text-gray-900">{fmtQtyPrice(item.newRetailQty, item.newRetailPrice ?? curRetail)}</span>
                            {(() => {
                              const reason = changeReasonFor(item);
                              return reason && <span className="text-xs text-gray-500">· {REASON_META[reason].label}</span>;
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
                          <Button
                            variant="tertiary"
                            size="sm"
                            iconLeft={RotateCcw}
                            onClick={() => revertField("retail")}
                          >
                            Revert
                          </Button>
                        </div>
                      </div>
                    ) : !changingRetail ? (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-baseline gap-2 tabular-nums">
                          <span className="text-xs text-gray-500">{isTemp ? "Current" : "No promo"}</span>
                          <span className="text-base font-semibold text-gray-900">{isTemp ? fmt(curRetail) : "—"}</span>
                        </div>
                        <Button variant="secondary" size="sm" iconLeft={Pencil} onClick={startPromo}>
                          Set promo price
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Field
                          label="New retail price"
                          action={
                            item.newRetailPrice != null && (
                              <Button
                                variant="tertiary"
                                size="sm"
                                iconLeft={RotateCcw}
                                aria-label="Revert to current retail price"
                                onClick={() => revertField("retail")}
                              />
                            )
                          }
                        >
                          <RetailReductionField
                            baseReference={baseRef}
                            recommendedPrice={retailHasRec ? recRetail : curRetail}
                            qty={item.newRetailQty ?? null}
                            price={item.newRetailPrice ?? null}
                            status={item.retailOverrideStatus}
                            onCommit={(qty, price) => updateRetailPrice(item.id, qty, price)}
                          />
                        </Field>

                        {(() => {
                          // A promo must carry a date range — flag it required and
                          // show the error state until both ends are picked.
                          const promoDatesMissing =
                            item.newRetailPrice != null &&
                            (!item.allowanceStartDate || !item.allowanceEndDate);
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
                            </Field>
                          );
                        })()}
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
                if (!editingFuelSaver) {
                  return fuelDecided ? (
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
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-baseline gap-2 tabular-nums">
                        <span className="text-xs text-gray-500">No fuel saver</span>
                        <span className="text-base font-semibold text-gray-900">{fmt(0)}</span>
                      </div>
                      <Button variant="secondary" size="sm" iconLeft={Pencil} onClick={() => setEditingFuelSaver(true)}>
                        Add fuel saver
                      </Button>
                    </div>
                  );
                }
                return (
                  <div className="flex flex-col gap-2">
                    <div className="w-[170px]">
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
                    </div>
                    {fuelDecided && (
                      <Field label="Fuel saver period">
                        <DateRangeField
                          start={item.fuelSaverStartDate}
                          end={item.fuelSaverEndDate}
                          onChange={(s, e) => updateFuelSaverDates(item.id, s, e)}
                          aria-label="Fuel saver date range"
                        />
                      </Field>
                    )}
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
                    : (hqReviewNeeded(item) ? item.recommendedRetailPrice : null) ?? curRetail;
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
                    next={grossMarginPct(item.newBasePrice != null ? perUnit(item.newBasePrice, item.newBaseQty) : hqReviewNeeded(item) ? item.recommendedBasePrice : item.currentBasePrice, item.cost)}
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
                  {orderCompetitors(item.competitors).map((c) => {
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
        setEditingBase(false);
      }}
      onScale={scaleBlocked}
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
