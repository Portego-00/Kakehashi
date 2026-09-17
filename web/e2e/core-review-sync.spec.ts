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
      component_subject_ids: [] as number[], context_sentences: [], parts_of_speech: ["noun"],
      pronunciation_audios: [{ url: "https://example.test/review-audio.mp3", content_type: "audio/mpeg", metadata: { gender: "female", voice_actor_id: 1, pronunciation: reading } }],
    },
  };
}

const river = vocabulary(9, "川", "River", "かわ", 3);
river.data.component_subject_ids = [8];
const kanji = vocabulary(8, "川", "River", "せん", 3);
kanji.object = "kanji";
const subjects = [river, vocabulary(11, "森", "Forest", "もり", 4)];

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

async function openQuiz(page: Page, options: { mode?: "reviews" | "lessons"; study?: Partial<WebStudyPreferences>; multipleSubjects?: boolean; endingStage?: number; submit?: (route: Route, attempt: number) => Promise<void> } = {}) {
  const mode = options.mode ?? "reviews";
  const selectedSubjects = options.multipleSubjects ? subjects : subjects.slice(0, 1);
  const assignments = selectedSubjects.map((subject) => assignment(subject, mode));
  const submissions: unknown[] = [];
  await page.addInitScript((study) => {
    localStorage.setItem("kakehashi-web:settings:portego:v1", JSON.stringify({
      study: {
        reviewOrder: "lowestLevelFirst", reviewQuestionOrderEnabled: true, reviewQuestionOrder: "meaning-first", lessonQuestionOrder: "meaning-first",
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
    if (resource === "subjects") return fulfillJson(route, collection([...selectedSubjects, kanji]));
    const requestedAssignment = assignments.find((item) => String(item.id) === resource);
    if (requestedAssignment) return fulfillJson(route, requestedAssignment);
    if (resource === "reviews" && route.request().method() === "POST") {
      submissions.push(route.request().postDataJSON());
      if (options.submit) return options.submit(route, submissions.length);
      const review = route.request().postDataJSON().review;
      return fulfillJson(route, { id: 1, object: "review", data: { assignment_id: review.assignment_id, starting_srs_stage: 3, ending_srs_stage: options.endingStage ?? (review.incorrect_meaning_answers ? 2 : 4) }, resources_updated: {} });
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





async function completePair(page: Page, meaning: string, reading: string) {
  await answer(page, meaning);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await answer(page, reading);
  await page.getByRole("button", { name: "Next", exact: true }).click();
}
async function pendingCount(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("kakehashi-review-outbox:portego:v1") || "[]").length);
}
const success = (stage = 6) => ({ id: 1, object: "review", data: { ending_srs_stage: stage }, resources_updated: {} });

test("next question and results are immediate during a slow upload, with optimistic SRS", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const { submissions } = await openQuiz(page, { multipleSubjects: true, study: { backToBackQuestions: true }, submit: async route => { await held; await fulfillJson(route, success()); } });
  await completePair(page, "River", "kawa");
  await expect(page.getByLabel("Review prompt")).toContainText("森", { timeout: 500 });
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeEditable();
  await expect(page.getByLabel("SRS progression")).toContainText("Guru II");
  await expect(page.getByLabel("SRS progression")).toContainText("SRS up");
  expect(await pendingCount(page)).toBe(1);
  await completePair(page, "Forest", "mori");
  await expect(page.getByRole("heading", { name: "Reviews Complete", exact: true })).toBeVisible({ timeout: 500 });
  expect(await pendingCount(page)).toBe(2);
  expect(submissions).toHaveLength(1);
  release();
  await expect.poll(() => pendingCount(page)).toBe(0);
  expect(submissions).toHaveLength(2);
});

test("temporary errors stay silent and retry again after the normal retries at session end", async ({ page }) => {
  const { submissions } = await openQuiz(page, { submit: async (route, attempt) => {
    if (attempt <= 3) await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Temporary outage" }) });
    else await fulfillJson(route, success());
  } });
  await completePair(page, "River", "kawa");
  await expect(page.getByRole("heading", { name: "Reviews Complete", exact: true })).toBeVisible({ timeout: 500 });
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await expect.poll(() => submissions.length).toBe(4);
  await expect.poll(() => pendingCount(page)).toBe(0);
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  const times = submissions.map(value => (value as { review: { created_at: string } }).review.created_at);
  expect(new Set(times).size).toBe(1);
});

test("only permission errors surface, and completed answers remain saved", async ({ page }) => {
  const { submissions } = await openQuiz(page, { submit: route => route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "Permission denied" }) }) });
  await completePair(page, "River", "kawa");
  await expect(page.getByRole("heading", { name: "Reviews Complete", exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("reviews:create");
  expect(await pendingCount(page)).toBe(1);
  expect(submissions).toHaveLength(1);
});

test("a late stage confirmation cannot replace the newer subject's SRS cue", async ({ page }) => {
  let releaseFirst!: () => void;
  let releaseSecond!: () => void;
  const first = new Promise<void>(resolve => { releaseFirst = resolve; });
  const second = new Promise<void>(resolve => { releaseSecond = resolve; });
  await openQuiz(page, { multipleSubjects: true, study: { backToBackQuestions: true }, submit: async (route, attempt) => {
    await (attempt === 1 ? first : second);
    await fulfillJson(route, success(attempt === 1 ? 3 : 6));
  } });
  await completePair(page, "River", "kawa");
  await completePair(page, "Forest", "mori");
  await expect(page.getByLabel("SRS progression")).toContainText("Guru II");
  releaseFirst();
  await expect.poll(() => pendingCount(page)).toBe(1);
  await expect(page.getByLabel("SRS progression")).toContainText("Guru II");
  await expect(page.getByLabel("SRS progression")).toContainText("SRS up");
  await page.getByRole("tab", { name: /All subjects/ }).click();
  await expect(page.getByRole("link", { name: /川/ })).toContainText("Apprentice III");
  releaseSecond();
  await expect.poll(() => pendingCount(page)).toBe(0);
});
