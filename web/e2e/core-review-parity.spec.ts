import { expect, test, type Page, type Route } from "@playwright/test";
import type { WebStudyPreferences } from "../src/features/settings/settings";

const now = "2026-09-16T10:00:00.000Z";
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

async function openQuiz(page: Page, options: { mode?: "reviews" | "lessons"; study?: Partial<WebStudyPreferences>; multipleSubjects?: boolean } = {}) {
  const mode = options.mode ?? "reviews";
  const selectedSubjects = options.multipleSubjects ? subjects : subjects.slice(0, 1);
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
      submissions.push(route.request().postDataJSON());
      return fulfillJson(route, { id: 1, object: "review", data: { assignment_id: assignments[0].id }, resources_updated: {} });
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

for (const mode of ["reviews", "lessons"] as const) {
  test(`${mode}: audio and subject details appear only after submitting, with compact answer feedback`, async ({ page }, testInfo) => {
    await openQuiz(page, { mode });
    await expect(page.getByRole("banner")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^(?:Audio|No audio|Replay audio|Info|Show subject details)$/i })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`${mode}-before-answer.png`), fullPage: true, scale: "css", animations: "disabled" });
    await answer(page, "mountain");
    await expect(page.getByText("Incorrect", { exact: true })).toBeVisible();
    await expect(page.getByText("Correct answer", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Replay audio/i })).toHaveCount(0);
    const details = page.getByRole("button", { name: /Show subject details/i });
    await expect(details).toBeVisible();
    await expect(page.locator("[data-answer-stop]")).toHaveCSS("opacity", "1");
    await page.screenshot({ path: testInfo.outputPath(`${mode}-incorrect-answer.png`), fullPage: true, scale: "css", animations: "disabled" });
    await details.click();
    await expect(page.getByRole("button", { name: /Hide subject details/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Subject details", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Open full subject/ })).toBeVisible();
    await expect(page.locator("#study-item-details").locator("../..")).toHaveCSS("opacity", "1");
    await page.screenshot({ path: testInfo.outputPath(`${mode}-subject-details.png`), fullPage: true, scale: "css", animations: "disabled" });
  });

  test(`${mode}: enabled level, SRS, and frequency settings appear on the quiz`, async ({ page }) => {
    await openQuiz(page, { mode, study: { showReviewItemLevelAndSrsStage: true, showVocabularyFrequency: true } });
    await expect(page.getByText("Level 2", { exact: true })).toBeVisible();
    await expect(page.getByText(mode === "reviews" ? "Apprentice III" : "Lesson", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Vocabulary frequency #321", { exact: true })).toBeVisible();
  });

  test(`${mode}: vocabulary audio is available after a reading answer is submitted`, async ({ page }) => {
    await openQuiz(page, { mode, study: { reviewQuestionOrder: "reading-first", lessonQuestionOrder: "reading-first" } });
    await expect(page.locator("#study-prompt-title")).toHaveText("reading");
    await expect(page.getByRole("button", { name: /Audio|Info|subject details/i })).toHaveCount(0);
    await answer(page, "やま");
    await expect(page.getByText("Incorrect", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Replay audio/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Show subject details/i })).toBeVisible();
  });
}

test("review ordering and back-to-back settings keep both questions of the highest SRS item together", async ({ page }) => {
  const { submissions } = await openQuiz(page, { multipleSubjects: true, study: { reviewOrder: "descendingSrsStage", backToBackQuestions: true } });
  await expect(page.locator("#question-prompt")).toHaveText("山");
  await expect(page.locator("#study-prompt-title")).toHaveText("meaning");
  await answer(page, "mountain");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator("#question-prompt")).toHaveText("山");
  await expect(page.locator("#study-prompt-title")).toHaveText("reading");
  expect(submissions).toHaveLength(0);
  await answer(page, "やま");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator("#question-prompt")).toHaveText("川");
  expect(submissions).toHaveLength(1);
});

test("review result overrides and skip change the queue without submitting an unfinished pair", async ({ page }) => {
  const { submissions } = await openQuiz(page, { multipleSubjects: true, study: { reviewOrder: "ascendingSrsStage", backToBackQuestions: true, backToBackImmediateRetryIncorrect: true, allowSkippingReviews: true } });
  await expect(page.locator("#question-prompt")).toHaveText("川");
  await answer(page, "mountain");
  await page.getByRole("button", { name: /Mark Correct/i }).click();
  await expect(page.locator("#study-prompt-title")).toHaveText("reading");
  await expect(page.getByRole("textbox", { name: "Your answer" })).toHaveValue("");
  await answer(page, "やま");
  await page.getByRole("button", { name: /Mark Incorrect/i }).click();
  await expect(page.locator("#question-prompt")).toHaveText("川");
  await expect(page.locator("#study-prompt-title")).toHaveText("reading");
  await expect(page.getByRole("textbox", { name: "Your answer" })).toHaveValue("");
  await answer(page, "やま");
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(page.locator("#question-prompt")).toHaveText("山");
  expect(submissions).toHaveLength(0);
});

for (const jitaiEnabled of [false, true]) {
  test(`review subject uses ${jitaiEnabled ? "the selected Jitai font" : "WaniKani's Noto Sans JP font"}`, async ({ page }) => {
    await openQuiz(page, { study: { jitaiEnabled, jitaiSelectedFontIds: ["mincho"] } });
    const character = page.locator("#question-prompt > [lang=ja]");
    await expect(character).toHaveCSS("font-weight", "350");
    const family = await character.evaluate((element) => getComputedStyle(element).fontFamily);
    if (jitaiEnabled) expect(family).toContain("Yu Mincho");
    else {
      expect(family).toMatch(/Noto[ _]Sans[ _]JP/);
      const loaded = await character.evaluate(async (element) => {
        const style = getComputedStyle(element);
        const faces = await document.fonts.load(`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`, element.textContent ?? "");
        return faces.some((face) => /Noto[ _]Sans[ _]JP/.test(face.family) && face.status === "loaded");
      });
      expect(loaded).toBe(true);
    }
  });
}
