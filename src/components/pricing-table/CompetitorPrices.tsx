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

// Competitor prices has its own identity — a flat section (h3 + gray subtitle,
// no CollapsibleSection chrome), so it doesn't read as another accordion in
// the Product relationships family. Base-only for now (retailPrice stays in
// the model but isn't rendered here). Owns its modal's open state; the modal
// renders as a sibling, not lifted into ItemEditDrawer.
export function CompetitorPrices({ item }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const updateCompetitors = usePricingStore((s) => s.updateCompetitors);

  // Compare per-unit — a pack-size base competes on its unit price.
  const ourBase = item.newBasePrice != null ? perUnit(item.newBasePrice, item.newBaseQty) : item.currentBasePrice;
  const orderedCompetitors = orderCompetitors(item.competitors ?? []);

  return (
    <>
      <section className="flex flex-col gap-2">
        <div className="flex min-h-6 items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-700">
            Competitor prices <span className="font-normal text-gray-400">· vs our base</span>
          </h3>
          <Button variant="secondary" size="sm" iconLeft={Pencil} onClick={() => setModalOpen(true)}>
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
              <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50">
                <span className="text-xs font-medium text-gray-500">Our base price</span>
                {/* Mirrors the competitor-row grid ([price][diff w-24][index w-10]) so the
                    price lands in the price column. INDEX stacks directly above 1.00
                    inside the index column itself — the row doubles as column header
                    (label) and parity anchor (1.00 = our base). */}
                <span className="flex items-center gap-2 tabular-nums">
                  <span className="text-sm font-semibold text-gray-900">{fmt(ourBase)}</span>
                  <span aria-hidden="true" className="w-24" />
                  <Tooltip
                    className="max-w-64"
                    content="Competitor price index — competitor price ÷ our base price. 1.00 matches our base; below 1.00 the competitor is cheaper."
                  >
                    <span className="flex w-10 cursor-help flex-col items-end">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Index</span>
                      <span className="text-xs text-gray-400">1.00</span>
                    </span>
                  </Tooltip>
                </span>
              </div>
              {orderedCompetitors.map((c) => {
                const price = effectivePrice(c);
                const diff = ourBase - price;
                const meta =
                  c.source === "user"
                    ? c.address ?? null
                    : [c.distanceMi != null ? `${c.distanceMi} mi` : null, c.address ?? null]
                        .filter(Boolean)
                        .join(" · ") || null;
                return (
                  <div
                    key={c.name}
                    className="flex items-start justify-between gap-3 px-4 py-1.5 border-b border-gray-100 last:border-0"
                  >
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
                    <div className="flex items-center gap-2 tabular-nums">
                      {c.manualPrice != null ? (
                        <span className="flex items-center gap-1.5 text-sm">
                          <span className="text-gray-400 line-through">{fmt(c.price)}</span>
                          <span aria-hidden="true" className="text-gray-300">→</span>
                          <span className="font-medium text-gray-900">{fmt(c.manualPrice)}</span>
                        </span>
                      ) : (
                        <span className="text-sm text-gray-700">{fmt(price)}</span>
                      )}
                      <span className={`w-24 text-right text-xs font-medium ${priceDiffClass(diff)}`}>
                        {priceDiffLabel(diff, price)}
                      </span>
                      <span className="w-10 text-right text-xs text-gray-500">
                        {competitorIndex(c, ourBase)?.toFixed(2) ?? "—"}
                      </span>
                    </div>
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
