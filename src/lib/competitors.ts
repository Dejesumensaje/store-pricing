import { CompetitorPrice } from "@/types/pricing";

// The two competitors HQ always wants to see first, in this order — the
// big-box benchmarks that drive most store-level price reactions. Matched
// case-insensitively against the (free-form) competitor name. A store director
// can override this order for their store (see useCompetitorOrder); this is
// just the fallback when no override is set.
export const HQ_DEFAULT_ORDER = ["walmart", "aldi"];

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
