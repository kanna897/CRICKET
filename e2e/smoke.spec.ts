import { expect, test } from "@playwright/test";

test("public home loads without a server error", async ({ page }) => {
  const response = await page.goto("/en");
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/CRICKPULSE/i);
  const tournamentLinks = page.getByRole("link", { name: /tournaments/i });
  expect(await tournamentLinks.count()).toBeGreaterThan(0);
  await expect(tournamentLinks.first()).toBeVisible();
});

test("admin routes are protected for signed-out visitors", async ({ page }) => {
  await page.goto("/en/admin/clubs");
  await expect(page).toHaveURL(/\/en\/login/);
  await expect(page.getByRole("heading", { name: "Admin sign in" })).toBeVisible();
});

test("public layout has no horizontal phone overflow", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile project only.");
  await page.goto("/en");
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
});
