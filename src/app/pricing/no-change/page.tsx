"use client";

import { PricingQueuePage } from "@/components/pricing-table/PricingQueuePage";

export default function NoChangePage() {
  return (
    <PricingQueuePage
      active="no_change"
      catalog="noChangeItems"
      newFromHqLabel="items confirmed by HQ"
      newFromHqCount={0}
    />
  );
}
