import { PricingItem } from "@/types/pricing";

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
