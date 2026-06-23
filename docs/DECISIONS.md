# Architecture & Product Decisions

A lightweight log of the decisions behind Store Pricing — so the *why* survives.

**Format (one entry per decision):**

```
### ADR-NNNN — Short title
**Status:** Accepted · **Date:** YYYY-MM-DD
**Context:** what problem / constraint prompted this.
**Decision:** what we chose.
**Consequences:** tradeoffs, what it enables, what we gave up.
```

Append a new entry per decision; don't rewrite old ones (supersede with a new ADR and link back). Newest at the bottom.

---

### ADR-0001 — HQ recommendations are proposals, not live in SAP
**Status:** Accepted · **Date:** 2026-06-22
**Context:** The grid felt "disjointed." Root cause: the code modeled HQ-pushed prices as *already live* (`applyHqReview` set `currentBasePrice = recommendedBasePrice`), so current and recommendation were the same number and couldn't be shown as distinct things.
**Decision:** An HQ recommendation is a *proposal*. `currentBasePrice` stays the live price; `recommendedBasePrice` is HQ's proposal; `newBasePrice/newRetailPrice` is the director's decision. The director decides per item: **Accept** (apply the rec), **Override** (own price), or **Keep current** (reject).
**Consequences:** The grid can show current / recommendation / decision as three real things. Margins now compute against the true current price. `hqReviewPending` means "a recommendation awaiting a decision," not "already live."

### ADR-0002 — Accepting a recommendation does not auto-send
**Status:** Accepted · **Date:** 2026-06-22
**Context:** If HQ recs aren't live, what does "Accept" do — send immediately?
**Decision:** Accept (and Override) create a *pending* change that the director then saves for later or adds to a batch and sends to SAP later. Only **Keep current** sends nothing. Rides the existing override → pending → in_batch → submitted pipeline unchanged.
**Consequences:** No new submission machinery; accept/override behave like any edit. The director controls when things go to SAP.

### ADR-0003 — Grid shows current / recommendation / decision as three price columns
**Status:** Accepted · **Date:** 2026-06-22
**Context:** Need to make "what's live, what HQ proposes, what I decided" legible at a glance.
**Decision:** Columns **Current SAP**, **HQ rec** ("—" when none), **Your price**. For temporary allowances, each shows **Base + Retail** on two lines (a TA carries two live prices).
**Consequences:** Information-rich but spatially expensive — this drove later decluttering (ADR-0005, ADR-0007). Considered but rejected: merging into one before→after column (lost the side-by-side clarity the director wanted).

### ADR-0004 — "Change type" label + short pills (TA/EDLP) with tooltip
**Status:** Accepted · **Date:** 2026-06-22
**Context:** "Pricing strategy" was ambiguous ("the current one, or the one I set?"). Long labels also crowded the column.
**Decision:** Rename the column to **Change type** (Neil's suggestion); render values as short DS Badge pills — **TA, EDLP, Base, New, Disc.** — with the full name on hover. Neutral tone (color reserved for Status).
**Consequences:** Unambiguous (a change type is inherently about the action being applied). Short pills keep the column narrow; the tooltip preserves discoverability of the full name.

### ADR-0005 — Merge Decision + Status into one column
**Status:** Accepted · **Date:** 2026-06-22
**Context:** Decision (Pending/Accepted/Overridden/…) and Status (Needs review/Edited/In batch/Pending SAP/Live) sat as two adjacent badges that overlapped (Pending≈Needs review, Changed≈Edited).
**Decision:** One **Status** column: the workflow badge is the primary signal (it's what you scan), with the HQ-relative decision (**Accepted/Overridden/Kept current**) as a quiet gray qualifier *only when it adds info*. Pending and a plain director "Changed" are left off so untouched Live rows stay calm.
**Consequences:** Removes a column and the redundancy. Decision nuance is preserved as a sub-label, not a colored badge.

### ADR-0006 — Multiple changes: badge + ⓘ tooltip, no count
**Status:** Accepted · **Date:** 2026-06-22
**Context:** A single item can change base + retail + fuel saver. We need to signal "several changes → see detail" without noise. A "3 changes" number next to the badge felt cluttered.
**Decision:** When ≥2 fields change, show a small **ⓘ** next to the status badge; hover reveals the full itemized breakdown. No count surfaced.
**Consequences:** Clean at-a-glance, detail on demand. Known tradeoff: hover detail is hidden on touch / not keyboard-reachable — fine for the desktop testing target; revisit for touch.

### ADR-0007 — Selection limited to items with a decision; no bulk editing
**Status:** Accepted · **Date:** 2026-06-22
**Context:** Users could select rows with no change, which did nothing (a dead-end). An earlier bulk-edit feature was built and then fully reverted as "wrong direction."
**Decision:** Only items with a pending decision are selectable (checkbox disabled otherwise; select-all picks only decided rows). **No bulk editing** — refine existing interactions instead of adding capabilities.
**Consequences:** The multi-select → batch flow is unambiguous. Pricing stays one-item-at-a-time via the drawer (matches how the team wants it).

### ADR-0008 — Drawer: decision up, context collapsed
**Status:** Accepted · **Date:** 2026-06-22
**Context:** The drawer stacked ~7 bordered cards; the price decision competed with margin/competitor/related/impact.
**Decision:** Cost + allowance cost move to the item header (reference info). Three explicit sections — **Base price / Retail price / Fuel saver**. Margin is inline feedback next to each price. Competitor / related / impact collapse into accordions. Labels unified to **Current SAP / HQ recommended / Your price**. Actions: Accept / Override / Keep current.
**Consequences:** The decision stays above the fold; context is one click away. Less scroll, clearer hierarchy.

### ADR-0009 — Filters: searchable accordion facets, built to scale
**Status:** Accepted · **Date:** 2026-06-22
**Context:** Flat checkbox lists don't scale to hundreds of categories/brands; active filters were invisible.
**Decision:** Rebuild `FilterDrawer` as **accordion facets** (collapsed by default, except active ones) with a **per-facet search** (appears past ~8 options), selected-first ordering, a capped list with **"Show all (N)"**, a per-facet count badge, and a **Clear** action in the facet header next to the label/pill. Use the persistent DS `Input` (not the collapsible `SearchInput`).
**Consequences:** Scales to hundreds of values per facet without virtualization. If catalogs reach thousands of *rows*, the table itself will need virtualization (still open).

### ADR-0010 — Seed a realistic catalog for filter scale
**Status:** Accepted · **Date:** 2026-06-23
**Context:** The mock had one category ("Potato chips") and ~6 brands, so the scalable filters had nothing to scale against.
**Decision:** Recategorize the hand-crafted demo items to "Snacks" (coherent) and add a deterministic synthetic catalog (~20 categories, ~70 subcategories, ~36 brands, all "Live") — without touching the demo items that drive flows (IDs, line groups, overrides, HQ recs).
**Consequences:** Filters now exercise real scale and the Category column is meaningful. `TOTAL_ITEM_COUNT` reflects the real count. Deterministic generation avoids hydration mismatches.
