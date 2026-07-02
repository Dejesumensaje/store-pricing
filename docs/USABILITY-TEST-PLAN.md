# Usability Test Plan — Store Pricing

A lightweight guide for moderated testing sessions. The focus is **time and ease per task**:
how long a store director takes to complete each flow, and where they get stuck.

This round runs on **desktop** (screen-share). Mobile-only behavior (barcode scanner, card list) is
out of scope here and can be validated in a later mobile round.

---

## 1. App context (for the moderator)

The user is a **store director** who manages **several stores** (five in the prototype). The app opens
on one store; the director can switch between their stores from the header.

- **Store switcher (header, top-left)** → shows the active store name (e.g. "Store #1402"). Clicking it
  lists all the director's stores, each with an **unsent** count and an **HQ** count. Work in progress is
  preserved per store when switching.
- **"All items" list** → the permanent workspace for the active store. A banner appears at the top when
  HQ has sent price recommendations that need a decision. Clicking the banner narrows the list to the
  items with pending HQ recs; a "Back to all items" control returns to the full list.
- Clicking any row opens a **drawer**. Depending on the item it shows a current/HQ price, a pricing-type
  selector, and price sections — **Base price**, **Retail price** (single or multi-unit deal), and an
  optional **Fuel saver**. Inputs stay closed until the director chooses an action (conscious-edit model).
- On an HQ recommendation the director can: **Accept $X.XX** (the formatted recommended price),
  **Set a different price** (override), or **Keep current**.
- Every decided change is **pending** until it lands in a **batch**. Only a batch can be sent to SAP —
  there is no "send all loose" path. Batches are always given a scheduled date/time at creation, and can
  also be sent immediately with **Send now**.
- The **"Batches"** button (top right) opens the batch management view: **Scheduled** and **Sent & Live**
  tabs, and a **"New batch"** button. A batch can be applied to **more than one of the director's stores**
  at once (fan-out); the batch dialog previews how the change lands in each target store.

> **Note for the moderator:** There is no "Send all" (loose) button — all sends go through a batch. The
> **Accept** button shows the *formatted price* ("Accept $5.79"), not a generic "Accept" label; watch
> whether participants connect "Accept $5.79" with "applying HQ's recommendation."
>
> **How a decision reaches a batch (by design):** the moment a director decides a price — accept,
> override, or own change — the change is saved and, on **Done**, a small prompt shows the existing batches
> plus a "New batch" option so they place the decision into a batch. By design the item reads **"Scheduled"**
> from the moment it's decided (the unbatched window is meant to be brief). *Research watch, not a defect:*
> observe whether, in that window, participants read "Scheduled" as "already sent/done" — if that reading is
> common, it's signal worth bringing back; if not, the deliberate choice holds.
>
> **Line-price cascade:** deciding a price on a line-priced item silently updates its whole price line.
> Accepting HQ on **Fritos Original** (Task 3) also changes **Kettle Brand Sea Salt** (Task 4's item) and
> Doritos to $5.79 and fires a toast *"Updated 3 line-price items."* Run **Task 4 before Task 3**, or
> expect Kettle to already read $5.79. Either way, watch whether the participant notices three items moved.
>
> **Multi-store data caveat:** in the prototype every product exists in every store and the other stores
> start with no unsent changes, so a fan-out preview reads *"Applies cleanly in 5 of 5 stores"* (confirmed
> in dry-run). The conflict / missing-item cases won't appear on their own — the fan-out task tests
> **discovery and mental model** ("apply to several stores at once"), not conflict handling.

---

## 2. Test goals

1. Does the user understand the difference between **current SAP price**, **HQ recommendation**, and **their price**?
2. Can they **decide** on an HQ proposal unaided and quickly?
3. Can they find and **edit** a price on their own?
4. Do they complete the **send to SAP** flow (via a batch) with confidence?
5. Do they always know **what state** each item is in?
6. Do they understand **which store** they're working in, and grasp that a change can be **applied to several stores** at once?

---

## 3. Logistics

- **Participants:** 5–6 store directors (or equivalent profile). Five already surfaces most issues.
- **Duration:** 35–45 min per session.
- **Format:** think-aloud, **desktop screen-share**. The moderator **does not guide** unless the participant is blocked for >60–90 s.
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
4. How many stores do you manage? Do you price them the same, or does each differ?

---

## 5. Tasks

Each task: **scenario** (what you read to the participant) + **success** (what counts as done) + **what to watch**.
Scenarios give the **goal only** — never name buttons or steps ("batch", "drawer", "fan-out"). Start with
free exploration to capture the first impression.

### Task 0 — First impression (no clicking, ~1 min)
> "Without clicking yet: tell me what this screen is, what you think it's for, and what you'd do first."

**What to watch:** Do they recognize it's for pricing? Do they notice the **HQ recommendations banner**, the
**Batches** button, and the **store name** in the header? What draws their eye first?

---

### Task 1 — Locate a product
> "You need to review **Cheetos Crunchy 8.5oz**. Find it."

**Success:** opens the drawer for the correct item (`RBCS5-2`).
**What to watch:** Do they use search, filters, or scroll? Time to find it.

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

**Success:** clicks **Accept $5.79**; the change is saved (footer: **"Change saved · add to a batch to
send"**) and on **Done** a prompt offers the existing batches or a new one to place it in (`RBCS5-7`, current $5.49).
**What to watch:** Do they find the HQ rec banner that triggers the filtered view? Do they expect
accepting to "send" it immediately, or do they expect the **batch step**? The item reads **"Scheduled"**
from the moment it's decided (by design) — observe whether the participant reads that as "already
sent/done" (a comprehension signal, not a defect).

> **Moderator note:** The Accept button shows the formatted price ("Accept $5.79"), not a generic
> "Accept" label — intentional. Accepting *decides* the price; on **Done** the director chooses the batch
> (existing or new) — that is the resolved flow. Accepting Fritos also cascades to its line-price group —
> see the line-price note in §1.

---

### Task 4 — Reject / set your own price
> "For **Kettle Brand Sea Salt 7.5oz** you don't agree with HQ — you want to set it to **$5.59** instead."

**Success:** types the override and saves it as pending (does not use Accept) (`RBCS5-8`, HQ proposes $5.79).
**What to watch:** Do they find where to type their price? Do they distinguish "Keep current" from "set a new one"?
Do they hesitate between the three buttons?

---

### Task 5 — Change a price on your own initiative (no HQ)
> "In your All items list, drop the price of **Lay's Barbecue 7.75oz** to **$3.99**."

**Success:** edits the base price in the drawer; it becomes pending (`NC-2`, current $4.29).
**What to watch:** Do they get back to "All items"? Is the change visible on the row (Your price / status)?

---

### Task 6 — Create a multi-buy promo
> "You want to put **Smartfood White Cheddar 6.75oz** on a deal: **2 for $7**."

**Success:** in the drawer's **Retail price** section, clicks **Set promo price**, chooses the **Multi-unit**
option, and enters **qty 2 / $7** plus a promo period (`NC-4`, current $4.19). *Confirmed reachable in
dry-run:* Set promo price → Multi-unit renders a "[qty] for $[price]" control.
**What to watch:** Do they understand the difference between **base price**, **retail** (the multi-buy), and
**fuel saver**? Do they discover the Multi-unit option (the default is "Exact price")? Do they set the
required promo period? Historically the most confusing point — watch closely.

---

### Task 7 — Send a batch to SAP
> "You've decided on several changes that are already grouped together. Send that group to SAP now."

**Success:** opens **Batches** → finds the scheduled batch **"This week's promos"** → clicks **Send now** →
the batch moves to the **Sent & Live** tab / a confirmation is shown.
**What to watch:** Do they find the "Batches" button? Do they understand the batch → send
relationship? Do they grasp **"Sending" (pending SAP confirmation)** vs. **"Live"**?

> **Moderator note:** a batch sent during the session flips **Sending → Live** on its own after ~10
> seconds (simulated SAP acknowledgment), with a *"…is now live in SAP"* toast. The Sent & Live tab
> starts empty on a fresh reload — batches only appear there after the participant sends one.

> **Design note:** There is no "send loose / without grouping" path — all sends are batch-based. If a
> participant looks for a way to send a single change directly, probe their mental model; the absence of a
> loose path is a deliberate design decision worth validating.

---

### Task 8 — Create a batch and schedule it
> "You want the changes you just made to go out together on **Friday, July 10**. Set that up."

**Success:** opens Batches → clicks **New batch** → names it → **checks the relevant pending changes in the
modal's list** → sets the date (`2026-07-10`) → saves → the new batch appears in the **Scheduled** tab.
**What to watch:** Do they find the New batch button? Do they understand that they select which pending
changes go into the batch **right in the dialog**? Do they find the schedule date picker?

---

### Task 9 — Switch store (multi-store)
> "You also run other stores. Switch to **Store #1287** and tell me what needs your attention there."

**Success:** uses the **store switcher** (the store name in the header) and selects Store #1287.
**What to watch:** Do they find the switcher at all? Do they read the per-store **unsent / HQ** counts before
switching? Do they understand their work in the first store is preserved?

---

### Task 10 — Apply a change to several stores (fan-out)
> "A change you're making should also apply to **Store #1287 and Store #1364**, not just this one. Set that up."

**Success:** while creating the batch (or from the batch's detail), selects **multiple target stores** (a
**"All my stores"** quick-toggle selects all five) and reads the **per-store preview** — confirmed to read
*"Applies cleanly in 5 of 5 stores"*; the create button updates to *"Create batch · N stores (M items)."*
**What to watch:** Do they discover the "apply to stores" option? Do they understand the preview and what
"apply to several of my stores" does? (Per the data caveat in §1, expect the clean-apply path.)

---

### Task 11 — Filter / narrow down (optional)
> "Show me only the items on a **Temporary Allowance** (promotions)."

**Success:** applies the correct filter (Pricing strategy → Temporary Allowance).
**What to watch:** Do they use filters or hunt by hand? Do they understand the change-type / strategy labels?

---

### Task 12 — Notice an active filter (optional)
> While a filter is applied (e.g. after Task 11), ask: "How would you remove just that filter?"

**Success:** uses the removable chip below the toolbar (or the drawer's per-facet Clear) — doesn't have to reopen the drawer to know something is filtered.
**What to watch:** Do they notice the chip at all? Do they try the "Filters (N)" button instead, not realizing the chip is faster?

---

## 6. Post-task questions (after each one)

1. SEQ: *"On a scale of 1 to 7, how easy was that?"* (and why)
2. *"Did you expect it to work that way? What surprised you?"*

## 7. Post-test questions (wrap-up, ~5 min)

1. If you had to explain this to a colleague in one sentence, what would you say?
2. When did you feel lost or unsure?
3. What was most useful? What's missing or excessive?
4. Was the difference between **SAP price**, **HQ recommendation**, and **your price** clear? How would you put it?
5. Was it always clear **which store** you were working in? What did you expect "apply to several stores" to do?
6. Did you miss a way to send changes immediately, without creating a batch? How would you expect that to work?
7. Compared to how you do it today, would this save you time? Would you use it?
8. One thing you'd change right away.

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
| 6 Multi-buy promo (Smartfood 2 for $7) | | | | |
| 7 Send batch to SAP (This week's promos) | | | | |
| 8 New batch + schedule (Jul 10) | | | | |
| 9 Switch store (#1287) | | | | |
| 10 Apply to several stores (#1287, #1364) | | | | |
| 11 Filter (Temporary Allowance) | | | | |

**How to read the results afterward:**
- Tasks with SEQ ≤ 4, or that needed help → redesign candidates.
- If Task 2 fails repeatedly → the "proposal vs. live price" model isn't landing; that's the most critical signal.
- If Task 3 participants expect Accept to send → the pending→batch→send state model needs work.
- If Tasks 9–10 confuse → the multi-store model (which store am I in / apply to many) needs work.
- Compare times across participants: high variance = the flow depends on discovering something non-obvious.

---

> Keep it simple: no need for a lab with a one-way mirror. A screen-share call, a stopwatch, and this
> sheet are enough. What matters is **watching where they hesitate**, not the exact number.

---

## 9. Pre-session checklist (moderator, before each participant)

State does **not** persist across reloads — **refresh the page to reset** between participants. Then confirm:

- Desktop Chrome, screen-share; the active store is **#1402**.
- The **HQ recommendations banner** is showing (the header bell shows the HQ count — ~13; pending recs
  include Great Value Tortilla Chips, Fritos Original, and Kettle Brand Sea Salt).
- The task anchor items resolve to their expected prices:
  - Cheetos Crunchy 8.5oz `RBCS5-2` — $4.79
  - Great Value Tortilla Chips 13oz `EDLP-1` — SAP $2.98 → HQ $2.78
  - Fritos Original 9.25oz `RBCS5-7` — $5.49 → HQ $5.79
  - Kettle Brand Sea Salt 7.5oz `RBCS5-8` — $5.49 → HQ $5.79
  - Lay's Barbecue 7.75oz `NC-2` — $4.29
  - Smartfood White Cheddar 6.75oz `NC-4` — $4.19, no promo yet (for the 2-for-$7 task)
- Three scheduled batches are present: **"Tuesday, ad prep"**, **"Friday endcap reset"**, **"This week's promos"**.
- The **store switcher** lists all five stores (#1402, #1287, #1521, #1364, #1198) with per-store counts.

> Tasks run in order: at a fresh reload the **New batch modal has "No pending items"** — Tasks 4–6 create
> the pending changes that Task 8 groups, and Task 7 sends the pre-seeded "This week's promos" batch. Run
> **Task 4 before Task 3** (the Fritos line-price cascade also moves Kettle). If you run tasks out of order,
> re-check the relevant state first.
