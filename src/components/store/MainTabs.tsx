"use client";

import { Tabs } from "@dejesumensaje/converge-ds-experimental";

export type MainTab = "all" | "hq";

type Props = {
  value: MainTab;
  onChange: (tab: MainTab) => void;
  allCount: number;
  hqCount: number;
};

export function MainTabs({ value, onChange, allCount, hqCount }: Props) {
  return (
    <Tabs
      size="sm"
      value={value}
      onValueChange={(v) => onChange(v as MainTab)}
      items={[
        { id: "all", label: "All items", count: allCount },
        { id: "hq", label: "HQ Recommendations", count: hqCount },
      ]}
    />
  );
}
