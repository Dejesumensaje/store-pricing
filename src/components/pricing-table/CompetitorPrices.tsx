"use client";

import { useState } from "react";
import { Badge, Button, Tooltip } from "@dejesumensaje/converge-ds-experimental";
import { Pencil, Store } from "lucide-react";
import { PricingItem } from "@/types/pricing";
import { usePricingStore } from "@/store/pricing-store";
import { orderCompetitors, effectivePrice, competitorIndex, priceDiffLabel, priceDiffClass } from "@/lib/competitors";
import { fmt } from "@/lib/format";
import { perUnit } from "@/lib/pricing-math";
import { EmptyState } from "../shared/EmptyState";
import { CompetitorPricesModal } from "./CompetitorPricesModal";

type Props = {
  item: PricingItem;
};

const FIELD_LABEL = "text-[10px] font-semibold uppercase tracking-wide text-gray-400";

// Competitor prices has its own identity — a flat section (h3 + gray subtitle,
// no CollapsibleSection chrome), so it doesn't read as another accordion in
// the Product relationships family. Base and Retail (their active TPR) are
// compared side by side; the index stays a base ratio. Owns its modal's open
// state; the modal renders as a sibling, not lifted into ItemEditDrawer.
// Editing is desktop-only — the Edit button hides below md.
export function CompetitorPrices({ item }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const updateCompetitors = usePricingStore((s) => s.updateCompetitors);

  // Compare per-unit — a pack-size base competes on its unit price.
  const ourBase = item.newBasePrice != null ? perUnit(item.newBasePrice, item.newBaseQty) : item.currentBasePrice;
  // Our retail: the pending promo price, else the live one for TA items.
  // Null = we have no retail price to compare against (their TPRs still show).
  const ourRetail =
    item.newRetailPrice != null
      ? perUnit(item.newRetailPrice, item.newRetailQty)
      : item.category_type === "temporary_allowance"
        ? item.currentRetailPrice ?? null
        : null;
  const orderedCompetitors = orderCompetitors(item.competitors ?? []);
  // The Retail column earns its space only when someone has a retail price.
  const showRetail = ourRetail != null || orderedCompetitors.some((c) => c.retailPrice != null);

  // Name column + Base + (Retail) + Index. Index is the most derived datum —
  // it yields its column on mobile so Base/Retail stay readable.
  const grid = showRetail
    ? "grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] md:grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_2.5rem] items-start gap-2"
    : "grid grid-cols-[minmax(0,1fr)_5.5rem] md:grid-cols-[minmax(0,1fr)_5.5rem_2.5rem] items-start gap-2";

  return (
    <>
      <section className="flex flex-col gap-2">
        <div className="flex min-h-6 items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-700">
            Competitor prices <span className="font-normal text-gray-400">· vs our prices</span>
          </h3>
          <Button
            variant="secondary"
            size="sm"
            iconLeft={Pencil}
            className="max-md:hidden"
            onClick={() => setModalOpen(true)}
          >
            Edit
          </Button>
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {orderedCompetitors.length === 0 ? (
            <EmptyState
              icon={Store}
              title="No competitor prices yet"
              hint="Add a competitor to compare against our base price."
              bordered={false}
              className="py-8"
            />
          ) : (
            <>
              {/* The Our-price row doubles as column header (stacked labels)
                  and comparison anchor (index 1.00 = our base). */}
              <div className={`${grid} px-4 py-2 border-b border-gray-100 bg-gray-50`}>
                <span className="self-center text-xs font-medium text-gray-500">Our price</span>
                <span className="flex flex-col items-end tabular-nums">
                  <span className={FIELD_LABEL}>Base</span>
                  <span className="text-sm font-semibold text-gray-900">{fmt(ourBase)}</span>
                </span>
                {showRetail && (
                  <span className="flex flex-col items-end tabular-nums">
                    <span className={FIELD_LABEL}>Retail</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {ourRetail != null ? fmt(ourRetail) : "—"}
                    </span>
                  </span>
                )}
                <Tooltip
                  className="max-w-64"
                  content="Competitor price index — competitor price ÷ our base price. 1.00 matches our base; below 1.00 the competitor is cheaper."
                >
                  <span className="flex cursor-help flex-col items-end tabular-nums max-md:hidden">
                    <span className={FIELD_LABEL}>Index</span>
                    <span className="text-xs text-gray-400">1.00</span>
                  </span>
                </Tooltip>
              </div>
              {orderedCompetitors.map((c) => {
                const price = effectivePrice(c);
                const baseDiff = ourBase - price;
                const retailDiff =
                  c.retailPrice != null && ourRetail != null ? ourRetail - c.retailPrice : null;
                const meta =
                  c.source === "user"
                    ? c.address ?? null
                    : [c.distanceMi != null ? `${c.distanceMi} mi` : null, c.address ?? null]
                        .filter(Boolean)
                        .join(" · ") || null;
                return (
                  <div key={c.name} className={`${grid} px-4 py-1.5 border-b border-gray-100 last:border-0`}>
                    <div className="min-w-0">
                      {/* flex-wrap: on narrow screens the badge drops below rather than breaking the name */}
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <span className="text-sm text-gray-700">{c.name}</span>
                        {c.source === "user" && (
                          <Badge tone="neutral" size="sm">Added by you</Badge>
                        )}
                      </div>
                      {meta && <div className="truncate text-xs text-gray-500">{meta}</div>}
                    </div>
                    <div className="flex flex-col items-end tabular-nums">
                      {c.manualPrice != null ? (
                        <span className="flex items-center gap-1 text-sm">
                          <span className="text-gray-400 line-through">{fmt(c.price)}</span>
                          <span aria-hidden="true" className="text-gray-300">→</span>
                          <span className="font-medium text-gray-900">{fmt(c.manualPrice)}</span>
                        </span>
                      ) : (
                        <span className="text-sm text-gray-700">{fmt(price)}</span>
                      )}
                      <span className={`text-xs font-medium ${priceDiffClass(baseDiff)}`}>
                        {priceDiffLabel(baseDiff, price)}
                      </span>
                    </div>
                    {showRetail && (
                      <div className="flex flex-col items-end tabular-nums">
                        {c.retailPrice != null ? (
                          <>
                            <span className="text-sm text-gray-700">{fmt(c.retailPrice)}</span>
                            {retailDiff != null && (
                              <span className={`text-xs font-medium ${priceDiffClass(retailDiff)}`}>
                                {priceDiffLabel(retailDiff, c.retailPrice)}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </div>
                    )}
                    <span className="text-right text-xs text-gray-500 max-md:hidden">
                      {competitorIndex(c, ourBase)?.toFixed(2) ?? "—"}
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </section>
      <CompetitorPricesModal
        open={modalOpen}
        item={item}
        ourBase={ourBase}
        onClose={() => setModalOpen(false)}
        onSave={(competitors) => {
          updateCompetitors(item.id, competitors);
          setModalOpen(false);
        }}
      />
    </>
  );
}
