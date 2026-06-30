# Usability Test Plan — Store Pricing

A lightweight guide for moderated testing sessions. The focus is **time and ease per task**:
how long a store director takes to complete each flow, and where they get stuck.

---

## 1. App context (for the moderator)

A single screen. The user is a **store director** managing prices for their location.

- **"All items" list** → their permanent workspace. A banner appears at the top when HQ has
  sent price recommendations that need a decision.
- Clicking that banner (or the filter badge) narrows the list to items with pending HQ recs.
- Clicking any row opens a **drawer** with up to three sections: Base price / Retail price /
  Fuel saver.
- On an HQ recommendation the director can: **Accept $X.XX** (the formatted recommended price),
  **Set a different price** (override), or **Keep current**.
- Every decided change must land in a **batch** before it can be sent to SAP. Batches can be
  sent immediately or scheduled for a future date/time. There is no "send all loose" path.
- The **"Batches"** button (top right) opens the batch management view: Scheduled and Sent tabs,
  and a "New batch" button.

> **Note for the moderator:** In earlier prototypes a "Send all" (loose) button existed. It has
> been removed — all sends now go through a batch. Update the participant scenario accordingly.

---

## 2. Test goals

1. Does the user understand the difference between **current SAP price**, **HQ recommendation**, and **their price**?
2. Can they **decide** on an HQ proposal unaided and quickly?
3. Can they find and **edit** a price on their own?
4. Do they complete the **send to SAP** flow (via a batch) with confidence?
5. Do they always know **what state** each item is in?

---

## 3. Logistics

- **Participants:** 5–6 store directors (or equivalent profile). Five already surfaces most issues.
- **Duration:** 30–40 min per session.
- **Format:** think-aloud. The moderator **does not guide** unless the participant is blocked for >60–90 s.
- **Data to record per task:**
  - ⏱ **Time** (from "go" to success criterion).
  - ✅ **Success** (unaided / with help / failed).
  - ⚠️ **Errors & hesitations** (wrong clicks, phrases like "what is this?").
  - 🙂 **SEQ** (Single Ease Question): right after, *"How easy or hard was that task?"* 1 (very hard) – 7 (very easy).

> Moderator rule: if they ask "is this right?", bounce it back — *"What do you think?"*. Don't confirm until they're done.

---

## 4. Warm-up questions (pre-test, ~3 min)

1. How do you handle price changes in your store today? With what tool?
2. What comes to you from HQ, and how do you process it today?
3. How many times a week do you touch prices? At what time of day?

---

## 5. Tasks

Each task: **scenario** (what you read to the participant) + **success** (what counts as done) + **what to watch**.
Start with free exploration to capture the first impression.

### Task 0 — First impression (no clicking, ~1 min)
> "Without clicking yet: tell me what this screen is, what you think it's for, and what you'd do first."

**What to watch:** Do they recognize it's for pricing? Do they understand the two tabs? What draws their eye first?

---

### Task 1 — Locate a product
> "You need to review **Cheetos Crunchy 8.5oz**. Find it."

**Success:** opens the drawer for the correct item (`RBCS5-2`).
**What to watch:** Do they use search, filters, or scroll? Do they try the scanner? Time to find it.

---

### Task 2 — Understand an HQ recommendation (comprehension, not action)
> "HQ sent you recommendations. Open the one for **Great Value Tortilla Chips 13oz** and explain in
> your own words: what price does it have today, what is HQ proposing, and what happens if you do nothing?"

**Success:** correctly distinguishes **Current SAP ($2.98)** vs **HQ recommended ($2.78)** vs **Your price** (`EDLP-1`).
**What to watch:** Do they mistake the recommendation for a price that's already live? Do they grasp it's a proposal?
This is the key comprehension task for the mental model.

---

### Task 3 — Accept an HQ recommendation
> "You agree with HQ's proposal for **Fritos Original 9.25oz**. Apply it."

**Success:** clicks **Accept $5.79** in the drawer; the item status changes to Scheduled (`RBCS5-7`).
**What to watch:** Do they find the HQ rec banner that triggers the filtered view? Do they expect
accepting to "send" it immediately? Do they understand the batch step still remains?

> **Moderator note:** The Accept button shows the formatted price ("Accept $5.79"), not a generic
> "Accept" label — this is intentional and was confirmed in automated testing.

---

### Task 4 — Reject / set your own price
> "For **Kettle Brand Sea Salt 7.5oz** you don't agree with HQ — you want to set it to **$5.59** instead."

**Success:** types the override and saves it as pending (does not use Accept) (`RBCS5-8`, HQ proposes $5.79).
**What to watch:** Do they find where to type their price? Do they distinguish "Keep current" from "set a new one"?
Do they hesitate between the three buttons?

---

### Task 5 — Change a price on your own initiative (no HQ)
> "In the All items tab, drop the price of **Lay's Barbecue 7.75oz** to **$3.99**."

**Success:** edits the base price in the drawer; it becomes pending (`NC-2`, current $4.29).
**What to watch:** Do they go back to "All items"? Is the change visible on the row (Your price / status)?

---

### Task 6 — Create a promo / multi-unit deal
> "You want to put **Smartfood White Cheddar 6.75oz** on a deal: **2 for $7**."

**Success:** configures the deal in the Retail price section of the drawer (`NC-4`, current $4.19).
**What to watch:** Do they understand the difference between base price, retail, and fuel saver? Historically a
confusing point — watch closely.

---

### Task 7 — Send a batch to SAP
> "You've decided on several changes. Send the batch to SAP now."

**Success:** opens **Batches** → finds a Scheduled batch → clicks **Send now** (or equivalent) →
batch moves to Sent tab / confirmation shown.
**What to watch:** Do they find the "Batches" button? Do they understand the batch → send
relationship? Do they grasp "pending SAP confirmation" vs. "live"?

> **Design note (updated 2026-06-30):** A previous version of this scenario asked the director
> to "Send all without grouping." That path no longer exists — all sends are batch-based
> (ADR-0035 / ADR-0036). If participants ask about sending loose, probe for their mental model;
> the absence of a loose path is a deliberate design decision worth validating.

---

### Task 8 — Create a batch and schedule it
> "You want these changes to go out together on **Friday, June 26**. Create a batch for that date."

**Success:** opens Batches → clicks **New batch** → sets name + date (`2026-06-26`) → saves →
the new batch appears in the Scheduled tab.
**What to watch:** Do they find the New batch button? Do they understand that items need to be
assigned to the batch separately (via Done in the drawer)? Do they find the schedule date picker?

---

### Task 9 — Filter / narrow down (optional)
> "Show me only the items on a **Temporary Allowance** (promotions)."

**Success:** applies the correct filter (Pricing strategy → Temporary Allowance).
**What to watch:** Do they use filters or hunt by hand? Do they understand the change-type / strategy labels?

---

## 6. Post-task questions (after each one)

1. SEQ: *"On a scale of 1 to 7, how easy was that?"* (and why)
2. *"Did you expect it to work that way? What surprised you?"*

## 7. Post-test questions (wrap-up, ~5 min)

1. If you had to explain this to a colleague in one sentence, what would you say?
2. When did you feel lost or unsure?
3. What was most useful? What's missing or excessive?
4. Was the difference between **SAP price**, **HQ recommendation**, and **your price** clear? How would you put it?
5. Did you miss a way to send changes immediately, without creating a batch? How would you expect that to work?
6. Compared to how you do it today, would this save you time? Would you use it?
7. One thing you'd change right away.

---

## 8. Recording template (one per participant)

| Task | Time | Success (unaided/help/fail) | SEQ (1–7) | Errors / hesitations observed |
|------|------|-----------------------------|-----------|-------------------------------|
| 0 First impression | — | — | — | |
| 1 Locate product (Cheetos Crunchy) | | | | |
| 2 Understand HQ rec (GV Tortilla Chips) | | | | |
| 3 Accept HQ rec (Fritos Original) | | | | |
| 4 Override (Kettle Sea Salt → $5.59) | | | | |
| 5 Own change (Lay's BBQ → $3.99) | | | | |
| 6 Promo/multi-unit (Smartfood 2 for $7) | | | | |
| 7 Send batch to SAP | | | | |
| 8 New batch + schedule (Jun 26) | | | | |
| 9 Filter (Temporary Allowance) | | | | |

**How to read the results afterward:**
- Tasks with SEQ ≤ 4, or that needed help → redesign candidates.
- If Task 2 fails repeatedly → the "proposal vs. live price" model isn't landing; that's the most critical signal.
- Compare times across participants: high variance = the flow depends on discovering something non-obvious.

---

> Keep it simple: no need for a lab with a one-way mirror. A screen-share call, a stopwatch, and this
> sheet are enough. What matters is **watching where they hesitate**, not the exact number.

---

## 9. Pre-test validation (Playwright audit — 2026-06-30)

A Playwright audit (`e2e/audit.spec.ts`) was run against the prototype to confirm each flow is
reachable before inviting participants. Tests run on **desktop-chrome** and **mobile-safari**
(iPhone 14 viewport). All 43 tests pass; 5 are skipped (desktop-only tests correctly skipped
on mobile, and vice versa).

### Flows confirmed working

| Test plan task | Playwright coverage | Status |
|---|---|---|
| 0 First impression | Initial load — heading, Batches button, item visible | ✅ Pass |
| 1 Locate product | Search: typing filters list; clearing restores full list | ✅ Pass |
| 2 Understand HQ rec | HQ banner visible; clicking opens filtered "Needs review" view | ✅ Pass |
| 3 Accept HQ rec | Drawer shows "Accept $X.XX" + "Keep current"; accepting dismisses block | ✅ Pass |
| 4 Override / set own price | "Needs review" drawer: no input open by default (conscious-edit model) | ✅ Pass |
| 5 Own change | Desktop table scrolls with sticky headers; items accessible in drawer | ✅ Pass |
| 6 Promo / multi-unit | Not automated (complex multi-step form — flag for manual pre-test check) | ⚠️ Manual |
| 7 Send batch | Batches surface loads; seeded batches visible; Sent tab renders without crash | ✅ Pass |
| 8 New batch + schedule | "New batch" modal opens with date field | ✅ Pass |
| 9 Filter | Filter drawer opens and closes without errors | ✅ Pass |

### Notable findings from the audit

- **Sticky headers confirmed (desktop only):** The DataTable scroll container's `scrollHeight >
  clientHeight` — headers stay pinned while 245+ items scroll below.
- **No console errors** in any flow — zero JavaScript errors across all automated paths.
- **Mobile layout clean:** No horizontal page overflow on iPhone 14 viewport.
- **HQ rec accept button shows formatted price** ("Accept $5.79") — not a generic "Accept HQ rec"
  label. This is intentional but worth noting in the moderator brief, as participants may not
  immediately associate "Accept $5.79" with "applying the HQ recommendation."
- **Batch-mandatory confirmed:** There is no "Send all" loose path. Any scenario that implies
  sending without a batch will need to be updated before the session (see Task 7 above).
- **Task 6 (promo/multi-unit) not automated:** The retail price section has multiple interaction
  states (accept-first, set-promo, date range). Verify manually before each session that the
  `NC-4` item is in the expected state.
