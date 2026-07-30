import { expect, test } from "./fixtures";

test("admin can initialize, start, pause and publish an auction", async ({ adminPage, seed, browser }) => {
  await adminPage.goto(`/en/admin/auction?tournament=${seed.tournamentId}`);
  await expect(adminPage.getByRole("heading", { name: "Live Player Auction" })).toBeVisible();
  await expect(adminPage.getByText(`E2E Auction Player ${seed.runId}`)).toBeVisible();

  const purseInputs = adminPage.locator('section').filter({ hasText: "Auction controls" }).locator('input[type="number"]');
  for (const input of await purseInputs.all()) await input.fill("10000");
  await adminPage.getByRole("button", { name: "Save Team Purses" }).click();
  await expect(adminPage.getByRole("status")).toContainText(/saved/i);

  await adminPage.getByRole("button", { name: "Start / Resume" }).click();
  await expect(adminPage.getByRole("status")).toContainText(/live/i);

  const publicContext = await browser.newContext();
  const publicPage = await publicContext.newPage();
  await publicPage.goto(`/en/auction?tournament=${seed.tournamentId}`);
  await expect(publicPage.getByRole("heading", { name: "Live Player Auction" })).toBeVisible();
  await expect(publicPage.getByText("live", { exact: true })).toBeVisible();
  await publicContext.close();

  await adminPage.getByRole("button", { name: "Pause" }).click();
  await expect(adminPage.getByRole("status")).toContainText(/paused/i);
});
