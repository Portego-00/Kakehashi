import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { mkdtemp, readFile, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ENDPOINT, parseArgs, selectEntries, requestSpeech, reserveAttempt, withBudget } from "./generate-custom-vocabulary-audio.mjs";
import { APPROVED_V3_INPUTS, APPROVED_V3_ORTHOGRAPHIC_INPUTS, APPROVED_V3_HIRAGANA_INPUTS, APPROVED_V3_KATAKANA_INPUTS, APPROVED_V3_SPACED_INPUTS, APPROVED_V3_LONG_VOWELS_INPUTS, karehaKatakanaVariantFor, loadAudioManifest, punctuationVariantFor, reserveNativeWebAudioV3Variant, selectNativeCandidateDownload, validateNativeV3Evidence, v3CandidateFor, v3VariantFor, v3PunctuationVariantFor, webFingerprint, verifyWebAudioSettings, verifyWebAudioV3Settings } from "./custom-vocabulary-web-audio-worker.mjs";

const entry = { id: "test-word", packId: "test-pack", ttsInput: "やっぱり", filename: "test-pack/test-word.mp3", reading: "やっぱり" };
const fakeKey = "synthetic-test-only-not-a-real-key";

test("dry run needs no key and selections are deterministic", () => {
  assert.equal(parseArgs(["--dry-run"]).keyFile, null);
  assert.throws(() => parseArgs([]), /key-file/);
  const entries = Array.from({ length: 10 }, (_, index) => ({ id: String(index) }));
  assert.deepEqual(selectEntries(entries, { shard: "2/3" }).map((e) => e.id), ["1", "4", "7"]);
  assert.deepEqual(selectEntries(entries, { range: "2:4" }).map((e) => e.id), ["1", "2", "3"]);
});

test("request mock receives credentials only at the fixed endpoint with redirects rejected", async () => {
  let calls = 0;
  const result = await requestSpeech(entry, fakeKey, { fetchImpl: async (url, options) => {
    calls += 1;
    assert.equal(url, ENDPOINT);
    assert.equal(new URL(url).origin, "https://api.elevenlabs.io");
    assert.equal(options.redirect, "error");
    assert.equal(options.headers["xi-api-key"], fakeKey);
    assert.equal(JSON.parse(options.body).text, "やっぱり");
    return new Response("fake-audio", { status: 200, headers: { "content-type": "audio/mpeg", "request-id": "test-123", "character-cost": "4" } });
  } });
  assert.equal(calls, 1);
  assert.equal(result.kind, "audio");
  assert.equal(result.reportedCharacterCost, 4);
  assert.equal(JSON.stringify(result).includes(fakeKey), false);
});

test("uncertain transport and unrecognized errors do not expose raw provider text or retry", async () => {
  let calls = 0;
  const uncertain = await requestSpeech(entry, fakeKey, { fetchImpl: async () => {
    calls += 1;
    throw new Error(`Raw failure with ${fakeKey}`);
  } });
  assert.equal(calls, 1);
  assert.equal(uncertain.kind, "uncertain");
  assert.equal(JSON.stringify(uncertain).includes(fakeKey), false);
  const rejected = await requestSpeech(entry, fakeKey, { fetchImpl: async () => new Response(JSON.stringify({ detail: { code: fakeKey, message: fakeKey } }), { status: 429 }) });
  assert.equal(rejected.kind, "rejected");
  assert.equal(JSON.stringify(rejected).includes(fakeKey), false);
});

test("explicit rate rejection is identified without retrying the request itself", async () => {
  const result = await requestSpeech(entry, fakeKey, { fetchImpl: async () => new Response(JSON.stringify({ detail: { code: "concurrent_limit_exceeded" } }), { status: 429, headers: { "retry-after": "2" } }) });
  assert.equal(result.kind, "rate-rejected");
  assert.equal(result.retryAfterMs, 2000);
});

test("global budget atomically admits only the remaining allowance across concurrent workers", async () => {
  // Keep diagnostic artifacts in their unique temporary test directory; never alter production state.
  const state = await realpath(await mkdtemp(join(tmpdir(), "kakehashi-audio-budget-test-")));
  await withBudget(state, (ledger) => { ledger.attempts.push({ id: "fixture", reservedCredits: 3996 }); });
  const attempts = await Promise.allSettled([
    reserveAttempt(state, entry, "fingerprint", "worker-a"),
    reserveAttempt(state, { ...entry, id: "another-word" }, "fingerprint", "worker-b"),
  ]);
  assert.equal(attempts.filter((item) => item.status === "fulfilled").length, 1);
  const ledger = JSON.parse(await readFile(join(state, "budget.json"), "utf8"));
  assert.equal(ledger.attempts.reduce((sum, item) => sum + item.reservedCredits, 0), 4000);
  const winner = ledger.attempts.find((item) => item.wordId)?.wordId;
  await assert.rejects(reserveAttempt(state, { ...entry, id: winner }, "fingerprint", "new-worker"), /no automatic repeat/);
});

test("website fingerprint changes with exact input and settings check rejects drift", async () => {
  assert.notEqual(webFingerprint(entry), webFingerprint({ ...entry, ttsInput: "やっぱし" }));
  let speed = 1;
  const ui = { getByRole: (role, { name }) => ({
    waitFor: async () => {},
    isVisible: async () => true,
    innerText: async () => name === "Language override" ? "Japanese" : "MP3 44.1 kHz (128kbps)",
    getAttribute: async () => role === "switch" ? "true" : String(({ Speed: speed, Stability: 0.8, Similarity: 1, "Style Exaggeration": 0 })[name]),
  }) };
  assert.equal((await verifyWebAudioSettings(ui)).speed, 1);
  speed = 1.01;
  await assert.rejects(verifyWebAudioSettings(ui), /Unexpected Speed/);
});

test("punctuation variants retain original identity, have separate reservation/output IDs, and cannot nest", () => {
  const variant = punctuationVariantFor(entry);
  assert.equal(variant.ttsInput, "やっぱり。");
  assert.equal(variant.id, "test-word--punctuation-v1");
  assert.equal(variant.filename, "test-pack/test-word--punctuation-v1.mp3");
  assert.equal(variant.variant.originalId, entry.id);
  assert.notEqual(webFingerprint(entry), webFingerprint(variant));
  assert.throws(() => punctuationVariantFor(variant), /Only an original/);
  assert.equal(entry.ttsInput, "やっぱり");
});

test("the exact 枯れ葉 variant accepts its real orthographic override without changing catalog reading", async () => {
  const { entries } = await loadAudioManifest();
  const original = entries.find((item) => item.id === "kanji-51-60-kareha");
  assert.equal(original.characters, "枯れ葉");
  assert.equal(original.reading, "かれは");
  assert.equal(original.ttsInput, "枯れ葉");
  const variant = karehaKatakanaVariantFor(original);
  assert.equal(variant.ttsInput, "カレハ。");
  assert.equal(variant.reading, "かれは");
  assert.equal(variant.variant.originalTtsInput, "枯れ葉");
  assert.throws(() => karehaKatakanaVariantFor({ ...original, ttsInput: "かれは" }), /orthographic-input override/);
});

test("the v3 pilot is bounded to approved original inputs and uses a distinct model/settings fingerprint", async () => {
  const { entries } = await loadAudioManifest();
  const cake = entries.find((item) => item.id === "food-keeki");
  const variant = v3PunctuationVariantFor(cake);
  assert.equal(variant.ttsInput, "ケーキ。");
  assert.equal(variant.variant.kind, "v3-punctuation-v1");
  assert.notEqual(webFingerprint(variant), webFingerprint(punctuationVariantFor(cake)));
  assert.throws(() => v3PunctuationVariantFor(entry), /explicitly approved/);
  const state = await realpath(await mkdtemp(join(tmpdir(), "kakehashi-v3-budget-test-")));
  const attempt = await reserveAttempt(state, variant, webFingerprint(variant), "test-worker", { creditMultiplier: 2 });
  assert.equal(attempt.reservedCredits, 8);
  await assert.rejects(reserveAttempt(state, { ...variant, id: "bad-multiplier" }, "test", "test", { creditMultiplier: 0 }), /double-rate/);
});

test("all 22 v3 allowlist inputs match the real manifest and two candidates have separate identities", async () => {
  const { entries } = await loadAudioManifest();
  assert.equal(Object.keys(APPROVED_V3_INPUTS).length, 22);
  for (const [id, input] of Object.entries(APPROVED_V3_INPUTS)) {
    const original = entries.find((item) => item.id === id);
    assert.equal(original.ttsInput, input);
    const variant = v3PunctuationVariantFor(original);
    const first = v3CandidateFor(variant, 1);
    const second = v3CandidateFor(variant, 2);
    assert.notEqual(first.id, second.id);
    assert.notEqual(webFingerprint(first), webFingerprint(second));
    assert.equal(first.variant.originalId, original.id);
    assert.throws(() => v3PunctuationVariantFor({ ...original, ttsInput: `${input}x` }), /exact manifest inputs/);
  }
});

test("v3 settings guard requires Natural stability and does not fabricate unavailable v2 controls", async () => {
  let stability = 0.5;
  const unavailable = new Set(["Speed", "Similarity", "Style Exaggeration", "Speaker boost"]);
  const ui = { getByRole: (_role, { name }) => ({
    waitFor: async () => {},
    isVisible: async () => !unavailable.has(name),
    innerText: async () => name === "Language override" ? "Japanese" : "MP3 44.1 kHz (128kbps)",
    getAttribute: async () => String(stability),
  }) };
  assert.deepEqual(await verifyWebAudioV3Settings(ui), { stability: 0.5 });
  stability = 1;
  await assert.rejects(verifyWebAudioV3Settings(ui), /Natural stability/);
});

test("exact written-form, hiragana, katakana and phrase experiments bind the real manifest without mutating originals", async () => {
  const { entries } = await loadAudioManifest();
  assert.equal(Object.keys(APPROVED_V3_ORTHOGRAPHIC_INPUTS).length, 25);
  assert.equal(Object.keys(APPROVED_V3_HIRAGANA_INPUTS).length, 7);
  assert.equal(Object.keys(APPROVED_V3_KATAKANA_INPUTS).length, 4);
  assert.equal(Object.keys(APPROVED_V3_SPACED_INPUTS).length, 2);
  assert.deepEqual(Object.keys(APPROVED_V3_LONG_VOWELS_INPUTS), ["kanji-21-30-reitou"]);
  const modes = [["v3-orthographic-v1", APPROVED_V3_ORTHOGRAPHIC_INPUTS], ["v3-hiragana-v1", APPROVED_V3_HIRAGANA_INPUTS], ["v3-katakana-v1", APPROVED_V3_KATAKANA_INPUTS], ["v3-spaced-v1", APPROVED_V3_SPACED_INPUTS], ["v3-long-vowels-v1", APPROVED_V3_LONG_VOWELS_INPUTS]];
  for (const [mode, approved] of modes) {
    for (const [id, lexical] of Object.entries(approved)) {
      const original = entries.find((item) => item.id === id);
      const unchanged = JSON.stringify(original);
      const variant = v3VariantFor(original, mode);
      assert.equal(variant.ttsInput, lexical.input ?? `${original.characters}。`);
      assert.equal(variant.reading, original.reading);
      assert.equal(variant.characters, original.characters);
      assert.equal(variant.variant.originalTtsInput, original.ttsInput);
      assert.equal(variant.variant.pronunciationInput, variant.ttsInput);
      assert.equal(variant.variant.originalReading, original.reading);
      assert.equal(variant.variant.kind, mode);
      assert.equal(variant.id, `${id}--${mode}`);
      assert.equal(variant.filename, `${original.packId}/${id}--${mode}.mp3`);
      if (APPROVED_V3_INPUTS[id]) assert.notEqual(webFingerprint(variant), webFingerprint(v3PunctuationVariantFor(original)));
      else assert.throws(() => v3PunctuationVariantFor(original), /explicitly approved/);
      assert.notEqual(webFingerprint(variant), webFingerprint({ ...variant, variant: { ...variant.variant, kind: "punctuation-v1" } }));
      const candidates = [1, 2].map((index) => v3CandidateFor(variant, index));
      assert.equal(candidates[0].variant.kind, mode);
      assert.notEqual(candidates[0].filename, candidates[1].filename);
      assert.notEqual(webFingerprint(candidates[0]), webFingerprint(candidates[1]));
      assert.throws(() => v3VariantFor({ ...original, characters: "違う" }, mode), /separately approved/);
      assert.throws(() => v3VariantFor({ ...original, reading: "ちがう" }, mode), /separately approved/);
      assert.throws(() => v3VariantFor({ ...original, ttsInput: "ちがう" }, mode), /exact manifest inputs/);
      assert.throws(() => v3VariantFor(variant, mode), /explicitly approved/);
      assert.equal(JSON.stringify(original), unchanged);
    }
  }
  const cake = entries.find((item) => item.id === "food-keeki");
  for (const [mode] of modes) assert.throws(() => v3VariantFor(cake, mode), /separately approved/);
  assert.throws(() => v3VariantFor(cake, "v3-arbitrary-input"), /supported v3 variant mode/);
});

test("four-word corrections use only the exact approved pronunciation inputs", async () => {
  const { entries } = await loadAudioManifest();
  const expected = [
    ["kanji-expansion-51-55-r63bcn9bwkna07a", "いっきいちゆう。", "イッキイチユー。", "いっき、いちゆう。"],
    ["kanji-21-30-reitou", "れいとう。", "レイトー。", null],
    ["kanji-expansion-51-55-47tb1i6a7n", "とうちょう。", "トーチョー。", null],
    ["kanji-51-60-kankonsousai", "かんこんそうさい。", "カンコンソーサイ。", "かんこん、そうさい。"],
  ];
  assert.deepEqual(Object.keys(APPROVED_V3_KATAKANA_INPUTS), expected.map(([id]) => id));
  for (const [id, hiragana, katakana, spaced] of expected) {
    const original = entries.find((item) => item.id === id);
    assert.equal(v3VariantFor(original, "v3-hiragana-v1").ttsInput, hiragana);
    assert.equal(v3VariantFor(original, "v3-katakana-v1").ttsInput, katakana);
    if (spaced) assert.equal(v3VariantFor(original, "v3-spaced-v1").ttsInput, spaced);
    else assert.throws(() => v3VariantFor(original, "v3-spaced-v1"), /separately approved/);
    // Inputs are not supplied by the caller; trying to substitute even a plausible
    // alternative cannot silently authorize another charge or pronunciation.
    for (const mode of ["v3-hiragana-v1", "v3-katakana-v1", "v3-spaced-v1"]) {
      assert.throws(() => v3VariantFor({ ...original, id: "unapproved-word", filename: `${original.packId}/unapproved-word.mp3` }, mode), /separately approved/);
      assert.throws(() => v3VariantFor({ ...original, ttsInput: "レートー。" }, mode), /exact manifest inputs|separately approved/);
    }
  }
});

const nativeEvidence = (entry, overrides = {}) => ({
  editorText: entry.ttsInput, selectedVoiceName: "Shizuka - Natural & Soft", selectedSpeakerName: "Shizuka - Natural & Soft",
  modelId: "eleven_v3", languageOverride: "Japanese", outputFormat: "mp3_44100_128", stability: 0.5,
  observedAt: new Date().toISOString(), observation: "Test-only native UI evidence: exact editor, voice, speaker, model, language, format and Natural stability were checked.",
  generateEnabled: true, ...overrides,
});

test("the explicit two-long-vowel correction is limited to 冷凍 and retains its canonical reading", async () => {
  const { entries, manifestSha256 } = await loadAudioManifest();
  const original = entries.find((item) => item.id === "kanji-21-30-reitou");
  const variant = v3VariantFor(original, "v3-long-vowels-v1");
  assert.equal(variant.ttsInput, "レートー。");
  assert.equal(variant.reading, "れいとう");
  assert.equal(variant.variant.pronunciationInput, "レートー。");
  assert.equal(variant.variant.originalTtsInput, "れいとう");
  assert.notEqual(webFingerprint(variant), webFingerprint(v3VariantFor(original, "v3-katakana-v1")));
  for (const id of Object.keys(APPROVED_V3_KATAKANA_INPUTS).filter((id) => id !== original.id)) {
    assert.throws(() => v3VariantFor(entries.find((item) => item.id === id), "v3-long-vowels-v1"), /separately approved/);
  }
  // Passing the native mode guard is verified through a stale-manifest rejection,
  // which deliberately occurs before locks, reservations, or audio writes.
  const staleHash = `${manifestSha256[0] === "0" ? "1" : "0"}${manifestSha256.slice(1)}`;
  await assert.rejects(reserveNativeWebAudioV3Variant({ entry: original, approvedId: original.id, variantMode: "v3-long-vowels-v1", manifestSha256: staleHash, uiEvidence: nativeEvidence(variant) }), /current manifest/);
});

test("native fallback requires fresh exact UI evidence without accepting fabricated DOM controls", async () => {
  const { entries } = await loadAudioManifest();
  const original = entries.find((item) => item.id === "kanji-21-30-reitou");
  const variant = v3VariantFor(original, "v3-katakana-v1");
  assert.equal(validateNativeV3Evidence(variant, nativeEvidence(variant)).editorText, "レイトー。");
  for (const drift of [
    { editorText: "レートー。" }, { selectedVoiceName: "Another voice" }, { selectedSpeakerName: "Another speaker" },
    { modelId: "eleven_multilingual_v2" }, { languageOverride: "Auto" }, { outputFormat: "mp3_44100_192" }, { stability: 1 },
    { observedAt: new Date(Date.now() - 600001).toISOString() }, { observedAt: new Date(Date.now() + 601000).toISOString() },
    { observation: "Unverified" }, { generateEnabled: false },
  ]) assert.throws(() => validateNativeV3Evidence(variant, nativeEvidence(variant, drift)), /Native UI evidence|Fresh timestamped|Generate control/);
  for (const index of [1, 2]) {
    const candidateEvidence = nativeEvidence(variant, { candidateLabel: `Generation ${index}`, generationComplete: true });
    assert.equal(validateNativeV3Evidence(variant, candidateEvidence, index).candidateLabel, `Generation ${index}`);
    assert.throws(() => validateNativeV3Evidence(variant, candidateEvidence, index === 1 ? 2 : 1), /exact completed/);
    assert.throws(() => validateNativeV3Evidence(variant, { ...candidateEvidence, generationComplete: false }, index), /exact completed/);
  }
  assert.throws(() => validateNativeV3Evidence(variant, nativeEvidence(variant), 3), /exact completed/);
});

test("native reservation rejects unrelated IDs, stale manifests and changed settings before any credit or lock write", async () => {
  const { entries, manifestSha256 } = await loadAudioManifest();
  const original = entries.find((item) => item.id === "kanji-21-30-reitou");
  const variantMode = "v3-katakana-v1";
  const variant = v3VariantFor(original, variantMode);
  const args = { entry: original, approvedId: original.id, variantMode, manifestSha256, uiEvidence: nativeEvidence(variant) };
  await assert.rejects(reserveNativeWebAudioV3Variant({ ...args, approvedId: "someone-else" }), /approved original/);
  await assert.rejects(reserveNativeWebAudioV3Variant({ ...args, variantMode: "v3-orthographic-v1" }), /four approved words/);
  await assert.rejects(reserveNativeWebAudioV3Variant({ ...args, uiEvidence: nativeEvidence(variant, { stability: 1 }) }), /Native UI evidence/);
  await assert.rejects(reserveNativeWebAudioV3Variant({ ...args, manifestSha256: "0".repeat(64) }), /current manifest/);
  await assert.rejects(reserveNativeWebAudioV3Variant({ ...args, entry: { ...original, meaning: "changed" } }), /current manifest/);
  const unrelated = entries.find((item) => item.id === "food-keeki");
  await assert.rejects(reserveNativeWebAudioV3Variant({ ...args, entry: unrelated, approvedId: unrelated.id }), /four approved words/);
});

test("native download matching excludes old files and rejects incomplete or ambiguous candidate mappings", () => {
  const record = { status: "awaiting-download", beforeNames: ["old-shizuka.mp3", "notes.txt"], startedAt: new Date().toISOString() };
  assert.equal(selectNativeCandidateDownload(record, ["old-shizuka.mp3", "notes.txt", "generation-one.mp3"]), "generation-one.mp3");
  assert.throws(() => selectNativeCandidateDownload(record, ["old-shizuka.mp3"]), /exactly one new MP3/);
  assert.throws(() => selectNativeCandidateDownload(record, ["new-one.mp3", "new-two.mp3"]), /exactly one new MP3/);
  assert.throws(() => selectNativeCandidateDownload(record, ["new-one.mp3", "another.crdownload"]), /still pending/);
  assert.throws(() => selectNativeCandidateDownload(record, ["../outside.mp3"]), /exactly one new MP3/);
  assert.throws(() => selectNativeCandidateDownload({ ...record, status: "complete" }, ["new-one.mp3"]), /before-snapshot/);
  assert.throws(() => selectNativeCandidateDownload(null, ["new-one.mp3"]), /before-snapshot/);
});

test("adding QA modes leaves original and legacy candidate fingerprints unchanged", async () => {
  const { entries } = await loadAudioManifest();
  const cake = entries.find((item) => item.id === "food-keeki");
  assert.deepEqual([cake, v3PunctuationVariantFor(cake), v3CandidateFor(v3PunctuationVariantFor(cake), 1)].map(webFingerprint), [
    "f762da4e0ef2a5118c12f5ae70e3fa254272cea24b529c45a21ab0889ba1020c",
    "f6dda01dfc37ca64af2e4aba747c46c264c7c8ee6564f978ce562e6254ae47f6",
    "08419be7ee4d47bf0f5b09993c58d26d633ee6dfd124c98bae29460c71cf512e",
  ]);
  const digest = (fingerprints) => createHash("sha256").update(JSON.stringify(fingerprints)).digest("hex");
  assert.equal(digest(entries.map(webFingerprint)), "3cfdbcb04b89fc4edb1f9f98523bca6fc687a7656ee04756f5952a25821882a9");
  for (const [mode, ids, expected] of [
    ["v3-punctuation-v1", Object.keys(APPROVED_V3_INPUTS), "c02ce8101807c6bf12d6821481cd1473c4043286ea67cb365439a03ced78c7fb"],
    ["v3-orthographic-v1", Object.keys(APPROVED_V3_ORTHOGRAPHIC_INPUTS), "b65ff253f3cd53999e1ac135328b383f4bd91e527460c8190189f0a50d15311a"],
    ["v3-hiragana-v1", ["home-teeburu", "clothes-seetaa", "shopping-baagen"], "8c98da610924f45ac5bff2298c3f802858e77a49689970b7cf34f3b2974a8e7a"],
    ["v3-hiragana-v1", Object.keys(APPROVED_V3_HIRAGANA_INPUTS), "92dbf6b55f3bfe8e54720b0b183766dd96e8a4ed587e3b2b2a7a9d4b89960bc5"],
    ["v3-katakana-v1", Object.keys(APPROVED_V3_KATAKANA_INPUTS), "d50eef711e4402c75bf0a0909e8c431c0c20c1659908528625657662d9820308"],
    ["v3-spaced-v1", Object.keys(APPROVED_V3_SPACED_INPUTS), "61fe6ecdf5db18c6a4464eb3d19bef066793013f0a3bb6581ebd85354b9071b1"],
  ]) {
    const fingerprints = ids.flatMap((id) => {
      const variant = v3VariantFor(entries.find((item) => item.id === id), mode);
      return [variant, v3CandidateFor(variant, 1), v3CandidateFor(variant, 2)].map(webFingerprint);
    });
    assert.equal(digest(fingerprints), expected, `${mode} pre-correction fingerprints must remain unchanged`);
  }
});
