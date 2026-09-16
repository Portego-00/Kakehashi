import { expect, test, type Page, type Route } from "@playwright/test";
import type { WebStudyPreferences } from "../src/features/settings/settings";

const now = "2026-09-17T10:00:00.000Z";
const user = {
  id: 1, object: "user", url: "", data_updated_at: now,
  data: {
    username: "Portego", level: 4, profile_url: "", started_at: now,
    current_vacation_started_at: null, preferences: {},
    subscription: { active: true, type: "lifetime", max_level_granted: 60 },
  },
};

function vocabulary(id: number, characters: string, meaning: string, reading: string, level: number) {
  return {
    id, object: "vocabulary", url: "", data_updated_at: now,
    data: {
      level, created_at: now, slug: characters, document_url: `https://www.wanikani.com/vocabulary/${encodeURIComponent(characters)}`,
      hidden_at: null, characters,
      meanings: [{ meaning, primary: true, accepted_answer: true }], auxiliary_meanings: [],
      readings: [{ reading, primary: true, accepted_answer: true }],
      meaning_mnemonic: `Remember ${meaning.toLowerCase()}.`, reading_mnemonic: `Read it as ${reading}.`,
      component_subject_ids: [], context_sentences: [], parts_of_speech: ["noun"],
      pronunciation_audios: [{ url: "https://example.test/review-audio.mp3", content_type: "audio/mpeg", metadata: { gender: "female", voice_actor_id: 1, pronunciation: reading } }],
    },
  };
}

const subjects = [vocabulary(7, "川", "River", "かわ", 2), vocabulary(8, "山", "Mountain", "やま", 4)];

function assignment(subject: typeof subjects[number], mode: "reviews" | "lessons") {
  return {
    id: subject.id + 100, object: "assignment", url: "", data_updated_at: now,
    data: {
      subject_id: subject.id, subject_type: subject.object, srs_stage: mode === "lessons" ? 0 : subject.id === 7 ? 3 : 5,
      available_at: "2020-01-01T00:00:00.000Z", started_at: mode === "lessons" ? null : now,
      unlocked_at: now, passed_at: null, burned_at: null, resurrected_at: null, hidden: false, created_at: now,
    },
  };
}

function collection(data: unknown[]) {
  return { object: "collection", url: "", pages: { next_url: null, previous_url: null, per_page: 1000 }, total_count: data.length, data_updated_at: now, data };
}

function fulfillJson(route: Route, json: unknown) {
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(json) });
}

async function openQuiz(page: Page, options: { mode?: "reviews" | "lessons"; study?: Partial<WebStudyPreferences>; multipleSubjects?: boolean; startRadical?: boolean } = {}) {
  const mode = options.mode ?? "reviews";
  const selectedSubjects = options.startRadical ? [{ ...subjects[0], object: "radical", data: { ...subjects[0].data, characters: "土", meanings: [{ meaning: "Ground", primary: true, accepted_answer: true }] } }, subjects[1]] : options.multipleSubjects ? subjects : subjects.slice(0, 1);
  const assignments = selectedSubjects.map((subject) => assignment(subject, mode));
  const submissions: unknown[] = [];
  await page.addInitScript((study) => {
    localStorage.setItem("kakehashi-web:settings:portego:v1", JSON.stringify({
      study: {
        reviewQuestionOrderEnabled: true, reviewQuestionOrder: "meaning-first", lessonQuestionOrder: "meaning-first",
        pauseOnCorrect: true, pauseOnWrong: true, showAnswerStopSubjectDetails: false,
        answerFeedbackSoundEnabled: false, autoplayAudio: false, ...study,
      },
      subjectDetails: { showImmersionExamples: false, showPitchAccent: false, showPatternsOfUse: false },
    }));
  }, options.study ?? {});
  await page.route("**/api/notebooks", (route) => fulfillJson(route, { notebooks: [] }));
  await page.route("**/api/custom-srs", (route) => fulfillJson(route, { available: false, state: null, revision: -1 }));
  await page.route("**/api/analytics/session", (route) => fulfillJson(route, { recorded: true }));
  await page.route(/\/api\/analytics\/study-time(?:\?.*)?$/, (route) => fulfillJson(route, { available: true, days: [] }));
  await page.route(/\/api\/analytics\/streak(?:\?.*)?$/, (route) => fulfillJson(route, { activeDays: [], available: true }));
  await page.route("**/api/subjects/lists", (route) => fulfillJson(route, { lists: [] }));
  await page.route("**/api/subjects/enrichments", (route) => fulfillJson(route, { pitchAccents: [], patterns: [] }));
  await page.route("**/api/study/vocabulary-frequency", (route) => fulfillJson(route, {
    result: { provider: "jiten", frequencyRank: 321, wordId: 7, readingIndex: 0, matchedText: "川", matchedReading: "かわ", sourceUrl: "https://jiten.moe/word/7" },
  }));
  await page.route("**/api/session/wanikani", (route) => fulfillJson(route, { user }));
  await page.route("**/api/wanikani/**", (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const resource = pathname.split("/").pop();
    if (resource === "user") return fulfillJson(route, user);
    if (resource === "assignments") return fulfillJson(route, collection(assignments));
    if (resource === "subjects") return fulfillJson(route, collection(selectedSubjects));
    const requestedAssignment = assignments.find((item) => String(item.id) === resource);
    if (requestedAssignment) return fulfillJson(route, requestedAssignment);
    if (resource === "reviews" && route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      submissions.push(body);
      const reviewed = assignments.find((item) => item.id === body.review.assignment_id)!;
      return fulfillJson(route, {
        id: 1, object: "review",
        data: { assignment_id: reviewed.id, subject_id: reviewed.data.subject_id, starting_srs_stage: reviewed.data.srs_stage, ending_srs_stage: reviewed.data.srs_stage + 1, created_at: now },
        resources_updated: {},
      });
    }
    if (resource === "start") return fulfillJson(route, assignments[0]);
    return fulfillJson(route, collection([]));
  });
  await page.goto(`/${mode}`);
  if (mode === "lessons") await page.getByRole("button", { name: "Start lesson review" }).click();
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible();
  return { submissions };
}

async function answer(page: Page, value: string) {
  await page.getByRole("textbox", { name: "Your answer" }).fill(value);
  await page.getByRole("button", { name: "Check", exact: true }).click();
}

test("wrong-answer actions display their keyboard shortcuts", async ({ page }, testInfo) => {
  await openQuiz(page);
  await answer(page, "mountain");
  for (const [name, key] of [["Mark Incorrect", "X"], ["Mark Correct", "C"], ["Skip", "A"], ["Add as synonym", "S"]]) {
    const action = page.getByRole("button", { name: new RegExp(name, "i") });
    await expect(action.locator("kbd")).toHaveText(key);
  }
  await expect(page.getByRole("button", { name: /Show subject details/i }).locator("kbd")).toHaveText("D");
  await page.screenshot({ path: testInfo.outputPath("answer-shortcuts.png"), fullPage: true, animations: "disabled" });
});

test("an enabled pre-answer Skip sits by the answer and shows animated feedback", async ({ page }, testInfo) => {
  const { submissions } = await openQuiz(page, { multipleSubjects: true, study: { allowSkippingReviews: true, reviewOrder: "ascendingSrsStage", backToBackQuestions: true } });
  const skip = page.locator('[class*="answerArea"]').getByRole("button", { name: /^Skip/i });
  await expect(skip).toBeVisible();
  await expect(skip.locator("kbd")).toHaveText("Alt A");
  await skip.click();
  await expect(page.getByText("Skipped", { exact: true })).toBeVisible();
  await expect(page.locator("#question-prompt")).toHaveText("山");
  expect(submissions).toHaveLength(0);
  const animated = await page.getByText("Skipped", { exact: true }).evaluate((element) => {
    const own = element.getAnimations({ subtree: true });
    const parent = element.parentElement?.getAnimations({ subtree: true }) ?? [];
    return [...own, ...parent].some((animation) => Number(animation.effect?.getComputedTiming().duration) > 0);
  });
  expect(animated).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("skipped-feedback.png"), fullPage: true });
});

test("turning off keyboard shortcuts hides keycaps without hiding actions", async ({ page }) => {
  await openQuiz(page, { study: { keyboardShortcuts: false } });
  await answer(page, "mountain");
  await expect(page.getByRole("button", { name: /Mark Correct/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Skip/i })).toBeVisible();
  await expect(page.locator("kbd")).toHaveCount(0);
});

test("the previous subject badge keeps its own radical color on a vocabulary question", async ({ page }, testInfo) => {
  await openQuiz(page, { startRadical: true, study: { reviewOrder: "ascendingSrsStage", backToBackQuestions: true } });
  await expect(page.locator("#question-prompt")).toHaveText("土");
  const radicalColor = await page.getByLabel("Review prompt", { exact: true }).evaluate((element) => getComputedStyle(element).backgroundColor);
  await answer(page, "ground");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator("#question-prompt")).toHaveText("山");
  const previous = page.getByRole("link", { name: "Previous meaning answer: Ground, correct" });
  await expect(previous).toBeVisible();
  const previousColor = await previous.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(previousColor).toBe(radicalColor);
  await page.screenshot({ path: testInfo.outputPath("previous-subject-color.png"), fullPage: true, animations: "disabled" });
});

test("toolbar icons remain readable on hover", async ({ page }, testInfo) => {
  await openQuiz(page, { study: { allowSkippingReviews: true, reviewSearchButtonEnabled: true } });
  for (const name of ["Exit reviews", "Search this item"]) {
    const control = page.getByRole("link", { name, exact: true });
    await control.hover();
    const contrast = await control.evaluate((element) => {
      const context = document.createElement("canvas").getContext("2d")!;
      const rgba = (color: string) => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data];
      };
      let background = [255, 255, 255, 255];
      const ancestors: Element[] = [];
      for (let parent: Element | null = element; parent; parent = parent.parentElement) ancestors.unshift(parent);
      for (const ancestor of ancestors) {
        const color = rgba(getComputedStyle(ancestor).backgroundColor);
        const alpha = color[3] / 255;
        background = background.map((value, index) => index === 3 ? 255 : color[index] * alpha + value * (1 - alpha));
      }
      const foreground = rgba(getComputedStyle(element).color);
      const luminance = (color: number[]) => color.slice(0, 3).map((value) => value / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
      const light = Math.max(luminance(background), luminance(foreground));
      const dark = Math.min(luminance(background), luminance(foreground));
      return (light + 0.05) / (dark + 0.05);
    });
    expect(contrast, `${name} hover contrast`).toBeGreaterThanOrEqual(3);
  }
  await page.screenshot({ path: testInfo.outputPath("toolbar-hover.png"), fullPage: true, animations: "disabled" });
});

test("the D shortcut expands subject details without jumping the page", async ({ page }, testInfo) => {
  await openQuiz(page);
  await answer(page, "mountain");
  await expect(page.locator("[data-answer-stop]")).toHaveCSS("opacity", "1");
  const before = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("d");
  await expect(page.getByRole("button", { name: /Hide subject details/i })).toBeVisible();
  await expect(page.locator("#study-item-details").locator("../..")).toHaveCSS("opacity", "1");
  const after = await page.evaluate(() => window.scrollY);
  expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("details-expanded-in-place.png"), fullPage: true, animations: "disabled" });
});

test("Alt+A skips from the answer input while plain A remains part of an answer", async ({ page }) => {
  await openQuiz(page, { multipleSubjects: true, study: { allowSkippingReviews: true, reviewOrder: "ascendingSrsStage", backToBackQuestions: true } });
  const input = page.getByRole("textbox", { name: "Your answer" });
  await input.fill("c");
  await input.press("a");
  await expect(input).toHaveValue("ca");
  await expect(page.locator("#question-prompt")).toHaveText("川");
  await input.press("Alt+a");
  await expect(page.locator("#question-prompt")).toHaveText("山");
  await expect(page.getByText("Skipped", { exact: true })).toBeVisible();
});

test("C, X, and A shortcuts work after submitting with the Check button focused", async ({ page }) => {
  const { submissions } = await openQuiz(page, { multipleSubjects: true, study: { reviewOrder: "ascendingSrsStage", backToBackQuestions: true, backToBackImmediateRetryIncorrect: true } });
  await answer(page, "mountain");
  await page.keyboard.press("c");
  await expect(page.locator("#study-prompt-title")).toHaveText("reading");
  await answer(page, "やま");
  await page.keyboard.press("x");
  await expect(page.getByRole("textbox", { name: "Your answer" })).toHaveValue("");
  await expect(page.locator("#study-prompt-title")).toHaveText("reading");
  await answer(page, "やま");
  await page.keyboard.press("a");
  await expect(page.locator("#question-prompt")).toHaveText("山");
  expect(submissions).toHaveLength(0);
});

test("the Skipped cue restarts for a repeated skip and then dismisses", async ({ page }) => {
  await openQuiz(page, { multipleSubjects: true, study: { allowSkippingReviews: true, reviewOrder: "ascendingSrsStage", backToBackQuestions: true } });
  const skip = page.getByRole("button", { name: "Skip review", exact: true });
  await skip.click();
  const cue = page.getByText("Skipped", { exact: true });
  await expect(cue).toBeVisible();
  const originalCue = await cue.elementHandle();
  await skip.click();
  await expect(cue).toBeVisible();
  expect(await originalCue!.evaluate((element) => element.isConnected)).toBe(false);
  await expect(page.locator("#question-prompt")).toHaveText("川");
  await expect(cue).toBeHidden({ timeout: 4000 });
});

test("reduced motion keeps skip feedback visible without the entry animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openQuiz(page, { multipleSubjects: true, study: { allowSkippingReviews: true, reviewOrder: "ascendingSrsStage", backToBackQuestions: true } });
  await page.getByRole("button", { name: "Skip review", exact: true }).click();
  const cue = page.getByText("Skipped", { exact: true });
  await expect(cue).toBeVisible();
  const movement = await cue.evaluate((element) => {
    const container = element.parentElement!;
    return container.getAnimations({ subtree: true }).some((animation) => {
      const frames = (animation.effect as KeyframeEffect).getKeyframes();
      return frames.some((frame) => frame.transform && frame.transform !== "none");
    });
  });
  expect(movement).toBe(false);
  await expect(cue).toBeHidden({ timeout: 4000 });
});

test("an empty disabled Check stays neutral and readable on hover", async ({ page }, testInfo) => {
  await openQuiz(page, { study: { allowSkippingReviews: false } });
  const check = page.getByRole("button", { name: "Check", exact: true });
  await expect(check).toBeDisabled();
  const resting = await check.evaluate((element) => ({ background: getComputedStyle(element).backgroundColor, color: getComputedStyle(element).color }));
  await check.hover();
  await expect(check).toHaveCSS("background-color", resting.background);
  await expect(check).toHaveCSS("color", resting.color);
  await page.screenshot({ path: testInfo.outputPath("disabled-check-hover.png"), fullPage: true, animations: "disabled" });
});

test("phone keyboard layout keeps the enabled Skip within the answer area", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Phone keyboard geometry only");
  await openQuiz(page, { multipleSubjects: true, study: { allowSkippingReviews: true, reviewOrder: "ascendingSrsStage", backToBackQuestions: true } });
  await page.getByRole("textbox", { name: "Your answer" }).focus();
  await page.evaluate(() => {
    const viewport = window.visualViewport!;
    Object.defineProperties(viewport, {
      height: { configurable: true, get: () => 320 },
      offsetTop: { configurable: true, get: () => 80 },
    });
    viewport.dispatchEvent(new Event("resize"));
    viewport.dispatchEvent(new Event("scroll"));
  });
  const skip = page.getByRole("button", { name: "Skip review", exact: true });
  await expect(skip).toBeVisible();
  await expect.poll(async () => {
    const rect = await skip.boundingBox();
    return rect ? rect.y + rect.height : Infinity;
  }).toBeLessThanOrEqual(400);
  const overflow = await page.locator('[class*="answerArea"]').evaluate((element) => element.scrollHeight - element.clientHeight);
  expect(overflow).toBeLessThanOrEqual(1);
});
