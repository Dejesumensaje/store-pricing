"use client";

import { Switch, Button } from "@dejesumensaje/converge-ds-experimental";
import { Settings } from "lucide-react";
import { useState } from "react";
import { SummaryMetrics } from "@/types/pricing";
import { MetricColumn } from "@/components/shared/MetricColumn";

type Props = { metrics: SummaryMetrics };

export function SummaryBar({ metrics }: Props) {
  const [recommendedPrices, setRecommendedPrices] = useState(false);
  const [costAdjusted, setCostAdjusted] = useState(true);

  return (
    <div className="rounded-xl px-6 py-4 bg-gradient-to-r from-brand via-[#0a4d6e] to-[#11607f]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-white font-semibold text-base">Summary</span>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <span className="text-white/70 text-xs">Recommended prices</span>
            <Switch checked={recommendedPrices} onCheckedChange={setRecommendedPrices} aria-label="Toggle recommended prices" size="sm" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/70 text-xs">Cost adjusted</span>
            <Switch checked={costAdjusted} onCheckedChange={setCostAdjusted} aria-label="Toggle cost adjusted" size="sm" />
          </div>
          <Button variant="tertiary" iconLeft={Settings} aria-label="Summary settings" />
        </div>
      </div>

      <div className="flex flex-wrap items-stretch divide-x divide-white/10">
        <MetricColumn label="Sales" info="Total sales for the period" current={`$${metrics.salesCurrent}M`} next={`$${metrics.salesNew}M`} impact={`+${metrics.salesImpactPct}%`} />
        <MetricColumn label="Units" info="Units sold" current={`${metrics.unitsCurrent}M`} next={`${metrics.unitsNew}M`} impact={`+${metrics.unitsImpactPct}%`} />
        <MetricColumn label="Margin" info="Gross margin" current={`$${metrics.marginCurrent}M`} next={`$${metrics.marginNew}M`} impact={`+${metrics.marginImpactPct}%`} />
        <MetricColumn label="Transaction count" info="Number of transactions" current={`${metrics.transactionsCurrent}M`} next={`${metrics.transactionsNew}M`} impact={`+${metrics.transactionsImpactPct}%`} />
        <MetricColumn label="CI vs. Comp" info="Competitive index vs. competition" current={metrics.ciVsCompCurrent.toFixed(2)} next={metrics.ciVsCompNew.toFixed(2)} showImpact={false} />
      </div>
    </div>
  );
}
