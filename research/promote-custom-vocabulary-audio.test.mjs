import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { inspectPromotionCandidate, promoteApprovedVariant, recoverInterruptedPromotion } from "./promote-custom-vocabulary-audio.mjs";
import { VOICE_ID } from "./generate-custom-vocabulary-audio.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (data) => Buffer.from(`${JSON.stringify(data, null, 2)}\n`);
const fakeValidation = async () => ({ codec: "mp3", sampleRate: 44100, channels: 1, decoded: true, durationSeconds: 1, pronunciationReview: "pending" });

async function fixture({ kind = "v3-punctuation-v1", candidateIndex = 1, ttsInput = "カレー。" } = {}) {
  // Synthetic bytes are only used with the injected local validator, never as shipped audio.
  const base = await realpath(await mkdtemp(join(tmpdir(), "kakehashi-audio-promotion-test-")));
  const paths = { manifest: join(base, "manifest.json"), canonical: join(base, "final"), variants: join(base, "variants"), transactions: join(base, "promotions") };
  const entry = { id: "word", packId: "pack", filename: "pack/word.mp3", characters: "カレー", reading: "カレー", ttsInput: "カレー" };
  const manifest = json({ schemaVersion: 1, entries: [entry] });
  await writeFile(paths.manifest, manifest);
  await mkdir(join(paths.canonical, "pack"), { recursive: true });
  await mkdir(join(paths.variants, "pack"), { recursive: true });
  const originalAudio = Buffer.from("original synthetic clip");
  const replacementAudio = Buffer.from("replacement synthetic clip");
  const originalPath = join(paths.canonical, entry.filename);
  const parentVariantId = `word--${kind}`;
  const variantId = `${parentVariantId}--generation-${candidateIndex}`;
  const variantPath = join(paths.variants, "pack", `${variantId}.mp3`);
  const common = {
    schemaVersion: 1, status: "complete", manifestSha256: hash(manifest),
    provider: "ElevenLabs", method: "website", voiceId: VOICE_ID, voiceName: "Shizuka - Natural & Soft",
    packId: entry.packId, characters: entry.characters, reading: entry.reading, outputFormat: "mp3_44100_128",
  };
  const originalMetadata = json({ ...common, ...entry, modelId: "eleven_multilingual_v2", audio: { bytes: originalAudio.length, sha256: hash(originalAudio) } });
  const variantMetadata = json({
    ...common, id: variantId, filename: `pack/${variantId}.mp3`, ttsInput, modelId: "eleven_v3", settings: { stability: 0.5 }, observedSettings: { stability: 0.5 },
    fingerprint: "source-variant-fingerprint", playerText: `Generation ${candidateIndex}`,
    variant: { originalId: entry.id, originalPackId: entry.packId, originalFilename: entry.filename, originalTtsInput: entry.ttsInput, kind, promotionStatus: "not-promoted", candidateIndex, parentVariantId },
    audio: { bytes: replacementAudio.length, sha256: hash(replacementAudio) },
  });
  await Promise.all([
    writeFile(originalPath, originalAudio), writeFile(`${originalPath}.json`, originalMetadata),
    writeFile(variantPath, replacementAudio), writeFile(`${variantPath}.json`, variantMetadata),
  ]);
  const template = await inspectPromotionCandidate({ canonicalId: entry.id, variantId }, { paths });
  const approval = { ...template, sourceUiEvidence: { kind: "v3-generation-card", editorText: ttsInput, candidateLabel: `Generation ${candidateIndex}`, selectedVoiceName: "Shizuka - Natural & Soft", modelId: "eleven_v3" }, approvedBy: "root", approvedAt: "2026-09-07T15:10:00Z", evidence: "Explicit test-only approval based on an independently reviewed pronunciation candidate; not a native-listening certification." };
  return { paths, entry, originalPath, originalAudio, originalMetadata, variantPath, variantMetadata, replacementAudio, approval, template };
}

test("inspection binds hashes and actual v3 settings, but is not an approval", async () => {
  const f = await fixture();
  assert.equal(f.template.expectedVariantAudioSha256, hash(f.replacementAudio));
  assert.deepEqual(f.template.expectedSettings, { stability: 0.5 });
  assert.equal(f.template.approvedBy, null);
  await assert.rejects(promoteApprovedVariant(f.template, { paths: f.paths, validateAudio: fakeValidation }), /Explicit root approval/);
  assert.deepEqual(await readFile(f.originalPath), f.originalAudio);
});

test("default approval validation does not replace files or create transaction directories", async () => {
  const f = await fixture();
  const result = await promoteApprovedVariant(f.approval, { paths: f.paths, validateAudio: fakeValidation });
  assert.equal(result.status, "validated-not-applied");
  assert.deepEqual(await readFile(f.originalPath), f.originalAudio);
  await assert.rejects(readdir(f.paths.transactions), { code: "ENOENT" });
});

test("explicit promotion retains complete originals and source, while canonical metadata preserves actual generation settings", async () => {
  const f = await fixture();
  const result = await promoteApprovedVariant(f.approval, { apply: true, paths: f.paths, validateAudio: fakeValidation });
  assert.equal(result.status, "promoted");
  assert.deepEqual(await readFile(f.originalPath), f.replacementAudio);
  assert.deepEqual(await readFile(result.originalBackup.audioPath), f.originalAudio);
  assert.deepEqual(await readFile(result.originalBackup.metadataPath), f.originalMetadata);
  assert.deepEqual(await readFile(f.variantPath), f.replacementAudio);
  assert.deepEqual(await readFile(`${f.variantPath}.json`), f.variantMetadata);
  const metadata = JSON.parse(await readFile(`${f.originalPath}.json`));
  assert.equal(metadata.id, f.entry.id);
  assert.equal(metadata.filename, f.entry.filename);
  assert.equal(metadata.modelId, "eleven_v3");
  assert.equal(metadata.ttsInput, "カレー。");
  assert.equal(metadata.canonicalTtsInput, "カレー");
  assert.deepEqual(metadata.settings, { stability: 0.5 });
  assert.equal(metadata.promotion.sourceUiEvidenceOrigin, "root-approval-supplement");
  assert.equal(metadata.sourceUiEvidence.editorText, "カレー。");
  assert.equal(metadata.promotion.sourceAudioSha256, hash(f.replacementAudio));
  assert.equal(metadata.promotion.originalBackup.audioSha256, hash(f.originalAudio));
  assert.equal(JSON.parse(await readFile(result.journalPath)).state, "complete");
  await assert.rejects(readdir(join(f.paths.transactions, "promotion.lock")), { code: "ENOENT" });
  await assert.rejects(promoteApprovedVariant(f.approval, { apply: true, paths: f.paths, validateAudio: fakeValidation }), /Approval hash mismatch/);
});

test("wrong variant hash, source settings, or canonical identity cannot be promoted", async () => {
  const f = await fixture();
  for (const approval of [
    { ...f.approval, expectedVariantAudioSha256: "0".repeat(64) },
    { ...f.approval, expectedSettings: { stability: 1 } },
    { ...f.approval, canonicalId: "different" },
    { ...f.approval, sourceUiEvidence: null },
    { ...f.approval, sourceUiEvidence: { ...f.approval.sourceUiEvidence, candidateLabel: "Generation 2" } },
  ]) await assert.rejects(promoteApprovedVariant(approval, { apply: true, paths: f.paths, validateAudio: fakeValidation }));
  assert.deepEqual(await readFile(f.originalPath), f.originalAudio);
});

test("a failure between the two atomic file replacements restores both originals", async () => {
  const f = await fixture();
  await assert.rejects(promoteApprovedVariant(f.approval, { apply: true, paths: f.paths, validateAudio: fakeValidation, afterAudioReplacement: () => { throw new Error("Simulated interruption"); } }), /Simulated interruption/);
  assert.deepEqual(await readFile(f.originalPath), f.originalAudio);
  assert.deepEqual(await readFile(`${f.originalPath}.json`), f.originalMetadata);
  const directories = await readdir(f.paths.transactions);
  assert.equal(directories.length, 1);
  const journal = JSON.parse(await readFile(join(f.paths.transactions, directories[0], "journal.json")));
  assert.equal(journal.state, "rolled-back");
});

test("unknown external changes during failure are preserved and leave the journal locked for reconciliation", async () => {
  const f = await fixture();
  const external = Buffer.from("unexpected external edit");
  await assert.rejects(promoteApprovedVariant(f.approval, { apply: true, paths: f.paths, validateAudio: fakeValidation, afterAudioReplacement: async () => { await writeFile(`${f.originalPath}.json`, external); throw new Error("Interruption with external edit"); } }), /manual recovery/);
  assert.deepEqual(await readFile(`${f.originalPath}.json`), external);
  const owner = JSON.parse(await readFile(join(f.paths.transactions, "promotion.lock", "owner.json")));
  assert.deepEqual(await readFile(join(f.paths.transactions, owner.transactionId, "original.mp3")), f.originalAudio);
  assert.deepEqual(await readFile(join(f.paths.transactions, owner.transactionId, "original.mp3.json")), f.originalMetadata);
});

test("an existing promotion lock blocks a second replacement", async () => {
  const f = await fixture();
  await mkdir(join(f.paths.transactions, "promotion.lock"), { recursive: true });
  await assert.rejects(promoteApprovedVariant(f.approval, { apply: true, paths: f.paths, validateAudio: fakeValidation }), /active or interrupted/);
  assert.deepEqual(await readFile(f.originalPath), f.originalAudio);
});

test("an external metadata edit between replacements is detected even without a thrown failure", async () => {
  const f = await fixture();
  const external = Buffer.from("independent metadata edit");
  await assert.rejects(promoteApprovedVariant(f.approval, { apply: true, paths: f.paths, validateAudio: fakeValidation, afterAudioReplacement: () => writeFile(`${f.originalPath}.json`, external) }), /manual recovery/);
  assert.deepEqual(await readFile(`${f.originalPath}.json`), external);
  const owner = JSON.parse(await readFile(join(f.paths.transactions, "promotion.lock", "owner.json")));
  assert.deepEqual(await readFile(join(f.paths.transactions, owner.transactionId, "original.mp3.json")), f.originalMetadata);
});

async function interruptedFixture() {
  const f = await fixture();
  await assert.rejects(promoteApprovedVariant(f.approval, { apply: true, paths: f.paths, validateAudio: fakeValidation, afterAudioReplacement: () => writeFile(`${f.originalPath}.json`, "external edit") }), /manual recovery/);
  const ownerPath = join(f.paths.transactions, "promotion.lock", "owner.json");
  const owner = JSON.parse(await readFile(ownerPath));
  return { ...f, ownerPath, owner };
}

test("explicit recovery rejects a live transaction, then restores a known pair after its owner exits", async () => {
  const f = await interruptedFixture();
  await assert.rejects(recoverInterruptedPromotion(f.owner.transactionId, { paths: f.paths }), /still alive/);
  // This test-only dead PID is checked with signal 0; no process is terminated.
  await writeFile(f.ownerPath, json({ ...f.owner, pid: 2147483647 }));
  // Simulate separately reconciled metadata so both targets have known hashes.
  await writeFile(`${f.originalPath}.json`, f.originalMetadata);
  const result = await recoverInterruptedPromotion(f.owner.transactionId, { paths: f.paths });
  assert.equal(result.status, "restored-original-after-interruption");
  assert.deepEqual(await readFile(f.originalPath), f.originalAudio);
  assert.deepEqual(await readFile(`${f.originalPath}.json`), f.originalMetadata);
  await assert.rejects(readdir(join(f.paths.transactions, "promotion.lock")), { code: "ENOENT" });
});

test("recovery verifies both original backups before restoring either target", async () => {
  const f = await interruptedFixture();
  await writeFile(f.ownerPath, json({ ...f.owner, pid: 2147483647 }));
  await writeFile(`${f.originalPath}.json`, f.originalMetadata);
  await writeFile(join(f.paths.transactions, f.owner.transactionId, "original.mp3.json"), "corrupt backup");
  await assert.rejects(recoverInterruptedPromotion(f.owner.transactionId, { paths: f.paths }), /backup hash mismatch/);
  assert.deepEqual(await readFile(f.originalPath), f.replacementAudio);
  assert.deepEqual(await readFile(`${f.originalPath}.json`), f.originalMetadata);
});

test("a separately approved input variant preserves the canonical reading and actual spoken input", async () => {
  const f = await fixture({ kind: "v3-hiragana-v1", candidateIndex: 2, ttsInput: "かれー。" });
  const result = await promoteApprovedVariant(f.approval, { apply: true, paths: f.paths, validateAudio: fakeValidation });
  assert.equal(result.status, "promoted");
  const metadata = JSON.parse(await readFile(`${f.originalPath}.json`));
  assert.equal(metadata.variant.kind, "v3-hiragana-v1");
  assert.equal(metadata.variant.candidateIndex, 2);
  assert.equal(metadata.reading, "カレー");
  assert.equal(metadata.canonicalTtsInput, "カレー");
  assert.equal(metadata.ttsInput, "かれー。");
  assert.equal(metadata.sourceUiEvidence.editorText, "かれー。");
});
