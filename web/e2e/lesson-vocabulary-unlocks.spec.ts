import { expect, test } from "@playwright/test";

test("saves the advanced lesson option and shows kanji counts in both picker layouts", async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore the demo" }).click();
  const pickLessons = page.getByRole("link", { name: "Pick lessons", exact: true });
  await expect(pickLessons).toBeVisible({ timeout: 30_000 });
  await pickLessons.click();
  await expect(page.getByRole("heading", { name: "Pick lessons" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/^\d+ vocab$/)).toHaveCount(0);

  await page.goto("/settings?category=lessons");
  const advanced = page.locator("details").filter({ has: page.getByText("Advanced lesson preferences", { exact: true }) });
  await advanced.locator("summary").click();
  const toggle = page.getByRole("checkbox", { name: "Vocabulary unlock counts", exact: true });
  await expect(toggle).not.toBeChecked();
  const toggleRow = page.locator('label[data-settings-search="Vocabulary unlock counts"]');
  await toggleRow.click();
  await expect(toggle).toBeChecked();
  await page.reload();
  await advanced.locator("summary").click();
  await expect(toggle).toBeChecked();
  await page.screenshot({ path: info.outputPath("advanced-lesson-setting.png"), fullPage: true });

  await page.goto("/lesson-picker");
  await page.getByLabel("Subject type").selectOption("kanji");
  const badges = page.getByText(/^\d+ vocab$/);
  const kanji = page.locator('button[aria-pressed]').filter({ has: page.locator('[class*="character"]') });
  await expect(badges).toHaveCount(5);
  expect(await badges.count()).toBe(await kanji.count());
  await expect(page.getByRole("status")).toContainText("All kanji in a word must reach Guru");
  await kanji.first().click();
  await page.screenshot({ path: info.outputPath("kanji-unlock-counts-grid.png"), fullPage: true });
  await page.getByRole("button", { name: "List view" }).click();
  await expect(badges).toHaveCount(5);
  await expect(kanji.first()).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("kanji-unlock-counts-list.png"), fullPage: true });
  await page.getByRole("button", { name: "Start 1 lesson", exact: true }).click();
  await expect(page.locator("#lesson-subject-title")).toBeVisible();

  await page.goto("/settings?category=lessons");
  await advanced.locator("summary").click();
  await toggleRow.click();
  await expect(toggle).not.toBeChecked();
  await page.goto("/lesson-picker");
  await expect(page.getByRole("heading", { name: "Pick lessons" })).toBeVisible();
  await expect(badges).toHaveCount(0);
});
