/**
 * UX / usability / IA audit for the price validation guardrails:
 *  - Retail hard stops ($0, above base)
 *  - Retail soft warning (>50% discount) — 3-option dialog
 *  - Base price hard block (order inversion)
 *  - Base price soft warning (narrow gap) — 3-option dialog
 *  - Done-button bypass protection for both fields
 *
 * Each test captures screenshots at every key state transition so we can
 * review the actual rendered UI, not just assertions.
 */

import { test, Page } from "@playwright/test";
import path from "path";

const SS = (name: string) => `e2e/screenshots/audit-${name}.png`;

// ─── helpers ────────────────────────────────────────────────────────────────

/** Navigate to root and wait for the table to settle. */
async function goHome(page: Page) {
  await page.goto("http://localhost:3000");
  await page.waitForLoadState("networkidle");
  // Give React a moment to hydrate
  await page.waitForTimeout(600);
}

/** Open the item drawer by clicking the row whose text includes `itemName`. */
async function openDrawer(page: Page, itemName: string) {
  // The table renders rows — click the cell/row that contains the item name.
  const row = page.locator("tr, [role='row']").filter({ hasText: itemName }).first();
  await row.waitFor({ state: "visible", timeout: 8000 });
  await row.click();
  // Wait for the drawer's heading to appear
  await page.waitForSelector("[data-drawer], [role='dialog']", { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(400);
}

/** Click the base price Change / Set price button to reveal the input. */
async function activateBaseInput(page: Page) {
  // Look for Change or "Set base price" / "Set price" buttons in the drawer
  const btn = page.getByRole("button", { name: /change|set.*price|set price/i }).first();
  if (await btn.isVisible().catch(() => false)) await btn.click();
  await page.waitForTimeout(200);
}

/** Type into the first visible price input inside the drawer and blur. */
async function typeBasePrice(page: Page, price: string) {
  // Base price inputs are either a plain number input or dollar-prefixed
  const input = page.locator("input[aria-label*='price' i], input[aria-label*='base' i], input[inputmode='decimal'], input[inputmode='numeric']").first();
  await input.waitFor({ state: "visible", timeout: 4000 });
  await input.clear();
  await input.fill(price);
}

/** Set the retail exact-price input. */
async function typeRetailPrice(page: Page, price: string) {
  // The retail section has an "Exact price" tab and then a price input
  const exactTab = page.getByRole("button", { name: /exact price/i });
  if (await exactTab.isVisible().catch(() => false)) await exactTab.click();
  await page.waitForTimeout(150);
  const input = page.locator("input[aria-label='Price']").first();
  await input.waitFor({ state: "visible", timeout: 4000 });
  await input.clear();
  await input.fill(price);
}

// ─── audit tests ────────────────────────────────────────────────────────────

test.describe("Price Validation UX Audit", () => {

  test("00 — baseline: table loads, capture overall layout", async ({ page }) => {
    await goHome(page);
    await page.screenshot({ path: SS("00-table-baseline"), fullPage: false });
  });

  // ── RETAIL HARD STOPS ──────────────────────────────────────────────────────

  test("01 — retail hard stop: $0 inline error", async ({ page }) => {
    await goHome(page);
    // Pepperidge Farm Goldfish is a clean TA with no locked retail
    await openDrawer(page, "Goldfish");
    await page.screenshot({ path: SS("01a-goldfish-drawer-open") });

    // Start a promo price
    const setPromo = page.getByRole("button", { name: /set promo price/i });
    if (await setPromo.isVisible().catch(() => false)) await setPromo.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: SS("01b-goldfish-retail-input-visible") });

    await typeRetailPrice(page, "0");
    await page.keyboard.press("Tab"); // commit via blur
    await page.waitForTimeout(300);
    await page.screenshot({ path: SS("01c-goldfish-retail-zero-error") });
  });

  test("02 — retail hard stop: price above base", async ({ page }) => {
    await goHome(page);
    await openDrawer(page, "Goldfish");

    const setPromo = page.getByRole("button", { name: /set promo price/i });
    if (await setPromo.isVisible().catch(() => false)) await setPromo.click();
    await page.waitForTimeout(300);

    // Goldfish base is $3.19 — set retail to $5.00 (above base)
    await typeRetailPrice(page, "5.00");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(300);
    await page.screenshot({ path: SS("02-retail-above-base-error") });
  });

  test("03 — retail hard stop: Done bypass protection ($0)", async ({ page }) => {
    await goHome(page);
    await openDrawer(page, "Goldfish");

    const setPromo = page.getByRole("button", { name: /set promo price/i });
    if (await setPromo.isVisible().catch(() => false)) await setPromo.click();
    await page.waitForTimeout(300);

    // Type 0, then immediately click Done (no explicit blur)
    const input = page.locator("input[aria-label='Price']").first();
    await input.fill("0");
    // Click Done without pressing Tab first
    await page.getByRole("button", { name: /^done$/i }).click();
    await page.waitForTimeout(400);
    // Drawer should still be open with the error visible
    await page.screenshot({ path: SS("03-retail-zero-done-bypass") });
  });

  // ── RETAIL SOFT WARNING (>50%) ─────────────────────────────────────────────

  test("04 — retail soft warning: >50% dialog opens", async ({ page }) => {
    await goHome(page);
    await openDrawer(page, "Goldfish");

    const setPromo = page.getByRole("button", { name: /set promo price/i });
    if (await setPromo.isVisible().catch(() => false)) await setPromo.click();
    await page.waitForTimeout(300);

    // Goldfish base $3.19 — 50% off = $1.595 — set $1.50 to trigger soft
    await typeRetailPrice(page, "1.50");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(500);
    await page.screenshot({ path: SS("04a-retail-soft-warning-dialog") });

    // Inspect button labels
    const buttons = await page.locator("[role='dialog'] button, [data-modal] button").all();
    for (const btn of buttons) {
      const text = await btn.textContent();
      console.log("Dialog button:", text?.trim());
    }
    await page.screenshot({ path: SS("04b-retail-soft-warning-close-up") });
  });

  test("05 — retail soft warning: Cancel keeps drawer open, no price committed", async ({ page }) => {
    await goHome(page);
    await openDrawer(page, "Goldfish");

    const setPromo = page.getByRole("button", { name: /set promo price/i });
    if (await setPromo.isVisible().catch(() => false)) await setPromo.click();
    await page.waitForTimeout(300);

    await typeRetailPrice(page, "1.50");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(500);

    // Click Cancel
    await page.getByRole("button", { name: /^cancel$/i }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: SS("05-retail-soft-cancel") });
  });

  test("06 — retail soft warning: Use suggested price commits it", async ({ page }) => {
    await goHome(page);
    await openDrawer(page, "Goldfish");

    const setPromo = page.getByRole("button", { name: /set promo price/i });
    if (await setPromo.isVisible().catch(() => false)) await setPromo.click();
    await page.waitForTimeout(300);

    await typeRetailPrice(page, "1.50");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(500);

    // Click "Use $X.XX" (the suggested price button)
    const useBtn = page.getByRole("button", { name: /^use \$/i });
    await useBtn.waitFor({ state: "visible", timeout: 3000 }).catch(() => {});
    await page.screenshot({ path: SS("06a-retail-soft-before-use-suggested") });
    if (await useBtn.isVisible().catch(() => false)) {
      await useBtn.click();
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: SS("06b-retail-soft-after-use-suggested") });
  });

  // ── BASE PRICE SOFT WARNING (narrow gap) ───────────────────────────────────

  test("07 — base price soft warning: narrow gap dialog opens", async ({ page }) => {
    await goHome(page);
    // Lay's 13oz — setting $4.10 narrows gap vs Lay's 18oz ($4.29) below 5%
    await openDrawer(page, "Lay's Classic Potato Chips 13oz");
    await page.screenshot({ path: SS("07a-lays13-drawer-open") });

    await activateBaseInput(page);
    await page.screenshot({ path: SS("07b-lays13-base-input-visible") });

    await typeBasePrice(page, "4.10");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(600);
    await page.screenshot({ path: SS("07c-lays13-soft-warning-dialog") });

    // Log all visible dialog buttons
    const buttons = await page.locator("[role='dialog'] button, [role='alertdialog'] button").all();
    for (const btn of buttons) {
      const text = await btn.textContent();
      console.log("Base soft dialog button:", text?.trim());
    }
  });

  test("08 — base price soft warning: suggested price shown and accurate", async ({ page }) => {
    await goHome(page);
    await openDrawer(page, "Lay's Classic Potato Chips 13oz");
    await activateBaseInput(page);
    await typeBasePrice(page, "4.10");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(600);

    // The suggested price should be $4.08 (floor(4.29/1.05*100)/100)
    const useBtn = page.getByRole("button", { name: /^use \$/i });
    const btnText = await useBtn.textContent().catch(() => "not found");
    console.log("Suggested price button text:", btnText);
    await page.screenshot({ path: SS("08-lays13-suggested-price-button") });
  });

  test("09 — base price soft warning: Done bypass protection", async ({ page }) => {
    await goHome(page);
    await openDrawer(page, "Lay's Classic Potato Chips 13oz");
    await activateBaseInput(page);

    // Type a narrow-gap price, immediately click Done (no Tab first)
    const input = page.locator("input[inputmode='decimal'], input[inputmode='numeric']").first();
    await input.fill("4.10");
    await page.getByRole("button", { name: /^done$/i }).click();
    await page.waitForTimeout(500);
    // Dialog should have appeared and drawer should still be open
    await page.screenshot({ path: SS("09-base-soft-done-bypass") });
  });

  test("10 — base price soft: Use suggested price commits correctly", async ({ page }) => {
    await goHome(page);
    await openDrawer(page, "Lay's Classic Potato Chips 13oz");
    await activateBaseInput(page);
    await typeBasePrice(page, "4.10");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(600);

    const useBtn = page.getByRole("button", { name: /^use \$/i });
    if (await useBtn.isVisible().catch(() => false)) {
      await useBtn.click();
      await page.waitForTimeout(400);
    }
    // Drawer should show the committed suggested price
    await page.screenshot({ path: SS("10-base-soft-after-use-suggested") });
  });

  test("11 — base price soft: Save anyway commits the original price", async ({ page }) => {
    await goHome(page);
    await openDrawer(page, "Lay's Classic Potato Chips 13oz");
    await activateBaseInput(page);
    await typeBasePrice(page, "4.10");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(600);

    const saveBtn = page.getByRole("button", { name: /save anyway/i });
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(400);
    }
    // Should see committed price + amber banner (soft violation persists)
    await page.screenshot({ path: SS("11-base-soft-save-anyway") });
  });

  // ── BASE PRICE HARD BLOCK ──────────────────────────────────────────────────

  test("12 — base price hard block: order inversion modal", async ({ page }) => {
    await goHome(page);
    await openDrawer(page, "Lay's Classic Potato Chips 13oz");
    await activateBaseInput(page);

    // $4.29 = same price as Lay's 18oz → hard inversion
    await typeBasePrice(page, "4.29");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(600);
    await page.screenshot({ path: SS("12a-hard-block-modal") });

    // Confirm only 2 options (no 3rd path for hard blocks)
    const buttons = await page.locator("[role='dialog'] button, [role='alertdialog'] button").all();
    for (const btn of buttons) {
      const text = await btn.textContent();
      console.log("Hard block dialog button:", text?.trim());
    }
    await page.screenshot({ path: SS("12b-hard-block-buttons") });
  });

  // ── CONTRAST: soft vs hard visual differentiation ─────────────────────────

  test("13 — compare: soft (amber) vs hard (red) modal colors", async ({ page }) => {
    // Soft
    await goHome(page);
    await openDrawer(page, "Lay's Classic Potato Chips 13oz");
    await activateBaseInput(page);
    await typeBasePrice(page, "4.10");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(600);
    await page.screenshot({ path: SS("13a-modal-soft-amber") });

    await page.getByRole("button", { name: /^cancel$/i }).click();
    await page.waitForTimeout(300);

    // Hard
    await typeBasePrice(page, "4.29");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(600);
    await page.screenshot({ path: SS("13b-modal-hard-red") });
  });

  // ── POST-COMMIT AMBER BANNER ───────────────────────────────────────────────

  test("14 — amber banner after Save anyway", async ({ page }) => {
    await goHome(page);
    await openDrawer(page, "Lay's Classic Potato Chips 13oz");
    await activateBaseInput(page);
    await typeBasePrice(page, "4.10");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(600);

    const saveBtn = page.getByRole("button", { name: /save anyway/i });
    if (await saveBtn.isVisible().catch(() => false)) await saveBtn.click();
    await page.waitForTimeout(400);
    // Scroll to show the full drawer body including the amber banner
    await page.screenshot({ path: SS("14-amber-banner-after-save-anyway"), fullPage: false });
  });

  // ── MOBILE ─────────────────────────────────────────────────────────────────

  test("15 — mobile: retail hard stop error layout", async ({ page, browserName }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goHome(page);
    await openDrawer(page, "Goldfish");
    const setPromo = page.getByRole("button", { name: /set promo price/i });
    if (await setPromo.isVisible().catch(() => false)) await setPromo.click();
    await page.waitForTimeout(300);
    await typeRetailPrice(page, "0");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(300);
    await page.screenshot({ path: SS("15-mobile-retail-zero-error") });
  });

  test("16 — mobile: soft warning dialog legibility", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goHome(page);
    await openDrawer(page, "Lay's Classic Potato Chips 13oz");
    await activateBaseInput(page);
    await typeBasePrice(page, "4.10");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(600);
    await page.screenshot({ path: SS("16-mobile-soft-warning-dialog") });
  });

});
