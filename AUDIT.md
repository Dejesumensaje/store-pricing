# Accessibility, usability, UX & visual audit

Scope: the single-screen Store Pricing app (`src/app/page.tsx` — items table + All/HQ tabs + edit drawer + Batch tray). Covers accessibility, usability/flows, visual consistency, and micro-interactions.

Severity: **High** (breaks a11y or a flow) · **Med** (noticeable gap) · **Low** (polish).
Status: ✅ fixed in this pass · ⬜ tracked / follow-up.

> Note: an earlier version of this file described a sidebar/dashboard/`pricing/*`-route app that no longer exists. It has been rewritten for the current one-screen architecture.

---

## A. Accessibility

| # | Sev | Finding | Location | Status |
|---|-----|---------|----------|--------|
| A1 | High | Desktop table rows are clickable but **not keyboard-operable** (no `role`/`tabIndex`/`onKeyDown`) | `DataTable.tsx` | ✅ rows get `role="button"`, `tabIndex`, Enter/Space handler (guarded so inner checkbox keeps its keys) + `focus-visible` ring |
| A2 | High | `ScanOverlay` is a hand-rolled `fixed inset-0` div: no dialog role, no focus trap/restore | `ScanOverlay.tsx` | ✅ `role="dialog"` + `aria-modal` + label; focus moves to Close on open, restores to trigger on close; Escape closes; basic Tab trap |
| A3 | High | Price `<input>` had no associated label (the `Field` label is an unlinked `<span>`) | `PriceInputCell.tsx`, `ItemEditDrawer.tsx` | ✅ added `ariaLabel` prop, passed the field label through |
| A4 | Med | Custom dropdowns lacked menu semantics + focus management (only Escape worked) | `ColumnsMenu.tsx`, `BatchSplitButton.tsx` | ✅ `aria-haspopup`; `role="group"` (column settings) / `role="menu"`+`menuitem` (batch); shared `useMenuNav` moves focus in, roams with arrows, restores on Escape |
| A5 | Med | "Projected impact" disclosure had no `aria-expanded`/`aria-controls` | `ItemEditDrawer.tsx` (`ImpactDetails`) | ✅ added both + `aria-hidden` on the chevron |
| A6 | Low | State conveyed by color alone | `PriceInputCell.tsx`, `DataTable.tsx` | ✅ table `isOverride` rows already carry a textual "Edited" Status badge (`deriveItemStatus`); decorative icons/separators now `aria-hidden` |
| A7 | Low | Decorative lucide icons & text separators (`›`/`→`/`–`) read aloud by SRs | app-wide custom JSX | ✅ `aria-hidden` added on the standalone ones (DS `iconLeft`/`icon` props remain DS's responsibility) |

## B. Usability & flows

| # | Sev | Finding | Location | Status |
|---|-----|---------|----------|--------|
| B1 | Med | Notifications bell was **decorative** (no handler/badge) — promised a feature that didn't exist | `AppHeader.tsx` | ✅ bell now shows a `CountBadge` of HQ recommendations and jumps to the HQ tab on click |
| B2 | Med | Committing a price (the most frequent action) gave **no immediate feedback** | `PriceInputCell.tsx`, `QtyPriceInput.tsx` | ✅ brief emerald commit-flash (see D) — inline, no toast (toasts reserved for batch actions to avoid noise) |
| B3 | Med | Three near-identical empty-state implementations | `BatchTrayView.tsx`, `page.tsx`, `BatchDetailDrawer.tsx` | ✅ extracted shared `shared/EmptyState.tsx` |
| B4 | Low | Batch tray is a local `view` swap, not a route | `page.tsx` | ⬜ acceptable for now; flow verified continuous (edit → batch → send) |
| B5 | Med | Toasts (default `bottom-right`) covered the drawer "Add to batch" footer and the bulk ActionBar | `providers.tsx` | ✅ `ToastProvider position="top-right"` |
| B6 | Med | Manual "Mark confirmed" implied the store confirms batches — but SAP confirms externally (all-or-nothing) | `BatchCard.tsx`, `BatchDetailDrawer.tsx`, `BatchTrayView.tsx` | ✅ removed the action; sent batches stay "Pending SAP confirmation" until SAP flips them (store `confirmBatch` kept as the SAP-side mechanism) |
| B7 | Med | Adding to batch in the drawer auto-jumped to the next item — confusing | `ItemEditDrawer.tsx` | ✅ stays on the item; status flips to "In batch", footer offers an explicit "Next item ›" (auto-focused, so Enter still advances fast) |
| B8 | Med | Discarding an unbatched edit was silent/irreversible | `ItemEditDrawer.tsx`, `BatchTrayView.tsx` + shared `ConfirmDialog.tsx` | ✅ confirmation dialog explains the item returns to its current price before discarding |
| B9 | Med | Price/reduction text inputs accepted letters/symbols | `PriceInputCell.tsx`, `ReductionInput.tsx` | ✅ onChange filters to `^\d*\.?\d{0,2}$` (matches `QtyPriceInput`) |

## C. Visual / consistency

| # | Sev | Finding | Location | Status |
|---|-----|---------|----------|--------|
| C1 | Low | Price-transition glyph inconsistent (`›` in table vs `→` elsewhere) | `buildStoreColumns.tsx` + tray/drawer | ✅ unified on `→` (and `aria-hidden`) |
| C2 | Med | Divergent "eyebrow/label" recipes (gray/weight) for the same role | `ColumnsMenu`, `BatchSplitButton`, `InfoRow`, table group headers | ✅ aligned the two dropdown section headers; ⬜ a single shared label class is still tracked |
| C3 | Med | Inconsistent gray scale for the same role (`gray-400`/`500`, `gray-700`/`800`) | app-wide | ⬜ tracked — normalize incrementally (subjective; needs visual review) |
| C4 | Low | Radius scale (`rounded-xl`/`lg`/`md`) mostly consistent (containers/boxes/inputs) | app-wide | ⬜ no glaring defect; leave as-is |
| C5 | Low | DS semantic tokens (`--text-*`, `--spacing-*`, `--primary`) unused; app uses raw Tailwind grays | app-wide | ⬜ adopt incrementally |

## D. Micro-interactions (conservative — feedback that clarifies, gated by `prefers-reduced-motion`)

| # | Finding | Location | Status |
|---|---------|----------|--------|
| D1 | No feedback on price commit | `PriceInputCell.tsx`, `QtyPriceInput.tsx` | ✅ ~600ms emerald background flash on successful commit + `transition-colors` on the border-state swap |
| D2 | Tray count badge updated with no cue | `page.tsx` + `globals.css` | ✅ `badge-pop` scale pulse when the count increments |
| D3 | Mobile card keyboard-focusable but no focus ring | `MobileItemList.tsx` | ✅ `focus-visible` ring (matches the new table-row ring) |
| D4 | (Existing, kept) DS already animates Drawer/Modal/Toast/Checkbox and honors reduced-motion | DS | — |

All app-authored animation uses `motion-reduce:*` utilities or a `@media (prefers-reduced-motion: reduce)` gate (incl. the `ScanOverlay` scanline, now gated).

---

## Follow-ups (⬜, lower priority)
- Single shared label/eyebrow class (C2) and incremental gray normalization (C3).
- Adopt DS semantic tokens (C5).
- Pre-existing lint: conditional `useMemo` in `DataTable` (split-pane early return) and `set-state-in-effect` in `PriceInputCell`/`ItemEditDrawer`/`ReductionInput`/`SendToSapModal` — predate this pass; not addressed here to keep scope tight.
