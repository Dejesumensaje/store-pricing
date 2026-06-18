"use client";

import { useRouter } from "next/navigation";
import { Tabs } from "@dejesumensaje/converge-ds-experimental";
import { CHANGE_TYPE_TABS } from "@/lib/pricing-meta";
import { TOTAL_ITEM_COUNT } from "@/lib/mock-data";

type Props = {
  /** active pill value: "all" | PricingCategory */
  active: string;
  /** per-type counts to render in pill labels (optional) */
  counts?: Record<string, number>;
};

export function ChangeTypeNav({ active, counts }: Props) {
  const router = useRouter();

  const tabItems = CHANGE_TYPE_TABS.map((tab) => {
    const count =
      tab.value === "all"
        ? TOTAL_ITEM_COUNT.toLocaleString("en-US")
        : counts?.[tab.value] != null
        ? String(counts[tab.value])
        : null;
    return {
      id: tab.value,
      label: count != null ? `${tab.label} (${count})` : tab.label,
    };
  });

  return (
    <Tabs
      items={tabItems}
      value={active}
      onValueChange={(val) => {
        const tab = CHANGE_TYPE_TABS.find((t) => t.value === val);
        if (tab) router.push(tab.route);
      }}
      aria-label="Change type"
    />
  );
}
