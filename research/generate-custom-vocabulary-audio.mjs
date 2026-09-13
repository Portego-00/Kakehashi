#!/usr/bin/env node

// Official endpoint/parameters: https://elevenlabs.io/docs/api-reference/text-to-speech/convert
// Headers: https://elevenlabs.io/docs/api-reference/introduction/
// Retries: https://elevenlabs.io/docs/eleven-api/resources/errors
// Local, explicitly invoked batch tool. Importing this module never reads a key or uses the network.
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, readFile, rename, rmdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const MANIFEST = join(ROOT, "research/data/custom-vocabulary-audio-manifest.json");
export const OUTPUT = join(ROOT, "output/custom-vocabulary-audio/split audios");
export const STATE = join(ROOT, "output/custom-vocabulary-audio/.elevenlabs-generation");
export const MAX_CHARGES = 4000;
export const VOICE_ID = "WQz3clzUdMqvBf0jswZQ";
export const ENDPOINT = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`;
export const SETTINGS = Object.freeze({ speed: 1, stability: 0.8, similarity_boost: 1, style: 0, use_speaker_boost: true });
const RATE_CODES = new Set(["rate_limit_exceeded", "concurrent_limit_exceeded", "too_many_concurrent_requests", "system_busy"]);
const SAFE_CODES = new Set([...RATE_CODES, "invalid_api_key", "quota_exceeded", "insufficient_credits", "voice_not_found", "model_access_denied", "missing_permissions", "validation_error"]);
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const now = () => new Date().toISOString();
function fail(message) { throw new Error(message); }

export function requestBody(entry) {
  // language_code is explicitly unsupported for multilingual_v2. Do not pretend it is enforced.
  return { text: entry.ttsInput, model_id: "eleven_multilingual_v2", voice_settings: { ...SETTINGS } };
}

export function validateManifest(manifest) {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.entries) || !manifest.entries.length) fail("Invalid audio manifest.");
  const ids = new Set();
  for (const entry of manifest.entries) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(entry.id ?? "") || !/^[a-z0-9][a-z0-9-]*$/.test(entry.packId ?? "")) fail("Unsafe or missing manifest ID.");
    if (ids.has(entry.id)) fail(`Duplicate word: ${entry.id}`);
    ids.add(entry.id);
    if (entry.filename !== `${entry.packId}/${entry.id}.mp3`) fail(`Unexpected filename for ${entry.id}.`);
    if (typeof entry.ttsInput !== "string" || !entry.ttsInput.trim() || entry.ttsInput !== entry.ttsInput.trim() || /[\u0000-\u001f]/u.test(entry.ttsInput) || [...entry.ttsInput].length > 100) fail(`Invalid isolated text for ${entry.id}.`);
  }
  return manifest.entries;
}

export function parseArgs(args) {
  const options = { dryRun: false, keyFile: null, ids: null, shard: null, range: null, help: false };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (["--key-file", "--ids", "--shard", "--range"].includes(arg)) {
      const value = args[++i];
      if (!value || value.startsWith("--")) fail(`${arg} requires a value.`);
      options[{ "--key-file": "keyFile", "--ids": "ids", "--shard": "shard", "--range": "range" }[arg]] = value;
    } else fail(`Unknown option: ${arg}`);
  }
  if ([options.ids, options.shard, options.range].filter(Boolean).length > 1) fail("Use only one of --ids, --range, or --shard.");
  if (!options.dryRun && !options.help && !options.keyFile) fail("--key-file is required for generation. No key is needed for --dry-run.");
  return options;
}

export function selectEntries(entries, options) {
  if (options.ids) {
    const ids = options.ids.split(",");
    if (new Set(ids).size !== ids.length) fail("Duplicate --ids values.");
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    return ids.map((id) => byId.get(id) ?? fail(`Unknown word ID: ${id}`));
  }
  if (options.shard) {
    const match = /^(\d+)\/(\d+)$/.exec(options.shard);
    const [n, total] = match ? match.slice(1).map(Number) : [];
    if (!Number.isInteger(n) || n < 1 || n > total || total > 100) fail("--shard must be n/total, with 1 <= n <= total <= 100.");
    return entries.filter((_, index) => index % total === n - 1);
  }
  if (options.range) {
    const match = /^(\d+):(\d+)$/.exec(options.range);
    const [start, end] = match ? match.slice(1).map(Number) : [];
    if (!Number.isInteger(start) || start < 1 || end < start || end > entries.length) fail("--range must be an inclusive 1-based start:end within the manifest.");
    return entries.slice(start - 1, end);
  }
  return entries;
}

async function exists(path) {
  try { return await lstat(path); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

async function ensureDirectory(path) {
  // Reject symlinked path components so assets and journals stay at their explicit destinations.
  const parent = dirname(path);
  if (parent !== path) await ensureDirectory(parent);
  const info = await exists(path);
  if (info) { if (!info.isDirectory() || info.isSymbolicLink()) fail("Output/state directory is not a regular directory."); return; }
  try { await mkdir(path, { mode: 0o700 }); } catch (error) { if (error.code !== "EEXIST") throw error; }
  const created = await lstat(path);
  if (!created.isDirectory() || created.isSymbolicLink()) fail("Output/state directory changed unexpectedly.");
}

async function writeExclusive(path, value) {
  const file = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await file.writeFile(value); await file.sync(); } finally { await file.close(); }
}

async function readJson(path) {
  const info = await exists(path);
  if (!info) return null;
  if (!info.isFile() || info.isSymbolicLink()) fail("Expected a regular JSON state file.");
  return JSON.parse(await readFile(path, "utf8"));
}

export async function readPrivateKey(path) {
  // Called only by the actual CLI, not dry runs or tests. Never echo values or raw fetch errors.
  const file = await open(resolve(path), constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await file.stat();
    if (!info.isFile() || (info.mode & 0o077) !== 0 || info.size > 2048 || (process.getuid && info.uid !== process.getuid())) fail("Key file must be private (0600/0400), regular, and owned by the current user.");
    const key = (await file.readFile("utf8")).trim();
    if (!/^[A-Za-z0-9_-]{20,1024}$/.test(key)) fail("Key file has an invalid format.");
    return key;
  } finally { await file.close(); }
}

export async function withBudget(stateDir, operation) {
  await ensureDirectory(stateDir);
  const lock = join(stateDir, "budget.lock");
  const deadline = Date.now() + 15000;
  while (true) {
    try { await mkdir(lock, { mode: 0o700 }); break; }
    catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (Date.now() > deadline) fail("Budget lock is busy or was interrupted. Do not remove it while another worker is active; inspect manually.");
      await wait(100);
    }
  }
  try {
    const ledgerPath = join(stateDir, "budget.json");
    const ledger = await readJson(ledgerPath) ?? { schemaVersion: 1, hardLimit: MAX_CHARGES, attempts: [], words: {} };
    if (ledger.schemaVersion !== 1 || ledger.hardLimit !== MAX_CHARGES || !Array.isArray(ledger.attempts) || !ledger.words) fail("Invalid shared budget ledger; refusing to reset it.");
    for (const attempt of ledger.attempts) if (!Number.isFinite(attempt.reservedCredits) || attempt.reservedCredits < 0) fail("Invalid budget reservation.");
    const result = await operation(ledger);
    const temporary = join(stateDir, `budget.${randomUUID()}.tmp`);
    await writeExclusive(temporary, `${JSON.stringify(ledger, null, 2)}\n`);
    await rename(temporary, ledgerPath); // Owned journal replacement is serialized by the lock.
    return result;
  } finally { await rmdir(lock); }
}

export async function reserveAttempt(stateDir, entry, fingerprint, owner, { creditMultiplier = 1 } = {}) {
  if (creditMultiplier !== 1 && creditMultiplier !== 2) fail("Only the original rate or conservative double-rate reservations are allowed.");
  return withBudget(stateDir, (ledger) => {
    if (ledger.haltReason) fail(`Shared budget stopped: ${ledger.haltReason}`);
    const word = ledger.words[entry.id];
    if (word && (word.fingerprint !== fingerprint || word.owner !== owner || word.status !== "pending")) fail(`${entry.id} already has a completed, active, or uncertain request. Inspect the journal; no automatic repeat.`);
    const previousAttempts = ledger.attempts.filter((attempt) => attempt.wordId === entry.id);
    if (previousAttempts.length >= 3) fail(`${entry.id} reached its lifetime three-attempt limit.`);
    const reservedCredits = [...entry.ttsInput].length * creditMultiplier;
    const reserved = ledger.attempts.reduce((sum, attempt) => sum + attempt.reservedCredits, 0);
    if (reserved + reservedCredits > MAX_CHARGES) fail(`Shared ${MAX_CHARGES}-credit ceiling would be exceeded.`);
    const attempt = { id: randomUUID(), wordId: entry.id, fingerprint, reservedCredits, inputCharacters: [...entry.ttsInput].length, creditMultiplier, status: "reserved", reservedAt: now() };
    ledger.attempts.push(attempt);
    ledger.words[entry.id] = { fingerprint, owner, status: "pending", lastAttemptId: attempt.id };
    return attempt;
  });
}

async function updateAttempt(stateDir, attemptId, patch, wordStatus) {
  return withBudget(stateDir, (ledger) => {
    const attempt = ledger.attempts.find((item) => item.id === attemptId);
    if (!attempt) fail("Budget reservation is missing; stopping.");
    Object.assign(attempt, patch, { updatedAt: now() });
    if (Number.isFinite(patch.reportedCharacterCost) && patch.reportedCharacterCost > attempt.reservedCredits) {
      attempt.reservedCredits = patch.reportedCharacterCost;
      ledger.haltReason = "Provider reported a cost above the reserved one-credit-per-character rate; manual review required.";
    }
    if (wordStatus) ledger.words[attempt.wordId].status = wordStatus;
  });
}

function safeHeader(response, name, key) {
  const value = response.headers.get(name);
  return value && !value.includes(key) && /^[A-Za-z0-9_.:-]{1,160}$/.test(value) ? value : null;
}

export async function requestSpeech(entry, key, { fetchImpl = fetch, timeoutMs = 45000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // No endpoint override or redirects: authentication can only reach this exact HTTPS origin.
    const response = await fetchImpl(ENDPOINT, {
      method: "POST", redirect: "error", signal: controller.signal,
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify(requestBody(entry)),
    });
    const costValue = response.headers.get("character-cost");
    const numericCost = costValue !== null && costValue.trim() !== "" ? Number(costValue) : NaN;
    const details = { httpStatus: response.status, requestId: safeHeader(response, "request-id", key), traceId: safeHeader(response, "x-trace-id", key), reportedCharacterCost: Number.isFinite(numericCost) && numericCost >= 0 ? numericCost : null };
    const chunks = [];
    let bytes = 0;
    const limit = response.ok ? 5_000_000 : 32_768;
    if (response.body) for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > limit) { controller.abort(); return { ...details, kind: "uncertain", code: "response_too_large" }; }
      chunks.push(Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks);
    if (!response.ok) {
      let detail;
      try { detail = JSON.parse(body.toString("utf8")).detail; } catch { /* Never print arbitrary response text. */ }
      const code = detail?.code ?? detail?.status;
      const safeCode = SAFE_CODES.has(code) ? code : "unrecognized_error";
      const isRateRejection = response.status === 429 && RATE_CODES.has(code);
      const retryAfterValue = response.headers.get("retry-after");
      let retryAfterMs = Number(retryAfterValue) * 1000;
      if (!Number.isFinite(retryAfterMs)) retryAfterMs = Date.parse(retryAfterValue) - Date.now();
      return { ...details, kind: isRateRejection ? "rate-rejected" : response.status >= 500 ? "uncertain" : "rejected", code: safeCode, retryAfterMs: Math.min(30000, Math.max(0, retryAfterMs || 0)) };
    }
    if (!/^audio\/(mpeg|mp3)(;|$)/i.test(response.headers.get("content-type") ?? "") || bytes === 0) return { ...details, kind: "uncertain", code: "unexpected_audio_response" };
    return { ...details, kind: "audio", audio: body };
  } catch { return { kind: "uncertain", code: "transport_or_redirect_failure", httpStatus: null, requestId: null, traceId: null, reportedCharacterCost: null }; }
  finally { clearTimeout(timer); }
}

export async function inspectAudio(path) {
  try {
    const { stdout } = await exec("ffprobe", ["-v", "error", "-show_entries", "format=format_name,duration:stream=codec_name,sample_rate,channels", "-of", "json", path], { timeout: 30000 });
    const probe = JSON.parse(stdout);
    const stream = probe.streams?.[0];
    const durationSeconds = Number(probe.format?.duration);
    if (probe.format?.format_name !== "mp3" || probe.streams?.length !== 1 || stream?.codec_name !== "mp3" || Number(stream.sample_rate) !== 44100 || stream.channels !== 1 || !(durationSeconds > 0 && durationSeconds < 30)) fail("Unexpected MP3 metadata.");
    const { stderr } = await exec("ffmpeg", ["-hide_banner", "-nostdin", "-nostats", "-v", "info", "-xerror", "-i", path, "-map", "0:a:0", "-af", "volumedetect", "-f", "null", "-"], { timeout: 30000, maxBuffer: 1048576 });
    const peakDb = Number(stderr.match(/max_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/)?.[1]);
    if (!Number.isFinite(peakDb) || peakDb < -55) fail("Silent or nearly silent audio.");
    return { codec: "mp3", sampleRate: 44100, channels: 1, durationSeconds, peakDb, decoded: true, pronunciationReview: "pending" };
  } catch { fail("Audio validation failed; downloaded response retained for manual inspection. No automatic regeneration."); }
}

function fingerprintFor(entry) {
  return sha256(JSON.stringify({ entry: { id: entry.id, packId: entry.packId, reading: entry.reading }, endpoint: ENDPOINT, request: requestBody(entry) }));
}

export async function inspectExisting(entry, outputDir = OUTPUT) {
  const audioPath = join(outputDir, entry.filename);
  const metadataPath = `${audioPath}.json`;
  const audioInfo = await exists(audioPath);
  const metadata = await readJson(metadataPath);
  if (!audioInfo && !metadata) return null;
  if (!audioInfo?.isFile() || audioInfo.isSymbolicLink() || !metadata) fail(`${entry.id}: incomplete existing output; refusing to overwrite or repeat.`);
  const bytes = await readFile(audioPath);
  if (metadata.schemaVersion !== 1 || metadata.status !== "complete" || metadata.fingerprint !== fingerprintFor(entry) || metadata.audio?.sha256 !== sha256(bytes) || metadata.audio?.bytes !== bytes.length) fail(`${entry.id}: existing audio metadata/hash/settings do not match; refusing overwrite.`);
  return metadata;
}

export async function generateOne(entry, key, { stateDir = STATE, outputDir = OUTPUT, manifestSha256, fetchImpl = fetch, inspect = inspectAudio, sleep = wait, emit = console.log } = {}) {
  const fingerprint = fingerprintFor(entry);
  const existing = await inspectExisting(entry, outputDir);
  if (existing) { emit(JSON.stringify({ id: entry.id, status: "skipped-matching" })); return existing; }
  await ensureDirectory(join(outputDir, entry.packId));
  await ensureDirectory(join(stateDir, "recovery"));
  const owner = randomUUID();
  for (let index = 0; index < 3; index += 1) {
    const attempt = await reserveAttempt(stateDir, entry, fingerprint, owner);
    emit(JSON.stringify({ id: entry.id, status: "request-reserved", attemptId: attempt.id, reservedCredits: attempt.reservedCredits }));
    const result = await requestSpeech(entry, key, { fetchImpl });
    const { audio, ...responseDetails } = result;
    await updateAttempt(stateDir, attempt.id, responseDetails, result.kind === "rate-rejected" && index < 2 ? null : result.kind === "audio" ? null : "blocked");
    if (result.kind === "rate-rejected" && index < 2) {
      const delay = Math.max(result.retryAfterMs, 1000 * 2 ** index);
      emit(JSON.stringify({ id: entry.id, status: "rate-limit-backoff", delayMs: delay }));
      await sleep(delay); // Each retry receives a new full reservation. No refunds, even for 429.
      continue;
    }
    if (result.kind !== "audio") fail(`${entry.id}: ${result.kind} (${result.code}); reservation retained and word blocked. Do not retry without reconciliation.`);
    const recoveryPath = join(stateDir, "recovery", `${attempt.id}.mp3`);
    try {
      await writeExclusive(recoveryPath, audio);
      const validation = await inspect(recoveryPath);
      const metadata = {
        schemaVersion: 1, status: "complete", generatedAt: now(), fingerprint, manifestSha256,
        id: entry.id, packId: entry.packId, filename: entry.filename, characters: entry.characters, reading: entry.reading, ttsInput: entry.ttsInput,
        provider: "ElevenLabs", voiceId: VOICE_ID, voiceName: "Shizuka - Natural & Soft", endpoint: ENDPOINT, request: requestBody(entry),
        language: { intended: "ja", enforcedByParameter: false, note: "Multilingual v2 does not support language_code; native Japanese voice and exact manifest text are used." },
        licenseStatus: "Free-plan output; noncommercial use only unless separately licensed", attemptId: attempt.id,
        response: responseDetails, reservedCredits: attempt.reservedCredits,
        audio: { bytes: audio.length, sha256: sha256(audio), ...validation },
      };
      const recoveryMetadata = `${recoveryPath}.json`;
      await writeExclusive(recoveryMetadata, `${JSON.stringify(metadata, null, 2)}\n`);
      // Hard links publish complete bytes exclusively; existing assets are never replaced.
      await link(recoveryPath, join(outputDir, entry.filename));
      await link(recoveryMetadata, `${join(outputDir, entry.filename)}.json`);
      await updateAttempt(stateDir, attempt.id, { status: "complete", audioSha256: metadata.audio.sha256 }, "complete");
      emit(JSON.stringify({ id: entry.id, status: "complete", requestId: result.requestId, durationSeconds: validation.durationSeconds }));
      return metadata;
    } catch {
      await updateAttempt(stateDir, attempt.id, { status: "recovery-required" }, "blocked");
      fail(`${entry.id}: validation/publication failed; response retained under recovery/${attempt.id}.mp3. Do not regenerate or overwrite; inspect recovery files.`);
    }
  }
}

export async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (options.help) {
    console.log(`Generate individual Shizuka vocabulary audio with a shared 4000-credit ceiling.
Usage: node research/generate-custom-vocabulary-audio.mjs --key-file PRIVATE_PATH [--ids ID,ID | --range 1:10 | --shard 1/2]
       node research/generate-custom-vocabulary-audio.mjs --dry-run [selection]
Output: output/custom-vocabulary-audio/split audios/<pack-id>/<word-id>.mp3 (+ .mp3.json metadata)
State: output/custom-vocabulary-audio/.elevenlabs-generation
No endpoint, voice, settings, output or budget override is supported.
Resume skips only matching complete audio/metadata pairs. Interrupted/uncertain words block repeats.
At most three attempts per word; only explicit 429 rate/concurrency rejections retry.
Every attempt permanently reserves its full input character count, including failed requests.
Keep the shared ledger; never reset it to recover credits. Provider key cap is an additional safeguard.
Free plan supports two concurrent requests: use at most two shard workers.
No keys or files are read from the browser. Dry-run never reads a key or sends a request.`);
    return;
  }
  const manifestBytes = await readFile(MANIFEST);
  const entries = selectEntries(validateManifest(JSON.parse(manifestBytes)), options);
  const statuses = await Promise.all(entries.map(async (entry) => ({ entry, existing: await inspectExisting(entry) })));
  const pending = statuses.filter((item) => !item.existing).map((item) => item.entry);
  const plannedCredits = pending.reduce((sum, entry) => sum + [...entry.ttsInput].length, 0);
  const ledger = await readJson(join(STATE, "budget.json"));
  const reservedCredits = ledger?.attempts?.reduce((sum, attempt) => sum + attempt.reservedCredits, 0) ?? 0;
  console.log(JSON.stringify({ dryRun: options.dryRun, selected: entries.length, alreadyComplete: entries.length - pending.length, pending: pending.length, plannedFirstPassCredits: plannedCredits, reservedCredits, hardLimit: MAX_CHARGES, ids: entries.map((entry) => entry.id) }));
  if (options.dryRun || !pending.length) return;
  if (plannedCredits + reservedCredits > MAX_CHARGES) fail("Selected first-pass work exceeds the remaining shared credit ceiling.");
  await exec("ffprobe", ["-version"], { timeout: 5000 });
  await exec("ffmpeg", ["-version"], { timeout: 5000 });
  const key = await readPrivateKey(options.keyFile);
  for (const entry of pending) await generateOne(entry, key, { manifestSha256: sha256(manifestBytes) });
}

if (typeof process !== "undefined" && process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    // No raw network errors, upstream bodies, request objects, headers, or stacks are printed.
    console.error(`Stopped: ${error.message}`);
    process.exitCode = 1;
  });
}
