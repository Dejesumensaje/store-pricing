"use client";

import { useMemo } from "react";
import Image from "next/image";
import { Drawer, Button, Badge, Select } from "@dejesumensaje/converge-ds-experimental";
import { usePricingStore } from "@/store/pricing-store";
import { PricingItem } from "@/types/pricing";
import { PriceInputCell, derivePriceState } from "./PriceInputCell";
import { QtyPriceInput } from "./QtyPriceInput";
import { FUEL_SAVER_OPTIONS } from "./columns/tempColumns";
import { ImpactBreakdown } from "./columns/shared";
import { fmt, fmtDateShort } from "@/lib/format";
import { grossMarginPct, fmtPct, fmtPpDelta } from "@/lib/pricing-math";
import { buildItemsById } from "@/lib/batch-utils";
import { ChevronLeft, Trash2, Check, Package, Link2 } from "lucide-react";

type Props = {
  item: PricingItem | null;
  variant: "base" | "temp";
  onClose: () => void;
  /** Move to the previous item still needing a decision (undefined = none). */
  onPrev?: () => void;
  /** Move to the next item still needing a decision (undefined = none → finishes the queue). */
  onNext?: () => void;
  /** Accept the item as-is (no price change) and advance the queue. */
  onAccept?: () => void;
  /** How many items still need a decision. */
  remaining: number;
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
    </div>
  );
}

// Live gross-margin readout: current → projected, with the percentage-point delta.
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

// Per-item editing queue. Price edits commit on blur via the same store actions
// the tables used to call; navigation walks the "still needs a decision" queue.
export function ItemEditDrawer({ item, variant, onClose, onPrev, onNext, onAccept, remaining }: Props) {
  const updateBasePrice = usePricingStore((s) => s.updateBasePrice);
  const updateRetailPrice = usePricingStore((s) => s.updateRetailPrice);
  const updateFuelSaver = usePricingStore((s) => s.updateFuelSaver);
  const removeFromLooseTray = usePricingStore((s) => s.removeFromLooseTray);

  // Catalogs used to resolve related / line-price items by id.
  const baseItems = usePricingStore((s) => s.baseItems);
  const tempAllowanceItems = usePricingStore((s) => s.tempAllowanceItems);
  const edlpItems = usePricingStore((s) => s.edlpItems);
  const noChangeItems = usePricingStore((s) => s.noChangeItems);
  const newDiscontinuedItems = usePricingStore((s) => s.newDiscontinuedItems);
  const itemsById = useMemo(
    () => buildItemsById([baseItems, tempAllowanceItems, edlpItems, noChangeItems, newDiscontinuedItems]),
    [baseItems, tempAllowanceItems, edlpItems, noChangeItems, newDiscontinuedItems]
  );

  const isTemp = variant === "temp";

  const relatedItems = (item?.relatedItemIds ?? [])
    .map((id) => itemsById.get(id))
    .filter((i): i is PricingItem => i != null);
  const lineItems = item?.linePriceGroup
    ? [...itemsById.values()].filter((i) => i.linePriceGroup === item.linePriceGroup && i.id !== item.id)
    : [];

  const discard = () => {
    if (!item) return;
    removeFromLooseTray(`${item.id}:base`);
    if (isTemp) removeFromLooseTray(`${item.id}:retail`);
  };

  return (
    <Drawer
      open={item != null}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title="Edit price"
      size="md"
      headerActions={
        <Badge tone={remaining > 0 ? "warning" : "success"} size="sm">
          {remaining} left to decide
        </Badge>
      }
      footer={
        <div className="flex items-center gap-2">
          <Button variant="tertiary" iconLeft={Trash2} onClick={discard}>
            Discard
          </Button>
          <Button variant="secondary" iconLeft={ChevronLeft} disabled={!onPrev} onClick={onPrev} aria-label="Previous item" />
          <div className="flex-1" />
          {onAccept && (
            <Button variant="secondary" iconLeft={Check} onClick={onAccept}>
              Accept (no changes)
            </Button>
          )}
          {onNext ? (
            <Button variant="primary" onClick={onNext}>
              Save &amp; next
            </Button>
          ) : (
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
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
              <p className="text-xs text-gray-400 mt-0.5">
                {item.id} · {item.aisle} · {item.brand}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <Badge tone="neutral" size="sm">{item.itemRole}</Badge>
                {item.linePriceGroup && <Badge tone="in-progress" size="sm">Line price</Badge>}
              </div>
            </div>
          </div>

          {/* Reference values */}
          <div className="grid grid-cols-3 gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <InfoRow label="Current" value={fmt(item.currentBasePrice)} />
            <InfoRow label="Cost" value={fmt(item.cost)} />
            <InfoRow label="Recommended" value={fmt(item.recommendedBasePrice)} />
            {isTemp && (
              <>
                <InfoRow label="Retail current" value={fmt(item.currentRetailPrice ?? item.currentBasePrice)} />
                <InfoRow label="Allowance cost" value={fmt(item.allowanceCost ?? item.cost)} />
                <InfoRow
                  label="Retail rec."
                  value={fmt(item.recommendedRetailPrice ?? item.currentBasePrice)}
                />
              </>
            )}
          </div>

          {/* Editable controls */}
          <div className="flex flex-col gap-5">
            <Field label="New base price">
              <PriceInputCell
                recommended={item.recommendedBasePrice}
                value={item.newBasePrice}
                state={derivePriceState({
                  value: item.newBasePrice,
                  status: item.baseOverrideStatus,
                  hasAlert: item.hasAlert,
                })}
                onCommit={(v) => updateBasePrice(item.id, v)}
              />
            </Field>

            {isTemp && (
              <>
                <Field label="New retail price">
                  <QtyPriceInput
                    qty={item.newRetailQty ?? null}
                    price={item.newRetailPrice ?? null}
                    recommendedPrice={item.recommendedRetailPrice ?? item.currentBasePrice}
                    state={derivePriceState({ value: item.newRetailPrice, status: item.retailOverrideStatus })}
                    onCommit={(qty, price) => updateRetailPrice(item.id, qty, price)}
                  />
                </Field>

                <Field label="Fuel saver">
                  <div className="w-[170px]">
                    <Select
                      options={FUEL_SAVER_OPTIONS}
                      value={String(item.fuelSaver ?? "0")}
                      onChange={(v) => updateFuelSaver(item.id, parseFloat(v as string))}
                      label="Fuel saver"
                      size="sm"
                    />
                  </div>
                </Field>

                {item.allowanceStartDate && item.allowanceEndDate && (
                  <p className="text-xs text-gray-400">
                    Allowance period: {fmtDateShort(item.allowanceStartDate)} –{" "}
                    {fmtDateShort(item.allowanceEndDate)}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Live gross margin — recomputed from the user's current edits. */}
          {(() => {
            const newBase = item.newBasePrice ?? item.recommendedBasePrice;
            const baseCurrentGm = grossMarginPct(item.currentBasePrice, item.cost);
            const baseNewGm = grossMarginPct(newBase, item.cost);

            const allowanceCost = item.allowanceCost ?? item.cost;
            const currentRetail = item.currentRetailPrice ?? item.currentBasePrice;
            const newRetailUnit =
              (item.newRetailPrice ?? item.recommendedRetailPrice ?? currentRetail) /
              Math.max(1, item.newRetailQty ?? 1);
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
                      {fuel > 0 && (
                        <MarginRow label="Retail incl. fuel saver" current={retailCurrentGm} next={retailFuelGm} />
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Line price — editing one item can propagate across the priced line. */}
          {lineItems.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5">
                <Link2 className="size-4 text-brand" />
                <p className="text-sm font-medium text-gray-700">Line price ({lineItems.length + 1} items)</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white">
                {lineItems.map((li) => (
                  <div key={li.id} className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-100 last:border-0">
                    <span className="truncate text-sm text-gray-700">{li.name}</span>
                    <span className="text-sm tabular-nums text-gray-500">{fmt(li.newBasePrice ?? li.currentBasePrice)}</span>
                  </div>
                ))}
              </div>
              {item.newBasePrice != null && (
                <Button
                  variant="secondary"
                  size="sm"
                  iconLeft={Link2}
                  className="mt-2"
                  onClick={() => lineItems.forEach((li) => updateBasePrice(li.id, item.newBasePrice!))}
                >
                  Apply {fmt(item.newBasePrice)} to the line
                </Button>
              )}
            </div>
          )}

          {/* Competitor prices — the motivation to move a store-level price. */}
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

          {/* Related items — cross-sell context. */}
          {relatedItems.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Related items</p>
              <div className="rounded-xl border border-gray-200 bg-white">
                {relatedItems.map((ri) => (
                  <div key={ri.id} className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-100 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-gray-700">{ri.name}</p>
                      <p className="text-xs text-gray-400">{ri.id}</p>
                    </div>
                    <span className="text-sm tabular-nums text-gray-500">{fmt(ri.newBasePrice ?? ri.currentBasePrice)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Impact preview — reuses the table tooltip breakdown on a dark panel. */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Projected impact</p>
            <div className="rounded-xl bg-brand px-4 py-3 text-white">
              <ImpactBreakdown item={item} />
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}
