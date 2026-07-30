import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    channel: "msedge",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-edge", testIgnore: /mobile\.spec\.ts/, use: { ...devices["Desktop Edge"] } },
    { name: "mobile-edge", testMatch: /(?:smoke|mobile)\.spec\.ts/, use: { ...devices["Pixel 7"], channel: "msedge" } },
  ],
});
