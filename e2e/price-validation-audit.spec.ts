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

});
