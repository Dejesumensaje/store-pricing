import { Batch, Override, PricingItem } from "@/types/pricing";

export type BatchImpact = {
  itemCount: number;
  salesValue: number;
  marginValue: number;
  unitsValue: number;
};

/**
 * Build an id → item lookup across every catalog. Base price is shared, so the
 * same id can appear in multiple arrays; the first wins (impact fields are
 * identical across copies).
 */
export function buildItemsById(catalogs: PricingItem[][]): Map<string, PricingItem> {
  const map = new Map<string, PricingItem>();
  for (const catalog of catalogs) {
    for (const item of catalog) {
      if (!map.has(item.id)) map.set(item.id, item);
    }
  }
  return map;
}

/** Sum the HQ-provided impact of the items behind a batch's overrides. */
export function aggregateBatchImpact(
  batch: Batch,
  overrides: Override[],
  itemsById: Map<string, PricingItem>
): BatchImpact {
  const overrideById = new Map(overrides.map((o) => [o.id, o]));
  let salesValue = 0;
  let marginValue = 0;
  let unitsValue = 0;

  for (const overrideId of batch.overrideIds) {
    const override = overrideById.get(overrideId);
    if (!override) continue;
    const item = itemsById.get(override.itemId);
    if (!item) continue;
    salesValue += item.impactSalesValue;
    marginValue += item.impactMarginValue;
    unitsValue += item.impactUnitsValue;
  }

  return { itemCount: batch.overrideIds.length, salesValue, marginValue, unitsValue };
}
