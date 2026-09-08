#!/usr/bin/env node

// Independent, local-only provenance audit. Does not generate, promote, or modify audio.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateManifest, VOICE_ID } from "./generate-custom-vocabulary-audio.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = join(root, "output/custom-vocabulary-audio");
const canonicalRoot = join(base, "split audios");
const variantsRoot = join(base, "qa/variants");
const transactionsRoot = join(base, "qa/promotions");
const manifestPath = join(root, "research/data/custom-vocabulary-audio-manifest.json");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const v2Settings = { speed: 1, stability: 0.8, similarity_boost: 1, style: 0, use_speaker_boost: true };

async function bytes(path) {
  const info = await lstat(path);
  assert.ok(info.isFile() && !info.isSymbolicLink(), `Not a regular file: ${path}`);
  return readFile(path);
}

function settings(metadata) {
  assert.ok(["eleven_multilingual_v2", "eleven_v3"].includes(metadata.modelId), "Unknown model");
  assert.deepEqual(metadata.settings, metadata.modelId === "eleven_v3" ? { stability: 0.5 } : v2Settings, "Unexpected model settings");
  assert.deepEqual(metadata.observedSettings, metadata.settings, "Observed settings mismatch");
}

function identity(metadata, entry, manifestSha256) {
  assert.equal(metadata.schemaVersion, 1);
  assert.equal(metadata.status, "complete");
  assert.equal(metadata.manifestSha256, manifestSha256);
  for (const key of ["packId", "characters", "reading"]) assert.equal(metadata[key], entry[key], key);
  assert.equal(metadata.provider, "ElevenLabs");
  assert.equal(metadata.method, "website");
  assert.equal(metadata.voiceId, VOICE_ID);
  assert.equal(metadata.voiceName, "Shizuka - Natural & Soft");
  assert.equal(metadata.languageOverride, "Japanese");
  assert.equal(metadata.outputFormat, "mp3_44100_128");
}

async function promotedIdentity(metadata, metadataBytes, audioBytes, entry, manifestSha256) {
  const p = metadata.promotion;
  assert.match(p.transactionId, /^[a-f0-9-]{36}$/);
  assert.match(p.sourceVariantId, /^[a-z0-9][a-z0-9-]*$/);
  assert.ok(p.sourceVariantId.startsWith(`${entry.id}--`));
  assert.equal(p.approvedBy, "root");
  assert.ok(p.evidence?.length >= 40 && Number.isFinite(Date.parse(p.approvedAt)));
  const transaction = join(transactionsRoot, p.transactionId);
  const sourcePath = join(variantsRoot, entry.packId, `${p.sourceVariantId}.mp3`);
  // Never follow metadata-provided paths until they match this exact local identity.
  assert.equal(p.sourceVariantAudioPath, sourcePath);
  assert.equal(p.sourceVariantMetadataBackupPath, join(transaction, "source-variant.mp3.json"));
  assert.equal(p.originalBackup.audioPath, join(transaction, "original.mp3"));
  assert.equal(p.originalBackup.metadataPath, join(transaction, "original.mp3.json"));
  const [approvalBytes, journalBytes, originalAudio, originalMetadataBytes, sourceAudio, sourceMetadataBytes, sourceMetadataBackup] = await Promise.all([
    bytes(join(transaction, "approval.json")), bytes(join(transaction, "journal.json")),
    bytes(p.originalBackup.audioPath), bytes(p.originalBackup.metadataPath),
    bytes(sourcePath), bytes(`${sourcePath}.json`), bytes(p.sourceVariantMetadataBackupPath),
  ]);
  const approval = JSON.parse(approvalBytes), journal = JSON.parse(journalBytes), source = JSON.parse(sourceMetadataBytes), original = JSON.parse(originalMetadataBytes);
  assert.equal(hash(approvalBytes), p.approvalSha256);
  assert.equal(approval.approvedBy, "root");
  assert.equal(approval.approvedAt, p.approvedAt);
  assert.equal(approval.evidence.trim(), p.evidence);
  assert.equal(approval.canonicalId, entry.id);
  assert.equal(approval.variantId, p.sourceVariantId);
  assert.equal(approval.expectedCanonicalAudioSha256, hash(originalAudio));
  assert.equal(approval.expectedCanonicalMetadataSha256, hash(originalMetadataBytes));
  assert.equal(p.originalBackup.audioSha256, hash(originalAudio));
  assert.equal(p.originalBackup.metadataSha256, hash(originalMetadataBytes));
  assert.equal(approval.expectedVariantAudioSha256, hash(sourceAudio));
  assert.equal(approval.expectedVariantMetadataSha256, hash(sourceMetadataBytes));
  assert.equal(p.sourceAudioSha256, hash(sourceAudio));
  assert.equal(p.sourceMetadataSha256, hash(sourceMetadataBytes));
  assert.equal(hash(sourceMetadataBackup), hash(sourceMetadataBytes));
  assert.equal(hash(audioBytes), hash(sourceAudio));
  identity(original, entry, manifestSha256);
  identity(source, entry, manifestSha256);
  assert.equal(original.id, entry.id);
  assert.equal(original.filename, entry.filename);
  assert.equal(original.audio.sha256, hash(originalAudio));
  assert.equal(original.audio.bytes, originalAudio.length);
  assert.equal(source.id, p.sourceVariantId);
  assert.equal(source.filename, `${entry.packId}/${p.sourceVariantId}.mp3`);
  assert.equal(source.audio.sha256, hash(sourceAudio));
  assert.equal(source.audio.bytes, sourceAudio.length);
  assert.equal(source.variant.originalId, entry.id);
  assert.equal(source.variant.originalPackId, entry.packId);
  assert.equal(source.variant.originalFilename, entry.filename);
  assert.equal(source.variant.originalTtsInput, entry.ttsInput);
  for (const key of ["ttsInput", "modelId", "settings", "observedSettings"]) {
    assert.deepEqual(metadata[key], source[key], `Actual source ${key}`);
    assert.deepEqual(approval[`expected${key[0].toUpperCase()}${key.slice(1)}`], source[key], `Approval ${key}`);
  }
  assert.equal(metadata.canonicalTtsInput, entry.ttsInput);
  assert.equal(metadata.sourceGenerationFingerprint, source.fingerprint);
  assert.equal(metadata.variant.sourceVariantId, source.id);
  assert.equal(metadata.variant.promotionStatus, "promoted");
  if (source.modelId === "eleven_v3") {
    const evidence = { kind: "v3-generation-card", editorText: source.ttsInput, candidateLabel: `Generation ${source.variant.candidateIndex}`, selectedVoiceName: source.voiceName, modelId: source.modelId };
    assert.ok([1, 2].includes(source.variant.candidateIndex));
    assert.equal(source.id, `${source.variant.parentVariantId}--generation-${source.variant.candidateIndex}`);
    assert.deepEqual(approval.sourceUiEvidence, evidence);
    assert.deepEqual(metadata.sourceUiEvidence, evidence);
    if (source.sourceUiEvidence) assert.deepEqual(source.sourceUiEvidence, evidence);
    assert.ok(source.playerText.split(/\n/).map((line) => line.trim()).includes(evidence.candidateLabel));
  } else assert.ok(source.playerText.split(/\n/).map((line) => line.trim()).includes(source.ttsInput));
  assert.equal(journal.transactionId, p.transactionId);
  assert.equal(journal.state, "complete");
  assert.equal(journal.canonicalId, entry.id);
  assert.equal(journal.variantId, source.id);
  assert.equal(journal.canonicalAudioPath, join(canonicalRoot, entry.filename));
  assert.equal(journal.original.audioSha256, hash(originalAudio));
  assert.equal(journal.original.metadataSha256, hash(originalMetadataBytes));
  assert.equal(journal.replacement.audioSha256, hash(audioBytes));
  assert.equal(journal.replacement.metadataSha256, hash(metadataBytes));
  return { id: entry.id, variantId: source.id, transactionId: p.transactionId, modelId: source.modelId };
}

export async function auditMetadata() {
  const manifestBytes = await bytes(manifestPath), manifestSha256 = hash(manifestBytes);
  const entries = validateManifest(JSON.parse(manifestBytes));
  const report = { schemaVersion: 1, auditedAt: new Date().toISOString(), manifestSha256, expected: entries.length, valid: 0, originalCount: 0, promotedCount: 0, models: {}, promotions: [], errors: [], scope: "Identity, settings, audio/sidecar hashes, and explicit promotion provenance only; not pronunciation or pitch-accent certification." };
  // Refuse an inconsistent snapshot while the two-file publication may be in progress.
  try { await lstat(join(transactionsRoot, "promotion.lock")); throw new Error("Promotion lock exists; wait for a completed or recovered transaction before auditing."); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  for (const entry of entries) {
    try {
      const path = join(canonicalRoot, entry.filename);
      const [audioBytes, metadataBytes] = await Promise.all([bytes(path), bytes(`${path}.json`)]);
      const metadata = JSON.parse(metadataBytes);
      identity(metadata, entry, manifestSha256);
      settings(metadata);
      assert.equal(metadata.id, entry.id);
      assert.equal(metadata.filename, entry.filename);
      assert.equal(metadata.audio.sha256, hash(audioBytes));
      assert.equal(metadata.audio.bytes, audioBytes.length);
      if (metadata.promotion) {
        report.promotions.push(await promotedIdentity(metadata, metadataBytes, audioBytes, entry, manifestSha256));
        report.promotedCount += 1;
      } else {
        assert.equal(metadata.modelId, "eleven_multilingual_v2");
        assert.equal(metadata.ttsInput, entry.ttsInput);
        assert.ok(metadata.playerText?.split(/\n/).map((line) => line.trim()).includes(entry.ttsInput));
        report.originalCount += 1;
      }
      report.models[metadata.modelId] = (report.models[metadata.modelId] ?? 0) + 1;
      report.valid += 1;
    } catch (error) { report.errors.push({ id: entry.id, message: error.message }); }
  }
  report.status = report.errors.length ? "failed" : "complete";
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((arg) => !["--write-report", "--json"].includes(arg))) throw new Error("Supported flags: --json and --write-report (writes only output/custom-vocabulary-audio/audio-metadata-audit.json).");
  const report = await auditMetadata();
  if (args.includes("--write-report")) await writeFile(join(base, "audio-metadata-audit.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(args.includes("--json") ? report : { status: report.status, valid: report.valid, expected: report.expected, originalCount: report.originalCount, promotedCount: report.promotedCount, models: report.models, errors: report.errors }, null, 2));
  if (report.status !== "complete") process.exitCode = 1;
}
