import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";

function seal(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update("mixed-layout-test-session-secret-32-characters").digest(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}
const grammar = {
  data: { id: "20", type: "grammar_point", attributes: { id: 20, title: "です", slug: "desu", meaning: "To be", level: "JLPT5" } },
  included: [{ id: "30", type: "study_question", attributes: { content: "私（わたし）は学生（がくせい）____。", answer: "です", alternate_grammar: ["だ"], translation: "I am a student.", female_audio_url: "https://example.com/desu.mp3" } }],
};
test.beforeEach(async ({ page }) => {
  await page.context().addCookies([{ name: "kakehashi_wk_session", value: seal("mixed-layout-test-token"), url: "http://127.0.0.1:3101" }]);
  await page.addInitScript(() => {
    localStorage.setItem("kakehashi-web:settings:portego:v1", JSON.stringify({ study: { pauseOnCorrect: true, pauseOnWrong: true, showDetailsOnWrongAnswer: false, showAnswerStopSubjectDetails: false, answerFeedbackSoundEnabled: false, autoplayAudio: false } }));
    // Audio playback is deterministic; no third-party media is requested.
    window.Audio = class extends EventTarget {
      play() { queueMicrotask(() => this.dispatchEvent(new Event("ended"))); return Promise.resolve(); }
      pause() {}
    } as unknown as typeof Audio;
  });
  await page.route("**/api/session/wanikani", route => route.fulfill({ json: { user: { id: 1, object: "user", data: { username: "Portego", level: 2, preferences: {}, subscription: { active: true, max_level_granted: 60 } } } } }));
});

for (const [mode, title] of [["sentence-drill", "Sentence drill"], ["mastery-loop", "Mastery loop"], ["no-hints", "No-hints challenge"], ["listening-cloze", "Listening cloze"]]) {
  test(`${title} selects non-due grammar and completes without SRS requests`, async ({ page }, testInfo) => {
    const requests: string[] = [];
    await page.route(/\/api\/bunpro(?:\?.*)?$/, route => {
      const request = route.request();
      const action = new URL(request.url()).searchParams.get("action");
      requests.push(`${request.method()}:${action}`);
      return route.fulfill({ json: action === "practice-catalog" ? { grammar: [{ ...grammar.data.attributes, id: "20", streak: 8 }] } : action === "details" ? grammar : { connected: true } });
    });
    await page.goto(`/bunpro-practice/${mode}`);
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(page.getByText(/1 matching grammar points/)).toBeVisible();
    await page.getByRole("button", { name: "Start practice" }).click();
    const answer = page.getByRole("textbox", { name: "Your answer" });
    await expect(answer).toBeVisible();
    const translation = page.getByText("I am a student.", { exact: true });
    if (mode === "no-hints" || mode === "listening-cloze") await expect(translation).not.toBeVisible();
    else await expect(translation).toBeVisible();
    if (mode === "listening-cloze") {
      await expect(page.getByRole("button", { name: "Listen to sentence" })).toBeVisible();
      await page.getByRole("button", { name: "Show sentence", exact: true }).click();
      await expect(page.getByRole("button", { name: "Listen to sentence" })).toBeVisible();
      await page.getByRole("button", { name: "Hide sentence", exact: true }).click();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${mode}-question.png`) });
    for (const value of mode === "mastery-loop" ? ["ちがう", "です", "です"] : ["です"]) {
      await answer.fill(value);
      await page.getByRole("button", { name: "Check", exact: true }).click();
      await page.getByRole("button", { name: "Next", exact: true }).click();
    }
    await expect(page.getByRole("heading", { name: `${title} complete` })).toBeVisible();
    await expect(page.getByText("Bunpro SRS is unchanged.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Practice again", exact: true }).click();
    await expect(answer).toBeVisible();
    expect(requests.every(request => request.startsWith("GET:"))).toBe(true);
    expect(requests.some(request => request.includes("queue") || request.includes("review"))).toBe(false);
  });
}

test("practice filters and hub fit narrow screens and restore saved filters", async ({ page }, testInfo) => {
  await page.route(/\/api\/bunpro(?:\?.*)?$/, route => route.fulfill({ json: new URL(route.request().url()).searchParams.get("action") === "practice-catalog" ? { grammar: [{ ...grammar.data.attributes, id: "20", streak: 8 }] } : { connected: true } }));
  await page.addInitScript(() => localStorage.setItem("kakehashi-web:bunpro-practice-filters:1:v2", JSON.stringify({ pool: "studied", levels: ["N5"], stages: [7, 8, 9], size: 5, sentences: 1, query: "" })));
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/bunpro-practice/mastery-loop");
    await expect(page.getByLabel("Grammar points per round")).toHaveValue("5");
    await expect(page.getByRole("checkbox", { name: "Seasoned", exact: true })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "N4", exact: true })).not.toBeChecked();
    await expect(page.getByRole("button", { name: "Start practice" })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`practice-setup-${width}.png`), fullPage: true });
    await page.goto("/study");
    await expect(page.getByRole("heading", { name: "Bunpro grammar practice" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`practice-hub-${width}.png`), fullPage: true });
  }
});

test("filters automatically include only matching SRS and JLPT grammar and disable empty pools", async ({ page }) => {
  await page.route(/\/api\/bunpro(?:\?.*)?$/, route => route.fulfill({ json: new URL(route.request().url()).searchParams.get("action") === "practice-catalog" ? { grammar: [
    { ...grammar.data.attributes, id: "20", streak: 8 },
    { ...grammar.data.attributes, id: "21", level: "JLPT4", streak: null },
  ] } : { connected: true } }));
  await page.goto("/bunpro-practice/sentence-drill");
  await expect(page.getByText(/1 matching grammar points/)).toBeVisible();
  await page.getByRole("checkbox", { name: "Seasoned", exact: true }).uncheck();
  await expect(page.getByText(/0 matching grammar points/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Start practice" })).toBeDisabled();
  await page.getByRole("combobox", { name: "Grammar pool", exact: true }).selectOption("new");
  await expect(page.getByText(/1 matching grammar points/)).toBeVisible();
  await page.getByRole("checkbox", { name: "N4", exact: true }).uncheck();
  await expect(page.getByRole("button", { name: "Start practice" })).toBeDisabled();
});
