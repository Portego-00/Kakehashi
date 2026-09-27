import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3101";
process.env.MIXED_REVIEW_BASE_URL = baseURL;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "mixed-review-layout.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  outputDir: "./test-results/mixed-review-layout",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node e2e/support/mixed-review-server.mjs",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
  },
});
