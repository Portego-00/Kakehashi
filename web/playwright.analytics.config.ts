import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "analytics*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { outputFolder: "playwright-report-analytics", open: "never" }]],
  outputDir: "test-results-analytics",
  use: { baseURL: "http://localhost:3210", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: "npm run dev -- --port 3210", url: "http://localhost:3210", reuseExistingServer: true, timeout: 120_000 },
});
