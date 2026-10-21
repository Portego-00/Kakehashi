import { test, expect, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type Server } from "node:http";

test.use({ trace: "off" });

const now = "2026-10-20T10:00:00.000Z";
async function setup(page: Page, username = "Portego", demo = false) {
  const user = { id: 1, object: "user", data_updated_at: now, data: { username, level: 4, preferences: {}, subscription: { active: true, type: "lifetime", max_level_granted: 60 }, current_vacation_started_at: null } };
  const subject = { id: 9, object: "vocabulary", data_updated_at: now, data: {
    level: 3, slug: "川", characters: "川", meanings: [{ meaning: "River", primary: true, accepted_answer: true }], auxiliary_meanings: [],
    readings: [{ reading: "かわ", primary: true, accepted_answer: true }], component_subject_ids: [], context_sentences: [], pronunciation_audios: [], parts_of_speech: ["noun"], meaning_mnemonic: "A river.", reading_mnemonic: "Kawa.",
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
      await expect(page.getByRole("button", { name: "Download and enable · 318 MB", exact: true })).not.toBeVisible();
      await expect(page.getByRole("heading", { name: "Reviews", exact: true })).toBeVisible();
      expect(await page.locator("#review-asr").evaluate(element => element.closest("section")?.getAttribute("aria-labelledby"))).toBe("reviews-heading");
      await page.locator("#review-asr").scrollIntoViewIfNeeded();
      await page.screenshot({ path: test.info().outputPath("speech-settings-collapsed.png") });
      await page.locator("#review-asr summary").click();
      await expect(page.getByRole("checkbox", { name: "On-device voice answers", exact: true })).not.toBeChecked();
      await expect(page.getByRole("button", { name: "Download and enable · 318 MB", exact: true })).toBeVisible();
    }
  });
}

for (const scenario of [{ kind: "reading", multipleChoice: true }, { kind: "meaning", multipleChoice: false }]) {
  test(`record button is visible for ${scenario.kind}, multiple choice=${scenario.multipleChoice}`, async ({ page }) => {
    await setup(page);
    await page.addInitScript(scenario => {
      localStorage.setItem("kakehashi-web:settings:portego:v1", JSON.stringify({ study: { reviewAsrEnabled: true, reviewMultipleChoiceEnabled: scenario.multipleChoice, reviewQuestionOrderEnabled: true, reviewQuestionOrder: scenario.kind === "meaning" ? "meaning-first" : "reading-first", autoplayAudio: false }, subjectDetails: { showImmersionExamples: false, showPitchAccent: false, showPatternsOfUse: false } }));
    }, scenario);
    await page.goto("/reviews");
    await expect(page.getByRole("button", { name: "Record answer", exact: true })).toBeVisible();
  });
}

for (const language of ["ja", "en"] as const) {
const english = language === "en";
const prefix = english ? "ENGLISH_ASR" : "JAPANESE_ASR";
const bytes = english ? 95_286_046 : 317_452_740;
const downloadSize = english ? 96 : 318;
const repository = english ? "Xenova/wav2vec2-base-960h" : "juujika/wav2vec2-japanese-hiragana-onnx";
const filename = english ? "onnx/model_quantized.onnx" : "onnx/model.onnx";
test(`local ${language} model recognizes audio into editable text without using the expected answer`, async ({ page }, info) => {
  test.skip(!(process.env[`${prefix}_REAL_MODEL`] || process.env[`${prefix}_MODEL_PATH`]) || !process.env[`${prefix}_AUDIO_PATH`], "Set JAPANESE_ASR_REAL_MODEL=1 and provide a Japanese WAV fixture to download the pinned model and run real inference.");
  test.skip(info.project.name !== "desktop", "Run the expensive real-model check once.");
  test.setTimeout(180_000);
  test.info().annotations.push({ type: "model", description: `Downloads the pinned ${downloadSize} MB ${language} ASR model and runs real browser inference.` });
  let mirror: Server | undefined;
  try {
    // Stream a previously verified pinned model without copying 318 MB through Playwright's protocol.
    if (process.env[`${prefix}_MODEL_PATH`]) {
      const modelPath = resolve(process.env[`${prefix}_MODEL_PATH`]!);
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
      if (!address || typeof address === "string") throw new Error("The model mirror did not start.");
      await page.route(`https://huggingface.co/${repository}/resolve/**/${filename}`, route => route.fulfill({ status: 302, headers: { location: `http://127.0.0.1:${address.port}/model.onnx`, "access-control-allow-origin": "*" } }));
    }
  await setup(page);
  await page.addInitScript(english => {
    if (!localStorage.getItem("kakehashi-web:settings:portego:v1")) localStorage.setItem("kakehashi-web:settings:portego:v1", JSON.stringify({ study: { reviewQuestionOrderEnabled: true, reviewQuestionOrder: english ? "meaning-first" : "reading-first", reviewMultipleChoiceEnabled: true, pauseOnCorrect: true, pauseOnWrong: true, answerFeedbackSoundEnabled: false, autoplayAudio: false }, subjectDetails: { showImmersionExamples: false, showPitchAccent: false, showPatternsOfUse: false } }));
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: async () => {
      const context = new AudioContext();
      await context.resume();
      const audio = await context.decodeAudioData(await (await fetch("/asr-fixture.wav")).arrayBuffer());
      const source = context.createBufferSource(); source.buffer = audio;
      const output = context.createMediaStreamDestination(); source.connect(output); source.start(context.currentTime + 0.2);
      output.stream.getTracks().forEach(track => track.addEventListener("ended", () => { void context.close(); }, { once: true }));
      return output.stream;
    }, configurable: true });
  }, english);
  await page.route("**/asr-fixture.wav", route => route.fulfill({ path: resolve(process.env[`${prefix}_AUDIO_PATH`]!), contentType: "audio/wav" }));
  await page.goto("/settings?category=reviews");
  await page.locator("#review-asr summary").click();
  const download = page.getByRole("button", { name: `Download and enable · ${downloadSize} MB`, exact: true });
  await expect(download).toBeEnabled(); await download.click();
  await Promise.race([
    expect(page.getByRole("checkbox", { name: "On-device voice answers", exact: true })).toBeChecked({ timeout: 120_000 }),
    page.locator("#review-asr [role=alert]").waitFor({ state: "visible", timeout: 120_000 }).then(async () => { throw new Error(await page.locator("#review-asr [role=alert]").innerText()); }),
  ]);
  await page.reload();
  await page.locator("#review-asr summary").click();
  await expect(page.getByRole("checkbox", { name: "On-device voice answers", exact: true })).toBeChecked();
  await page.screenshot({ path: info.outputPath("asr-settings.png"), fullPage: true });
  await page.goto("/reviews");
  const input = page.getByRole("textbox", { name: "Your answer", exact: true });
  await expect(page.getByRole("button", { name: "Record answer", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Record answer", exact: true }).click();
  await Promise.race([
    expect(input).toHaveValue(process.env[`${prefix}_EXPECTED_TEXT`] || (english ? "forest" : "きょう"), { timeout: 90_000 }),
    page.locator("main [role=alert]").waitFor({ state: "visible", timeout: 90_000 }).then(async () => { throw new Error(await page.locator("main [role=alert]").innerText()); }),
  ]);
  await expect(input).toBeEditable();
  await expect(page.getByRole("button", { name: "Check", exact: true })).toBeEnabled();
  await page.screenshot({ path: info.outputPath("recognized-kana.png"), fullPage: true });
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.locator('form[data-result="incorrect"]')).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator('form[data-result="incorrect"]')).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Record answer", exact: true })).toBeVisible();
  if (await input.count()) await expect(input).toHaveValue("");
  await page.goto("/settings?category=reviews");
  await page.locator("#review-asr summary").click();
  await page.getByRole("button", { name: "Remove model", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "On-device voice answers", exact: true })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "On-device voice answers", exact: true })).toBeDisabled();
  } finally { if (mirror) await new Promise<void>(resolve => mirror!.close(() => resolve())); }
});

}
