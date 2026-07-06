import { CompetitorPrice } from "@/types/pricing";

// The two competitors a director always wants to see first, in this order — the
// big-box benchmarks that drive most store-level price reactions. Matched
// case-insensitively against the (free-form) competitor name.
const PRIORITY = ["walmart", "aldi"];

const priorityRank = (name: string) => {
  const i = PRIORITY.indexOf(name.trim().toLowerCase());
  return i === -1 ? PRIORITY.length : i;
};

// Distance sort with undefined pushed last (a competitor with no known distance
// shouldn't jump ahead of ones we can actually rank).
const byDistance = (a: CompetitorPrice, b: CompetitorPrice) =>
  (a.distanceMi ?? Infinity) - (b.distanceMi ?? Infinity);

/**
 * Order competitor prices for display: Walmart first, Aldi second, then the rest
 * by ascending distance. Only kicks in when at least one of Walmart/Aldi is
 * present — otherwise falls back to pure distance order. Pure (returns a new array).
 */
export function orderCompetitors(list: CompetitorPrice[]): CompetitorPrice[] {
  const hasPriority = list.some((c) => priorityRank(c.name) < PRIORITY.length);
  if (!hasPriority) return [...list].sort(byDistance);
  return [...list].sort((a, b) => {
    const ra = priorityRank(a.name);
    const rb = priorityRank(b.name);
    if (ra !== rb) return ra - rb;
    return byDistance(a, b);
  });
}
