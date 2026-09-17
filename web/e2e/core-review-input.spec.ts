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

async function openQuiz(page: Page, options: { mode?: "reviews" | "lessons"; study?: Partial<WebStudyPreferences>; multipleSubjects?: boolean; endingStage?: number } = {}) {
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
    if (resource === "subjects") return fulfillJson(route, collection([...selectedSubjects, kanji]));
    const requestedAssignment = assignments.find((item) => String(item.id) === resource);
    if (requestedAssignment) return fulfillJson(route, requestedAssignment);
    if (resource === "reviews" && route.request().method() === "POST") {
      submissions.push(route.request().postDataJSON());
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




for (const [value, verdict] of [["kawa", "Correct"], ["yama", "Incorrect"]]) {
  test(`edited warning submits ${verdict} with one Enter and autoplays`, async ({ page }) => {
    await page.addInitScript(() => {
      Object.assign(window, { reviewAudioPlays: [] });
      HTMLMediaElement.prototype.play = function () {
        (window as unknown as { reviewAudioPlays: string[] }).reviewAudioPlays.push(this.src);
        return Promise.resolve();
      };
    });
    await openQuiz(page, { study: { reviewQuestionOrder: "reading-first", autoplayAudio: true } });
    const input = page.getByRole("textbox", { name: "Your answer" });
    await input.fill("sen");
    await input.press("Enter");
    await expect(page.getByText("Try another answer", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { reviewAudioPlays: string[] }).reviewAudioPlays)).toEqual([]);
    await input.fill(value);
    await input.press("Enter");
    await expect(page.getByText(verdict, { exact: true })).toBeVisible();
    await expect(input).toHaveValue(value === "kawa" ? "かわ" : "やま");
    expect(await page.evaluate(() => (window as unknown as { reviewAudioPlays: string[] }).reviewAudioPlays)).toEqual(["https://example.test/review-audio.mp3"]);
  });
}

test("cold font loading finishes for the entire queue before the first question", async ({ page }) => {
  let fontRequests = 0;
  await page.route(/\.woff2?(?:\?.*)?$/, async (route) => {
    fontRequests++;
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.continue();
  });
  await openQuiz(page, { multipleSubjects: true, study: { reviewOrder: "lowestLevelFirst", backToBackQuestions: true } });
  expect(fontRequests).toBeGreaterThan(0);
  const ready = await page.locator("#question-prompt span").first().evaluate((element) => {
    const style = getComputedStyle(element);
    return { weight: style.fontWeight, loaded: document.fonts.check(`${style.fontWeight} 1em ${style.fontFamily}`, "川森") };
  });
  expect(ready).toEqual({ weight: "350", loaded: true });
  await answer(page, "River");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("button", { name: "Check", exact: true })).toBeVisible();
  await answer(page, "kawa");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator("#question-prompt")).toHaveText("森");
  expect(await page.locator("#question-prompt span").first().evaluate((element) => {
    const style = getComputedStyle(element);
    return document.fonts.check(`${style.fontWeight} 1em ${style.fontFamily}`, element.textContent ?? "");
  })).toBe(true);
});

for (const [endingStage, direction, mode] of [[4, "up", "normal"], [2, "down", "compact"], [3, "same", "normal"]] as const) {
  test(`shows SRS ${direction} and keeps the Enter hint still`, async ({ page }, testInfo) => {
    await openQuiz(page, { multipleSubjects: true, endingStage, study: { reviewOrder: "lowestLevelFirst", backToBackQuestions: true, srsProgressionCardDisplayMode: mode } });
    await answer(page, "River");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("button", { name: "Check", exact: true })).toBeVisible();
    await answer(page, "kawa");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator("#question-prompt")).toHaveText("森");
    const notice = page.getByRole("status", { name: "SRS progression" });
    await expect(notice).toHaveAttribute("data-direction", direction);
    await expect(notice).toContainText(direction === "same" ? "SRS unchanged" : `SRS ${direction}`);
    await expect(notice).toContainText("Apprentice III");
    const hint = page.locator("p").filter({ hasText: /^Press Enter to check/ });
    const before = await hint.evaluate((element) => element.getBoundingClientRect().y);
    await page.screenshot({ path: testInfo.outputPath(`srs-${direction}.png`), fullPage: true, scale: "css" });
    await expect(notice).toBeHidden({ timeout: 5000 });
    const after = await hint.evaluate((element) => element.getBoundingClientRect().y);
    expect(Math.abs(after - before)).toBeLessThan(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
