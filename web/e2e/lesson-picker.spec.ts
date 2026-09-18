import { expect, test } from "@playwright/test";

test("picks a lesson from the dashboard and keeps its header visible while scrolling", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("link", { name: "Pick lessons", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pick lessons" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Start/ })).toBeDisabled();
  const item = page.locator('button[aria-pressed="false"]').filter({ has: page.locator('[class*="character"]') }).first();
  await item.click();
  await page.screenshot({ path: `/tmp/kakehashi-lesson-picker-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Start 1 lesson", exact: true }).click();
  const title = page.locator("#lesson-subject-title");
  await expect(title).toBeVisible();
  const meaning = await title.textContent();
  const sticky = page.locator('[class*="subjectStickyHeader"]');
  await expect(sticky).toHaveAttribute("aria-hidden", "true");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(sticky).toHaveAttribute("data-visible", "true");
  await expect(sticky).toContainText(meaning!);
  await expect.poll(() => sticky.evaluate((element) => { const rect = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)); })).toBe(true);
  await page.screenshot({ path: `/tmp/kakehashi-lesson-header-${test.info().project.name}.png` });
  await page.goto("/lessons");
  await expect(page.locator("#lesson-subject-title")).toHaveText(meaning!);
  await expect(page.getByRole("list", { name: "Lessons in this batch" }).getByRole("listitem")).toHaveCount(1);
});
