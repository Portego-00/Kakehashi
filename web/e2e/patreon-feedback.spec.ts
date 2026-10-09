import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";
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
  return { id, object: "kanji", url: "", data_updated_at: timestamp, data: {
    level: id, created_at: timestamp, slug: characters,
    document_url: `https://www.wanikani.com/vocabulary/${encodeURIComponent(characters)}`,
    hidden_at: null, characters, meanings: [{ meaning, primary: true, accepted_answer: true }],
    auxiliary_meanings: [], readings: [{ reading, primary: true, accepted_answer: true, type: "kunyomi" }],
    meaning_mnemonic: `Picture the shape of ${characters} to remember ${meaning.toLowerCase()}.`, reading_mnemonic: `Say ${reading} as you picture the ${meaning.toLowerCase()}. Keep the sound and image together when you review.`, component_subject_ids: [],
    meaning_hint: "Look at the shape of the river.", reading_hint: "Use the image to remember the kana reading.",
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

const screenshotRoot = resolve("../docs/screenshots/patreon-feedback-show-more-2026-10-08");
async function prepare(page: Page, study: Partial<WebStudyPreferences> = {}) {
  await page.context().addCookies([{ name: "kakehashi_wk_session", value: testSession(), url: "http://127.0.0.1:3101" }]);
  await page.addInitScript((study) => localStorage.setItem("kakehashi-web:settings:portego:v1", JSON.stringify({
    study: { reviewQuestionOrderEnabled: true, reviewQuestionOrder: "meaning-first", reviewOrder: "lowestLevelFirst", pauseOnCorrect: true,
      answerFeedbackSoundEnabled: false, autoplayAudio: false, showReviewItemLevelAndSrsStage: true, ...study },
    subjectDetails: { showImmersionExamples: false, showPitchAccent: false, showPatternsOfUse: false },
  })), study);
  await page.route("**/api/session/wanikani", (route) => fulfillJson(route, { user }));
  await page.route("**/api/notebooks", (route) => fulfillJson(route, { available: true, state: { version: 1, pages: [], sentences: [] }, revision: 0 }));
  await page.route("**/api/custom-srs", (route) => fulfillJson(route, { available: false, state: null, revision: -1 }));
  await page.route("**/api/analytics/**", (route) => fulfillJson(route, { available: true, days: [], activeDays: [], recorded: true }));
  await page.route("**/api/subjects/lists", (route) => fulfillJson(route, { lists: [] }));
  await page.route("**/api/subjects/enrichments", (route) => fulfillJson(route, { pitchAccents: [], patterns: [] }));
  await page.route("**/api/wanikani/**", (route) => {
    const resource = new URL(route.request().url()).pathname.split("/").pop();
    if (resource === "user") return fulfillJson(route, user);
    if (resource === "assignments") return fulfillJson(route, collection(assignments));
    if (resource === "subjects") return fulfillJson(route, collection(subjects));
    return fulfillJson(route, collection([]));
  });
  await mkdir(screenshotRoot, { recursive: true });
}
async function snapshot(page: Page, name: string, fullPage = false) {
  await page.screenshot({ path: resolve(screenshotRoot, name), fullPage, animations: "disabled" });
}
test("standard default, optional compact layout, secondary disclosure and panel choice persist", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await prepare(page);
  await page.goto("/reviews");
  const input = page.getByRole("textbox", { name: "Your answer" });
  await expect(input).toBeVisible();
  const shell = page.locator('[data-study-session="active"]');
  await expect(shell).not.toHaveAttribute("data-review-layout", "compact");
  await snapshot(page, "01-standard-reviews.png");
  await input.fill("River");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await page.getByRole("button", { name: "Review settings", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "Review settings" });
  await expect(settings.getByLabel("Compact review layout", { exact: true })).not.toBeChecked();
  await settings.getByLabel("Compact review layout", { exact: true }).check();
  await settings.getByLabel("Default review panel", { exact: true }).selectOption("reading");
  await snapshot(page, "02-review-settings.png");
  await settings.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: /^Show subject details/ }).click();
  await expect(page.getByRole("tab", { name: "Reading", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#study-item-details")).toBeInViewport();
  await expect(shell).toHaveAttribute("data-review-layout", "compact");
  await page.waitForTimeout(650);
  await snapshot(page, "03-compact-reviews.png", true);
  const bounds = () => page.locator("#study-item-details").boundingBox();
  const answerBounds = (await input.boundingBox())!;
  expect((await bounds())!.y).toBeGreaterThan(answerBounds.y + answerBounds.height);
  expect(Math.abs((await bounds())!.x - answerBounds.x)).toBeLessThan(2);
  const reveal = page.locator('[data-review-details-reveal]').first();
  expect(await reveal.evaluate((element) => getComputedStyle(element).overflowY)).not.toBe("auto");
  await expect(page.getByRole("heading", { name: "Subject details", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Readings", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Reading mnemonic", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Reading note", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Notebook", exact: true })).toHaveCount(0);
  await expect(page.getByText("Use the image to remember the kana reading.")).toHaveCount(0);
  const more = page.getByRole("button", { name: "Show more", exact: true });
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await more.click();
  await expect(page.getByRole("button", { name: "Show less", exact: true })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("heading", { name: "Reading note", exact: true })).toBeVisible();
  await expect(page.getByText("Use the image to remember the kana reading.")).toBeVisible();
  await expect(page.getByText("Add this subject to a notebook page to keep your study notes together.")).toBeVisible();
  await snapshot(page, "04-show-more.png", true);
  await page.getByRole("button", { name: "Show less", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Reading note", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Reading mnemonic", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Meaning", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mnemonic", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your progression", exact: true })).toHaveCount(0);
  await snapshot(page, "05-compact-meaning.png", true);
  await page.getByRole("button", { name: "Review settings", exact: true }).click();
  await settings.getByLabel("Default review panel", { exact: true }).selectOption("stroke");
  await settings.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Stroke", exact: true })).toHaveAttribute("aria-selected", "true");
  expect((await bounds())!.y).toBeGreaterThan((await input.boundingBox())!.y);
  await snapshot(page, "04b-compact-stroke.png");
  await page.getByRole("button", { name: "Review settings", exact: true }).click();
  await expect(settings.getByLabel("Compact review layout", { exact: true })).toBeChecked();
  await expect(settings.getByLabel("Default review panel", { exact: true })).toHaveValue("stroke");
  await settings.getByRole("button", { name: "Done", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const form = page.locator('[data-study-session="active"] form').first();
  await expect.poll(async () => (await form.boundingBox())!.width).toBeGreaterThan(330);
  expect(Math.abs((await bounds())!.x - (await form.boundingBox())!.x)).toBeLessThan(2);
  expect((await bounds())!.y).toBeGreaterThan((await input.boundingBox())!.y);
});
const firstId = "00000000-0000-4000-8000-000000000001";
const secondId = "00000000-0000-4000-8000-000000000002";
const replyId = "00000000-0000-4000-8000-000000000003";
const issue = { id: firstId, title: "Choose a default review panel", content: "It would be great to choose which review panel opens first: Meaning, Reading, or Stroke.", status: "open", user_username: "Portego", created_at: "2026-10-01T10:00:00Z", updated_at: "2026-10-08T10:00:00Z", likes_count: 4, reply_count: 1 };
const comments = [{ id: replyId, issue_id: firstId, user_username: "yomokha", content: "Thanks! Having Reading open by default and a compact view would make reviews much easier to navigate on my laptop.", created_at: "2026-10-08T10:00:00Z", likes_count: 2 }];
async function communityFixture(page: Page) {
  await page.route("**/community/api?**", (route) => {
    const action = new URL(route.request().url()).searchParams.get("action");
    if (action === "activity") return fulfillJson(route, { configured: true, items: [
      { issue, posted: true, participatedAt: issue.created_at, comments: [], latestReply: { id: replyId, createdAt: comments[0].created_at, username: "yomokha" } },
      { issue: { ...issue, id: secondId, title: "Keep review controls visible on smaller screens", status: "closed", content: "A shorter prompt leaves room for the answer and its details." }, posted: false, participatedAt: issue.created_at, comments: [{ id: "my-comment", content: "I’d love an optional compact layout so I can keep everything on one screen.", createdAt: "2026-10-07T10:00:00Z" }], latestReply: null },
    ] });
    if (action === "issue") return fulfillJson(route, { configured: true, writable: true, issue, comments, commentPage: 0, commentsHasMore: false });
    return fulfillJson(route, { configured: true, writable: true, items: [issue], counts: { open: 1, closed: 1 } });
  });
}
test("activity badge clears after reading and stays clear after reload", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await prepare(page);
  await communityFixture(page);
  await page.goto("/community");
  const activity = page.getByRole("tab", { name: /My activity/ });
  await expect(activity).toContainText("1");
  await activity.click();
  await expect(page.getByText("New reply", { exact: true })).toBeVisible();
  await snapshot(page, "05-my-activity.png");
  await page.getByRole("link", { name: /Choose a default review panel/ }).click();
  const reply = page.locator(`#comment-${replyId}`);
  await reply.scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("kakehashi-web:community-read:portego:v1"))).toContain(comments[0].created_at);
  await page.goto("/community");
  await activity.click();
  await expect(page.getByText("New reply", { exact: true })).toHaveCount(0);
  await snapshot(page, "06-my-activity-read.png");
  await page.setViewportSize({ width: 390, height: 844 });
  await snapshot(page, "07-my-activity-mobile.png");
});
