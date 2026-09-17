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




test("related subjects open a new tab without leaving an unfinished review", async ({ page }) => {
  await openQuiz(page);
  await answer(page, "River");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("button", { name: "Check", exact: true })).toBeVisible();
  await answer(page, "kawa");
  await page.getByRole("button", { name: "Show subject details" }).click();
  await page.getByRole("tab", { name: "Meaning", exact: true }).click();
  const related = page.locator('#study-item-details a[href^="/subjects/8?"]');
  await expect(related).toHaveAttribute("target", "_blank");
  await expect(related).toHaveAttribute("rel", "noopener noreferrer");
  const popupPromise = page.waitForEvent("popup");
  await related.click();
  const popup = await popupPromise;
  expect(page.url()).toContain("/reviews");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "reading", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Your answer" })).toHaveValue("かわ");
  await popup.close();
});

test("leave confirmation keeps readable danger and neutral hover colors", async ({ page, isMobile }, testInfo) => {
  test.skip(isMobile, "Hover is a pointer interaction");
  await openQuiz(page);
  await answer(page, "River");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("button", { name: "Check", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Exit reviews" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (const name of ["Keep reviewing", "Leave reviews"]) {
    const button = dialog.getByRole("button", { name, exact: true });
    await button.hover();
    await button.evaluate(async (element) => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      getComputedStyle(element).getPropertyValue("background-color");
      await Promise.all(element.getAnimations().map((animation) => animation.finished));
    });
    // Compare final rendered colors after the hover transition.
    await expect.poll(() => button.evaluate((element) => {
      const style = getComputedStyle(element);
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d")!;
      const luminance = (color: string) => {
        context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1);
        const rgb = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map((c) => { const v = c / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
        return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
      };
      const foreground = luminance(style.color), background = luminance(style.backgroundColor);
      return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
    })).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({ path: testInfo.outputPath(`${name.replaceAll(" ", "-")}-hover.png`), fullPage: true, scale: "css" });
  }
  await dialog.getByRole("button", { name: "Keep reviewing" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("textbox", { name: "Your answer" })).toBeVisible();
});
