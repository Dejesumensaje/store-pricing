# Mobile Store Walk — the Unified Item Screen

*Design direction, 2026-07-16. Companion to ADR-0048. Written before the implementation, per the redesign brief.*

The Store Walk is a rhythm: scan → decide → save → scan. Every design choice below is judged
against that rhythm. The unit of work is not a form — it is a **ticket decision** made while
physically standing in front of the shelf (ADR-0047).

---

## 1 · Critique of the two-screen flow

The current flow splits each item across `EditScreen` ("how much" — step 1/2) and
`ChangeReviewScreen` ("when & why" — step 2/2).

1. **The split is an implementation seam, not a user seam.** "$2.50, two weeks, manager
   special" is *one* sentence in the director's head. The screens split it because drafts
   (component state) and commits (store mutations) were easier to build that way. The user
   feels the seam as navigation.
2. **Completeness is discovered late.** Change reasons are mandatory, but the obligation only
   becomes visible *after* pressing Next. Every item pays a guaranteed second screen — even
   when every default is right — and the fix for a missing reason is a round trip.
3. **Backtracking is lossy.** "Next" commits the drafts; pressing Back re-enters an
   EditScreen whose drafts are gone (the values now render as "existing"). The screen state
   subtly differs from how the user left it — the kind of inconsistency users feel but can't
   name.
4. **The review screen is a confirmation screen in disguise.** It re-lists old → new values
   the user typed three seconds ago. Re-reading is not confidence; it's cost. (The brief's
   own warning about the line-pricing preview — "avoid making this feel like a confirmation
   screen" — applies to the whole step.)
5. **Three commit semantics coexist.** Fuel saver commits instantly from its sheet; prices
   stage until Next; reasons/dates commit instantly on screen 2. Cancel reverts fuel but not
   a Next-committed price. Invisible bookkeeping surfaces as inconsistent behavior.
6. **The screen hides exactly what matters at the shelf.** HQ recommendations: absent on
   mobile. Ladder validation: absent (a break created in aisle 7 is discovered at the desktop
   — deferred errors are the most expensive kind). Margin: three taps deep in a Financials
   panel. On hand: read-only, buried in Details. The director is standing at the shelf — the
   one place these decisions are cheapest to make.
7. **Base is hidden behind a disclosure**, so the trio the director actually evaluates
   together — retail, margin, base — can never be seen at once.

## 2 · Design rationale

**The item screen is a live decision card, not a form.** One surface with two postures:

- **Reading posture** (default): the whole item is glanceable — prices, margin, obligations,
  inventory, consequences. Calm; nothing animates; hierarchy comes from scale and spacing.
- **Editing posture**: tapping a value summons the keypad and lights exactly one field. The
  rest of the card stays visible and truthful. Dismissing the keypad returns to reading.

Because both postures are the same surface, there is nothing to navigate and nothing to
remember. Three principles follow:

1. **Consequences attach at the moment of cause.** When a price draft lands, its date and
   reason obligations slide in directly *under that price* — never before (no dead form
   fields on an untouched item), never on another screen. Same for validation: a ladder break
   appears under the price that caused it, while the thumb is still on the keypad.
2. **One commit moment.** Save is the only commit; X/back is the only cancel. No wizard, no
   step indicator, no mid-flow commits to explain.
3. **Hierarchy through rhythm before decoration.** Two cards total (Pricing, Inventory).
   Color is reserved for meaning it already carries in this product: brand = the active
   field, red = HQ + errors, amber = obligations/notices. Everything else separates by
   size, weight, and spacing.

## 3 · Information architecture

```
┌──────────────────────────────────────┐
│ ✕        Store Walk                  │  chrome (no step indicator)
├──────────────────────────────────────┤
│ Doritos Nacho Cheese                 │  IDENTITY — 2 lines, no card
│ 11.5oz · UPC 012345…                 │
│                                      │
│ PRICING                              │  ONE connected card
│   Retail        [ 2 for $5.00 ]      │  · hero row (largest type)
│     was $5.99 · $2.50/unit           │  · "was" appears only when drafted
│     [📅 Jul 16–22] [⚠ Reason]        │  · chips appear only when changed
│   ─ Margin Retail 31.4% Base 33.6% ─ │  · one calc PER price, live
│   Base          [ $3.19 ]            │  · always visible, smaller type
│     ┌ HQ $3.49 ↓ $3.19 · save 30¢ ┐  │  · rec block ONLY when pending
│     │ Cost change                  │  │
│     │ [Accept $3.19]  Keep current │  │
│     └────────────────────────────-─┘  │
│     [📅 Today] [✓ Cost change]        │
│   Fuel Saver    $0.10 ›              │
│                                      │
│ INVENTORY                            │  quiet secondary card
│   On hand [24]   Weekly [12] (+2)    │
│                                      │
│ [Details] [Competitors]              │  reference pills (tertiary)
│ [Relationships] [Financials]         │
│                                      │
│ ⟐ Also updates 3 related items  ▾    │  line-pricing strip, only when true
├──────────────────────────────────────┤
│ (keypad — on demand)                 │
│ [           Save · 4 items         ] │  the single commit
└──────────────────────────────────────┘
```

- **Primary attention:** the pricing card and, when present, the HQ rec block (the only red
  element on a calm screen — it draws the eye precisely because nothing else competes).
- **Secondary:** date/reason chips, inventory.
- **Tertiary:** identity meta, reference pills, the line-pricing strip.
- The HQ block, ladder strip, meta chips, and line-pricing strip are all **conditional**;
  the common case (plain item, no rec, no family) is four quiet rows and a Save button.

## 4 · Interaction model

- **Edit a price** — tap its value box; the keypad rises (150ms); digits fill
  calculator-style (2·9·9 → $2.99); the first digit *replaces* the shown price (the dimmed
  rendering signals this). Unchanged from today — it works.
- **Accept an HQ rec** — one tap on `Accept $3.19`. The value pours into the price row with a
  `decision-pop`; the block collapses to one provenance line ("HQ recommendation accepted ·
  Undo"); the reason chip arrives pre-filled with HQ's reason (inheritance already defined by
  `changeReasonFor`). Zero dialogs; undo replaces confirmation.
- **Override** — there is no "override mode": *typing your own price is the override*. While
  typing, the block collapses to a compact `HQ proposed $3.19 · Use` chip — the proposal
  never disappears (inputs are permanent, ADR-0047), and changing your mind is one tap.
- **Keep current** — quiet text action; the block collapses to "Keeping current price ·
  Undo". Staged locally; recorded as the section's decision on Save.
- **Ladder validation** — evaluated on every keystroke of a base draft. A hard break renders
  an inline strip under the price: what breaks, in one plain sentence, plus the allowed
  window and a one-tap `Use $2.29` fix chip. Save disables while red. A narrow-gap (soft)
  violation is an amber note and never blocks. No modals — the correction happens where the
  error lives, keypad still up.
- **Inventory** — tap On hand or Weekly units and the *same keypad* retargets to that field
  (integer mode). Weekly units shows its delta live: `12 (+2)`. Repetitive-editing cost:
  tap, type, done.
- **Dates & reasons** — chips under the changed section open the existing bottom sheets.
  Dates default honestly ("Today", a one-week window) so they demand nothing; the reason
  chip is the screen's single amber obligation and Save stays disabled until every changed
  section carries one (mandatory-reason decision of 2026-07-16 preserved).
- **Line pricing** — when a base edit propagates to a price family, a one-line strip appears
  above the footer: "Also updates 3 related items". Tapping expands the names + new price
  inline. The Save button itself says `Save · 4 items`. Information, not a gate — no extra
  screen, no confirmation.
- **Save** — commits everything at once. Walk: success overlay (§6) then back to the
  scanner. Maintenance: sends to SAP, then the existing success screen.
- **Scan while editing** — unchanged: a valid draft autosaves and the next item opens
  (replaceState keeps back-stack shallow). The scan gun always wins.

## 5 · Microinteractions

| Moment | Behavior | Why |
|---|---|---|
| Field focus | Keypad rises 150ms; caret blinks in the box; label tints brand | "typing lands here" without reading |
| First digit | Replaces the dimmed placeholder price | prevents the append-to-$5.99 misread |
| Accept rec | Value pours into the row with `decision-pop` (400ms) | the choice visibly *registers* |
| Chips arrive | Rise-in 240ms under their section | consequence visibly caused by the edit |
| Ladder fix chip | Sets the price; error strip dissolves | correction at the point of error |
| Weekly delta | `(+2)` appears beside the value as typed | the delta is the meaning, not the number |
| Save (family) | Button label counts items: `Save · 4 items` | consequence stated on the trigger itself |
| Return to scanner | Session tally `count-pop`s | "did that stick?" answered peripherally |

## 6 · Motion spec

Existing vocabulary only (globals.css) — every class already suppressed under
`prefers-reduced-motion`. Every animation answers "what just happened?".

| Animation | Timing | Purpose |
|---|---|---|
| `keypad-in` | 150ms ease-out | keypad is *attached to the tap*, not a scene change |
| `caret-blink` | 1.1s step-end loop | typing destination |
| `decision-pop` | 400ms spring | a decision registered (accept / fix chip) |
| `rise-in` | 240ms ease-out | new obligations entering under their cause |
| Success overlay | **~850ms total** | completion + consequence, then get out of the way |

Success choreography (walk): white overlay, check `pop-in` (350ms, slight overshoot — the
one springy curve in the app), then up to three `rise-in` rows staggered +80ms — "Price
updated" · "3 related items updated" · "Added to Store Walk" — auto-dismiss at ~850ms, back
to the scanner. Rewarding, then gone; the walk's rhythm never breaks. Reduced motion: static
render, same 850ms dwell.

## 7 · Usability risks

1. **One screen is taller.** With rec block + chips + inventory, content can pass the keypad
   fold. Mitigation: conditional everything, compact chips, `scrollIntoView` on the focused
   row, reference pills last.
2. **Accept-without-confirmation** risks accidental taps. Mitigation: undo posture (the
   collapsed block always offers Undo / Use), never dialogs.
3. **Auto-dismissing success can be missed.** Mitigation: the session tally on the scanner
   screen bumps (`count-pop`) as a second, persistent confirmation.
4. **The ladder fix chip moves a price the user didn't type.** Mitigation: the chip states
   the exact price (`Use $2.29`); the strip names the constraint it satisfies.
5. **Losing the review "pause".** Some users used step 2 as a double-check. Mitigation: the
   card *is* the review — every drafted row keeps its "was $X" reference until Save.
6. **Reason friction remains** (mandatory by decision). Mitigation: HQ paths inherit reasons
   automatically; store-originated changes surface the amber chip at the moment of cause, not
   at the end.
7. **Inventory edits share Save with pricing** but need no reason. The overlay reports them
   as their own line ("Inventory updated") so a mixed save reads correctly. They are not
   session-tray rows (the tray is pending *price* work).

---

## Addendum — director feedback round (2026-07-16, same day)

1. **Margin is one calculation per price, never a blend.** The margin row now
   shows `Retail 31.4% · Base 33.6%` — retail against the allowance cost, base
   against unit cost — each recomputing live as its own price is typed. The
   "shelf-effective" single number was wrong: directors evaluate the two
   margins as two facts.
2. **Base multi-unit is a conscious decision.** No stepper on Base by default;
   a quiet `+ Multi-unit price (N for $X)` action appears only while the row
   is being edited (and yields to an error strip). Rows already carrying a
   multi-unit deal open with the stepper visible. Retail keeps its lighter
   rule (stepper while active) — multi-unit retail deals are routine.
3. **Blank-slate helper yields to editing.** "no promo yet · base $X" shows
   only while the retail row is untouched — once editing starts it's noise
   (Base is visible two rows down on the same card).
4. **"Fuel Saver", never "Fuel".** The program name is not abbreviated.
5. **Relationships are the norm, not the exception.** The catalog now seeds
   ladders and price families across almost every item — curated groups for
   the hand-crafted snacks (crackers/popcorn/pretzels/kettle ladders, the
   grown fl-tortilla family…) and generated per-subcategory families + size
   ladders for the synthetic catalog. The mobile Relationships panel lists
   ladder memberships (with rank chips and pending-or-live prices), not just
   the price family. Line-pricing demo item: **Doritos Nacho Cheese 11.5oz**.
