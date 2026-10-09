import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", testMatch: "patreon-feedback.spec.ts", workers: 1, retries: 0, reporter: "list",
  use: { baseURL: "http://127.0.0.1:3101", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: "node e2e/support/mixed-review-server.mjs", url: "http://127.0.0.1:3101", reuseExistingServer: false, timeout: 120_000, gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 } },
});
