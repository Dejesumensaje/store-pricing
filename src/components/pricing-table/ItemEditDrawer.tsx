"use client";

import { useMemo, useState, useEffect, useId } from "react";
import Image from "next/image";
import { Drawer, Button, Badge, Select, Switch, useToast } from "@dejesumensaje/converge-ds-experimental";
import { DateField } from "../shared/DateField";
import { usePricingStore } from "@/store/pricing-store";
import { PricingItem, PricingCategory, OverrideStatus, Batch } from "@/types/pricing";
import { PriceInputCell, derivePriceState } from "./PriceInputCell";
import { RetailReductionField } from "./RetailReductionField";
import { BaseReductionField } from "./BaseReductionField";
import { BatchPickerModal } from "../store/BatchPickerModal";
import { ShelfTagPreview } from "./ShelfTagPreview";
import { FUEL_SAVER_OPTIONS } from "./columns/tempColumns";
import { ImpactBreakdown } from "./columns/shared";
import { hqRecRationale } from "@/lib/hq-rec";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { PRICE_TYPE_META, PRICE_TYPE_INTENT } from "@/lib/pricing-meta";
import { deriveItemStatus, hqReviewNeeded } from "@/lib/item-status";
import { fmt, fmtQtyPrice } from "@/lib/format";
import { grossMarginPct, fmtPct, fmtPpDelta } from "@/lib/pricing-math";
import { buildItemsById } from "@/lib/batch-utils";
import { RotateCcw, Check, Package, Link2, ChevronDown, Lock, Info, Pencil } from "lucide-react";

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
  onClose: () => void;
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
  onClose,
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
  // A brand-new item has no current price to keep — it gets a "set opening price"
  // prompt instead of a read-only "current price" row.
  const isNewItem = item?.category_type === "new_discontinued" && item?.itemStatus === "new";
  // Sent to SAP, not yet confirmed: the change is in flight and nothing can be
  // altered until SAP accepts it. The whole drawer goes read-only/disabled — the
  // Live view, but locked. Tracked per field; `sending` locks shared controls.
  const baseLocked = item?.baseOverrideStatus === "submitted";
  const retailLocked = item?.retailOverrideStatus === "submitted";
  const sending = baseLocked || retailLocked;
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
  // Conscious-edit: the editable price input only appears once the director
  // deliberately chooses to set/change a price (vs. accepting or keeping). Until
  // then the section shows the current price read-only — no premature input.
  const [editingBase, setEditingBase] = useState(false);
  // Accept-first: a TA with an HQ rec opens on the recommendation; this flips to
  // the reduction-method chooser once the director chooses to set their own price.
  const [changingRetail, setChangingRetail] = useState(false);
  const [confirmRevert, setConfirmRevert] = useState<"base" | "retail" | null>(null);
  // On finishing with a pending change, ask where it should go (batch / new / later).
  const [batchPromptOpen, setBatchPromptOpen] = useState(false);
  // Reset per-item UI reveals when navigating to another item.
  useEffect(() => {
    setShowFuelSaver(false);
    setShowBase(false);
    setEditingBase(false);
    setChangingRetail(false);
    setBatchPromptOpen(false);
  }, [itemId]);

  // Editing auto-saves the moment a price commits; finishing simply closes the
  // drawer and returns to the underlying flow. We deliberately don't jump to the
  // next item — that hop added noise without helping the decide-then-send task.
  const advance = () => onClose();

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
    return (
      <div className="flex flex-col gap-4">
        <Field label={priceLabel} action={revertAction}>
          {isEdlp ? (
            // EDLP is a markdown decision — like a temporary allowance, the
            // director picks HOW to apply it (% off / $ off / exact).
            <BaseReductionField
              reference={item.currentBasePrice}
              recommended={item.recommendedBasePrice}
              value={item.newBasePrice}
              status={item.baseOverrideStatus}
              hasAlert={item.hasAlert}
              ariaLabel={priceLabel}
              onCommit={commitBase}
            />
          ) : (
            <>
              <PriceInputCell
                autoFocus
                ariaLabel={priceLabel}
                recommended={item.recommendedBasePrice}
                value={item.newBasePrice}
                state={derivePriceState({ value: item.newBasePrice, status: item.baseOverrideStatus, hasAlert: item.hasAlert })}
                onCommit={commitBase}
              />
              {isHq && item.newBasePrice != null && (
                <p className="mt-1.5 text-xs tabular-nums text-gray-500">
                  HQ recommended {fmt(item.recommendedBasePrice)} · new price{" "}
                  <span className="font-medium text-gray-700">{fmt(item.newBasePrice)}</span>
                </p>
              )}
            </>
          )}
        </Field>
        {lineItems.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <Link2 className="size-3.5 text-brand" aria-hidden="true" /> Applies to the whole line ({lineItems.length + 1} items)
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
      title={sending ? "Price details" : "Edit prices"}
      size="md"
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
              Change saved · ready to send
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
                {item.linePriceGroup && <Badge tone="neutral" size="sm">Line price</Badge>}
              </div>
            </div>
          </div>

          {/* What the shopper sees — a live preview of the physical shelf tag(s)
              this edit produces (white regular tag + yellow promo tag). */}
          <ShelfTagPreview item={item} />

          {/* Sent to SAP — the whole drawer is read-only until SAP confirms. */}
          {sending && (
            <div className="-mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
              <Lock className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
              <span className="text-amber-900">
                Sent to SAP — locked until SAP confirms it. Nothing here can be changed yet.
              </span>
            </div>
          )}

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
          {typeLocked || sending ? (
            <p className="-mt-2 flex items-center gap-1.5 text-xs text-gray-500">
              <Lock className="size-3.5 shrink-0 text-gray-400" aria-hidden="true" />
              <span>
                <span className="font-medium text-gray-600">{PRICE_TYPE_META[item.category_type].label}</span>
                {/* Don't claim "editable" once it's sent. */}
                {isTemp && !sending && " · price & dates editable, type set by HQ"}
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
            const curRetail = item.currentRetailPrice ?? item.currentBasePrice;
            const retailDecided = item.newRetailPrice != null;
            // Accept-first only while an HQ rec is undecided; once decided or once
            // the director opts to set their own price, show the reduction field.
            const acceptFirst = showAccept && !changingRetail && !retailDecided;
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
                    {retailLocked ? (
                      // Sent to SAP — read-only until SAP confirms.
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm tabular-nums">
                          <Lock className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
                          <span className="text-gray-400 line-through">{fmt(curRetail)}</span>
                          <span aria-hidden="true" className="text-gray-300">→</span>
                          <span className="text-base font-semibold text-gray-900">{fmtQtyPrice(item.newRetailQty, item.newRetailPrice ?? curRetail)}</span>
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
                      // Decided — show the promo price as the director left it
                      // (accepted or set), not the editable chooser. The input
                      // returns only on an explicit "Change". Mirrors base.
                      <div className="decision-pop flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm tabular-nums">
                          <Check className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                          <span className="text-gray-400 line-through">{fmt(curRetail)}</span>
                          <span aria-hidden="true" className="text-gray-300">→</span>
                          <span className="text-base font-semibold text-gray-900">{fmtQtyPrice(item.newRetailQty, item.newRetailPrice ?? curRetail)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="text-link" size="sm" onClick={() => setChangingRetail(true)}>Change</Button>
                          <Button
                            variant="tertiary"
                            size="sm"
                            iconLeft={RotateCcw}
                            aria-label="Revert to current retail price"
                            onClick={() => revertField("retail")}
                          />
                        </div>
                      </div>
                    ) : !changingRetail ? (
                      // No HQ rec and no decision yet — show the live promo price
                      // read-only; editing waits for a conscious "Set promo price".
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-baseline gap-2 tabular-nums">
                          <span className="text-xs text-gray-500">Current</span>
                          <span className="text-base font-semibold text-gray-900">{fmt(curRetail)}</span>
                        </div>
                        <Button variant="secondary" size="sm" iconLeft={Pencil} onClick={() => setChangingRetail(true)}>
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

          {/* Base price — the white-tag shelf price. For base/EDLP items it's the
              primary (conscious-edit) decision; for new/discontinued it must be set;
              for a temporary allowance it's an optional toggle (promos usually leave
              the regular price untouched). The editable input only appears after a
              deliberate Accept / Set-a-price / Change — never up front. */}
          {!isTemp && (() => {
            const rec = item.recommendedBasePrice;
            const decided = item.newBasePrice != null;
            // The editable input appears only on a deliberate Change — never up
            // front. A discontinued item with an HQ rec gets the accept-first block
            // like any base; a brand-new item gets a "Set opening price" prompt.
            const showInput = editingBase;
            return (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-gray-700">
                  Base price <span className="font-normal text-gray-400">· white shelf tag</span>
                </h3>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                  {baseLocked ? (
                    // Sent to SAP — read-only, no edit/revert until SAP confirms.
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm tabular-nums">
                        <Lock className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
                        <span className="text-gray-400 line-through">{fmt(item.currentBasePrice)}</span>
                        <span aria-hidden="true" className="text-gray-300">→</span>
                        <span className="text-base font-semibold text-gray-900">{fmt(item.newBasePrice ?? item.currentBasePrice)}</span>
                      </div>
                      <span className="text-xs font-medium text-gray-500">Locked</span>
                    </div>
                  ) : showInput ? (
                    baseInputBlock()
                  ) : decided ? (
                    // Decided — a compact, popping confirmation of the new price.
                    // New items have no "current" to strike through — just the price.
                    <div className="decision-pop flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm tabular-nums">
                        <Check className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                        {!isNewItem && (
                          <>
                            <span className="text-gray-400 line-through">{fmt(item.currentBasePrice)}</span>
                            <span aria-hidden="true" className="text-gray-300">→</span>
                          </>
                        )}
                        <span className="text-base font-semibold text-gray-900">{fmt(item.newBasePrice ?? item.currentBasePrice)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="text-link" size="sm" onClick={() => setEditingBase(true)}>Change</Button>
                        <Button
                          variant="tertiary"
                          size="sm"
                          iconLeft={RotateCcw}
                          aria-label="Revert to current base price"
                          onClick={() => { revertField("base"); setEditingBase(false); }}
                        />
                      </div>
                    </div>
                  ) : showAccept ? (
                    // HQ rec awaiting a call — accept it, set your own, or keep current.
                    // All three are DS buttons at one size (sm), primary + two secondary.
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
                    // No change yet — show the live price (or a new-item prompt);
                    // the input only appears on a deliberate Set price / Change.
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
                </div>
              </section>
            );
          })()}

          {/* Temporary allowance: base price is an optional change (Switch), since a
              promo usually leaves the regular white-tag price untouched. */}
          {isTemp && (() => {
            const baseActive = showBase || item.newBasePrice != null;
            return (
              <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Base price <span className="font-normal text-gray-400">· white shelf tag</span>
                  </h3>
                  <Switch
                    checked={baseActive}
                    disabled={sending}
                    onCheckedChange={(on) => {
                      setShowBase(on);
                      if (!on && item.newBasePrice != null) revertField("base");
                    }}
                    label="Change base price"
                    labelPosition="left"
                    size="sm"
                  />
                </div>
                {baseActive && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    {baseLocked ? (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm tabular-nums">
                          <Lock className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
                          <span className="text-gray-400 line-through">{fmt(item.currentBasePrice)}</span>
                          <span aria-hidden="true" className="text-gray-300">→</span>
                          <span className="text-base font-semibold text-gray-900">{fmt(item.newBasePrice ?? item.currentBasePrice)}</span>
                        </div>
                        <span className="text-xs font-medium text-gray-500">Locked</span>
                      </div>
                    ) : item.newBasePrice != null && !editingBase ? (
                      // Decided — show the new base price as left, not the input.
                      <div className="decision-pop flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm tabular-nums">
                          <Check className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                          <span className="text-gray-400 line-through">{fmt(item.currentBasePrice)}</span>
                          <span aria-hidden="true" className="text-gray-300">→</span>
                          <span className="text-base font-semibold text-gray-900">{fmt(item.newBasePrice)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="text-link" size="sm" onClick={() => setEditingBase(true)}>Change</Button>
                          <Button
                            variant="tertiary"
                            size="sm"
                            iconLeft={RotateCcw}
                            aria-label="Revert to current base price"
                            onClick={() => { revertField("base"); setShowBase(false); setEditingBase(false); }}
                          />
                        </div>
                      </div>
                    ) : (
                      baseInputBlock()
                    )}
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
                    disabled={sending}
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
                        {lineIds.has(ri.id) && <Badge tone="neutral" size="sm">Line</Badge>}
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

    {/* Where should this change go? — asked on Done so the batch decision is a
        deliberate step, not a confusing footer split-button. Same modal the bulk
        bar and the Review worklist use. */}
    <BatchPickerModal
      open={batchPromptOpen}
      onOpenChange={(o) => { if (!o) setBatchPromptOpen(false); }}
      description="Your change is saved. Group it into a batch to control when it reaches SAP — or leave it and sort it later from To send."
      openBatches={openBatches}
      activeBatch={activeBatch}
      count={new Set(myPendingIds.map((id) => id.split(":")[0])).size}
      onAddToBatch={(id) => { onAddToBatch(id, myPendingIds); closeAfterBatch(); }}
      onNewBatch={() => { onNewBatch(myPendingIds); closeAfterBatch(); }}
      onLater={closeAfterBatch}
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
        <span className="text-sm font-semibold text-gray-700">
          {title}
          {count != null && <span className="ml-1 font-normal text-gray-400">({count})</span>}
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
