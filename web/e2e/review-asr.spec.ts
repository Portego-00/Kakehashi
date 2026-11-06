import { test, expect, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type Server } from "node:http";

test.use({ trace: "off" });

const now = "2026-10-20T10:00:00.000Z";
async function setup(page: Page, username = "Portego", demo = false, school = false) {
  const user = { id: 1, object: "user", data_updated_at: now, data: { username, level: 4, preferences: {}, subscription: { active: true, type: "lifetime", max_level_granted: 60 }, current_vacation_started_at: null } };
  const subject = { id: 9, object: "vocabulary", data_updated_at: now, data: {
    level: 3, slug: school ? "学校" : "川", characters: school ? "学校" : "川", meanings: [{ meaning: school ? "School" : "River", primary: true, accepted_answer: true }], auxiliary_meanings: [],
    readings: [{ reading: school ? "がっこう" : "かわ", primary: true, accepted_answer: true }], component_subject_ids: [], context_sentences: [], pronunciation_audios: [], parts_of_speech: ["noun"], meaning_mnemonic: "A river.", reading_mnemonic: "Kawa.",
  } };
  const assignment = { id: 109, object: "assignment", data_updated_at: now, data: { subject_id: 9, subject_type: "vocabulary", srs_stage: 5, available_at: "2020-01-01T00:00:00.000Z", started_at: now, unlocked_at: now, passed_at: null, burned_at: null, hidden: false } };
  const collection = (data: unknown[]) => ({ object: "collection", pages: { next_url: null, previous_url: null, per_page: 1000 }, total_count: data.length, data_updated_at: now, data });
  await page.route("**/api/session/wanikani", route => route.fulfill({ json: { user, demo } }));
  await page.route("**/api/custom-srs**", route => route.fulfill({ json: { available: false, state: null, revision: -1 } }));
  await page.route("**/api/subjects/lists", route => route.fulfill({ json: { lists: [] } }));
  await page.route("**/api/subjects/enrichments", route => route.fulfill({ json: { pitchAccents: [], patterns: [] } }));
  await page.route("**/api/wanikani/**", route => {
    const resource = new URL(route.request().url()).pathname.split("/").pop();
    return route.fulfill({ json: resource === "user" ? user : collection(resource === "subjects" ? [subject] : resource === "assignments" ? [assignment] : []) });
  });
}
for (const account of [{ username: "Portego", demo: false, allowed: true }, { username: "OtherUser", demo: false, allowed: false }, { username: "Portego", demo: true, allowed: false }]) {
  test(`Speech recognition settings gate: ${account.username}, demo=${account.demo}`, async ({ page }) => {
    await setup(page, account.username, account.demo);
    await page.goto("/settings?category=reviews");
    await expect(page.getByRole("searchbox", { name: "Search settings" })).toBeVisible();
    await expect(page.locator("#review-asr")).toHaveCount(account.allowed ? 1 : 0);
    if (account.allowed) {
      const disclosure = page.locator("#review-asr details");
      await expect(disclosure).not.toHaveAttribute("open", "");
      await expect(page.getByRole("button", { name: "Download and enable · 241 MB", exact: true })).not.toBeVisible();
      await expect(page.getByRole("heading", { name: "Reviews", exact: true })).toBeVisible();
      expect(await page.locator("#review-asr").evaluate(element => element.closest("section")?.getAttribute("aria-labelledby"))).toBe("reviews-heading");
      await page.locator("#review-asr").scrollIntoViewIfNeeded();
      await page.screenshot({ path: test.info().outputPath("speech-settings-collapsed.png") });
      await page.locator("#review-asr summary").click();
      await expect(page.getByRole("checkbox", { name: "On-device voice answers", exact: true })).not.toBeChecked();
      await expect(page.getByRole("button", { name: "Download and enable · 241 MB", exact: true })).toBeVisible();
    }
  });
}

for (const scenario of [{ kind: "reading", multipleChoice: true }, { kind: "meaning", multipleChoice: false }]) {
  test(`download button replaces the missing-model voice control for ${scenario.kind}, multiple choice=${scenario.multipleChoice}`, async ({ page }) => {
    await setup(page);
    await page.addInitScript(scenario => {
      localStorage.setItem("kakehashi-web:settings:portego:v1", JSON.stringify({ study: { reviewAsrEnabled: true, reviewMultipleChoiceEnabled: scenario.multipleChoice, reviewQuestionOrderEnabled: true, reviewQuestionOrder: scenario.kind === "meaning" ? "meaning-first" : "reading-first", autoplayAudio: false }, subjectDetails: { showImmersionExamples: false, showPitchAccent: false, showPatternsOfUse: false } }));
    }, scenario);
    await page.goto("/reviews");
    await expect(page.getByRole("button", { name: "Download and enable · 241 MB", exact: true })).toBeEnabled();
  });
}

test("one activation recognizes Japanese and English, ignores silence, and submits successive answers", async ({ page }, info) => {
  test.skip(!process.env.REVIEW_ASR_AUDIO_JA || !process.env.REVIEW_ASR_AUDIO_EN || !(process.env.REVIEW_ASR_MODEL_PATH || process.env.REVIEW_ASR_REAL_MODEL), "Provide real local-model and audio fixtures.");
  test.skip(info.project.name !== "desktop", "Run real model inference once.");
  test.setTimeout(240_000);
  let mirror: Server | undefined;
  try {
    if (process.env.REVIEW_ASR_MODEL_PATH) {
      const modelPath = resolve(process.env.REVIEW_ASR_MODEL_PATH);
      const bytes = 239_233_841;
      expect((await stat(modelPath)).size).toBe(bytes);
      mirror = createServer((request, response) => {
        const range = /^bytes=(\d+)-(\d+)$/.exec(request.headers.range || "");
        const start = range ? Number(range[1]) : 0;
        const end = range ? Number(range[2]) : bytes - 1;
        response.writeHead(range ? 206 : 200, { "content-type": "application/octet-stream", "content-length": end - start + 1, "content-range": `bytes ${start}-${end}/${bytes}`, "access-control-allow-origin": "*", "access-control-expose-headers": "content-range" });
        createReadStream(modelPath, { start, end }).pipe(response);
      });
      await new Promise<void>(resolve => mirror!.listen(0, "127.0.0.1", resolve));
      const address = mirror.address();
      if (!address || typeof address === "string") throw new Error("Model mirror did not start.");
      await page.route("https://huggingface.co/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/**/model.int8.onnx", route => route.fulfill({ status: 302, headers: { location: `http://127.0.0.1:${address.port}/model.onnx`, "access-control-allow-origin": "*" } }));
    }
    await setup(page, "Portego", false, true);
    await page.addInitScript(() => {
      if (!localStorage.getItem("kakehashi-web:settings:portego:v1")) localStorage.setItem("kakehashi-web:settings:portego:v1", JSON.stringify({ study: { reviewQuestionOrderEnabled: true, reviewQuestionOrder: "reading-first", reviewMultipleChoiceEnabled: false, reviewAsrEnabled: false, pauseOnCorrect: false, pauseOnWrong: true, answerFeedbackSoundEnabled: false, autoplayAudio: false }, subjectDetails: { showImmersionExamples: false, showPitchAccent: false, showPatternsOfUse: false } }));
      let capture = 0;
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", { configurable: true, value: async () => {
        const language = capture++ === 0 ? "ja" : "en";
        const context = new AudioContext(); await context.resume();
        const audio = await context.decodeAudioData(await (await fetch(`/asr-fixture-${language}.wav`)).arrayBuffer());
        const source = context.createBufferSource(); source.buffer = audio;
        const output = context.createMediaStreamDestination(); source.connect(output);
        // Exercise actual silence before speech, including VAD hallucination protection.
        source.start(context.currentTime + 2);
        output.stream.getTracks().forEach(track => {
          const stop = track.stop.bind(track);
          track.stop = () => { stop(); void context.close(); };
        });
        return output.stream;
      } });
    });
    await page.route("**/asr-fixture-ja.wav", route => route.fulfill({ path: resolve(process.env.REVIEW_ASR_AUDIO_JA!), contentType: "audio/wav" }));
    await page.route("**/asr-fixture-en.wav", route => route.fulfill({ path: resolve(process.env.REVIEW_ASR_AUDIO_EN!), contentType: "audio/wav" }));
    await page.goto("/reviews");
    const draft = page.getByRole("textbox", { name: "Your answer", exact: true });
    await draft.fill("が");
    await expect(draft).toHaveValue("が");
    await expect(page.getByRole("button", { name: "Check", exact: true })).toBeEnabled();
    await expect(draft).toHaveValue("が");
    await page.getByRole("button", { name: "Download and enable · 241 MB", exact: true }).click();
    await Promise.race([
      expect(page.getByRole("button", { name: "Start voice answers", exact: true })).toBeEnabled({ timeout: 150_000 }),
      page.locator("main [role=alert]").filter({ hasText: /download|storage|save/i }).waitFor({ state: "visible", timeout: 150_000 }).then(async () => { throw new Error("Review speech download failed."); }),
    ]);
    await expect(draft).toHaveValue("が");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("kakehashi-web:settings:portego:v1")!).study.reviewAsrEnabled)).toBe(true);
    await page.screenshot({ path: info.outputPath("downloaded-in-review.png"), fullPage: true });
    await page.getByRole("button", { name: "Start voice answers", exact: true }).click();
    await expect(page.getByText("Listening for a Japanese reading.", { exact: false })).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(900);
    await expect(page.getByRole("textbox", { name: "Your answer", exact: true })).toHaveValue("が");
    // A correct Japanese reading advances directly, without Check or Next.
    await expect(page.getByText("Listening for an English meaning.", { exact: false })).toBeVisible({ timeout: 30_000 });
    // Deliberately say river for a School card: recognition must not copy its expected answer.
    await expect(page.locator('form[data-result="incorrect"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("textbox", { name: "Your answer", exact: true })).toHaveValue("river");
    await expect(page.getByRole("button", { name: "Pause voice answers", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({ path: info.outputPath("english-auto-submitted.png"), fullPage: true });
    await page.getByRole("button", { name: "Pause voice answers", exact: true }).click();
    await page.goto("/settings?category=reviews");
    await page.locator("#review-asr summary").click();
    await expect(page.getByRole("checkbox", { name: "On-device voice answers", exact: true })).toBeChecked();
    await page.reload();
    await page.locator("#review-asr summary").click();
    await expect(page.getByRole("checkbox", { name: "On-device voice answers", exact: true })).toBeChecked();
    await page.getByRole("button", { name: "Remove model", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "On-device voice answers", exact: true })).not.toBeChecked();
  } finally { if (mirror) await new Promise<void>(resolve => mirror!.close(() => resolve())); }
});
