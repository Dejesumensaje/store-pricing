# Usability Test Plan — Store Pricing

A lightweight guide for moderated testing sessions. The focus is **time and ease per task**:
how long a store director takes to complete each flow, and where they get stuck.

---

## 1. App context (for the moderator)

A single screen. The user is a **store director** managing prices for their location.

- **"All items" tab** → their permanent workspace.
- **"HQ Recommendations" tab** → a queue of **proposals** sent by headquarters (HQ). These are
  **not live in SAP yet** — the director decides.
- Clicking a row opens a **drawer** with three sections: Base price / Retail price / Fuel saver.
- On an HQ recommendation the director can: **Accept** the proposal, **enter their own price**
  (override), or **Keep current**.
- Decided changes become "pending to send." They go to SAP **loose** ("Send all") or grouped
  in a **batch** (which can be scheduled for a date).
- The **"To send"** button (top right) opens the submission view (SAP Submission).

---

## 2. Test goals

1. Does the user understand the difference between **current SAP price**, **HQ recommendation**, and **their price**?
2. Can they **decide** on an HQ proposal unaided and quickly?
3. Can they find and **edit** a price on their own?
4. Do they complete the **send to SAP** flow (loose and in a batch) with confidence?
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

**Success:** uses **Accept HQ rec** ($5.79); the item becomes decided / pending to send (`RBCS5-7`).
**What to watch:** Do they expect accepting to "send" it already? Do they understand the send step still remains?

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

### Task 7 — Send changes to SAP (loose)
> "You've decided on several changes. Send them to HQ / SAP now, without grouping them."

**Success:** reaches "To send" → **Send all to SAP** → confirms.
**What to watch:** Do they find "To send"? Does the button's counter give a hint? Do they understand the
"pending SAP confirmation" status?

---

### Task 8 — Group into a batch and schedule
> "You want these changes to go out together on **Friday, June 26**. Group them and schedule them for that date."

**Success:** selects decided items → creates/uses a batch → schedules it with a date (use `2026-06-26`).
**What to watch:** Do they discover only decided items can be selected? Do they get batch vs. loose send?
Do they find the schedule date?

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
5. Loose send vs. batch: when would you use each? Was that clear?
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
| 7 Send loose | | | | |
| 8 Batch + schedule (Jun 26) | | | | |
| 9 Filter (Temporary Allowance) | | | | |

**How to read the results afterward:**
- Tasks with SEQ ≤ 4, or that needed help → redesign candidates.
- If Task 2 fails repeatedly → the "proposal vs. live price" model isn't landing; that's the most critical signal.
- Compare times across participants: high variance = the flow depends on discovering something non-obvious.

---

> Keep it simple: no need for a lab with a one-way mirror. A screen-share call, a stopwatch, and this
> sheet are enough. What matters is **watching where they hesitate**, not the exact number.
