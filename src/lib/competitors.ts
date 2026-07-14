import { CompetitorPrice } from "@/types/pricing";

// The two competitors HQ always wants to see first, in this order — the
// big-box benchmarks that drive most store-level price reactions. Matched
// case-insensitively against the (free-form) competitor name. A store director
// can override this order for their store (see useCompetitorOrder); this is
// just the fallback when no override is set.
const HQ_DEFAULT_ORDER = ["walmart", "aldi"];

const priorityRank = (name: string, priority: string[]) => {
  const i = priority.indexOf(name.trim().toLowerCase());
  return i === -1 ? priority.length : i;
};

// Distance sort with undefined pushed last (a competitor with no known distance
// shouldn't jump ahead of ones we can actually rank).
const byDistance = (a: CompetitorPrice, b: CompetitorPrice) =>
  (a.distanceMi ?? Infinity) - (b.distanceMi ?? Infinity);

/**
 * Order competitor prices for display: ranked competitors first (in `priority`
 * order — lowercased names, defaults to HQ_DEFAULT_ORDER i.e. Walmart then
 * Aldi), then the rest by ascending distance. Only kicks in when at least one
 * ranked competitor is present — otherwise falls back to pure distance order.
 * Pure (returns a new array).
 */
export function orderCompetitors(
  list: CompetitorPrice[],
  priority: string[] = HQ_DEFAULT_ORDER
): CompetitorPrice[] {
  const hasPriority = list.some((c) => priorityRank(c.name, priority) < priority.length);
  if (!hasPriority) return [...list].sort(byDistance);
  return [...list].sort((a, b) => {
    const ra = priorityRank(a.name, priority);
    const rb = priorityRank(b.name, priority);
    if (ra !== rb) return ra - rb;
    return byDistance(a, b);
  });
}

/** The price to compare against: a director's manual correction, or the assembly/user price if uncorrected. */
export function effectivePrice(c: CompetitorPrice): number {
  return c.manualPrice ?? c.price;
}

/**
 * Competitor index: their effective price as a ratio of our base price (e.g.
 * 0.94 = they're 6% cheaper, 1.06 = they're 6% pricier). `null` when our base
 * price isn't set yet (nothing to divide against).
 */
export function competitorIndex(c: CompetitorPrice, ourBase: number): number | null {
  return ourBase > 0 ? effectivePrice(c) / ourBase : null;
}

/** Human-readable diff label for our price vs. a competitor's, e.g. "+4.2% higher" / "matches". */
export function priceDiffLabel(diff: number, theirPrice: number): string {
  if (diff === 0) return "matches";
  const pct = ((diff / theirPrice) * 100).toFixed(1);
  return diff > 0 ? `+${pct}% higher` : `${pct}% lower`;
}

/** Color class for a diff: red when we're higher, green when lower, neutral when matching. */
export function priceDiffClass(diff: number): string {
  return diff > 0 ? "text-red-600" : diff < 0 ? "text-emerald-600" : "text-gray-500";
}
