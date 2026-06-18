"use client";

import { Tooltip } from "@dejesumensaje/converge-ds-experimental";
import { Info, ChevronRight } from "lucide-react";

type Props = {
  label: string;
  info?: string;
  current: string;
  next: string;
  impact?: string;
  showImpact?: boolean;
};

export function MetricColumn({ label, info, current, next, impact, showImpact = true }: Props) {
  return (
    <div className="flex flex-col gap-1.5 px-6 first:pl-0">
      <div className="flex items-center gap-1 text-white/70 text-xs font-medium">
        {label}
        {info && (
          <Tooltip content={info}>
            <Info className="size-3 cursor-help" />
          </Tooltip>
        )}
        {!info && <Info className="size-3" />}
      </div>
      <div className="flex items-end gap-2">
        <div className="flex items-center gap-2">
          <span className="text-white text-xl font-semibold leading-none">{current}</span>
          <ChevronRight className="size-4 text-white/40" />
          <span className="text-white text-xl font-semibold leading-none">{next}</span>
        </div>
        {showImpact && impact && (
          <span className="text-emerald-300 text-sm font-semibold leading-none ml-1">{impact}</span>
        )}
      </div>
      <div className="flex gap-2 text-xs text-white/50">
        <span className="min-w-[3.5rem]">Current</span>
        <span className="min-w-[3.5rem]">New</span>
        {showImpact && <span>Impact</span>}
      </div>
    </div>
  );
}
