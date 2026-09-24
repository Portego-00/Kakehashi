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





test("review settings preserve partial answers, completed questions, and review submissions", async ({ page }) => {
  const { submissions } = await openQuiz(page, { multipleSubjects: true, study: { reviewOrder: "lowestLevelFirst", backToBackQuestions: true } });
  await answer(page, "River");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const input = page.getByRole("textbox", { name: "Your answer" });
  await input.fill("ka");
  await page.getByRole("button", { name: "Review settings", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Review settings" });
  await dialog.getByLabel("Review subject order", { exact: true }).selectOption("currentLevelFirst");
  await dialog.getByLabel("Theme", { exact: true }).selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("heading", { name: "reading", exact: true })).toBeVisible();
  await expect(input).toHaveValue("か");
  await expect(page.locator('[aria-label="Review prompt"]').getByRole("heading")).toHaveText("川");
  await answer(page, "kawa");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect.poll(() => submissions.length).toBe(1);
  await expect(page.locator('[aria-label="Review prompt"]').getByRole("heading")).toHaveText("森");
  await page.getByRole("button", { name: "Review settings", exact: true }).click();
  await dialog.getByLabel("Anki mode", { exact: true }).selectOption("both");
  await dialog.getByLabel("Group meaning and reading", { exact: true }).check();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Your answer" })).toHaveCount(0);
  await expect(page.locator('[aria-label="Review prompt"]').getByRole("heading")).toHaveText("森");
  expect(submissions).toHaveLength(1);
});

test("settings pause automatic progression and isolate keyboard shortcuts", async ({ page }) => {
  await openQuiz(page, { multipleSubjects: true, study: { reviewOrder: "lowestLevelFirst", backToBackQuestions: true, pauseOnCorrect: false } });
  await answer(page, "River");
  await page.getByRole("button", { name: "Review settings", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Review settings" });
  await dialog.getByLabel("Pause on correct answer", { exact: true }).check();
  await page.waitForTimeout(1000);
  await expect(page.getByRole("heading", { name: "meaning", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Review settings", exact: true })).toBeFocused();
  await expect(page.getByRole("textbox", { name: "Your answer" })).toHaveValue("River");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { name: "reading", exact: true })).toBeVisible();
});

test("review controls match, prompt scaling works, and modal actions stay visible", async ({ page }) => {
  await openQuiz(page, { study: { reviewSearchButtonEnabled: true } });
  const settings = page.getByRole("button", { name: "Review settings", exact: true });
  const search = page.getByRole("link", { name: "Search this item", exact: true });
  const styles = (locator: typeof settings) => locator.evaluate((node) => {
    const css = getComputedStyle(node);
    return { width: css.width, height: css.height, background: css.backgroundColor, border: css.border, color: css.color };
  });
  expect.soft(await styles(settings)).toEqual(await styles(search));
  expect.soft(await settings.evaluate((node) => node.previousElementSibling?.getAttribute("aria-label"))).toBe("Search this item");
  const prompt = page.locator('[aria-label="Review prompt"] h2');
  const fontSize = () => prompt.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
  const initial = await fontSize();
  await settings.click();
  const dialog = page.getByRole("dialog", { name: "Review settings" });
  await expect.soft(dialog.getByLabel("Answer text size", { exact: true })).toHaveCount(0);
  await dialog.getByLabel("Question text size", { exact: true }).selectOption("1.4");
  await expect.soft.poll(fontSize).toBeCloseTo(initial * 1.4, 0);
  const done = dialog.getByRole("button", { name: "Done", exact: true });
  const close = dialog.getByRole("button", { name: "Close review settings", exact: true });
  await expect.soft(done).toBeInViewport();
  await dialog.getByLabel("Show listening translation", { exact: true }).scrollIntoViewIfNeeded();
  await expect.soft(close).toBeInViewport();
  await expect.soft(done).toBeInViewport();
  await done.click();
  await expect.soft.poll(fontSize).toBeCloseTo(initial * 1.4, 0);
  await settings.click();
  await expect(dialog.getByLabel("Question text size", { exact: true })).toHaveValue("1.4");
  await dialog.getByLabel("Question text size", { exact: true }).selectOption("0.7");
  await expect.poll(fontSize).toBeCloseTo(initial * 0.7, 0);
  await close.click();
});
