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

const radical = vocabulary(7, "一", "Ground", "", 1);
radical.object = "radical";
radical.data.readings = [];
const kanji = vocabulary(8, "山", "Mountain", "さん", 2);
kanji.object = "kanji";
const kana = vocabulary(10, "メモ", "Note", "", 4);
kana.object = "kana_vocabulary";
kana.data.readings = [];
const subjects = [radical, kanji, vocabulary(9, "川", "River", "かわ", 3), kana];

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
      const review = route.request().postDataJSON().review;
      return fulfillJson(route, { id: 1, object: "review", data: { assignment_id: review.assignment_id, starting_srs_stage: 3, ending_srs_stage: review.incorrect_meaning_answers ? 2 : 4 }, resources_updated: {} });
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



test("completes without a blank screen and shows mistakes, percentages, and every reviewed subject", async ({ page }, testInfo) => {
  const { submissions } = await openQuiz(page, { multipleSubjects: true, study: {
    reviewOrder: "lowestLevelFirst", backToBackQuestions: true, backToBackImmediateRetryIncorrect: true,
    reviewQuestionOrderEnabled: true, reviewQuestionOrder: "meaning-first", showAnswerStopSubjectDetails: false,
  } });
  let madeMistake = false;
  for (let step = 0; step < 7; step++) {
    const prompt = page.getByLabel("Review prompt", { exact: true });
    const text = (await prompt.textContent()) ?? "";
    const subject = subjects.find((item) => text.includes(item.data.characters));
    expect(subject).toBeTruthy();
    const reading = await page.getByRole("heading", { name: "reading", exact: true }).count() > 0;
    const wrong = subject!.id === 8 && !reading && !madeMistake;
    if (wrong) madeMistake = true;
    await answer(page, wrong ? "banana" : reading ? subject!.data.readings[0].reading : subject!.data.meanings[0].meaning);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeHidden();
  }
  await expect(page.getByRole("heading", { name: "Reviews Complete" })).toBeVisible({ timeout: 1500 });
  expect(submissions).toHaveLength(4);
  await expect(page.getByRole("img", { name: "First-try accuracy: 83% (5 of 6)" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Meaning accuracy: 75% (3 of 4)" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Reading accuracy: 100% (2 of 2)" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Mistakes (1)" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Meaning missed", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Practice mistakes" })).toHaveAttribute("href", "/study/custom-review?subjectIds=8&start=1");
  const mistakeLink = page.getByRole("link", { name: "Open 山 (Mountain) subject details" });
  await expect(mistakeLink).toHaveAttribute("href", "/subjects/8");
  await expect(mistakeLink).toHaveAttribute("target", "_blank");
  await expect(page.locator('circle[stroke-dasharray="100"]')).toHaveCSS("stroke-dashoffset", "17px");
  await page.screenshot({ path: testInfo.outputPath("review-mistakes.png"), fullPage: true, scale: "css" });
  await page.getByRole("tab", { name: "All subjects (4)" }).click();
  await expect(page.getByRole("link", { name: /subject details/ })).toHaveCount(4);
  await expect(page.getByText("No reading question", { exact: true })).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath("review-all-subjects.png"), fullPage: true, scale: "css" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
