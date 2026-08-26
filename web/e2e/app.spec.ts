import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import { resolve } from "node:path";

const now = "2026-08-06T20:00:00.000Z";
const user = { id: 1, object: "user", url: "", data_updated_at: now, data: { username: "WebTester", level: 2, profile_url: "", started_at: now, current_vacation_started_at: null, preferences: { default_voice_actor_id: 1, lessons_autoplay_audio: true, lessons_batch_size: 5, lessons_presentation_order: "ascending_level_then_subject", reviews_autoplay_audio: true, reviews_display_srs_indicator: true }, subscription: { active: true, type: "lifetime", max_level_granted: 60, period_ends_at: null } } };
type MockUser = Omit<typeof user, "data"> & { data: Omit<typeof user.data, "current_vacation_started_at"> & { current_vacation_started_at: string | null } };

function subject(id: number, object: "radical" | "kanji" | "vocabulary", characters: string, meaning: string, reading?: string) {
  return { id, object, url: "", data_updated_at: now, data: { level: id === 1 ? 1 : 2, lesson_position: id, spaced_repetition_system_id: 1, created_at: now, slug: characters, document_url: `https://www.wanikani.com/subject/${id}`, hidden_at: null, characters, meanings: [{ meaning, primary: true, accepted_answer: true }], auxiliary_meanings: [], meaning_mnemonic: `${meaning} mnemonic.`, readings: reading ? [{ reading, primary: true, accepted_answer: true, type: "onyomi" }] : undefined, reading_mnemonic: reading ? `${reading} mnemonic.` : undefined, component_subject_ids: object === "kanji" ? [1] : [], amalgamation_subject_ids: object === "kanji" ? [3] : [], visually_similar_subject_ids: id === 2 ? [4] : id === 4 ? [2] : [], context_sentences: object === "vocabulary" ? [{ ja: `${characters}を見ます。`, en: `I see ${meaning}.` }] : [], parts_of_speech: object === "vocabulary" ? ["noun"] : [] } };
}

const kanjiOne = subject(2, "kanji", "一", "One", "いち");
kanjiOne.data.amalgamation_subject_ids = [3, 6];

const subjects = [
  subject(1, "radical", "一", "Ground"),
  kanjiOne,
  subject(3, "vocabulary", "一つ", "One Thing", "ひとつ"),
  subject(4, "kanji", "二", "Two", "に"),
  subject(5, "vocabulary", "二人", "Two People", "ふたり"),
  subject(6, "vocabulary", "日本史", "Japanese History", "にほんし"),
];
subjects[0].data.amalgamation_subject_ids = [2];

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
  const communityItems = [{ id: "issue-1", user_id: "user-1", user_username: "WebTester", user_level: 2, title: "Native parity issue", content: "The web community now shares the native issue board.", status: "open", labels: ["origin:web"], created_at: now, updated_at: now, likes_count: 2, reply_count: 0, is_liked: false }];
  await page.route("**/api/session/wanikani", async (route) => {
    const method = route.request().method();
    if (method === "POST") { authenticated = true; return fulfillJson(route, { user: mockedUser }); }
    if (method === "DELETE") { authenticated = false; return fulfillJson(route, { ok: true }); }
    return authenticated ? fulfillJson(route, { user: mockedUser }) : fulfillJson(route, { error: "No active session." }, 401);
  });
  await page.route("**/api/wanikani/**", async (route) => {
    const url = new URL(route.request().url());
    const resource = decodeURIComponent(url.pathname.replace(/^\/api\/wanikani\//, ""));
    if (resource === "mnemonic-image") return route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") });
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
  await page.route("**/api/study/immersion", (route) => fulfillJson(route, { example: { sentence: "日本史をアニメで勉強します。", translation: "I study Japanese history through anime.", title: "Sample Anime" } }));
  await page.route("**/api/anime/catalog", (route) => fulfillJson(route, { anime: [
    { id: "death_note", title: "Death Note", malTitle: "Death Note", imageUrl: "https://cdn.myanimelist.net/images/anime/9/9453.jpg", synopsis: "A notebook changes Light's life.", score: 8.62, episodes: 37, mediaType: "tv", malId: 1535, aniListId: 1535 },
    { id: "your_name", title: "Your Name", malTitle: "Kimi no Na wa.", imageUrl: "https://cdn.myanimelist.net/images/anime/5/87048.jpg", synopsis: "Two students mysteriously swap lives.", score: 8.83, episodes: 1, mediaType: "movie", malId: 32281, aniListId: 21519 },
  ] }));
  await page.route("**/api/anime/sync", (route) => fulfillJson(route, { provider: "myanimelist", username: "webtester", watched: 23, matchedSources: ["death_note"] }));
  await page.route(/\/news\/feed(?:\?.*)?$/, (route) => {
    const preference = new URL(route.request().url()).searchParams.get("source") || "easy";
    const easyArticle = { id: "easy:sample", source: "easy", isFullArticle: true, title: "やさしいニュース", summary: "日本語のニュースです。", body: "日本語を勉強します。", publishedAt: now, url: "https://www3.nhk.or.jp/news/easy/sample/", imageUrl: "https://nhkeasier.com/media/sample.png", content: [{ type: "image", url: "/media/sample.png", alt: "News illustration" }, { type: "text", text: "日本語を勉強します。", furigana: [{ start: 0, end: 3, reading: "にほんご" }] }] };
    const standardArticle = { id: "regular:20260825_standard", source: "regular", isFullArticle: true, title: "通常のNHKニュース", summary: "標準ニュースです。", body: "一つ目の最初の段落です。\n\n次の段落です。", publishedAt: "2026-08-25T12:00:00.000Z", url: "https://news.web.nhk/newsweb/na/20260825_standard", imageUrl: "https://imgu.web.nhk/news/example/lead.jpg", content: [{ type: "text", text: "一つ目の最初の段落です。" }, { type: "image", url: "https://img.web.nhk/news/example/body.jpg", alt: "NHK report" }, { type: "text", text: "次の段落です。" }] };
    const articles = preference === "both" ? [standardArticle, easyArticle] : preference === "regular" ? [standardArticle] : [easyArticle];
    return fulfillJson(route, { articles, updatedAt: now, source: "live" });
  });
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

test("keeps subject details full-width, horizontal, typed, contextual, and animated", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop geometry assertion");
  await page.setViewportSize({ width: 2200, height: 900 });
  await mockApp(page);
  await page.goto("/subjects/6");

  const hero = page.locator('header[data-type="vocabulary"]');
  const heroBox = await hero.boundingBox();
  const viewport = page.viewportSize();
  expect(heroBox?.x).toBe(0);
  expect(heroBox?.width).toBe(viewport?.width);
  const tabBarBox = await page.getByRole("tablist", { name: "Subject details" }).boundingBox();
  expect(tabBarBox?.x).toBe(0);
  expect(tabBarBox?.width).toBe(viewport?.width);

  const characters = hero.locator('[lang="ja"]').first();
  const characterBox = await characters.boundingBox();
  expect(characterBox?.width).toBeGreaterThan(characterBox?.height ?? Number.POSITIVE_INFINITY);
  await expect(hero).not.toContainText(/vocabulary/i);
  await expect(page.getByText("Alternative", { exact: true })).toHaveCount(0);

  await expect(page.locator('[role="tabpanel"]')).toHaveCount(3);
  const initialPanel = page.locator('[role="tabpanel"][data-tab-position="active"]');
  const nextPanel = page.locator('#subject-panel-reading');
  const [initialPanelBox, nextPanelBox] = await Promise.all([initialPanel.boundingBox(), nextPanel.boundingBox()]);
  expect((nextPanelBox?.x ?? 0) - (initialPanelBox?.x ?? 0)).toBeCloseTo(initialPanelBox?.width ?? Number.POSITIVE_INFINITY, 0);
  const initialTransitionProperties = await initialPanel.evaluate((element) => getComputedStyle(element).transitionProperty.split(",").map((property) => property.trim()));
  expect(initialTransitionProperties).toEqual(["transform"]);

  const swipeActivePanelLeft = async () => {
    const activePanel = page.locator('[role="tabpanel"][data-tab-position="active"]');
    const box = await activePanel.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    const y = box.y + Math.min(48, box.height / 4);
    await page.mouse.move(box.x + box.width * 0.78, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, y, { steps: 10 });
    await page.mouse.up();
  };
  const waitForPagerToSettle = async () => {
    await page.locator('[role="tabpanel"][data-tab-position="active"]').evaluate((element) => new Promise<void>((resolve) => {
      const timeout = window.setTimeout(resolve, 1_000);
      element.addEventListener("transitionend", (event) => {
        if ((event as TransitionEvent).propertyName !== "transform") return;
        window.clearTimeout(timeout);
        resolve();
      }, { once: true });
    }));
  };

  await swipeActivePanelLeft();
  await expect(page.getByRole("tab", { name: "Reading" })).toHaveAttribute("aria-selected", "true");
  await waitForPagerToSettle();
  await swipeActivePanelLeft();
  await expect(page.getByRole("tab", { name: "Context" })).toHaveAttribute("aria-selected", "true");
  await waitForPagerToSettle();
  const contextPanel = page.locator('[role="tabpanel"][data-tab-position="active"]');
  await expect(contextPanel.getByText("日本史を見ます。", { exact: true })).toBeVisible();
  await expect(contextPanel.getByText("Sample Anime", { exact: true })).toBeVisible();
  await expect(contextPanel.getByText("日本史をアニメで勉強します。", { exact: true })).toHaveCSS("font-size", "16px");
  expect(await contextPanel.evaluate((element) => getComputedStyle(element).transitionProperty)).toBe("transform");

  await page.goto("/subjects/2");
  const resolveThemeBackground = (variable: string) => page.evaluate((name) => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = `var(${name})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  }, variable);
  const relationBackground = (link: Locator) => link.evaluate((element) => getComputedStyle(element).backgroundColor);
  const componentSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Components", exact: true }) });
  const radicalComponent = componentSection.getByRole("link", { name: /Ground/ });
  await expect(radicalComponent).toHaveAttribute("data-type", "radical");
  expect(await relationBackground(radicalComponent)).toBe(await resolveThemeBackground("--color-radical"));
  const similarSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Visually similar", exact: true }) });
  const similarKanji = similarSection.getByRole("link", { name: /Two/ });
  await expect(similarKanji).toHaveAttribute("data-type", "kanji");
  expect(await relationBackground(similarKanji)).toBe(await resolveThemeBackground("--color-kanji"));
  const vocabularySection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Found in vocabulary", exact: true }) });
  const vocabularyExample = vocabularySection.getByRole("link", { name: /Japanese History/ });
  await expect(vocabularyExample).toHaveAttribute("data-type", "vocabulary");
  expect(await relationBackground(vocabularyExample)).toBe(await resolveThemeBackground("--color-vocabulary"));
  await expect(vocabularySection.getByText("Japanese History", { exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Context" })).toHaveCount(0);
  await expect(page.getByText("Sample Anime", { exact: true })).toHaveCount(0);

  const shellHeader = page.locator("header").first();
  expect(await shellHeader.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(await resolveThemeBackground("--color-kanji"));
  await page.evaluate(() => window.scrollTo(0, 160));
  await expect(shellHeader).toHaveAttribute("data-floating", "true");
  expect(await shellHeader.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(await resolveThemeBackground("--color-kanji"));

  await page.goto("/subjects/1");
  await expect(page.getByRole("tab", { name: "Context" })).toHaveCount(0);
  const foundInKanji = page.locator("section").filter({ has: page.getByRole("heading", { name: "Found in kanji", exact: true }) }).getByRole("link", { name: /One/ });
  await expect(foundInKanji).toHaveAttribute("data-type", "kanji");
  expect(await relationBackground(foundInKanji)).toBe(await resolveThemeBackground("--color-kanji"));

  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/subjects/6");
    const compactCharacters = page.locator('header[data-type="vocabulary"] [lang="ja"]').first();
    const compactCharacterBox = await compactCharacters.boundingBox();
    expect(compactCharacterBox?.width).toBeGreaterThan(compactCharacterBox?.height ?? Number.POSITIVE_INFINITY);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `subject details overflow at ${width}px`).toBe(true);
  }
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/subjects/2");
  const compactRelations = page.locator('[role="tabpanel"][data-tab-position="active"] a[data-type]');
  await expect(compactRelations).toHaveCount(4);
  for (const relationLink of await compactRelations.all()) {
    const box = await relationLink.boundingBox();
    expect(box?.width).toBeGreaterThan(box?.height ?? Number.POSITIVE_INFINITY);
    await expect(relationLink).not.toContainText(/radical|kanji|vocabulary/i);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "related subject cards overflow at 320px").toBe(true);
  await page.setViewportSize({ width: 2200, height: 900 });

  await page.goto("/settings");
  const contextSentencesToggle = page.getByRole("checkbox", { name: "Show WaniKani context sentences" });
  const animeContextToggle = page.getByRole("checkbox", { name: "Show anime context examples" });
  await expect(contextSentencesToggle).toBeChecked();
  await expect(animeContextToggle).toBeChecked();
  await page.getByText("Show anime context examples", { exact: true }).click();

  await page.goto("/subjects/6");
  await page.getByRole("tab", { name: "Context" }).click();
  await expect(page.getByText("日本史を見ます。", { exact: true })).toBeVisible();
  await expect(page.getByText("Sample Anime", { exact: true })).toHaveCount(0);

  await page.goto("/settings");
  await page.getByText("Show WaniKani context sentences", { exact: true }).click();
  await page.goto("/subjects/6");
  await expect(page.getByRole("tab", { name: "Context" })).toHaveCount(0);
});

test("keeps the username visible when the desktop header collapses", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop navigation assertion");
  await mockApp(page);
  await page.goto("/dashboard");

  const identity = page.getByRole("link", { name: "Kakehashi home for WebTester" });
  const username = identity.locator("strong");
  await expect(username).toHaveText("WebTester");
  await expect(username).toHaveCSS("opacity", "1");

  await page.evaluate(() => window.scrollTo(0, 120));
  await expect(page.locator("header")).toHaveAttribute("data-floating", "true");
  await page.waitForTimeout(500);
  await expect(username).toHaveCSS("opacity", "1");
});

test("keeps every collapsed navigation label inside its own hit target", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop navigation assertion");
  await mockApp(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await page.evaluate(() => {
    document.body.style.minHeight = "200vh";
    window.scrollTo(0, 120);
    window.dispatchEvent(new Event("scroll"));
  });
  await expect(page.locator("header")).toHaveAttribute("data-floating", "true");
  await page.waitForTimeout(500);

  for (const label of ["Songs", "Search"]) {
    const link = page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: label });
    const box = await link.boundingBox();
    expect(box).not.toBeNull();
    if (!box) continue;

    for (const fraction of [0.2, 0.5, 0.8]) {
      const hitLabel = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest("a")?.textContent?.trim() ?? null, {
        x: box.x + box.width * fraction,
        y: box.y + box.height / 2,
      });
      expect(hitLabel, `${label} is blocked at ${fraction * 100}% of its width`).toBe(label);
    }
  }
});

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

test("opens the constellation as a collision-free pan and zoom canvas", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop canvas geometry assertion");
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockApp(page);
  await page.goto("/subjects/2");
  const constellationLink = page.getByRole("link", { name: "Explore subject constellation" });
  await expect(constellationLink.locator('svg[data-icon="planet-outline"]')).toBeVisible();
  await constellationLink.click();

  await expect(page).toHaveURL(/\/subjects\/2\/constellation$/);
  const canvas = page.getByRole("region", { name: "Relationship constellation for One" });
  const main = page.locator('main[data-constellation="active"]');
  await expect(canvas).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeHidden();

  const [mainBox, viewport] = await Promise.all([main.boundingBox(), page.viewportSize()]);
  expect(mainBox?.x).toBe(0);
  expect(mainBox?.y).toBe(0);
  expect(mainBox?.width).toBe(viewport?.width);
  expect(mainBox?.height).toBe(viewport?.height);

  const nodes = canvas.locator('[data-kind][data-type]');
  await expect(nodes).toHaveCount(4);
  await expect(canvas.locator('[data-kind="similar"]')).toHaveCount(0);
  await expect(canvas.locator("[data-connection-layer] line")).toHaveCount(4);
  expect(await canvas.locator("[data-node-label], [data-node-reading]").evaluateAll((labels) => labels.every((label) => {
    const style = getComputedStyle(label);
    return style.textOverflow !== "ellipsis" && label.scrollWidth <= label.clientWidth + 1;
  }))).toBe(true);
  const circles = await nodes.evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, radius: rect.width / 2 };
  }));
  for (let firstIndex = 0; firstIndex < circles.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < circles.length; secondIndex += 1) {
      const first = circles[firstIndex];
      const second = circles[secondIndex];
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      expect(distance, `constellation nodes ${firstIndex} and ${secondIndex} overlap`).toBeGreaterThanOrEqual(first.radius + second.radius - 0.5);
    }
  }

  const world = canvas.locator("[data-constellation-world]");
  const transformBeforePan = await world.getAttribute("style");
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  if (!canvasBox) return;
  await page.mouse.move(canvasBox.x + 40, canvasBox.y + canvasBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 150, canvasBox.y + canvasBox.height / 2 + 70, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => world.getAttribute("style")).not.toBe(transformBeforePan);

  const zoom = page.getByLabel("Current zoom");
  const zoomBefore = await zoom.textContent();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(zoom).not.toHaveText(zoomBefore ?? "");
  await page.getByRole("button", { name: "Fit constellation" }).click();
  await expect(page.getByRole("button", { name: "Close constellation" })).toBeVisible();
});

test("leaves the constellation without trapping browser history", async ({ page }) => {
  await mockApp(page);
  await page.goto("/search");
  await page.goto("/subjects/2");
  await page.getByRole("link", { name: "Explore subject constellation" }).click();
  await expect(page).toHaveURL(/\/subjects\/2\/constellation$/);

  await page.getByRole("button", { name: "Back to One" }).click();
  await expect(page).toHaveURL(/\/subjects\/2$/);
  await page.goBack();

  await expect(page).toHaveURL(/\/search$/);
});

test("opens a related item's constellation from the canvas", async ({ page }) => {
  await mockApp(page);
  await page.goto("/subjects/2/constellation");

  await page.locator('a[href="/subjects/3/constellation"]').click();

  await expect(page).toHaveURL(/\/subjects\/3\/constellation$/);
  await expect(page.getByRole("region", { name: "Relationship constellation for One Thing" })).toBeVisible();
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

test("reorders dashboard previews and keeps every optional section responsive", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop drag-and-drop assertion");
  await mockApp(page);
  await page.goto("/settings");

  const visibleSections = page.getByRole("list", { name: "Visible dashboard sections" });
  const visibleWidgets = visibleSections.locator(":scope > li");
  const recentMistakes = page.locator('[data-available-section="recent-mistakes"]');
  await expect(visibleWidgets).toHaveCount(6);
  await expect(page.locator("[data-widget-preview]")).toHaveCount(17);
  const longVocabularyPreviews = page.locator('[data-widget-preview] [data-subject-type="vocabulary"][data-long="true"]');
  await expect(longVocabularyPreviews).toHaveCount(4);
  expect(await longVocabularyPreviews.evaluateAll((glyphs) => glyphs.every((glyph) => glyph.scrollWidth <= glyph.clientWidth && glyph.scrollHeight <= glyph.clientHeight)), "long vocabulary should fit inside every subject preview tile").toBe(true);

  await recentMistakes.getByRole("button", { name: "Add Recent Mistakes" }).click();
  await expect(visibleWidgets).toHaveCount(7);
  await expect(visibleWidgets.last()).toContainText("Recent Mistakes");

  const srsBreakdown = visibleSections.locator('[data-editor-section="srs"]');
  await srsBreakdown.dragTo(visibleWidgets.first());
  await expect(visibleWidgets.first()).toContainText("SRS Breakdown");
  await page.getByRole("button", { name: "Set SRS Breakdown to one third" }).click();

  for (const label of ["Usage Streak", "Subject Lists", "Incomplete Levels", "Recent Unlocks", "Critical Items", "Burned Items", "Review Heatmap", "Level Timing", "Today’s Study", "Study Time"]) {
    await page.getByRole("button", { name: `Add ${label}` }).click();
  }
  await expect(visibleWidgets).toHaveCount(17);

  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/settings");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `settings editor overflows at ${width}px`).toBe(true);
    await expect(page.getByRole("button", { name: "Move Lessons & Reviews down" })).toBeVisible();

    await page.goto("/dashboard");
    await expect(page.locator("main [data-section]")).toHaveCount(17);
    await expect(page.locator('[data-section="srs"]')).toHaveAttribute("data-layout-width", "4");
    await expect(page.getByRole("heading", { name: "Review heatmap" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Study time" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `expanded dashboard overflows at ${width}px`).toBe(true);
  }
});

test("keeps review stats readable and compact at one-third width", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop widget geometry assertion");
  await page.setViewportSize({ width: 1600, height: 900 });
  await mockApp(page);
  const largeStatistics = statistics.map((statistic, index) => ({
    ...statistic,
    data: {
      ...statistic.data,
      meaning_correct: 5_440 + index,
      meaning_incorrect: 360 + index,
      reading_correct: statistic.data.subject_type === "radical" ? 0 : 6_510 + index,
      reading_incorrect: statistic.data.subject_type === "radical" ? 0 : 410 + index,
    },
  }));
  await page.route("**/api/wanikani/review_statistics", (route) => fulfillJson(route, collection(largeStatistics)));
  await page.goto("/dashboard");
  await page.evaluate(() => { document.documentElement.style.fontSize = "120%"; });

  const widget = page.locator('[data-section="study-pulse"]');
  await expect(widget).toHaveAttribute("data-layout-width", "4");
  await expect(widget.getByRole("heading", { name: "Review stats" })).toBeVisible();

  const totalLabels = widget.locator('[class*="reviewStatsLead"] > div > span, [class*="reviewAccuracyRow"] > div:first-child > span');
  await expect(totalLabels).toHaveCount(3);
  expect((await totalLabels.allTextContents()).join(" ")).toMatch(/\d{2,},\d{3}/);
  expect(await totalLabels.evaluateAll((labels) => labels.every((label) => {
    const style = getComputedStyle(label);
    return style.textOverflow !== "ellipsis"
      && label.scrollWidth <= label.clientWidth
      && label.scrollHeight <= label.clientHeight;
  })), "review totals should be fully visible").toBe(true);

  const detailRows = widget.locator('[class*="reviewAccuracyRow"]');
  const rowTops = await detailRows.evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().top));
  expect(Math.abs(rowTops[0] - rowTops[1]), "one-third detail rows should share a compact row").toBeLessThan(2);
});

test("applies advanced study and reading preferences to their workflows", async ({ page, isMobile }) => {
  await mockApp(page);
  await page.goto("/settings");
  await page.getByLabel("Self-assessment cards").selectOption("both");
  await page.getByLabel("EPUB daily goal").selectOption("20");
  await page.evaluate(() => window.scrollTo(0, 240));
  await page.getByRole("button", { name: /Anime listening sources: All 2 anime/i }).click();
  const animeDialog = page.getByRole("dialog", { name: "Choose anime" });
  await expect.poll(() => page.evaluate(() => ({ root: document.documentElement.style.overflow, body: document.body.style.overflow, position: document.body.style.position }))).toEqual({ root: "hidden", body: "hidden", position: "fixed" });
  const preservedPagePosition = await page.evaluate(() => Math.abs(Number.parseFloat(document.body.style.top)));
  const lockedScrollTop = await page.evaluate(() => window.scrollY);
  if (!isMobile) {
    await animeDialog.getByRole("group", { name: "Available anime" }).hover();
    await page.mouse.wheel(0, 1_000);
    expect(await page.evaluate(() => window.scrollY)).toBe(lockedScrollTop);
  }
  await expect(animeDialog.getByText("Death Note", { exact: true })).toBeVisible();
  await expect(animeDialog.getByText("8.62", { exact: true })).toBeVisible();
  await animeDialog.getByLabel("MyAnimeList").fill("webtester");
  await animeDialog.locator('form[data-provider="myanimelist"]').getByRole("button", { name: "Sync watched" }).click();
  await expect(animeDialog.getByText("1 of 23 watched anime matched ImmersionKit.")).toBeVisible();
  await animeDialog.getByRole("button", { name: /Your Name/i }).click();
  await animeDialog.getByRole("button", { name: "Apply selection" }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(preservedPagePosition);

  await page.goto("/reviews");
  await expect(page.getByRole("button", { name: "Reveal Answer" })).toBeVisible();
  await page.getByRole("button", { name: "Reveal Answer" }).click();
  await expect(page.getByText("Expected meaning")).toBeVisible();
  await expect(page.getByRole("button", { name: /Got it/ })).toBeVisible();

  await page.goto("/epubs");
  await expect(page.getByText("20 minute daily goal")).toBeVisible();

  await page.goto("/study/listening");
  await expect(page.getByRole("button", { name: /Anime sources: All 2 anime/i })).toBeVisible();
});

test("honors Vacation Mode across the dashboard and direct study routes", async ({ page }) => {
  const vacationUser = { ...user, data: { ...user.data, current_vacation_started_at: "2026-08-01T10:00:00.000Z" } };
  await mockApp(page, true, vacationUser);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Vacation Mode" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Turn off in WaniKani/ }).first()).toHaveAttribute("href", "https://www.wanikani.com/settings/account");
  await expect(page.getByRole("button", { name: "Check status" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Start reviews/i })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto("/reviews");
  await expect(page.getByRole("heading", { name: "Vacation Mode" })).toBeVisible();
  await expect(page.getByText(/Reviews are on hold until Vacation Mode is turned off/i)).toBeVisible();
});

test("offers a quick Vacation Mode shortcut while study is active", async ({ page }) => {
  await mockApp(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /Turn on in WaniKani/ })).toHaveAttribute("href", "https://www.wanikani.com/settings/account");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
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

test("shows NHK furigana by default and remembers when it is disabled", async ({ page }) => {
  await mockApp(page);
  await page.goto("/news");
  await page.getByRole("link", { name: /やさしいニュース/ }).click();

  await expect(page.locator("main ruby rt")).toHaveText("にほんご");
  const hideFurigana = page.getByRole("button", { name: "Furigana" });
  await expect(hideFurigana).toHaveAttribute("aria-pressed", "true");
  await hideFurigana.click();
  await expect(page.locator("main ruby")).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("button", { name: "Furigana" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("main ruby")).toHaveCount(0);
});

test("shows the mnemonic illustration on radical details", async ({ page }) => {
  await mockApp(page);
  await page.goto("/subjects/1");
  const illustration = page.getByRole("img", { name: "Mnemonic illustration for Ground" });
  await expect(illustration).toBeVisible();
  await expect.poll(() => illustration.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
});

test("switches between Easy and Standard NHK and opens a full Standard article", async ({ page }) => {
  await mockApp(page);
  await page.goto("/news");
  const sourceSelector = page.getByRole("combobox", { name: "Source", exact: true });
  await sourceSelector.selectOption("both");
  await expect(page.getByRole("link", { name: /通常のNHKニュース/ })).toBeVisible();
  await expect(page.getByLabel("Standard source").first()).toBeVisible();
  await expect(page.getByLabel("Easy source").first()).toBeVisible();

  await sourceSelector.selectOption("regular");
  await page.getByRole("link", { name: /通常のNHKニュース/ }).click();
  await expect(page.getByText(/Standard ·/)).toBeVisible();
  await expect(page.getByText("最初の段落です。", { exact: false })).toBeVisible();
  const standardFurigana = page.getByRole("button", { name: "Furigana" });
  await expect(standardFurigana).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("main ruby rt").first()).toHaveText("ひとつ");
  await standardFurigana.click();
  await expect(page.locator("main ruby")).toHaveCount(0);
  const articleImages = page.locator('main [data-reader-block="image"] img');
  await expect(articleImages).toHaveCount(2);
  await expect(articleImages.first()).toBeVisible();
});

test("loads the shared community and creates an issue", async ({ page }) => {
  await mockApp(page);
  await page.goto("/community");
  await expect(page.getByRole("heading", { name: "Native parity issue" })).toBeVisible();
  await expect(page.getByLabel("Created on Kakehashi Web")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Community tools" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Feedback", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Feature request", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "New issue" }).click();
  await page.getByLabel("Title").fill("Created from the web");
  await page.getByLabel("Details").fill("This issue is shared with the native community board.");
  await page.getByRole("button", { name: "Submit issue" }).click();
  await expect(page).toHaveURL(/\/community\/issue-created$/);
  await expect(page.getByRole("heading", { name: "Created from the web" })).toBeVisible();
  await expect(page.getByLabel("Created on Kakehashi Web")).toBeVisible();
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

test("keeps song search and full-context lyrics usable from phone to desktop", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The desktop project exercises all target widths.");
  await mockApp(page);
  const musicTrack = { id: "spotify-id", title: "アイドル", artist: "YOASOBI", artistId: "artist-id", albumArt: "", spotifyUrl: "https://open.spotify.com/track/spotify-id", previewUrl: null, durationMs: 213_000, albumName: "アイドル", releaseDate: "2023-04-12" };
  const musicRecommendations = Array.from({ length: 18 }, (_, index) => ({
    ...musicTrack,
    id: `spotify-recommendation-${index}`,
    title: `おすすめ ${index + 1}`,
  }));
  const musicLyrics = { id: 42, trackName: "アイドル", artistName: "YOASOBI", albumName: "アイドル", plainLyrics: "猫と犬が空を見る\n山と川を歩く\n花と鳥が歌う\n月と星が光る", syncedLyrics: "[00:01.00]猫と犬が空を見る\n[00:03.00]山と川を歩く\n[00:05.00]花と鳥が歌う\n[00:07.00]月と星が光る", duration: 213 };
  const musicVideo = { videoId: "ZRtdQ81jPUQ", title: "アイドル Official Music Video", channelTitle: "Ayase / YOASOBI", thumbnailUrl: "", duration: 213 };
  await page.route("**/music/discover", (route) => fulfillJson(route, { sections: [{ id: "popular-jpop", title: "Popular J-pop", tracks: musicRecommendations }] }));
  await page.route("**/music/search", (route) => fulfillJson(route, { provider: "spotify", tracks: [musicTrack] }));
  await page.route("**/music/import", (route) => fulfillJson(route, { track: musicTrack, lyrics: musicLyrics, lyricsResults: [musicLyrics], lyricsWarning: null, video: musicVideo, videos: [musicVideo], videoWarning: null }));

  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/music");
  const songSearch = page.getByRole("textbox", { name: "Search songs" });
  await expect(songSearch).toBeVisible();
  await expect(page.getByText("Use an LRCLIB link or paste lyrics")).toHaveCount(0);
  expect((await songSearch.locator("..").boundingBox())?.height).toBeLessThanOrEqual(52);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const popularSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Popular J-pop" }) });
  const recommendationCards = popularSection.getByRole("button");
  await expect(recommendationCards).toHaveCount(18);
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect((await recommendationCards.first().boundingBox())?.width).toBeLessThanOrEqual(152);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  const recommendationGeometry = await recommendationCards.evaluateAll((cards) => {
    const boxes = cards.map((card) => card.getBoundingClientRect());
    const firstRowY = boxes[0]?.y ?? 0;
    return {
      firstWidth: boxes[0]?.width ?? 0,
      firstRowCount: boxes.filter((box) => Math.abs(box.y - firstRowY) < 2).length,
    };
  });
  expect(recommendationGeometry.firstWidth).toBeLessThanOrEqual(152);
  expect(recommendationGeometry.firstRowCount).toBeGreaterThanOrEqual(6);
  await page.setViewportSize({ width: 320, height: 800 });
  await songSearch.fill("YOASOBI");
  const trackResult = page.getByRole("button", { name: /アイドル by YOASOBI/i });
  await expect(trackResult).toBeVisible();
  await expect(page.getByRole("heading", { name: "Search results" })).toHaveCount(0);
  await expect(page.getByText("Spotify catalog")).toHaveCount(0);
  expect(await trackResult.evaluate((element) => ({ display: getComputedStyle(element).display, border: getComputedStyle(element).borderTopStyle }))).toEqual({ display: "grid", border: "solid" });
  await trackResult.click();
  await expect(page.getByRole("button", { name: "Back to search" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Video matches" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lyrics matches" })).toBeVisible();
  await expect(page.getByText("Use manual video or lyrics overrides")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const lyricsFocus = page.getByRole("button", { name: "Focus lyrics" });
  await lyricsFocus.click();
  await expect(page.getByRole("button", { name: "Balanced view" })).toHaveAttribute("aria-pressed", "true");
  const videoPanel = page.getByRole("region", { name: "Song video" });
  const lyricsPanel = page.getByRole("region", { name: "Song lyrics" }).locator("..");
  const mobileVideoBox = await videoPanel.boundingBox();
  const mobileLyricsBox = await lyricsPanel.boundingBox();
  expect(mobileLyricsBox?.y).toBeLessThan(mobileVideoBox?.y ?? 0);

  const quiz = page.getByRole("button", { name: "Quiz mode" });
  await expect(quiz).toBeEnabled();
  await quiz.click();
  const lyricsRegion = page.getByRole("region", { name: "Song lyrics" });
  await expect(lyricsRegion.getByText("山と川を歩く", { exact: true })).toBeVisible();
  await expect(lyricsRegion.getByText("月と星が光る", { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const stageColumns = await videoPanel.locator("..").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  expect(stageColumns).toBeGreaterThan(1);
  const desktopVideoBox = await videoPanel.boundingBox();
  const desktopLyricsBox = await lyricsPanel.boundingBox();
  expect(desktopLyricsBox?.width).toBeGreaterThan(desktopVideoBox?.width ?? Number.POSITIVE_INFINITY);
  expect(desktopLyricsBox?.x).toBeLessThan(desktopVideoBox?.x ?? 0);
});
