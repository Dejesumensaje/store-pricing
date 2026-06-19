"use client";

import { useMemo, useState, useEffect } from "react";
import Image from "next/image";
import { Drawer, Button, Badge, Select, Checkbox, Switch, useToast } from "@dejesumensaje/converge-ds-experimental";
import { DateField } from "../shared/DateField";
import { usePricingStore } from "@/store/pricing-store";
import { PricingItem, PricingCategory } from "@/types/pricing";
import { PriceInputCell, derivePriceState } from "./PriceInputCell";
import { QtyPriceInput } from "./QtyPriceInput";
import { ReductionInput } from "./ReductionInput";
import { FUEL_SAVER_OPTIONS } from "./columns/tempColumns";
import { ImpactBreakdown } from "./columns/shared";
import { BatchSplitButton } from "../store/BatchSplitButton";
import { PRICE_TYPE_META, PRICE_TYPE_INTENT } from "@/lib/pricing-meta";
import { deriveItemStatus } from "@/lib/item-status";
import { fmt } from "@/lib/format";
import { grossMarginPct, fmtPct, fmtPpDelta } from "@/lib/pricing-math";
import { buildItemsById } from "@/lib/batch-utils";
import { ChevronLeft, ChevronRight, Trash2, Check, Package, Link2, ChevronDown } from "lucide-react";

type Props = {
  itemId: string | null;
  onClose: () => void;
  /** Move to the previous / next item in the current list (undefined = none). */
  onPrev?: () => void;
  onNext?: () => void;
  /** Position of the current item in the list, for the header "X / Y" nav. */
  position?: { index: number; total: number };
  /** The batch being built into (one-click add target). */
  activeBatchId: string | null;
  onSetActiveBatch: (batchId: string | null) => void;
  /** Open the New batch flow pre-seeded with these override ids. */
  onNewBatch: (overrideIds: string[]) => void;
};

const PRICE_TYPE_OPTIONS = (Object.keys(PRICE_TYPE_META) as PricingCategory[]).map((key) => ({
  label: PRICE_TYPE_META[key].label,
  value: key,
}));

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value}</span>
    </div>
  );
}

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
        <span className="text-gray-400">{fmtPct(current)}</span>
        <span className="text-gray-300">→</span>
        <span className="font-semibold text-gray-900">{fmtPct(next)}</span>
        <span className={`w-16 text-right font-medium ${tone}`}>{fmtPpDelta(delta)}</span>
      </div>
    </div>
  );
}


// Per-item editing drawer. Self-driven: resolves the item from the store and
// commits edits through the store actions; navigation walks the caller's list.
export function ItemEditDrawer({ itemId, onClose, onPrev, onNext, position, activeBatchId, onSetActiveBatch, onNewBatch }: Props) {
  const items = usePricingStore((s) => s.items);
  const overrides = usePricingStore((s) => s.overrides);
  const batches = usePricingStore((s) => s.batches);
  const updateBasePrice = usePricingStore((s) => s.updateBasePrice);
  const updateRetailPrice = usePricingStore((s) => s.updateRetailPrice);
  const updateFuelSaver = usePricingStore((s) => s.updateFuelSaver);
  const updatePriceType = usePricingStore((s) => s.updatePriceType);
  const updateAllowanceDates = usePricingStore((s) => s.updateAllowanceDates);
  const acceptNoChange = usePricingStore((s) => s.acceptNoChange);
  const removeFromLooseTray = usePricingStore((s) => s.removeFromLooseTray);
  const addToBatch = usePricingStore((s) => s.addToBatch);
  const toast = useToast();

  const item = items.find((i) => i.id === itemId) ?? null;
  const isTemp = item?.category_type === "temporary_allowance";
  const isEdlp = item?.category_type === "everyday_low_price";
  const isNewItem = item?.category_type === "new_discontinued" && item?.itemStatus === "new";
  // Per-type intent (labels + helper copy). New/discontinued is refined by itemStatus.
  const intent = item
    ? item.category_type === "new_discontinued"
      ? item.itemStatus === "discontinued"
        ? { helper: "Item being removed — set a clearance price or mark for removal.", priceLabel: "Clearance price" }
        : { helper: "New item — set the opening shelf price.", priceLabel: "Initial price" }
      : PRICE_TYPE_INTENT[item.category_type]
    : null;

  const [showFuelSaver, setShowFuelSaver] = useState(false);
  // Multi-unit retail deal toggle ("N for $X"). Seeded from the item's stored
  // quantity so existing deals open expanded.
  const [multiUnit, setMultiUnit] = useState(false);
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

  const openBatches = batches.filter((b) => b.status === "draft" || b.status === "scheduled");
  const activeBatch = openBatches.find((b) => b.id === activeBatchId) ?? null;
  const pendingOverrideIds = item
    ? overrides.filter((o) => o.itemId === item.id && o.status === "pending").map((o) => o.id)
    : [];
  const canBatch = pendingOverrideIds.length > 0;

  // Add this item's pending edits to the active batch (one click), then advance.
  const addToActive = () => {
    if (!activeBatch) return;
    addToBatch(activeBatch.id, pendingOverrideIds);
    toast.success(`Added to “${activeBatch.name}”`);
    advance();
  };
  // Add to a specific batch, make it active for subsequent items, then advance.
  const addToChosen = (batchId: string) => {
    const target = batches.find((b) => b.id === batchId);
    addToBatch(batchId, pendingOverrideIds);
    onSetActiveBatch(batchId);
    if (target) toast.success(`Added to “${target.name}”`);
    advance();
  };

  const discard = () => {
    if (!item) return;
    removeFromLooseTray(`${item.id}:base`);
    if (isTemp) removeFromLooseTray(`${item.id}:retail`);
  };

  const status = item ? deriveItemStatus(item, batches) : null;
  const fuelSaverActive = showFuelSaver || (item?.fuelSaver != null && item.fuelSaver > 0);
  // Offer "Accept (no changes)" only while HQ still suggests a change for this item.
  const showAccept = item != null && !item.reviewed && item.newBasePrice == null && item.recommendedBasePrice !== item.currentBasePrice;

  return (
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
        <div className="flex items-center gap-2">
          <Button variant="tertiary" iconLeft={Trash2} aria-label="Discard changes" disabled={!item?.hasOverride} onClick={discard} />
          <div className="flex-1" />
          {canBatch ? (
            <>
              <Button variant="secondary" onClick={advance}>Save for later</Button>
              <BatchSplitButton
                activeBatch={activeBatch}
                openBatches={openBatches}
                onAddToActive={addToActive}
                onAddToBatch={addToChosen}
                onNewBatch={() => onNewBatch(pendingOverrideIds)}
              />
            </>
          ) : showAccept ? (
            <Button
              variant="primary"
              iconLeft={Check}
              onClick={() => {
                acceptNoChange(item!.id);
                advance();
              }}
            >
              Accept (no changes)
            </Button>
          ) : (
            <Button variant="primary" onClick={advance}>{onNext ? "Next" : "Done"}</Button>
          )}
        </div>
      }
    >
      {item && (
        <div key={item.id} className="flex flex-col gap-6">
          {/* Item identity */}
          <div className="flex items-center gap-3">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
              {item.image ? (
                <Image src={item.image} alt={item.name} width={64} height={64} className="object-cover" />
              ) : (
                <Package className="size-6 text-gray-300" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold text-gray-900">{item.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{item.id} · {item.aisle} · {item.brand}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <Badge tone="neutral" size="sm">{item.itemRole}</Badge>
                {item.linePriceGroup && <Badge tone="in-progress" size="sm">Line price</Badge>}
              </div>
            </div>
          </div>

          {/* Price type — the Select renders its own label; a helper line below
              describes the decision so the form anticipates each use case. */}
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
                <Check className="size-3.5" /> Changed to Base price
              </p>
            )}
          </div>

          {/* Base price — reference values and the new-price input together.
              New items have no "Current"; EDLP adds a permanent-reduction control. */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <div className={isNewItem ? "grid grid-cols-2 gap-4" : "grid grid-cols-3 gap-4"}>
              {!isNewItem && <InfoRow label="Current" value={fmt(item.currentBasePrice)} />}
              <InfoRow label="Cost" value={fmt(item.cost)} />
              <InfoRow label={isNewItem ? "Suggested" : "Recommended"} value={fmt(item.recommendedBasePrice)} />
            </div>
            <div className="mt-3 flex flex-col gap-4 border-t border-gray-200 pt-3">
              {isEdlp && (
                <Field label="Permanent reduction">
                  <ReductionInput
                    reference={item.currentBasePrice}
                    value={item.newBasePrice}
                    onCommit={(price) => updateBasePrice(item.id, price)}
                    defaultMode="amount"
                  />
                </Field>
              )}
              <Field label={intent?.priceLabel ?? "New base price"}>
                <div className="flex items-center gap-2">
                  <PriceInputCell
                    autoFocus
                    recommended={item.recommendedBasePrice}
                    value={item.newBasePrice}
                    state={derivePriceState({ value: item.newBasePrice, status: item.baseOverrideStatus, hasAlert: item.hasAlert })}
                    onCommit={(v) => updateBasePrice(item.id, v)}
                  />
                  {isEdlp && item.newBasePrice != null && item.currentBasePrice - item.newBasePrice > 0.005 && (
                    <span className="text-xs font-medium text-emerald-600">
                      −{fmt(item.currentBasePrice - item.newBasePrice)} (−{Math.round(((item.currentBasePrice - item.newBasePrice) / item.currentBasePrice) * 100)}%)
                    </span>
                  )}
                </div>
              </Field>
              {lineItems.length > 0 && (
                <p className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Link2 className="size-3.5 text-brand" /> Applies to the whole line ({lineItems.length + 1} items)
                </p>
              )}
            </div>
          </div>

          {/* Temporary allowance — retail reference + % off + retail controls. */}
          {isTemp && (() => {
            const curRetail = item.currentRetailPrice ?? item.currentBasePrice;
            const unit = item.newRetailPrice != null ? item.newRetailPrice / Math.max(1, item.newRetailQty ?? 1) : null;
            return (
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <div className="grid grid-cols-3 gap-4">
                  <InfoRow label="Retail current" value={fmt(curRetail)} />
                  <InfoRow label="Allowance cost" value={fmt(item.allowanceCost ?? item.cost)} />
                  <InfoRow label="Retail rec." value={fmt(item.recommendedRetailPrice ?? item.currentBasePrice)} />
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
                    label="New retail price"
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
                    <QtyPriceInput
                      qty={item.newRetailQty ?? null}
                      price={item.newRetailPrice ?? null}
                      recommendedPrice={item.recommendedRetailPrice ?? item.currentBasePrice}
                      state={derivePriceState({ value: item.newRetailPrice, status: item.retailOverrideStatus })}
                      multi={multiUnit}
                      onCommit={(qty, price) => updateRetailPrice(item.id, qty, price)}
                    />
                  </Field>

                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                      <Checkbox
                        checked={fuelSaverActive}
                        onCheckedChange={(c) => {
                          const on = c === true;
                          setShowFuelSaver(on);
                          if (!on) updateFuelSaver(item.id, null);
                        }}
                        aria-label="Add fuel saver"
                      />
                      Add fuel saver
                    </label>
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

                  <Field label="Allowance period">
                    <div className="flex items-center gap-2">
                      <DateField
                        value={item.allowanceStartDate}
                        onChange={(v) => updateAllowanceDates(item.id, v, item.allowanceEndDate ?? null)}
                        aria-label="Allowance start date"
                      />
                      <span className="text-gray-300">–</span>
                      <DateField
                        value={item.allowanceEndDate}
                        onChange={(v) => updateAllowanceDates(item.id, item.allowanceStartDate ?? null, v)}
                        aria-label="Allowance end date"
                      />
                    </div>
                  </Field>
                </div>
              </div>
            );
          })()}

          {/* Live gross margin */}
          {(() => {
            const newBase = item.newBasePrice ?? item.recommendedBasePrice;
            const baseCurrentGm = grossMarginPct(item.currentBasePrice, item.cost);
            const baseNewGm = grossMarginPct(newBase, item.cost);
            const allowanceCost = item.allowanceCost ?? item.cost;
            const currentRetail = item.currentRetailPrice ?? item.currentBasePrice;
            const newRetailUnit =
              (item.newRetailPrice ?? item.recommendedRetailPrice ?? currentRetail) / Math.max(1, item.newRetailQty ?? 1);
            const fuel = item.fuelSaver ?? 0;
            const retailCurrentGm = grossMarginPct(currentRetail, allowanceCost);
            const retailNewGm = grossMarginPct(newRetailUnit, allowanceCost);
            const retailFuelGm = grossMarginPct(newRetailUnit - fuel, allowanceCost);
            return (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Gross margin</p>
                <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3">
                  <MarginRow label={isTemp ? "Base" : "Margin"} current={baseCurrentGm} next={baseNewGm} />
                  {isTemp && (
                    <>
                      <MarginRow label="Retail (allowance)" current={retailCurrentGm} next={retailNewGm} />
                      {fuel > 0 && <MarginRow label="Retail incl. fuel saver" current={retailCurrentGm} next={retailFuelGm} />}
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Competitor prices */}
          {item.competitors && item.competitors.length > 0 && (() => {
            const ourPrice = item.newBasePrice ?? item.currentBasePrice;
            return (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Competitor prices</p>
                <div className="rounded-xl border border-gray-200 bg-white">
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
                          {c.distanceMi != null && <span className="ml-2 text-xs text-gray-400">{c.distanceMi} mi</span>}
                        </div>
                        <div className="flex items-center gap-2 tabular-nums">
                          <span className="text-sm text-gray-700">{fmt(c.price)}</span>
                          <span className={`w-20 text-right text-xs font-medium ${diff > 0 ? "text-red-600" : diff < 0 ? "text-emerald-600" : "text-gray-400"}`}>
                            {diff > 0 ? `+${fmt(diff)} hi` : diff < 0 ? `${fmt(diff)} lo` : "match"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Related items — includes line-price members (flagged), one table. */}
          {(() => {
            const lineIds = new Set(lineItems.map((li) => li.id));
            const merged = [...lineItems, ...relatedItems.filter((ri) => !lineIds.has(ri.id))];
            if (merged.length === 0) return null;
            return (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Related items</p>
                <div className="rounded-xl border border-gray-200 bg-white">
                  {merged.map((ri) => (
                    <div key={ri.id} className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-100 last:border-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-gray-700">{ri.name}</p>
                        <p className="text-xs text-gray-400">{ri.id}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {lineIds.has(ri.id) && <Badge tone="in-progress" size="sm">Line</Badge>}
                        <span className="text-sm tabular-nums text-gray-500">{fmt(ri.newBasePrice ?? ri.currentBasePrice)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Projected impact — de-emphasized, collapsed by default */}
          <ImpactDetails item={item} />
        </div>
      )}
    </Drawer>
  );
}

// Secondary, muted impact panel — kept available but visually understated so the
// drawer's focus stays on the price decision.
function ImpactDetails({ item }: { item: PricingItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left"
      >
        <span className="text-sm font-medium text-gray-500">Projected impact</span>
        <ChevronDown className={`size-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-gray-100 px-4 py-3 text-gray-600">
          <ImpactBreakdown item={item} />
        </div>
      )}
    </div>
  );
}
