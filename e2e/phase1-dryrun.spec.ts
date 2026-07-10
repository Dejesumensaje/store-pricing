import { test, expect } from "@playwright/test";

// Guards a pre-usability-test polish behavior: full pricing-strategy filter
// names — an anchor the moderator script relies on. (The sibling "sent batch"
// test that used to live here was removed with the batch/send system in the
// v0.0 descope — there's no equivalent surface to guard anymore.)

test.describe("Phase 1 dry run", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "desktop-only round");

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
