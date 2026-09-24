import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { expect, test, type Page, type Route } from "@playwright/test";

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

async function openLessons(page: Page) {
  const url = "http://127.0.0.1:3101";
  const lessonSubjects = Array.from({ length: 10 }, (_, i) => vocabulary(i + 1, ["余る", "三個", "余計", "倒す", "個人", "面倒", "一個", "倒産", "個室", "厚い"][i], ["To Be In Surplus", "Three Small Things", "Unneeded", "To Knock Over", "Personal", "Trouble", "One Small Thing", "Bankruptcy", "Private Room", "Thick"][i], "かわ"));
  const lessons = lessonSubjects.map(subject => ({ ...assignments[0], id: subject.id + 100, data: { ...assignments[0].data, subject_id: subject.id, srs_stage: 0, started_at: null, available_at: null } }));
  await page.context().addCookies([{ name: "kakehashi_wk_session", value: testSession(), url }]);
  await page.addInitScript(() => {
    localStorage.setItem("kakehashi-web:settings:portego:v1", JSON.stringify({ study: { ankiMode: "both", ankiGroupQuestions: true, lessonsBatchSize: 5, lessonOrder: "ascendingLevel", lessonQuestionOrder: "meaning-first", backToBackQuestions: true, autoplayAudio: false, answerFeedbackSoundEnabled: false, showAnswerStopSubjectDetails: false, dailyLessonLimit: 0 } }));
  });
  await page.route("**/api/**", route => fulfillJson(route, {}));
  await page.route("**/api/session/wanikani", route => fulfillJson(route, { user }));
  await page.route("**/api/subjects/lists", route => fulfillJson(route, { lists: [] }));
  await page.route("**/api/subjects/enrichments", route => fulfillJson(route, { pitchAccents: [], patterns: [] }));
  await page.route("**/api/wanikani/**", async route => {
    const resource = new URL(route.request().url()).pathname.split("/").pop();
    if (resource === "user") return fulfillJson(route, user);
    if (resource === "assignments") return fulfillJson(route, collection(lessons));
    if (resource === "subjects") return fulfillJson(route, collection(lessonSubjects));
    if (resource === "start") {
      // Keep the network pending across the entire batch, without account writes.
      await new Promise(resolve => setTimeout(resolve, 60_000));
      return route.abort().catch(() => undefined);
    }
    const assignment = lessons.find(item => String(item.id) === resource);
    return fulfillJson(route, assignment ?? collection([]));
  });
  await page.goto(`${url}/lessons`);
  await expect(page.getByRole("button", { name: "Next lesson" })).toBeVisible();
}

for (const width of [320, 375, 414, 768, 1440]) {
  test(`compact lesson completion and pending saves at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
    await openLessons(page);
    await page.getByRole("button", { name: "Lesson 5: Personal" }).click();
    await page.getByRole("button", { name: "Start lesson review" }).click();
    for (let i = 0; i < 5; i++) {
      await page.getByRole("button", { name: /Reveal answer/i }).click();
      await page.getByRole("button", { name: /^Correct/ }).click();
    }
    await expect(page.getByRole("heading", { name: "Batch Complete!" })).toBeVisible({ timeout: 1000 });
    await expect(page.getByRole("status")).toContainText("5 waiting to sync");
    const next = page.getByRole("button", { name: "Next batch" });
    await expect(next).toBeInViewport();
    const geometry = await page.evaluate(() => ({ scroll: window.scrollY, width: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(geometry.width).toBeLessThanOrEqual(geometry.viewport);
    await page.screenshot({ path: `../output/lesson-complete-${width}.png`, fullPage: true });
    await next.click();
    await expect(page.getByRole("heading", { name: "Trouble", exact: true })).toBeVisible();
  });
}


test("lesson subjects scroll instantly while tab changes preserve position", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openLessons(page);
  await page.addStyleTag({ content: '[class*="lessonSubjectDetails"] { min-height: 150vh; }' });
  await page.evaluate(() => window.scrollTo({ top: 500, behavior: "instant" }));
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Reading", exact: true })).toHaveAttribute("aria-selected", "true");
  expect(await page.evaluate(() => window.scrollY)).toBe(500);
  await page.getByRole("button", { name: "Next lesson" }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.evaluate(() => window.scrollTo({ top: 500, behavior: "instant" }));
  await page.getByRole("button", { name: "Previous lesson" }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});
