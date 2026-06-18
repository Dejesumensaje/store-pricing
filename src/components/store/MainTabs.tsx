"use client";

import { Tabs } from "@dejesumensaje/converge-ds-experimental";

export type MainTab = "all" | "hq" | "batch";

type Props = {
  value: MainTab;
  onChange: (tab: MainTab) => void;
  allCount: number;
  hqCount: number;
  batchCount: number;
};

export function MainTabs({ value, onChange, allCount, hqCount, batchCount }: Props) {
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onChange(v as MainTab)}
      items={[
        { id: "all", label: "All items", count: allCount },
        { id: "hq", label: "HQ Recommendations", count: hqCount },
        { id: "batch", label: "Batch tray", count: batchCount },
      ]}
    />
  );
}
