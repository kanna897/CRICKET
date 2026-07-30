import { expect, test } from "./fixtures";

test("admin login opens the administration dashboard", async ({ adminPage }) => {
  await expect(adminPage.getByText("Master Admin", { exact: true })).toBeVisible();
  await expect(adminPage.getByRole("link", { name: "Organizers" })).toBeVisible();
});

test("organizer can access owned tournament operations without master-admin navigation", async ({ organizerPage, seed }) => {
  await organizerPage.goto(`/en/admin/tournaments/${seed.tournamentId}`);
  await expect(organizerPage.getByText(`E2E Premier ${seed.runId}`)).toBeVisible();
  await expect(organizerPage.getByRole("link", { name: "Organizers" })).toHaveCount(0);
});

test("scorer role is denied general administration access", async ({ scorerPage }) => {
  await expect(scorerPage).toHaveURL(/\/en\/login\?error=unauthorized/);
  await expect(scorerPage.getByRole("alert")).toContainText("administrator role");
});

test("signed-out visitors cannot access any admin route", async ({ page }) => {
  await page.goto("/en/admin/matches");
  await expect(page).toHaveURL(/\/en\/login/);
  await expect(page.getByRole("heading", { name: "Admin sign in" })).toBeVisible();
});
