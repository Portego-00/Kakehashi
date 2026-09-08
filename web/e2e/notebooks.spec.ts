import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { EXAMPLE_NOTEBOOK_PAGE_IDS, EXAMPLE_NOTEBOOK_SENTENCE_ID } from "../src/features/notebooks/example-notebook";

const screenshotPath = (name: string) => fileURLToPath(new URL(`../../output/notebooks/${name}`, import.meta.url));

const DEMO_STORAGE = "kakehashi:notebooks:demo:v1";
const grammarTitle = "Giving reasons with から";
const grammarText = "Use から after a reason. Practise with connected vocabulary.";
const japanese = "日本に行きたいから、日本語を勉強します。";
const originalTranslation = "I study Japanese because I want to go to Japan.";
const revisedTranslation = "Because I want to visit Japan, I am studying Japanese.";

type StoredPage = { id: string; title: string; parentId: string | null; trashedAt: string | null; content: unknown[] };
type DemoState = { pages: StoredPage[]; sentences: { id: string; japanese: string; english: string; subjectIds: number[] }[]; examples?: { status: string } };
async function state(page: Page): Promise<DemoState> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{"state":{"pages":[],"sentences":[]}}').state, DEMO_STORAGE);
}
async function startDemo(page: Page, keepExample = false) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore the demo", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 45000 });
  await expect(page.getByRole("complementary", { name: "Demo account", exact: true })).toBeVisible({ timeout: 45000 });
  await page.goto("/notebooks");
  await expect(page.getByRole("heading", { name: "Your notebooks", exact: true })).toBeVisible();
  if (!keepExample) {
    await expect(page.getByRole("button", { name: "Delete example notebook", exact: true })).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete example notebook", exact: true }).click();
    await expect.poll(async () => (await state(page)).examples?.status).toBe("removed");
  }
}
async function createGrammarPage(page: Page) {
  await page.getByRole("button", { name: /Grammar note Patterns/ }).click();
  await expect(page.getByLabel("Page title", { exact: true })).toHaveValue("Grammar note");
  await page.getByLabel("Page title", { exact: true }).fill(grammarTitle);
  const editor = page.getByLabel("Notebook page content", { exact: true });
  await expect(editor).toBeVisible();
  await editor.locator('[data-content-type="paragraph"]').first().click();
  await page.keyboard.insertText(grammarText);
  await expect.poll(async () => JSON.stringify(await state(page))).toContain(grammarText);
  await expect(page.getByRole("status").filter({ hasText: "Saved locally" })).toBeVisible();
  return page.url();
}
async function pageOptions(page: Page, action: string) {
  await page.getByLabel("Page options", { exact: true }).click();
  await page.getByRole("button", { name: action, exact: true }).click();
}
async function openPages(page: Page) {
  if (await page.getByRole("button", { name: "Pages", exact: true }).isVisible()) await page.getByRole("button", { name: "Pages", exact: true }).click();
}

test("demo notebooks connect grammar, vocabulary, and shared sentences across word cards", async ({ page, isMobile }, testInfo) => {
  test.skip(isMobile, "The complete workflow uses the desktop editor; the next test covers 375px mobile writing.");
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1100 });
  const cloudWrites: string[] = [];
  page.on("request", (request) => { if (request.method() === "POST" && request.url().includes("/api/notebooks")) cloudWrites.push(request.url()); });
  await startDemo(page);
  const grammarUrl = await createGrammarPage(page);
  await page.reload();
  await expect(page.getByLabel("Page title", { exact: true })).toHaveValue(grammarTitle);
  const editor = page.getByLabel("Notebook page content", { exact: true });
  await expect(editor).toContainText(grammarText);

  // Insert the same study subject as a standalone block and an inline mention.
  await editor.locator('[data-content-type="paragraph"]').first().click();
  await page.getByRole("toolbar", { name: "Notebook study tools" }).getByRole("button", { name: "Word", exact: true }).click();
  let picker = page.getByRole("dialog", { name: "Link a subject", exact: true });
  await picker.getByRole("textbox", { name: "Search subjects" }).fill("日本");
  await picker.getByRole("button", { name: "Link vocabulary: 日本, Japan", exact: true }).click();
  await expect(editor.locator('[data-content-type="vocabulary"]')).toContainText("日本");
  await editor.locator('[data-content-type="paragraph"]').last().click();
  await page.getByRole("toolbar", { name: "Notebook study tools" }).getByRole("button", { name: "Word", exact: true }).click();
  picker = page.getByRole("dialog", { name: "Link a subject", exact: true });
  await picker.getByRole("textbox", { name: "Search subjects" }).fill("日本");
  await picker.getByLabel("Insert within the text").check();
  await picker.getByRole("button", { name: "Link vocabulary: 日本, Japan", exact: true }).click();
  await expect(editor.locator('[data-inline-content-type="vocabularyMention"]')).toContainText("日本");

  await page.getByRole("toolbar", { name: "Notebook study tools" }).getByRole("button", { name: "Sentence", exact: true }).click();
  const sentenceDialog = page.getByRole("dialog", { name: "Add a sentence", exact: true });
  await sentenceDialog.getByRole("tab", { name: "Write a sentence" }).click();
  await sentenceDialog.getByLabel("Japanese sentence", { exact: true }).fill(japanese);
  await sentenceDialog.getByLabel("Reading Optional").fill("にほんにいきたいから、にほんごをべんきょうします。");
  await sentenceDialog.getByLabel("Translation Optional").fill(originalTranslation);
  await sentenceDialog.getByLabel("Add to word cards", { exact: true }).fill("日本");
  await sentenceDialog.getByRole("button").filter({ hasText: /^日本Japan/ }).first().click();
  await sentenceDialog.getByRole("button", { name: "Add sentence", exact: true }).click();
  await expect(editor.locator('[data-content-type="sentence"]')).toContainText(originalTranslation);
  await expect.poll(async () => JSON.stringify((await state(page)).pages)).toContain("sentenceId");
  const created = await state(page);
  expect(created.sentences).toHaveLength(1);
  const subjectId = created.sentences[0].subjectIds[0];
  expect(subjectId).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath("notebook-desktop.png"), fullPage: true });
  await page.screenshot({ path: screenshotPath("desktop.png"), fullPage: true });
  await testInfo.attach("Desktop notebook", { path: testInfo.outputPath("notebook-desktop.png"), contentType: "image/png" });

  await page.goto(`/subjects/${subjectId}`);
  await expect(page.getByRole("link", { name: grammarTitle, exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Edit sentence: ${japanese}`, exact: true }).click();
  await expect(page.getByRole("textbox", { name: "English translation (optional)", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "English translation (optional)", exact: true }).fill(revisedTranslation);
  await page.getByRole("button", { name: "Save sentence", exact: true }).click();
  await expect.poll(async () => (await state(page)).sentences[0].english).toBe(revisedTranslation);
  await page.getByRole("link", { name: grammarTitle, exact: true }).click();
  await expect(page).toHaveURL(grammarUrl);
  await expect(page.getByLabel("Notebook page content", { exact: true })).toContainText(revisedTranslation);
  await expect(page.getByLabel("Notebook page content", { exact: true })).not.toContainText(originalTranslation);
  expect((await state(page)).sentences).toHaveLength(1);

  // A nested page can move out and back, then follows its parent through trash.
  await pageOptions(page, "Add nested page");
  await expect(page).not.toHaveURL(grammarUrl);
  await expect(page.getByLabel("Page title", { exact: true })).toHaveValue("");
  await page.getByLabel("Page title", { exact: true }).fill("Practice examples");
  await expect.poll(async () => (await state(page)).pages.some((item) => item.title === "Practice examples")).toBe(true);
  const parentId = (await state(page)).pages.find((item) => item.title === grammarTitle)!.id;
  const childId = (await state(page)).pages.find((item) => item.title === "Practice examples")!.id;
  expect((await state(page)).pages.find((item) => item.id === childId)?.parentId).toBe(parentId);
  await pageOptions(page, "Move page");
  await page.getByLabel("Move page to", { exact: true }).selectOption("");
  await expect.poll(async () => (await state(page)).pages.find((item) => item.id === childId)?.parentId).toBeNull();
  await pageOptions(page, "Move page");
  await page.getByLabel("Move page to", { exact: true }).selectOption(parentId);
  await expect.poll(async () => (await state(page)).pages.find((item) => item.id === childId)?.parentId).toBe(parentId);
  await page.goto(grammarUrl);
  await pageOptions(page, "Move to Trash");
  await expect(page).toHaveURL(/\/notebooks$/);
  await expect(page.getByRole("heading", { name: "Your notebooks", exact: true })).toBeVisible();
  await expect.poll(async () => (await state(page)).pages.every((item) => item.trashedAt !== null)).toBe(true);
  await page.getByRole("complementary", { name: "Notebook pages" }).getByRole("button", { name: /^Trash/ }).click();
  await expect(page.getByRole("heading", { name: "Trash", exact: true })).toBeVisible();
  const trashRow = page.locator('[class*="trashRow"]').filter({ hasText: grammarTitle });
  await trashRow.getByRole("button", { name: "Restore", exact: true }).click();
  await expect.poll(async () => (await state(page)).pages.every((item) => item.trashedAt === null)).toBe(true);
  await page.goto(grammarUrl);
  await expect(page.getByRole("region", { name: "Nested pages" }).getByRole("button", { name: /Practice examples/ })).toBeVisible();
  await expect(page.getByLabel("Notebook page content", { exact: true })).toContainText(revisedTranslation);
  expect(cloudWrites).toEqual([]);
});

test("notebook writing and page browsing fit a 375px viewport", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 375, height: 812 });
  await startDemo(page);
  const grammarUrl = await createGrammarPage(page);
  const editor = page.getByLabel("Notebook page content", { exact: true });
  await editor.locator('[data-content-type="paragraph"]').first().click();
  await page.getByRole("toolbar", { name: "Notebook study tools" }).getByRole("button", { name: "Word", exact: true }).click();
  const wordDialog = page.getByRole("dialog", { name: "Link a subject", exact: true });
  await wordDialog.getByRole("textbox", { name: "Search subjects" }).fill("日本");
  await wordDialog.getByRole("button", { name: "Link vocabulary: 日本, Japan", exact: true }).click();
  await expect(editor.locator('[data-content-type="vocabulary"]')).toContainText("日本");
  await page.getByRole("toolbar", { name: "Notebook study tools" }).getByRole("button", { name: "Sentence", exact: true }).click();
  const sentenceDialog = page.getByRole("dialog", { name: "Add a sentence", exact: true });
  await sentenceDialog.getByRole("tab", { name: "Write a sentence" }).click();
  await sentenceDialog.getByLabel("Japanese sentence", { exact: true }).fill(japanese);
  await sentenceDialog.getByLabel("Translation Optional").fill(originalTranslation);
  await sentenceDialog.getByLabel("Add to word cards", { exact: true }).fill("日本");
  await sentenceDialog.getByRole("button").filter({ hasText: /^日本Japan/ }).first().click();
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 812 });
    await expect.poll(() => sentenceDialog.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await sentenceDialog.getByRole("button", { name: "Add sentence", exact: true }).click();
  await expect(editor.locator('[data-content-type="sentence"]')).toContainText(japanese);
  await expect.poll(async () => JSON.stringify((await state(page)).pages)).toContain("sentenceId");
  await openPages(page);
  const sidebar = page.getByRole("complementary", { name: "Notebook pages" });
  await expect(sidebar.getByRole("textbox", { name: "Search notebook" })).toBeVisible();
  await sidebar.getByRole("textbox", { name: "Search notebook" }).fill("から");
  await sidebar.getByRole("button", { name: new RegExp(grammarTitle) }).click();
  await expect(page).toHaveURL(grammarUrl);
  await expect(page.getByLabel("Page title", { exact: true })).toHaveValue(grammarTitle);
  await page.reload();
  await expect(page.getByLabel("Notebook page content", { exact: true })).toContainText(grammarText);
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 812 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    const title = page.getByRole("textbox", { name: "Page title", exact: true });
    await expect(title).toHaveJSProperty("tagName", "TEXTAREA");
    await expect.poll(() => title.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
    await expect.poll(() => title.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    for (const type of ["vocabulary", "sentence"]) {
      const block = editor.locator(`[data-content-type="${type}"]`);
      await expect(block).toHaveCount(1);
      await expect.poll(() => block.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    }
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("textbox", { name: "Page title", exact: true }).blur();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: screenshotPath("mobile-375.png"), fullPage: true });
  await page.screenshot({ path: testInfo.outputPath("notebook-mobile-375.png"), fullPage: true });
  await testInfo.attach("375px notebook", { path: testInfo.outputPath("notebook-mobile-375.png"), contentType: "image/png" });
  await page.getByRole("button", { name: "Switch to dark theme", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: screenshotPath("mobile-375-dark.png"), fullPage: true });
});

test("an empty notebook page accepts Japanese writing and survives reload", async ({ page }) => {
  test.setTimeout(90_000);
  await startDemo(page);
  await page.getByRole("button", { name: /Empty page Start with/ }).click();
  await page.getByLabel("Page title", { exact: true }).fill("今日の練習");
  const editor = page.getByLabel("Notebook page content", { exact: true });
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.insertText("今日は日本語を勉強します。");
  await expect.poll(async () => JSON.stringify(await state(page))).toContain("今日は日本語を勉強します。");
  await page.reload();
  await expect(page.getByLabel("Page title", { exact: true })).toHaveValue("今日の練習");
  await expect(page.getByLabel("Notebook page content", { exact: true })).toContainText("今日は日本語を勉強します。");
});

test("a word card captures vocabulary into a newly created notebook page", async ({ page }) => {
  test.setTimeout(90_000);
  await startDemo(page);
  await page.goto("/subjects/2570");
  await page.getByRole("region", { name: "Notebook", exact: true }).getByRole("button", { name: "Add to notebook", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Add to notebook", exact: true });
  await dialog.getByRole("combobox", { name: "Page", exact: true }).selectOption("new");
  await dialog.getByRole("textbox", { name: "Page title", exact: true }).fill("Words for travelling");
  await dialog.getByRole("button", { name: "Add to page", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Added to notebook", exact: true });
  await expect(dialog.getByRole("status")).toContainText("Words for travelling");
  await dialog.getByRole("link", { name: "Open page", exact: true }).click();
  await expect(page.getByLabel("Page title", { exact: true })).toHaveValue("Words for travelling");
  await expect(page.getByLabel("Notebook page content", { exact: true }).locator('[data-content-type="vocabulary"]')).toContainText("日本");
  await page.reload();
  await expect(page.getByLabel("Notebook page content", { exact: true }).locator('[data-content-type="vocabulary"]')).toContainText("日本");
});

test("the example notebook demonstrates connected features and stays deleted", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await startDemo(page, true);
  await expect(page.getByRole("button", { name: "Open example notebook", exact: true })).toBeVisible();
  await expect.poll(async () => (await state(page)).examples?.status).toBe("installed");
  expect((await state(page)).pages).toHaveLength(3);
  await page.screenshot({ path: screenshotPath("example-overview.png"), fullPage: true });
  await page.getByRole("button", { name: "Open example notebook", exact: true }).click();
  await expect(page.getByLabel("Page title", { exact: true })).toHaveValue("Start here");
  await expect(page.getByLabel("Change page icon", { exact: true })).toHaveCount(0);
  const editor = page.getByLabel("Notebook page content", { exact: true });
  await expect(editor).toContainText("Take a two-minute tour");
  await page.screenshot({ path: screenshotPath("example-start-here.png"), fullPage: true });
  await editor.locator('[data-content-type="pageLink"]').filter({ hasText: "Japanese in context" }).getByRole("button").click();
  await expect(page.getByLabel("Page title", { exact: true })).toHaveValue("Japanese in context");
  for (const [kind, id] of [["radical", 1], ["kanji", 455], ["vocabulary", 2504]] as const) {
    await expect(editor.locator(`[data-content-type="vocabulary"] a[data-kind="${kind}"]`)).toHaveAttribute("href", `/subjects/${id}`);
    await expect(editor.locator(`[data-inline-content-type="vocabularyMention"] a[data-kind="${kind}"]`).first()).toHaveAttribute("href", `/subjects/${id}`);
  }
  await expect(editor.locator('[data-content-type="sentence"]')).toContainText("山が見えます。");
  await page.screenshot({ path: screenshotPath("example-context.png"), fullPage: true });
  await editor.getByRole("button", { name: "Edit linked sentence", exact: true }).click();
  const sentenceDialog = page.getByRole("dialog", { name: "Edit linked sentence", exact: true });
  await sentenceDialog.getByLabel("Translation Optional").fill("A mountain is visible from here.");
  await sentenceDialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(sentenceDialog).not.toBeVisible();
  await editor.locator('[data-content-type="pageLink"]').filter({ hasText: "Writing playground" }).getByRole("button").click();
  await expect(page.getByLabel("Page title", { exact: true })).toHaveValue("Writing playground");
  await expect(editor.locator('[data-content-type="sentence"]')).toContainText("A mountain is visible from here.");
  for (const type of ["table", "codeBlock", "divider", "checkListItem", "toggleListItem"]) {
    await expect(editor.locator(`[data-content-type="${type}"]`).first()).toBeVisible();
  }
  await page.screenshot({ path: screenshotPath("example-playground.png"), fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/notebooks/${EXAMPLE_NOTEBOOK_PAGE_IDS.context}`);
  await expect(page.getByLabel("Page title", { exact: true })).toHaveValue("Japanese in context");
  await expect(editor.locator('[data-content-type="sentence"]')).toContainText("山が見えます。");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: screenshotPath("example-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Switch to dark theme", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: screenshotPath("example-mobile-dark.png"), fullPage: true });

  // A personal nested page is kept when the original tour is removed.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/notebooks/${EXAMPLE_NOTEBOOK_PAGE_IDS.start}`);
  await expect(page.getByLabel("Page title", { exact: true })).toHaveValue("Start here");
  await pageOptions(page, "Add nested page");
  await expect(page).not.toHaveURL(new RegExp(`${EXAMPLE_NOTEBOOK_PAGE_IDS.start}$`));
  await expect(page.getByLabel("Page title", { exact: true })).toHaveValue("");
  await page.getByLabel("Page title", { exact: true }).fill("My own study notes");
  await expect.poll(async () => (await state(page)).pages.some((entry) => entry.title === "My own study notes")).toBe(true);
  const personalId = (await state(page)).pages.find((entry) => entry.title === "My own study notes")!.id;
  await page.goto(`/notebooks/${EXAMPLE_NOTEBOOK_PAGE_IDS.start}`);
  await expect(page.getByRole("button", { name: "Delete example notebook", exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Delete example notebook", exact: true }).click();
  expect((await state(page)).pages).toHaveLength(4);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete example notebook", exact: true }).click();
  await expect(page).toHaveURL(/\/notebooks$/);
  await expect.poll(async () => (await state(page)).examples?.status).toBe("removed");
  const removed = await state(page);
  expect(removed.pages.map((entry) => entry.id)).toEqual([personalId]);
  expect(removed.pages[0].parentId).toBeNull();
  // An example sentence the learner edited is their own work and is retained.
  expect(removed.sentences.find((entry) => entry.id === EXAMPLE_NOTEBOOK_SENTENCE_ID)?.english).toBe("A mountain is visible from here.");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your notebooks", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open example notebook", exact: true })).toHaveCount(0);
  expect((await state(page)).pages.map((entry) => entry.id)).toEqual([personalId]);
});
