import { test, expect } from "@playwright/test";

// The DS SearchInput renders as a toggle: a visible trigger button ("Open Search items")
// that expands into an actual input (aria-hidden=null when open, "true" when closed).
// ItemsToolbar mirrors that open/close state via MutationObserver to drive layout changes.

test.describe("ItemsToolbar search expand", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Open Search items" })).toBeVisible({ timeout: 10000 });
  });

  // ── Desktop ───────────────────────────────────────────────────────────────

  test("desktop: filter buttons stay visible when search is opened", async ({ page }, testInfo) => {
    if (testInfo.project.name !== "desktop") return;

    const filterButton = page.getByRole("button", { name: /Filters/i });
    await expect(filterButton).toBeVisible();

    await page.getByRole("button", { name: "Open Search items" }).click();
    await page.waitForTimeout(250);

    // Filters must remain visible on desktop
    await expect(filterButton).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/desktop-search-focused.png" });
  });

  test("desktop: search wrapper is at least 280px wide when expanded", async ({ page }, testInfo) => {
    if (testInfo.project.name !== "desktop") return;

    await page.getByRole("button", { name: "Open Search items" }).click();
    await page.waitForTimeout(250);

    const wrapper = page.getByTestId("search-wrapper");
    const box = await wrapper.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(280);

    await page.screenshot({ path: "e2e/screenshots/desktop-search-width.png" });
  });

  // ── Mobile ────────────────────────────────────────────────────────────────

  test("mobile: filter buttons are hidden when search is open", async ({ page }, testInfo) => {
    if (testInfo.project.name !== "mobile") return;

    const filterButton = page.getByRole("button", { name: /Filters/i });
    await expect(filterButton).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/mobile-search-idle.png" });

    await page.getByRole("button", { name: "Open Search items" }).click();
    await page.waitForTimeout(300);

    // Buttons must be gone (display:none via `hidden` class) while search is open
    await expect(filterButton).not.toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/mobile-search-open.png" });
  });

  test("mobile: filter buttons restore when search is closed via Escape", async ({ page }, testInfo) => {
    if (testInfo.project.name !== "mobile") return;

    const filterButton = page.getByRole("button", { name: /Filters/i });

    await page.getByRole("button", { name: "Open Search items" }).click();
    await page.waitForTimeout(300);
    await expect(filterButton).not.toBeVisible();

    // Close search via Escape — DS should set aria-hidden="true" back on the input
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    await expect(filterButton).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/mobile-search-closed.png" });
  });

  test("mobile: search wrapper fills the toolbar row when open", async ({ page }, testInfo) => {
    if (testInfo.project.name !== "mobile") return;

    const filterButton = page.getByRole("button", { name: /Filters/i });
    const idleBox = await filterButton.boundingBox();
    const idleFilterRight = (idleBox?.x ?? 0) + (idleBox?.width ?? 0);

    await page.getByRole("button", { name: "Open Search items" }).click();
    await page.waitForTimeout(300);

    const wrapper = page.getByTestId("search-wrapper");
    const expandedBox = await wrapper.boundingBox();
    // Right edge of wrapper should at least reach where the filter button was
    expect((expandedBox?.x ?? 0) + (expandedBox?.width ?? 0)).toBeGreaterThanOrEqual(idleFilterRight - 10);

    await page.screenshot({ path: "e2e/screenshots/mobile-search-width.png" });
  });
});
