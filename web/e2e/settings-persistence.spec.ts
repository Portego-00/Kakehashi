import { expect, test, type Page } from "@playwright/test";

const key = "kakehashi-web:settings:tester:v1";
const configured = {
  textScale: 1.2,
  study: { dailyLessonLimit: 23, lessonsBatchSize: 9, autoplayAudio: false, ankiMode: "reading" },
  colors: { radical: "#123456", kanji: "#345678", vocabulary: "#567890" },
};

async function open(page: Page) {
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/session/wanikani") return route.fulfill({ json: { user: { id: 1, object: "user", data: { id: 1, username: "Tester", level: 4, preferences: {}, subscription: { active: true, type: "lifetime", max_level_granted: 60 } } } } });
    if (path === "/api/bunpro") return route.fulfill({ json: { connected: false } });
    return route.fulfill({ json: { data: [], pages: { next_url: null }, available: false, lists: [] } });
  });
  await page.goto("/settings");
}

async function seed(page: Page) {
  await page.addInitScript(({ key, configured }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(configured));
  }, { key, configured });
}

async function saved(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), key);
}

test("full browser storage rejects the change visibly and allows retry after freeing space", async ({ page }, testInfo) => {
  // Study-time tracking also writes to storage. Suppress its dev-only overlay so
  // this test can exercise the settings UI with a real browser quota failure.
  await page.addInitScript(() => {
    window.addEventListener("error", (event) => {
      if (event.error?.name === "QuotaExceededError") { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    window.addEventListener("unhandledrejection", (event) => {
      if (event.reason?.name === "QuotaExceededError") { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
  });
  await open(page);
  const sounds = page.getByRole("checkbox", { name: "Answer feedback sounds", exact: true });
  await expect(sounds).toBeChecked();
  await page.evaluate(() => {
    let chunk = "x".repeat(1024 * 1024);
    let index = 0;
    while (chunk.length) {
      try { localStorage.setItem(`settings-quota-test-${index++}`, chunk); }
      catch { chunk = chunk.slice(0, Math.floor(chunk.length / 2)); }
    }
  });
  await page.getByText("Answer feedback sounds", { exact: true }).click();
  await expect(sounds).toBeChecked();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("could not be saved");
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
  await page.getByRole("main").getByRole("alert").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("storage-full.png") });
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) if (key.startsWith("settings-quota-test-")) localStorage.removeItem(key);
  });
  await page.getByText("Answer feedback sounds", { exact: true }).click();
  await expect(sounds).not.toBeChecked();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await page.reload();
  await expect(sounds).not.toBeChecked();
});

test("legacy preferences survive editing, navigation and reopening", async ({ page, context }) => {
  await seed(page);
  await open(page);
  await page.getByText("Answer feedback sounds", { exact: true }).click();
  const expected = await saved(page);
  expect(expected).toMatchObject({ ...configured, study: { ...configured.study, answerFeedbackSoundEnabled: false } });
  await page.getByRole("button", { name: "Lessons", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Lesson batch size", exact: true })).toHaveValue("9");
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await expect(page.getByRole("radio", { name: /Extra large/ })).toHaveAttribute("aria-checked", "true");
  await page.reload();
  expect(await saved(page)).toEqual(expected);
  await page.close();
  const reopened = await context.newPage();
  await open(reopened);
  await expect(reopened.getByRole("checkbox", { name: "Answer feedback sounds", exact: true })).not.toBeChecked();
  expect(await saved(reopened)).toEqual(expected);
});

test("denied startup reads block edits and retry restores the saved preferences", async ({ page }, testInfo) => {
  await page.addInitScript(({ key, configured }) => {
    localStorage.setItem(key, JSON.stringify(configured));
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function (requested) {
      if (requested === key) throw new DOMException("Test read denial", "SecurityError");
      return original.call(this, requested);
    };
    Object.defineProperty(window, "__restoreSettingsRead", { value: () => { Storage.prototype.getItem = original; } });
  }, { key, configured });
  await open(page);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("could not be read");
  await expect(page.getByRole("checkbox", { name: "Answer feedback sounds", exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("storage-unreadable.png") });
  await page.evaluate(() => { (window as unknown as { __restoreSettingsRead: () => void }).__restoreSettingsRead(); });
  expect(await saved(page)).toEqual(configured);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.getByText("Answer feedback sounds", { exact: true }).click();
  expect(await saved(page)).toMatchObject({ ...configured, study: { ...configured.study, answerFeedbackSoundEnabled: false } });
});

test("another tab's edit is preserved by the next change in an older form", async ({ page, context }) => {
  await seed(page);
  await open(page);
  await expect(page.getByRole("checkbox", { name: "Answer feedback sounds", exact: true })).toBeChecked();
  const other = await context.newPage();
  await open(other);
  await other.getByRole("button", { name: "Lessons", exact: true }).click();
  await other.getByRole("combobox", { name: "Lesson batch size", exact: true }).selectOption("8");
  await page.getByText("Answer feedback sounds", { exact: true }).click();
  expect(await saved(page)).toMatchObject({ textScale: 1.2, study: { dailyLessonLimit: 23, lessonsBatchSize: 8, answerFeedbackSoundEnabled: false } });
  await expect(other.getByRole("combobox", { name: "Lesson batch size", exact: true })).toHaveValue("8");
  await other.getByRole("button", { name: "Reviews", exact: true }).click();
  await expect(other.getByRole("checkbox", { name: "Answer feedback sounds", exact: true })).not.toBeChecked();
});

test("corrupted stored data is preserved instead of being replaced with defaults", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "{broken-json"), key);
  await open(page);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("could not be read");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reset", exact: true })).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe("{broken-json");
});
