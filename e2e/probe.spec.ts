import { test } from "@playwright/test";

test("probe mobile DOM after search click", async ({ page }) => {
  await page.goto("http://localhost:3000");
  await page.waitForLoadState("networkidle");

  const trigger = page.getByRole("button", { name: "Open Search items" });
  await trigger.waitFor({ state: "visible" });

  const inputBefore = await page.locator('input[aria-label="Search items"]').evaluate((el: Element) => ({
    ariaHidden: el.getAttribute("aria-hidden"),
    tabindex: el.getAttribute("tabindex"),
    cls: el.className.substring(0, 100),
    parentCls: el.parentElement?.className.substring(0, 100),
    grandparentCls: el.parentElement?.parentElement?.className.substring(0, 100),
  }));
  console.log("BEFORE click:", JSON.stringify(inputBefore));
  await page.screenshot({ path: "e2e/screenshots/probe-before-click.png" });

  await trigger.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "e2e/screenshots/probe-after-click.png" });

  const inputAfter = await page.locator('input[aria-label="Search items"]').evaluate((el: Element) => ({
    ariaHidden: el.getAttribute("aria-hidden"),
    tabindex: el.getAttribute("tabindex"),
    cls: el.className.substring(0, 100),
    parentCls: el.parentElement?.className.substring(0, 100),
    grandparentCls: el.parentElement?.parentElement?.className.substring(0, 100),
    greatGrandCls: el.parentElement?.parentElement?.parentElement?.className.substring(0, 100),
  }));
  console.log("AFTER click:", JSON.stringify(inputAfter));

  const inputVisible = await page.locator('input[aria-label="Search items"]').isVisible();
  console.log("Input visible after click:", inputVisible);

  const allButtons = await page.locator("button").all();
  for (const btn of allButtons) {
    const label = await btn.getAttribute("aria-label");
    const text = await btn.textContent();
    const visible = await btn.isVisible();
    if (visible) console.log("Visible button:", JSON.stringify({ label, text: text?.trim().substring(0, 30) }));
  }
});
