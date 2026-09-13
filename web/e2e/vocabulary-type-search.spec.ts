import { expect, test, type Page, type Route } from "@playwright/test";

const now = "2026-09-07T10:00:00.000Z";
const user = { id: 1, object: "user", url: "", data_updated_at: now, data: { username: "VocabTester", level: 12, preferences: {}, subscription: { active: true, max_level_granted: 60 } } };

function subject(id: number, object: string, characters: string, meaning: string, parts: string[]) {
  return { id, object, url: "", data_updated_at: now, data: { level: 2, created_at: now, slug: characters, document_url: "", hidden_at: null, characters, meanings: [{ meaning, primary: true, accepted_answer: true }], auxiliary_meanings: [], readings: [], parts_of_speech: parts } };
}
const subjects = [
  subject(1, "kanji", "日", "Sun", []),
  subject(2, "vocabulary", "日本", "Japan", ["proper noun"]),
  subject(3, "vocabulary", "勉強", "Study", ["noun", "verbal noun", "suru verb"]),
  subject(4, "kana_vocabulary", "メモ", "Memo", ["noun", "verbal noun"]),
];

function json(route: Route, body: unknown) {
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockCatalog(page: Page) {
  await page.route("**/api/session/wanikani", (route) => json(route, { user }));
  await page.route("**/api/custom-srs", (route) => json(route, { available: false, state: null, revision: -1 }));
  await page.route("**/api/analytics/**", (route) => json(route, { recorded: true, available: true, days: [], activeDays: [] }));
  await page.route("**/api/subjects/lists", (route) => json(route, { lists: [{ id: "vocab", name: "Vocabulary practice", subjectIds: [1, 2, 3, 4], createdAt: now, updatedAt: now }] }));
  await page.route("**/api/wanikani/**", (route) => {
    const resource = new URL(route.request().url()).pathname.split("/").pop();
    if (resource === "user") return json(route, user);
    const data = resource === "subjects" ? subjects : [];
    return json(route, { object: "collection", url: "", data_updated_at: now, data, total_count: data.length, pages: { next_url: null, previous_url: null, per_page: 1000 } });
  });
}

test("filters vocabulary types without widening search and restores the URL", async ({ page }, testInfo) => {
  await mockCatalog(page);
  await page.goto("/search");
  await expect(page.getByRole("region", { name: "Search results" }).getByText("Sun", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("button", { name: "Vocab type", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Vocabulary type", exact: true });
  await expect(dialog.getByRole("textbox", { name: "Find vocabulary types" })).toBeFocused();
  await dialog.getByRole("checkbox", { name: "Proper noun" }).check();
  await dialog.getByRole("checkbox", { name: "Verbal noun" }).check();
  await page.screenshot({ path: testInfo.outputPath("vocabulary-types-open.png"), fullPage: true });
  expect(await dialog.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return box.left >= 0 && box.right <= window.innerWidth && box.top >= 0 && box.bottom <= window.innerHeight;
  })).toBe(true);
  await dialog.getByRole("button", { name: "Done" }).click();
  const results = page.getByRole("region", { name: "Search results" });
  await expect(results.getByText("Sun", { exact: true })).toHaveCount(0);
  await expect(results.getByText("Japan", { exact: true })).toBeVisible();
  await expect(results.getByText("Study", { exact: true })).toBeVisible();
  await expect(results.getByText("Memo", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/vocab=proper\+noun%2Cverbal\+noun/);
  await page.reload();
  await expect(page.getByRole("button", { name: "Vocab type, Proper noun, Verbal noun" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(results.getByText("Sun", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("filters list contents and dismisses the nested type picker without closing Add subjects", async ({ page }, testInfo) => {
  await mockCatalog(page);
  await page.goto("/lists");
  await expect(page.getByRole("heading", { name: "Vocabulary practice" })).toBeVisible();
  await page.getByRole("button", { name: "Vocab type", exact: true }).click();
  const types = page.getByRole("dialog", { name: "Vocabulary type", exact: true });
  await types.getByRole("checkbox", { name: "Proper noun" }).check();
  await types.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("link").filter({ hasText: "Japan" })).toBeVisible();
  await expect(page.getByRole("link").filter({ hasText: "Memo" })).toHaveCount(0);
  await page.getByRole("button", { name: "Add subjects", exact: true }).click();
  const add = page.getByRole("dialog", { name: "Add subjects", exact: true });
  await add.getByRole("button", { name: "Filters", exact: true }).click();
  await add.getByRole("button", { name: "Vocab type", exact: true }).click();
  const addTypes = add.getByRole("dialog", { name: "Vocabulary type", exact: true });
  await addTypes.getByRole("checkbox", { name: "Verbal noun" }).check();
  await page.screenshot({ path: testInfo.outputPath("nested-vocabulary-types-open.png"), fullPage: true });
  await page.keyboard.press("Escape");
  await expect(addTypes).not.toBeVisible();
  await expect(add).toBeVisible();
  await expect(add.getByText("Japan", { exact: true })).toHaveCount(0);
  await expect(add.getByText("Study", { exact: true })).toBeVisible();
  await expect(add.getByText("Memo", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
