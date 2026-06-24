"use client";

import { useMemo, useState, useEffect, useId } from "react";
import Image from "next/image";
import { Drawer, Button, Badge, Select, Switch, useToast } from "@dejesumensaje/converge-ds-experimental";
import { DateField } from "../shared/DateField";
import { usePricingStore } from "@/store/pricing-store";
import { BatchSplitButton } from "../store/BatchSplitButton";
import { PricingItem, PricingCategory, OverrideStatus, Batch } from "@/types/pricing";
import { PriceInputCell, derivePriceState } from "./PriceInputCell";
import { RetailReductionField } from "./RetailReductionField";
import { ShelfTagPreview } from "./ShelfTagPreview";
import { ReductionInput } from "./ReductionInput";
import { FUEL_SAVER_OPTIONS } from "./columns/tempColumns";
import { ImpactBreakdown } from "./columns/shared";
import { hqRecRationale } from "@/lib/hq-rec";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { PRICE_TYPE_META, PRICE_TYPE_INTENT } from "@/lib/pricing-meta";
import { deriveItemStatus, hqReviewNeeded } from "@/lib/item-status";
import { fmt } from "@/lib/format";
import { grossMarginPct, fmtPct, fmtPpDelta } from "@/lib/pricing-math";
import { buildItemsById } from "@/lib/batch-utils";
import { ChevronLeft, ChevronRight, RotateCcw, Check, Package, Link2, ChevronDown, Lock, Info } from "lucide-react";

type Props = {
  itemId: string | null;
  /** Which flow opened the drawer — sets the footer's primary action. */
  flow: "all" | "hq";
  /** Open batches the per-item "Add to batch" menu can target. */
  openBatches: Batch[];
  activeBatch: Batch | null;
  /** Assign this item's pending change(s) to a batch (owned by the page). */
  onAddToBatch: (batchId: string, overrideIds: string[]) => void;
  /** Start a new batch seeded with these override ids (owned by the page). */
  onNewBatch: (seedIds: string[]) => void;
  /** Close the drawer and open the "To send" surface (owned by the page). */
  onReviewTags: () => void;
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
  openBatches,
  activeBatch,
  onAddToBatch,
  onNewBatch,
  onReviewTags,
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
  // In a temporary allowance, changing the base (white-tag) price is optional —
  // this reveals the base section, mirroring the fuel-saver toggle.
  const [showBase, setShowBase] = useState(false);
  // Accept-first: a TA with an HQ rec opens on the recommendation; this flips to
  // the reduction-method chooser once the director chooses to set their own price.
  const [changingRetail, setChangingRetail] = useState(false);
  const [confirmRevert, setConfirmRevert] = useState<"base" | "retail" | null>(null);
  // Reset per-item UI reveals when navigating to another item.
  useEffect(() => {
    setShowFuelSaver(false);
    setShowBase(false);
    setChangingRetail(false);
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
        // Edits auto-save the instant they commit — the tag is "printed" and drops
        // into the Tags-to-hang pile. The footer's job is to make that landing spot
        // OBVIOUS (so the change never feels lost) and keep the queue moving. An
        // undecided HQ rec still gets Accept / Keep current first.
        <div className="flex items-center justify-between gap-2">
          {showAccept ? (
            <div className="ml-auto flex items-center gap-2">
              <Button variant="secondary" onClick={keepCurrent}>
                Keep current
              </Button>
              <Button variant="primary" iconLeft={Check} onClick={acceptHqRec}>
                Accept HQ rec
              </Button>
            </div>
          ) : hasPendingOverride ? (
            <>
              <button
                type="button"
                onClick={onReviewTags}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900"
              >
                <Check className="size-4 text-emerald-600" aria-hidden="true" />
                Ready to send · <span className="text-brand">View</span>
              </button>
              <div className="flex items-center gap-2">
                <BatchSplitButton
                  size="sm"
                  activeBatch={activeBatch}
                  openBatches={openBatches}
                  onAddToActive={() => { if (activeBatch) { onAddToBatch(activeBatch.id, myPendingIds); advance(); } }}
                  onAddToBatch={(id) => { onAddToBatch(id, myPendingIds); advance(); }}
                  onNewBatch={() => onNewBatch(myPendingIds)}
                />
                <Button variant="primary" iconRight={onNext ? ChevronRight : undefined} onClick={advance}>
                  {onNext ? "Next" : "Done"}
                </Button>
              </div>
            </>
          ) : (
            <Button
              className="ml-auto"
              variant="primary"
              iconRight={onNext ? ChevronRight : undefined}
              onClick={advance}
            >
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

          {/* What the shopper sees — a live preview of the physical shelf tag(s)
              this edit produces (white regular tag + yellow promo tag). */}
          <ShelfTagPreview item={item} />

          {/* HQ recommendation context — WHAT is proposed and WHY (Sarah: the
              director should understand the recommendation, not just see a price).
              Replaces the old generic "accept it, enter your own, or keep" copy,
              which the accept-first buttons + footer already make obvious. */}
          {hqReviewNeeded(item) && (
            <div className="-mt-2 flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
              <Info className="size-4 shrink-0 text-brand" aria-hidden="true" />
              <span className="text-gray-700">{hqRecRationale(item)}</span>
            </div>
          )}

          {/* Price type — assignable types use a Select; HQ-owned (vendor-funded
              allowance) and system ("no change") types are locked and demoted to a
              quiet one-line caption instead of a titled, non-actionable block. */}
          {typeLocked ? (
            <p className="-mt-2 flex items-center gap-1.5 text-xs text-gray-500">
              <Lock className="size-3.5 shrink-0 text-gray-400" aria-hidden="true" />
              <span>
                <span className="font-medium text-gray-600">{PRICE_TYPE_META[item.category_type].label}</span>
                {isTemp && " · price & dates editable, type set by HQ"}
              </span>
            </p>
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

          {/* Retail price (temporary allowance) — the primary decision: the
              yellow-tag promo price. Accept-first: when HQ has a rec, the section
              opens on it; "Set a different price" reveals the reduction chooser. */}
          {isTemp && (() => {
            const recRetail = item.recommendedRetailPrice ?? item.currentBasePrice;
            // % / $ reductions are taken off the base (white-tag) price — the new
            // base if the director set one, otherwise the current base.
            const baseRef = item.newBasePrice ?? item.currentBasePrice;
            const acceptFirst = showAccept && !changingRetail;
            return (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-gray-700">
                  Retail price <span className="font-normal text-gray-400">· yellow promo tag</span>
                </h3>
                {/* Reference prices (current + HQ rec) intentionally omitted — the
                    shelf preview above already shows the crossed white tag + the
                    yellow tag, so repeating the numbers here is just noise. */}
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="flex flex-col gap-4">
                    {acceptFirst ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <Button variant="primary" iconLeft={Check} onClick={() => updateRetailPrice(item.id, 1, recRetail)}>
                          Accept {fmt(recRetail)}
                        </Button>
                        <Button variant="text-link" onClick={() => setChangingRetail(true)}>
                          Set a different price
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
                            recommendedPrice={recRetail}
                            qty={item.newRetailQty ?? null}
                            price={item.newRetailPrice ?? null}
                            status={item.retailOverrideStatus}
                            onCommit={(qty, price) => updateRetailPrice(item.id, qty, price)}
                          />
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
                        {/* Margin moved to "Projected impact" (consolidated financials). */}
                      </>
                    )}
                  </div>
                </div>
              </section>
            );
          })()}

          {/* Base price — the white-tag shelf price. Primary for base/EDLP/new
              items; optional for a temporary allowance (like fuel saver), since a
              promo usually leaves the regular price untouched. */}
          {(() => {
            const baseActive = !isTemp || showBase || item.newBasePrice != null;
            return (
              <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Base price <span className="font-normal text-gray-400">· white shelf tag</span>
                  </h3>
                  {isTemp && (
                    <Switch
                      checked={baseActive}
                      onCheckedChange={(on) => {
                        setShowBase(on);
                        if (!on && item.newBasePrice != null) revertField("base");
                      }}
                      label="Change base price"
                      labelPosition="left"
                      size="sm"
                    />
                  )}
                </div>
                {baseActive && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <div className="flex flex-col gap-4">
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
                      <Field label={item.category_type === "new_discontinued" ? intent?.priceLabel ?? "New base price" : "New base price"}>
                        <div className="flex items-center gap-2">
                          <PriceInputCell
                            autoFocus={!leadWithType}
                            ariaLabel={item.category_type === "new_discontinued" ? intent?.priceLabel ?? "New base price" : "New base price"}
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
                            HQ recommended {fmt(item.recommendedBasePrice)} · new price{" "}
                            <span className="font-medium text-gray-700">{fmt(item.newBasePrice)}</span>
                          </p>
                        )}
                      </Field>
                      {lineItems.length > 0 && (
                        <p className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Link2 className="size-3.5 text-brand" aria-hidden="true" /> Applies to the whole line ({lineItems.length + 1} items)
                        </p>
                      )}
                    </div>
                  </div>
                )}
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

          {/* Projected impact — de-emphasized, collapsed by default. Margin lives
              here now (consolidated financials), above the sales/units breakdown. */}
          <CollapsibleSection title="Projected impact">
            {(() => {
              if (isTemp) {
                const curRetail = item.currentRetailPrice ?? item.currentBasePrice;
                const allowanceCost = item.allowanceCost ?? item.cost;
                const u =
                  item.newRetailPrice != null
                    ? item.newRetailPrice / Math.max(1, item.newRetailQty ?? 1)
                    : item.recommendedRetailPrice ?? curRetail;
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
                    next={grossMarginPct(item.newBasePrice ?? item.recommendedBasePrice, item.cost)}
                  />
                </div>
              );
            })()}
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
