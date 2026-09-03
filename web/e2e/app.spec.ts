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

async function seriousAccessibilityViolations(page: Page) {
  await page.evaluate(async () => {
    const finiteAnimations = document.getAnimations().filter((animation) => {
      const endTime = animation.effect?.getComputedTiming().endTime;
      return typeof endTime === "number" && Number.isFinite(endTime);
    });
    await Promise.allSettled(finiteAnimations.map((animation) => animation.finished));
  });
  const hasAxe = await page.evaluate(() => Boolean((window as typeof window & { axe?: unknown }).axe));
  if (!hasAxe) await page.addScriptTag({ path: resolve("node_modules/axe-core/axe.min.js") });
  return page.evaluate(async () => {
    const axe = (window as typeof window & { axe: { run: (root: Document, options: unknown) => Promise<{ violations: Array<{ id: string; impact: string | null; nodes: Array<{ target: string[]; failureSummary?: string }> }> }> } }).axe;
    const result = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } });
    return result.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical").map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.map((node) => ({ target: node.target, failureSummary: node.failureSummary })) }));
  });
}

async function cardMetrics(card: Locator) {
  return card.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
      width: bounds.width,
      height: bounds.height,
      fits: element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.clientHeight,
    };
  });
}

async function quizFrameClasses(page: Page) {
  return page.locator('section[aria-labelledby="question-prompt"]').evaluate((shell) => {
    const prompt = document.getElementById("question-prompt");
    const input = shell.querySelector("input");
    const form = input?.closest("form");
    return {
      shell: shell.className,
      topbar: shell.firstElementChild?.className ?? "",
      questionCard: prompt?.parentElement?.className ?? "",
      answerArea: form?.parentElement?.className ?? "",
      answerForm: form?.className ?? "",
      promptTypeStrip: form?.querySelector("label")?.className ?? "",
      answerInputRow: input?.parentElement?.className ?? "",
    };
  });
}

async function watchNavbarItemMotion(navigation: Locator, href: string) {
  await navigation.evaluate((element, watchedHref) => {
    element.setAttribute("data-motion-observed", "false");
    const check = () => {
      const item = [...element.querySelectorAll<HTMLElement>("[data-navbar-item]")].find((candidate) => candidate.dataset.navbarItem === watchedHref);
      if (!item) return;
      const opacity = Number.parseFloat(item.style.opacity);
      const transform = item.style.transform;
      const translated = Boolean(transform && transform !== "none" && transform !== "translateX(0px)");
      if ((!Number.isNaN(opacity) && opacity < 0.99) || translated) {
        observer.disconnect();
        element.setAttribute("data-motion-observed", "true");
      }
    };
    const observer = new MutationObserver(check);
    observer.observe(element, { attributes: true, attributeFilter: ["style"], childList: true, subtree: true });
    check();
    window.setTimeout(() => observer.disconnect(), 500);
  }, href);
}

test("keeps off settings switches visible in dark mode", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Color contrast is identical across viewports");
  await page.addInitScript(() => window.localStorage.setItem("kakehashi-web-theme", "dark"));
  await mockApp(page);
  await page.goto("/settings");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const checkbox = page.getByRole("checkbox", { name: "Shuffle subjects" });
  await expect(checkbox).not.toBeChecked();
  const visibleSwitch = checkbox.locator("..").locator(":scope > i");
  await expect(visibleSwitch).toBeVisible();

  const contrast = await visibleSwitch.evaluate((element) => {
    type Color = [number, number, number, number];
    const parse = (value: string): Color => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d")!;
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
      return [red, green, blue, alpha / 255];
    };
    const composite = (foreground: Color, background: Color): Color => {
      const alpha = foreground[3] + background[3] * (1 - foreground[3]);
      if (alpha === 0) return [0, 0, 0, 0];
      return [
        (foreground[0] * foreground[3] + background[0] * background[3] * (1 - foreground[3])) / alpha,
        (foreground[1] * foreground[3] + background[1] * background[3] * (1 - foreground[3])) / alpha,
        (foreground[2] * foreground[3] + background[2] * background[3] * (1 - foreground[3])) / alpha,
        alpha,
      ];
    };
    const luminance = (color: Color) => {
      const linear = color.slice(0, 3).map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    const ratio = (first: Color, second: Color) => {
      const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
      return (lighter + 0.05) / (darker + 0.05);
    };

    const layers: Color[] = [];
    let ancestor = element.parentElement;
    while (ancestor) {
      const background = parse(getComputedStyle(ancestor).backgroundColor);
      if (background[3] > 0) layers.push(background);
      if (background[3] >= 1) break;
      ancestor = ancestor.parentElement;
    }
    const surrounding = layers.reverse().reduce((background, layer) => composite(layer, background), [0, 0, 0, 1] as Color);
    const style = getComputedStyle(element);
    const track = composite(parse(style.backgroundColor), surrounding);
    const border = composite(parse(style.borderTopColor), surrounding);
    const thumb = composite(parse(getComputedStyle(element, "::after").backgroundColor), track);

    return {
      borderContrast: ratio(border, surrounding),
      thumbContrast: ratio(thumb, track),
      colors: {
        surrounding: getComputedStyle(element.parentElement!).backgroundColor,
        track: style.backgroundColor,
        border: style.borderTopColor,
        thumb: getComputedStyle(element, "::after").backgroundColor,
      },
    };
  });

  expect(
    Math.min(contrast.borderContrast, contrast.thumbContrast),
    `Off switch contrast: ${JSON.stringify(contrast)}`,
  ).toBeGreaterThanOrEqual(3);

  const checkedSwitch = page.getByRole("checkbox", { name: "Keyboard shortcuts" });
  await expect(checkedSwitch).toBeChecked();
  const checkedThumb = await checkedSwitch.locator("..").locator(":scope > i").evaluate((element) => {
    const probe = document.createElement("i");
    probe.style.backgroundColor = "var(--color-surface)";
    document.body.append(probe);
    const colors = {
      thumb: getComputedStyle(element, "::after").backgroundColor,
      surface: getComputedStyle(probe).backgroundColor,
    };
    probe.remove();
    return colors;
  });
  expect(checkedThumb.thumb, "Checked switches should retain the existing surface-colored thumb").toBe(checkedThumb.surface);
});

async function mockApp(page: Page, initiallyAuthenticated = true, mockedUser: MockUser = user) {
  let authenticated = initiallyAuthenticated;
  const communityItems = [{ id: "issue-1", user_id: "user-1", user_username: "WebTester", user_level: 2, title: "Native parity issue", content: "The web community now shares the native issue board.", status: "open", labels: ["origin:web"], created_at: now, updated_at: now, likes_count: 2, reply_count: 0, is_liked: false }];
  await page.route("**/api/session/wanikani", async (route) => {
    const method = route.request().method();
    if (method === "POST") { authenticated = true; return fulfillJson(route, { user: mockedUser }); }
    if (method === "DELETE") { authenticated = false; return fulfillJson(route, { ok: true }); }
    return authenticated ? fulfillJson(route, { user: mockedUser }) : fulfillJson(route, { error: "No active session." }, 401);
  });
  await page.route("**/api/custom-srs", (route) => fulfillJson(route, { available: false, state: null, revision: -1 }));
  await page.route("**/api/analytics/session", (route) => fulfillJson(route, { recorded: true }));
  await page.route(/\/api\/analytics\/study-time(?:\?.*)?$/, (route) => fulfillJson(route, route.request().method() === "GET" ? { available: true, days: [] } : { synced: true }));
  await page.route(/\/api\/analytics\/streak(?:\?.*)?$/, (route) => fulfillJson(route, { activeDays: [], available: true }));
  await page.route("**/api/subjects/lists", (route) => fulfillJson(route, route.request().method() === "GET" ? { lists: [] } : { synced: true }));
  await page.route("**/api/subjects/enrichments", (route) => fulfillJson(route, { pitchAccents: [], patterns: [] }));
  await page.route("**/music/discover", (route) => fulfillJson(route, { sections: [] }));
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
  await page.route("https://apiv2.immersionkit.com/index_meta", (route) => fulfillJson(route, { data: { sample_anime: { title: "Sample Anime", category: "anime" } } }));
  await page.route(/^https:\/\/apiv2\.immersionkit\.com\/search\?/, (route) => fulfillJson(route, { examples: [{ id: "anime_sample_1", sentence: "日本史をアニメで勉強します。", translation: "I study Japanese history through anime.", title: "sample_anime" }] }));
  await page.route("**/api/study/immersion", (route) => fulfillJson(route, { error: "Production proxy unavailable" }, 502));
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
  const highlightedVocabulary = contextPanel.locator("mark");
  await expect(highlightedVocabulary).toHaveText("日本史");
  await expect(highlightedVocabulary).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const highlightStyle = await highlightedVocabulary.evaluate((element) => {
    const probe = document.createElement("span");
    probe.style.color = "var(--color-vocabulary)";
    document.body.append(probe);
    const style = getComputedStyle(element);
    const result = { color: style.color, fontWeight: Number(style.fontWeight), vocabularyColor: getComputedStyle(probe).color };
    probe.remove();
    return result;
  });
  expect(highlightStyle.color).toBe(highlightStyle.vocabularyColor);
  expect(highlightStyle.fontWeight).toBeGreaterThanOrEqual(700);
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

test("expands vocabulary cards without reducing their default type size", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Runs desktop and narrow geometry in one project");
  await mockApp(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/subjects/3");
  const shortHero = await cardMetrics(page.locator('header[data-type="vocabulary"] [class*="subjectHeroCharacter"]'));
  await page.goto("/subjects/6");
  const longHero = await cardMetrics(page.locator('header[data-type="vocabulary"] [class*="subjectHeroCharacter"]'));
  expect(longHero.fontSize).toBe(shortHero.fontSize);
  expect(longHero.height).toBeCloseTo(shortHero.height, 0);
  expect(longHero.width).toBeGreaterThan(shortHero.width);
  expect(longHero.width).toBeGreaterThan(longHero.height);
  expect(longHero.fits).toBe(true);

  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/search");
    const shortCard = page.getByRole("link", { name: "一つ, One Thing" }).locator('[class*="subjectCharacters"]');
    const longCard = page.getByRole("link", { name: "日本史, Japanese History" }).locator('[class*="subjectCharacters"]');
    const kanjiCard = page.getByRole("link", { name: "一, One" }).locator('[class*="subjectCharacters"]');
    await expect(longCard).toBeVisible();
    const [shortMetrics, longMetrics, kanjiMetrics] = await Promise.all([cardMetrics(shortCard), cardMetrics(longCard), cardMetrics(kanjiCard)]);
    expect(longMetrics.fontSize).toBe(shortMetrics.fontSize);
    expect(longMetrics.height).toBeCloseTo(shortMetrics.height, 0);
    expect(longMetrics.width).toBeGreaterThan(shortMetrics.width);
    expect(longMetrics.width).toBeGreaterThan(longMetrics.height);
    expect(longMetrics.fits).toBe(true);
    expect(kanjiMetrics.width).toBeCloseTo(kanjiMetrics.height, 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `search cards overflow at ${width}px`).toBe(true);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/progress/wrapped/2");
  const vocabularyGroup = page.locator('[data-level-subject-type="vocabulary"]');
  const shortRecap = await cardMetrics(vocabularyGroup.getByRole("link", { name: /One Thing/ }).locator('[class*="levelItemGlyph"]'));
  const longRecap = await cardMetrics(vocabularyGroup.getByRole("link", { name: /Japanese History/ }).locator('[class*="levelItemGlyph"]'));
  expect(longRecap.fontSize).toBe(shortRecap.fontSize);
  expect(longRecap.height).toBeCloseTo(shortRecap.height, 0);
  expect(longRecap.width).toBeGreaterThan(longRecap.height);
  expect(longRecap.fits).toBe(true);

  await page.goto("/settings");
  const preview = page.locator('[data-widget-preview="recent-unlocks"]');
  const longPreview = await cardMetrics(preview.locator('[data-subject-type="vocabulary"][data-long="true"]'));
  const kanjiPreview = await cardMetrics(preview.locator('[data-subject-type="kanji"]'));
  expect(longPreview.fontSize).toBe(kanjiPreview.fontSize);
  expect(longPreview.width).toBeGreaterThan(longPreview.height);
  expect(longPreview.fits).toBe(true);

  await page.route("**/api/subjects/lists", (route) => fulfillJson(route, { lists: [{
    id: "vocabulary-cards",
    name: "Vocabulary cards",
    subjectIds: [3, 6],
    createdAt: now,
    updatedAt: now,
  }] }));
  await page.getByRole("button", { name: "Set Subject Lists to one half" }).click();
  await page.goto("/dashboard");
  const listWidget = page.locator('[data-section="subject-lists"]');
  const listChips = listWidget.locator('[data-subject-type="vocabulary"]');
  await expect(listChips).toHaveCount(2);
  const [shortListChip, longListChip] = await Promise.all([cardMetrics(listChips.nth(0)), cardMetrics(listChips.nth(1))]);
  expect(longListChip.fontSize).toBe(shortListChip.fontSize);
  expect(longListChip.height).toBeCloseTo(shortListChip.height, 0);
  expect(longListChip.width).toBeGreaterThan(shortListChip.width);
  expect(longListChip.width).toBeGreaterThan(longListChip.height);
  expect(longListChip.fits).toBe(true);
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

test("keeps the login controls inside the initial short mobile viewport", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "A single browser engine is enough for responsive layout geometry");
  await page.setViewportSize({ width: 320, height: 568 });
  await mockApp(page, false);
  await page.goto("/login");

  const token = page.getByRole("textbox", { name: "API token" });
  const submit = page.getByRole("button", { name: "Open Kakehashi" });

  await expect(token).toBeVisible();
  await expect(submit).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(token).toBeInViewport({ ratio: 1 });
  await expect(submit).toBeInViewport({ ratio: 1 });
});

test("keeps the desktop login split layout", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop layout assertion");
  await page.setViewportSize({ width: 1280, height: 720 });
  await mockApp(page, false);
  await page.goto("/login");

  const identity = page.locator('section[aria-labelledby="login-title"]');
  const access = page.getByRole("region", { name: "Connect your WaniKani account" });
  const [identityBox, accessBox, viewport] = await Promise.all([
    identity.boundingBox(),
    access.boundingBox(),
    page.viewportSize(),
  ]);

  expect(identityBox).not.toBeNull();
  expect(accessBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(identityBox!.x + identityBox!.width).toBeLessThanOrEqual(accessBox!.x);
  expect(
    await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)),
  ).toBeLessThanOrEqual(viewport!.height + 1);
});

test("loads every supported study mode and principal feature route", async ({ page }) => {
  await mockApp(page);
  const studyModes = ["recent-lessons", "random-test", "vocab-reading", "hiragana-meaning", "similar-kanji", "kana-to-kanji", "listening", "context-sentences", "text-analysis", "kanji-writing", "crossword", "kana-wordle", "custom-review", "custom-lessons", "subject-lists"];
  const routes = ["/dashboard", "/lessons", "/reviews", "/custom-vocabulary", "/custom-vocabulary/lessons", "/custom-vocabulary/reviews", "/study", ...studyModes.map((mode) => `/study/${mode}`), "/progress", "/progress/kanji", "/progress/wrapped/1", "/analytics", "/items", "/search", "/lists", "/subjects", "/subjects/2", "/subjects/2/constellation", "/settings", "/news", "/reader", "/epubs", "/manga", "/video", "/music", "/translator", "/community", "/community/new", "/feedback", "/feature-request", "/supporters"];
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

test("keeps custom vocabulary low on the dashboard and opens a word's subject details", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await mockApp(page);
  await page.goto("/dashboard");

  const defaultSectionOrder = await page.locator("main [data-section]").evaluateAll((sections) => sections.map((section) => section.getAttribute("data-section")));
  const subjectListsIndex = defaultSectionOrder.indexOf("subject-lists");
  expect(subjectListsIndex).toBeGreaterThanOrEqual(0);
  expect(defaultSectionOrder.indexOf("custom-vocabulary")).toBe(subjectListsIndex + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "custom vocabulary dashboard widget overflows at 320px").toBe(true);

  await page.goto("/custom-vocabulary");
  const wordLink = page.locator('a[href="/custom-vocabulary/words/conversation-douzo"]').first();
  await expect(wordLink).toBeVisible();
  await expect(wordLink).toContainText("どうぞ");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "custom vocabulary hub overflows at 320px").toBe(true);
  await wordLink.click();

  await expect(page).toHaveURL(/\/custom-vocabulary\/words\/conversation-douzo$/);
  const subjectHero = page.locator('header[data-type="vocabulary"]');
  await expect(subjectHero.getByRole("heading", { name: "Please", exact: true })).toBeVisible();
  await expect(subjectHero.getByText("どうぞ", { exact: true })).toBeVisible();

  await expect(page.getByRole("heading", { name: "Name", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mnemonic", exact: true })).toBeVisible();
  await expect(page.getByText(/Zo runs a bakery whose front door is made of dough/)).toBeVisible();

  await expect(page.getByRole("tab", { name: "Reading", exact: true })).toHaveCount(0);

  await page.getByRole("tab", { name: "Context", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Context sentences", exact: true })).toBeVisible();
  await expect(page.getByText("こちらの席へどうぞ。", { exact: true })).toBeVisible();
  await expect(page.getByText("Please take this seat.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "custom vocabulary subject details overflow at 320px").toBe(true);
});

test("keeps long custom vocabulary meanings compact without collisions", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop layout assertion");
  await page.setViewportSize({ width: 1120, height: 800 });
  await mockApp(page);
  await page.goto("/custom-vocabulary");

  const foodPack = page.getByRole("article", { name: "Food & Eating Out" });
  await foodPack.getByRole("button", { name: "Add Food & Eating Out pack" }).click();
  await expect(foodPack.getByText("Added", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const key = "kakehashi:custom-srs:v1:account:1";
    const state = JSON.parse(localStorage.getItem(key) || "null");
    const timestamp = new Date().toISOString();
    state.assignments["food-gochisousama"] = {
      ...state.assignments["food-gochisousama"],
      stage: 3,
      availableAt: timestamp,
      startedAt: timestamp,
      updatedAt: timestamp,
      card: {
        due: timestamp,
        state: "Review",
        stability: 1,
        difficulty: 5,
        elapsed_days: 0,
        scheduled_days: 1,
        learning_steps: 0,
        reps: 2,
        lapses: 0,
        last_review: timestamp,
      },
    };
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();

  await foodPack.getByText("Show 14 more words", { exact: true }).click();
  const longWord = page.locator('a[href="/custom-vocabulary/words/food-gochisousama"]');
  await expect(longWord).toBeVisible();
  await expect(longWord).toContainText("Apprentice III");

  const layout = await longWord.evaluate((link) => {
    const [character, meaning, navigation] = Array.from(link.children) as HTMLElement[];
    const linkRect = link.getBoundingClientRect();
    const characterRect = character.getBoundingClientRect();
    const meaningRect = meaning.getBoundingClientRect();
    const navigationRect = navigation.getBoundingClientRect();
    return {
      characterRight: characterRect.right,
      meaningLeft: meaningRect.left,
      meaningRight: meaningRect.right,
      navigationLeft: navigationRect.left,
      linkHeight: linkRect.height,
      meaningHeight: meaningRect.height,
    };
  });

  expect(layout.characterRight).toBeLessThanOrEqual(layout.meaningLeft);
  expect(layout.meaningRight).toBeLessThanOrEqual(layout.navigationLeft);
  expect(layout.meaningHeight).toBeLessThanOrEqual(layout.linkHeight);
  expect(layout.linkHeight).toBeLessThanOrEqual(64);
});

test("enrolls a kana pack and persists custom lessons and reviews without WaniKani mutations", async ({ page }) => {
  const waniKaniMutations: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && new URL(request.url()).pathname.startsWith("/api/wanikani/")) waniKaniMutations.push(request.url());
  });
  await mockApp(page);
  await page.goto("/custom-vocabulary");

  await expect(page.getByRole("heading", { name: "Custom vocabulary" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(49);
  await expect(page.getByRole("region", { name: "Kana & everyday language" })).toContainText("25 packs · 288 words");
  await expect(page.getByRole("region", { name: "Kanji by WaniKani level" })).toContainText("24 packs · 277 words");
  await page.getByRole("button", { name: "Add Conversation Glue pack" }).click();
  await expect(page.getByText("Added", { exact: true }).first()).toBeVisible();

  await page.getByRole("link", { name: /Start lessons/i }).click();
  for (let index = 0; index < 4; index += 1) await page.getByRole("button", { name: "Next lesson" }).click();
  await page.getByRole("button", { name: "Start lesson quiz" }).click();

  const answers = new Map([
    ["どうぞ", "please"],
    ["やっぱり", "as expected"],
    ["ゆっくり", "slowly"],
    ["じゃあ", "well then"],
    ["どうも", "thanks"],
  ]);
  let previousPrompt = "";
  for (let index = 0; index < answers.size; index += 1) {
    const promptElement = page.locator("#question-prompt");
    if (previousPrompt) await expect(promptElement).not.toHaveText(previousPrompt);
    const prompt = await promptElement.textContent();
    const answer = [...answers].find(([characters]) => prompt?.includes(characters))?.[1];
    expect(answer, `unexpected shuffled lesson prompt: ${prompt}`).toBeTruthy();
    await page.getByRole("textbox", { name: /Vocabulary (Meaning|Reading)/ }).fill(answer!);
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.getByText("Correct", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    previousPrompt = prompt ?? "";
  }
  await expect(page.getByRole("heading", { name: "Custom lessons complete" })).toBeVisible();

  const browserState = await page.evaluate(() => {
    const key = "kakehashi:custom-srs:v1:account:1";
    const state = JSON.parse(localStorage.getItem(key) || "null");
    state.assignments["conversation-douzo"].availableAt = "2020-01-01T00:00:00.000Z";
    state.assignments["conversation-douzo"].card.due = "2020-01-01T00:00:00.000Z";
    localStorage.setItem(key, JSON.stringify(state));
    return state;
  });
  expect(browserState.enrolledPackIds).toContain("conversation-glue");
  expect(Object.values(browserState.assignments).filter((assignment) => (assignment as { stage: number }).stage === 1)).toHaveLength(5);

  await page.goto("/custom-vocabulary/reviews");
  await expect(page.getByText("どうぞ", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Vocabulary Meaning" }).fill("please");
  await page.getByRole("button", { name: "Check" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: "Custom reviews complete" })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("kakehashi:custom-srs:v1:account:1") || "null").assignments["conversation-douzo"].stage)).toBe(2);
  expect(waniKaniMutations).toEqual([]);
});

test("keeps an idle review question within the desktop viewport", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop viewport assertion");
  await page.setViewportSize({ width: 1512, height: 864 });
  await mockApp(page);
  await page.goto("/study/custom-review?subjectIds=3&start=1");

  await expect(page.getByRole("textbox", { name: /Vocabulary (Meaning|Reading)/ })).toBeVisible();
  await page.locator('main[data-study-session="active"]').evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });
  const viewport = await page.evaluate(() => ({
    height: window.innerHeight,
    scrollHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
  }));

  expect(viewport.scrollHeight, "idle review questions should not scroll").toBeLessThanOrEqual(viewport.height);
});

test("smoothly restores the review progress bar after advancing from subject details", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop scroll assertion");
  await page.setViewportSize({ width: 1512, height: 864 });
  await mockApp(page);
  await page.goto("/study/custom-review?subjectIds=3&start=1");

  const answer = page.getByRole("textbox", { name: /Vocabulary (Meaning|Reading)/ });
  await expect(answer).toBeVisible();
  await answer.fill((await answer.getAttribute("aria-label"))?.includes("Reading") ? "ちがう" : "wrong");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await page.getByRole("button", { name: "Show subject details" }).click();
  await expect(page.getByRole("button", { name: "Hide subject details" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) > window.innerHeight)).toBe(true);
  await page.evaluate(() => window.scrollTo({ top: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight), behavior: "auto" }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  await page.evaluate(() => {
    const trackedWindow = window as typeof window & { __reviewScrollCalls?: ScrollToOptions[] };
    const originalScrollTo = window.scrollTo;
    trackedWindow.__reviewScrollCalls = [];
    window.scrollTo = ((...args: Parameters<typeof window.scrollTo>) => {
      if (typeof args[0] === "object") trackedWindow.__reviewScrollCalls?.push(args[0]);
      Reflect.apply(originalScrollTo, window, args);
    }) as typeof window.scrollTo;
  });

  await page.getByRole("button", { name: "Next", exact: true }).click();

  await expect.poll(() => page.evaluate(() => (window as typeof window & { __reviewScrollCalls?: ScrollToOptions[] }).__reviewScrollCalls ?? [])).toContainEqual({ top: 0, behavior: "smooth" });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  const progressBounds = await page.getByRole("progressbar").boundingBox();
  expect(progressBounds?.y).toBeGreaterThanOrEqual(0);
  expect((progressBounds?.y ?? 0) + (progressBounds?.height ?? 0)).toBeLessThanOrEqual(864);
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

test("keeps a custom vocabulary lesson session labelled and keyboard operable", async ({ page }) => {
  await mockApp(page);
  await page.goto("/custom-vocabulary");
  expect(await seriousAccessibilityViolations(page), "custom vocabulary hub has serious accessibility violations").toEqual([]);
  await page.getByRole("button", { name: "Add Conversation Glue pack" }).click();
  await page.getByRole("link", { name: /Start lessons/i }).click();

  await expect(page.getByRole("heading", { name: "Please", exact: true })).toBeVisible();
  const lessonColors = await page.getByRole("heading", { name: "Please", exact: true }).evaluate((heading) => {
    const vocabularyProbe = document.createElement("i");
    vocabularyProbe.style.backgroundColor = "var(--color-vocabulary)";
    document.body.append(vocabularyProbe);
    let lessonSurface: Element | null = heading;
    while (lessonSurface && getComputedStyle(lessonSurface).backgroundColor === "rgba(0, 0, 0, 0)") lessonSurface = lessonSurface.parentElement;
    const colors = {
      lesson: lessonSurface ? getComputedStyle(lessonSurface).backgroundColor : "",
      vocabulary: getComputedStyle(vocabularyProbe).backgroundColor,
    };
    vocabularyProbe.remove();
    return colors;
  });
  expect(lessonColors.lesson, `Custom lesson color: ${JSON.stringify(lessonColors)}`).toBe(lessonColors.vocabulary);
  expect(await seriousAccessibilityViolations(page), "custom lesson teaching has serious accessibility violations").toEqual([]);
  const lessonNavigation = page.getByRole("navigation", { name: "Custom lesson navigation" });
  const batchItemMetrics = await lessonNavigation.locator('button[aria-label^="Lesson "]').evaluateAll((buttons) => buttons.map((button) => {
    const content = button.firstElementChild;
    const buttonBounds = button.getBoundingClientRect();
    const contentBounds = content?.getBoundingClientRect();
    const style = getComputedStyle(button);
    return {
      label: button.getAttribute("aria-label"),
      fits: button.scrollWidth <= button.clientWidth,
      leftInset: contentBounds ? contentBounds.left - buttonBounds.left : 0,
      rightInset: contentBounds ? buttonBounds.right - contentBounds.right : 0,
      paddingLeft: Number.parseFloat(style.paddingLeft),
      paddingRight: Number.parseFloat(style.paddingRight),
    };
  }));
  for (const metric of batchItemMetrics) {
    expect.soft(metric.fits, `${metric.label} content should not be clipped`).toBe(true);
    expect.soft(metric.leftInset, `${metric.label} should retain its left padding`).toBeGreaterThanOrEqual(metric.paddingLeft - 1);
    expect.soft(metric.rightInset, `${metric.label} should retain its right padding`).toBeGreaterThanOrEqual(metric.paddingRight - 1);
  }
  await expect(lessonNavigation.getByRole("button", { name: "Previous lesson" })).toBeDisabled();
  const nextLessonButton = lessonNavigation.getByRole("button", { name: "Next lesson" });
  await expect(nextLessonButton).toBeVisible();

  await nextLessonButton.press("Enter");
  await expect(page.getByRole("progressbar", { name: "Lesson progress" })).toHaveAttribute("aria-valuenow", "2");
  const meaningTabAfterLessonArrow = page.getByRole("tab", { name: "Meaning", exact: true });
  await expect(meaningTabAfterLessonArrow).not.toBeFocused();
  expect(await meaningTabAfterLessonArrow.evaluate((tab) => {
    const style = getComputedStyle(tab);
    return (style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0) || style.boxShadow !== "none";
  }), "lesson navigation arrows should not paint a focus box around the Meaning tab").toBe(false);
  await lessonNavigation.getByRole("button", { name: "Previous lesson" }).click();
  await expect(page.getByRole("progressbar", { name: "Lesson progress" })).toHaveAttribute("aria-valuenow", "1");

  await lessonNavigation.evaluate((navigation) => navigation.scrollIntoView({ block: "center" }));
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const scrollPositionBeforeTabArrow = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("ArrowRight");
  const contextTab = page.getByRole("tab", { name: "Context", exact: true });
  await expect(contextTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: /Anime/i })).toBeVisible();
  await expect(page.getByText("日本史をアニメで勉強します。", { exact: true })).toBeVisible();
  await page.evaluate(() => new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))));
  const scrollPositionAfterTabArrow = await page.evaluate(() => window.scrollY);
  expect(Math.abs(scrollPositionAfterTabArrow - scrollPositionBeforeTabArrow), "lesson tab arrow should not scroll the page").toBeLessThanOrEqual(1);
  await page.keyboard.press("ArrowLeft");
  const meaningTab = page.getByRole("tab", { name: "Meaning", exact: true });
  await expect(meaningTab).toHaveAttribute("aria-selected", "true");
  await meaningTab.focus();
  await meaningTab.press("ArrowRight");
  await expect(contextTab).toBeFocused();
  await contextTab.press("ArrowLeft");
  await expect(meaningTab).toBeFocused();
  const focusedTabDecoration = await meaningTab.evaluate((tab) => {
    const style = getComputedStyle(tab);
    const indicator = getComputedStyle(tab, "::after");
    return {
      hasBoxOutline: style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0,
      focusUnderlineHeight: Number.parseFloat(indicator.height),
    };
  });
  expect(focusedTabDecoration.hasBoxOutline, "tab arrows should not paint a blue focus box").toBe(false);
  expect(focusedTabDecoration.focusUnderlineHeight, "tab arrows should retain a visible subject underline").toBeCloseTo(4.8, 1);

  for (let index = 0; index < 4; index += 1) await page.getByRole("button", { name: "Next lesson" }).click();
  await page.getByRole("button", { name: "Start lesson quiz" }).click();
  expect(await seriousAccessibilityViolations(page), "custom lesson quiz has serious accessibility violations").toEqual([]);
  const answer = page.getByRole("textbox", { name: "Vocabulary Meaning" });
  const promptText = await page.locator("#question-prompt").textContent();
  const promptAnswer = [
    ["どうぞ", "please"],
    ["やっぱり", "as expected"],
    ["ゆっくり", "slowly"],
    ["じゃあ", "well then"],
    ["ありがとう", "thanks"],
  ].find(([characters]) => promptText?.includes(characters))?.[1];
  expect(promptAnswer, `unexpected shuffled lesson prompt: ${promptText}`).toBeTruthy();
  await answer.fill(promptAnswer!);
  await answer.press("Enter");

  await expect(page.getByRole("status")).toContainText("Correct");
  await expect(page.getByRole("button", { name: "Next" })).toBeFocused();
});

test("uses the standard review frame for a custom vocabulary lesson quiz", async ({ page }) => {
  await mockApp(page);
  await page.goto("/study/custom-review?subjectIds=3&start=1");
  await expect(page.getByRole("textbox", { name: /Vocabulary (Meaning|Reading)/ })).toBeVisible();
  const standardFrame = await quizFrameClasses(page);

  await page.goto("/custom-vocabulary");
  await page.getByRole("button", { name: "Add Conversation Glue pack" }).click();
  await page.getByRole("link", { name: /Start lessons/i }).click();

  await expect(page.getByRole("link", { name: "Pause", exact: true })).toHaveCount(0);

  for (let index = 0; index < 4; index += 1) await page.getByRole("button", { name: "Next lesson" }).click();
  await page.getByRole("button", { name: "Start lesson quiz" }).click();

  await expect(page.locator('section[data-study-session="active"]')).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeHidden();
  await expect(page.getByRole("textbox", { name: /Vocabulary (Meaning|Reading)/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Pause and exit session" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Pause", exact: true })).toHaveCount(0);
  expect(await quizFrameClasses(page)).toEqual(standardFrame);
});

test("applies live navigation preferences and keeps main study destinations disabled", async ({ page }, testInfo) => {
  await mockApp(page);
  await page.goto("/settings");
  const analyticsToggle = page.getByRole("checkbox", { name: /Show analytics/i });
  await analyticsToggle.press("Space");
  const moreButton = testInfo.project.name.includes("mobile") ? page.getByRole("button", { name: "More", exact: true }) : page.getByRole("button", { name: "More destinations" });
  await moreButton.click();
  const destinations = page.getByRole("navigation", { name: "All destinations" });
  await expect(destinations.getByRole("link", { name: "Analytics" })).toHaveCount(0);
  await expect(destinations.getByRole("button", { name: "Lessons, coming soon" })).toBeDisabled();
  await expect(destinations.getByRole("button", { name: "Reviews, coming soon" })).toBeDisabled();
  await expect(destinations.getByRole("link", { name: "Custom vocabulary" })).toHaveAttribute("href", "/custom-vocabulary");
  await expect(destinations.getByRole("link", { name: "Extra study" })).toHaveAttribute("href", "/study");
  await page.getByRole("button", { name: "Close More menu" }).first().click({ position: { x: 4, y: 4 } });
  await expect(moreButton).toBeFocused();
  await analyticsToggle.press("Space");
});

test("customizes and persists the desktop navbar without hiding destinations", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop navbar assertion");
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockApp(page);
  await page.goto("/settings");

  const appbar = page.getByRole("banner").locator(":scope > div");
  const mainNavigation = page.getByRole("navigation", { name: "Main navigation" });
  const newsTabToggle = page.getByRole("checkbox", { name: /^News\b.*NHK Easier/ });
  const itemsTabToggle = page.getByRole("checkbox", { name: /^Items\b.*Browse radicals/ });
  const analyticsTabToggle = page.getByRole("checkbox", { name: /^Analytics\b.*Detailed statistics/ });
  const booksTabToggle = page.getByRole("checkbox", { name: /^Books\b.*EPUB library/ });
  const videoTabToggle = page.getByRole("checkbox", { name: /^Video\b.*Local video/ });
  await expect(newsTabToggle).toBeVisible();
  await expect(mainNavigation.getByRole("link")).toHaveText(["Home", "Level", "News", "Video", "Manga", "Songs"]);
  for (const toggle of [itemsTabToggle, analyticsTabToggle, booksTabToggle, videoTabToggle]) await expect(toggle).toBeEnabled();

  const banner = page.getByRole("banner");
  await videoTabToggle.scrollIntoViewIfNeeded();
  await expect(banner).toHaveAttribute("data-floating", "true");
  const settleAppbar = () => appbar.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
  });
  for (const width of [1185, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await videoTabToggle.press("Space");
    await expect(mainNavigation.getByRole("link", { name: "Video" })).toHaveCount(0);
    await settleAppbar();
    const fiveTabBar = await appbar.boundingBox();
    await videoTabToggle.press("Space");
    await expect(mainNavigation.getByRole("link", { name: "Video" })).toBeVisible();
    await settleAppbar();
    const sixTabBar = await appbar.boundingBox();
    expect(fiveTabBar).not.toBeNull();
    expect(sixTabBar).not.toBeNull();
    expect(sixTabBar!.width, `adding the sixth tab should not expand the app bar at ${width}px`).toBeCloseTo(fiveTabBar!.width, 0);
  }

  await watchNavbarItemMotion(mainNavigation, "/items");
  await itemsTabToggle.press("Space");
  await expect(mainNavigation).toHaveAttribute("data-motion-observed", "true");
  for (const toggle of [analyticsTabToggle, booksTabToggle]) await toggle.press("Space");
  await expect(mainNavigation.getByRole("link")).toHaveText(["Home", "Level", "Items", "Analytics", "News", "Books", "Video", "Manga", "Songs"]);

  const expectNavbarFits = async (width: number) => {
    await page.setViewportSize({ width, height: 720 });
    await expect(banner).toHaveAttribute("data-floating", "true");
    await settleAppbar();
    const [appbarBox, identityBox, navigationBox, searchBox, moreBox] = await Promise.all([
      appbar.boundingBox(),
      page.getByRole("link", { name: /^Kakehashi home/ }).boundingBox(),
      mainNavigation.boundingBox(),
      page.getByRole("link", { name: "Search subjects" }).boundingBox(),
      page.getByRole("button", { name: "More destinations" }).boundingBox(),
    ]);
    expect(appbarBox).not.toBeNull();
    expect(identityBox).not.toBeNull();
    expect(navigationBox).not.toBeNull();
    expect(searchBox).not.toBeNull();
    expect(moreBox).not.toBeNull();
    expect(identityBox!.x, `identity should stay inside the app bar at ${width}px`).toBeGreaterThanOrEqual(appbarBox!.x - 1);
    expect(navigationBox!.x, `navbar should clear the identity at ${width}px`).toBeGreaterThanOrEqual(identityBox!.x + identityBox!.width - 1);
    expect(navigationBox!.x + navigationBox!.width, `navbar should clear the actions at ${width}px`).toBeLessThanOrEqual(searchBox!.x + 1);
    expect(moreBox!.x + moreBox!.width, `actions should stay inside the app bar at ${width}px`).toBeLessThanOrEqual(appbarBox!.x + appbarBox!.width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `navbar should not overflow at ${width}px`).toBe(true);
  };
  for (const width of [864, 928, 1024, 1184, 1185, 1280, 1312, 1313, 1376, 1377, 1408, 1409, 1440]) await expectNavbarFits(width);

  await page.getByRole("radio", { name: /^Extra large\b/ }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.fontSize)).toBe("120%");
  for (const width of [864, 1185, 1280, 1281, 1408, 1409, 1440]) await expectNavbarFits(width);

  await watchNavbarItemMotion(mainNavigation, "/news");
  await newsTabToggle.press("Space");
  await expect(mainNavigation).toHaveAttribute("data-motion-observed", "true");
  await expect(mainNavigation.getByRole("link", { name: "News" })).toHaveCount(0);

  await page.getByRole("button", { name: "More destinations" }).click();
  await expect(page.getByRole("navigation", { name: "All destinations" }).getByRole("link", { name: "News" })).toBeVisible();

  await page.reload();
  await expect(mainNavigation.getByRole("link")).toHaveText(["Home", "Level", "Items", "Analytics", "Books", "Video", "Manga", "Songs"]);
});

test("returns the desktop navbar from floating without an inward flicker", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop navbar assertion");
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockApp(page);
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Desktop navbar tabs" })).toBeVisible();

  const banner = page.getByRole("banner");
  const appbar = banner.locator(":scope > div");
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(80);
  await expect(banner).toHaveAttribute("data-floating", "true");
  await appbar.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
  });

  const frames = await page.evaluate(async () => {
    const header = document.querySelector<HTMLElement>("header");
    const bar = header?.firstElementChild as HTMLElement | null;
    if (!header || !bar) throw new Error("Navbar geometry is unavailable");

    const read = () => bar.getBoundingClientRect().width;

    return await new Promise<number[]>((resolveFrames) => {
      const samples = [read()];
      const observer = new MutationObserver(() => {
        if (header.dataset.floating === "true") return;
        observer.disconnect();
        const stopAt = performance.now() + 500;
        const sample = () => {
          samples.push(read());
          if (performance.now() < stopAt) requestAnimationFrame(sample);
          else resolveFrames(samples);
        };
        requestAnimationFrame(sample);
      });
      observer.observe(header, { attributes: true, attributeFilter: ["data-floating"] });
      window.scrollTo(0, 0);
    });
  });

  expect(frames.at(-1)!).toBeGreaterThan(frames[0] + 40);
  for (let index = 1; index < frames.length; index += 1) {
    expect(frames[index], `bar moved inward at frame ${index}`).toBeGreaterThanOrEqual(frames[index - 1] - 0.75);
  }
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
  const routes = ["/dashboard", "/reviews", "/custom-vocabulary", "/custom-vocabulary/reviews", "/study", "/study/random-test", "/study/crossword", "/progress", "/subjects/2/constellation", "/reader", "/news", "/community", "/settings"];
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of routes) {
      await page.goto(path);
      if (path === "/reviews") {
        await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeHidden();
        await expect(page.getByRole("link", { name: "Pause" }).or(page.getByRole("button", { name: "Continue Session" })).first()).toBeVisible();
      } else if (path === "/custom-vocabulary/reviews") {
        await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeHidden();
        await expect(page.getByRole("heading", { name: "No custom reviews waiting" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Vocabulary Packs" })).toBeVisible();
      } else if (path === "/subjects/2/constellation") {
        await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeHidden();
      } else {
        await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path} overflows at ${width}px`).toBe(true);
    }
  }
});

test("keeps the JLPT hub, focused quiz, and results usable on a narrow phone", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("kakehashi-web-theme", "dark"));
  await mockApp(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/jlpt");

  await expect(page.getByRole("heading", { name: "JLPT Quiz" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const selectedLevel = page.getByRole("radio", { name: "N5" });
  await expect(selectedLevel).toBeChecked();
  const selectedContrast = await selectedLevel.evaluate((element) => {
    type Color = [number, number, number, number];
    const parse = (value: string): Color => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d")!;
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
      return [red, green, blue, alpha / 255];
    };
    const composite = (foreground: Color, background: Color): Color => {
      const alpha = foreground[3] + background[3] * (1 - foreground[3]);
      return [
        (foreground[0] * foreground[3] + background[0] * background[3] * (1 - foreground[3])) / alpha,
        (foreground[1] * foreground[3] + background[1] * background[3] * (1 - foreground[3])) / alpha,
        (foreground[2] * foreground[3] + background[2] * background[3] * (1 - foreground[3])) / alpha,
        alpha,
      ];
    };
    const luminance = (color: Color) => color
      .slice(0, 3)
      .map((channel) => channel / 255)
      .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    const ratio = (first: Color, second: Color) => {
      const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
      return (lighter + 0.05) / (darker + 0.05);
    };
    const style = getComputedStyle(element);
    const primary = getComputedStyle(element.querySelector("strong")!);
    const secondary = getComputedStyle(element.querySelector("span")!);
    const background = parse(style.backgroundColor);
    return {
      background: style.backgroundColor,
      primary: primary.color,
      secondary: secondary.color,
      primaryRatio: ratio(background, composite(parse(primary.color), background)),
      secondaryRatio: ratio(background, composite(parse(secondary.color), background)),
    };
  });
  expect(
    Math.min(selectedContrast.primaryRatio, selectedContrast.secondaryRatio),
    `Selected JLPT level contrast: ${JSON.stringify(selectedContrast)}`,
  ).toBeGreaterThanOrEqual(4.5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "JLPT hub should not overflow").toBe(true);

  await page.getByRole("button", { name: "Start quick quiz" }).click();
  await expect(page.getByText(/Question 1 of 10/)).toBeVisible();
  await expect(page.getByRole("group", { name: "Answer choices" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Check answer" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "JLPT quiz should not overflow").toBe(true);

  for (let questionNumber = 1; questionNumber <= 10; questionNumber += 1) {
    const choices = page.getByRole("group", { name: "Answer choices" }).getByRole("button");
    const composition = page.getByRole("list", { name: "Your sentence order" });
    if (await composition.isVisible().catch(() => false)) {
      for (let optionIndex = 0; optionIndex < await choices.count(); optionIndex += 1) await choices.nth(optionIndex).click();
    } else {
      await choices.first().click();
    }
    await page.getByRole("button", { name: "Check answer" }).click();
    await page.getByRole("button", { name: questionNumber === 10 ? "See results" : "Next question" }).click();
  }

  await expect(page.getByRole("heading", { name: "Quiz results" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What to do next" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Missed question review" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "JLPT results should not overflow").toBe(true);
});

test("reorders dashboard previews and keeps every optional section responsive", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop drag-and-drop assertion");
  await mockApp(page);
  await page.goto("/settings");

  const visibleSections = page.getByRole("list", { name: "Visible dashboard sections" });
  const visibleWidgets = visibleSections.locator(":scope > li");
  await expect(visibleWidgets).toHaveCount(18);
  expect(await visibleWidgets.evaluateAll((widgets) => widgets.map((widget) => widget.getAttribute("data-editor-section")))).toEqual([
    "daily-study", "level", "extra-study", "forecast", "recent-mistakes", "study-pulse", "review-heatmap", "srs", "study-streak", "level-timing", "today-study", "subject-lists", "custom-vocabulary", "incomplete-levels", "recent-unlocks", "critical-items", "burned-items", "study-time",
  ]);
  expect(await visibleWidgets.evaluateAll((widgets) => widgets.map((widget) => Number(widget.getAttribute("data-editor-width"))))).toEqual([
    12, 12, 12, 12, 6, 6, 12, 8, 4, 8, 4, 4, 12, 8, 6, 6, 6, 6,
  ]);
  expect(await visibleWidgets.evaluateAll((widgets) => widgets.every((widget) => !widget.hasAttribute("data-editor-row-start")))).toBe(true);
  await expect(page.locator("[data-widget-preview]")).toHaveCount(18);
  const longVocabularyPreviews = page.locator('[data-widget-preview] [data-subject-type="vocabulary"][data-long="true"]');
  await expect(longVocabularyPreviews).toHaveCount(3);
  expect(await longVocabularyPreviews.evaluateAll((glyphs) => glyphs.every((glyph) => glyph.scrollWidth <= glyph.clientWidth && glyph.scrollHeight <= glyph.clientHeight)), "long vocabulary should fit inside every subject preview tile").toBe(true);

  await visibleSections.locator('[data-editor-section="recent-mistakes"]').getByRole("button", { name: "Hide Recent Mistakes" }).click();
  await expect(visibleWidgets).toHaveCount(17);
  await page.locator('[data-available-section="recent-mistakes"]').getByRole("button", { name: "Add Recent Mistakes" }).click();
  await expect(visibleWidgets).toHaveCount(18);
  await expect(visibleWidgets.last()).toContainText("Recent Mistakes");

  const levelProgress = visibleSections.locator('[data-editor-section="level"]');
  await levelProgress.dragTo(visibleWidgets.first());
  await expect(visibleWidgets.first()).toContainText("Level Progress");
  await page.getByRole("button", { name: "Set Active Item Spread to one half" }).click();

  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/settings");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `settings editor overflows at ${width}px`).toBe(true);
    await expect(page.getByRole("button", { name: "Move Lessons & Reviews down" })).toBeVisible();

    await page.goto("/dashboard");
    await expect(page.locator("main [data-section]")).toHaveCount(18);
    await expect(page.locator('[data-section="srs"]')).toHaveAttribute("data-layout-width", "6");
    const customVocabulary = page.locator('[data-section="custom-vocabulary"]');
    await expect(customVocabulary.getByRole("heading", { name: "Custom vocabulary" })).toBeVisible();
    await expect(customVocabulary.getByRole("link", { name: "Explore packs" })).toHaveAttribute("href", "/custom-vocabulary");
    await expect(page.getByRole("heading", { name: "Review heatmap" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Study time" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `expanded dashboard overflows at ${width}px`).toBe(true);
  }
});

test("keeps review stats readable and compact at one-third width", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop widget geometry assertion");
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.addInitScript(() => window.localStorage.setItem("kakehashi-web:settings:webtester:v1", JSON.stringify({
    workspace: { dashboardOrder: ["study-pulse"], hiddenDashboard: [], dashboardWidths: { "study-pulse": 4 }, dashboardRowStarts: [] },
  })));
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
  await page.getByLabel("Anki mode").selectOption("both");
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
  await expect(page.getByRole("button", { name: "1 · Wrong" })).toBeVisible();
  await expect(page.getByRole("button", { name: "2 · Correct" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Anki grading controls should not overflow the viewport").toBe(true);

  await page.goto("/epubs");
  await expect(page.getByText("20 minute daily goal")).toBeVisible();

  await page.goto("/study/listening");
  await expect(page.getByRole("button", { name: /Anime sources: All 2 anime/i })).toBeVisible();
});

test("uses the full revealed Anki card as the buttonless gesture surface", async ({ page }) => {
  await mockApp(page);
  await page.goto("/settings");
  await page.getByLabel("Anki mode").selectOption("both");
  await page.getByText("Buttonless Anki mode", { exact: true }).click();

  await page.goto("/reviews");
  await page.getByRole("button", { name: "Reveal Answer" }).click();
  const card = page.getByRole("region", { name: "Anki answer" });
  await expect(card.getByRole("button", { name: "Tap left: mark wrong" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Tap right: mark correct" })).toBeVisible();

  await card.click({ position: { x: 12, y: 12 } });
  await expect(page.getByText("Incorrect", { exact: true })).toBeVisible();
});

test("preserves listening scenes and answers inside a desktop viewport with or without review extras", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop viewport geometry assertion");
  await page.setViewportSize({ width: 1503, height: 840 });
  await mockApp(page);
  await page.route("**/api/study/vocabulary-frequency", (route) => fulfillJson(route, { result: { provider: "jiten", frequencyRank: 6_961, wordId: 6, readingIndex: 0, matchedText: "日本史", matchedReading: "にほんし", sourceUrl: "https://jiten.moe/search?query=%E6%97%A5%E6%9C%AC%E5%8F%B2" } }));

  const extras = [
    "Show item level & SRS stage",
    "Show vocabulary frequency",
    "Vocabulary context sentence hints",
    "Review search button",
  ];
  const scenarios = [
    {
      extrasEnabled: false,
      kind: "listening-meaning",
      prompt: "潮＿＿だ",
      sentence: "潮日本史だ",
      translation: "It is the tide.",
      sourceTitle: "Frieren Beyond Journey's End",
      acceptedAnswer: "Making Allowances",
      choices: ["Making Allowances", "To Advance Something", "Wakame", "To Throw"],
      minimumSceneHeight: 260,
    },
    {
      extrasEnabled: true,
      kind: "listening-characters",
      prompt: "（報道の音声）先ほど＿＿に大雨特別警報が発表されました",
      sentence: "（報道の音声）先ほど日本史に大雨特別警報が発表されました",
      translation: "A special heavy-rain warning was just announced.",
      sourceTitle: "Weathering with You",
      acceptedAnswer: "日本史",
      choices: ["日本史", "一つ", "二人", "これ"],
      minimumSceneHeight: 220,
    },
  ];

  for (const scenario of scenarios) {
    await page.goto("/settings");
    for (const label of extras) {
      const checkbox = page.getByRole("checkbox", { name: label });
      if (await checkbox.isChecked() !== scenario.extrasEnabled) await page.getByText(label, { exact: true }).click();
    }

    await page.evaluate(({ timestamp, fixture }) => {
      window.localStorage.setItem("kakehashi:study:v1:account:1:session:listening", JSON.stringify({
        version: 1,
        id: `listening-viewport-${fixture.extrasEnabled ? "extras" : "default"}`,
        mode: "listening",
        createdAt: timestamp,
        updatedAt: timestamp,
        currentIndex: 0,
        questions: [{
          id: "6:characters",
          subjectId: 6,
          subjectType: "vocabulary",
          kind: fixture.kind,
          prompt: fixture.prompt,
          promptLabel: `Vocabulary · ${fixture.sourceTitle}`,
          acceptedAnswers: [fixture.acceptedAnswer],
          displayAnswer: fixture.acceptedAnswer,
          choices: fixture.choices,
          characters: "日本史",
          sentence: { ja: fixture.sentence, en: fixture.translation, masked: fixture.prompt },
          audioUrl: "data:audio/mpeg;base64,",
          imageUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1600' height='900' viewBox='0 0 1600 900'%3E%3Crect width='1600' height='900' fill='%23777'/%3E%3C/svg%3E",
          sourceTitle: fixture.sourceTitle,
          autoPlayAudio: false,
          stopAfterAnswer: false,
        }],
        answers: [],
        complete: false,
      }));
    }, { timestamp: now, fixture: scenario });

    await page.goto("/study/listening");
    await page.getByRole("button", { name: /Resume saved session/ }).click();
    const choices = page.getByRole("group", { name: "Answer choices" });
    const scene = page.getByRole("img", { name: `Scene from ${scenario.sourceTitle}` });
    const search = page.getByRole("link", { name: "Search this item" });
    await expect(choices).toBeInViewport({ ratio: 1 });
    await expect(scene).toBeVisible();
    if (scenario.extrasEnabled) await expect(search).toBeInViewport({ ratio: 1 });
    else await expect(search).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Pause and exit session" })).toBeInViewport({ ratio: 1 });

    const layout = await choices.evaluate((element) => ({
      answerBottom: element.getBoundingClientRect().bottom,
      pageHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
    }));
    const sceneBounds = await scene.boundingBox();
    const audioBounds = await page.getByRole("button", { name: /Replay listening clip/ }).boundingBox();
    const cardBounds = await scene.evaluate((element) => {
      const bounds = element.closest("[data-type]")!.getBoundingClientRect();
      return { top: bounds.top, bottom: bounds.bottom };
    });
    expect(sceneBounds).not.toBeNull();
    expect(audioBounds).not.toBeNull();
    expect(sceneBounds!.width / sceneBounds!.height, "the listening scene should retain its 16:9 frame").toBeCloseTo(16 / 9, 1);
    expect(sceneBounds!.height, "the listening scene should use the available vertical space").toBeGreaterThanOrEqual(scenario.minimumSceneHeight);
    expect(sceneBounds!.y, "the scene should stay below the quiz toolbar").toBeGreaterThanOrEqual(cardBounds.top - 1);
    expect(audioBounds!.y + audioBounds!.height, "the prompt should not overlap the answer area").toBeLessThanOrEqual(cardBounds.bottom + 1);
    expect(layout.answerBottom, "the full answer grid should stay above the fold").toBeLessThanOrEqual(layout.viewportHeight + 1);
    expect(layout.pageHeight, "the listening question should not require page scrolling").toBeLessThanOrEqual(layout.viewportHeight + 1);

    if (!scenario.extrasEnabled) {
      await page.getByRole("button", { name: new RegExp(scenario.acceptedAnswer) }).click();
      const highlightedTerm = page.locator("mark", { hasText: "日本史" });
      await expect(highlightedTerm).toBeVisible();
      const highlightBackground = await highlightedTerm.evaluate((element) => getComputedStyle(element).backgroundColor);
      expect(highlightBackground, "the restored Japanese term should have a restrained custom highlight").not.toBe("rgba(0, 0, 0, 0)");
      expect(highlightBackground, "the restored Japanese term should not use the browser's default yellow mark").not.toBe("rgb(255, 255, 0)");
      await expect(choices).toBeInViewport({ ratio: 1 });
      const answeredLayout = await page.evaluate(() => ({ pageHeight: document.documentElement.scrollHeight, viewportHeight: window.innerHeight }));
      expect(answeredLayout.pageHeight, "answer feedback should remain inside the viewport").toBeLessThanOrEqual(answeredLayout.viewportHeight + 1);
    }
  }
});

test("keeps listening prompts above answers when subject details expand", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop viewport geometry assertion");
  await page.setViewportSize({ width: 1503, height: 840 });
  await mockApp(page);
  await page.goto("/settings");
  const pauseOnCorrect = page.getByRole("checkbox", { name: "Pause on correct answer" });
  if (!await pauseOnCorrect.isChecked()) await page.getByText("Pause on correct answer", { exact: true }).click();
  await page.evaluate((timestamp) => {
    window.localStorage.setItem("kakehashi:study:v1:account:1:session:listening", JSON.stringify({
      version: 1,
      id: "listening-expanded-details",
      mode: "listening",
      createdAt: timestamp,
      updatedAt: timestamp,
      currentIndex: 0,
      questions: [{
        id: "6:characters",
        subjectId: 6,
        subjectType: "vocabulary",
        kind: "listening-meaning",
        prompt: "潮＿＿だ",
        promptLabel: "Vocabulary · Frieren Beyond Journey's End",
        acceptedAnswers: ["Making Allowances"],
        displayAnswer: "Making Allowances",
        choices: ["Making Allowances", "To Advance Something", "Wakame", "To Throw"],
        characters: "日本史",
        sentence: { ja: "潮日本史だ", en: "It is the tide.", masked: "潮＿＿だ" },
        audioUrl: "data:audio/mpeg;base64,",
        imageUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1600' height='900' viewBox='0 0 1600 900'%3E%3Crect width='1600' height='900' fill='%23777'/%3E%3C/svg%3E",
        sourceTitle: "Frieren Beyond Journey's End",
        autoPlayAudio: false,
        stopAfterAnswer: false,
      }],
      answers: [],
      complete: false,
    }));
  }, now);

  await page.goto("/study/listening");
  await page.getByRole("button", { name: /Resume saved session/ }).click();
  const scene = page.getByRole("img", { name: "Scene from Frieren Beyond Journey's End" });
  const sceneHeightBeforeDetails = (await scene.boundingBox())!.height;
  await page.getByRole("button", { name: "Making Allowances" }).click();
  await page.getByRole("button", { name: "Show subject details" }).click();
  await expect(page.getByRole("button", { name: "Hide subject details" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Subject details" })).toBeVisible();

  const expandedLayout = await scene.evaluate((element) => {
    const questionCard = element.closest("[data-type]")!;
    const answerArea = questionCard.nextElementSibling!;
    const choices = answerArea.querySelector('[role="group"][aria-label="Answer choices"]')!;
    const audioButton = questionCard.querySelector("button[aria-label^='Replay listening clip']")!;
    const details = answerArea.querySelector("#study-item-details")!;
    const shell = questionCard.closest("section")!;
    const questionBounds = questionCard.getBoundingClientRect();
    const choiceBounds = choices.getBoundingClientRect();
    const audioBounds = audioButton.getBoundingClientRect();
    const detailsBounds = details.getBoundingClientRect();
    return {
      detailsOpen: shell.getAttribute("data-details-open"),
      sceneHeight: element.getBoundingClientRect().height,
      questionBottom: questionBounds.bottom,
      choiceTop: choiceBounds.top,
      choiceBottom: choiceBounds.bottom,
      audioBottom: audioBounds.bottom,
      detailsTop: detailsBounds.top,
      pageHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
    };
  });
  expect(expandedLayout.detailsOpen).toBe("true");
  expect(expandedLayout.sceneHeight, "opening details should not collapse the listening scene").toBeGreaterThanOrEqual(sceneHeightBeforeDetails - 1);
  expect(expandedLayout.questionBottom, "the listening prompt should end before its answers").toBeLessThanOrEqual(expandedLayout.choiceTop + 1);
  expect(expandedLayout.audioBottom, "listening controls should not overlap the answer choices").toBeLessThanOrEqual(expandedLayout.choiceTop + 1);
  expect(expandedLayout.detailsTop, "subject details should flow below the answer choices").toBeGreaterThanOrEqual(expandedLayout.choiceBottom - 1);
  expect(expandedLayout.pageHeight, "expanded details may extend the document below the fitted quiz viewport").toBeGreaterThan(expandedLayout.viewportHeight);
});

test("finishing a resumed extra-study quiz clears it and offers no misses restart", async ({ page }) => {
  await mockApp(page);
  await page.goto("/settings");
  await page.evaluate((timestamp) => {
    window.localStorage.setItem("kakehashi:study:v1:account:1:session:random-test", JSON.stringify({
      version: 1,
      id: "resumed-random-test",
      mode: "random-test",
      createdAt: timestamp,
      updatedAt: timestamp,
      currentIndex: 0,
      questions: [{
        id: "6:meaning",
        subjectId: 6,
        subjectType: "vocabulary",
        kind: "meaning",
        prompt: "日本史",
        promptLabel: "Vocabulary meaning",
        acceptedAnswers: ["Japanese History"],
        displayAnswer: "Japanese History",
        choices: ["Japanese History", "One Thing"],
        characters: "日本史",
        stopAfterAnswer: true,
      }],
      answers: [],
      complete: false,
    }));
  }, now);

  await page.goto("/study/random-test");
  await page.getByRole("button", { name: /Resume saved session/ }).click();
  await page.getByRole("button", { name: "One Thing" }).click();
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByRole("heading", { name: "Session results" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Review .* misses/ })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("kakehashi:study:v1:account:1:session:random-test"))).toBeNull();

  await page.getByRole("button", { name: "Back to setup" }).click();
  await expect(page.getByRole("button", { name: "Start session" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Resume saved session/ })).toHaveCount(0);
});

for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "phone", width: 320, height: 780 }]) {
  test(`accepts a one-letter meaning typo in extra study without shifting the ${viewport.name} layout`, async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes("desktop"), "Responsive geometry runs in the installed Chromium project");
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await mockApp(page);

    await page.goto("/settings");
    const pauseOnClose = page.getByRole("checkbox", { name: "Pause on close answer" });
    await expect(pauseOnClose).not.toBeChecked();
    await page.locator("label").filter({ hasText: "Pause on close answer" }).click();

    await page.goto("/study/random-test?subjectIds=6");
    await page.locator("label").filter({ hasText: /^Reading$/ }).click();
    await page.getByRole("button", { name: "Start session" }).click();

    const input = page.getByLabel("Vocabulary Meaning");
    await expect(input).toBeVisible();
    const formBefore = await input.locator("xpath=ancestor::form").evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return { top: bounds.top, width: bounds.width };
    });

    await input.fill("japanese histoy");
    await input.press("Enter");

    const status = page.getByRole("status").filter({ hasText: "Accepted with a typo" });
    await expect(status).toContainText("Correct, with a small typo.");
    await expect(input).toHaveAttribute("aria-invalid", "false");
    await expect(page.getByRole("button", { name: "Mark Incorrect" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark Correct" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "extra-study close feedback should not overflow").toBe(true);

    await page.waitForTimeout(350);

    const formAfter = await input.locator("xpath=ancestor::form").evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return { top: bounds.top, width: bounds.width };
    });
    expect(Math.abs(formAfter.top - formBefore.top), "answer form should not move when close feedback appears").toBeLessThan(1);
    expect(Math.abs(formAfter.width - formBefore.width), "answer form width should remain stable").toBeLessThan(1);

    const overlap = await page.locator('form button, form input, [role=status], [aria-label="Close answer result"] button').evaluateAll((elements) => elements.some((element, index) => {
      const a = element.getBoundingClientRect();
      return elements.slice(index + 1).some((candidate) => {
        const b = candidate.getBoundingClientRect();
        const intersectionWidth = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const intersectionHeight = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        return intersectionWidth > 1 && intersectionHeight > 1;
      });
    }));
    expect(overlap, "answer controls and close feedback should not overlap").toBe(false);

    await input.press("Enter");
    await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Correct");
  });
}

test("keeps dense mobile-parity review options usable at 320px with large text", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await mockApp(page);

  const denseVocabulary = {
    ...subjects[5],
    data: {
      ...subjects[5].data,
      meanings: [
        { meaning: "Japanese History", primary: true, accepted_answer: true },
        { meaning: "History of Japan", primary: false, accepted_answer: true },
      ],
      readings: [
        { reading: "にほんし", primary: true, accepted_answer: true, type: "onyomi" },
        { reading: "にっぽんし", primary: false, accepted_answer: true, type: "onyomi" },
      ],
      context_sentences: [
        { ja: "日本史を大学で勉強しています。", en: "I study Japanese history at university." },
        { ja: "この本は日本史の流れを説明します。", en: "This book explains the course of Japanese history." },
        { ja: "日本史には興味深い人物が多く登場します。", en: "Many fascinating people appear in Japanese history." },
      ],
      parts_of_speech: ["noun", "proper_noun"],
      pronunciation_audios: [{ url: "https://example.com/nihonshi.mp3", content_type: "audio/mpeg", metadata: { gender: "female", pronunciation: "にほんし", voice_actor_name: "Kyoko" } }],
    },
  };
  const denseAssignments = assignments.map((assignment, index) => ({
    ...assignment,
    data: {
      ...assignment.data,
      available_at: assignment.data.subject_id === denseVocabulary.id
        ? "2019-01-01T00:00:00.000Z"
        : assignment.data.subject_id === 5
          ? "2019-01-02T00:00:00.000Z"
          : `2020-01-0${index + 1}T00:00:00.000Z`,
    },
  }));
  const denseStudyMaterial = {
    id: 306,
    object: "study_material",
    url: "",
    data_updated_at: now,
    data: { subject_id: denseVocabulary.id, subject_type: "vocabulary", meaning_synonyms: ["Japan's past", "Japanese chronology"], meaning_note: null, reading_note: null, hidden: false, created_at: now },
  };

  await page.route(/\/api\/wanikani\/assignments(?:\?.*)?$/, (route) => fulfillJson(route, collection(denseAssignments)));
  await page.route(/\/api\/wanikani\/subjects(?:\?.*)?$/, (route) => fulfillJson(route, collection(subjects.map((item) => item.id === denseVocabulary.id ? denseVocabulary : item))));
  await page.route(/\/api\/wanikani\/study_materials(?:\?.*)?$/, (route) => fulfillJson(route, collection([denseStudyMaterial])));
  await page.route("**/api/study/vocabulary-frequency", (route) => fulfillJson(route, { result: { provider: "jiten", frequencyRank: 12_345, wordId: 6, readingIndex: 0, matchedText: "日本史", matchedReading: "にほんし", sourceUrl: "https://jiten.moe/search?query=%E6%97%A5%E6%9C%AC%E5%8F%B2" } }));
  await page.route("**/api/subjects/enrichments", (route) => fulfillJson(route, { pitchAccents: [{ r: "にほんし", p: [2] }], patterns: [] }));

  await page.goto("/settings");
  await page.getByRole("radio", { name: /Extra large/ }).click();
  await expect(page.getByRole("radio", { name: /Extra large/ })).toHaveAttribute("aria-checked", "true");
  expect(await page.evaluate(() => document.documentElement.style.fontSize)).toBe("120%");

  await page.getByLabel("Review subject order", { exact: true }).selectOption("oldestAvailableFirst");
  await page.getByLabel("Wrap-up size").selectOption("5");
  await page.getByLabel("Review character size").selectOption("1.2");
  await page.getByLabel("Review answer size").selectOption("1.2");
  const enableToggle = async (label: string) => {
    const checkbox = page.getByRole("checkbox", { name: label });
    if (!await checkbox.isChecked()) await page.getByText(label, { exact: true }).click();
    await expect(checkbox).toBeChecked();
  };
  for (const label of [
    "Show item level & SRS stage",
    "Show vocabulary frequency",
    "Vocabulary context sentence hints",
    "Review search button",
    "Allow skipping reviews",
  ]) {
    await enableToggle(label);
  }
  await page.getByLabel("Anki mode").selectOption("both");
  for (const label of [
    "Group meaning and reading",
    "Show other accepted answers",
    "Show parts of speech",
    "Show pitch accent numbers",
    "Show pitch accent graph",
    "Show replay audio button",
  ]) {
    await enableToggle(label);
  }

  const reviewSettings = page.locator("section").filter({ has: page.getByRole("heading", { name: "Reviews", exact: true }) });
  const switchRows = reviewSettings.locator('label:has(> input[type="checkbox"])');
  const intersectingSwitchCopy = await switchRows.evaluateAll((rows) => rows.flatMap((row) => {
    const visibleSwitch = row.querySelector<HTMLElement>(":scope > i");
    if (!visibleSwitch || getComputedStyle(visibleSwitch).display === "none") return [];
    const switchRect = visibleSwitch.getBoundingClientRect();
    const copyParts = row.querySelectorAll<HTMLElement>(":scope > span strong, :scope > span small");
    const intersects = [...copyParts].some((part) => {
      const walker = document.createTreeWalker(part, NodeFilter.SHOW_TEXT);
      let textNode = walker.nextNode() as Text | null;
      while (textNode) {
        for (let index = 0; index < textNode.data.length; index += 1) {
          if (!/\S/u.test(textNode.data[index])) continue;
          const glyphRange = document.createRange();
          glyphRange.setStart(textNode, index);
          glyphRange.setEnd(textNode, index + 1);
          const glyphRect = glyphRange.getBoundingClientRect();
          const inlineOverlap = Math.min(glyphRect.right, switchRect.right) - Math.max(glyphRect.left, switchRect.left);
          const blockOverlap = Math.min(glyphRect.bottom, switchRect.bottom) - Math.max(glyphRect.top, switchRect.top);
          if (inlineOverlap > 1 && blockOverlap > 1) return true;
        }
        textNode = walker.nextNode() as Text | null;
      }
      return false;
    });
    return intersects ? [row.querySelector("strong")?.textContent?.trim() || "Unnamed setting"] : [];
  }));
  expect(intersectingSwitchCopy, "settings copy should reserve room for every visible switch").toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "dense settings should not overflow horizontally").toBe(true);

  await page.goto("/reviews");
  await expect(page.getByText("Level 2", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Vocabulary frequency #12,345")).toBeVisible();
  await expect(page.getByText("日本史を大学で勉強しています。", { exact: false })).toBeVisible();

  const headerControls = [
    page.getByRole("button", { name: "Wrap Up 5" }),
    page.getByRole("button", { name: "Skip review" }),
    page.getByRole("link", { name: "Search this item" }),
    page.getByRole("link", { name: "Pause", exact: true }),
  ];
  const headerBoxes = [];
  for (const control of headerControls) {
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    headerBoxes.push(box!);
  }
  const boxesOverlap = (left: { x: number; y: number; width: number; height: number }, right: { x: number; y: number; width: number; height: number }) => {
    const inlineOverlap = Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x);
    const blockOverlap = Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y);
    return inlineOverlap > 1 && blockOverlap > 1;
  };
  for (let left = 0; left < headerBoxes.length; left += 1) {
    expect(headerBoxes[left].x).toBeGreaterThanOrEqual(-1);
    expect(headerBoxes[left].x + headerBoxes[left].width).toBeLessThanOrEqual(321);
    for (let right = left + 1; right < headerBoxes.length; right += 1) {
      expect(boxesOverlap(headerBoxes[left], headerBoxes[right]), `header actions ${left + 1} and ${right + 1} should not overlap`).toBe(false);
    }
  }
  const reviewRoot = page.getByRole("main");
  expect(await reviewRoot.evaluate((root) => root.scrollWidth <= root.clientWidth + 1), "review root should not overflow horizontally").toBe(true);

  await page.getByRole("button", { name: "Show translations" }).click();
  await expect(page.getByText("I study Japanese history at university.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Reveal Answer" }).click();
  const ankiAnswer = page.getByTestId("anki-answer-content");
  await expect(ankiAnswer.getByText("Other meaning answers", { exact: true })).toBeVisible();
  await expect(ankiAnswer.getByText("Other reading answers", { exact: true })).toBeVisible();
  await expect(ankiAnswer.getByText("User synonyms", { exact: true })).toBeVisible();
  await expect(ankiAnswer.getByText("Part of speech", { exact: true })).toBeVisible();
  await expect(ankiAnswer.getByTestId("anki-pitch-accent")).toBeVisible();
  await expect(page.getByRole("button", { name: "Replay vocabulary audio" })).toBeVisible();

  const wrong = page.getByRole("button", { name: "1 · Wrong" });
  const correct = page.getByRole("button", { name: "2 · Correct" });
  await wrong.scrollIntoViewIfNeeded();
  const [wrongBox, correctBox] = await Promise.all([wrong.boundingBox(), correct.boundingBox()]);
  expect(wrongBox).not.toBeNull();
  expect(correctBox).not.toBeNull();
  for (const box of [wrongBox!, correctBox!]) {
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(321);
    expect(box.y).toBeGreaterThanOrEqual(-1);
    expect(box.y + box.height).toBeLessThanOrEqual(781);
  }
  expect(boxesOverlap(wrongBox!, correctBox!), "Anki grading buttons should not overlap").toBe(false);
  expect(await reviewRoot.evaluate((root) => root.scrollWidth <= root.clientWidth + 1), "revealed Anki details should not overflow horizontally").toBe(true);

  await wrong.click();
  await expect(page.getByText("Incorrect", { exact: true })).toBeVisible();
  const nextQuestion = page.getByRole("button", { name: "Next Question" });
  await expect(nextQuestion).toBeVisible();
  await nextQuestion.click();

  const previousAnswer = page.getByRole("link", { name: /^Previous .* answer:/ });
  await expect(previousAnswer).toBeVisible();
  await previousAnswer.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });
  const currentCharacters = page.locator('[class*="subjectGlyph"] > [class*="characters"]');
  await expect(currentCharacters).toBeVisible();
  const [previousAnswerBox, currentCharactersBox] = await Promise.all([previousAnswer.boundingBox(), currentCharacters.boundingBox()]);
  expect(previousAnswerBox).not.toBeNull();
  expect(currentCharactersBox).not.toBeNull();
  expect(boxesOverlap(previousAnswerBox!, currentCharactersBox!), "previous-answer card should not overlap the narrow prompt").toBe(false);
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
  await expect(page.getByText("Accepted WaniKani meanings are checked.", { exact: true })).toBeVisible();
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
  const musicLyrics = { id: 42, trackName: "アイドル", artistName: "YOASOBI", albumName: "アイドル", plainLyrics: "一つの猫と犬が空を見る\n山と川を歩く\n花と鳥が歌う\n月と星が光る", syncedLyrics: "[00:01.00]一つの猫と犬が空を見る\n[00:03.00]山と川を歩く\n[00:05.00]花と鳥が歌う\n[00:07.00]月と星が光る", duration: 213 };
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

  await page.setViewportSize({ width: 1280, height: 500 });
  await recommendationCards.last().scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await recommendationCards.last().click();
  const backToSearch = page.getByRole("button", { name: "Back to search" });
  await expect(backToSearch).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  const shortVideoBox = await page.getByRole("region", { name: "Song video" }).boundingBox();
  const shortLyricsBox = await page.getByRole("region", { name: "Song lyrics" }).locator("..").boundingBox();
  expect(shortVideoBox?.height).toBeGreaterThanOrEqual(350);
  expect(Math.abs((shortVideoBox?.height ?? 0) - (shortLyricsBox?.height ?? 0))).toBeLessThanOrEqual(2);
  await backToSearch.click();
  await expect(songSearch).toBeVisible();

  await page.setViewportSize({ width: 320, height: 800 });
  await songSearch.fill("YOASOBI");
  const trackResult = page.getByRole("button", { name: /アイドル by YOASOBI/i });
  await expect(trackResult).toBeVisible();
  await expect(page.getByRole("heading", { name: "Search results" })).toHaveCount(0);
  await expect(page.getByText("Spotify catalog")).toHaveCount(0);
  expect(await trackResult.evaluate((element) => ({ display: getComputedStyle(element).display, border: getComputedStyle(element).borderTopStyle }))).toEqual({ display: "grid", border: "solid" });
  await trackResult.click();
  const detailBack = page.getByRole("button", { name: "Back to search" });
  await expect(page.locator("header").getByRole("button", { name: "Back to search" })).toBeVisible();
  await expect(page.locator("main").getByRole("button", { name: "Back to search" })).toHaveCount(0);
  await expect(detailBack).toBeVisible();
  await expect(page.getByRole("heading", { name: "Video matches" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lyrics matches" })).toBeVisible();
  await expect(page.getByText("Use manual video or lyrics overrides")).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Playback controls" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Seek song" })).toBeVisible();
  const changeVideoSource = page.getByRole("link", { name: "Change video source" });
  const changeLyricsSource = page.getByRole("link", { name: "Change lyrics source" });
  await expect(changeVideoSource).toHaveAttribute("href", "#video-matches");
  await expect(changeLyricsSource).toHaveAttribute("href", "#lyrics-matches");
  await changeVideoSource.click();
  await expect(page.getByRole("textbox", { name: "Video search" })).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await changeLyricsSource.click();
  await expect(page.getByRole("textbox", { name: "Lyrics song" })).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  const mobilePlayerSizing = await page.getByRole("group", { name: "Playback controls" }).evaluate((controls) => ({
    controlsWidth: controls.getBoundingClientRect().width,
    cardWidth: controls.parentElement?.getBoundingClientRect().width ?? 0,
  }));
  expect(mobilePlayerSizing.controlsWidth).toBeLessThanOrEqual(mobilePlayerSizing.cardWidth);
  for (const controlName of ["Play song", "Restart song"]) {
    const controlBox = await page.getByRole("button", { name: controlName }).boundingBox();
    expect(controlBox?.width).toBeGreaterThanOrEqual(44);
    expect(controlBox?.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const playerHost = page.getByLabel("アイドル on YouTube");
  await expect(playerHost).toBeVisible();
  await playerHost.evaluate((element) => {
    (window as Window & { __kakehashiMusicPlayerHost?: Element }).__kakehashiMusicPlayerHost = element;
  });
  const lyricSubject = page.getByRole("button", { name: /Inspect 一つ, .*WaniKani item/ });
  await expect(lyricSubject).toBeVisible();
  await lyricSubject.click();
  const viewDetails = page.getByRole("link", { name: "View details" });
  await expect(viewDetails).toHaveAttribute("href", /\/subjects\/3\?returnTo=%2Fmusic%3Fsong%3Dsong-/);
  await viewDetails.click();

  const itemDialog = page.getByRole("dialog", { name: "Item details" });
  await expect(itemDialog).toBeVisible();
  await expect(page).toHaveURL(/\/subjects\/3\?returnTo=/);
  expect(await page.evaluate(() => {
    const stored = (window as Window & { __kakehashiMusicPlayerHost?: Element }).__kakehashiMusicPlayerHost;
    return Boolean(stored?.isConnected && stored === document.querySelector('[aria-label="アイドル on YouTube"]'));
  })).toBe(true);

  await itemDialog.getByRole("button", { name: "Back to lyrics", exact: true }).click();
  await expect(itemDialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/music\?song=song-/);
  await expect(page.getByRole("region", { name: "Song lyrics" })).toBeVisible();
  expect(await page.evaluate(() => {
    const stored = (window as Window & { __kakehashiMusicPlayerHost?: Element }).__kakehashiMusicPlayerHost;
    return Boolean(stored?.isConnected && stored === document.querySelector('[aria-label="アイドル on YouTube"]'));
  })).toBe(true);

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

  await page.setViewportSize({ width: 1920, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const musicWorkspaceBox = await page.locator("main.page").boundingBox();
  expect(musicWorkspaceBox?.width).toBeGreaterThan(1504);
  const stageColumns = await videoPanel.locator("..").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  expect(stageColumns).toBeGreaterThan(1);
  const desktopVideoBox = await videoPanel.boundingBox();
  const desktopLyricsBox = await lyricsPanel.boundingBox();
  const desktopVideoViewportBox = await videoPanel.locator('[aria-label$="on YouTube"]').boundingBox();
  expect(desktopVideoBox?.height).toBeGreaterThanOrEqual(650);
  expect(Math.abs((desktopVideoBox?.height ?? 0) - (desktopLyricsBox?.height ?? 0))).toBeLessThanOrEqual(2);
  expect(Math.abs((desktopVideoViewportBox?.width ?? 0) / (desktopVideoViewportBox?.height ?? 1) - 16 / 9)).toBeLessThan(0.02);
  expect(desktopLyricsBox?.width).toBeGreaterThan(desktopVideoBox?.width ?? Number.POSITIVE_INFINITY);
  expect(desktopLyricsBox?.x).toBeLessThan(desktopVideoBox?.x ?? 0);
});
