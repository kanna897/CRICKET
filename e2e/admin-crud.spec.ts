import { expect, test } from "./fixtures";

test.describe.serial("admin creation workflows", () => {
  test("creates a tournament", async ({ adminPage, seed }) => {
    const name = `E2E UI Tournament ${seed.runId}`;
    await adminPage.goto("/en/admin/tournaments/new");
    await adminPage.getByPlaceholder("e.g. Summer Premier League 2026").fill(name);
    await adminPage.getByPlaceholder("e.g. Central Stadium").fill("Automated Stadium");
    await adminPage.locator('input[type="date"]').fill("2026-08-10");
    await adminPage.locator('input[type="number"]').fill("5");
    await adminPage.getByRole("button", { name: "Create Tournament" }).click();
    await expect(adminPage).toHaveURL(/\/en\/admin\/tournaments/);
    await expect(adminPage.getByText(name)).toBeVisible();
  });

  test("creates a team for the seeded tournament", async ({ adminPage, seed }) => {
    const name = `E2E UI Team ${seed.runId}`;
    await adminPage.goto(`/en/admin/teams/new?tournament=${seed.tournamentId}`);
    await adminPage.getByPlaceholder("e.g. Royal Challengers").fill(name);
    await adminPage.getByRole("button", { name: "Create Team" }).click();
    await expect(adminPage).toHaveURL(/\/en\/admin\/teams/);
    await expect(adminPage.getByText(name)).toBeVisible();
  });

  test("registers a player into a seeded team", async ({ adminPage, seed }) => {
    const name = `E2E UI Player ${seed.runId}`;
    await adminPage.goto(`/en/admin/players/new?team=${seed.teamIds[0]}`);
    await adminPage.getByPlaceholder("e.g. Kumar Sangakkara").fill(name);
    await adminPage.getByPlaceholder("e.g. +94771234567").fill(`+9477${Date.now().toString().slice(-7)}`);
    await adminPage.getByRole("button", { name: "Create Player" }).click();
    await expect(adminPage).toHaveURL(/\/en\/admin\/players/);
    await expect(adminPage.getByText(name)).toBeVisible();
  });
});
