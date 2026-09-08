import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { createExampleNotebook, EXAMPLE_NOTEBOOK_PAGE_IDS } from "../src/features/notebooks/example-notebook";
import { applyNotebookMutation, EXAMPLE_NOTEBOOK_CONTENT_VERSION, parseNotebookMutation, type NotebookMutation, type NotebookState } from "../src/features/notebooks/model";

const now = "2026-09-08T00:00:00.000Z";
const savedPageId = "loading-fixture-page";
const screenshotPath = (name: string) => fileURLToPath(new URL(`../../output/notebooks/${name}`, import.meta.url));
const user = { id: 1, object: "user", url: "", data_updated_at: now, data: { id: "notebook-loading-fixture", username: "NotebookTester", level: 12, preferences: {}, subscription: { active: true, max_level_granted: 60 } } };
// These IDs and meanings match the local WaniKani demo catalog.
const subjectCatalog = [
  { id: 1, object: "radical", characters: "一", meaning: "Ground", reading: "" },
  { id: 455, object: "kanji", characters: "山", meaning: "Mountain", reading: "さん" },
  { id: 2504, object: "vocabulary", characters: "山", meaning: "Mountain", reading: "やま" },
].map(({ id, object, characters, meaning, reading }) => ({ id, object, url: "", data_updated_at: now, data: { level: 1, created_at: now, slug: characters, document_url: "", hidden_at: null, characters, meanings: [{ meaning, primary: true, accepted_answer: true }], auxiliary_meanings: [], readings: reading ? [{ reading, primary: true, accepted_answer: true }] : [] } }));

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

function savedNotebook(): NotebookState {
  return { version: 1, examples: { version: 1, status: "removed" }, sentences: [], pages: [{ id: savedPageId, title: "My grammar notes", icon: "📓", parentId: null, favorite: false, trashedAt: null, sortOrder: 0, createdAt: now, updatedAt: now, revision: 0, content: [{ id: "saved-explanation", type: "paragraph", content: [{ type: "text", text: "My saved grammar explanation." }] }] }] };
}

async function notebookAccount(page: Page, initial: NotebookState, delays: { read?: ReturnType<typeof gate>; update?: ReturnType<typeof gate>; create?: ReturnType<typeof gate>; subjects?: ReturnType<typeof gate> } = {}) {
  let state = structuredClone(initial);
  let revision = 1;
  const mutations: NotebookMutation[] = [];
  const readStarted = gate();
  const createStarted = gate();
  const subjectsStarted = gate();
  // Every API request stays inside this isolated fixture account.
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/session/wanikani") return route.fulfill({ json: { user } });
    if (path === "/api/notebooks") {
      if (route.request().method() === "GET") {
        readStarted.release();
        await delays.read?.promise;
      } else {
        const mutation = parseNotebookMutation(route.request().postDataJSON());
        mutations.push(mutation);
        if (mutation.action === "update_page") await delays.update?.promise;
        if (mutation.action === "create_page") { createStarted.release(); await delays.create?.promise; }
        state = applyNotebookMutation(state, mutation, new Date(now)).state;
        revision++;
      }
      return route.fulfill({ json: { available: true, state, revision } });
    }
    if (path === "/api/wanikani/user") return route.fulfill({ json: user });
    if (path === "/api/wanikani/subjects") {
      subjectsStarted.release();
      await delays.subjects?.promise;
      return route.fulfill({ json: { object: "collection", url: "", data_updated_at: now, data: subjectCatalog, total_count: subjectCatalog.length, pages: { next_url: null, previous_url: null, per_page: 1000 } } });
    }
    if (path.startsWith("/api/wanikani/")) return route.fulfill({ json: { object: "collection", url: "", data_updated_at: now, data: [], total_count: 0, pages: { next_url: null, previous_url: null, per_page: 1000 } } });
    return route.fulfill({ json: { available: false, state: null, revision: -1, recorded: true } });
  });
  return { get state() { return state; }, get revision() { return revision; }, mutations, readStarted, createStarted, subjectsStarted };
}

test.use({ viewport: { width: 1280, height: 900 } });

test("a slow notebook load shows sidebar and canvas progress without false empty or missing pages", async ({ page }) => {
  const read = gate();
  const account = await notebookAccount(page, savedNotebook(), { read });
  try {
    await page.goto(`/notebooks/${savedPageId}`);
    await account.readStarted.promise;
    const sidebar = page.getByRole("complementary", { name: "Notebook pages", exact: true });
    const workspace = page.locator("[data-notebook-workspace]");
    await expect(sidebar.getByRole("status", { name: "Loading notebook pages…", exact: true })).toBeVisible();
    await expect(workspace.getByRole("status", { name: "Loading notebook…", exact: true })).toBeVisible();
    await expect(sidebar.getByRole("button", { name: "New page", exact: true })).toBeDisabled();
    await expect(page.getByText("Your pages will appear here.", { exact: true })).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Page not found", exact: true })).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Your notebook is taking a moment", exact: true })).not.toBeVisible();
    await page.screenshot({ path: screenshotPath("notebook-loading.png"), animations: "disabled" });
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(workspace.getByRole("status", { name: "Loading notebook…", exact: true })).toBeInViewport();
    await page.screenshot({ path: screenshotPath("notebook-loading-mobile.png"), animations: "disabled" });
    await page.getByRole("button", { name: "Pages", exact: true }).click();
    await expect(sidebar.getByRole("status", { name: "Loading notebook pages…", exact: true })).toBeVisible();
    await page.screenshot({ path: screenshotPath("notebook-loading-mobile-pages.png"), animations: "disabled" });
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1280, height: 900 });
    read.release();
    await expect(page.getByLabel("Page title", { exact: true })).toHaveValue("My grammar notes");
    await expect(sidebar.getByRole("button", { name: "My grammar notes", exact: true })).toBeVisible();
    await expect(page.getByLabel("Notebook page content", { exact: true })).toContainText("My saved grammar explanation.");
    await expect(workspace.getByRole("status").filter({ hasText: /^Loading notebook/ })).toHaveCount(0);
  } finally { read.release(); }
});

test("creating a notebook stays visibly busy through draft saving and creates only one page", async ({ page }) => {
  const update = gate();
  const create = gate();
  const account = await notebookAccount(page, savedNotebook(), { update, create });
  try {
    await page.goto(`/notebooks/${savedPageId}`);
    await expect(page.getByLabel("Page title", { exact: true })).toHaveValue("My grammar notes");
    await page.getByLabel("Page title", { exact: true }).fill("My revised grammar notes");
    const sidebar = page.getByRole("complementary", { name: "Notebook pages", exact: true });
    await sidebar.getByRole("button", { name: "New page", exact: true }).dblclick();
    await expect(sidebar.getByRole("button", { name: "Creating…", exact: true })).toBeDisabled();
    await expect(sidebar.getByRole("status").filter({ hasText: "Creating notebook…" })).toBeVisible();
    await expect(page.getByRole("status", { name: "Creating notebook…", exact: true })).toBeVisible();
    await expect(sidebar.getByRole("button", { name: "Add a page", exact: true })).toBeDisabled();
    expect(account.mutations.filter((mutation) => mutation.action === "create_page")).toHaveLength(0);
    update.release();
    await account.createStarted.promise;
    await expect(sidebar.getByRole("button", { name: "Creating…", exact: true })).toBeDisabled();
    await expect(page.getByRole("status", { name: "Creating notebook…", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Page not found", exact: true })).not.toBeVisible();
    await page.screenshot({ path: screenshotPath("notebook-creating.png"), animations: "disabled" });
    create.release();
    await expect(page).not.toHaveURL(new RegExp(`${savedPageId}$`));
    await expect(page.getByLabel("Page title", { exact: true })).toHaveValue("");
    await expect(sidebar.getByRole("button", { name: "New page", exact: true })).toBeEnabled();
    expect(account.mutations.filter((mutation) => mutation.action === "create_page")).toHaveLength(1);
    expect(account.state.pages).toHaveLength(2);
    expect(account.state.pages.find((saved) => saved.id === savedPageId)?.title).toBe("My revised grammar notes");
    expect(account.state.pages.find((saved) => saved.id !== savedPageId)?.icon).toBe("📓");
  } finally { update.release(); create.release(); }
});

test("older example notebooks gain the subject tour after reload without losing personal edits", async ({ page }) => {
  const legacy = createExampleNotebook(now);
  legacy.examples = { version: 1, status: "installed" };
  legacy.pages.forEach((saved) => { saved.icon = ""; });
  const context = legacy.pages.find((saved) => saved.id === EXAMPLE_NOTEBOOK_PAGE_IDS.context)!;
  const missing = new Set(["example-context-subject-types", "example-context-radical", "example-context-kanji", "example-context-subject-types-tip", "example-context-subject-filters"]);
  context.content = context.content.filter((block) => !missing.has(block.id));
  context.content.push({ id: "my-own-explanation", type: "paragraph", content: [{ type: "text", text: "An explanation I added myself." }] });
  context.revision = 4;
  legacy.pages.find((saved) => saved.id === EXAMPLE_NOTEBOOK_PAGE_IDS.playground)!.icon = "⭐";
  const account = await notebookAccount(page, legacy);
  await page.goto(`/notebooks/${context.id}`);
  const editor = page.getByLabel("Notebook page content", { exact: true });
  await expect(editor).toContainText("Radicals and kanji belong here, too");
  await expect(editor).toContainText("An explanation I added myself.");
  expect(account.state.examples?.contentVersion).toBe(EXAMPLE_NOTEBOOK_CONTENT_VERSION);
  expect(account.state.pages.find((saved) => saved.id === EXAMPLE_NOTEBOOK_PAGE_IDS.start)?.icon).toBe("🧭");
  expect(account.state.pages.find((saved) => saved.id === context.id)?.icon).toBe("🌱");
  expect(account.state.pages.find((saved) => saved.id === EXAMPLE_NOTEBOOK_PAGE_IDS.playground)?.icon).toBe("⭐");
  const revision = account.revision;
  await page.reload();
  await expect(editor).toContainText("An explanation I added myself.");
  await expect(editor.getByRole("heading", { name: "Radicals and kanji belong here, too", exact: true })).toHaveCount(1);
  expect(account.revision).toBe(revision);
  expect(account.mutations.filter((mutation) => mutation.action === "initialize_examples")).toHaveLength(1);
});

test("a slow subject catalog keeps writing available and replaces picker and mention progress with real results", async ({ page }) => {
  const subjects = gate();
  const account = await notebookAccount(page, savedNotebook(), { subjects });
  try {
    await page.goto(`/notebooks/${savedPageId}`);
    const editor = page.getByLabel("Notebook page content", { exact: true });
    await expect(editor).toBeVisible();
    await account.subjectsStarted.promise;
    await expect(editor).toHaveAttribute("contenteditable", "true");
    await editor.locator('[data-node-type="blockContainer"][data-id="saved-explanation"]').click();
    await page.keyboard.press("End");
    await page.keyboard.insertText(" Still writing while words load.");
    await expect(editor).toContainText("Still writing while words load.");
    await page.getByRole("toolbar", { name: "Notebook study tools" }).getByRole("button", { name: "Word", exact: true }).click();
    const picker = page.getByRole("dialog", { name: "Link a subject", exact: true });
    await expect(picker.getByRole("status").filter({ hasText: /^Loading subjects…$/ })).toBeVisible();
    await expect(picker.getByText("No subjects found.", { exact: true })).not.toBeVisible();
    await expect(picker.getByText("0 matches", { exact: true })).not.toBeVisible();
    await page.screenshot({ path: screenshotPath("notebook-subjects-loading.png"), animations: "disabled" });
    await picker.getByRole("button", { name: "Close", exact: true }).click();
    await editor.locator('[data-node-type="blockContainer"][data-id="saved-explanation"]').click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("@");
    await page.keyboard.insertText("山");
    await expect(page.getByRole("dialog", { name: "Subject search", exact: true }).getByRole("status").filter({ hasText: /^Loading subjects…$/ })).toBeVisible();
    subjects.release();
    const suggestions = page.locator("#bn-suggestion-menu");
    await expect(suggestions).toContainText("Mountain");
    await expect(suggestions.getByText("Loading subjects…", { exact: true })).toHaveCount(0);
    await suggestions.locator(".bn-suggestion-menu-item").filter({ hasText: "Mountain" }).first().click();
    await expect(editor.locator('[data-inline-content-type="vocabularyMention"]')).toHaveCount(1);
    await page.getByRole("toolbar", { name: "Notebook study tools" }).getByRole("button", { name: "Word", exact: true }).click();
    await expect(picker.getByRole("button", { name: "Link radical: 一, Ground", exact: true })).toBeVisible();
    await expect(picker.getByRole("button", { name: "Link kanji: 山, Mountain", exact: true })).toBeVisible();
    await expect(picker.getByRole("button", { name: "Link vocabulary: 山, Mountain", exact: true })).toBeVisible();
    const colors = await picker.locator('button[data-type] [class*="character"]').evaluateAll((items) => items.map((item) => getComputedStyle(item).backgroundColor));
    expect(colors).toHaveLength(3);
    expect(new Set(colors).size).toBe(3);
    await expect(editor).toContainText("Still writing while words load.");
    await page.screenshot({ path: screenshotPath("notebook-subjects-loaded.png"), animations: "disabled" });
  } finally { subjects.release(); }
});
