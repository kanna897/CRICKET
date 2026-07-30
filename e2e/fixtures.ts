import { expect, test as base, type Page } from "@playwright/test";
import { fullE2EEnabled, requiredEnv } from "./support/env";
import { readState, type E2EState } from "./support/state";

export type TestRole = "admin" | "organizer" | "scorer";

const credentials = {
  admin: ["E2E_ADMIN_EMAIL", "E2E_ADMIN_PASSWORD"],
  organizer: ["E2E_ORGANIZER_EMAIL", "E2E_ORGANIZER_PASSWORD"],
  scorer: ["E2E_SCORER_EMAIL", "E2E_SCORER_PASSWORD"],
} as const;

export async function signIn(page: Page, role: TestRole) {
  const [emailKey, passwordKey] = credentials[role];
  await page.goto("/en/login");
  await page.getByLabel("Email address").fill(requiredEnv(emailKey));
  await page.getByLabel("Password").fill(requiredEnv(passwordKey));
  await page.getByRole("button", { name: "Sign in" }).click();
}

type Fixtures = {
  seed: E2EState;
  adminPage: Page;
  organizerPage: Page;
  scorerPage: Page;
};

export const test = base.extend<Fixtures>({
  seed: async ({}, fixtureUse) => {
    base.skip(!fullE2EEnabled(), "Set E2E_RUN_FULL=true and the dedicated E2E Supabase credentials.");
    await fixtureUse(readState());
  },
  adminPage: async ({ page, seed }, fixtureUse) => {
    void seed;
    await signIn(page, "admin");
    await expect(page).toHaveURL(/\/en\/admin\/?$/);
    await fixtureUse(page);
  },
  organizerPage: async ({ browser, seed }, fixtureUse) => {
    void seed;
    const context = await browser.newContext();
    const page = await context.newPage();
    await signIn(page, "organizer");
    await expect(page).toHaveURL(/\/en\/admin\/?$/);
    await fixtureUse(page);
    await context.close();
  },
  scorerPage: async ({ browser, seed }, fixtureUse) => {
    void seed;
    const context = await browser.newContext();
    const page = await context.newPage();
    await signIn(page, "scorer");
    await fixtureUse(page);
    await context.close();
  },
});

export { expect };
