#!/usr/bin/env node

// Local, explicitly approved file replacement only. No speech generation or network calls.
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { lstat, mkdir, open, rename, rmdir, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { inspectAudio, validateManifest, VOICE_ID } from "./generate-custom-vocabulary-audio.mjs";

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_PATHS = Object.freeze({
  manifest: join(root, "research/data/custom-vocabulary-audio-manifest.json"),
  canonical: join(root, "output/custom-vocabulary-audio/split audios"),
  variants: join(root, "output/custom-vocabulary-audio/qa/variants"),
  transactions: join(root, "output/custom-vocabulary-audio/qa/promotions"),
});
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fail = (message) => { throw new Error(message); };
const isHash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const safeId = (value) => typeof value === "string" && /^[a-z0-9][a-z0-9-]*$/.test(value);
const normalized = (value) => Array.isArray(value) ? value.map(normalized) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalized(value[key])])) : value;
const equal = (left, right) => JSON.stringify(normalized(left)) === JSON.stringify(normalized(right));

async function directory(path, create = false) {
  const parent = dirname(path);
  if (parent !== path) await directory(parent, create);
  let info;
  try { info = await lstat(path); }
  catch (error) {
    if (error.code !== "ENOENT" || !create) throw error;
    try { await mkdir(path, { mode: 0o700 }); } catch (collision) { if (collision.code !== "EEXIST") throw collision; }
    info = await lstat(path);
  }
  if (!info.isDirectory() || info.isSymbolicLink()) fail(`Not a regular directory: ${path}`);
}

async function regularBytes(path) {
  await directory(dirname(path));
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    if (!(await handle.stat()).isFile()) fail(`Not a regular file: ${path}`);
    return await handle.readFile();
  } finally { await handle.close(); }
}

async function exclusive(path, bytes) {
  const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
}
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);

async function writeJournal(path, journal) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await exclusive(temporary, jsonBytes(journal));
  await rename(temporary, path);
}

async function checkPhysicalAudio(path) {
  const { stdout } = await run("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=bit_rate", "-of", "json", path], { timeout: 30000 });
  if (JSON.parse(stdout).streams?.[0]?.bit_rate !== "128000") fail("Variant is not a 128 kbps MP3 stream.");
  return inspectAudio(path); // Fully decodes and rejects silence, wrong codec/rate/channels.
}

function validateV3UiEvidence(evidence, metadata) {
  const expected = {
    kind: "v3-generation-card", editorText: metadata.ttsInput,
    candidateLabel: `Generation ${metadata.variant.candidateIndex}`,
    selectedVoiceName: metadata.voiceName, modelId: metadata.modelId,
  };
  if (!equal(evidence, expected)) fail("V3 requires exact observed editor text, candidate label, voice, and model evidence.");
}

async function inspectPair({ canonicalId, variantId }, paths) {
  if (!safeId(canonicalId) || !safeId(variantId) || !variantId.startsWith(`${canonicalId}--`)) fail("A canonical ID and its explicitly named --variant ID are required.");
  const manifestBytes = await regularBytes(paths.manifest);
  const manifest = JSON.parse(manifestBytes);
  const entry = validateManifest(manifest).find((item) => item.id === canonicalId);
  if (!entry) fail("Canonical vocabulary ID is not in the manifest.");
  const canonicalAudioPath = join(paths.canonical, entry.filename);
  const variantAudioPath = join(paths.variants, entry.packId, `${variantId}.mp3`);
  const [canonicalAudio, canonicalMetadataBytes, variantAudio, variantMetadataBytes] = await Promise.all([
    regularBytes(canonicalAudioPath), regularBytes(`${canonicalAudioPath}.json`),
    regularBytes(variantAudioPath), regularBytes(`${variantAudioPath}.json`),
  ]);
  const canonicalMetadata = JSON.parse(canonicalMetadataBytes);
  const variantMetadata = JSON.parse(variantMetadataBytes);
  const manifestSha256 = sha256(manifestBytes);
  for (const [metadata, audio, label] of [[canonicalMetadata, canonicalAudio, "Canonical"], [variantMetadata, variantAudio, "Variant"]]) {
    if (metadata.schemaVersion !== 1 || metadata.status !== "complete" || metadata.audio?.sha256 !== sha256(audio) || metadata.audio?.bytes !== audio.length) fail(`${label} sidecar does not match the complete audio.`);
    if (metadata.manifestSha256 !== manifestSha256) fail(`${label} belongs to a different manifest.`);
    if (metadata.voiceId !== VOICE_ID || metadata.voiceName !== "Shizuka - Natural & Soft" || metadata.provider !== "ElevenLabs" || metadata.method !== "website") fail(`${label} does not identify the approved Shizuka website workflow.`);
    if (metadata.packId !== entry.packId || metadata.characters !== entry.characters || metadata.reading !== entry.reading) fail(`${label} vocabulary identity differs from the canonical manifest.`);
  }
  if (canonicalMetadata.id !== entry.id || canonicalMetadata.filename !== entry.filename) fail("Canonical sidecar identity/path mismatch.");
  if (variantMetadata.id !== variantId || variantMetadata.filename !== `${entry.packId}/${variantId}.mp3`) fail("Variant sidecar identity/path mismatch.");
  const origin = variantMetadata.variant;
  if (origin?.originalId !== entry.id || origin.originalPackId !== entry.packId || origin.originalFilename !== entry.filename || origin.originalTtsInput !== entry.ttsInput) fail("Variant does not explicitly belong to this canonical word and reading input.");
  if (!["eleven_multilingual_v2", "eleven_v3"].includes(variantMetadata.modelId) || !variantMetadata.settings || !variantMetadata.observedSettings || !variantMetadata.ttsInput) fail("Variant is missing its actual approved model, settings, or spoken input.");
  if (variantMetadata.outputFormat !== "mp3_44100_128") fail("Unexpected variant output format.");
  const playerLines = variantMetadata.playerText?.split(/\n/).map((line) => line.trim()) ?? [];
  if (variantMetadata.modelId === "eleven_v3") {
    if (![1, 2].includes(origin.candidateIndex) || variantId !== `${origin.parentVariantId}--generation-${origin.candidateIndex}` || !playerLines.includes(`Generation ${origin.candidateIndex}`)) fail("V3 player candidate identity mismatch.");
    // V3 result cards show a candidate label, not the editor text. Older candidate
    // sidecars remain immutable; their observed editor evidence must be supplied
    // explicitly in the hash-bound root approval instead.
    if (variantMetadata.sourceUiEvidence) validateV3UiEvidence(variantMetadata.sourceUiEvidence, variantMetadata);
  } else if (!playerLines.includes(variantMetadata.ttsInput)) fail("Variant input does not match the verified player text.");
  return { entry, manifestSha256, canonicalAudioPath, variantAudioPath, canonicalAudio, canonicalMetadataBytes, canonicalMetadata, variantAudio, variantMetadataBytes, variantMetadata };
}

export async function inspectPromotionCandidate(ids, { paths = DEFAULT_PATHS } = {}) {
  const pair = await inspectPair(ids, paths);
  return {
    schemaVersion: 1,
    canonicalId: pair.entry.id,
    variantId: pair.variantMetadata.id,
    expectedCanonicalAudioSha256: sha256(pair.canonicalAudio),
    expectedCanonicalMetadataSha256: sha256(pair.canonicalMetadataBytes),
    expectedVariantAudioSha256: sha256(pair.variantAudio),
    expectedVariantMetadataSha256: sha256(pair.variantMetadataBytes),
    expectedTtsInput: pair.variantMetadata.ttsInput,
    expectedModelId: pair.variantMetadata.modelId,
    expectedSettings: pair.variantMetadata.settings,
    expectedObservedSettings: pair.variantMetadata.observedSettings,
    sourceUiEvidence: pair.variantMetadata.sourceUiEvidence ?? null,
    approvedBy: null,
    approvedAt: null,
    evidence: null,
  };
}

function validateApproval(approval, pair) {
  if (approval?.schemaVersion !== 1 || approval.approvedBy !== "root" || typeof approval.evidence !== "string" || approval.evidence.trim().length < 40 || approval.evidence.length > 8000 || !Number.isFinite(Date.parse(approval.approvedAt))) fail("Explicit root approval, timestamp, and concrete quality evidence are required; an inspection template is not approval.");
  const comparisons = {
    expectedCanonicalAudioSha256: pair.canonicalAudio,
    expectedCanonicalMetadataSha256: pair.canonicalMetadataBytes,
    expectedVariantAudioSha256: pair.variantAudio,
    expectedVariantMetadataSha256: pair.variantMetadataBytes,
  };
  for (const [field, bytes] of Object.entries(comparisons)) if (!isHash(approval[field]) || approval[field] !== sha256(bytes)) fail(`Approval hash mismatch: ${field}. No replacement was made.`);
  for (const [field, actual] of [["expectedTtsInput", pair.variantMetadata.ttsInput], ["expectedModelId", pair.variantMetadata.modelId], ["expectedSettings", pair.variantMetadata.settings], ["expectedObservedSettings", pair.variantMetadata.observedSettings]]) if (!equal(approval[field], actual)) fail(`Approved variant configuration mismatch: ${field}.`);
  if (pair.variantMetadata.modelId === "eleven_v3") {
    validateV3UiEvidence(approval.sourceUiEvidence, pair.variantMetadata);
    if (pair.variantMetadata.sourceUiEvidence && !equal(approval.sourceUiEvidence, pair.variantMetadata.sourceUiEvidence)) fail("Approved UI evidence differs from the immutable variant sidecar.");
  }
}

async function currentHash(path) { return sha256(await regularBytes(path)); }

async function restoreKnownOriginals(journal, transactionDir) {
  const states = [
    { path: journal.canonicalAudioPath, backup: "original.mp3", before: journal.original.audioSha256, after: journal.replacement.audioSha256 },
    { path: `${journal.canonicalAudioPath}.json`, backup: "original.mp3.json", before: journal.original.metadataSha256, after: journal.replacement.metadataSha256 },
  ];
  // Validate both targets before touching either: never overwrite an unknown external edit.
  for (const state of states) if (![state.before, state.after].includes(await currentHash(state.path))) fail("Recovery found an unknown target hash; originals remain in the transaction backup. Manual reconciliation required.");
  for (const state of states) {
    state.bytes = await regularBytes(join(transactionDir, state.backup));
    if (sha256(state.bytes) !== state.before) fail("Original backup hash mismatch; manual reconciliation required.");
  }
  for (const state of states) {
    if (await currentHash(state.path) === state.before) continue;
    const temporary = join(transactionDir, `restore-${randomUUID()}`);
    await exclusive(temporary, state.bytes);
    if (await currentHash(state.path) !== state.after) fail("Recovery target changed during restoration; preserving the external edit for reconciliation.");
    await rename(temporary, state.path);
  }
}

export async function promoteApprovedVariant(approval, { apply = false, paths = DEFAULT_PATHS, validateAudio = checkPhysicalAudio, afterAudioReplacement } = {}) {
  const first = await inspectPair(approval, paths);
  validateApproval(approval, first);
  const validation = await validateAudio(first.variantAudioPath);
  if (!apply) return { status: "validated-not-applied", canonicalId: first.entry.id, variantId: first.variantMetadata.id, sourceAudioSha256: sha256(first.variantAudio), validation };
  await directory(paths.transactions, true);
  const lock = join(paths.transactions, "promotion.lock");
  try { await mkdir(lock, { mode: 0o700 }); } catch (error) { if (error.code === "EEXIST") fail("A promotion is active or interrupted. Inspect its journal; do not remove the lock blindly."); throw error; }
  const transactionId = randomUUID();
  const transactionDir = join(paths.transactions, transactionId);
  let release = true;
  let journal;
  try {
    // Re-read after taking the shared lock; approval binds all four original inputs.
    const pair = await inspectPair(approval, paths);
    validateApproval(approval, pair);
    await mkdir(transactionDir, { mode: 0o700 });
    await exclusive(join(lock, "owner.json"), jsonBytes({ transactionId, pid: process.pid, createdAt: new Date().toISOString() }));
    await exclusive(join(transactionDir, "original.mp3"), pair.canonicalAudio);
    await exclusive(join(transactionDir, "original.mp3.json"), pair.canonicalMetadataBytes);
    await exclusive(join(transactionDir, "source-variant.mp3.json"), pair.variantMetadataBytes);
    await exclusive(join(transactionDir, "approval.json"), jsonBytes(approval));
    const promotedAt = new Date().toISOString();
    const metadata = {
      ...pair.variantMetadata,
      id: pair.entry.id,
      filename: pair.entry.filename,
      canonicalTtsInput: pair.entry.ttsInput,
      sourceGenerationFingerprint: pair.variantMetadata.fingerprint,
      ...(pair.variantMetadata.modelId === "eleven_v3" ? { sourceUiEvidence: approval.sourceUiEvidence } : {}),
      variant: { ...pair.variantMetadata.variant, promotionStatus: "promoted", sourceVariantId: pair.variantMetadata.id },
      promotion: {
        schemaVersion: 1, transactionId, promotedAt, approvedBy: approval.approvedBy, approvedAt: approval.approvedAt, evidence: approval.evidence.trim(),
        sourceVariantId: pair.variantMetadata.id, sourceVariantAudioPath: pair.variantAudioPath,
        sourceAudioSha256: sha256(pair.variantAudio), sourceMetadataSha256: sha256(pair.variantMetadataBytes),
        sourceVariantMetadataBackupPath: join(transactionDir, "source-variant.mp3.json"),
        sourceUiEvidenceOrigin: pair.variantMetadata.sourceUiEvidence ? "variant-sidecar" : pair.variantMetadata.modelId === "eleven_v3" ? "root-approval-supplement" : "player-text",
        approvalSha256: sha256(jsonBytes(approval)),
        originalBackup: {
          audioPath: join(transactionDir, "original.mp3"), metadataPath: join(transactionDir, "original.mp3.json"),
          audioSha256: sha256(pair.canonicalAudio), metadataSha256: sha256(pair.canonicalMetadataBytes),
        },
      },
      audio: { ...pair.variantMetadata.audio, ...validation, sha256: sha256(pair.variantAudio), bytes: pair.variantAudio.length },
    };
    const metadataBytes = jsonBytes(metadata);
    await exclusive(join(transactionDir, "replacement.mp3"), pair.variantAudio);
    await exclusive(join(transactionDir, "replacement.mp3.json"), metadataBytes);
    journal = {
      schemaVersion: 1, transactionId, state: "prepared", createdAt: promotedAt,
      canonicalId: pair.entry.id, variantId: pair.variantMetadata.id, canonicalAudioPath: pair.canonicalAudioPath,
      original: { audioSha256: sha256(pair.canonicalAudio), metadataSha256: sha256(pair.canonicalMetadataBytes) },
      replacement: { audioSha256: sha256(pair.variantAudio), metadataSha256: sha256(metadataBytes) },
    };
    await writeJournal(join(transactionDir, "journal.json"), journal);
    // Copies stage the replacements; backups and QA sources are never moved or changed.
    await exclusive(join(transactionDir, "staged.mp3"), pair.variantAudio);
    await exclusive(join(transactionDir, "staged.mp3.json"), metadataBytes);
    if (await currentHash(pair.canonicalAudioPath) !== journal.original.audioSha256 || await currentHash(`${pair.canonicalAudioPath}.json`) !== journal.original.metadataSha256) fail("Canonical pair changed after approval; refusing to overwrite.");
    await rename(join(transactionDir, "staged.mp3"), pair.canonicalAudioPath);
    journal.state = "audio-replaced";
    await writeJournal(join(transactionDir, "journal.json"), journal);
    if (afterAudioReplacement) await afterAudioReplacement(); // Tests can simulate an interrupted pair update.
    if (await currentHash(`${pair.canonicalAudioPath}.json`) !== journal.original.metadataSha256) fail("Canonical metadata changed during replacement; preserving the external edit for reconciliation.");
    await rename(join(transactionDir, "staged.mp3.json"), `${pair.canonicalAudioPath}.json`);
    journal.state = "metadata-replaced";
    await writeJournal(join(transactionDir, "journal.json"), journal);
    if (await currentHash(pair.canonicalAudioPath) !== journal.replacement.audioSha256 || await currentHash(`${pair.canonicalAudioPath}.json`) !== journal.replacement.metadataSha256) fail("Published pair failed verification.");
    journal.state = "complete";
    journal.completedAt = new Date().toISOString();
    await writeJournal(join(transactionDir, "journal.json"), journal);
    return { status: "promoted", canonicalId: pair.entry.id, variantId: pair.variantMetadata.id, transactionId, journalPath: join(transactionDir, "journal.json"), originalBackup: metadata.promotion.originalBackup };
  } catch (error) {
    if (journal) {
      try {
        await restoreKnownOriginals(journal, transactionDir);
        journal.state = "rolled-back";
        journal.error = error.message;
        await writeJournal(join(transactionDir, "journal.json"), journal);
      } catch (recoveryError) {
        release = false;
        fail(`Promotion requires manual recovery at ${transactionDir}: ${recoveryError.message}`);
      }
    }
    throw error;
  } finally {
    if (release) {
      try { await unlink(join(lock, "owner.json")); } catch (error) { if (error.code !== "ENOENT") throw error; }
      await rmdir(lock);
    }
  }
}

export async function recoverInterruptedPromotion(transactionId, { paths = DEFAULT_PATHS } = {}) {
  if (!/^[a-f0-9-]{36}$/.test(transactionId)) fail("An exact promotion transaction ID is required.");
  const lock = join(paths.transactions, "promotion.lock");
  const owner = JSON.parse(await regularBytes(join(lock, "owner.json")));
  if (owner.transactionId !== transactionId) fail("The lock belongs to a different transaction.");
  // Never recover while the original process may still be editing files.
  try { process.kill(owner.pid, 0); fail("The promotion process is still alive; recovery is not allowed."); }
  catch (error) { if (error.code !== "ESRCH") throw error; }
  const transactionDir = join(paths.transactions, transactionId);
  const journal = JSON.parse(await regularBytes(join(transactionDir, "journal.json")));
  if (journal.transactionId !== transactionId || journal.schemaVersion !== 1) fail("Recovery journal mismatch.");
  const manifest = JSON.parse(await regularBytes(paths.manifest));
  const entry = validateManifest(manifest).find((item) => item.id === journal.canonicalId);
  if (!entry || journal.canonicalAudioPath !== join(paths.canonical, entry.filename)) fail("Recovery target is not the exact canonical manifest path.");
  await restoreKnownOriginals(journal, transactionDir);
  journal.state = "restored-original-after-interruption";
  journal.recoveredAt = new Date().toISOString();
  await writeJournal(join(transactionDir, "journal.json"), journal);
  await unlink(join(lock, "owner.json"));
  await rmdir(lock);
  return { status: journal.state, transactionId };
}

export async function main(args = process.argv.slice(2)) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === "--apply") options.apply = true;
    else if (flag === "--help") options.help = true;
    else if (["--canonical-id", "--variant-id", "--approval", "--recover"].includes(flag)) {
      const value = args[++index];
      if (!value || value.startsWith("--")) fail(`${flag} needs a value.`);
      options[flag.slice(2)] = value;
    } else fail(`Unknown option: ${flag}`);
  }
  if (options.help) return console.log("Read-only inspection: --canonical-id ID --variant-id ID\nValidate approval: --approval PATH\nExplicit replacement: --approval PATH --apply\nExplicit interrupted-transaction rollback: --recover TRANSACTION_ID --apply\nNo automatic promotion, generation, quality decision, or credential access occurs.");
  if (options.recover) {
    if (!options.apply || options.approval || options["canonical-id"] || options["variant-id"]) fail("Recovery requires only --recover TRANSACTION_ID --apply.");
    return console.log(JSON.stringify(await recoverInterruptedPromotion(options.recover), null, 2));
  }
  if (options.approval) {
    if (options["canonical-id"] || options["variant-id"]) fail("Approval already binds both IDs; do not add ID overrides.");
    const approval = JSON.parse(await regularBytes(resolve(options.approval)));
    return console.log(JSON.stringify(await promoteApprovedVariant(approval, { apply: options.apply === true }), null, 2));
  }
  if (options.apply) fail("--apply requires an explicit approval file.");
  console.log(JSON.stringify(await inspectPromotionCandidate({ canonicalId: options["canonical-id"], variantId: options["variant-id"] }), null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(`Promotion stopped: ${error.message}`); process.exitCode = 1; });
