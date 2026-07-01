// The stores this director manages. Single source of truth for the store
// switcher, the page header, and the shelf-tag preview ("Pricing at {name}").
// A director runs ~5 stores; #1402 is the primary (richly seeded) demo store.
export type Store = {
  id: string;
  name: string;
  address: string;
};

export const STORES: Store[] = [
  { id: "1402", name: "Store #1402", address: "902 S. Locust St, Glenwood, IA 51534" },
  { id: "1287", name: "Store #1287", address: "1745 Madison Ave, Council Bluffs, IA 51503" },
  { id: "1521", name: "Store #1521", address: "705 S. Fremont St, Shenandoah, IA 51601" },
  { id: "1364", name: "Store #1364", address: "800 Senate Ave, Red Oak, IA 51566" },
  { id: "1198", name: "Store #1198", address: "1101 1st Corso, Nebraska City, NE 68410" },
];

// The store the app boots into.
export const DEFAULT_STORE_ID = STORES[0].id;

// The demo persona: the director who manages these stores. Single source of
// truth for anywhere the UI shows the signed-in user.
export const DIRECTOR = { name: "Nora Larsen", initials: "NL" };

export const storeById = (id: string): Store | undefined => STORES.find((s) => s.id === id);
