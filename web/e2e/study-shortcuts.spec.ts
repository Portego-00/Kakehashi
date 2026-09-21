import { expect, test } from "@playwright/test";

test("custom study keys open in a modal and save captured keys", async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem("kakehashi-web:settings:shortcut-test:v1", JSON.stringify({ study: { ankiMode: "both" } })));
  await page.route("**/api/**", (route) => {
    const user = { id: 1, object: "user", data: { username: "shortcut-test", level: 1, preferences: {}, subscription: { active: true, type: "lifetime", max_level_granted: 60 } } };
    const url = route.request().url();
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(url.includes("session/wanikani") ? { user } : url.endsWith("/user") ? user : { available: false, connected: false, data: [], pages: { next_url: null } }) });
  });
  await page.goto("/settings");
  const entry = page.getByRole("button", { name: /Custom study keys/ });
  await expect(entry).toBeVisible();
  await expect(page.getByText("Hide answer completely", { exact: true })).toHaveCount(0);
  await entry.click();
  const modal = page.getByRole("dialog", { name: "Study keys" });
  await expect(modal).toBeVisible();
  const progress = modal.getByRole("button", { name: /Change reveal.*key/ });
  await progress.click();
  await progress.press("r");
  await expect(modal.getByRole("status")).toContainText("already used");
  await progress.press("Space");
  await expect(progress).toHaveText("Space");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("kakehashi-web:settings:shortcut-test:v1")!).study.studyShortcuts.progress)).toBe(" ");
  await expect(modal.getByRole("button", { name: "Done", exact: true })).toBeInViewport();
  await expect(modal.getByRole("status")).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("study-keys.png") });
  expect(await modal.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await modal.getByRole("button", { name: "Done", exact: true }).click();
  await expect(modal).toHaveCount(0);
  await expect(entry).toBeFocused();
  await entry.click();
  await expect(modal.getByRole("button", { name: /Change reveal.*key/ })).toHaveText("Space");
});
