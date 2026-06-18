"use client";

import { Drawer, Button, Badge, Select } from "@dejesumensaje/converge-ds-experimental";
import { usePricingStore } from "@/store/pricing-store";
import { PricingItem } from "@/types/pricing";
import { PriceInputCell, derivePriceState } from "./PriceInputCell";
import { QtyPriceInput } from "./QtyPriceInput";
import { FUEL_SAVER_OPTIONS } from "./columns/tempColumns";
import { ImpactBreakdown } from "./columns/shared";
import { fmt, fmtDateShort } from "@/lib/format";
import { ChevronLeft, Trash2 } from "lucide-react";

type Props = {
  item: PricingItem | null;
  variant: "base" | "temp";
  onClose: () => void;
  /** Move to the previous item still needing a decision (undefined = none). */
  onPrev?: () => void;
  /** Move to the next item still needing a decision (undefined = none → finishes the queue). */
  onNext?: () => void;
  /** How many items still need a decision. */
  remaining: number;
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-gray-400">{label}</span>
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

// Per-item editing queue. Price edits commit on blur via the same store actions
// the tables used to call; navigation walks the "still needs a decision" queue.
export function ItemEditDrawer({ item, variant, onClose, onPrev, onNext, remaining }: Props) {
  const updateBasePrice = usePricingStore((s) => s.updateBasePrice);
  const updateRetailPrice = usePricingStore((s) => s.updateRetailPrice);
  const updateFuelSaver = usePricingStore((s) => s.updateFuelSaver);
  const removeFromLooseTray = usePricingStore((s) => s.removeFromLooseTray);

  const isTemp = variant === "temp";

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
          <Button variant="secondary" iconLeft={ChevronLeft} disabled={!onPrev} onClick={onPrev}>
            Previous
          </Button>
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
          <div>
            <p className="text-base font-semibold text-gray-900">{item.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {item.id} · {item.aisle}
            </p>
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

          {/* Impact preview — reuses the table tooltip breakdown on a dark panel. */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Projected impact</p>
            <div className="rounded-xl bg-[#003A5D] px-4 py-3 text-white">
              <ImpactBreakdown item={item} />
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}
