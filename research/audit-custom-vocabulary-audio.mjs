#!/usr/bin/env node

// Read-only audio checks. This script never generates speech or contacts a service.
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultManifest = resolve(repositoryRoot, "research/data/custom-vocabulary-audio-manifest.json");
const audioExtensions = new Set([".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac"]);

function parseArguments(arguments_) {
  const options = { manifest: defaultManifest, audioDir: "", report: "", jobs: 4, decode: true, json: false, allowMissing: false, strict: false, help: false };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--json") options.json = true;
    else if (argument === "--skip-decode") options.decode = false;
    else if (argument === "--allow-missing") options.allowMissing = true;
    else if (argument === "--strict") options.strict = true;
    else if (["--manifest", "--audio-dir", "--report", "--jobs"].includes(argument)) {
      const value = arguments_[++index];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
      if (argument === "--jobs") options.jobs = Number(value);
      else options[{ "--manifest": "manifest", "--audio-dir": "audioDir", "--report": "report" }[argument]] = resolve(value);
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!Number.isInteger(options.jobs) || options.jobs < 1 || options.jobs > 16) throw new Error("--jobs must be an integer from 1 to 16.");
  if (!options.help && !options.audioDir) throw new Error("Pass --audio-dir with the local per-word audio directory.");
  if (options.strict && !options.decode) throw new Error("--strict requires full audio decoding; do not combine it with --skip-decode.");
  if (options.report && (extname(options.report).toLowerCase() !== ".json" || options.report === options.manifest)) throw new Error("--report must name a JSON report separate from the manifest.");
  return options;
}

function printHelp() {
  console.log(`Audit downloaded custom-vocabulary audio, without keys or network access.

Usage:
  node research/audit-custom-vocabulary-audio.mjs --audio-dir /absolute/path/to/assets

Options:
  --manifest PATH   Manifest JSON; defaults to research/data/custom-vocabulary-audio-manifest.json
  --audio-dir PATH  Root containing each manifest filename, e.g. conversation-glue/conversation-douzo.mp3
  --report PATH     Save the complete audit as JSON (only this report is written)
  --json            Print the complete JSON report instead of a short summary
  --jobs NUMBER     Concurrent file checks, 1–16 (default 4)
  --skip-decode     Check metadata and hashes only; skip decode/silence validation
  --allow-missing   Permit an incomplete batch to exit successfully; invalid files still fail
  --strict          Require one mono 44.1 kHz/128 kbps MP3 stream; fail on extra audio, symlinks, or duplicate audio

Requires ffprobe and, unless --skip-decode is used, ffmpeg on PATH.
Duration outliers and identical files for different readings are flagged for listening review.
The audit verifies file integrity and coverage, not Japanese pronunciation or voice quality.`);
}

function validateManifest(manifest) {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.entries) || manifest.entries.length === 0) {
    throw new Error("Manifest must have schemaVersion: 1 and a nonempty entries array.");
  }
  const ids = new Set();
  const filenames = new Set();
  for (const entry of manifest.entries) {
    if (!entry || typeof entry.id !== "string" || !entry.id || typeof entry.packId !== "string" || !entry.packId || typeof entry.reading !== "string" || !entry.reading) {
      throw new Error("Each manifest entry needs a nonempty id, packId, and reading.");
    }
    const filename = entry.filename;
    if (typeof filename !== "string" || isAbsolute(filename) || filename.includes("\\") || filename.split("/").some((part) => !part || part === "." || part === "..") || extname(filename).toLowerCase() !== ".mp3") {
      throw new Error(`Unsafe or non-MP3 filename for ${entry.id}.`);
    }
    if (ids.has(entry.id)) throw new Error(`Duplicate manifest id: ${entry.id}`);
    if (filenames.has(filename.toLowerCase())) throw new Error(`Duplicate manifest filename: ${filename}`);
    ids.add(entry.id);
    filenames.add(filename.toLowerCase());
  }
  return manifest.entries;
}

async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function inventory(directory, prefix = "") {
  const files = [];
  const ignoredLinks = [];
  let children;
  try { children = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === "ENOENT") return { files, ignoredLinks }; throw error; }
  for (const child of children.sort((left, right) => left.name.localeCompare(right.name))) {
    const filename = prefix ? `${prefix}/${child.name}` : child.name;
    const path = resolve(directory, child.name);
    if (child.isSymbolicLink()) ignoredLinks.push(filename);
    else if (child.isDirectory()) {
      const nested = await inventory(path, filename);
      files.push(...nested.files);
      ignoredLinks.push(...nested.ignoredLinks);
    } else if (child.isFile()) files.push({ filename, bytes: (await lstat(path)).size });
  }
  return { files, ignoredLinks };
}

function withinRoot(root, path) {
  const child = relative(root, path);
  return child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

function numeric(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function volume(stderr, name) {
  const value = stderr.match(new RegExp(`${name}:\\s*(-?(?:inf|\\d+(?:\\.\\d+)?))\\s*dB`, "i"))?.[1];
  return value === "-inf" ? -Infinity : value === "inf" ? Infinity : value === undefined ? null : numeric(value);
}

async function inspectAudio(entry, root, options) {
  const result = { id: entry.id, packId: entry.packId, filename: entry.filename, reading: entry.reading, present: false, valid: false, bytes: 0, durationSeconds: null, codec: null, sampleRate: null, channels: null, bitRate: null, containerBitRate: null, sha256: null, decodedPcmSha256: null, decoded: false, meanVolumeDb: null, maxVolumeDb: null, errors: [], warnings: [] };
  const path = resolve(root, entry.filename);
  let details;
  try { details = await lstat(path); }
  catch (error) { if (error.code === "ENOENT") return result; throw error; }
  result.present = true;
  result.bytes = details.size;
  if (!details.isFile() || details.isSymbolicLink()) result.errors.push("Expected a regular audio file; symbolic links are not audited.");
  else if (!withinRoot(root, await realpath(path))) result.errors.push("Resolved file is outside the supplied audio directory.");
  else if (details.size === 0) result.errors.push("Audio file is empty.");
  if (result.errors.length) return result;

  result.sha256 = await sha256(path);
  try {
    const { stdout } = await run("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "format=format_name,duration,bit_rate:stream=codec_type,codec_name,sample_rate,channels,duration,bit_rate", "-of", "json", path], { timeout: 30_000, maxBuffer: 1_048_576 });
    const probe = JSON.parse(stdout);
    const stream = probe.streams?.[0];
    result.codec = stream?.codec_name ?? null;
    result.sampleRate = numeric(stream?.sample_rate);
    result.channels = numeric(stream?.channels);
    result.bitRate = numeric(stream?.bit_rate ?? probe.format?.bit_rate);
    result.containerBitRate = numeric(probe.format?.bit_rate);
    result.durationSeconds = numeric(probe.format?.duration ?? stream?.duration);
    if (result.codec !== "mp3" || probe.format?.format_name !== "mp3") result.errors.push("File is not an MP3 audio stream in an MP3 container.");
    if (!(result.durationSeconds > 0)) result.errors.push("No valid positive audio duration.");
    if (result.durationSeconds > 0 && (result.durationSeconds < .2 || result.durationSeconds > 12)) result.warnings.push("Unusually short or long vocabulary audio; listen for clipping, repeated words, or excessive silence.");
    if (!(result.sampleRate > 0) || !(result.channels > 0)) result.errors.push("Missing audio sample-rate or channel metadata.");
    if (options.strict) {
      if (probe.streams?.length !== 1) result.errors.push("Expected exactly one audio stream.");
      if (result.sampleRate !== 44100) result.errors.push(`Expected 44,100 Hz audio; found ${result.sampleRate}.`);
      if (result.channels !== 1) result.errors.push(`Expected mono audio; found ${result.channels} channels.`);
      if (numeric(stream?.bit_rate) !== 128000) result.errors.push(`Expected a 128,000 bps MP3 stream; found ${numeric(stream?.bit_rate)}.`);
    }
  } catch (error) {
    result.errors.push(`Audio metadata could not be decoded: ${String(error.stderr || error.message).trim().slice(0, 800)}`);
  }

  if (options.decode && result.errors.length === 0) {
    try {
      const { stdout, stderr } = await run("ffmpeg", ["-hide_banner", "-nostdin", "-nostats", "-v", "info", "-xerror", "-i", path, "-map", "0:a:0", "-vn", "-sn", "-dn", "-af", "volumedetect", "-c:a", "pcm_s16le", "-f", "hash", "-hash", "sha256", "-"], { timeout: 30_000, maxBuffer: 1_048_576 });
      result.decoded = true;
      result.decodedPcmSha256 = stdout.match(/^SHA256=([a-f0-9]{64})$/m)?.[1] ?? null;
      if (!result.decodedPcmSha256) result.errors.push("Decoded audio did not yield a PCM fingerprint.");
      const peak = volume(stderr, "max_volume");
      const mean = volume(stderr, "mean_volume");
      result.maxVolumeDb = Number.isFinite(peak) ? peak : peak === -Infinity ? "-Infinity" : null;
      result.meanVolumeDb = Number.isFinite(mean) ? mean : mean === -Infinity ? "-Infinity" : null;
      if (peak === null) result.errors.push("Decoded audio did not yield volume measurements.");
      else if (peak < -55) result.errors.push("Audio is silent or nearly silent (peak below -55 dBFS).");
      else if (peak < -30) result.warnings.push("Audio is unusually quiet (peak below -30 dBFS).");
    } catch (error) {
      result.errors.push(`Full audio decode failed: ${String(error.stderr || error.message).trim().slice(-800)}`);
    }
  }
  result.valid = result.errors.length === 0;
  return result;
}

async function mapConcurrent(items, concurrency, operation) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await operation(items[index]);
    }
  }));
  return results;
}

function normalizedReading(reading) {
  return reading.normalize("NFKC").replace(/[\u30a1-\u30f6]/gu, (character) => String.fromCodePoint(character.codePointAt(0) - 0x60)).replace(/[\p{P}\p{Z}\s]+/gu, "");
}

function size(bytes) {
  return { bytes, megabytes: Number((bytes / 1_000_000).toFixed(3)), mebibytes: Number((bytes / 1_048_576).toFixed(3)) };
}

function statistics(values) {
  const sorted = values.filter(Number.isFinite).toSorted((left, right) => left - right);
  if (!sorted.length) return { count: 0, minimum: null, maximum: null, average: null, median: null };
  const middle = Math.floor(sorted.length / 2);
  return {
    count: sorted.length,
    minimum: sorted[0],
    maximum: sorted.at(-1),
    average: Number((sorted.reduce((total, value) => total + value, 0) / sorted.length).toFixed(6)),
    median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) return printHelp();
  const manifest = JSON.parse(await readFile(options.manifest, "utf8"));
  const entries = validateManifest(manifest);
  await run("ffprobe", ["-version"], { timeout: 5_000 });
  if (options.decode) await run("ffmpeg", ["-version"], { timeout: 5_000 });
  const root = await realpath(options.audioDir).catch((error) => { if (error.code === "ENOENT") return options.audioDir; throw error; });
  const [{ files, ignoredLinks }, results] = await Promise.all([
    inventory(root),
    mapConcurrent(entries, options.jobs, (entry) => inspectAudio(entry, root, options)),
  ]);
  const expectedNames = new Set(entries.map((entry) => entry.filename));
  const present = results.filter((entry) => entry.present);
  const valid = results.filter((entry) => entry.valid);
  const invalid = present.filter((entry) => !entry.valid);
  const missing = results.filter((entry) => !entry.present).map(({ id, filename }) => ({ id, filename }));
  const samples = files.filter((file) => file.filename.startsWith("_samples/") && audioExtensions.has(extname(file.filename).toLowerCase()));
  const extras = files.filter((file) => audioExtensions.has(extname(file.filename).toLowerCase()) && !file.filename.startsWith("_samples/") && !expectedNames.has(file.filename));
  const byHash = new Map();
  for (const entry of present.filter((entry) => entry.sha256)) {
    const fingerprint = entry.decodedPcmSha256 ? `pcm:${entry.sampleRate}:${entry.channels}:${entry.decodedPcmSha256}` : `file:${entry.sha256}`;
    const duplicates = byHash.get(fingerprint) ?? [];
    duplicates.push(entry);
    byHash.set(fingerprint, duplicates);
  }
  const duplicateAudio = [...byHash.entries()].filter(([, group]) => group.length > 1).map(([fingerprint, group]) => ({
    fingerprint,
    comparison: fingerprint.startsWith("pcm:") ? "Decoded signed 16-bit PCM, at the same sample rate and channel count" : "Identical file bytes",
    differentReadings: new Set(group.map((entry) => normalizedReading(entry.reading))).size > 1,
    entries: group.map(({ id, filename, reading }) => ({ id, filename, reading })),
  }));
  const packs = [...new Set(entries.map((entry) => entry.packId))].map((packId) => {
    const packEntries = results.filter((entry) => entry.packId === packId);
    const presentEntries = packEntries.filter((entry) => entry.present);
    const validEntries = packEntries.filter((entry) => entry.valid);
    return {
      packId,
      title: manifest.packs?.find((pack) => pack.id === packId)?.title ?? packId,
      expected: packEntries.length,
      present: presentEntries.length,
      valid: validEntries.length,
      invalid: presentEntries.length - validEntries.length,
      missing: packEntries.length - presentEntries.length,
      ...size(presentEntries.reduce((total, entry) => total + entry.bytes, 0)),
      durationSeconds: Number(presentEntries.reduce((total, entry) => total + (entry.durationSeconds ?? 0), 0).toFixed(6)),
      fileSizeBytes: statistics(presentEntries.map((entry) => entry.bytes)),
      fileDurationSeconds: statistics(presentEntries.map((entry) => entry.durationSeconds)),
    };
  });
  const bytes = present.reduce((total, entry) => total + entry.bytes, 0);
  const strictIssues = options.strict ? [
    ...(extras.length ? [`${extras.length} unexpected audio file(s).`] : []),
    ...(ignoredLinks.length ? [`${ignoredLinks.length} symbolic link(s) were not audited.`] : []),
    ...(duplicateAudio.length ? [`${duplicateAudio.length} duplicate audio hash group(s) require review.`] : []),
  ] : [];
  const report = {
    schemaVersion: 1,
    auditedAt: new Date().toISOString(),
    manifest: options.manifest,
    manifestSha256: await sha256(options.manifest),
    audioDirectory: root,
    fullDecode: options.decode,
    strict: options.strict,
    requiredFormat: options.strict ? { codec: "mp3", sampleRate: 44100, channels: 1, streamBitRate: 128000 } : null,
    status: invalid.length || strictIssues.length ? "invalid" : missing.length ? "incomplete" : "complete",
    expectedCount: entries.length,
    presentCount: present.length,
    validCount: valid.length,
    invalidCount: invalid.length,
    missingCount: missing.length,
    coveragePercent: Number((present.length / entries.length * 100).toFixed(2)),
    validatedCoveragePercent: Number((valid.length / entries.length * 100).toFixed(2)),
    matchedAudioSize: size(bytes),
    allAudioSize: size(files.filter((file) => audioExtensions.has(extname(file.filename).toLowerCase())).reduce((total, file) => total + file.bytes, 0)),
    sampleAudioSize: size(samples.reduce((total, file) => total + file.bytes, 0)),
    nonAudioFileCount: files.filter((file) => !audioExtensions.has(extname(file.filename).toLowerCase())).length,
    durationSeconds: Number(present.reduce((total, entry) => total + (entry.durationSeconds ?? 0), 0).toFixed(6)),
    fileSizeBytes: statistics(present.map((entry) => entry.bytes)),
    fileDurationSeconds: statistics(present.map((entry) => entry.durationSeconds)),
    flaggedForListeningCount: results.filter((entry) => entry.warnings.length).length,
    pronunciationAndVoiceQuality: "Requires listening review; not validated by this file audit.",
    missing,
    unexpectedAudioFiles: extras,
    sampleAudioFiles: samples,
    ignoredLinks,
    duplicateAudio,
    strictIssues,
    packs,
    files: results,
  };
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (options.report) {
    await mkdir(dirname(options.report), { recursive: true });
    await writeFile(options.report, json, "utf8");
  }
  if (options.json) console.log(json.trimEnd());
  else {
    console.log(`Custom vocabulary audio: ${report.status}`);
    console.log(`Coverage: ${present.length}/${entries.length} files (${report.coveragePercent}%); ${valid.length} valid, ${invalid.length} invalid, ${missing.length} missing.`);
    console.log(`Matched assets: ${bytes.toLocaleString("en-US")} bytes · ${report.matchedAudioSize.megabytes} MB · ${report.matchedAudioSize.mebibytes} MiB.`);
    console.log(`Duration: ${report.durationSeconds.toLocaleString("en-US")} seconds. Extra audio files: ${extras.length}. Duplicate groups: ${duplicateAudio.length}.`);
    if (present.length) console.log(`Per file: ${report.fileSizeBytes.minimum}–${report.fileSizeBytes.maximum} bytes (average ${report.fileSizeBytes.average}); ${report.fileDurationSeconds.minimum}–${report.fileDurationSeconds.maximum} seconds (average ${report.fileDurationSeconds.average}).`);
    console.log(`Listening flags: ${report.flaggedForListeningCount}; duplicate groups with different readings: ${duplicateAudio.filter((group) => group.differentReadings).length}.`);
    console.log(options.decode ? `Full audio decoded: ${results.filter((entry) => entry.decoded).length} files. Silence detection enabled; pronunciation/voice quality needs listening review.` : "Metadata-only audit; decode, silence, pronunciation, and voice quality have not been validated.");
    for (const entry of invalid.slice(0, 10)) console.log(`INVALID ${entry.filename}: ${entry.errors.join(" ")}`);
    for (const issue of strictIssues) console.log(`STRICT CHECK: ${issue}`);
    if (options.report) console.log(`JSON report: ${options.report}`);
  }
  if (invalid.length || strictIssues.length || (!options.allowMissing && missing.length)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Audio audit failed: ${error.message}`);
  process.exitCode = 1;
});
