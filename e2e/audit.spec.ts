/**
 * Store Pricing — comprehensive Playwright audit.
 *
 * Maps to the 9 tasks in docs/USABILITY-TEST-PLAN.md.
 * Validates that each flow is reachable and key elements are visible/functional.
 * Run with: npm run test:e2e
 */

import { test, expect, Page } from "@playwright/test";

// ─── helpers ────────────────────────────────────────────────────────────────

async function goto(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
}

/** Click an item row/card that contains itemName.
 *  Desktop: DataTable renders <tr> rows. Mobile: MobileItemList renders <li> cards.
 *  Both exist in the DOM simultaneously (one hidden) — filter({ visible: true })
 *  ensures we only interact with whichever is rendered for the current viewport. */
async function clickRow(page: Page, itemName: string | RegExp) {
  await page
    .locator("tr, li")
    .filter({ has: page.getByText(itemName) })
    .filter({ visible: true })
    .first()
    .click();
}

/** Open the search bar and type a query. */
async function search(page: Page, query: string) {
  await page.getByRole("button", { name: "Open Search items" }).click();
  const input = page.locator('input[aria-label="Search items"]');
  await input.waitFor({ state: "visible" });
  await input.fill(query);
  await page.waitForTimeout(300); // debounce
}

// ─── 1. Initial load ─────────────────────────────────────────────────────────

test.describe("Initial load", () => {
  test("page renders All items with items visible", async ({ page }) => {
    await goto(page);
    // Heading
    await expect(page.getByRole("heading", { name: /All items/i })).toBeVisible();
    // Batches button (primary nav CTA)
    await expect(page.getByRole("button", { name: /^Batches$/i })).toBeVisible();
    // At least one known item visible: W7BESS = "Lay's Classic Potato Chips 18oz"
    // Both desktop table and mobile list are in DOM simultaneously (one hidden each).
    // filter({ visible: true }) picks whichever is rendered for the current viewport.
    await expect(
      page.locator("main").getByText(/Lay's Classic Potato/i).filter({ visible: true }).first()
    ).toBeVisible();
  });

  // Desktop only: verify the DataTable actually scrolls (sticky headers need a real scroll container)
  test("desktop table creates a scroll container for sticky headers", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "sticky headers are desktop-only");
    await goto(page);
    const overflows = await page.evaluate(() => {
      // The DataTable outer wrapper — h-full overflow-auto rounded-xl border
      const table = document.querySelector<HTMLElement>(
        ".overflow-auto.rounded-xl.bg-white"
      );
      if (!table) return null;
      return {
        scrollHeight: table.scrollHeight,
        clientHeight: table.clientHeight,
        overflowY: getComputedStyle(table).overflowY,
      };
    });
    expect(overflows).not.toBeNull();
    expect(overflows!.overflowY).toBe("auto");
    // The table should overflow vertically (100+ rows in mock data)
    expect(overflows!.scrollHeight).toBeGreaterThan(overflows!.clientHeight);
  });

  test("no console errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await goto(page);
    expect(errors).toHaveLength(0);
  });
});

// ─── 2 + 3. HQ Review flow ───────────────────────────────────────────────────
// Tasks 2–4 from the test plan: understand rec, accept, override

test.describe("HQ review flow", () => {
  test("HQ banner appears and opens review filter", async ({ page }) => {
    await goto(page);
    const banner = page.getByRole("button", {
      name: /HQ sent.*recommendation/i,
    });
    await expect(banner).toBeVisible();
    await banner.click();
    // Active-filter bar replaces the banner
    await expect(page.getByText(/items that need review/i)).toBeVisible();
    // Exit filter
    await page.getByRole("button", { name: /Back to all items/i }).click();
    await expect(page.getByRole("heading", { name: /All items/i })).toBeVisible();
  });

  test("opening a Needs review item shows Accept button", async ({
    page,
  }) => {
    // HQ-101 = "Triscuit Original 8.5oz" — hqReviewPending, no override → Needs review
    await goto(page);
    await page.getByRole("button", { name: /HQ sent.*recommendation/i }).click();
    await expect(page.getByText(/items that need review/i)).toBeVisible();
    // Click the HQ-101 row
    await clickRow(page, /Triscuit Original/i);
    // Drawer shows "Accept $X.XX" (formatted price) as the primary CTA
    await expect(
      page.getByRole("button", { name: /^Accept \$/ })
    ).toBeVisible();
  });

  test("accept a HQ recommendation — Accept block disappears", async ({
    page,
  }) => {
    await goto(page);
    await page.getByRole("button", { name: /HQ sent.*recommendation/i }).click();
    await clickRow(page, /Triscuit Original/i);
    await page.getByRole("button", { name: /^Accept \$/ }).first().click();
    // After accepting, the Accept $X.XX block should be gone
    await expect(
      page.getByRole("button", { name: /^Accept \$/ })
    ).not.toBeVisible();
  });

  test("no console errors in HQ review flow", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await goto(page);
    await page.getByRole("button", { name: /HQ sent.*recommendation/i }).click();
    await clickRow(page, /Triscuit Original/i);
    await expect(page.getByRole("button", { name: /^Accept \$/ })).toBeVisible();
    expect(errors).toHaveLength(0);
  });
});

// ─── Item drawer states ───────────────────────────────────────────────────────

test.describe("Item drawer states", () => {
  test("Needs review item — shows HQ accept-first block, no open input", async ({
    page,
  }) => {
    // HQ-101 = Triscuit Original — hqReviewPending, no override
    await goto(page);
    await page.getByRole("button", { name: /HQ sent.*recommendation/i }).click();
    await clickRow(page, /Triscuit Original/i);
    // Button text is "Accept $X.XX" (formatted price)
    await expect(page.getByRole("button", { name: /^Accept \$/ })).toBeVisible();
    // Should NOT have an open price input yet (conscious-edit model — ADR-0026)
    const inputs = await page
      .locator('[role="dialog"]')
      .locator('input[type="number"], input[inputmode="decimal"]')
      .count();
    expect(inputs).toBe(0);
  });

  test("Scheduled item — shows decided summary, no Accept prompt", async ({
    page,
  }) => {
    // W7BESS = "Lay's Classic Potato Chips 18oz" — has retail override in batch-3
    await goto(page);
    await clickRow(page, /Lay's Classic Potato Chips/i);
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    // No "Accept $X.XX" button — this item has a decision already
    await expect(
      page.getByRole("button", { name: /^Accept \$/ })
    ).not.toBeVisible();
    // Decided summary shows at least one "Change" button (base or retail).
    // Use .first() — multiple Change buttons may be visible in the dialog
    await expect(page.getByRole("button", { name: /^Change$/i }).first()).toBeVisible();
  });

  test("Scheduled item drawer — no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await goto(page);
    await clickRow(page, /Lay's Classic Potato Chips/i);
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    expect(errors).toHaveLength(0);
  });

  test("item drawer always shows an action CTA", async ({
    page,
  }) => {
    // Triscuit (HQ-101) has hqReviewPending → shows "Accept $X.XX" + "Keep current"
    await goto(page);
    await search(page, "Triscuit Original");
    await clickRow(page, /Triscuit Original/i);
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    // Accept $X.XX is present for any pending HQ rec item
    await expect(page.getByRole("button", { name: /^Accept \$/ })).toBeVisible();
    // "Keep current" is the rejection path
    await expect(page.getByRole("button", { name: /Keep current/i })).toBeVisible();
  });
});

// ─── 7 + 8. Batches surface ───────────────────────────────────────────────────

test.describe("Batches surface", () => {
  test("Batches button opens batch management view", async ({ page }) => {
    await goto(page);
    await page.getByRole("button", { name: /^Batches$/i }).click();
    await expect(page.getByRole("heading", { name: /Batches/i })).toBeVisible();
  });

  test("scheduled batches show seeded batch names", async ({ page }) => {
    await goto(page);
    await page.getByRole("button", { name: /^Batches$/i }).click();
    // Mock seeds 3 scheduled batches
    await expect(page.getByText(/Tuesday.*ad prep/i)).toBeVisible();
    await expect(page.getByText(/Friday endcap reset/i)).toBeVisible();
    await expect(page.getByText(/This week's promos/i)).toBeVisible();
  });

  test("Sent tab renders without crashing", async ({ page }) => {
    await goto(page);
    await page.getByRole("button", { name: /^Batches$/i }).click();
    // Click the Sent tab (ToggleGroup radio)
    await page.getByRole("radio", { name: /Sent/i }).click();
    // Either shows an empty state or sent batch rows — no crash
    await expect(page.locator("body")).not.toContainText("Something went wrong");
  });

  test("New batch modal opens with a name input", async ({ page }) => {
    await goto(page);
    await page.getByRole("button", { name: /^Batches$/i }).click();
    await page.getByRole("button", { name: /New batch/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    // Name-only modal — no date/time scheduling fields.
    await expect(
      page.locator('[role="dialog"]').getByLabel(/batch name/i)
    ).toBeVisible();
  });

  test("no console errors on batches surface", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await goto(page);
    await page.getByRole("button", { name: /^Batches$/i }).click();
    expect(errors).toHaveLength(0);
  });
});

// ─── Task 1. Search ───────────────────────────────────────────────────────────

test.describe("Search", () => {
  test("typing filters the item list", async ({ page }) => {
    await goto(page);
    await search(page, "Cheetos");
    await expect(
      page.locator("main").getByText(/Cheetos Crunchy/i).filter({ visible: true }).first()
    ).toBeVisible();
    await expect(
      page.locator("main").getByText(/Lay's Classic Potato/i).filter({ visible: true }).first()
    ).not.toBeVisible();
  });

  test("clearing search restores full list", async ({ page }) => {
    await goto(page);
    await search(page, "Cheetos");
    await expect(
      page.locator("main").getByText(/Cheetos Crunchy/i).filter({ visible: true }).first()
    ).toBeVisible();
    // Clear the input
    await page.locator('input[aria-label="Search items"]').clear();
    await page.waitForTimeout(300);
    // Multiple items should be visible again
    await expect(
      page.locator("main").getByText(/Lay's Classic Potato/i).filter({ visible: true }).first()
    ).toBeVisible();
    await expect(
      page.locator("main").getByText(/Doritos/i).filter({ visible: true }).first()
    ).toBeVisible();
  });
});

// ─── Task 9. Filters ──────────────────────────────────────────────────────────

test.describe("Filter drawer", () => {
  test("filter drawer opens when filter button is clicked", async ({ page }) => {
    await goto(page);
    await page.getByRole("button", { name: /Filters/i }).click();
    // DS Drawer opens with a dialog role
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText(/filter/i);
  });

  test("no console errors with filter drawer open", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await goto(page);
    await page.getByRole("button", { name: /Filters/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(errors).toHaveLength(0);
  });
});

// ─── Mobile layout ────────────────────────────────────────────────────────────

test.describe("Mobile layout", () => {
  test("no horizontal page overflow on mobile", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile-specific test");
    await goto(page);
    const overflow = await page.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(overflow.bodyWidth).toBeLessThanOrEqual(overflow.viewportWidth + 1);
  });

  test("item cards render on mobile (not the data table)", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "mobile-specific test");
    await goto(page);
    // Desktop table is in the DOM (hidden via CSS), not rendered visibly
    await expect(page.locator("table").first()).not.toBeVisible();
    // Known item name visible in mobile cards
    await expect(
      page.locator("main").getByText(/Lay's Classic Potato/i).filter({ visible: true }).first()
    ).toBeVisible();
  });

  test("drawer opens on mobile item tap", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile-specific test");
    await goto(page);
    await page.locator("main").getByText(/Lay's Classic Potato/i).filter({ visible: true }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

// ─── Broad console error sweep ────────────────────────────────────────────────

test("no console errors across main flows (desktop)", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop-focused sweep");
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await goto(page);

  // Open drawer for a scheduled item
  await clickRow(page, /Lay's Classic Potato Chips/i);
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  await page.getByRole("button", { name: /^Done$/i }).click();

  // Open HQ review
  await page.getByRole("button", { name: /HQ sent.*recommendation/i }).click();
  await expect(page.getByText(/items that need review/i)).toBeVisible();
  await page.getByRole("button", { name: /Back to all items/i }).click();

  // Open batches
  await page.getByRole("button", { name: /^Batches$/i }).click();
  await expect(page.getByRole("heading", { name: /Batches/i })).toBeVisible();

  expect(errors).toHaveLength(0);
});
