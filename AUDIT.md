# Accessibility, usability & consistency audit

Scope: typography, spacing, color, tables, and keyboard/focus across the store-pricing app.
Severity: **High** (breaks consistency or a11y) · **Med** (noticeable inconsistency) · **Low** (polish).

Status legend: ✅ fixed in this pass · ⬜ tracked / follow-up.

---

## 1. Typography

| # | Sev | Finding | Location | Status |
|---|-----|---------|----------|--------|
| 1.1 | High | Off-scale font sizes `text-[10px]` / `text-[11px]` mixed with the Tailwind scale | `MetricColumn.tsx`, `PriceInputCell.tsx`, `QtyPriceInput.tsx`, `loose-tray`, `columns/shared.tsx`, `ItemEditDrawer.tsx` | ✅ replaced with `text-xs` |
| 1.2 | Med | Inconsistent page-title sizes (`text-3xl` dashboard vs `text-xl` loose-tray vs `text-2xl` batches) | `page.tsx`, `loose-tray`, `batches` | ✅ standardized on `text-2xl` |
| 1.3 | Med | Three different "eyebrow/label" recipes for the same role | `ItemEditDrawer`, `loose-tray`, `ColumnsMenu`, `DataTable` group headers | ⬜ consolidate into one label class |
| 1.4 | Low | `"Open Sans"` declared but never loaded → silent fallback | `globals.css` | ✅ loaded via `next/font` (`layout.tsx`) |

## 2. Spacing & layout

| # | Sev | Finding | Location | Status |
|---|-----|---------|----------|--------|
| 2.1 | High | Tables never fill the container: `Table` uses `w-max` + fixed per-column px widths, no flexible column | `DataTable.tsx` (`w-max`, column `width`/`minWidth`) | ✅ `w-full min-w-max` — fills width, keeps scroll on overflow |
| 2.2 | Med | Divergent page max-widths (`max-w-[1400px]` vs `max-w-[1100px]`) with no shared constant | `page.tsx`, `loose-tray`, `batches` | ⬜ unify into one layout constant |
| 2.3 | Med | Manual alignment hack `min-w-[3.5rem]` instead of a grid | `MetricColumn.tsx` | ⬜ move to grid |
| 2.4 | Low | Magic sticky-header offsets (`h-[37px]`, `top: 37`) and a blank spacer header row | `DataTable.tsx` | ⬜ derive from a constant |
| 2.5 | High | Toolbar overflow: 6 change-type tabs + search + buttons overlap on one row, so the **Filters button was unclickable** (clicks hit the "No change" tab → wrong navigation). Found via visual review. | `all-items`, `pricing/base`, `temporary-allowance`, `PricingQueuePage` | ✅ tabs wrapped in `min-w-0 flex-1 overflow-x-auto` so they scroll and the toolbar stays clickable |

## 3. Color & tokens

| # | Sev | Finding | Location | Status |
|---|-----|---------|----------|--------|
| 3.1 | Med | Brand `#003A5D` hardcoded in 5 places despite `--color-brand` | `DataTable`, `SummaryBar`, `SummaryCard`, `ItemEditDrawer` | ✅ unified to `brand` token (`@theme` in `globals.css`) |
| 3.2 | Med | DS semantic tokens (`--text-*`, `--spacing-*`, `--primary`) unused; app styles with raw Tailwind grays/blues | app-wide | ⬜ adopt DS tokens incrementally |
| 3.3 | Low | Gradient stops `#0a4d6e` / `#11607f` duplicated in both Summary components | `SummaryBar`, `SummaryCard` | ⬜ tokenize gradient |

## 4. Components & a11y

| # | Sev | Finding | Location | Status |
|---|-----|---------|----------|--------|
| 4.1 | Med | Raw `<input>` elements reimplement borders/focus instead of DS `Input` | `PriceInputCell.tsx`, `QtyPriceInput.tsx` | ⬜ migrate to DS `Input` |
| 4.2 | Med | Loose-tray override "table" is hand-built flex rows duplicating column widths, not DS `Table` | `loose-tray/page.tsx` | ⬜ migrate to DS `Table` |
| 4.3 | Low | `toggleSetItem` duplicated in two files | `loose-tray`, `pending/NewBatchModal` | ⬜ consolidate into `src/lib` |
| 4.4 | Low | `SummaryCard` and `SummaryBar` are near-duplicates | dashboard / layout | ⬜ share one component or use DS `MetricCard` |

---

## Fixed in this pass

- ✅ **1.1** — Off-scale `text-[10px]`/`text-[11px]` replaced with `text-xs` across all 6 files.
- ✅ **1.2** — Page `<h1>`s standardized on `text-2xl` (dashboard, loose-tray, batches).
- ✅ **1.4 / 3.1** — Open Sans loaded via `next/font`; brand color tokenized in `@theme` (`globals.css`) and applied as the `brand` utility (5 hardcodes removed).
- ✅ **2.1** — Tables now fill their container (`w-full min-w-max` on `DataTable`) while keeping intrinsic widths + horizontal scroll on overflow.
- ✅ **2.5** — Fixed toolbar overflow that made the Filters button unclickable (tabs now scroll within a constrained flex container).
- ✅ Persistent `Sidebar` navigation introduced (`AppSidebar` / `AppShell`), removing the bell-only path to pending work.

The remaining ⬜ items (raw-input migration, hand-rolled tables, DS semantic tokens, gradient/maxw constants) are lower-severity polish tracked for a follow-up pass.
