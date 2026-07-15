// DISPOSABLE verification spec for the mobile redesign — drives both
// workflows at the Zebra TC57X's CSS viewport (360×640 @ DPR3), captures
// design-review screenshots into e2e/screenshots/ (gitignored), and regression-
// tests the four review fixes. Run with --project=desktop-chrome (test.use
// pins the device profile). Delete after the feature lands.
import { test, expect, type Page } from "@playwright/test";

const SHOT = (name: string) => ({ path: `e2e/screenshots/mobile-${name}.png` });

async function pickFuelDifferentFromCurrent(page: Page) {
  // Fuel rows carry seeded values that vary per item — pick whatever differs
  // from the current label so the change is guaranteed to register.
  const row = page.getByRole("button", { name: /Fuel Saver/ });
  const current = (await row.innerText()).includes("None") ? "+10¢" : "None";
  await row.click();
  await page.getByRole("dialog").getByRole("button", { name: current, exact: true }).click();
  return current;
}

test.describe("mobile shell (TC57X viewport)", () => {
  test.use({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

  test("store walk: scan → keypad → save & next → session tray", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /Store Walk/ })).toBeVisible();
    // Hy-Vee header: brand bar + store switcher + address, no bell/batches.
    await expect(page.getByTestId("mobile-shell").getByText("Store Pricing")).toBeVisible();
    await expect(page.getByTestId("mobile-shell").getByRole("button", { name: /switch store/ })).toBeVisible();
    await page.screenshot(SHOT("01-home"));

    await page.getByRole("button", { name: /Store Walk/ }).click();
    await expect(page.getByText("Waiting for barcode…")).toBeVisible();
    await expect(page.getByRole("button", { name: "Session tray, 0 edited this walk" })).toBeVisible();
    await page.screenshot(SHOT("02-walk-waiting"));

    // Scan Lay's (W7BESS — carries a seeded pending retail TA).
    await page.getByRole("button", { name: "Simulate scan" }).click();
    await page.screenshot(SHOT("03-simulate-sheet"));
    await page.getByRole("button", { name: /Lay's Classic Potato Chips/ }).click();

    // Issue-4 regression: the identity price is the LIVE retail — the same
    // number the Retail section's "was" line references. (Scope to the mobile
    // shell: the CSS-hidden desktop tree is still in the DOM.)
    const shell = page.getByTestId("mobile-shell");
    const wasLine = await shell.getByText(/^was \$/).innerText(); // "was $3.99"
    const livePrice = wasLine.replace("was ", "");
    await expect(shell.getByText(livePrice, { exact: true }).first()).toBeVisible();

    // Focus invariant: exactly ONE caret on screen, sitting in the default
    // (retail) target while the amount renders placeholder-dimmed.
    await expect(shell.locator(".caret-blink")).toHaveCount(1);
    await page.screenshot(SHOT("03b-edit-pristine"));

    // Cents keypad: 2, 9, 9 → $2.99.
    for (const d of ["2", "9", "9"]) {
      await page.getByRole("button", { name: d, exact: true }).click();
    }
    await expect(shell.getByText("$2.99", { exact: true })).toBeVisible();
    await page.screenshot(SHOT("04-edit-retail"));
    await page.getByRole("button", { name: "Save & next" }).click();

    await expect(page.getByText("Waiting for barcode…")).toBeVisible();
    await expect(page.getByRole("button", { name: "Session tray, 1 edited this walk" })).toBeVisible();
    await page.screenshot(SHOT("05-walk-after-save"));

    // Issue-3 regression: fuel-only edit on Doritos (RBCS5-1, which carries
    // seeded pending base+retail overrides) must surface ONLY the F line in
    // the tray — never the seeded "3 for $12.00" retail or the seeded base.
    await page.getByRole("button", { name: "Simulate scan" }).click();
    await page.getByRole("button", { name: /Doritos Nacho Cheese/ }).click();
    await page.screenshot(SHOT("06-edit-doritos"));
    const picked = await pickFuelDifferentFromCurrent(page);
    await page.screenshot(SHOT("07-fuel-sheet-closed")); // row now shows picked value
    await page.getByRole("button", { name: "Save & next" }).click();
    await expect(page.getByRole("button", { name: "Session tray, 2 edited this walk" })).toBeVisible();

    await page.getByRole("button", { name: "Session tray, 2 edited this walk" }).click();
    const doritosRow = page.locator("li").filter({ hasText: "Doritos" });
    await expect(doritosRow).toBeVisible();
    await expect(doritosRow).toContainText("Fuel");
    await expect(doritosRow).toContainText(picked);
    await expect(doritosRow).not.toContainText("$12.00"); // seeded retail stays out
    await expect(doritosRow).not.toContainText("$5.79"); // seeded base stays out
    await page.screenshot(SHOT("08-session-tray"));

    // Re-edit from the tray: retail multi-unit is the PROMINENT stepper…
    await page.locator("li").filter({ hasText: "Lay's" }).getByRole("button").first().click();
    await page.getByRole("button", { name: "Increase retail quantity" }).click();
    for (const d of ["5", "5", "0"]) {
      await page.getByRole("button", { name: d, exact: true }).click();
    }
    await expect(shell.getByText("2 for $5.50")).toBeVisible();
    await page.screenshot(SHOT("04b-retail-multiunit"));
    // …while Base multi-unit stays tucked behind the disclosure. Expanding
    // it moves the single caret from Retail into the Base price box.
    await page.getByRole("button", { name: /Base price · / }).click();
    await expect(shell.locator(".caret-blink")).toHaveCount(1);
    await page.getByRole("button", { name: "Increase base quantity" }).click();
    await page.getByRole("button", { name: "Increase base quantity" }).click();
    for (const d of ["9", "9", "9"]) {
      await page.getByRole("button", { name: d, exact: true }).click();
    }
    await expect(page.getByText("3 for $9.99")).toBeVisible();
    await page.screenshot(SHOT("09-base-expanded"));
    await page.getByRole("button", { name: "Save & next" }).click();

    // End walk clears the session.
    await page.getByRole("button", { name: /Session tray, 2 edited this walk/ }).click();
    await page.getByRole("button", { name: /End walk/ }).click();
    await expect(page.getByRole("button", { name: /Store Walk/ })).toBeVisible();
  });

  test("issue-2 regression: cancelled fuel change never inflates the pill", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Store Walk/ }).click();
    await page.getByRole("button", { name: "Simulate scan" }).click();
    await page.getByRole("button", { name: /Doritos Nacho Cheese/ }).click();
    await pickFuelDifferentFromCurrent(page);
    await page.getByRole("button", { name: "Cancel" }).click(); // header X
    await expect(page.getByText("Waiting for barcode…")).toBeVisible();
    await expect(page.getByRole("button", { name: "Session tray, 0 edited this walk" })).toBeVisible();
  });

  test("item maintenance: review → send to SAP; walk session stays clean (issue 1)", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Item Maintenance/ }).click();
    await expect(page.getByText("Waiting for barcode…")).toBeVisible();
    await page.getByRole("button", { name: "Simulate scan" }).click();
    await page.getByRole("button", { name: /Pop Secret/ }).click();
    const picked = await pickFuelDifferentFromCurrent(page);
    await page.getByRole("button", { name: "Review change" }).click();

    const shell = page.getByTestId("mobile-shell");
    await expect(shell.getByText("Review change")).toBeVisible();
    await expect(shell.getByText("Fuel Saver")).toBeVisible();
    await expect(shell.getByText(picked)).toBeVisible();
    await expect(shell.getByText("Immediately")).toBeVisible();
    await page.screenshot(SHOT("10-maint-review"));

    await page.getByRole("button", { name: "Send to SAP" }).click();
    await expect(page.getByText("Sent to SAP")).toBeVisible();
    await page.screenshot(SHOT("11-maint-success"));
    await page.getByRole("button", { name: "Scan next item" }).click();
    await expect(page.getByText("Waiting for barcode…")).toBeVisible();

    // Issue-1 regression: none of that shows up as walk work.
    await page.getByRole("button", { name: "Home" }).click();
    await page.getByRole("button", { name: /Store Walk/ }).click();
    await expect(page.getByRole("button", { name: "Session tray, 0 edited this walk" })).toBeVisible();
    await page.getByRole("button", { name: "Session tray, 0 edited this walk" }).click();
    await expect(page.getByText("No edits yet this walk.")).toBeVisible();
    await page.screenshot(SHOT("12-walk-clean-after-maint"));
  });

  test("hardware wedge: typed UPC burst + Enter opens the item", async ({ page }) => {
    await page.goto("/#m/walk");
    await expect(page.getByText("Waiting for barcode…")).toBeVisible();
    // Read Lay's real (derived) UPC off the simulate sheet, then feed it as
    // a keystroke burst the way DataWedge would.
    await page.getByRole("button", { name: "Simulate scan" }).click();
    const laysLine = await page.getByText(/W7BESS · \d+/).innerText();
    const upc = laysLine.split("· ")[1].trim();
    await page.keyboard.press("Escape"); // close the sheet
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
    await page.screenshot({ path: "e2e/screenshots/desktop-01-list.png", fullPage: false });
    await page.locator("#main-content").getByText("Lay's Classic Potato Chips 18oz").first().click();
    await expect(page.getByRole("button", { name: "Done" })).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/desktop-02-drawer.png", fullPage: false });
  });
});
