import { test, expect } from "@playwright/test";

// Guards the pre-usability-test polish behaviors: simulated SAP confirmation
// (Sending → Live) and full pricing-strategy filter names — anchors the
// moderator script relies on.

test.describe("Phase 1 dry run", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "desktop-only round");

  test("sent batch flips Sending → Live after ~10s with toast (Task 7)", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/");
    await page.getByRole("button", { name: /^Batches$/i }).click();
    const batchRow = page
      .locator("div.rounded-xl")
      .filter({ has: page.getByText("This week's promos") })
      .first();
    await batchRow.getByRole("button", { name: /^Send now$/i }).click();
    await page.getByRole("button", { name: /Send to SAP now/i }).click();
    // Lands in Sent & Live with a Sending badge
    await page.getByRole("radio", { name: /Sent & Live/i }).click();
    await expect(page.getByText(/^Sending$/).first()).toBeVisible();
    // Simulated SAP acknowledgment confirms it after ~10s
    await expect(page.getByText(/is now live in SAP/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/^Live$/).first()).toBeVisible();
  });

  test("Pricing strategy filter shows full names (Task 11)", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Filters/i }).click();
    await page.getByRole("button", { name: /Expand Pricing strategy/i }).click();
    await expect(page.getByRole("checkbox", { name: /Pricing strategy: Temporary Allowance/i })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Pricing strategy: Everyday Low Price/i })).toBeVisible();
    // Applying it actually filters
    await page.getByRole("checkbox", { name: /Pricing strategy: Temporary Allowance/i }).check();
    await page.getByRole("button", { name: /^Apply/ }).click();
    await expect(page.getByRole("heading", { name: /All items/i })).toContainText("of");
  });
});
