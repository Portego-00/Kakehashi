import { expect, test, type Page, type Route } from "@playwright/test";
import { resolve } from "node:path";

const now = "2026-08-06T20:00:00.000Z";
const user = { id: 1, object: "user", url: "", data_updated_at: now, data: { username: "WebTester", level: 2, profile_url: "", started_at: now, current_vacation_started_at: null, preferences: { default_voice_actor_id: 1, lessons_autoplay_audio: true, lessons_batch_size: 5, lessons_presentation_order: "ascending_level_then_subject", reviews_autoplay_audio: true, reviews_display_srs_indicator: true }, subscription: { active: true, type: "lifetime", max_level_granted: 60, period_ends_at: null } } };
type MockUser = Omit<typeof user, "data"> & { data: Omit<typeof user.data, "current_vacation_started_at"> & { current_vacation_started_at: string | null } };

function subject(id: number, object: "radical" | "kanji" | "vocabulary", characters: string, meaning: string, reading?: string) {
  return { id, object, url: "", data_updated_at: now, data: { level: id === 1 ? 1 : 2, lesson_position: id, spaced_repetition_system_id: 1, created_at: now, slug: characters, document_url: `https://www.wanikani.com/subject/${id}`, hidden_at: null, characters, meanings: [{ meaning, primary: true, accepted_answer: true }], auxiliary_meanings: [], meaning_mnemonic: `${meaning} mnemonic.`, readings: reading ? [{ reading, primary: true, accepted_answer: true, type: "onyomi" }] : undefined, reading_mnemonic: reading ? `${reading} mnemonic.` : undefined, component_subject_ids: object === "kanji" ? [1] : [], amalgamation_subject_ids: object === "kanji" ? [3] : [], visually_similar_subject_ids: id === 2 ? [4] : id === 4 ? [2] : [], context_sentences: object === "vocabulary" ? [{ ja: `${characters}を見ます。`, en: `I see ${meaning}.` }] : [], parts_of_speech: object === "vocabulary" ? ["noun"] : [] } };
}

const subjects = [
  subject(1, "radical", "一", "Ground"),
  subject(2, "kanji", "一", "One", "いち"),
  subject(3, "vocabulary", "一つ", "One Thing", "ひとつ"),
  subject(4, "kanji", "二", "Two", "に"),
  subject(5, "vocabulary", "二人", "Two People", "ふたり"),
];

const assignments = subjects.map((item, index) => ({ id: 100 + item.id, object: "assignment", url: "", data_updated_at: now, data: { subject_id: item.id, subject_type: item.object, srs_stage: index < 2 ? 2 : 5, available_at: index === 0 ? "2020-01-01T00:00:00.000Z" : "2030-01-01T00:00:00.000Z", started_at: "2026-08-01T00:00:00.000Z", unlocked_at: "2026-07-01T00:00:00.000Z", passed_at: index > 1 ? "2026-08-03T00:00:00.000Z" : null, burned_at: null, resurrected_at: null, hidden: false, created_at: now } }));
const statistics = subjects.map((item) => ({ id: 200 + item.id, object: "review_statistic", url: "", data_updated_at: now, data: { subject_id: item.id, subject_type: item.object, meaning_correct: 8, meaning_incorrect: 1, meaning_max_streak: 7, meaning_current_streak: 3, reading_correct: item.object === "radical" ? 0 : 7, reading_incorrect: item.object === "radical" ? 0 : 1, reading_max_streak: 5, reading_current_streak: 2, percentage_correct: 88, hidden: false, created_at: now } }));

function collection(data: unknown[]) {
  return { object: "collection", url: "", pages: { next_url: null, previous_url: null, per_page: 1000 }, total_count: data.length, data_updated_at: now, data };
}

function progression() {
  return { id: 1, object: "level_progression", url: "", data_updated_at: now, data: { level: 1, unlocked_at: "2026-07-01T00:00:00.000Z", started_at: "2026-07-01T00:00:00.000Z", passed_at: "2026-07-08T00:00:00.000Z", completed_at: "2026-07-10T00:00:00.000Z", abandoned_at: null } };
}

async function fulfillJson(route: Route, json: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(json) });
}

async function mockApp(page: Page, initiallyAuthenticated = true, mockedUser: MockUser = user) {
  let authenticated = initiallyAuthenticated;
  const communityItems = [{ id: "issue-1", user_id: "user-1", user_username: "WebTester", user_level: 2, title: "Native parity issue", content: "The web community now shares the native issue board.", status: "open", labels: [], created_at: now, updated_at: now, likes_count: 2, reply_count: 0, is_liked: false }];
  await page.route("**/api/session/wanikani", async (route) => {
    const method = route.request().method();
    if (method === "POST") { authenticated = true; return fulfillJson(route, { user: mockedUser }); }
    if (method === "DELETE") { authenticated = false; return fulfillJson(route, { ok: true }); }
    return authenticated ? fulfillJson(route, { user: mockedUser }) : fulfillJson(route, { error: "No active session." }, 401);
  });
  await page.route("**/api/wanikani/**", async (route) => {
    const url = new URL(route.request().url());
    const resource = decodeURIComponent(url.pathname.replace(/^\/api\/wanikani\//, ""));
    if (resource === "user") return fulfillJson(route, mockedUser);
    if (resource.startsWith("subjects/")) return fulfillJson(route, subjects.find((item) => item.id === Number(resource.split("/")[1])) ?? subjects[0]);
    if (resource === "subjects") return fulfillJson(route, collection(subjects));
    if (resource === "assignments") return fulfillJson(route, collection(assignments));
    if (resource === "review_statistics") return fulfillJson(route, collection(statistics));
    if (resource === "level_progressions") return fulfillJson(route, collection([progression()]));
    if (resource === "resets" || resource === "study_materials") return fulfillJson(route, collection([]));
    if (resource === "summary") return fulfillJson(route, { object: "report", url: "", data_updated_at: now, data: { lessons: [], reviews: [{ available_at: "2026-08-06T21:00:00.000Z", subject_ids: [1, 2] }], next_reviews_at: "2026-08-06T21:00:00.000Z" } });
    return fulfillJson(route, collection([]));
  });
  await page.route("**/news/feed", (route) => fulfillJson(route, { articles: [{ id: "sample", title: "やさしいニュース", summary: "日本語のニュースです。", body: "日本語を勉強します。", publishedAt: now, url: "https://www3.nhk.or.jp/news/easy/sample/", imageUrl: "https://nhkeasier.com/media/sample.png", content: [{ type: "image", url: "/media/sample.png", alt: "News illustration" }, { type: "text", text: "日本語を勉強します。" }] }], updatedAt: now, source: "live" }));
  await page.route("**/news/image?**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") }));
  await page.route("**/community/api**", async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const action = requestUrl.searchParams.get("action");
    if (request.method() === "GET") {
      if (action === "issue") {
        const item = communityItems.find((issue) => issue.id === requestUrl.searchParams.get("id")) ?? communityItems[0];
        return fulfillJson(route, { configured: true, writable: true, canManage: true, issue: item, comments: [], commentsHasMore: false });
      }
      if (action === "supporters") return fulfillJson(route, { configured: true, writable: true, items: [], hasMore: false });
      return fulfillJson(route, { configured: true, writable: true, items: communityItems, counts: { open: communityItems.filter((item) => item.status === "open").length, closed: communityItems.filter((item) => item.status === "closed").length }, hasMore: false });
    }
    const body = request.postDataJSON() as { action?: string; title?: string; content?: string };
    if (body.action === "createIssue") {
      const item = { ...communityItems[0], id: "issue-created", title: body.title || "Untitled", content: body.content || "", likes_count: 0 };
      communityItems.unshift(item);
      return fulfillJson(route, { item });
    }
    if (body.action === "toggleIssueLike" || body.action === "toggleCommentLike") return fulfillJson(route, { liked: true, likes_count: 3 });
    return fulfillJson(route, { ok: true });
  });
}

test("signs in without storing the token in browser storage", async ({ page }) => {
  await mockApp(page, false);
  await page.goto("/login");
  await page.getByRole("textbox", { name: /API token/ }).fill("wk_test_token_12345678901234567890");
  await page.getByRole("button", { name: "Open Kakehashi" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /WebTester/ })).toBeVisible();
  expect(await page.evaluate(() => Object.values(localStorage).some((value) => value.includes("wk_test_token")))).toBe(false);
});

test("loads every supported study mode and principal feature route", async ({ page }) => {
  await mockApp(page);
  const studyModes = ["recent-lessons", "random-test", "vocab-reading", "hiragana-meaning", "similar-kanji", "kana-to-kanji", "listening", "context-sentences", "text-analysis", "kanji-writing", "crossword", "kana-wordle", "custom-review", "custom-lessons", "subject-lists"];
  const routes = ["/dashboard", "/lessons", "/reviews", "/study", ...studyModes.map((mode) => `/study/${mode}`), "/progress", "/progress/kanji", "/progress/wrapped/1", "/analytics", "/items", "/search", "/lists", "/subjects", "/subjects/2", "/subjects/2/constellation", "/settings", "/news", "/reader", "/epubs", "/manga", "/video", "/music", "/translator", "/community", "/community/new", "/feedback", "/feature-request", "/supporters"];
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  for (const path of routes) {
    const response = await page.goto(path);
    expect(response?.status(), `${path} returned an error`).toBeLessThan(400);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/404|page not found/i);
  }
  expect(consoleErrors.filter((message) => !message.includes("favicon"))).toEqual([]);
});

test("has no serious accessibility violations on representative workspaces", async ({ page }) => {
  await mockApp(page);
  for (const path of ["/dashboard", "/study/random-test", "/progress", "/items", "/news", "/community", "/settings"]) {
    await page.goto(path);
    await page.addScriptTag({ path: resolve("node_modules/axe-core/axe.min.js") });
    const violations = await page.evaluate(async () => {
      const axe = (window as typeof window & { axe: { run: (root: Document, options: unknown) => Promise<{ violations: Array<{ id: string; impact: string | null; nodes: Array<{ target: string[]; failureSummary?: string }> }> }> } }).axe;
      const result = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } });
      return result.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical").map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.map((node) => ({ target: node.target, failureSummary: node.failureSummary })) }));
    });
    expect(violations, `${path} has serious accessibility violations`).toEqual([]);
  }
});

test("applies live navigation preferences and preserves core study access", async ({ page }, testInfo) => {
  await mockApp(page);
  await page.goto("/settings");
  const analyticsToggle = page.getByRole("checkbox", { name: /Show analytics/i });
  await analyticsToggle.press("Space");
  const moreButton = testInfo.project.name.includes("mobile") ? page.getByRole("button", { name: "More", exact: true }) : page.getByRole("button", { name: "More destinations" });
  await moreButton.click();
  const destinations = page.getByRole("navigation", { name: "All destinations" });
  await expect(destinations.getByRole("link", { name: "Analytics" })).toHaveCount(0);
  await expect(destinations.getByRole("link", { name: "Reviews" })).toBeVisible();
  await page.getByRole("button", { name: "Close More menu" }).first().click({ position: { x: 4, y: 4 } });
  await expect(moreButton).toBeFocused();
  await analyticsToggle.press("Space");
});

test("contains focus in More and lets the top backdrop close it", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile-project assertion");
  await mockApp(page);
  await page.goto("/settings");

  const moreButton = page.getByRole("button", { name: "More", exact: true });
  await moreButton.click();

  const dialog = page.getByRole("dialog", { name: "All Destinations" });
  const closeButton = dialog.getByRole("button", { name: "Close More menu" });
  const backdrop = page.getByRole("button", { name: "Close More menu" }).first();
  const focusable = dialog.locator('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');

  await expect(dialog).toBeVisible();
  await expect(closeButton).toBeFocused();
  await expect(backdrop).toHaveAttribute("tabindex", "-1");

  await page.keyboard.press("Shift+Tab");
  await expect(focusable.last()).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(closeButton).toBeFocused();

  await backdrop.click({ position: { x: 4, y: 4 } });
  await expect(dialog).toBeHidden();
  await expect(moreButton).toBeFocused();
});

test("keeps key workspaces inside a narrow mobile viewport", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile-project assertion");
  await mockApp(page);
  const routes = ["/dashboard", "/reviews", "/study", "/study/random-test", "/study/crossword", "/progress", "/subjects/2/constellation", "/reader", "/news", "/community", "/settings"];
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of routes) {
      await page.goto(path);
      if (path === "/reviews") {
        await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeHidden();
        await expect(page.getByRole("link", { name: "Pause" }).or(page.getByRole("button", { name: "Continue Session" })).first()).toBeVisible();
      } else {
        await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path} overflows at ${width}px`).toBe(true);
    }
  }
});

test("applies advanced study and reading preferences to their workflows", async ({ page }) => {
  await mockApp(page);
  await page.goto("/settings");
  await page.getByLabel("Self-assessment cards").selectOption("both");
  await page.getByLabel("EPUB daily goal").selectOption("20");
  await page.getByLabel("Anime listening sources").fill("death_note, your_name");

  await page.goto("/reviews");
  await expect(page.getByRole("button", { name: "Reveal Answer" })).toBeVisible();
  await page.getByRole("button", { name: "Reveal Answer" }).click();
  await expect(page.getByText("Expected meaning")).toBeVisible();
  await expect(page.getByRole("button", { name: /Got it/ })).toBeVisible();

  await page.goto("/epubs");
  await expect(page.getByText("20 minute daily goal")).toBeVisible();

  await page.goto("/study/listening");
  await expect(page.getByRole("textbox", { name: /Anime sources/i })).toHaveValue("death_note, your_name");
});

test("honors Vacation Mode across the dashboard and direct study routes", async ({ page }) => {
  const vacationUser = { ...user, data: { ...user.data, current_vacation_started_at: "2026-08-01T10:00:00.000Z" } };
  await mockApp(page, true, vacationUser);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Vacation Mode" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Start reviews/i })).toHaveCount(0);
  await page.goto("/reviews");
  await expect(page.getByRole("heading", { name: "Vacation Mode" })).toBeVisible();
  await expect(page.getByText(/Reviews are on hold until Vacation Mode is turned off/i)).toBeVisible();
});

test("uses the native crossword presets instead of an ignored 25-plus word control", async ({ page }) => {
  await mockApp(page);
  await page.goto("/study/crossword");
  await page.getByRole("button", { name: "Large 17×17" }).click();
  const wordCount = page.getByRole("slider", { name: /Number of words/i });
  await expect(wordCount).toHaveAttribute("min", "10");
  await expect(wordCount).toHaveAttribute("max", "24");
  await expect(wordCount).toHaveValue("16");
  await wordCount.press("End");
  await expect(wordCount).toHaveValue("24");
  await expect(page.getByRole("group", { name: "Estimated JLPT" })).toBeVisible();
  await expect(page.getByRole("button", { name: "English + Kanji" })).toBeVisible();
});

test("conceals review answers until the learner submits or reveals", async ({ page }) => {
  await mockApp(page);
  await page.goto("/reviews");
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible();
  await expect(page.getByText("Ground", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Primary meaning", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Accepted meanings and your synonyms are checked/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Info" })).toBeDisabled();
});

test("renders NHK thumbnails and in-article images", async ({ page }) => {
  await mockApp(page);
  await page.goto("/news");
  const thumbnail = page.getByRole("link", { name: /やさしいニュース/ }).locator("img");
  await expect(thumbnail).toBeVisible();
  await expect.poll(() => thumbnail.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole("link", { name: /やさしいニュース/ }).click();
  const articleImage = page.locator("main figure img").first();
  await expect(articleImage).toBeVisible();
  await expect.poll(() => articleImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
});

test("loads the shared community and creates an issue", async ({ page }) => {
  await mockApp(page);
  await page.goto("/community");
  await expect(page.getByRole("heading", { name: "Native parity issue" })).toBeVisible();
  await page.getByRole("link", { name: "New issue" }).click();
  await page.getByLabel("Title").fill("Created from the web");
  await page.getByLabel("Details").fill("This issue is shared with the native community board.");
  await page.getByRole("button", { name: "Submit issue" }).click();
  await expect(page).toHaveURL(/\/community\/issue-created$/);
  await expect(page.getByRole("heading", { name: "Created from the web" })).toBeVisible();
});

test("does not expose removed Bunpro routes", async ({ page }) => {
  await mockApp(page);
  const response = await page.goto("/bunpro");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("link", { name: /Bunpro/i })).toHaveCount(0);
});

test("migrates legacy custom font binaries from settings storage into IndexedDB", async ({ page }) => {
  await mockApp(page);
  await page.goto("/dashboard");
  await page.evaluate(() => {
    localStorage.setItem("kakehashi-web:settings:webtester:v1", JSON.stringify({
      study: {
        jitaiEnabled: true,
        jitaiSelectedFontIds: ["custom-legacyfont"],
        jitaiCustomFonts: [{ id: "custom-legacyfont", name: "Legacy Font", dataUrl: "data:font/woff2;base64,Zm9udA==" }],
      },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("kakehashi-web:settings:webtester:v1")?.includes("data:font") ?? true)).toBe(false);
  const migrated = await page.evaluate(() => new Promise<boolean>((resolve, reject) => {
    const request = indexedDB.open("kakehashi-jitai-fonts", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const read = database.transaction("fonts", "readonly").objectStore("fonts").get("custom-legacyfont");
      read.onerror = () => reject(read.error);
      read.onsuccess = () => { database.close(); resolve(read.result?.dataUrl === "data:font/woff2;base64,Zm9udA=="); };
    };
  }));
  expect(migrated).toBe(true);
});
