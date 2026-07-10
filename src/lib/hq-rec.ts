import { PricingItem } from "@/types/pricing";
import { fmt } from "@/lib/format";

// Savings the Hy-Vee way: cents under a dollar ("78¢"), dollars above.
export function fmtSaveAmt(n: number): string {
  return n < 1 ? `${Math.round(n * 100)}¢` : fmt(n);
}

function shortDate(iso?: string | null): string | null {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// What HQ is proposing, in plain terms — so the director understands the
// recommendation, not just sees a price. A vendor-funded allowance leads with
// its funding + window; base/EDLP/new state the move and its direction.
// `section` scopes the sentence to the price being decided: the promo sentence
// belongs to the retail (yellow-tag) section only — a TA that also carries a
// base rec must not describe its BASE move in promo terms.
export function hqRecRationale(item: PricingItem, section: "base" | "retail" = "retail"): string {
  if (section === "retail" && item.category_type === "temporary_allowance") {
    const rec = item.recommendedRetailPrice ?? item.currentBasePrice;
    const save = item.currentBasePrice - rec;
    const start = shortDate(item.allowanceStartDate);
    const end = shortDate(item.allowanceEndDate);
    const when = end ? ` · runs ${start ? `${start}–${end}` : `through ${end}`}` : "";
    const saved = save > 0.005 ? ` · save ${fmtSaveAmt(save)}` : "";
    return `HQ proposes a vendor-funded promo${saved}${when}.`;
  }
  const rec = item.recommendedBasePrice;
  const delta = rec - item.currentBasePrice;
  const verb = delta > 0.005 ? "raising" : delta < -0.005 ? "lowering" : "updating";
  return `HQ recommends ${verb} the price to ${fmt(rec)} (from ${fmt(item.currentBasePrice)}).`;
}
