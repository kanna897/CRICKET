import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

async function selectInningsPlayers(page: Page, striker: string, nonStriker: string, bowler: string, action: "Start scoring" | "Start chase") {
  await page.getByLabel("Striker").selectOption(striker);
  await page.getByLabel("Non-striker").selectOption(nonStriker);
  await page.getByLabel("First / current bowler").selectOption(bowler);
  await page.getByRole("button", { name: action }).click();
}

async function scoreRun(page: Page, runs: number) {
  await page.getByRole("button", { name: String(runs), exact: true }).filter({ visible: true }).first().click();
  await page.getByRole("button", { name: "Straight", exact: true }).click();
  await expect(page.getByText("Saving ball…")).toHaveCount(0);
}

test("live match, scoring, undo, innings completion, match completion and public live score", async ({ adminPage, seed, browser }) => {
  await adminPage.goto(`/en/admin/matches/score/${seed.matchId}`);
  await expect(adminPage.getByText("Live scoring", { exact: true })).toBeVisible();

  await test.step("start live match", async () => {
    await adminPage.getByRole("button", { name: "Toss", exact: true }).click();
    await adminPage.getByLabel("Toss winner").selectOption(seed.teamIds[0]);
    await adminPage.getByLabel("Decision").selectOption("bat");
    await adminPage.getByRole("button", { name: "Save toss" }).click();
    await adminPage.getByRole("button", { name: "Setup" }).click();
    await selectInningsPlayers(adminPage, seed.playerIds[0], seed.playerIds[1], seed.playerIds[2], "Start scoring");
    await expect(adminPage.getByText("0/0", { exact: true })).toBeVisible();
  });

  await test.step("record and undo a ball", async () => {
    await scoreRun(adminPage, 1);
    await expect(adminPage.getByText("1/0", { exact: true })).toBeVisible();
    adminPage.once("dialog", (dialog) => dialog.accept());
    await adminPage.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(adminPage.getByText("0/0", { exact: true })).toBeVisible();
  });

  await test.step("public live score mirrors scorer state", async () => {
    await scoreRun(adminPage, 1);
    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    await publicPage.goto(`/en/match/${seed.matchId}`);
    await expect(publicPage.getByText("1/0", { exact: true })).toBeVisible();
    await publicContext.close();
  });

  await test.step("finish first innings at the configured over limit", async () => {
    for (let ball = 1; ball < 6; ball += 1) await scoreRun(adminPage, 1);
    await expect(adminPage.getByRole("heading", { name: "Second innings setup" })).toBeVisible();
    await selectInningsPlayers(adminPage, seed.playerIds[2], seed.playerIds[3], seed.playerIds[0], "Start chase");
    await expect(adminPage.getByText("TARGET", { exact: true })).toBeVisible();
  });

  await test.step("finish match by completing the chase", async () => {
    await scoreRun(adminPage, 6);
    await scoreRun(adminPage, 1);
    await expect(adminPage.getByText("Match completed", { exact: true })).toBeVisible();
    await expect(adminPage.getByText(/WIN!|Match tied/)).toBeVisible();
  });
});
