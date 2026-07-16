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
    // Margin is one calculation PER price: retail (vs allowance cost) and
    // base (vs unit cost) shown side by side, not a blended number.
    await expect(shell.getByText("Retail 34.7%")).toBeVisible();
    await expect(shell.getByText("Base 33.6%")).toBeVisible();
    await expect(shell.getByText(/^Base$/)).toBeVisible();
    await expect(page.getByRole("group", { name: "Price keypad" })).not.toBeVisible();
    await expect(shell.locator(".caret-blink")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
    await page.screenshot(SHOT("01-reading-posture"));

    // Editing posture: tap retail → keypad + caret; type 2-9-9 → $2.99 with
    // the "was" reference and the when&why chips arriving inline.
    await page.getByRole("button", { name: "Edit retail price" }).click();
    await expect(page.getByRole("group", { name: "Price keypad" })).toBeVisible();
    await expect(shell.locator(".caret-blink")).toHaveCount(1);
    for (const d of ["2", "9", "9"]) await page.getByRole("button", { name: d, exact: true }).click();
    await expect(shell.getByText("$2.99", { exact: true })).toBeVisible();
    await expect(shell.getByText(/was \$3\.99/)).toBeVisible();
    // Seeded store reason rides in pre-filled — the chip shows it, editable.
    await expect(shell.getByRole("button", { name: /Local deal/ })).toBeVisible();
    await page.screenshot(SHOT("02-editing-posture"));

    // Re-pick the reason from the chip's sheet.
    await shell.getByRole("button", { name: /Local deal/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Manager special", exact: true }).click();
    await expect(shell.getByRole("button", { name: /Manager special/ })).toBeVisible();

    // Save — success overlay (auto-dismisses ~850ms) → scanner, tally bumped.
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Item updated")).toBeVisible();
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
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
    await page.screenshot(SHOT("06-hq-accepted"));

    // Undo → pending again; Keep current → staged decline, still saveable.
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(shell.getByText("recommends")).toBeVisible();
    await page.getByRole("button", { name: "Keep current" }).click();
    await expect(shell.getByText(/Keeping current — rec declined/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
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
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Item updated")).toBeVisible();
    await expect(page.getByText("Waiting for barcode…")).toBeVisible();
    await expect(page.getByRole("button", { name: "Session tray, 1 edited this walk" })).toBeVisible();
  });

  test("ladder validation inline + line-pricing preview + mandatory reason", async ({ page }) => {
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
    await shell.getByRole("button", { name: "Single-unit price" }).click();
    await expect(page.getByRole("button", { name: "Increase base quantity" })).not.toBeVisible();
    await expect(shell.getByRole("button", { name: /Multi-unit price/ })).toBeVisible();
    // $1.00 base on the national brand lands below its private label — a
    // hard ladder break, explained inline with a one-tap fix.
    for (const d of ["1", "0", "0"]) await page.getByRole("button", { name: d, exact: true }).click();
    await expect(shell.getByText(/Breaks the .* ladder — needs at least/)).toBeVisible();
    const fixChip = shell.getByRole("button", { name: /^Use \$/ });
    await expect(fixChip).toBeVisible();
    await expect(page.getByRole("button", { name: /^Save/ })).toBeDisabled();
    await page.screenshot(SHOT("09-ladder-break"));

    await fixChip.click();
    await expect(shell.getByText(/Breaks the .* ladder/)).toHaveCount(0);

    // Line pricing: the family consequence, attached to its cause — and
    // stated again on the Save button itself.
    const famStrip = shell.getByRole("button", { name: /Also updates \d+ related item/ });
    await expect(famStrip).toBeVisible();
    await famStrip.click();
    await page.screenshot(SHOT("10-family-preview"));
    const saveBtn = page.getByRole("button", { name: /^Save · \d+ items$/ });
    await expect(saveBtn).toBeVisible();

    // Doritos seeds a store-chosen base reason — the chip rides in filled,
    // so nothing gates the save. (The empty-reason gate is exercised in the
    // maintenance test below.)
    await expect(shell.getByRole("button", { name: /Cost change/ })).toBeVisible();
    await expect(saveBtn).toBeEnabled();
    await page.screenshot(SHOT("11-ready-to-save"));

    await saveBtn.click();
    await expect(page.getByText("Item updated")).toBeVisible();
    await expect(page.getByText(/\d+ related items updated/)).toBeVisible();
    await expect(page.getByText("Added to Store Walk")).toBeVisible();
    await page.screenshot(SHOT("12-family-overlay"));
    await expect(page.getByText("Waiting for barcode…")).toBeVisible();
  });

  test("inventory: weekly delta, save without reason, no walk-tray noise", async ({ page }) => {
    await page.goto("/#m/walk");
    await page.getByRole("button", { name: "Simulate scan" }).click();
    await page.getByRole("button", { name: /EDLP-5/ }).click();

    const shell = page.getByTestId("mobile-shell");
    await page.getByRole("button", { name: "Edit weekly units" }).click();
    await expect(page.getByRole("group", { name: "Price keypad" })).toBeVisible();
    for (const d of ["9", "9"]) await page.getByRole("button", { name: d, exact: true }).click();
    // Baseline is seeded ≤ 30, so 99 always shows a positive delta.
    await expect(shell.getByText(/\(\+\d+\)/)).toBeVisible();
    await page.screenshot(SHOT("13-weekly-delta"));

    // Inventory-only change: no reason needed, saves clean.
    const saveBtn = page.getByRole("button", { name: "Save", exact: true });
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();
    await expect(page.getByText("Inventory updated")).toBeVisible();
    await expect(page.getByText("Added to Store Walk")).toHaveCount(0);
    await expect(page.getByText("Waiting for barcode…")).toBeVisible();
    // Not price work → the walk tally stays untouched.
    await expect(page.getByRole("button", { name: "Session tray, 0 edited this walk" })).toBeVisible();
  });

  test("cancelled fuel change never inflates the pill (regression)", async ({ page }) => {
    await page.goto("/#m/walk");
    await page.getByRole("button", { name: "Simulate scan" }).click();
    await page.getByRole("button", { name: /Doritos Nacho Cheese/ }).click();
    await pickFuelDifferentFromCurrent(page);
    await page.getByRole("button", { name: "Cancel" }).click(); // header X
    await expect(page.getByText("Waiting for barcode…")).toBeVisible();
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
    // Reason is REQUIRED before anything reaches SAP.
    await expect(page.getByRole("button", { name: "Send to SAP" })).toBeDisabled();
    await expect(shell.getByText("Add a change reason to send")).toBeVisible();
    await shell.getByRole("button", { name: "Reason", exact: true }).click();
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
