// DISPOSABLE verification spec for the UNIFIED mobile item screen (ADR-0048)
// — one decision card replacing the two-step edit→review flow. Drives the
// Zebra TC57X CSS viewport (360×640 @ DPR3), captures design-review
// screenshots into e2e/screenshots/ (gitignored). Run with
// --project=desktop-chrome (test.use pins the device profile). Delete after
// the feature lands.
import { test, expect, type Page } from "@playwright/test";

const SHOT = (name: string) => ({ path: `e2e/screenshots/unified-${name}.png` });

async function pickFuelDifferentFromCurrent(page: Page) {
  // The row shows "Fuel Saver $0.10" / "Fuel Saver None" — pick whatever
  // differs so the change always registers.
  const row = page.getByRole("button", { name: /^Fuel Saver (\$|None)/i });
  const current = (await row.innerText()).toLowerCase().includes("none") ? "$0.10" : "None";
  await row.click();
  await page.getByRole("dialog").getByRole("button", { name: current, exact: true }).click();
  return current;
}

test.describe("unified item screen (TC57X viewport)", () => {
  test.use({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

  test("store walk: one screen — price, margin, chips, save overlay", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Store Walk/ }).click();
    await expect(page.getByText("Waiting for barcode…")).toBeVisible();

    // Scan Lay's (W7BESS — live TA, seeded pending retail + a reason).
    await page.getByRole("button", { name: "Simulate scan" }).click();
    await page.getByRole("button", { name: /Lay's Classic Potato Chips/ }).click();

    const shell = page.getByTestId("mobile-shell");
    // ONE surface: retail, margin and base all visible at once — no "1 / 2"
    // step indicator, no Base disclosure, no keypad until a field is tapped.
    await expect(shell.getByText("1 / 2")).toHaveCount(0);
    // Margin is one calculation PER price, now light ground beside each price
    // (retail vs allowance cost, base vs unit cost) — not a blended number and
    // not a boxed row. Two "GM" grounds, distinct percentages.
    await expect(shell.getByText("34.7%")).toBeVisible();
    await expect(shell.getByText("33.6%")).toBeVisible();
    await expect(shell.getByText("GM")).toHaveCount(2);
    await expect(shell.getByText(/^Base price$/)).toBeVisible();
    await expect(page.getByRole("group", { name: "Price keypad" })).not.toBeVisible();
    await expect(shell.locator(".caret-blink")).toHaveCount(0);
    // Pristine CTA: gray, disabled — the screen's state lamp at rest.
    await expect(page.getByRole("button", { name: "Save & next" })).toBeDisabled();
    // Evidence pills carry live one-line status (headline fact, no tap).
    await expect(shell.getByText(/\d+ tracked|None tracked/)).toBeVisible();
    // Financials pill is gone — margins already read inline as GM grounds.
    await expect(shell.getByText(/Cost \$\d/)).toHaveCount(0);
    await page.screenshot(SHOT("01-reading-posture"));

    // Editing posture: tap retail → keypad + caret; type 2-9-9 → $2.99 with
    // the "was" reference and the when&why chips arriving inline.
    await page.getByRole("button", { name: "Edit retail price" }).click();
    await expect(page.getByRole("group", { name: "Price keypad" })).toBeVisible();
    await expect(shell.locator(".caret-blink")).toHaveCount(1);
    for (const d of ["2", "9", "9"]) await page.getByRole("button", { name: d, exact: true }).click();
    await expect(shell.getByText("$2.99", { exact: true })).toBeVisible();
    await expect(shell.getByText(/was \$3\.99/)).toBeVisible();
    // Every fresh change owns its justification: the prior reason does NOT ride
    // in. The chip reads "Add reason" and the CTA names the blocker.
    await expect(shell.getByRole("button", { name: "Add reason", exact: true })).toBeVisible();
    await expect(shell.getByRole("button", { name: /Local deal/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add reason codes" })).toBeVisible();
    await page.screenshot(SHOT("02-editing-posture"));

    // Pick the reason from the chip's sheet — it opens unselected, so even the
    // same reason must be chosen deliberately. Then the save unblocks.
    await shell.getByRole("button", { name: "Add reason", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Manager special", exact: true }).click();
    await expect(shell.getByRole("button", { name: /Manager special/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save & next" })).toBeEnabled();

    // Save — success overlay (auto-dismisses ~850ms) → scanner, tally bumped.
    // The overlay is a receipt: the item, the deal it now carries.
    await page.getByRole("button", { name: "Save & next" }).click();
    await expect(page.getByRole("status").getByText(/Lay's Classic Potato Chips/)).toBeVisible();
    await expect(page.getByText("$2.99 deal")).toBeVisible();
    await expect(page.getByText("Added to Store Walk")).toBeVisible();
    await page.screenshot(SHOT("03-save-overlay"));
    await expect(page.getByText("Waiting for barcode…")).toBeVisible();
    await expect(page.getByRole("button", { name: "Session tray, 1 edited this walk" })).toBeVisible();
    await page.screenshot(SHOT("04-back-to-scanner"));
  });

  test("HQ recommendation: accept / undo / keep current — no dialogs", async ({ page }) => {
    await page.goto("/#m/walk");
    await page.getByRole("button", { name: "Simulate scan" }).click();
    await page.getByRole("button", { name: /Pop Secret/ }).click();

    const shell = page.getByTestId("mobile-shell");
    // Pending block: current ↓ recommended with HQ's reason, under Base.
    await expect(shell.getByText("recommends")).toBeVisible();
    await expect(shell.getByText("$4.29 current")).toBeVisible();
    await expect(shell.getByText("save 30¢")).toBeVisible();
    await page.screenshot(SHOT("05-hq-pending"));

    // Accept: one tap → value pours into the row, reason auto-inherited.
    await page.getByRole("button", { name: "Accept $3.99" }).click();
    await expect(shell.getByText("$3.99", { exact: true })).toBeVisible();
    await expect(shell.getByText(/Accepted \$3\.99/)).toBeVisible();
    await expect(shell.getByRole("button", { name: /Competitor change/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save & next" })).toBeEnabled();
    await page.screenshot(SHOT("06-hq-accepted"));

    // Undo → pending again; Keep current → staged decline, still saveable.
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(shell.getByText("recommends")).toBeVisible();
    await page.getByRole("button", { name: "Keep current" }).click();
    await expect(shell.getByText(/Keeping current — rec declined/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Save & next" })).toBeEnabled();
    await page.screenshot(SHOT("07-hq-kept"));

    // Override = just type. The proposal stays one tap away ("Use").
    await page.getByRole("button", { name: "Undo" }).click();
    await page.getByRole("button", { name: "Edit base price" }).click();
    for (const d of ["4", "0", "9"]) await page.getByRole("button", { name: d, exact: true }).click();
    await expect(shell.getByText(/proposed \$3\.99/)).toBeVisible();
    await page.screenshot(SHOT("08-hq-override-typing"));
    await shell.getByText(/proposed \$3\.99/).click(); // Use → accept
    await expect(shell.getByText(/Accepted \$3\.99/)).toBeVisible();

    // Save the accepted rec: overlay reports the walk work.
    await page.getByRole("button", { name: "Save & next" }).click();
    await expect(page.getByText("Prices updated")).toBeVisible();
    await expect(page.getByText("Waiting for barcode…")).toBeVisible();
    await expect(page.getByRole("button", { name: "Session tray, 1 edited this walk" })).toBeVisible();
  });

  test("hard ladder break → revert or fix related; line-pricing preview; save", async ({ page }) => {
    await page.goto("/#m/walk");
    await page.getByRole("button", { name: "Simulate scan" }).click();
    await page.getByRole("button", { name: /Doritos Nacho Cheese/ }).click();

    const shell = page.getByTestId("mobile-shell");
    // Base multi-unit is a CONSCIOUS opt-in: no stepper until the quiet
    // action is tapped (it appears only while the base row is active) — and
    // an explicit "Single-unit price" fallback undoes it in one tap.
    await page.getByRole("button", { name: "Edit base price" }).click();
    await expect(page.getByRole("button", { name: "Increase base quantity" })).not.toBeVisible();
    await shell.getByRole("button", { name: /Multi-unit price/ }).click();
    await expect(page.getByRole("button", { name: "Increase base quantity" })).toBeVisible();
    await shell.getByRole("button", { name: "Use single price" }).click();
    await expect(page.getByRole("button", { name: "Increase base quantity" })).not.toBeVisible();
    await expect(shell.getByRole("button", { name: /Multi-unit price/ })).toBeVisible();
    // $1.00 base on the national brand lands below its private label — a hard
    // ladder break. The CTA flips to the red-outlined blocked state, and TWO
    // resolutions appear inline: revert THIS item, or keep the price and let
    // the related items move to preserve the ladder.
    for (const d of ["1", "0", "0"]) await page.getByRole("button", { name: d, exact: true }).click();
    await expect(shell.getByText(/Breaks (the .* ladder|\d+ pricing ladders)/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Resolve pricing issue" })).toBeVisible();
    await expect(shell.getByRole("button", { name: /^Revert to \$/ })).toBeVisible();
    const fixBtn = shell.getByRole("button", { name: /^Fix \d+ related items?$/ });
    await expect(fixBtn).toBeVisible();
    await page.screenshot(SHOT("09-ladder-break"));

    // Choose "Fix related": the break clears, the neighbor repairs preview in,
    // and the save unblocks (the plan applies on commit).
    await fixBtn.click();
    await expect(shell.getByText(/Breaks (the .* ladder|\d+ pricing ladders)/)).toHaveCount(0);
    await expect(shell.getByText(/Fixes \d+ related items? on save/)).toBeVisible();

    // Line pricing (family) is a SEPARATE consequence, still previewed and
    // stated on the Save button itself.
    const famStrip = shell.getByRole("button", { name: /Also updates \d+ related item/ });
    await expect(famStrip).toBeVisible();
    await expect(shell.getByText(/\d+ follow/)).toBeVisible();
    await famStrip.click();
    await page.screenshot(SHOT("10-family-preview"));

    // A fresh base price edit owns its justification — the seeded reason does
    // NOT ride in. The chip reads "Add reason" and the CTA names the blocker.
    await expect(shell.getByRole("button", { name: "Add reason", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add reason codes" })).toBeVisible();
    // Pick the base reason → nothing else gates; the save is ready.
    await shell.getByRole("button", { name: "Add reason", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cost change", exact: true }).click();
    await expect(shell.getByRole("button", { name: /Cost change/ })).toBeVisible();
    const saveBtn = page.getByRole("button", { name: /^Save · \d+ items$/ });
    await expect(saveBtn).toBeEnabled();
    await page.screenshot(SHOT("11-ready-to-save"));

    await saveBtn.click();
    await expect(page.getByRole("status").getByText(/Doritos Nacho Cheese/)).toBeVisible();
    await expect(page.getByText(/\d+ related items updated/)).toBeVisible();
    await expect(page.getByText("Added to Store Walk")).toBeVisible();
    await page.screenshot(SHOT("12-family-overlay"));
    await expect(page.getByText("Waiting for barcode…")).toBeVisible();

    // Both consequences LAND in the walk — the family plus the repaired ladder
    // neighbors — so the tray carries more than the edited item alone.
    await page.getByRole("button", { name: /Session tray, [1-9]\d* edited this walk/ }).click();
    await expect(shell.getByText(/Doritos Nacho Cheese/)).toBeVisible();
    await page.screenshot(SHOT("16-family-in-tray"));
  });

  test("edit offer dates of an existing deal without changing the price", async ({ page }) => {
    await page.goto("/#m/walk");
    await page.getByRole("button", { name: "Simulate scan" }).click();
    await page.getByRole("button", { name: /Lay's Classic Potato Chips/ }).click();

    const shell = page.getByTestId("mobile-shell");
    // The active promo shows its run window at rest — and it's now tappable.
    const runWindow = shell.getByRole("button", { name: /Jul \d+ . Jul \d+/ }).first();
    await expect(runWindow).toBeVisible();
    await expect(page.getByRole("button", { name: "Save & next" })).toBeDisabled();

    // Tap the window → the promo-window sheet; extend to two weeks (no price
    // touched). The read-only window yields to the editable when&why chips.
    await runWindow.click();
    await expect(page.getByText(/Promo window/i)).toBeVisible();
    await page.getByRole("button", { name: "2 weeks" }).click();
    // A date-only edit is still a change: it needs a fresh reason. The prior
    // reason does NOT carry over, so the CTA names the blocker and the chip is empty.
    await expect(page.getByRole("button", { name: "Add reason codes" })).toBeVisible();
    await expect(shell.getByRole("button", { name: "Add reason", exact: true })).toBeVisible();
    await expect(shell.getByRole("button", { name: /^Undo$/ })).toBeVisible();
    await page.screenshot(SHOT("17-dates-only-change"));

    // Justify it — even re-picking the same reason is a deliberate act → saveable.
    await shell.getByRole("button", { name: "Add reason", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Manager special", exact: true }).click();
    await expect(page.getByRole("button", { name: "Save & next" })).toBeEnabled();
    await page.screenshot(SHOT("18-dates-only-justified"));
  });

  test("competitors panel: the desktop comparison table, reworked for mobile", async ({ page }) => {
    await page.goto("/#m/walk");
    await page.getByRole("button", { name: "Simulate scan" }).click();
    await page.getByRole("button", { name: /Lay's Classic Potato Chips/ }).click();

    const shell = page.getByTestId("mobile-shell");
    await shell.getByRole("button", { name: /^Competitors/ }).click();

    // The full desktop table comes along — headers included: the Our-price
    // anchor with Base / Retail / Index labels (Lay's has an active deal, so the
    // Retail column earns its place).
    const panel = page.getByRole("dialog", { name: "Competitor prices" });
    await expect(panel.getByText("Our price")).toBeVisible();
    await expect(panel.getByText("Base", { exact: true })).toBeVisible();
    await expect(panel.getByText("Retail", { exact: true })).toBeVisible();
    await expect(panel.getByText("Index", { exact: true })).toBeVisible();
    // A competitor row: name + distance meta + a colored base diff + the index.
    await expect(panel.getByText("Walmart")).toBeVisible();
    await expect(panel.getByText(/\d+\.\d+% (higher|lower)/).first()).toBeVisible();
    await expect(panel.getByText(/^\d\.\d\d$/).first()).toBeVisible();
    await page.screenshot(SHOT("18-competitors-table"));
  });

  test("relationships panel: the desktop groups table, reworked for mobile", async ({ page }) => {
    await page.goto("/#m/walk");
    await page.getByRole("button", { name: "Simulate scan" }).click();
    await page.getByRole("button", { name: /Lay's Classic Potato Chips/ }).click();

    const shell = page.getByTestId("mobile-shell");
    await shell.getByRole("button", { name: /^Groups/ }).click();

    const panel = page.getByRole("dialog", { name: "Product relationships" });
    // Collapsible sections per relationship, values named as BASE PRICE — and
    // size groups add SIZE + PRICE / UoM (the desktop columns, kept on mobile).
    await expect(panel.getByText(/Size groups/)).toBeVisible();
    await expect(panel.getByText("Base price", { exact: true }).first()).toBeVisible();
    await expect(panel.getByText(/Price . UoM/)).toBeVisible();
    // The 18oz item's UoM (base ÷ oz) and the ladder gap between adjacent sizes.
    await expect(panel.getByText("18oz", { exact: true })).toBeVisible();
    await expect(panel.getByText("$0.24")).toBeVisible();
    await expect(panel.getByText(/↑ \d+\.\d+%/).first()).toBeVisible();
    // No leftover prose from the old panel.
    await expect(panel.getByText(/editing any member updates all/)).toHaveCount(0);
    await page.screenshot(SHOT("19-relationships-table"));

    // Each group states its gap rule inline, always visible (no tap): the
    // ordering plus the minimum-gap threshold that flags a step as narrow.
    await expect(panel.getByText(/price above/i).first()).toBeVisible();
    await expect(panel.getByText(/≥\d+%/).first()).toBeVisible();
  });

  test("sales: on-hand & weekly units are read-only; a price draft projects a range", async ({ page }) => {
    await page.goto("/#m/walk");
    await page.getByRole("button", { name: "Simulate scan" }).click();
    await page.getByRole("button", { name: /EDLP-5/ }).click();

    const shell = page.getByTestId("mobile-shell");
    // Both figures are reported, not edited — no keypad target on either.
    await expect(page.getByRole("button", { name: "Edit weekly units" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit on hand" })).toHaveCount(0);
    // No projection at rest — it's the price draft that summons it.
    await expect(shell.getByText("est./wk")).toHaveCount(0);

    // An INVALID base (over the +10% ceiling) can't ship → no forecast; the
    // error strip owns the row instead.
    await page.getByRole("button", { name: "Edit base price" }).click();
    for (const d of ["9", "9", "9"]) await page.getByRole("button", { name: d, exact: true }).click();
    await expect(shell.getByText(/Exceeds the \+10% ceiling/)).toBeVisible();
    await expect(shell.getByText("est./wk")).toHaveCount(0);

    // Correct it to a valid price → the estimated weekly-sales range rises in.
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Backspace" }).click();
    for (const d of ["1", "9", "9"]) await page.getByRole("button", { name: d, exact: true }).click();
    await expect(shell.getByText("est./wk")).toBeVisible();
    await page.screenshot(SHOT("13-sales-projection"));
  });

  test("no deal → add deal seeds a placeholder; blocked-reason CTA points at the cause", async ({ page }) => {
    await page.goto("/#m/walk");
    await page.getByRole("button", { name: "Simulate scan" }).click();
    await page.getByRole("button", { name: /EDLP-5/ }).click();

    const shell = page.getByTestId("mobile-shell");
    // Promo-less item: the retail row rests as "No deal" — not a fake $0.00.
    await expect(shell.getByText("No deal")).toBeVisible();
    await shell.getByRole("button", { name: "Add deal" }).click();
    // Seeds the base price as a dimmed placeholder + summons the keypad;
    // nothing committed, so the CTA stays pristine.
    await expect(page.getByRole("group", { name: "Price keypad" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save & next" })).toBeDisabled();
    // Dismiss with nothing typed → the row collapses back to No deal.
    await page.getByRole("button", { name: "Hide keypad" }).click();
    await expect(shell.getByText("No deal")).toBeVisible();
    await page.screenshot(SHOT("17-no-deal"));

    // Type a real deal → chips arrive with a red "Add reason"; the blocked
    // CTA names it and, tapped, pulses the offending section instead of saving.
    await shell.getByRole("button", { name: "Add deal" }).click();
    for (const d of ["1", "0", "0"]) await page.getByRole("button", { name: d, exact: true }).click();
    await expect(shell.getByText("$1.00", { exact: true })).toBeVisible();
    const blocked = page.getByRole("button", { name: "Add reason codes" });
    await expect(blocked).toBeVisible();
    await blocked.click();
    await expect(shell.locator(".pulse-attention")).toHaveCount(1);
    await expect(page.getByText("Waiting for barcode…")).toHaveCount(0); // no save happened
    await page.screenshot(SHOT("18-blocked-reason"));

    await shell.getByRole("button", { name: "Add reason", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Manager special", exact: true }).click();
    await page.getByRole("button", { name: "Save & next" }).click();
    await expect(page.getByText("$1.00 deal")).toBeVisible();
    await expect(page.getByText("Waiting for barcode…")).toBeVisible();
  });

  test("cancelled fuel change never inflates the pill (regression)", async ({ page }) => {
    await page.goto("/#m/walk");
    await page.getByRole("button", { name: "Simulate scan" }).click();
    await page.getByRole("button", { name: /Doritos Nacho Cheese/ }).click();
    await pickFuelDifferentFromCurrent(page);
    // Reversible-draft editing: a fuel change is now a local draft, so the X
    // asks before discarding meaningful work. Confirm the discard.
    await page.getByRole("button", { name: "Cancel" }).click(); // header X
    await page.getByRole("dialog", { name: "Discard changes?" }).getByRole("button", { name: "Discard changes" }).click();
    await expect(page.getByText("Waiting for barcode…")).toBeVisible();
    // The change never committed (draft only), so the walk stays clean.
    await expect(page.getByRole("button", { name: "Session tray, 0 edited this walk" })).toBeVisible();
  });

  test("item maintenance: reason gate → send to SAP; walk session stays clean", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Item Maintenance/ }).click();
    await page.getByRole("button", { name: "Simulate scan" }).click();
    await page.getByRole("button", { name: /Lay's Classic Potato Chips/ }).click();

    const shell = page.getByTestId("mobile-shell");
    const picked = await pickFuelDifferentFromCurrent(page);
    await expect(shell.getByRole("button", { name: /^Fuel/ })).toContainText(picked);
    // Reason is REQUIRED before anything reaches SAP — the CTA itself names
    // the blocker (red outline), and the chip under the change is red too.
    await expect(page.getByRole("button", { name: "Add reason codes" })).toBeVisible();
    await shell.getByRole("button", { name: "Add reason", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Displays", exact: true }).click();
    await expect(page.getByRole("button", { name: "Send to SAP" })).toBeEnabled();
    await page.screenshot(SHOT("14-maint-ready"));

    await page.getByRole("button", { name: "Send to SAP" }).click();
    await expect(page.getByText("Sent to SAP")).toBeVisible();
    await page.screenshot(SHOT("15-maint-success"));
    await page.getByRole("button", { name: "Scan next item" }).click();
    await expect(page.getByText("Waiting for barcode…")).toBeVisible();

    // None of that shows up as walk work.
    await page.getByRole("button", { name: "Home" }).click();
    await page.getByRole("button", { name: /Store Walk/ }).click();
    await expect(page.getByRole("button", { name: "Session tray, 0 edited this walk" })).toBeVisible();
  });

  test("scan-while-editing autosaves the draft and jumps items", async ({ page }) => {
    await page.goto("/#m/walk");
    // Grab Doritos' derived UPC off the simulate sheet, for the mid-edit scan.
    await page.getByRole("button", { name: "Simulate scan" }).click();
    const doritosLine = await page.getByText(/RBCS5-1 · \d+/).innerText();
    const doritosUpc = doritosLine.split("· ")[1].trim();
    await page.getByRole("button", { name: /Lay's Classic Potato Chips/ }).click();
    await page.getByRole("button", { name: "Edit retail price" }).click();
    for (const d of ["2", "9", "9"]) await page.getByRole("button", { name: d, exact: true }).click();
    // Mid-edit hardware scan (wedge burst): the draft autosaves and the next
    // item opens directly — the scan gun always wins.
    await page.keyboard.type(doritosUpc, { delay: 15 });
    await page.keyboard.press("Enter");
    const shell = page.getByTestId("mobile-shell");
    await expect(shell.getByText(/Doritos Nacho Cheese/)).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("button", { name: "Session tray, 1 edited this walk" })).toBeVisible();
  });

  test("hardware wedge: typed UPC burst + Enter opens the item", async ({ page }) => {
    await page.goto("/#m/walk");
    await expect(page.getByText("Waiting for barcode…")).toBeVisible();
    await page.getByRole("button", { name: "Simulate scan" }).click();
    const laysLine = await page.getByText(/W7BESS · \d+/).innerText();
    const upc = laysLine.split("· ")[1].trim();
    await page.keyboard.press("Escape");
    await expect(page.getByText("Waiting for barcode…")).toBeVisible();
    await page.keyboard.type(upc, { delay: 15 });
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("mobile-shell").getByText(/Lay's Classic Potato Chips/)).toBeVisible();
  });
});

test.describe("desktop untouched", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("table renders, drawer opens, no mobile shell", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByText("Waiting for barcode…")).not.toBeVisible();
    await expect(page.getByRole("button", { name: /Item Maintenance/ })).not.toBeVisible();
    await page.locator("#main-content").getByText("Lay's Classic Potato Chips 18oz").first().click();
    await expect(page.getByRole("button", { name: "Done" })).toBeVisible();
  });
});
