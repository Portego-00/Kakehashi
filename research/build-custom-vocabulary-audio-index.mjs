#!/usr/bin/env node

// Local navigation document only. Refuses stale audits; never changes audio filenames.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { auditMetadata } from "./audit-custom-vocabulary-audio-metadata.mjs";
import { validateManifest } from "./generate-custom-vocabulary-audio.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = join(root, "output/custom-vocabulary-audio");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const escape = (value) => String(value).replace(/[\\|[\]<>]/g, (character) => `\\${character}`).replace(/\r?\n/g, " ");
const number = (value) => value.toLocaleString("en-US");

export function renderAudioIndex(manifest, report) {
  const lines = [
    "# Custom vocabulary audio index", "",
    `${number(manifest.entries.length)} individual words across ${number(manifest.packs.length)} packs. Voice: Shizuka — Natural & Soft (Japanese female).`, "",
    `Audio only: **${number(report.matchedAudioSize.bytes)} bytes** (${report.matchedAudioSize.megabytes} MB / ${report.matchedAudioSize.mebibytes} MiB).`, "",
    "Open a word's **Play MP3** link to hear its isolated local recording. The reading and meaning shown here come from the vocabulary catalog, not a transcription of the recording. This index preserves the local filenames.", "",
    "See [README](README.md) for generation settings, quality limitations, and licensing notes. See the [audio hosting guide](../../docs/custom-vocabulary-audio-hosting.md) for app publication details; this local index does not determine which recordings are published.", "",
    "Pronunciation QA: the [listening-review queue](qa/listening-review-queue.md) records targeted checks, not every raw speech-recognition flag. Consult the local QA records for listening decisions, corrections, and their current status. File integrity and speech-recognition results alone do not certify pronunciation.", "",
    `File-integrity snapshot: ${report.auditedAt}. This is not native-listening or pitch-accent certification.`, "",
  ];
  for (const pack of manifest.packs) {
    const entries = manifest.entries.filter((entry) => entry.packId === pack.id);
    const auditedPack = report.packs.find((item) => item.packId === pack.id);
    assert.ok(auditedPack && entries.length === auditedPack.valid && entries.length === pack.wordCount);
    lines.push(`## ${escape(pack.title)}`, "", `${entries.length} words · ${number(auditedPack.bytes)} bytes · ${auditedPack.durationSeconds.toFixed(2)} seconds`, "", "| Word | Reading | Meaning | Audio |", "| --- | --- | --- | --- |");
    for (const entry of entries) lines.push(`| ${escape(entry.characters)} | ${escape(entry.reading)} | ${escape(entry.primaryMeaning)} | [Play MP3](${encodeURI(`split audios/${entry.filename}`)}) |`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

export async function buildAudioIndex({ write = false } = {}) {
  const manifestBytes = await readFile(join(root, "research/data/custom-vocabulary-audio-manifest.json"));
  const manifest = JSON.parse(manifestBytes);
  validateManifest(manifest);
  const report = JSON.parse(await readFile(join(base, "audio-audit.json")));
  assert.equal(report.status, "complete");
  assert.equal(report.strict, true);
  assert.equal(report.fullDecode, true);
  assert.equal(report.manifestSha256, sha256(manifestBytes));
  assert.equal(report.validCount, manifest.entries.length);
  assert.equal(report.files.length, manifest.entries.length);
  const metadata = await auditMetadata();
  assert.equal(metadata.status, "complete");
  await readFile(join(base, "qa/listening-review-queue.md"));
  for (const entry of manifest.entries) {
    const audited = report.files.find((file) => file.id === entry.id);
    assert.ok(audited?.valid && audited.filename === entry.filename, `Missing audited entry: ${entry.id}`);
    const audio = await readFile(join(base, "split audios", entry.filename));
    assert.equal(sha256(audio), audited.sha256, `Physical audit is stale for ${entry.id}; rerun it before indexing.`);
    assert.equal(audio.length, audited.bytes);
  }
  const document = renderAudioIndex(manifest, report);
  if (write) await writeFile(join(base, "AUDIO_INDEX.md"), document);
  return { status: write ? "written" : "validated-not-written", wordCount: manifest.entries.length, packCount: manifest.packs.length, document };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--write")) throw new Error("Only --write is supported; otherwise validates without writing.");
  const { document, ...result } = await buildAudioIndex({ write: args.includes("--write") });
  console.log(JSON.stringify({ ...result, documentCharacters: document.length }, null, 2));
}
