// Local filesystem bookkeeping + documented CUA Playwright calls only.
// Importing does not touch a browser, read credentials, generate, or download.
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, link, lstat, mkdir, open, readFile, readdir, rmdir, unlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { homedir } from "node:os";
import { MANIFEST, OUTPUT, VOICE_ID, SETTINGS, validateManifest, reserveAttempt, withBudget, inspectAudio } from "./generate-custom-vocabulary-audio.mjs";

export const WEB_STATE = join(OUTPUT, "..", ".elevenlabs-web-generation");
export const DOWNLOAD_LOCK = join(OUTPUT, "..", "elevenlabs-download.lock");
export const DOWNLOADS = join(homedir(), "Downloads");
export const VARIANTS_OUTPUT = join(OUTPUT, "..", "qa", "variants");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const timestamp = () => new Date().toISOString();
const voiceName = "Shizuka - Natural & Soft";
export const V3_SETTINGS = Object.freeze({ stability: 0.5 });
export const APPROVED_V3_INPUTS = Object.freeze({
  "food-keeki": "ケーキ", "daily-meeru": "メール", "kanji-51-60-kareha": "枯れ葉",
  "meals-kukkii": "クッキー", "kana-expansion-miitingu": "ミーティング", "cafe-yooguruto": "ヨーグルト",
  "kanji-11-20-nyuuyoku": "にゅうよく", "kanji-expansion-26-30-47t6bwhxe": "ほうしん",
  "kanji-expansion-36-40-l73asb6llb1l": "ぶんぼうぐ", "clothes-seetaa": "セーター",
  "digital-purintaa": "プリンター", "home-teeburu": "テーブル", "kana-expansion-riidaa": "リーダー",
  "kana-expansion-seroteepu": "セロテープ", "shopping-baagen": "バーゲン", "kanji-11-20-riyou": "りよう",
  "kanji-21-30-reitou": "れいとう", "kanji-31-40-seisou": "せいそう", "kanji-51-60-tounyoubyou": "とうにょうびょう",
  "kanji-expansion-21-25-07t2cwe": "せいび", "kanji-expansion-51-55-47tb1i6a7n": "とうちょう",
  "kanji-expansion-56-60-57t5bzc6c4f": "てびょうし",
});
// Each pronunciation experiment is authorized separately from the original
// kana-input experiment. Bind all lexical fields, not just the reusable word ID.
export const APPROVED_V3_ORTHOGRAPHIC_INPUTS = Object.freeze({
  "kanji-11-20-riyou": Object.freeze({ characters: "利用", reading: "りよう" }),
  "kanji-11-20-nyuuyoku": Object.freeze({ characters: "入浴", reading: "にゅうよく" }),
  "kanji-21-30-reitou": Object.freeze({ characters: "冷凍", reading: "れいとう" }),
  "kanji-51-60-tounyoubyou": Object.freeze({ characters: "糖尿病", reading: "とうにょうびょう" }),
  "kanji-expansion-21-25-07t2cwe": Object.freeze({ characters: "整備", reading: "せいび" }),
  "kanji-expansion-26-30-47t6bwhxe": Object.freeze({ characters: "方針", reading: "ほうしん" }),
  "kanji-expansion-36-40-l73asb6llb1l": Object.freeze({ characters: "文房具", reading: "ぶんぼうぐ" }),
  "kanji-expansion-51-55-47tb1i6a7n": Object.freeze({ characters: "登頂", reading: "とうちょう" }),
  "kanji-expansion-56-60-57t5bzc6c4f": Object.freeze({ characters: "手拍子", reading: "てびょうし" }),
  "home-tisshu": Object.freeze({ characters: "ティッシュ", reading: "ティッシュ" }),
  "kanji-01-10-issai": Object.freeze({ characters: "一切", reading: "いっさい" }),
  "kanji-expansion-51-55-r63bcn9bwkna07a": Object.freeze({ characters: "一喜一憂", reading: "いっきいちゆう" }),
  "kanji-expansion-46-50-47t0b4cva": Object.freeze({ characters: "洞察", reading: "どうさつ" }),
  "kanji-expansion-51-55-97t4bwinc": Object.freeze({ characters: "見据える", reading: "みすえる" }),
  "kanji-41-50-gyougi": Object.freeze({ characters: "行儀", reading: "ぎょうぎ" }),
  "kanji-21-30-shudan": Object.freeze({ characters: "手段", reading: "しゅだん" }),
  "kanji-21-30-shuchou": Object.freeze({ characters: "主張", reading: "しゅちょう" }),
  "kanji-expansion-16-20-48t5d0ctc": Object.freeze({ characters: "文書", reading: "ぶんしょ" }),
  "kanji-expansion-16-20-38t0bzhoc": Object.freeze({ characters: "書店", reading: "しょてん" }),
  "kanji-11-20-tani": Object.freeze({ characters: "単位", reading: "たんい" }),
  "kanji-41-50-shitsudo": Object.freeze({ characters: "湿度", reading: "しつど" }),
  "kanji-expansion-41-45-47tb5gvg": Object.freeze({ characters: "包装", reading: "ほうそう" }),
  "kanji-51-60-kankonsousai": Object.freeze({ characters: "冠婚葬祭", reading: "かんこんそうさい" }),
  "kanji-expansion-41-45-k8t2ar2t": Object.freeze({ characters: "書籍", reading: "しょせき" }),
  "kanji-expansion-16-20-57ttaf9z": Object.freeze({ characters: "企業", reading: "きぎょう" }),
});
export const APPROVED_V3_HIRAGANA_INPUTS = Object.freeze({
  "home-teeburu": Object.freeze({ characters: "テーブル", reading: "テーブル", input: "てーぶる。" }),
  "clothes-seetaa": Object.freeze({ characters: "セーター", reading: "セーター", input: "せーたー。" }),
  "shopping-baagen": Object.freeze({ characters: "バーゲン", reading: "バーゲン", input: "ばーげん。" }),
  "kanji-expansion-51-55-r63bcn9bwkna07a": Object.freeze({ characters: "一喜一憂", reading: "いっきいちゆう", input: "いっきいちゆう。" }),
  "kanji-21-30-reitou": Object.freeze({ characters: "冷凍", reading: "れいとう", input: "れいとう。" }),
  "kanji-expansion-51-55-47tb1i6a7n": Object.freeze({ characters: "登頂", reading: "とうちょう", input: "とうちょう。" }),
  "kanji-51-60-kankonsousai": Object.freeze({ characters: "冠婚葬祭", reading: "かんこんそうさい", input: "かんこんそうさい。" }),
});
// The user requested corrections for these four words only. Long-vowel marks
// are pronunciation inputs, never changes to the catalog's written readings.
export const APPROVED_V3_KATAKANA_INPUTS = Object.freeze({
  "kanji-expansion-51-55-r63bcn9bwkna07a": Object.freeze({ characters: "一喜一憂", reading: "いっきいちゆう", input: "イッキイチユー。" }),
  "kanji-21-30-reitou": Object.freeze({ characters: "冷凍", reading: "れいとう", input: "レイトー。" }),
  "kanji-expansion-51-55-47tb1i6a7n": Object.freeze({ characters: "登頂", reading: "とうちょう", input: "トーチョー。" }),
  "kanji-51-60-kankonsousai": Object.freeze({ characters: "冠婚葬祭", reading: "かんこんそうさい", input: "カンコンソーサイ。" }),
});
export const APPROVED_V3_SPACED_INPUTS = Object.freeze({
  "kanji-expansion-51-55-r63bcn9bwkna07a": Object.freeze({ characters: "一喜一憂", reading: "いっきいちゆう", input: "いっき、いちゆう。" }),
  "kanji-51-60-kankonsousai": Object.freeze({ characters: "冠婚葬祭", reading: "かんこんそうさい", input: "かんこん、そうさい。" }),
});
export const APPROVED_V3_LONG_VOWELS_INPUTS = Object.freeze({
  "kanji-21-30-reitou": Object.freeze({ characters: "冷凍", reading: "れいとう", input: "レートー。" }),
});
const V3_PRONUNCIATION_INPUTS = Object.freeze({
  "v3-orthographic-v1": APPROVED_V3_ORTHOGRAPHIC_INPUTS,
  "v3-hiragana-v1": APPROVED_V3_HIRAGANA_INPUTS,
  "v3-katakana-v1": APPROVED_V3_KATAKANA_INPUTS,
  "v3-spaced-v1": APPROVED_V3_SPACED_INPUTS,
  "v3-long-vowels-v1": APPROVED_V3_LONG_VOWELS_INPUTS,
});
const V3_VARIANT_KINDS = new Set(["v3-punctuation-v1", ...Object.keys(V3_PRONUNCIATION_INPUTS)]);
function profileFor(entry) {
  return V3_VARIANT_KINDS.has(entry.variant?.kind)
    ? { modelId: "eleven_v3", settings: V3_SETTINGS, creditMultiplier: 2 }
    : { modelId: "eleven_multilingual_v2", settings: SETTINGS, creditMultiplier: 1 };
}
const fail = (message) => { throw new Error(message); };
async function exists(path) { try { return await lstat(path); } catch (e) { if (e.code === "ENOENT") return null; throw e; } }
async function exclusiveJson(path, data) {
  const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await handle.writeFile(`${JSON.stringify(data, null, 2)}\n`); await handle.sync(); } finally { await handle.close(); }
}

export async function loadAudioManifest() {
  const bytes = await readFile(MANIFEST);
  const manifest = JSON.parse(bytes);
  return { entries: validateManifest(manifest), manifestSha256: hash(bytes) };
}

export function webFingerprint(entry) {
  const profile = profileFor(entry);
  return hash(JSON.stringify({ id: entry.id, packId: entry.packId, text: entry.ttsInput, voiceId: VOICE_ID, model: profile.modelId, settings: profile.settings, languageOverride: "Japanese", outputFormat: "mp3_44100_128", method: "website" }));
}

export async function inspectExistingWebAudio(entry, outputDir = OUTPUT) {
  if (outputDir !== OUTPUT && outputDir !== VARIANTS_OUTPUT) fail("Audio outputs must use the fixed final or QA variant directory.");
  const audioPath = join(outputDir, entry.filename);
  const audioInfo = await exists(audioPath);
  const metadataInfo = await exists(`${audioPath}.json`);
  if (!audioInfo && !metadataInfo) return null;
  if (!audioInfo?.isFile() || audioInfo.isSymbolicLink() || !metadataInfo?.isFile() || metadataInfo.isSymbolicLink()) fail(`${entry.id}: incomplete existing output; do not overwrite or regenerate.`);
  const metadata = JSON.parse(await readFile(`${audioPath}.json`, "utf8"));
  const bytes = await readFile(audioPath);
  if (metadata.status !== "complete" || metadata.fingerprint !== webFingerprint(entry) || metadata.audio?.sha256 !== hash(bytes) || metadata.audio.bytes !== bytes.length) fail(`${entry.id}: existing output does not match; stop for reconciliation.`);
  return metadata;
}

async function markAttempt(attemptId, patch, status) {
  await withBudget(WEB_STATE, (ledger) => {
    const attempt = ledger.attempts.find((item) => item.id === attemptId);
    if (!attempt) fail("Missing website credit reservation.");
    Object.assign(attempt, patch, { updatedAt: timestamp() });
    if (status) ledger.words[attempt.wordId].status = status;
  });
}

// Only call after an agent has explicitly reconciled a named uncertain attempt.
// The old full credit reservation remains forever, even when no charge is visible.
export async function approveWebRetry(entry, attemptId, evidence) {
  if (typeof evidence !== "string" || evidence.trim().length < 40 || evidence.length > 4000) fail("A concrete explicit reconciliation record is required.");
  return withBudget(WEB_STATE, (ledger) => {
    const word = ledger.words[entry.id];
    const attempt = ledger.attempts.find((item) => item.id === attemptId);
    if (!attempt || attempt.wordId !== entry.id || attempt.fingerprint !== webFingerprint(entry) || word?.lastAttemptId !== attemptId || word.status !== "blocked") fail("Retry approval must name this word's latest blocked attempt.");
    if (word.retryApproval && !word.retryApproval.consumedAt) fail("An unused retry approval already exists.");
    if (ledger.attempts.filter((item) => item.wordId === entry.id).length >= 3) fail("Lifetime three-attempt limit reached.");
    word.retryApproval = { attemptId, evidence: evidence.trim(), approvedAt: timestamp() };
    attempt.reconciliation = { evidence: evidence.trim(), approvedAt: timestamp(), previousReservationRetained: true };
    return { id: entry.id, approvedRetryFor: attemptId, previousReservationRetained: true };
  });
}

async function reserveWebAttempt(entry) {
  const owner = randomUUID();
  await withBudget(WEB_STATE, (ledger) => {
    const word = ledger.words[entry.id];
    if (word?.retryApproval && !word.retryApproval.consumedAt) {
      if (word.fingerprint !== webFingerprint(entry) || word.status !== "blocked" || word.retryApproval.attemptId !== word.lastAttemptId) fail("Stale retry approval; stop for reconciliation.");
      word.retryApproval.consumedAt = timestamp();
      word.owner = owner;
      word.status = "pending";
    }
  });
  return reserveAttempt(WEB_STATE, entry, webFingerprint(entry), owner, { creditMultiplier: profileFor(entry).creditMultiplier });
}

async function acquireDownloadLock() {
  const deadline = Date.now() + 45000;
  while (true) {
    try { await mkdir(DOWNLOAD_LOCK, { mode: 0o700 }); return; }
    catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (Date.now() > deadline) fail("Shared download lock is busy/interrupted; inspect it, do not remove another worker's lock.");
      await wait(150);
    }
  }
}

// The free account supports two simultaneous generations. Downloading remains a
// separate, much shorter one-slot critical section.
async function acquireGenerationSlot(slotCount = 2) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    for (const slot of slotCount === 1 ? [1] : [1, 2]) {
      const path = join(WEB_STATE, `generation-${slot}.lock`);
      try {
        await mkdir(path, { mode: 0o700 });
        let released = false;
        return async () => { if (!released) { await rmdir(path); released = true; } };
      } catch (error) { if (error.code !== "EEXIST") throw error; }
    }
    await wait(150);
  }
  fail("Both generation slots are busy/interrupted; inspect before removing any lock.");
}

async function pollVisibleResult(check, description, deadline) {
  while (Date.now() < deadline) {
    try { if (await check()) return; } catch { /* Safe to retry only this read-only DOM check. */ }
    await wait(150);
  }
  fail(`No verified ${description} appeared within 30 seconds; generation is uncertain and must not be automatically repeated.`);
}

async function saveExclusiveDownload({ entry, attempt, manifestSha256, playerText, observedSettings, clickAndVerify, outputDir = OUTPUT, sourceUiEvidence = null }) {
  if (outputDir !== OUTPUT && outputDir !== VARIANTS_OUTPUT) fail("Unexpected audio output directory.");
  await acquireDownloadLock();
  let safeToRelease = false;
  try {
    const before = new Set(await readdir(DOWNLOADS));
    const downloadClickedAt = timestamp();
    await clickAndVerify(); // No retry: a timed-out click may still have downloaded.
    const deadline = Date.now() + 20000;
    let sourcePath;
    while (Date.now() < deadline) {
      const names = await readdir(DOWNLOADS);
      const v3 = profileFor(entry).modelId === "eleven_v3";
      const candidates = names.filter((name) => !before.has(name) && name.endsWith(".mp3") && (v3 || name.includes("Shizuka")));
      if (candidates.length > 1) fail(`${entry.id}: multiple new matching downloads; do not guess their mapping.`);
      const pending = names.some((name) => !before.has(name) && name.endsWith(".crdownload"));
      if (candidates.length === 1 && !pending) { sourcePath = join(DOWNLOADS, candidates[0]); break; }
      await wait(150);
    }
    if (!sourcePath) fail(`${entry.id}: no uniquely completed download; do not click or generate again.`);
    const info = await lstat(sourcePath);
    if (!info.isFile() || info.isSymbolicLink() || info.size < 100) fail("Downloaded audio is not a regular nonempty file.");
    await wait(100);
    if ((await lstat(sourcePath)).size !== info.size) fail("Download size is still changing; stop for reconciliation.");
    const bytes = await readFile(sourcePath);
    const candidateSuffix = entry.variant?.candidateIndex ? `-generation-${entry.variant.candidateIndex}` : "";
    const recoveryPath = join(WEB_STATE, "recovery", `${attempt.id}${candidateSuffix}.mp3`);
    await copyFile(sourcePath, recoveryPath, constants.COPYFILE_EXCL); // Preserve original Downloads file.
    // The source is now durably copied and unambiguously mapped; other workers can download.
    await rmdir(DOWNLOAD_LOCK);
    safeToRelease = true;
    const validation = await inspectAudio(recoveryPath);
    const profile = profileFor(entry);
    const metadata = {
      schemaVersion: 1, status: "complete", generatedAt: timestamp(), fingerprint: webFingerprint(entry), manifestSha256,
      id: entry.id, packId: entry.packId, filename: entry.filename, characters: entry.characters, reading: entry.reading, ttsInput: entry.ttsInput,
      variant: entry.variant ?? null,
      provider: "ElevenLabs", method: "website", voiceId: VOICE_ID, voiceName, modelId: profile.modelId,
      settings: profile.settings, observedSettings, languageOverride: "Japanese", outputFormat: "mp3_44100_128",
      licenseStatus: "Free-plan output; noncommercial use only unless separately licensed",
      attemptId: attempt.id, reservedCredits: attempt.reservedCredits, creditMultiplier: profile.creditMultiplier, playerText, sourceUiEvidence, sourceDownload: sourcePath, downloadClickedAt,
      audio: { bytes: bytes.length, sha256: hash(bytes), ...validation },
    };
    await exclusiveJson(`${recoveryPath}.json`, metadata);
    await mkdir(join(outputDir, entry.packId), { recursive: true });
    await link(recoveryPath, join(outputDir, entry.filename));
    await link(`${recoveryPath}.json`, `${join(outputDir, entry.filename)}.json`);
    await markAttempt(attempt.id, { status: "complete", sourceDownload: sourcePath, audioSha256: metadata.audio.sha256 }, "complete");
    return metadata;
  } catch (error) {
    await markAttempt(attempt.id, { status: "recovery-required", downloadLockHeld: !safeToRelease }, "blocked");
    // A failed/uncertain download deliberately retains the lock, preventing a late
    // file from being mistaken for another worker's word. Parent must reconcile it.
    throw error;
  }
}

export async function verifyWebAudioSettings(ui) {
  const voiceControl = ui.getByRole("button", { name: `Select voice - ${voiceName}`, exact: true });
  await voiceControl.waitFor({ state: "visible", timeoutMs: 5000 });
  if (!await voiceControl.isVisible()) fail("Selected voice is not Shizuka.");
  if (!await ui.getByRole("button", { name: "Select model - Eleven Multilingual v2", exact: true }).isVisible()) fail("Selected model is not Multilingual v2.");
  const language = await ui.getByRole("combobox", { name: "Language override", exact: true }).innerText();
  const format = await ui.getByRole("combobox", { name: "Output format", exact: true }).innerText();
  if (language !== "Japanese" || format !== "MP3 44.1 kHz (128kbps)") fail("Unexpected visible language/output format.");
  const observed = {};
  for (const [key, label, expected] of [["speed", "Speed", 1], ["stability", "Stability", 0.8], ["similarity_boost", "Similarity", 1], ["style", "Style Exaggeration", 0]]) {
    observed[key] = Number(await ui.getByRole("slider", { name: label, exact: true }).getAttribute("aria-valuenow"));
    if (!Number.isFinite(observed[key]) || Math.abs(observed[key] - expected) > 0.0001) fail(`Unexpected ${label}: ${observed[key]}. Correct the visible control before generating.`);
  }
  observed.use_speaker_boost = await ui.getByRole("switch", { name: "Speaker boost", exact: true }).getAttribute("aria-checked") === "true";
  if (!observed.use_speaker_boost) fail("Speaker boost is not enabled.");
  return observed;
}

export async function verifyWebAudioV3Settings(ui) {
  const voice = ui.getByRole("button", { name: `Select voice - ${voiceName}`, exact: true });
  await voice.waitFor({ state: "visible", timeoutMs: 5000 });
  if (!await voice.isVisible() || !await ui.getByRole("button", { name: "Select model - Eleven v3", exact: true }).isVisible()) fail("The v3 QA pilot requires the exact Shizuka voice and Eleven v3 model.");
  if (!await ui.getByRole("button", { name: `${voiceName} ${voiceName}`, exact: true }).isVisible()) fail("The v3 text speaker is not visibly Shizuka.");
  if (await ui.getByRole("combobox", { name: "Language override", exact: true }).innerText() !== "Japanese" || await ui.getByRole("combobox", { name: "Output format", exact: true }).innerText() !== "MP3 44.1 kHz (128kbps)") fail("The v3 pilot language/output settings differ.");
  const stability = Number(await ui.getByRole("slider", { name: "Stability", exact: true }).getAttribute("aria-valuenow"));
  if (stability !== 0.5) fail("The v3 pilot requires Natural stability (0.5).");
  for (const label of ["Speed", "Similarity", "Style Exaggeration"]) if (await ui.getByRole("slider", { name: label, exact: true }).isVisible()) fail("Unexpected v3 controls; inspect the current model before generating.");
  if (await ui.getByRole("switch", { name: "Speaker boost", exact: true }).isVisible()) fail("Unexpected v3 speaker-boost control.");
  return { stability };
}

async function verifyEntrySettings(ui, entry) {
  return profileFor(entry).modelId === "eleven_v3" ? verifyWebAudioV3Settings(ui) : verifyWebAudioSettings(ui);
}

// Download a positively identified existing result after a timeout/history recovery.
// This never clicks Generate, creates a second reservation, or selects history rows.
export async function recoverGeneratedWebAudio({ tab, entry, attemptId, manifestSha256, evidence }) {
  if (typeof evidence !== "string" || evidence.trim().length < 40 || evidence.length > 4000) fail("Concrete history/player recovery evidence is required.");
  const outputDir = entry.variant ? VARIANTS_OUTPUT : OUTPUT;
  const existing = await inspectExistingWebAudio(entry, outputDir);
  if (existing) return existing;
  const attempt = await withBudget(WEB_STATE, (ledger) => {
    const saved = ledger.attempts.find((item) => item.id === attemptId);
    if (!saved || saved.wordId !== entry.id || saved.fingerprint !== webFingerprint(entry) || ledger.words[entry.id]?.lastAttemptId !== attemptId) fail("Recovery must name this word's latest reserved attempt.");
    saved.recoveryEvidence = { evidence: evidence.trim(), recordedAt: timestamp() };
    return { ...saved };
  });
  const ui = tab.playwright;
  const observedSettings = await verifyEntrySettings(ui, entry);
  const player = ui.getByRole("region", { name: "audio player", exact: true });
  if (!await player.getByText(entry.ttsInput, { exact: true }).isVisible() || !await player.getByRole("img", { name: voiceName, exact: true }).isVisible()) fail("Recovery player must show the exact word and Shizuka voice.");
  const download = player.getByRole("button", { name: "Download Audio", exact: true });
  if (!await download.isEnabled()) fail("Recovery download is not enabled.");
  return saveExclusiveDownload({ entry, attempt, manifestSha256, playerText: await player.innerText(), observedSettings, outputDir,
    clickAndVerify: async () => {
      if (!await player.getByText(entry.ttsInput, { exact: true }).isVisible()) fail("Recovery player changed before download.");
      await download.click();
      if (!await player.getByText(entry.ttsInput, { exact: true }).isVisible()) fail("Recovery player changed during download.");
    },
  });
}

async function runWebAudioBatch({ tab, entries, approvedIds, manifestSha256, emit = console.log, outputDir = OUTPUT }) {
  if (!Array.isArray(entries) || !entries.length || entries.length > 10 || JSON.stringify(entries.map((entry) => entry.id)) !== JSON.stringify(approvedIds)) fail("An explicit matching approved batch of 1–10 IDs is required.");
  validateManifest({ schemaVersion: 1, entries });
  await mkdir(join(WEB_STATE, "recovery"), { recursive: true, mode: 0o700 });
  const ui = tab.playwright;
  const player = ui.getByRole("region", { name: "audio player", exact: true });
  const generate = ui.getByRole("button", { name: "Generate speech ⌘+Enter", exact: true });
  const ready = ui.getByRole("button", { name: "Regenerate speech ⌘+Enter", exact: true });
  const download = player.getByRole("button", { name: "Download Audio", exact: true });
  const records = [];
  for (const entry of entries) {
    const v3 = profileFor(entry).modelId === "eleven_v3";
    const input = v3 ? ui.locator('[contenteditable="true"][data-agent-id="tts-textarea"]') : ui.getByRole("textbox", { name: "Main textarea", exact: true });
    const existing = await inspectExistingWebAudio(entry, outputDir);
    if (existing) { emit({ id: entry.id, status: "skipped-matching" }); records.push(existing); continue; }
    if (await player.getByText(entry.ttsInput, { exact: true }).isVisible()) fail(`${entry.id}: existing player has this exact text; freshness cannot be proved automatically.`);
    await input.fill(entry.ttsInput);
    const visibleInput = v3 ? await ui.getByTestId("tts-editor").innerText() : await input.evaluate((element) => element.value);
    if (visibleInput !== entry.ttsInput) fail(`${entry.id}: visible input differs from the exact approved text.`);
    const observedSettings = await verifyEntrySettings(ui, entry);
    await generate.waitFor({ state: "visible", timeoutMs: 5000 });
    if (!await generate.isEnabled()) fail(`${entry.id}: generate control is disabled.`);
    const releaseGenerationSlot = await acquireGenerationSlot();
    let attempt;
    try {
      attempt = await reserveWebAttempt(entry);
      emit({ id: entry.id, status: "generating", attemptId: attempt.id, reservedCredits: attempt.reservedCredits });
      let verifiedResult = false;
      const resultDeadline = Date.now() + 30000;
      try {
        await generate.click(); // Deliberately never retried after any failure.
        await pollVisibleResult(() => player.getByText(entry.ttsInput, { exact: true }).isVisible(), `${entry.id} player text`, resultDeadline);
        await pollVisibleResult(() => ready.isVisible(), `${entry.id} finished generation control`, resultDeadline);
        const voiceImage = player.getByRole("img", { name: voiceName, exact: true });
        await pollVisibleResult(async () => await voiceImage.count() === 1 && await voiceImage.isVisible(), `${entry.id} single Shizuka voice`, resultDeadline);
        verifiedResult = true;
      } finally {
        // An uncertain request might still occupy provider capacity. Hold its slot
        // for the full observation window rather than immediately starting another.
        if (!verifiedResult) await wait(Math.max(0, resultDeadline - Date.now()));
        await releaseGenerationSlot();
      }
      const playerText = await player.innerText();
      await markAttempt(attempt.id, { status: "generated", playerText }, null);
      if (!await download.isEnabled()) fail(`${entry.id}: fresh download is disabled.`);
      const metadata = await saveExclusiveDownload({ entry, attempt, manifestSha256, playerText, observedSettings, outputDir,
        clickAndVerify: async () => {
          if (!await player.getByText(entry.ttsInput, { exact: true }).isVisible()) fail(`${entry.id}: player changed before download.`);
          await download.click();
          if (!await player.getByText(entry.ttsInput, { exact: true }).isVisible()) fail(`${entry.id}: player changed during download.`);
        },
      });
      records.push(metadata);
      emit({ id: entry.id, status: "complete", durationSeconds: metadata.audio.durationSeconds, filename: entry.filename });
    } catch (error) {
      if (attempt) await markAttempt(attempt.id, { status: "blocked", stoppedAt: timestamp() }, "blocked");
      throw error;
    } finally {
      await releaseGenerationSlot(); // Also releases if reservation failed before any click.
    }
  }
  return { completed: records.length, ids: records.map((record) => record.id) };
}

export async function generateWebAudioBatch(options) {
  if (options.entries?.some((entry) => entry.variant)) fail("QA variants must use their separate generation function and directory.");
  return runWebAudioBatch({ ...options, outputDir: OUTPUT });
}

export function punctuationVariantFor(entry) {
  validateManifest({ schemaVersion: 1, entries: [entry] });
  if (entry.variant || entry.id.includes("--punctuation-v1") || /[。.!?！？]$/u.test(entry.ttsInput)) fail("Only an original unpunctuated catalog entry can receive this exact punctuation variant.");
  const id = `${entry.id}--punctuation-v1`;
  return {
    ...entry, id, filename: `${entry.packId}/${id}.mp3`, ttsInput: `${entry.ttsInput}。`,
    variant: { kind: "punctuation-v1", originalId: entry.id, originalPackId: entry.packId, originalFilename: entry.filename, originalTtsInput: entry.ttsInput, addedSuffix: "。", promotionStatus: "not-promoted" },
  };
}

export async function generateWebAudioPunctuationVariants({ tab, entries, approvedIds, manifestSha256, emit = console.log }) {
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > 10 || JSON.stringify(entries.map((entry) => entry.id)) !== JSON.stringify(approvedIds)) fail("An explicit matching list of 1–10 original IDs is required for punctuation variants.");
  const variants = entries.map(punctuationVariantFor);
  // Independent variant IDs receive independent full reservations in the SAME
  // shared 4000-credit ledger. Original files and their reservations are untouched.
  return runWebAudioBatch({ tab, entries: variants, approvedIds: variants.map((entry) => entry.id), manifestSha256, emit, outputDir: VARIANTS_OUTPUT });
}

// Narrowly authorized pronunciation experiment; never changes the catalog reading.
export function karehaKatakanaVariantFor(entry) {
  validateManifest({ schemaVersion: 1, entries: [entry] });
  if (entry.id !== "kanji-51-60-kareha" || entry.characters !== "枯れ葉" || entry.reading !== "かれは" || entry.ttsInput !== "枯れ葉" || entry.variant) fail("This exact katakana experiment is only approved for the catalog's 枯れ葉 / かれは orthographic-input override.");
  const id = `${entry.id}--katakana-stop-v1`;
  return { ...entry, id, filename: `${entry.packId}/${id}.mp3`, ttsInput: "カレハ。",
    variant: { kind: "katakana-stop-v1", originalId: entry.id, originalPackId: entry.packId, originalFilename: entry.filename, originalTtsInput: entry.ttsInput, pronunciationInput: "カレハ。", promotionStatus: "not-promoted" },
  };
}

export async function generateWebAudioKarehaVariant({ tab, entry, approvedId, manifestSha256, emit = console.log }) {
  if (approvedId !== entry?.id) fail("The original 枯れ葉 ID must be explicitly approved.");
  const variant = karehaKatakanaVariantFor(entry);
  return runWebAudioBatch({ tab, entries: [variant], approvedIds: [variant.id], manifestSha256, emit, outputDir: VARIANTS_OUTPUT });
}

export function v3VariantFor(entry, variantMode = "v3-punctuation-v1") {
  validateManifest({ schemaVersion: 1, entries: [entry] });
  if (entry.variant) fail("The v3 QA pilot is limited to explicitly approved original IDs and exact manifest inputs.");
  if (!V3_VARIANT_KINDS.has(variantMode)) fail("An exact supported v3 variant mode is required.");
  let ttsInput = `${entry.ttsInput}。`;
  if (variantMode === "v3-punctuation-v1") {
    if (APPROVED_V3_INPUTS[entry.id] !== entry.ttsInput) fail("The v3 QA pilot is limited to explicitly approved original IDs and exact manifest inputs.");
  } else {
    const approved = V3_PRONUNCIATION_INPUTS[variantMode][entry.id];
    if (!approved || entry.characters !== approved.characters || entry.reading !== approved.reading) fail("This pronunciation mode requires its separately approved exact word, characters, reading, and manifest input.");
    // Every approved entry in these modes has the exact catalog reading as
    // its original input. Orthographic overrides require a separate approval.
    if (entry.ttsInput !== approved.reading) fail("This pronunciation mode requires exact manifest inputs.");
    ttsInput = variantMode === "v3-orthographic-v1" ? `${entry.characters}。` : approved.input;
  }
  const id = `${entry.id}--${variantMode}`;
  return { ...entry, id, filename: `${entry.packId}/${id}.mp3`, ttsInput,
    variant: { kind: variantMode, originalId: entry.id, originalPackId: entry.packId, originalFilename: entry.filename, originalTtsInput: entry.ttsInput, addedSuffix: "。", promotionStatus: "not-promoted",
      ...(variantMode === "v3-punctuation-v1" ? {} : { pronunciationInput: ttsInput, originalCharacters: entry.characters, originalReading: entry.reading }),
    },
  };
}

// Retain the old contract and fingerprint for every existing candidate.
export function v3PunctuationVariantFor(entry) { return v3VariantFor(entry, "v3-punctuation-v1"); }

// Root-only first pilot: reserve before ONE manually observed Generate click, then
// inspect the v3 result UI. No generation is performed by this function.
export async function reserveWebAudioV3Pilot({ tab, entry, approvedId, variantMode = "v3-punctuation-v1" }) {
  if (approvedId !== entry?.id) fail("The original v3 pilot ID must be explicitly approved.");
  const variant = v3VariantFor(entry, variantMode);
  if (await inspectExistingWebAudio(variant, VARIANTS_OUTPUT)) fail("The matching v3 pilot already exists; do not generate again.");
  const ui = tab.playwright;
  const observedSettings = await verifyWebAudioV3Settings(ui);
  if (await ui.getByTestId("tts-editor").innerText() !== variant.ttsInput) fail("The v3 editor must contain the exact pilot text before reservation.");
  if (!await ui.getByRole("button", { name: "Generate speech ⌘+Enter", exact: true }).isEnabled()) fail("The v3 Generate control is not enabled.");
  const attempt = await reserveWebAttempt(variant);
  await markAttempt(attempt.id, { observedSettings, manualPilot: true, modelId: "eleven_v3", conservativeDoubleReservation: true }, null);
  return { entry: variant, attempt, observedSettings };
}

// Observed v3 result UI contains TWO explicitly named Generation cards. Both
// originate from the same already-reserved click; saving them spends no credits.
export async function saveWebAudioV3PilotCandidates({ tab, entry, attemptId, manifestSha256 }) {
  if (!V3_VARIANT_KINDS.has(entry.variant?.kind) || entry.variant.candidateIndex) fail("Expected the original v3 pilot entry, not an existing candidate.");
  const attempt = await withBudget(WEB_STATE, (ledger) => {
    const saved = ledger.attempts.find((item) => item.id === attemptId);
    if (!saved || (!saved.manualPilot && !saved.v3TwoCandidatePilot) || saved.wordId !== entry.id || saved.fingerprint !== webFingerprint(entry) || saved.reservedCredits < [...entry.ttsInput].length * 2 || ledger.words[entry.id]?.lastAttemptId !== attemptId) fail("The exact two-candidate v3 pilot must already have a conservative reservation.");
    return { ...saved };
  });
  const ui = tab.playwright;
  const observedSettings = await verifyWebAudioV3Settings(ui);
  const editor = ui.getByTestId("tts-editor");
  if (await editor.innerText() !== entry.ttsInput) fail("The v3 result editor no longer matches the exact reserved input.");
  if (!await ui.getByRole("button", { name: "Regenerate speech ⌘+Enter", exact: true }).isVisible()) fail("The v3 result is not visibly complete.");
  const results = [];
  for (const candidateIndex of [1, 2]) {
    const candidate = v3CandidateFor(entry, candidateIndex);
    const existing = await inspectExistingWebAudio(candidate, VARIANTS_OUTPUT);
    if (existing) { results.push(existing); continue; }
    const label = ui.getByRole("main").getByText(`Generation ${candidateIndex}`, { exact: true });
    if (await label.count() !== 1) fail("Ambiguous or missing v3 candidate label; do not guess a download.");
    const card = label.locator("..");
    const download = card.getByRole("button", { name: "Download", exact: true });
    if (await download.count() !== 1 || !await download.isEnabled()) fail("The exact v3 candidate download is not enabled.");
    const metadata = await saveExclusiveDownload({ entry: candidate, attempt, manifestSha256, playerText: await card.innerText(), observedSettings, outputDir: VARIANTS_OUTPUT,
      sourceUiEvidence: { kind: "v3-generation-card", editorText: await editor.innerText(), candidateLabel: `Generation ${candidateIndex}`, selectedVoiceName: voiceName, modelId: "eleven_v3" },
      clickAndVerify: async () => {
        if (await editor.innerText() !== entry.ttsInput || !await label.isVisible()) fail("The v3 candidate changed before download.");
        await download.click();
        if (await editor.innerText() !== entry.ttsInput || !await label.isVisible()) fail("The v3 candidate changed during download.");
      },
    });
    results.push(metadata);
  }
  await markAttempt(attempt.id, { status: "complete", candidates: results.map((result) => ({ id: result.id, filename: result.filename, sha256: result.audio.sha256, bytes: result.audio.bytes })) }, "complete");
  return { attemptId, candidateCount: results.length, reservedCredits: attempt.reservedCredits, candidates: results.map((result) => ({ id: result.id, filename: result.filename, durationSeconds: result.audio.durationSeconds, sha256: result.audio.sha256 })) };
}

export function v3CandidateFor(entry, candidateIndex) {
  if (!V3_VARIANT_KINDS.has(entry.variant?.kind) || entry.variant.candidateIndex || ![1, 2].includes(candidateIndex)) fail("An exact v3 pilot and candidate index 1 or 2 are required.");
  const id = `${entry.id}--generation-${candidateIndex}`;
  return { ...entry, id, filename: `${entry.packId}/${id}.mp3`, variant: { ...entry.variant, candidateIndex, parentVariantId: entry.id } };
}

// Native CUA fallback: these functions only reserve/bookkeep local files. The
// caller observes and operates Chrome separately; no fabricated browser object,
// authenticated request, automatic click, or new pronunciation input is accepted.
const NATIVE_V3_MODES = new Set(["v3-hiragana-v1", "v3-katakana-v1", "v3-spaced-v1", "v3-long-vowels-v1"]);
export function validateNativeV3Evidence(entry, evidence, candidateIndex = null) {
  if (!evidence || evidence.editorText !== entry.ttsInput || evidence.selectedVoiceName !== voiceName || evidence.selectedSpeakerName !== voiceName || evidence.modelId !== "eleven_v3" || evidence.languageOverride !== "Japanese" || evidence.outputFormat !== "mp3_44100_128" || evidence.stability !== 0.5) fail("Native UI evidence must bind the exact editor, Shizuka voice/speaker, v3, Japanese, MP3 128 and Natural 0.5.");
  const observed = Date.parse(evidence.observedAt);
  if (!Number.isFinite(observed) || Math.abs(Date.now() - observed) > 600000 || typeof evidence.observation !== "string" || evidence.observation.trim().length < 40 || evidence.observation.length > 4000) fail("Fresh timestamped native UI observation evidence is required.");
  if (candidateIndex === null) {
    if (evidence.generateEnabled !== true) fail("The exact native Generate control must be observed enabled before reservation.");
  } else if (![1, 2].includes(candidateIndex) || evidence.candidateLabel !== `Generation ${candidateIndex}` || evidence.generationComplete !== true) fail("Native download evidence must identify the exact completed Generation candidate.");
  return { ...evidence, observation: evidence.observation.trim() };
}

function nativeVariantFor(entry, variantMode) {
  if (!NATIVE_V3_MODES.has(variantMode) || !Object.hasOwn(APPROVED_V3_KATAKANA_INPUTS, entry?.id)) fail("Native correction bookkeeping is limited to the four approved words and bounded pronunciation modes.");
  return v3VariantFor(entry, variantMode);
}

async function regularNativeDirectory(path, create = false) {
  if (dirname(path) !== path) await regularNativeDirectory(dirname(path), create);
  if (!await exists(path) && create) { try { await mkdir(path, { mode: 0o700 }); } catch (error) { if (error.code !== "EEXIST") throw error; } }
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink()) fail("Native bookkeeping requires regular, non-symlinked directories.");
}

async function readNativeOwnedLock(path, ownerId) {
  const bytes = await open(join(path, "native-owner.json"), constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    if (!(await bytes.stat()).isFile()) fail("Native lock owner is not a regular file.");
    const owner = JSON.parse(await bytes.readFile("utf8"));
    if (owner.ownerId !== ownerId) fail("Native operation does not own the lock; stop for reconciliation.");
    return owner;
  } finally { await bytes.close(); }
}

async function releaseNativeOwnedLock(path, ownerId) {
  await readNativeOwnedLock(path, ownerId);
  await unlink(join(path, "native-owner.json"));
  await rmdir(path);
}

async function nativeAttempt(attemptId) {
  const attempt = await withBudget(WEB_STATE, (ledger) => {
    const found = ledger.attempts.find((item) => item.id === attemptId);
    if (!found?.nativeV3Pilot || ledger.words[found.wordId]?.lastAttemptId !== attemptId) fail("An exact existing native v3 reservation is required.");
    return structuredClone(found);
  });
  const { entries, manifestSha256 } = await loadAudioManifest();
  const original = entries.find((entry) => entry.id === attempt.originalId);
  const entry = nativeVariantFor(original, attempt.variantMode);
  if (attempt.manifestSha256 !== manifestSha256 || attempt.wordId !== entry.id || attempt.fingerprint !== webFingerprint(entry) || attempt.reservedCredits !== [...entry.ttsInput].length * 2) fail("Native reservation no longer matches the exact manifest, input, fingerprint, or double-credit charge.");
  return { attempt, entry, manifestSha256 };
}

export async function reserveNativeWebAudioV3Variant({ entry: original, approvedId, variantMode, manifestSha256, uiEvidence }) {
  if (approvedId !== original?.id) fail("The native correction must explicitly name its approved original word.");
  const entry = nativeVariantFor(original, variantMode);
  const evidence = validateNativeV3Evidence(entry, uiEvidence);
  const current = await loadAudioManifest();
  const actual = current.entries.find((item) => item.id === original.id);
  if (manifestSha256 !== current.manifestSha256 || JSON.stringify(actual) !== JSON.stringify(original)) fail("Native reservation requires the exact current manifest entry and hash.");
  for (const candidateIndex of [1, 2]) if (await inspectExistingWebAudio(v3CandidateFor(entry, candidateIndex), VARIANTS_OUTPUT)) fail("A native candidate already exists; inspect/recover it, do not regenerate.");
  await regularNativeDirectory(join(WEB_STATE, "recovery"), true);
  const generationLock = join(WEB_STATE, "generation-1.lock");
  const ownerId = randomUUID();
  await mkdir(generationLock, { mode: 0o700 }); // Fail immediately if any generation owns it.
  await exclusiveJson(join(generationLock, "native-owner.json"), { ownerId, createdAt: timestamp(), wordId: entry.id });
  let attempt;
  try {
    attempt = await reserveWebAttempt(entry);
    await markAttempt(attempt.id, { nativeV3Pilot: true, v3TwoCandidatePilot: true, originalId: original.id, variantMode, manifestSha256, nativeOwnerId: ownerId, nativeUiEvidence: evidence, observedSettings: { stability: 0.5 }, modelId: "eleven_v3", conservativeDoubleReservation: true, nativeCandidates: {} }, null);
    return { attemptId: attempt.id, entry, reservedCredits: attempt.reservedCredits, generationLockHeld: true, instruction: "One native Generate click is reserved. Do not click twice or retry an uncertain result." };
  } catch (error) {
    if (!attempt) await releaseNativeOwnedLock(generationLock, ownerId);
    throw error;
  }
}

export async function beginNativeWebAudioV3CandidateDownload({ attemptId, candidateIndex, uiEvidence }) {
  const { attempt, entry } = await nativeAttempt(attemptId);
  const evidence = validateNativeV3Evidence(entry, uiEvidence, candidateIndex);
  await readNativeOwnedLock(join(WEB_STATE, "generation-1.lock"), attempt.nativeOwnerId);
  if (attempt.nativeCandidates[String(candidateIndex)]) fail("This native candidate is already started or saved; no automatic download retry.");
  if (candidateIndex === 2 && attempt.nativeCandidates["1"]?.status !== "complete") fail("Save Generation 1 before beginning Generation 2 so downloads cannot be confused.");
  await regularNativeDirectory(DOWNLOADS);
  await mkdir(DOWNLOAD_LOCK, { mode: 0o700 });
  await exclusiveJson(join(DOWNLOAD_LOCK, "native-owner.json"), { ownerId: attempt.nativeOwnerId, attemptId, candidateIndex, createdAt: timestamp() });
  const record = { status: "awaiting-download", candidateIndex, beforeNames: await readdir(DOWNLOADS), startedAt: timestamp(), uiEvidence: evidence };
  await withBudget(WEB_STATE, (ledger) => {
    const saved = ledger.attempts.find((item) => item.id === attemptId);
    if (saved.nativeCandidates[String(candidateIndex)]) fail("Native candidate reservation changed; stop for reconciliation.");
    saved.nativeCandidates[String(candidateIndex)] = record;
  });
  return { attemptId, candidateIndex, downloadLockHeld: true, instruction: `Click Download once on the observed Generation ${candidateIndex} card, then save this exact download.` };
}

export function selectNativeCandidateDownload(record, currentNames) {
  if (record?.status !== "awaiting-download" || !Array.isArray(record.beforeNames) || !Number.isFinite(Date.parse(record.startedAt))) fail("Missing native download before-snapshot.");
  const before = new Set(record.beforeNames);
  const added = currentNames.filter((name) => !before.has(name));
  if (added.some((name) => name.endsWith(".crdownload"))) fail("A Chrome download is still pending; do not click again.");
  const candidates = added.filter((name) => name.endsWith(".mp3"));
  if (candidates.length !== 1 || basename(candidates[0]) !== candidates[0]) fail("The native candidate must have exactly one new MP3; do not guess its mapping.");
  return candidates[0];
}

export async function saveNativeWebAudioV3CandidateDownload({ attemptId, candidateIndex, uiEvidence }) {
  const { attempt, entry, manifestSha256 } = await nativeAttempt(attemptId);
  const evidence = validateNativeV3Evidence(entry, uiEvidence, candidateIndex);
  const generationLock = join(WEB_STATE, "generation-1.lock");
  await readNativeOwnedLock(generationLock, attempt.nativeOwnerId);
  const lock = await readNativeOwnedLock(DOWNLOAD_LOCK, attempt.nativeOwnerId);
  if (lock.attemptId !== attemptId || lock.candidateIndex !== candidateIndex) fail("The native download lock belongs to another candidate.");
  const record = attempt.nativeCandidates[String(candidateIndex)];
  const name = selectNativeCandidateDownload(record, await readdir(DOWNLOADS));
  const sourcePath = join(DOWNLOADS, name);
  const handle = await open(sourcePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  let bytes;
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size < 100 || info.mtimeMs < Date.parse(record.startedAt) - 1000) fail("Native downloaded audio must be a new, regular, nonempty file.");
    bytes = await handle.readFile();
    const after = await handle.stat();
    if (after.size !== info.size || after.mtimeMs !== info.mtimeMs || bytes.length !== info.size) fail("Native download changed during inspection; stop for reconciliation.");
  } finally { await handle.close(); }
  const candidate = v3CandidateFor(entry, candidateIndex);
  const recoveryPath = join(WEB_STATE, "recovery", `${attempt.id}-generation-${candidateIndex}.mp3`);
  await copyFile(sourcePath, recoveryPath, constants.COPYFILE_EXCL);
  if (hash(await readFile(recoveryPath)) !== hash(bytes)) fail("Native download changed while making its exclusive recovery copy.");
  const validation = await inspectAudio(recoveryPath);
  const metadata = {
    schemaVersion: 1, status: "complete", generatedAt: timestamp(), fingerprint: webFingerprint(candidate), manifestSha256,
    id: candidate.id, packId: candidate.packId, filename: candidate.filename, characters: candidate.characters, reading: candidate.reading, ttsInput: candidate.ttsInput,
    variant: candidate.variant, provider: "ElevenLabs", method: "website", voiceId: VOICE_ID, voiceName, modelId: "eleven_v3",
    settings: V3_SETTINGS, observedSettings: { stability: 0.5 }, languageOverride: "Japanese", outputFormat: "mp3_44100_128",
    licenseStatus: "Free-plan output; noncommercial use only unless separately licensed",
    attemptId, reservedCredits: attempt.reservedCredits, creditMultiplier: 2, playerText: `Generation ${candidateIndex}`,
    sourceUiEvidence: { kind: "v3-generation-card", editorText: entry.ttsInput, candidateLabel: `Generation ${candidateIndex}`, selectedVoiceName: voiceName, modelId: "eleven_v3" },
    nativeUiEvidence: { beforeGeneration: attempt.nativeUiEvidence, beforeDownload: record.uiEvidence, afterDownload: evidence },
    sourceDownload: sourcePath, downloadClickedAt: record.startedAt, audio: { bytes: bytes.length, sha256: hash(bytes), ...validation },
  };
  await exclusiveJson(`${recoveryPath}.json`, metadata);
  await regularNativeDirectory(join(VARIANTS_OUTPUT, candidate.packId), true);
  await link(recoveryPath, join(VARIANTS_OUTPUT, candidate.filename));
  await link(`${recoveryPath}.json`, `${join(VARIANTS_OUTPUT, candidate.filename)}.json`);
  const completed = await withBudget(WEB_STATE, (ledger) => {
    const saved = ledger.attempts.find((item) => item.id === attemptId);
    saved.nativeCandidates[String(candidateIndex)] = { ...record, status: "complete", sourceDownload: sourcePath, id: candidate.id, filename: candidate.filename, sha256: metadata.audio.sha256, bytes: bytes.length, afterDownloadEvidence: evidence };
    const both = [1, 2].every((index) => saved.nativeCandidates[String(index)]?.status === "complete");
    if (both) { saved.status = "complete"; saved.completedAt = timestamp(); saved.candidates = [1, 2].map((index) => { const item = saved.nativeCandidates[String(index)]; return { id: item.id, filename: item.filename, sha256: item.sha256, bytes: item.bytes }; }); ledger.words[saved.wordId].status = "complete"; }
    return both;
  });
  await releaseNativeOwnedLock(DOWNLOAD_LOCK, attempt.nativeOwnerId);
  if (completed) await releaseNativeOwnedLock(generationLock, attempt.nativeOwnerId);
  return { attemptId, candidateIndex, id: candidate.id, filename: candidate.filename, sha256: metadata.audio.sha256, durationSeconds: validation.durationSeconds, bothCandidatesComplete: completed, generationLockHeld: !completed };
}

// Small approved QA batches only. Each word gets ONE generation click, then both
// visible alternatives are downloaded under their own exclusive output names.
export async function generateWebAudioV3Variants({ tab, entries, approvedIds, manifestSha256, variantMode = "v3-punctuation-v1", emit = console.log }) {
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > 2 || JSON.stringify(entries.map((entry) => entry.id)) !== JSON.stringify(approvedIds)) fail("An explicit matching batch of one or two approved original IDs is required.");
  validateManifest({ schemaVersion: 1, entries });
  const variants = entries.map((entry) => v3VariantFor(entry, variantMode));
  await mkdir(join(WEB_STATE, "recovery"), { recursive: true, mode: 0o700 });
  const ui = tab.playwright;
  const input = ui.locator('[contenteditable="true"][data-agent-id="tts-textarea"]');
  const editor = ui.getByTestId("tts-editor");
  const generate = ui.getByRole("button", { name: "Generate speech ⌘+Enter", exact: true });
  const ready = ui.getByRole("button", { name: "Regenerate speech ⌘+Enter", exact: true });
  const completed = [];
  for (const entry of variants) {
    const existing = await Promise.all([1, 2].map((index) => inspectExistingWebAudio(v3CandidateFor(entry, index), VARIANTS_OUTPUT)));
    if (existing.every(Boolean)) {
      emit({ id: entry.variant.originalId, status: "skipped-matching-v3-candidates" });
      completed.push({ id: entry.variant.originalId, candidateCount: 2, skipped: true });
      continue;
    }
    if (existing.some(Boolean)) fail(`${entry.id}: only one candidate is saved; reconcile the existing generation, do not regenerate.`);
    await input.fill(entry.ttsInput);
    if (await editor.innerText() !== entry.ttsInput) fail("The v3 editor does not match the exact approved input.");
    const observedSettings = await verifyWebAudioV3Settings(ui);
    await generate.waitFor({ state: "visible", timeoutMs: 5000 });
    if (!await generate.isEnabled()) fail("The v3 Generate control is not enabled; no request was made.");
    // v3 produces two candidates per click, so one click can use the account's
    // two synthesis slots. Serialize v3 clicks across workers.
    const releaseSlot = await acquireGenerationSlot(1);
    let attempt;
    try {
      attempt = await reserveWebAttempt(entry);
      if (attempt.reservedCredits !== [...entry.ttsInput].length * 2) fail("The v3 double-credit reservation was not applied; stop before generation.");
      await markAttempt(attempt.id, { observedSettings, v3TwoCandidatePilot: true, modelId: "eleven_v3", conservativeDoubleReservation: true }, null);
      emit({ id: entry.variant.originalId, status: "generating-v3-qa", attemptId: attempt.id, reservedCredits: attempt.reservedCredits });
      const deadline = Date.now() + 30000;
      let verified = false;
      try {
        await generate.click(); // ONE click only, no automatic retries.
        await pollVisibleResult(() => ready.isVisible(), `${entry.id} v3 completion control`, deadline);
        for (const index of [1, 2]) await pollVisibleResult(async () => {
          const label = ui.getByRole("main").getByText(`Generation ${index}`, { exact: true });
          if (await label.count() !== 1 || !await label.isVisible()) return false;
          return label.locator("..").getByRole("button", { name: "Download", exact: true }).isEnabled();
        }, `${entry.id} Generation ${index}`, deadline);
        if (await editor.innerText() !== entry.ttsInput) fail("The v3 editor changed during generation.");
        verified = true;
      } finally {
        if (!verified) await wait(Math.max(0, deadline - Date.now()));
        await releaseSlot();
      }
      const result = await saveWebAudioV3PilotCandidates({ tab, entry, attemptId: attempt.id, manifestSha256 });
      completed.push({ id: entry.variant.originalId, ...result });
      emit({ id: entry.variant.originalId, status: "complete-v3-qa", candidateCount: result.candidateCount, candidates: result.candidates });
    } catch (error) {
      if (attempt) await markAttempt(attempt.id, { status: "blocked", stoppedAt: timestamp() }, "blocked");
      throw error;
    } finally { await releaseSlot(); }
  }
  return { words: completed.length, candidates: completed.reduce((sum, item) => sum + item.candidateCount, 0), completed };
}
