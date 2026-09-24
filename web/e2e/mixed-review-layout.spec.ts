import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { expect, test, type Page, type Route, type TestInfo } from "@playwright/test";
import type { WebStudyPreferences } from "../src/features/settings/settings";

const timestamp = "2026-09-22T10:00:00.000Z";
const testToken = "mixed-layout-test-token";
const testSecret = "mixed-layout-test-session-secret-32-characters";
const user = {
  id: 1, object: "user", url: "", data_updated_at: timestamp,
  data: { username: "Portego", level: 2, profile_url: "", started_at: timestamp,
    current_vacation_started_at: null, preferences: {},
    subscription: { active: true, type: "lifetime", max_level_granted: 60 } },
};

function vocabulary(id: number, characters: string, meaning: string, reading: string) {
  return { id, object: "vocabulary", url: "", data_updated_at: timestamp, data: {
    level: id, created_at: timestamp, slug: characters,
    document_url: `https://www.wanikani.com/vocabulary/${encodeURIComponent(characters)}`,
    hidden_at: null, characters, meanings: [{ meaning, primary: true, accepted_answer: true }],
    auxiliary_meanings: [], readings: [{ reading, primary: true, accepted_answer: true }],
    meaning_mnemonic: meaning, reading_mnemonic: reading, component_subject_ids: [],
    context_sentences: [], parts_of_speech: ["noun"], pronunciation_audios: [],
  } };
}
const subjects = [vocabulary(1, "川", "River", "かわ"), vocabulary(2, "森", "Forest", "もり")];
const assignments = subjects.map((subject) => ({
  id: subject.id + 100, object: "assignment", url: "", data_updated_at: timestamp,
  data: { subject_id: subject.id, subject_type: subject.object, srs_stage: 3,
    available_at: "2020-01-01T00:00:00.000Z", started_at: timestamp, unlocked_at: timestamp,
    passed_at: null, burned_at: null, resurrected_at: null, hidden: false, created_at: timestamp },
}));
const grammar = [10, 11].map((id) => ({
  data: { id: String(id), type: "review", attributes: { id, ghost_count: 0, streak: id - 8, reviewable_type: "GrammarPoint" },
    relationships: { study_question: { data: { id: String(id + 20), type: "study_question" } },
      reviewable: { data: { id: String(id + 10), type: "grammar_point" } } } },
  included: [
    { id: String(id + 20), type: "study_question", attributes: {
      content: "私(わたし)は学生____。", answer: "です", tense: "Polite copula", translation: "I am a student.",
    } },
    { id: String(id + 10), type: "grammar_point", attributes: { title: "です", slug: "desu", meaning: "To be", level: "JLPT5" } },
  ],
}));

function collection(data: unknown[]) {
  return { object: "collection", url: "", pages: { next_url: null, previous_url: null, per_page: 1000 },
    total_count: data.length, data_updated_at: timestamp, data };
}
function fulfillJson(route: Route, json: unknown) {
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(json) });
}

// The mixed-review page checks identity on the server before rendering. The local
// fixture server seeds this synthetic identity; no real account or API key is used.
function testSession() {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update(testSecret).digest(), iv);
  const encrypted = Buffer.concat([cipher.update(testToken, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

async function openMixedReviews(page: Page, study: Partial<WebStudyPreferences> = {}, largeQueue = false) {
  const reviewSubjects = largeQueue ? Array.from({ length: 20 }, (_, index) => vocabulary(index + 1, `川${index + 1}`, "River", "かわ")) : subjects;
  const reviewAssignments = largeQueue ? reviewSubjects.map(subject => ({ ...assignments[0], id: subject.id + 100, data: { ...assignments[0].data, subject_id: subject.id } })) : assignments;
  const reviewGrammar = largeQueue ? Array.from({ length: 20 }, (_, index) => ({ ...grammar[0], data: { ...grammar[0].data, id: String(10 + index), attributes: { ...grammar[0].data.attributes, id: 10 + index } } })) : grammar;
  const url = process.env.MIXED_REVIEW_BASE_URL ?? "http://127.0.0.1:3100";
  await page.context().addCookies([{ name: "kakehashi_wk_session", value: testSession(), url }]);
  await page.addInitScript((study) => {
    localStorage.setItem("kakehashi-web:settings:portego:v1", JSON.stringify({
      study: { reviewQuestionOrderEnabled: true, reviewQuestionOrder: "meaning-first",
        reviewOrder: "lowestLevelFirst", backToBackQuestions: true, allowSkippingReviews: true,
        pauseOnCorrect: true, pauseOnWrong: true, showAnswerStopSubjectDetails: false,
        answerFeedbackSoundEnabled: false, autoplayAudio: false,
        showReviewItemLevelAndSrsStage: true, showVocabularyFrequency: false,
        srsProgressionCardDisplayMode: "normal", keyboardShortcuts: true, ...study },
      subjectDetails: { showImmersionExamples: false, showPitchAccent: false, showPatternsOfUse: false },
    }));
  }, study);
  await page.route("**/api/custom-srs", (route) => fulfillJson(route, { available: false, state: null, revision: -1 }));
  await page.route("**/api/analytics/session", (route) => fulfillJson(route, { recorded: true }));
  await page.route(/\/api\/analytics\/study-time(?:\?.*)?$/, (route) => fulfillJson(route, { available: true, days: [] }));
  await page.route(/\/api\/analytics\/streak(?:\?.*)?$/, (route) => fulfillJson(route, { activeDays: [], available: true }));
  await page.route("**/api/subjects/lists", (route) => fulfillJson(route, { lists: [] }));
  await page.route("**/api/subjects/enrichments", (route) => fulfillJson(route, { pitchAccents: [], patterns: [] }));
  await page.route("**/api/session/wanikani", (route) => fulfillJson(route, { user }));
  await page.route("**/api/wanikani/**", (route) => {
    const resource = new URL(route.request().url()).pathname.split("/").pop();
    if (resource === "user") return fulfillJson(route, user);
    if (resource === "assignments") return fulfillJson(route, collection(reviewAssignments));
    if (resource === "subjects") return fulfillJson(route, collection(reviewSubjects));
    const assignment = reviewAssignments.find((entry) => String(entry.id) === resource);
    if (assignment) return fulfillJson(route, assignment);
    if (resource === "reviews" && route.request().method() === "POST") {
      return fulfillJson(route, { id: 1, object: "review", data: {
        assignment_id: route.request().postDataJSON().review.assignment_id,
        starting_srs_stage: 3, ending_srs_stage: 4,
      }, resources_updated: {} });
    }
    return fulfillJson(route, collection([]));
  });
  await page.route(/\/api\/bunpro(?:\?.*)?$/, async (route) => {
    const action = new URL(route.request().url()).searchParams.get("action");
    if (action === "connection") {
      // Set queue order after React initializes its event bookkeeping, which also
      // uses random identifiers. Changing it at document creation breaks events.
      await page.evaluate(() => { // Deliberately visit both providers to compare their layouts.
        Math.random = () => document.querySelector('[aria-label="Review prompt"]')?.checkVisibility() ? 0.999999 : 0; });
      return fulfillJson(route, { connected: true });
    }
    if (action === "details") return fulfillJson(route, { data: { id: "20", type: "grammar_point", attributes: { title: "です", meaning: "To be", level: "JLPT5", nuance_translation: "Use this polite copula to end a sentence." } }, included: [] });
    if (action === "queue") return fulfillJson(route, {
      review_session_id: 101, pending_attempt: reviewGrammar, pending_wrapup: [],
      total_pending_attempt_count: reviewGrammar.length, total_pending_wrapup_count: 0,
    });
    if (route.request().method() === "POST") return fulfillJson(route, { new_srs_stage: 4, next_review: "2099-01-01T00:00:00Z" });
    return fulfillJson(route, {});
  });
  await page.goto(`${url}/mixed-reviews?mode=grammar`);
  await expect(page.locator('[aria-label="Review prompt"]:visible')).toBeVisible();
}

async function answerLayout(page: Page) {
  return session(page).evaluate((root) => {
    const bounds = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom, right: rect.right };
    };
    const input = root.querySelector<HTMLInputElement>('input[aria-label="Your answer"]')!;
    const form = input.form!;
    const submit = form.querySelector('[class*="primaryButton"]')!;
    const feedback = root.querySelector('[role="status"][class*="answerStatus"]');
    const belowForm = [...root.querySelectorAll('[aria-label="Answer controls"] button, [aria-label="Answer result controls"] button, button[aria-label*="voice" i], [data-srs-progression-slot], [class*="keyboardHint"]')]
      .filter((element) => !form.contains(element))
      .map(bounds)
      .filter((rect) => rect.height > 0 && rect.y >= bounds(form).bottom - 1);
    return {
      form: bounds(form), input: bounds(input), submit: bounds(submit),
      feedback: feedback ? bounds(feedback) : null,
      controlsBottom: Math.max(bounds(form).bottom, ...belowForm.map((rect) => rect.bottom)),
      scrollY: window.scrollY,
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
}
type AnswerLayout = Awaited<ReturnType<typeof answerLayout>>;

function expectAnswerLayout(actual: AnswerLayout, expected: AnswerLayout, state: string, feedback = false) {
  for (const anchor of ["form", "input", "submit"] as const) {
    for (const dimension of ["x", "y", "width", "height"] as const) {
      expect.soft(Math.abs(actual[anchor][dimension] - expected[anchor][dimension]), `${state}: ${anchor} ${dimension}`).toBeLessThanOrEqual(1);
    }
  }
  expect.soft(Math.abs(actual.submit.y - actual.input.y), `${state}: submit stays beside the input`).toBeLessThanOrEqual(1);
  expect.soft(actual.submit.x, `${state}: submit does not overlap the input`).toBeGreaterThanOrEqual(actual.input.right - 1);
  if (feedback) {
    expect(actual.feedback, `${state}: visible answer feedback`).not.toBeNull();
    expect.soft(actual.feedback!.height, `${state}: feedback is not collapsed`).toBeGreaterThan(0);
    expect.soft(actual.feedback!.y, `${state}: feedback follows the controls without overlap`).toBeGreaterThanOrEqual(actual.controlsBottom - 1);
  }
  expect.soft(actual.scrollY, `${state}: viewport stays at the top`).toBe(0);
  expect.soft(actual.horizontalOverflow, `${state}: horizontal overflow`).toBeLessThanOrEqual(1);
}

const preferenceCases: { name: string; study: Partial<WebStudyPreferences> }[] = [
  { name: "SRS hidden and keyboard shortcuts off", study: { srsProgressionCardDisplayMode: "hidden", keyboardShortcuts: false } },
  { name: "compact SRS", study: { srsProgressionCardDisplayMode: "compact" } },
  { name: "voice answers enabled", study: { voiceAnswers: true } },
];

for (const { name, study } of preferenceCases) {
  test(`mixed review answer layout remains stable with ${name}`, async ({ page, isMobile }, testInfo) => {
    test.skip(isMobile, "Desktop mixed-review geometry regression");
    test.skip(!process.env.MIXED_REVIEW_BASE_URL, "Requires the isolated mixed-review fixture server");
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openMixedReviews(page, study);

    const initial = await answerLayout(page);
    const states: Record<string, AnswerLayout> = {};
    await answer(page, "wrong");
    states.wanikaniIncorrect = await answerLayout(page);
    expectAnswerLayout(states.wanikaniIncorrect, initial, "WaniKani incorrect", true);
    await page.getByRole("button", { name: "Mark Correct", exact: true }).click();
    await expect(page.locator("#study-prompt-title")).toHaveText("reading");
    await answer(page, "かわ");
    await expect(session(page).getByText("Correct", { exact: true })).toBeVisible();
    states.wanikaniCorrect = await answerLayout(page);
    expectAnswerLayout(states.wanikaniCorrect, initial, "WaniKani correct reading", true);
    await next(page);
    await expect(page.locator('[aria-label="Bunpro review"]:visible')).toBeVisible();
    states.bunproUnanswered = await answerLayout(page);
    expectAnswerLayout(states.bunproUnanswered, initial, "Bunpro unanswered");

    if (study.voiceAnswers) {
      const voice = page.getByRole("button", { name: "Answer with voice", exact: true });
      await expect(voice).toBeVisible();
      expect((await voice.boundingBox())!.y, "Voice control follows the answer form").toBeGreaterThanOrEqual(states.bunproUnanswered.form.bottom);
    }
    if (study.srsProgressionCardDisplayMode === "hidden") {
      await expect(session(page).locator("[data-srs-progression-slot]")).toHaveCount(0);
      await expect(session(page).locator('[class*="keyboardHint"] kbd')).toHaveCount(0);
    }
    if (study.srsProgressionCardDisplayMode === "compact") {
      await expect(session(page).locator("[data-srs-progression-slot]")).toHaveAttribute("data-mode", "compact");
    }

    await answer(page, "ちがう");
    states.bunproIncorrect = await answerLayout(page);
    expectAnswerLayout(states.bunproIncorrect, initial, "Bunpro incorrect", true);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await answer(page, "です");
    states.bunproCorrect = await answerLayout(page);
    expectAnswerLayout(states.bunproCorrect, initial, "Bunpro correct", true);
    await testInfo.attach("answer-layouts", { body: JSON.stringify({ initial, ...states }, null, 2), contentType: "application/json" });
    await page.screenshot({ path: testInfo.outputPath("bunpro-correct.png"), animations: "disabled" });
  });
}

function session(page: Page) { return page.locator('[data-study-session="active"]:visible').last(); }
async function answer(page: Page, value: string) {
  const input = page.getByRole("textbox", { name: "Your answer" });
  await input.fill("");
  await input.pressSequentially(value);
  await expect(page.getByRole("button", { name: "Check", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeVisible();
}
async function next(page: Page) { await page.getByRole("button", { name: "Next", exact: true }).click(); }

test("isolated Bunpro save failure shows an error and restores the next draft after explicit continue", async ({ page }, testInfo) => {
  test.skip(!process.env.MIXED_REVIEW_BASE_URL, "Requires the isolated mixed-review fixture server");
  test.setTimeout(90_000);
  await openMixedReviews(page);

  let releaseFailure!: () => void;
  const failureReady = new Promise<void>((resolve) => { releaseFailure = resolve; });
  let submittedReviews = 0;
  await page.route(/\/api\/bunpro(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    submittedReviews += 1;
    await failureReady;
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Bunpro request failed (500)." }) });
  });

  await answer(page, "river");
  await next(page);
  await expect(page.locator("#study-prompt-title")).toHaveText("reading");
  await answer(page, "かわ");
  await next(page);
  await expect(page.locator('[aria-label="Bunpro review"]:visible')).toBeVisible();
  await answer(page, "です");
  await next(page);

  const wanikaniPrompt = page.locator('[aria-label="Review prompt"]:visible');
  await expect(wanikaniPrompt).toContainText("森");
  const input = page.getByRole("textbox", { name: "Your answer" });
  await input.fill("forest");
  await expect(input).toHaveValue("forest");
  expect(submittedReviews).toBe(1);

  releaseFailure();

  await expect(page.locator('[aria-label="Bunpro review"]:visible')).toBeVisible();
  await expect(session(page).getByRole("alert")).toContainText("Bunpro request failed (500).");
  await expect(session(page).getByRole("alert")).toBeInViewport({ ratio: 1 });
  await expect(input).toHaveValue("です");
  await expect(page.getByRole("button", { name: "Retry save", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Continue without saving", exact: true })).toBeInViewport({ ratio: 1 });
  await expect(wanikaniPrompt).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("save-failure-awaits-choice.png"), animations: "disabled" });

  await page.getByRole("button", { name: "Continue without saving", exact: true }).click();

  await expect(page.getByRole("status").filter({ hasText: "Bunpro could not confirm saving 1 answer." })).toBeVisible();
  await expect(wanikaniPrompt).toContainText("森");
  await expect(page.locator('[aria-label="Bunpro review"]:visible')).toHaveCount(0);
  await expect(input).toHaveValue("forest");
  await expect(session(page).getByRole("alert")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("save-failure-continued-to-draft.png"), animations: "disabled" });

  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(session(page).getByText("Correct", { exact: true })).toBeVisible();
  expect(submittedReviews).toBe(1);
});

async function geometry(page: Page) {
  return session(page).evaluate((root) => {
    const bounds = (selector: string) => {
      const element = root.querySelector(selector);
      if (!element) throw new Error(`Missing review anchor: ${selector}`);
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    return {
      input: bounds('input[aria-label="Your answer"]'),
      hint: bounds('[class*="keyboardHint"]'),
      srs: bounds("[data-srs-progression-slot]"),
      scrollY: window.scrollY,
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
}
type Geometry = Awaited<ReturnType<typeof geometry>>;

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const result = await geometry(page);
  await writeFile(testInfo.outputPath(`${name}-geometry.json`), JSON.stringify(result, null, 2));
  await testInfo.attach(`${name}-geometry`, { body: JSON.stringify(result, null, 2), contentType: "application/json" });
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), animations: "disabled" });
  return result;
}

function expectAnchors(actual: Geometry, expected: Geometry, state: string) {
  for (const anchor of ["input", "hint", "srs"] as const) {
    expect.soft(Math.abs(actual[anchor].y - expected[anchor].y), `${state}: ${anchor} vertical position`).toBeLessThanOrEqual(1);
    if (anchor !== "hint") {
      expect.soft(Math.abs(actual[anchor].x - expected[anchor].x), `${state}: ${anchor} left edge`).toBeLessThanOrEqual(1);
      expect.soft(Math.abs(actual[anchor].height - expected[anchor].height), `${state}: ${anchor} height`).toBeLessThanOrEqual(1);
    }
  }
  expect.soft(actual.scrollY, `${state}: viewport should remain at the top`).toBe(0);
  expect.soft(actual.horizontalOverflow, `${state}: horizontal overflow`).toBeLessThanOrEqual(1);
}

for (const viewport of [{ width: 1512, height: 862 }, { width: 1024, height: 768 }, { width: 768, height: 900 }]) {
  test(`mixed reviews keep shared layout anchors at ${viewport.width}×${viewport.height}`, async ({ page, isMobile }, testInfo) => {
    test.skip(isMobile, "Desktop mixed-review geometry regression");
    test.skip(!process.env.MIXED_REVIEW_BASE_URL, "Requires the isolated mixed-review fixture server");
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openMixedReviews(page);

    const initial = await capture(page, testInfo, "wanikani-unanswered");
    await answer(page, "wrong");
    const wanikaniIncorrect = await capture(page, testInfo, "wanikani-incorrect");
    await page.getByRole("button", { name: "Mark Correct", exact: true }).click();
    await expect(page.locator("#study-prompt-title")).toHaveText("reading");
    await answer(page, "かわ");
    await expect(session(page).getByText("Correct", { exact: true })).toBeVisible();
    const wanikaniCorrect = await capture(page, testInfo, "wanikani-correct");
    await next(page);
    await expect(page.locator('[aria-label="Bunpro review"]:visible')).toBeVisible();

    const bunpro = await capture(page, testInfo, "bunpro-unanswered");
    await answer(page, "ちがう");
    await expect(session(page).getByText("Incorrect", { exact: true })).toBeVisible();
    const incorrect = await capture(page, testInfo, "bunpro-incorrect");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await answer(page, "です");
    await expect(session(page).getByText("Correct", { exact: true })).toBeVisible();
    const correct = await capture(page, testInfo, "bunpro-correct");

    await next(page);
    await expect(page.locator('[aria-label="Review prompt"]:visible')).toBeVisible();
    await expect(session(page).locator('[data-srs-progression-slot] [role="status"]')).toBeVisible();
    const wanikaniProgression = await capture(page, testInfo, "wanikani-srs");
    await answer(page, "forest");
    await next(page);
    await answer(page, "もり");
    await next(page);
    await expect(page.locator('[aria-label="Bunpro review"]:visible')).toBeVisible();
    const bunproNext = await capture(page, testInfo, "bunpro-next-question");

    for (const [name, measurement] of Object.entries({ wanikaniIncorrect, wanikaniCorrect, bunpro, incorrect, correct, wanikaniProgression, bunproNext })) {
      expectAnchors(measurement, initial, name);
    }
    expectAnchors(incorrect, bunpro, "Bunpro incorrect answer");
    expectAnchors(correct, bunpro, "Bunpro correct answer");
  });
}


for (const viewport of [{ width: 1512, height: 862, reducedMotion: "reduce" }, { width: 1024, height: 768, reducedMotion: "no-preference" }] as const) {
for (const source of ["wanikani", "bunpro"] as const) {
  for (const panel of source === "wanikani" ? ["details"] : ["details", "alternatives"]) {
    test(`${source} ${panel} shortcut shrinks the prompt and reveals the panel start at ${viewport.width}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: viewport.reducedMotion });
      await openMixedReviews(page);
      if (source === "bunpro") {
        await answer(page, "river"); await next(page);
        await answer(page, "かわ"); await next(page);
        await expect(page.locator('[aria-label="Bunpro review"]:visible')).toBeVisible();
      }
      await answer(page, source === "bunpro" ? "です" : "river");
      const prompt = session(page).locator('[class*="questionCard"]');
      const initialHeight = (await prompt.boundingBox())!.height;
      const shortcut = panel === "alternatives" ? "a" : "d";
      await page.getByRole("textbox", { name: "Your answer" }).focus();
      await page.keyboard.press(shortcut);
      const content = panel === "alternatives"
        ? session(page).getByRole("heading", { name: "Accepted answers", exact: true })
        : source === "wanikani" ? page.locator("#study-item-details") : page.getByRole("region", { name: "Bunpro item details" });
      await expect(content).toBeVisible();
      await expect.poll(async () => (await prompt.boundingBox())!.height).toBeLessThan(initialHeight - 32);
      if (panel === "details" || viewport.width === 1024) await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
      await expect.poll(async () => (await content.boundingBox())!.y).toBeLessThan(viewport.height - 120);
      expect((await content.boundingBox())!.y).toBeGreaterThanOrEqual(0);
      await page.screenshot({ path: testInfo.outputPath(`${source}-${panel}-open.png`), animations: "disabled" });
      if (source === "bunpro" && panel === "details") {
        // Closing one disclosure must not expand the prompt over the other.
        await page.keyboard.press("a");
        await expect(session(page).getByRole("heading", { name: "Accepted answers", exact: true })).toBeVisible();
        await page.keyboard.press("d");
        await expect.poll(async () => (await prompt.boundingBox())!.height).toBeLessThan(initialHeight - 32);
        await page.keyboard.press("a");
      } else await page.keyboard.press(shortcut);
      await expect.poll(async () => (await prompt.boundingBox())!.height).toBeCloseTo(initialHeight, 0);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    });
  }
}
}


for (const source of ["wanikani", "bunpro"]) test(`missed ${source} questions return within ten combined mixed-review questions`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openMixedReviews(page, { backToBackQuestions: false, reviewBatchSizeEnabled: false }, true);
  const prompt = page.locator('[aria-label="Review prompt"]:visible');
  const original = await prompt.textContent();
  if (source === "bunpro") {
    await answer(page, "river");
    await next(page);
    await expect(page.locator('[aria-label="Bunpro review"]:visible')).toBeVisible();
  }
  await answer(page, "wrong");
  await next(page);
  let gap = 0;
  const services = new Set<string>();
  while (gap <= 10) {
    const wanikani = await prompt.count() > 0;
    const kind = wanikani ? await page.locator("#study-prompt-title").textContent() : "grammar";
    if (source === "wanikani" ? wanikani && kind === "meaning" && await prompt.textContent() === original : !wanikani && await session(page).getByText("Retrying missed item", { exact: true }).count() > 0) break;
    services.add(wanikani ? "wanikani" : "bunpro");
    await answer(page, wanikani ? kind === "reading" ? "かわ" : "river" : "です");
    await next(page);
    gap++;
  }
  expect(services).toEqual(new Set(["wanikani", "bunpro"]));
  expect(gap).toBeGreaterThanOrEqual(2);
  expect(gap).toBeLessThanOrEqual(10);
  if (source === "wanikani") {
    await expect(prompt).toHaveText(original!);
    await expect(page.locator("#study-prompt-title")).toHaveText("meaning");
  } else await expect(session(page).getByText("Retrying missed item", { exact: true })).toBeVisible();
  await answer(page, source === "wanikani" ? "river" : "です");
  await expect(session(page).getByText("Correct", { exact: true })).toBeVisible();
});


for (const source of ["wanikani", "bunpro"]) test(`submitted ${source} reading shows the finalized trailing n`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openMixedReviews(page);
  await answer(page, "river");
  await next(page);
  await expect(page.locator("#study-prompt-title")).toHaveText("reading");
  if (source === "bunpro") {
    await answer(page, "かわ");
    await next(page);
    await expect(page.locator('[aria-label="Bunpro review"]:visible')).toBeVisible();
  }
  const input = page.getByRole("textbox", { name: "Your answer" });
  await input.pressSequentially("chian");
  await expect(input).toHaveValue("ちあn");
  if (source === "wanikani") await input.press("Enter");
  else await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(input).toHaveValue("ちあん");
  await expect(session(page).getByText("Incorrect", { exact: true })).toBeVisible();
});

for (const width of [390, 1280]) test(`WK quick add to lists stays on the current review at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await openMixedReviews(page, { answerStopBehavior: "never", pauseOnCorrect: false });
  await answer(page, "river");
  const bookmark = session(page).getByRole("button", { name: "Add to saved lists" });
  await bookmark.click();
  const dialog = page.getByRole("dialog", { name: "Add to Lists" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "New list" }).fill("Practice later");
  await page.waitForTimeout(700);
  await expect(session(page).getByRole("heading", { name: "meaning", exact: true })).toBeVisible();
  await dialog.getByRole("textbox", { name: "New list" }).press("Enter");
  await expect(dialog.getByRole("checkbox")).toBeChecked();
  const bounds = (await dialog.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
  await page.screenshot({ path: testInfo.outputPath(`quick-add-${width}.png`) });
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("kakehashi-web:subject-lists:portego:v1")!).lists[0].subjectIds)).toEqual([1]);
});

test("Bunpro Context keeps the review visible while its code loads", async ({ page }) => {
  test.setTimeout(120_000);
  await openMixedReviews(page);
  const vocab = {
    ...grammar[0],
    data: { ...grammar[0].data, attributes: { ...grammar[0].data.attributes, reviewable_type: "Vocab" }, relationships: { ...grammar[0].data.relationships, reviewable: { data: { id: "20", type: "vocab" } } } },
    included: [
      { id: "30", type: "study_question", attributes: { content: "外側", answer: "outside", translation: "outside" } },
      { id: "20", type: "vocab", attributes: { id: 20, title: "外側", slug: "outside", kana: "そとがわ", meaning: "outside" } },
    ],
  };
  await page.route(/\/api\/bunpro(?:\?.*)?$/, (route) => {
    const action = new URL(route.request().url()).searchParams.get("action");
    if (action === "connection") return fulfillJson(route, { connected: true });
    if (action === "queue") return fulfillJson(route, { review_session_id: 101, pending_attempt: [vocab], pending_wrapup: [] });
    if (action === "details") return fulfillJson(route, { data: vocab.included[1], included: [] });
    return fulfillJson(route, {});
  });
  await page.route("**/apiv2.immersionkit.com/**", (route) => fulfillJson(route, { examples: [], data: {} }));
  await page.goto("/bunpro-reviews?mode=vocab");
  await expect(page.getByLabel("Your answer")).toBeVisible();
  await page.getByLabel("Your answer").fill("outside");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await page.getByRole("button", { name: "Info", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Context", exact: true })).toBeVisible();
  let releaseChunk!: () => void;
  const chunkGate = new Promise<void>((resolve) => { releaseChunk = resolve; });
  let requested = false;
  await page.route(/BunproContext.*\.js/, async (route) => { requested = true; await chunkGate; await route.continue(); });
  const errors: string[] = [];
  let navigations = 0;
  page.on("framenavigated", (frame) => { if (frame === page.mainFrame()) navigations++; });
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.getByRole("tab", { name: "Context", exact: true }).click();
    await expect.poll(() => requested).toBe(true);
    await expect(page.getByLabel("Your answer")).toBeVisible({ timeout: 2000 });
    await expect(page.getByLabel("Your answer")).toHaveValue("outside");
    await expect(page.getByRole("status").filter({ hasText: "Loading anime context" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Context", selected: true })).toBeVisible();
  } finally { releaseChunk(); }
  await expect(page.getByRole("heading", { name: "Anime context" })).toBeVisible();
  expect(errors).toEqual([]);
  expect(navigations).toBe(0);
});
