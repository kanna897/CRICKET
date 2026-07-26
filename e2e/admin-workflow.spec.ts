import { expect, test } from "@playwright/test";
import { hasAdminCredentials, signInAsAdmin } from "./helpers/auth";

test.describe("authenticated admin match workflow", () => {
  test.skip(!hasAdminCredentials(), "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for authenticated E2E.");

  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test("opens clubs, match rules and a live scoring workspace without mutations", async ({ page }) => {
    await page.goto("/en/admin/clubs");
    await expect(page.getByRole("heading", { name: "Clubs & Seasons" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Create club" })).toBeVisible();

    await page.goto("/en/admin/matches/new");
    await expect(page.getByRole("group", { name: "Competitive match rules" })).toBeVisible();
    await expect(page.getByLabel("Balls per over")).toHaveValue("6");
    await expect(page.getByLabel("Wickets per innings")).toHaveValue("10");
    await expect(page.getByLabel("Last Man Stands")).not.toBeChecked();
    await expect(page.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", "/en/admin/matches");

    await page.goto("/en/admin/matches");
    const configuredMatchId = process.env.E2E_MATCH_ID;
    const scoreLink = configuredMatchId
      ? page.locator(`a[href="/en/admin/matches/score/${configuredMatchId}"]`)
      : page.locator('a[href^="/en/admin/matches/score/"]');
    test.skip(await scoreLink.count() === 0, "No existing match is available for read-only scorer verification.");

    await scoreLink.first().click();
    await expect(page.getByText("Live scoring", { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Voice tools" })).toBeVisible();
    await expect(page.getByText("Rain / interruption controls", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Advanced Analytics" })).toHaveAttribute("href", /\/en\/admin\/matches\/analytics\//);
    await expect(page.getByRole("link", { name: "Scorecard & Match Summary" })).toHaveAttribute("href", /\/en\/admin\/matches\/scorecard\//);

    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
  });
});
