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
      return fulfillJson(route, { id: 1, object: "review", data: { assignment_id: assignments[0].id, starting_srs_stage: 3, ending_srs_stage: 4 }, resources_updated: {} });
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


for (const displayMode of ["normal", "compact"] as const) {
  test(`SRS ${displayMode}: new-stage icon and stable hint through entrance and exit`, async ({ page, isMobile }, testInfo) => {
    await openQuiz(page, { multipleSubjects: true, study: { srsProgressionCardDisplayMode: displayMode, reviewOrder: "ascendingSrsStage", backToBackQuestions: true } });
    await answer(page, "river");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await answer(page, "かわ");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    const notice = page.getByRole("status", { name: "SRS progression" });
    await expect(notice).toBeVisible();
    await expect(notice.locator("use")).toHaveAttribute("href", "/srs/srs-icons.svg#apprentice-4");
    await expect(notice).toContainText("Apprentice IV");
    await expect(notice).toHaveCSS("opacity", "1");
    const hint = isMobile ? page.getByRole("textbox", { name: "Your answer" }) : page.locator("p").filter({ hasText: /^Press Enter to check/ });
    await expect(hint).toBeVisible();
    const before = await hint.boundingBox();
    const slot = page.locator("[data-srs-progression-slot]");
    const height = await slot.evaluate((element) => element.getBoundingClientRect().height);
    await page.screenshot({ path: testInfo.outputPath(`srs-${displayMode}.png`), fullPage: true });
    await expect(notice).toHaveCount(0, { timeout: 5000 });
    const after = await hint.boundingBox();
    expect(Math.abs(after!.y - before!.y)).toBeLessThan(1);
    expect(await slot.evaluate((element) => element.getBoundingClientRect().height)).toBe(height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("settings search finds typos and focuses the existing feedback-sound toggle", async ({ page }, testInfo) => {
  await openQuiz(page);
  await page.goto("/settings");
  const search = page.getByRole("searchbox", { name: "Search settings" });
  await search.fill("feeback soud");
  await expect(page.getByRole("list", { name: "Settings search results" })).toBeVisible();
  const result = page.getByRole("button", { name: /Answer feedback sounds/ });
  await expect(result).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("settings-fuzzy-search.png"), fullPage: true });
  await result.click();
  const toggle = page.getByRole("checkbox", { name: /Answer feedback sounds/ });
  await expect(toggle).toBeFocused();
  await expect(toggle).not.toBeChecked();
  await toggle.press("Space");
  await expect(toggle).toBeChecked();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("kakehashi-web:settings:portego:v1")!).study.answerFeedbackSoundEnabled)).toBe(true);
  await search.fill("dark");
  await expect(page.getByRole("button", { name: /Appearance/ })).toBeVisible();
  await search.fill("nothingmatcheshere");
  await expect(page.getByText("No settings found. Try another word.")).toBeVisible();
  await search.press("Escape");
  await expect(search).toHaveValue("");
});
