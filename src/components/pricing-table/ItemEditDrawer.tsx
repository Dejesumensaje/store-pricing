"use client";

import { useMemo, useState, useEffect, useId } from "react";
import Image from "next/image";
import { Drawer, Button, Badge, Select, Switch, useToast } from "@dejesumensaje/converge-ds-experimental";
import { DateField } from "../shared/DateField";
import { BatchSplitButton } from "../store/BatchSplitButton";
import { usePricingStore } from "@/store/pricing-store";
import { PricingItem, PricingCategory, OverrideStatus, Batch } from "@/types/pricing";
import { PriceInputCell, derivePriceState } from "./PriceInputCell";
import { QtyPriceInput } from "./QtyPriceInput";
import { ReductionInput } from "./ReductionInput";
import { FUEL_SAVER_OPTIONS } from "./columns/tempColumns";
import { ImpactBreakdown } from "./columns/shared";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { PRICE_TYPE_META, PRICE_TYPE_INTENT } from "@/lib/pricing-meta";
import { deriveItemStatus, hqReviewNeeded } from "@/lib/item-status";
import { fmt } from "@/lib/format";
import { grossMarginPct, fmtPct, fmtPpDelta } from "@/lib/pricing-math";
import { buildItemsById } from "@/lib/batch-utils";
import { ChevronLeft, ChevronRight, RotateCcw, Check, Package, Link2, ChevronDown, Lock, Info, Layers } from "lucide-react";

type Props = {
  itemId: string | null;
  /** Which flow opened the drawer — sets the footer's primary action. */
  flow: "all" | "hq";
  /** The batch the user is building into (one-click add-to-batch target). */
  activeBatch: Batch | null;
  /** Open batches the add-to-batch menu can target. */
  openBatches: Batch[];
  /** Add this item's pending edits to a batch (owned by the page). */
  onAddToBatch: (batchId: string, overrideIds: string[]) => void;
  /** Start the New batch flow seeded with these override ids (owned by the page). */
  onNewBatch: (seedIds: string[]) => void;
  onClose: () => void;
  /** Move to the previous / next item in the current list (undefined = none). */
  onPrev?: () => void;
  onNext?: () => void;
  /** Position of the current item in the list, for the header "X / Y" nav. */
  position?: { index: number; total: number };
};

// Price types a store director can assign by hand. Temporary allowances are
// vendor-funded (HQ-only: the store overrides the price, not the type) and
// "no change" is a system state — both are excluded here.
const STORE_ASSIGNABLE_TYPES: PricingCategory[] = ["base", "everyday_low_price", "new_discontinued"];
const PRICE_TYPE_OPTIONS = STORE_ASSIGNABLE_TYPES.map((key) => ({
  label: PRICE_TYPE_META[key].label,
  value: key,
}));

function Field({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-h-6 items-center justify-between gap-3">
        <span className="text-sm font-medium text-gray-700">{label}</span>
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


// Per-item editing drawer. Self-driven: resolves the item from the store and
// commits edits through the store actions; navigation walks the caller's list.
export function ItemEditDrawer({
  itemId,
  flow,
  activeBatch,
  openBatches,
  onAddToBatch,
  onNewBatch,
  onClose,
  onPrev,
  onNext,
  position,
}: Props) {
  const items = usePricingStore((s) => s.items);
  const batches = usePricingStore((s) => s.batches);
  const updateBasePrice = usePricingStore((s) => s.updateBasePrice);
  const updateRetailPrice = usePricingStore((s) => s.updateRetailPrice);
  const updateFuelSaver = usePricingStore((s) => s.updateFuelSaver);
  const updatePriceType = usePricingStore((s) => s.updatePriceType);
  const updateAllowanceDates = usePricingStore((s) => s.updateAllowanceDates);
  const acceptNoChange = usePricingStore((s) => s.acceptNoChange);
  const setReviewed = usePricingStore((s) => s.setReviewed);
  const removeFromLooseTray = usePricingStore((s) => s.removeFromLooseTray);
  const toast = useToast();

  const item = items.find((i) => i.id === itemId) ?? null;
  const isTemp = item?.category_type === "temporary_allowance";
  // HQ pushed this price (already live). Frames the reference grid + identity note.
  const isHq = item?.hqReviewPending === true;
  // The price type is HQ-owned (vendor-funded allowance) or a system state (no
  // change) — show it locked instead of an assignable Select.
  const typeLocked = isTemp || item?.category_type === "no_change";
  const isEdlp = item?.category_type === "everyday_low_price";
  const isNewItem = item?.category_type === "new_discontinued" && item?.itemStatus === "new";
  // Per-type intent (labels + helper copy). New/discontinued is refined by itemStatus.
  const intent = item
    ? item.category_type === "new_discontinued"
      ? item.itemStatus === "discontinued"
        ? { helper: "Being removed — set a clearance price.", priceLabel: "Clearance price" }
        : { helper: "New item — set its opening price.", priceLabel: "Initial price" }
      : PRICE_TYPE_INTENT[item.category_type]
    : null;

  const [showFuelSaver, setShowFuelSaver] = useState(false);
  // Multi-unit retail deal toggle ("N for $X"). Seeded from the item's stored
  // quantity so existing deals open expanded.
  const [multiUnit, setMultiUnit] = useState(false);
  const [confirmRevert, setConfirmRevert] = useState<"base" | "retail" | null>(null);
  // Reset per-item UI reveals when navigating to another item.
  useEffect(() => {
    setShowFuelSaver(false);
    setMultiUnit((item?.newRetailQty ?? 1) > 1);
  }, [itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  const advance = () => (onNext ? onNext() : onClose());

  const itemsById = useMemo(() => buildItemsById([items]), [items]);
  const relatedItems = (item?.relatedItemIds ?? [])
    .map((id) => itemsById.get(id))
    .filter((i): i is PricingItem => i != null);
  const lineItems = item?.linePriceGroup
    ? [...itemsById.values()].filter((i) => i.linePriceGroup === item.linePriceGroup && i.id !== item.id)
    : [];

  // Commit a base price. Line-price items share one price, so the store
  // propagates to the whole group — tell the user and offer a one-click Undo.
  const commitBase = (v: number | null) => {
    if (!item) return;
    const prev = item.newBasePrice ?? null;
    updateBasePrice(item.id, v);
    if (lineItems.length > 0 && v != null) {
      toast.success(`Updated ${lineItems.length + 1} line-price items`, {
        action: { label: "Undo", onClick: () => updateBasePrice(item.id, prev) },
      });
    }
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
    removeFromLooseTray(`${item.id}:${field}`);
  };

  const status = item ? deriveItemStatus(item, batches) : null;
  const fuelSaverActive = showFuelSaver || (item?.fuelSaver != null && item.fuelSaver > 0);
  // Offer "Keep HQ price" only while the HQ rec is still awaiting review.
  const showAccept = item != null && hqReviewNeeded(item);
  // Don't auto-focus the price input when the change type is genuinely a choice
  // (a fresh HQ review, a temporary allowance, or a new/discontinued item) — the
  // eye starts at the top (the type + its helper) instead of jumping to the price.
  // Plain base edits keep the fast path: focus lands on the input, ready to type.
  const leadWithType = showAccept || isTemp || item?.category_type === "new_discontinued";

  // This item's not-yet-batched edits — the unit the footer batches or saves.
  const myPendingIds = item
    ? [
        item.baseOverrideStatus === "pending" ? `${item.id}:base` : null,
        item.retailOverrideStatus === "pending" ? `${item.id}:retail` : null,
      ].filter((x): x is string => x != null)
    : [];
  const hasPendingOverride = myPendingIds.length > 0;

  // Accept HQ's recommended price as the decision. This creates a pending change
  // (current → recommended) the director then saves for later or adds to a batch —
  // it does NOT auto-send. No advance: the footer flips to the save/batch options.
  const acceptHqRec = () => {
    if (!item) return;
    if (item.category_type === "temporary_allowance") {
      updateRetailPrice(item.id, 1, item.recommendedRetailPrice ?? item.currentRetailPrice ?? item.currentBasePrice);
    } else {
      commitBase(item.recommendedBasePrice);
    }
  };

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

  // Add this item's pending edits to a batch, then keep the queue moving.
  const addThisToBatch = (batchId: string) => {
    onAddToBatch(batchId, myPendingIds);
    advance();
  };

  return (
    <>
    <Drawer
      open={item != null}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title="Edit prices"
      size="md"
      className="max-md:!w-full"
      headerActions={
        <div className="flex items-center gap-2">
          {status && <Badge tone={status.tone} size="sm">{status.label}</Badge>}
          {position && (
            <div className="flex items-center gap-0.5 text-xs text-gray-500">
              <Button variant="tertiary" size="sm" iconLeft={ChevronLeft} aria-label="Previous item" disabled={!onPrev} onClick={onPrev} />
              <span className="tabular-nums whitespace-nowrap">{position.index + 1} / {position.total}</span>
              <Button variant="tertiary" size="sm" iconLeft={ChevronRight} aria-label="Next item" disabled={!onNext} onClick={onNext} />
            </div>
          )}
        </div>
      }
      footer={
        // Edits auto-save as pending the instant they commit. The footer surfaces
        // the real decision — batch now vs. leave for later — with the primary set
        // by the flow: the HQ queue funnels into a batch; All items defaults to
        // saving for later. An undecided HQ rec gets Accept (apply the rec) or
        // Keep current (reject); both then route through save/batch (accept never
        // auto-sends). Typing a price instead is an override.
        <div className="flex items-center justify-end gap-2">
          {showAccept ? (
            <>
              <Button variant="secondary" onClick={keepCurrent}>
                Keep current
              </Button>
              <Button variant="primary" iconLeft={Check} onClick={acceptHqRec}>
                Accept HQ rec
              </Button>
            </>
          ) : hasPendingOverride ? (
            flow === "hq" ? (
              <>
                <Button variant="text-link" onClick={advance}>
                  Save for later
                </Button>
                <BatchSplitButton
                  activeBatch={activeBatch}
                  openBatches={openBatches}
                  onAddToActive={() => activeBatch && addThisToBatch(activeBatch.id)}
                  onAddToBatch={(id) => addThisToBatch(id)}
                  onNewBatch={() => onNewBatch(myPendingIds)}
                />
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  iconLeft={Layers}
                  onClick={() => (activeBatch ? addThisToBatch(activeBatch.id) : onNewBatch(myPendingIds))}
                >
                  Add to batch
                </Button>
                <Button variant="primary" iconRight={onNext ? ChevronRight : undefined} onClick={advance}>
                  {onNext ? "Save for later" : "Done"}
                </Button>
              </>
            )
          ) : (
            <Button variant="primary" iconRight={onNext ? ChevronRight : undefined} onClick={advance}>
              {onNext ? "Next item" : "Done"}
            </Button>
          )}
        </div>
      }
    >
      {item && (
        <div key={item.id} className="flex flex-col gap-5">
          {/* Item identity */}
          <div className="flex items-center gap-3">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
              {item.image ? (
                <Image src={item.image} alt={item.name} width={64} height={64} className="object-cover" />
              ) : (
                <Package className="size-6 text-gray-300" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold text-gray-900">{item.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {item.id} · {item.aisle} · {item.brand} · Cost {fmt(item.cost)}
                {isTemp && ` · Allowance cost ${fmt(item.allowanceCost ?? item.cost)}`}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <Badge tone="neutral" size="sm">{item.itemRole}</Badge>
                {item.linePriceGroup && <Badge tone="in-progress" size="sm">Line price</Badge>}
              </div>
            </div>
          </div>

          {/* HQ review note — a recommendation awaiting the director's decision. */}
          {hqReviewNeeded(item) && (
            <div className="-mt-2 flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              <Info className="size-4 shrink-0 text-brand" aria-hidden="true" />
              <span>
                <span className="font-medium text-gray-800">HQ recommends a new price for this item.</span>{" "}
                Accept it, enter your own, or keep the current price.
              </span>
            </div>
          )}

          {/* Price type — store-assignable types use a Select; HQ-owned (vendor-
              funded allowance) and system ("no change") types render locked. */}
          {typeLocked ? (
            <div>
              <span className="text-sm font-medium text-gray-700">Price type</span>
              <div className="mt-1.5 flex items-center gap-2">
                <Badge tone={PRICE_TYPE_META[item.category_type].tone} size="sm">
                  {PRICE_TYPE_META[item.category_type].label}
                </Badge>
                <Lock className="size-3.5 text-gray-500" aria-hidden="true" />
              </div>
              {intent && <p className="mt-1.5 text-xs text-gray-500">{intent.helper}</p>}
            </div>
          ) : (
            <div>
              <Select
                options={PRICE_TYPE_OPTIONS}
                value={item.category_type}
                onChange={(v) => updatePriceType(item.id, v as PricingCategory)}
                label="Price type"
                size="sm"
              />
              {intent && <p className="mt-1.5 text-xs text-gray-500">{intent.helper}</p>}
              {item.autoTypedFrom === "no_change" && (
                <p className="mt-1 flex items-center gap-1 text-xs font-medium text-brand">
                  <Check className="size-3.5" aria-hidden="true" /> Changed to Base price
                </p>
              )}
            </div>
          )}

          {/* Base price — current SAP + HQ recommendation, then the director's price.
              New items have no "Current"; EDLP adds a permanent-reduction control. */}
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-gray-700">Base price</h3>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                {!isNewItem && (
                  <span className="text-gray-500">
                    Current SAP
                    <span className="ml-1 font-medium tabular-nums text-gray-800">{fmt(item.currentBasePrice)}</span>
                  </span>
                )}
                <span className="text-gray-500">
                  {isNewItem ? "Suggested" : isHq ? "HQ recommended" : "Recommended"}
                  <span className="ml-1 font-medium tabular-nums text-gray-800">{fmt(item.recommendedBasePrice)}</span>
                </span>
              </div>
              <div className="mt-3 flex flex-col gap-4 border-t border-gray-200 pt-3">
                {isEdlp && (
                  <Field label="Permanent reduction">
                    <ReductionInput
                      reference={item.currentBasePrice}
                      value={item.newBasePrice}
                      onCommit={commitBase}
                      defaultMode="amount"
                    />
                  </Field>
                )}
                <Field label={item.category_type === "new_discontinued" ? intent?.priceLabel ?? "Your price" : "Your price"}>
                  <div className="flex items-center gap-2">
                    <PriceInputCell
                      autoFocus={!leadWithType}
                      ariaLabel={item.category_type === "new_discontinued" ? intent?.priceLabel ?? "Your price" : "Your price"}
                      recommended={item.recommendedBasePrice}
                      value={item.newBasePrice}
                      state={derivePriceState({ value: item.newBasePrice, status: item.baseOverrideStatus, hasAlert: item.hasAlert })}
                      onCommit={commitBase}
                    />
                    {isEdlp && item.newBasePrice != null && item.currentBasePrice - item.newBasePrice > 0.005 && (
                      <span className="text-xs font-medium text-emerald-600">
                        −{fmt(item.currentBasePrice - item.newBasePrice)} (−{Math.round(((item.currentBasePrice - item.newBasePrice) / item.currentBasePrice) * 100)}%)
                      </span>
                    )}
                    {item.newBasePrice != null && (
                      <Button
                        variant="tertiary"
                        size="sm"
                        iconLeft={RotateCcw}
                        aria-label="Revert to current base price"
                        onClick={() => revertField("base")}
                      />
                    )}
                  </div>
                  {isHq && item.newBasePrice != null && (
                    <p className="text-xs text-gray-500">
                      HQ recommended {fmt(item.recommendedBasePrice)} · your price{" "}
                      <span className="font-medium text-gray-700">{fmt(item.newBasePrice)}</span>
                    </p>
                  )}
                </Field>
                {lineItems.length > 0 && (
                  <p className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Link2 className="size-3.5 text-brand" aria-hidden="true" /> Applies to the whole line ({lineItems.length + 1} items)
                  </p>
                )}
                <MarginRow
                  label="Gross margin"
                  current={grossMarginPct(item.currentBasePrice, item.cost)}
                  next={grossMarginPct(item.newBasePrice ?? item.recommendedBasePrice, item.cost)}
                />
              </div>
            </div>
          </section>

          {/* Retail price (temporary allowance) — current SAP + HQ rec, then the
              director's retail price and the allowance window. */}
          {isTemp && (() => {
            const curRetail = item.currentRetailPrice ?? item.currentBasePrice;
            const unit = item.newRetailPrice != null ? item.newRetailPrice / Math.max(1, item.newRetailQty ?? 1) : null;
            return (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-gray-700">Retail price</h3>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                    <span className="text-gray-500">
                      Current SAP
                      <span className="ml-1 font-medium tabular-nums text-gray-800">{fmt(curRetail)}</span>
                    </span>
                    <span className="text-gray-500">
                      HQ recommended
                      <span className="ml-1 font-medium tabular-nums text-gray-800">
                        {fmt(item.recommendedRetailPrice ?? item.currentBasePrice)}
                      </span>
                    </span>
                  </div>
                  <div className="mt-3 flex flex-col gap-4 border-t border-gray-200 pt-3">
                    <Field label="Reduction">
                      <ReductionInput
                        reference={curRetail}
                        value={unit}
                        onCommit={(price) => updateRetailPrice(item.id, 1, price)}
                        defaultMode="pct"
                      />
                    </Field>
                    <Field
                      label="Your retail price"
                      action={
                        <Switch
                          checked={multiUnit}
                          onCheckedChange={setMultiUnit}
                          label="Multi-unit deal"
                          labelPosition="left"
                          size="sm"
                        />
                      }
                    >
                      <div className="flex items-center gap-2">
                        <QtyPriceInput
                          qty={item.newRetailQty ?? null}
                          price={item.newRetailPrice ?? null}
                          recommendedPrice={item.recommendedRetailPrice ?? item.currentBasePrice}
                          state={derivePriceState({ value: item.newRetailPrice, status: item.retailOverrideStatus })}
                          multi={multiUnit}
                          onCommit={(qty, price) => updateRetailPrice(item.id, qty, price)}
                        />
                        {item.newRetailPrice != null && (
                          <Button
                            variant="tertiary"
                            size="sm"
                            iconLeft={RotateCcw}
                            aria-label="Revert to current retail price"
                            onClick={() => revertField("retail")}
                          />
                        )}
                      </div>
                    </Field>

                    <Field label="Allowance period">
                      <div className="flex items-center gap-2">
                        <DateField
                          value={item.allowanceStartDate}
                          onChange={(v) => updateAllowanceDates(item.id, v, item.allowanceEndDate ?? null)}
                          aria-label="Allowance start date"
                        />
                        <span aria-hidden="true" className="text-gray-300">–</span>
                        <DateField
                          value={item.allowanceEndDate}
                          onChange={(v) => updateAllowanceDates(item.id, item.allowanceStartDate ?? null, v)}
                          aria-label="Allowance end date"
                        />
                      </div>
                    </Field>
                    {(() => {
                      const allowanceCost = item.allowanceCost ?? item.cost;
                      const newUnit = unit ?? item.recommendedRetailPrice ?? curRetail;
                      const fuel = item.fuelSaver ?? 0;
                      return (
                        <>
                          <MarginRow
                            label="Retail margin"
                            current={grossMarginPct(curRetail, allowanceCost)}
                            next={grossMarginPct(newUnit, allowanceCost)}
                          />
                          {fuel > 0 && (
                            <MarginRow
                              label="Incl. fuel saver"
                              current={grossMarginPct(curRetail, allowanceCost)}
                              next={grossMarginPct(newUnit - fuel, allowanceCost)}
                            />
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </section>
            );
          })()}

          {/* Fuel saver — an independent add-on on top of the retail price. */}
          {isTemp && (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-gray-700">Fuel saver</h3>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <div className="flex flex-col gap-2">
                  <Switch
                    checked={fuelSaverActive}
                    onCheckedChange={(on) => {
                      setShowFuelSaver(on);
                      if (!on) updateFuelSaver(item.id, null);
                    }}
                    label="Add fuel saver"
                    size="sm"
                  />
                  {fuelSaverActive && (
                    <div className="w-[170px]">
                      <Select
                        options={FUEL_SAVER_OPTIONS}
                        value={String(item.fuelSaver ?? "0")}
                        onChange={(v) => updateFuelSaver(item.id, parseFloat(v as string))}
                        label="Fuel saver"
                        size="sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Competitor prices — collapsed context */}
          {item.competitors && item.competitors.length > 0 && (() => {
            const ourPrice = item.newBasePrice ?? item.currentBasePrice;
            return (
              <CollapsibleSection title="Competitor prices" count={item.competitors.length}>
                <div className="-mx-4 -my-3">
                  <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50">
                    <span className="text-xs font-medium text-gray-500">Our price</span>
                    <span className="text-sm font-semibold tabular-nums text-gray-900">{fmt(ourPrice)}</span>
                  </div>
                  {item.competitors.map((c) => {
                    const diff = ourPrice - c.price;
                    return (
                      <div key={c.name} className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-100 last:border-0">
                        <div className="min-w-0">
                          <span className="text-sm text-gray-700">{c.name}</span>
                          {c.distanceMi != null && <span className="ml-2 text-xs text-gray-500">{c.distanceMi} mi</span>}
                        </div>
                        <div className="flex items-center gap-2 tabular-nums">
                          <span className="text-sm text-gray-700">{fmt(c.price)}</span>
                          <span className={`w-20 text-right text-xs font-medium ${diff > 0 ? "text-red-600" : diff < 0 ? "text-emerald-600" : "text-gray-500"}`}>
                            {diff > 0 ? `+${fmt(diff)} hi` : diff < 0 ? `${fmt(diff)} lo` : "match"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleSection>
            );
          })()}

          {/* Related items — includes line-price members (flagged); collapsed. */}
          {(() => {
            const lineIds = new Set(lineItems.map((li) => li.id));
            const merged = [...lineItems, ...relatedItems.filter((ri) => !lineIds.has(ri.id))];
            if (merged.length === 0) return null;
            return (
              <CollapsibleSection title="Related items" count={merged.length}>
                <div className="-mx-4 -my-3">
                  {merged.map((ri) => (
                    <div key={ri.id} className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-100 last:border-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-gray-700">{ri.name}</p>
                        <p className="text-xs text-gray-500">{ri.id}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {lineIds.has(ri.id) && <Badge tone="in-progress" size="sm">Line</Badge>}
                        <span className="text-sm tabular-nums text-gray-500">{fmt(ri.newBasePrice ?? ri.currentBasePrice)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            );
          })()}

          {/* Projected impact — de-emphasized, collapsed by default */}
          <CollapsibleSection title="Projected impact">
            <ImpactBreakdown item={item} />
          </CollapsibleSection>
        </div>
      )}
    </Drawer>
    <ConfirmDialog
      open={confirmRevert != null}
      onOpenChange={(o) => { if (!o) setConfirmRevert(null); }}
      headline="Revert this price change?"
      description={
        item
          ? `${item.name} returns to its current ${confirmRevert === "retail" ? "retail" : "base"} price and leaves its batch.`
          : undefined
      }
      confirmLabel="Revert"
      destructive
      onConfirm={() => {
        if (item && confirmRevert) removeFromLooseTray(`${item.id}:${confirmRevert}`);
      }}
    />
    </>
  );
}

// Collapsed-by-default context panel. Keeps supporting info (competitors,
// related items, projected impact) available without pushing the price decision
// down — the decision stays above the fold, context is one click away.
function CollapsibleSection({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left"
      >
        <span className="text-sm font-medium text-gray-700">
          {title}
          {count != null && <span className="ml-1 text-gray-400">({count})</span>}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`size-4 text-gray-500 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div id={panelId} className="border-t border-gray-100 px-4 py-3 text-gray-600">
          {children}
        </div>
      )}
    </div>
  );
}
