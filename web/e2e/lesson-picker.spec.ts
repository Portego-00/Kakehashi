import { expect, test } from "@playwright/test";

test("picks a lesson from the dashboard and keeps its header visible while scrolling", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("link", { name: "Pick lessons", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pick lessons" })).toBeVisible();
  await expect(page.locator("[data-app-header]")).toBeHidden();
  await expect(page.getByRole("button", { name: /^Start/ })).toBeDisabled();
  const item = page.locator('button[aria-pressed="false"]').filter({ has: page.locator('[class*="character"]') }).first();
  await item.click();
  await page.screenshot({ path: `/tmp/kakehashi-lesson-picker-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Start 1 lesson", exact: true }).click();
  const title = page.locator("#lesson-subject-title");
  await expect(title).toBeVisible();
  await expect(page.locator("[data-app-header]")).toBeHidden();
  const meaning = await title.textContent();
  await page.evaluate(() => window.scrollTo(0, 0));
  const sticky = page.locator('[class*="subjectStickyHeader"]');
  await expect(sticky).toHaveAttribute("aria-hidden", "true");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(sticky).toHaveAttribute("data-visible", "true");
  await expect(sticky).toContainText(meaning!);
  await expect.poll(() => sticky.evaluate((element) => element.getBoundingClientRect().top)).toBe(0);
  await expect.poll(() => sticky.evaluate((element) => { const rect = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)); })).toBe(true);
  await page.screenshot({ path: `/tmp/kakehashi-lesson-header-${test.info().project.name}.png` });
  await page.goto("/lessons");
  await expect(page.locator("#lesson-subject-title")).toHaveText(meaning!);
  await expect(page.locator("[data-app-header]")).toBeHidden();
  await expect(page.getByRole("list", { name: "Lessons in this batch" }).getByRole("listitem")).toHaveCount(1);
  await page.getByRole("link", { name: "Leave", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator("[data-app-header]")).toBeVisible();
});

test("picked lessons follow the batch size and keep the remaining selection", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.evaluate(() => localStorage.setItem("kakehashi-web:settings:demo-level-21:v1", JSON.stringify({ study: { lessonsBatchSize: 3, ankiMode: "both", ankiGroupQuestions: true, pauseOnCorrect: false, autoplayAudio: false, answerFeedbackSoundEnabled: false } })));
  await page.goto("/lesson-picker");
  await page.getByLabel("Subject type").selectOption("kanji");
  await page.getByRole("button", { name: "Select all", exact: true }).click();
  await page.getByRole("button", { name: "Start 5 lessons", exact: true }).click();
  const batch = page.getByRole("list", { name: "Lessons in this batch" }).getByRole("listitem");
  await expect(batch).toHaveCount(3);
  const firstBatch = await batch.allTextContents();
  await batch.last().getByRole("button").click();
  await page.getByRole("button", { name: "Start lesson review", exact: true }).click();
  for (let index = 0; index < 3; index++) {
    await page.getByRole("button", { name: "Reveal answer", exact: true }).click();
    await page.getByRole("button", { name: "Correct", exact: true }).click();
    await expect(page.getByRole("button", { name: "Correct", exact: true })).toBeHidden();
  }
  await expect(page.getByRole("heading", { name: "Batch Complete!" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Items learned" }).getByRole("listitem")).toHaveCount(3);
  await expect(page.getByRole("region", { name: "Upcoming batches" }).getByRole("listitem")).toHaveCount(2);
  await page.screenshot({ path: `/tmp/kakehashi-batch-complete-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Next batch", exact: true }).click();
  await expect(batch).toHaveCount(2);
  const nextBatch = await batch.allTextContents();
  expect(nextBatch.every((item) => !firstBatch.includes(item))).toBe(true);
  await page.reload();
  await expect(batch).toHaveCount(2);
  expect(await batch.allTextContents()).toEqual(nextBatch);
  await batch.last().getByRole("button").click();
  await page.getByRole("button", { name: "Start lesson review", exact: true }).click();
  for (let index = 0; index < 2; index++) {
    await page.getByRole("button", { name: "Reveal answer", exact: true }).click();
    await page.getByRole("button", { name: "Correct", exact: true }).click();
    await expect(page.getByRole("button", { name: "Correct", exact: true })).toBeHidden();
  }
  await expect(page.getByRole("heading", { name: "Lessons Complete!" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Items learned" }).getByRole("listitem")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Upcoming batches" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Finish", exact: true })).toHaveAttribute("href", "/dashboard");

});

test("revalidates an old oversized saved batch and lets the learner start over", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/lesson-picker");
  const items = page.locator('button[aria-pressed="false"]').filter({ has: page.locator('[class*="character"]') });
  for (let index = 0; index < 12; index++) await items.first().click();
  await page.getByRole("button", { name: "Start 12 lessons", exact: true }).click();
  await expect(page.locator("#lesson-subject-title")).toBeVisible();
  await page.evaluate(() => {
    const selection = JSON.parse(localStorage.getItem("kakehashi:core-study:demo-level-21:picked-lessons")!);
    localStorage.setItem("kakehashi:core-study:demo-level-21:lesson-teaching", JSON.stringify({ subjectIds: selection.subjectIds, savedAt: new Date().toISOString(), index: 0, tab: "context" }));
    localStorage.setItem("kakehashi-web:settings:demo-level-21:v1", JSON.stringify({ study: { lessonsBatchSize: 5 } }));
  });
  await page.reload();
  const batch = page.getByRole("list", { name: "Lessons in this batch" }).getByRole("listitem");
  await expect(batch).toHaveCount(5);
  await page.getByRole("button", { name: "Start over", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pick lessons" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Start/ })).toBeDisabled();
  expect(await page.evaluate(() => [localStorage.getItem("kakehashi:core-study:demo-level-21:lesson-teaching"), localStorage.getItem("kakehashi:core-study:demo-level-21:picked-lessons"), localStorage.getItem("kakehashi-core-session:demo-level-21:lessons")])).toEqual([null, null, null]);
  await items.first().click();
  await page.getByRole("button", { name: "Start 1 lesson", exact: true }).click();
  await page.getByRole("button", { name: "Start lesson review", exact: true }).click();
  await page.getByRole("button", { name: "Start over", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pick lessons" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("kakehashi-core-session:demo-level-21:lessons"))).toBeNull();
});
