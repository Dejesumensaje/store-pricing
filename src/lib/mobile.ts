import { PricingItem } from "@/types/pricing";

// Deterministic char-sum hash — no Math.random, so every id always produces
// the same digits (hydration-safe, and re-derivable without storing state).
function hashDigits(id: string, length: number): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  let digits = "";
  for (let i = 0; i < length; i++) {
    digits += (h % 10).toString();
    h = Math.floor(h / 7) + i + 1;
  }
  return digits;
}

// Standard UPC-A check digit: 3x the odd positions + the even positions,
// rounded up to the next multiple of 10, minus the total.
function upcCheckDigit(digits11: string): string {
  let oddSum = 0;
  let evenSum = 0;
  for (let i = 0; i < 11; i++) {
    const d = Number(digits11[i]);
    if (i % 2 === 0) oddSum += d;
    else evenSum += d;
  }
  const total = oddSum * 3 + evenSum;
  return ((10 - (total % 10)) % 10).toString();
}

/**
 * Deterministic 12-digit UPC-A for an item id — the mock catalog has no real
 * UPC, so every mobile scan flow (wedge, simulate-scan, UPC-entry fallback)
 * resolves against this synthesized code. Same id always yields the same
 * UPC, so it's stable across renders/hydration without being stored.
 */
export function upcFromId(id: string): string {
  const body = hashDigits(id, 11);
  return body + upcCheckDigit(body);
}

/** Reverse lookup: the catalog item whose (real or synthesized) UPC matches. */
export function findItemByUpc(items: PricingItem[], upc: string): PricingItem | undefined {
  return items.find((i) => (i.upc ?? upcFromId(i.id)) === upc);
}

// Curated ids for the "Simulate scan" sheet (mobile prototype's stand-in for
// a real Zebra DataWedge trigger) — a deliberate spread of demo states so a
// walkthrough can hit every interesting path: W7BESS (live temp allowance),
// RBCS5-1 (family pricing), HQ-103 (HQ recommendation), EDLP-3 (ceiling
// breach with a store exception), EDLP-5 (clean EDLP), NC-1 (no_change item
// that auto-promotes to Base the moment a price is typed).
export const SIMULATED_SCAN_IDS = ["W7BESS", "RBCS5-1", "HQ-103", "EDLP-3", "EDLP-5", "NC-1"];

// Coarse category → department map for the mobile Details disclosure. Not
// exhaustive of every synthetic-catalog category; falls back to "Grocery".
export const CATEGORY_TO_DEPARTMENT: Record<string, string> = {
  Snacks: "Grocery",
  Beverages: "Grocery",
  Coffee: "Grocery",
  Dairy: "Dairy",
  Frozen: "Frozen",
  Bakery: "Bakery",
  Cereal: "Grocery",
  "Pasta & sauce": "Grocery",
  "Canned goods": "Grocery",
  Condiments: "Grocery",
  Baking: "Grocery",
  Candy: "Grocery",
  Meat: "Meat & Seafood",
  Seafood: "Meat & Seafood",
  Produce: "Produce",
  "Health & beauty": "Health & Beauty",
  Household: "Household",
  Pet: "Pet",
  Baby: "Baby",
  Breakfast: "Grocery",
};

export function departmentForCategory(category: string): string {
  return CATEGORY_TO_DEPARTMENT[category] ?? "Grocery";
}

// ISO date helpers for the mobile meta chips (effective dates). Same
// YYYY-MM-DD shape the pricing-store mutators default with.
export function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isoAddDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
