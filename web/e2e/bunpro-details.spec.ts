import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";

function seal(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update("mixed-layout-test-session-secret-32-characters").digest(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

const rows = [
  ["る<sup>1</sup>", "見（み）", "る", "て"],
  ["る<sup>5</sup>", "座（すわ）", "る", "って"],
  ["う", "歌（うた）", "う", "って"], ["つ", "打（う）", "つ", "って"],
  ["く", "歩（ある）", "く", "いて"], ["ぐ", "泳（およ）", "ぐ", "いで"],
  ["ぬ", "死（し）", "ぬ", "んで"], ["ぶ", "飛（と）", "ぶ", "んで"],
  ["む", "休（やす）", "む", "んで"], ["す", "話（はな）", "す", "して"],
];
const structure = "Examples:<br>" + rows.map(([ending, stem, removed, replacement], i) =>
  `<span class="gp-popout">［${ending}］Verb</span> ￫ ${stem}<del>${removed}</del> + <strong>${replacement}</strong>${[0, 3, 5, 8, 9].includes(i) ? "<br><br>" : "<br>"}`,
).join("") + 'Exceptions:<br>行（い）く ￫ <span class="chui">行（い）って</span><br><span class="gp-popout">する</span> ￫ <span class="chui">して</span><br><span class="gp-popout">くる</span> ￫ <span class="chui">きて</span>';
const grammar = {
  data: { id: "416", type: "grammar_point", attributes: {
    id: 416, title: "Verb + て", furigana: "～て (Conjunction)", slug: "verb-て", level: "JLPT5",
    meaning: "And, Then (Linking events)", casual_structure: structure,
    part_of_speech_translation: "Verb", word_type_translation: "Conjunctive Particle", register_translation: "Standard",
  } },
  included: [
    { id: "59", type: "writeup", attributes: { body: '<p>The <span data-gp-id="416">て</span> form connects a <span data-gp-id="12">る-Verb</span> to another action.</p><section class="caution"><h4>Caution</h4><p>There are several irregular verbs when it comes to <span data-gp-id="416">て</span> form conjugation.</p><ul class="writeup-examples--holder"><li data-study-question="183777"></li><li data-study-question="183778"></li><li data-study-question="183779"></li></ul></section>' } },
    { id: "183777", type: "study_question", attributes: { question_type: "readonly", content: "学校（がっこう）に行（い）って勉強（べんきょう）をする。", translation: 'I <strong>go</strong> to school,<strong> then</strong> study.', extra_info: '<ruby>行<rt class="bp-js-hide-furi">い</rt></ruby>く\'s conjugation with て' } },
    { id: "183778", type: "study_question", attributes: { question_type: "readonly", content: "ダイエットをして痩（や）せる。", translation: 'To <strong>go on</strong> a diet,<strong> then</strong> lose weight.', extra_info: "する's conjugation with て" } },
    { id: "183779", type: "study_question", attributes: { question_type: "readonly", content: "公園（こうえん）に来（き）て遊（あそ）ぶ。", translation: 'To <strong>come to</strong> the park,<strong> then</strong> play.', extra_info: "来（く）る's conjugation with て" } },
  ],
};

for (const mode of ["grammar", "vocab"] as const) {
  test(`standalone Bunpro ${mode} reviews show the latest correct and incorrect answer card`, async ({ page }, testInfo) => {
    await page.context().addCookies([
      { name: "kakehashi_wk_session", value: seal("mixed-layout-test-token"), url: "http://127.0.0.1:3101" },
      { name: "kakehashi_bunpro", value: seal(JSON.stringify({ owner: "1", token: "bunpro-layout-test-token" })), url: "http://127.0.0.1:3101" },
    ]);
    await page.addInitScript(() => localStorage.setItem("kakehashi-web:settings:portego:v1", JSON.stringify({ study: { reviewOrder: "ascendingSrsStage", pauseOnCorrect: true, pauseOnWrong: true, showAnswerStopSubjectDetails: false, answerFeedbackSoundEnabled: false } })));
    await page.route("**/api/session/wanikani", route => route.fulfill({ json: { user: { id: 1, object: "user", data: { username: "Portego", level: 2, preferences: {}, subscription: { active: true, max_level_granted: 60 } } } } }));
    const titles = mode === "grammar" ? ["です", "ます", "でした"] : ["猫", "犬", "鳥"];
    const answers = mode === "grammar" ? titles : ["ねこ", "いぬ", "とり"];
    const slugs = mode === "grammar" ? ["desu", "masu", "deshita"] : ["neko", "inu", "tori"];
    const reviews = titles.map((title, index) => ({
      data: { id: String(index + 10), type: "review", attributes: { id: index + 10, ghost_count: 0, streak: index + 1, reviewable_id: index + 20, reviewable_type: mode === "grammar" ? "GrammarPoint" : "Vocab" }, relationships: { study_question: { data: { id: String(index + 30), type: "study_question" } }, reviewable: { data: { id: String(index + 20), type: mode === "grammar" ? "grammar_point" : "vocab" } } } },
      included: [{ id: String(index + 30), type: "study_question", attributes: { content: "これは____。", answer: answers[index] } }, { id: String(index + 20), type: mode === "grammar" ? "grammar_point" : "vocab", attributes: { title, slug: slugs[index] } }],
    }));
    const grades: boolean[] = [];
    await page.route(/\/api\/bunpro(?:\?.*)?$/, route => {
      if (route.request().method() === "POST") { grades.push(route.request().postDataJSON().correct); return route.fulfill({ json: {} }); }
      return route.fulfill({ json: new URL(route.request().url()).searchParams.get("action") === "queue" ? { review_session_id: 1, pending_attempt: reviews, pending_wrapup: [] } : { connected: true } });
    });
    await page.goto(`/bunpro-reviews?mode=${mode}`);
    const input = page.getByRole("textbox", { name: "Your answer" });
    await expect(input).toBeVisible();
    await expect(page.getByRole("link", { name: /Previous Bunpro answer/ })).toHaveCount(0);
    for (const [index, correct] of [true, false].entries()) {
      await input.fill(correct ? answers[index] : "ちがう");
      await page.getByRole("button", { name: "Check", exact: true }).click();
      await page.getByRole("button", { name: "Next", exact: true }).click();
      const previous = page.getByRole("link", { name: `Previous Bunpro answer: ${titles[index]}, ${correct ? "correct" : "incorrect"}`, exact: true });
      await expect(previous).toBeVisible();
      await expect(previous).toHaveAttribute("href", `/bunpro/${mode}/${slugs[index]}`);
      await expect(previous).toHaveAttribute("target", "_blank");
      await expect(previous).toHaveAttribute("data-correct", String(correct));
      await expect(page.getByRole("link", { name: /Previous Bunpro answer/ })).toHaveCount(1);
      await expect(input).toHaveValue("");
      await expect(page.getByRole("button", { name: "Check", exact: true })).toBeDisabled();
      await expect.poll(() => grades.length).toBe(index + 1);
      const card = await previous.boundingBox();
      expect(card).not.toBeNull();
      expect(card!.x).toBeGreaterThanOrEqual(0);
      expect(card!.x + card!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      await page.screenshot({ path: testInfo.outputPath(`previous-${correct ? "correct" : "incorrect"}.png`) });
    }
    expect(grades).toEqual([true, false]);
  });
}

test("Bunpro review furigana hides, reveals on hover, and pins until the question changes", async ({ page, isMobile }, testInfo) => {
  await page.context().addCookies([
    { name: "kakehashi_wk_session", value: seal("mixed-layout-test-token"), url: "http://127.0.0.1:3101" },
    { name: "kakehashi_bunpro", value: seal(JSON.stringify({ owner: "1", token: "bunpro-layout-test-token" })), url: "http://127.0.0.1:3101" },
  ]);
  await page.route("**/api/session/wanikani", route => route.fulfill({ json: { user: { id: 1, object: "user", data: { username: "Portego", level: 2, preferences: {}, subscription: { active: true, max_level_granted: 60 } } } } }));
  let grades = 0;
  const reviews = [10, 11].map(id => ({
    data: { id: String(id), type: "review", attributes: { id, ghost_count: 0, reviewable_id: 20, reviewable_type: "GrammarPoint" }, relationships: { study_question: { data: { id: "30", type: "study_question" } }, reviewable: { data: { id: "20", type: "grammar_point" } } } },
    included: [{ id: "30", type: "study_question", attributes: { content: "私（わたし）は学生（がくせい）____。", answer: "です", translation: "I am a student." } }, { id: "20", type: "grammar_point", attributes: { title: "です", slug: "desu", meaning: "To be" } }],
  }));
  await page.route(/\/api\/bunpro(?:\?.*)?$/, route => {
    const action = new URL(route.request().url()).searchParams.get("action");
    if (route.request().method() === "POST") { grades++; return route.fulfill({ json: {} }); }
    return route.fulfill({ json: action === "queue" ? { review_session_id: 1, pending_attempt: reviews, pending_wrapup: [], total_pending_attempt_count: 2 } : { connected: true } });
  });
  await page.goto("/bunpro-reviews?mode=grammar");
  const input = page.getByLabel("Your answer");
  await input.fill("です");
  const prompt = page.locator('header[aria-label="Bunpro review"]');
  await expect(prompt.locator("ruby rt").first()).toHaveCSS("opacity", "1");
  await page.getByRole("button", { name: "Review settings", exact: true }).click();
  const toggle = page.getByLabel("Hide Bunpro furigana", { exact: true });
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  const word = page.getByRole("button", { name: "Furigana for 私", exact: true });
  await expect(word.locator("rt")).toHaveCSS("opacity", "0");
  await expect(input).toHaveValue("です");
  if (!isMobile) {
    await word.hover();
    await expect(word.locator("rt")).toHaveCSS("opacity", "1");
    await input.click();
    await expect(word.locator("rt")).toHaveCSS("opacity", "0");
    await word.focus();
    await word.press("Enter");
  } else { await word.tap(); }
  await input.click();
  await expect(word).toHaveAttribute("aria-pressed", "true");
  await expect(word.locator("rt")).toHaveCSS("opacity", "1");
  await expect(page.getByRole("button", { name: "Furigana for 学生", exact: true }).locator("rt")).toHaveCSS("opacity", "0");
  expect(grades).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("pinned-furigana.png") });
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("progressbar", { name: "Review progress", exact: true })).toHaveAttribute("aria-valuenow", "1");
  await expect(word).toHaveAttribute("aria-pressed", "false");
  await expect(word.locator("rt")).toHaveCSS("opacity", "0");
  await page.reload();
  await expect(word).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Review settings", exact: true }).click();
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(prompt.locator("ruby rt").first()).toHaveCSS("opacity", "1");
});

test("starts another configured lesson batch after the daily goal is complete", async ({ page }) => {
  await page.context().addCookies([
    { name: "kakehashi_wk_session", value: seal("mixed-layout-test-token"), url: "http://127.0.0.1:3101" },
    { name: "kakehashi_bunpro", value: seal(JSON.stringify({ owner: "1", token: "bunpro-layout-test-token" })), url: "http://127.0.0.1:3101" },
  ]);
  await page.route("**/api/session/wanikani", route => route.fulfill({ json: { user: { id: 1, object: "user", data: { username: "Portego", level: 2, preferences: {}, subscription: { active: true, max_level_granted: 60 } } } } }));
  await page.route(/\/api\/bunpro(?:\?.*)?$/, route => {
    const action = new URL(route.request().url()).searchParams.get("action");
    const json = action === "lesson-queue" ? { data: [{ id: "1", attributes: { deck_id: 1, daily_goal: 4, daily_goal_count_grammar: 4, complete_grammar_count: 4, batch_size: 2 } }], included: [{ id: "1", attributes: { title: "N5 Grammar", grammar_count: 100 } }] }
      : action === "learn" ? { content: [grammar, ...[100, 101].map(id => ({ data: { id: String(id), type: "vocab", attributes: { id, title: id === 100 ? "猫" : "犬", slug: id === 100 ? "cat" : "dog", meaning: id === 100 ? "Cat" : "Dog" } }, included: [] }))] } : { connected: true };
    return route.fulfill({ json });
  });
  await page.goto("/bunpro-lessons");
  await expect(page.getByRole("heading", { name: "Verb + て", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Lesson batch" }).getByRole("button")).toHaveCount(2);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { name: "猫", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Quiz", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toHaveCount(0);
});

test("matches Bunpro structure formatting, retains example notes, and links supported conjugation practice", async ({ page }, testInfo) => {
  await page.context().addCookies([
    { name: "kakehashi_wk_session", value: seal("mixed-layout-test-token"), url: "http://127.0.0.1:3101" },
    { name: "kakehashi_bunpro", value: seal(JSON.stringify({ owner: "1", token: "bunpro-layout-test-token" })), url: "http://127.0.0.1:3101" },
  ]);
  await page.route("**/api/session/wanikani", route => route.fulfill({ json: { user: { id: 1, object: "user", data: { username: "Portego", level: 2, preferences: {}, subscription: { active: true, max_level_granted: 60 } } } } }));
  await page.route("**/api/wanikani/**", route => route.fulfill({ json: { object: "collection", pages: { next_url: null }, data: [] } }));
  await page.route(/\/api\/bunpro(?:\?.*)?$/, route => {
    const action = new URL(route.request().url()).searchParams.get("action");
    const json = action === "lesson-queue" ? { data: [{ id: "1", attributes: { deck_id: 1, daily_goal: 2, batch_size: 2 } }], included: [{ id: "1", attributes: { title: "N5 Grammar", grammar_count: 100 } }] }
      : action === "learn" ? { content: [grammar, { data: { id: "100", type: "vocab", attributes: { title: "猫", slug: "cat", meaning: "Cat" } }, included: [] }] } : { connected: true };
    return route.fulfill({ json });
  });
  await page.goto("/bunpro-lessons?deck=1");
  await expect(page.getByRole("heading", { name: "Verb + て", exact: true })).toBeVisible();
  const structurePanel = page.locator("section").filter({ has: page.getByRole("heading", { name: "Structure", exact: true }) }).last();
  await expect(structurePanel.locator("sup").first()).toHaveText("1");
  await expect(structurePanel.getByText("する", { exact: true })).toHaveCSS("color", "rgb(69, 69, 69)");
  await expect(structurePanel.locator("strong").first()).toHaveCSS("color", "rgb(198, 73, 73)");
  await expect(structurePanel.locator("strong").first()).toHaveCSS("font-weight", "600");
  await expect(structurePanel.locator("[data-bunpro-caution]").first()).toHaveCSS("color", "rgb(251, 156, 4)");
  expect(await structurePanel.locator("del").first().evaluate(el => {
    const s = getComputedStyle(el, "::after"); return { top: s.borderTopColor, bottom: s.borderBottomColor };
  })).toEqual({ top: "rgb(232, 41, 53)", bottom: "rgb(232, 41, 53)" });
  await expect(structurePanel.locator("rt").first()).toHaveCSS("opacity", "1");
  await expect(page.getByRole("heading", { name: "Caution", exact: true })).toHaveCSS("color", "rgb(251, 156, 4)");
  const examples = page.locator("article");
  await expect(examples.first().locator('[data-bunpro-furigana="hover"]')).toHaveCSS("opacity", "1");
  await expect(examples.first().getByText("く's conjugation with て", { exact: false })).toBeVisible();
  await expect(examples.nth(1).getByText("する's conjugation with て", { exact: false })).toBeVisible();
  await expect(examples.nth(2).getByText("る's conjugation with て", { exact: false })).toBeVisible();
  await expect(examples.first().getByText("go", { exact: true })).toHaveCSS("color", "rgb(198, 73, 73)");
  const practice = page.getByRole("complementary", { name: "Conjugation practice" });
  await expect(practice.getByRole("link")).toHaveAttribute("href", "https://kaijugation.bunpro.jp/create/416/verb-%E3%81%A6");
  await expect(practice.getByRole("link")).toHaveAttribute("target", "_blank");
  await page.getByRole("heading", { name: "About Verb + て" }).scrollIntoViewIfNeeded();
  const about = page.locator("section").filter({ has: page.getByRole("heading", { name: "About Verb + て" }) }).last();
  await about.screenshot({ path: testInfo.outputPath("conjugation-notes.png") });
  await practice.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await practice.screenshot({ path: testInfo.outputPath("kaijugation-practice.png") });
  await page.screenshot({ path: testInfo.outputPath("bunpro-details.png"), fullPage: true });
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { name: "猫", exact: true })).toBeVisible();
  await expect(practice).toHaveCount(0);
});


for (const screen of ["details", "reviews", "lessons"] as const) {
  test(`compact Bunpro examples and sticky identity/tabs in ${screen}`, async ({ page }, testInfo) => {
    await page.context().addCookies([
      { name: "kakehashi_wk_session", value: seal("mixed-layout-test-token"), url: "http://127.0.0.1:3101" },
      { name: "kakehashi_bunpro", value: seal(JSON.stringify({ owner: "1", token: "bunpro-layout-test-token" })), url: "http://127.0.0.1:3101" },
    ]);
    const longGrammar = { ...grammar, included: [
      ...grammar.included.filter(item => item.type !== "study_question"),
      ...Array.from({ length: 18 }, (_, i) => ({ ...grammar.included[1 + i % 3], id: String(183777 + i) })),
    ] };
    await page.route("**/api/session/wanikani", route => route.fulfill({ json: { user: { id: 1, object: "user", data: { username: "Portego", level: 2, preferences: {}, subscription: { active: true, max_level_granted: 60 } } } } }));
    await page.route("**/api/wanikani/**", route => route.fulfill({ json: { object: "collection", pages: { next_url: null }, data: [] } }));
    await page.route(/\/api\/bunpro(?:\?.*)?$/, route => {
      const action = new URL(route.request().url()).searchParams.get("action");
      const json = action === "details" ? longGrammar
        : action === "lesson-queue" ? { data: [{ id: "1", attributes: { deck_id: 1, daily_goal: 2, batch_size: 2 } }], included: [{ id: "1", attributes: { title: "N5 Grammar", grammar_count: 100 } }] }
        : action === "learn" ? { content: [longGrammar] }
        : action === "queue" ? { review_session_id: 1, pending_wrapup: [], total_pending_attempt_count: 1, pending_attempt: [{
          data: { id: "10", type: "review", attributes: { id: 10, ghost_count: 0, reviewable_id: 416, reviewable_type: "GrammarPoint" }, relationships: { study_question: { data: { id: "30", type: "study_question" } }, reviewable: { data: { id: "416", type: "grammar_point" } } } },
          included: [{ id: "30", type: "study_question", attributes: { content: "食（た）べ____寝（ね）る。", answer: "て", translation: "Eat, then sleep." } }, longGrammar.data],
        }] } : { connected: true };
      return route.fulfill({ json });
    });
    await page.goto(screen === "details" ? "/bunpro/grammar/verb-て" : screen === "lessons" ? "/bunpro-lessons?deck=1" : "/bunpro-reviews?mode=grammar");
    if (screen === "reviews") {
      await page.getByLabel("Your answer").fill("て");
      await page.getByRole("button", { name: "Check", exact: true }).click();
      await page.getByRole("button", { name: /^Info/ }).click();
    }
    const details = page.getByRole("region", { name: "Bunpro item details" });
    await expect(details.getByRole("heading", { name: "Verb + て", exact: true })).toBeVisible();
    const tabs = details.getByRole("tablist", { name: "Bunpro details" });
    await tabs.getByRole("tab", { name: "Examples", exact: true }).click();
    const examples = details.locator("article");
    await expect(examples).toHaveCount(18);
    const spacing = await examples.evaluateAll(items => {
      const first = items[0].getBoundingClientRect();
      const second = items[1].getBoundingClientRect();
      return { gap: second.top - first.bottom, padding: parseFloat(getComputedStyle(items[0]).paddingTop) };
    });
    expect(spacing.gap).toBeGreaterThanOrEqual(0);
    expect(spacing.gap).toBeLessThanOrEqual(12);
    expect(spacing.padding).toBeLessThanOrEqual(16);
    if (screen === "reviews") {
      // Tab changes can resize the animated disclosure. Scroll after it settles.
      await expect.poll(() => details.evaluate(element => {
        const disclosure = element.closest<HTMLElement>("[data-review-details-reveal]")!;
        return Math.abs(disclosure.getBoundingClientRect().height - disclosure.firstElementChild!.getBoundingClientRect().height);
      })).toBeLessThan(1);
    }
    // Scroll well past the hero; the identity must sit above the pinned tabs.
    await examples.nth(6).scrollIntoViewIfNeeded();
    const identity = details.getByRole("button", { name: "Back to Verb + て", exact: true });
    await expect(identity).toBeVisible();
    const before = (await tabs.boundingBox())!;
    const subject = (await identity.boundingBox())!;
    const appHeaderBottom = await page.locator("[data-app-header]").evaluateAll(items => items[0]?.getBoundingClientRect().bottom ?? 0);
    expect(subject.y).toBeGreaterThanOrEqual(Math.max(0, appHeaderBottom) - 1);
    expect(Math.abs(subject.y + subject.height - before.y)).toBeLessThanOrEqual(1);
    await page.evaluate(() => window.scrollBy(0, 150));
    await expect.poll(async () => (await tabs.boundingBox())!.y).toBeCloseTo(before.y, 0);
    await expect(identity).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`sticky-${screen}.png`) });
    await tabs.getByRole("tab", { name: "Details", exact: true }).click();
    await expect(tabs.getByRole("tab", { name: "Details", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(details.getByRole("tabpanel")).toHaveAttribute("data-details-tab", "true");
  });
}
