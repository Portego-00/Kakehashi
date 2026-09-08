import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderAudioIndex } from "./build-custom-vocabulary-audio-index.mjs";

test("the index exposes all 565 words in the 49 catalog packs without changing filenames", async () => {
  const manifest = JSON.parse(await readFile(new URL("./data/custom-vocabulary-audio-manifest.json", import.meta.url)));
  // Rendering needs pack totals, not the ignored local recordings or operator audits.
  const bytes = manifest.entries.length * 1024;
  const report = {
    auditedAt: "2026-09-07T00:00:00Z",
    matchedAudioSize: { bytes, megabytes: bytes / 1_000_000, mebibytes: bytes / 1_048_576 },
    packs: manifest.packs.map((pack) => ({
      packId: pack.id,
      bytes: pack.wordCount * 1024,
      durationSeconds: pack.wordCount,
      valid: pack.wordCount,
    })),
  };
  const result = renderAudioIndex(manifest, report);
  assert.equal(result.match(/^## /gm).length, 49);
  const links = [...result.matchAll(/\[Play MP3\]\(([^)]+)\)/g)].map((match) => decodeURI(match[1]));
  assert.equal(links.length, 565);
  assert.equal(new Set(links).size, 565);
  assert.deepEqual(new Set(links), new Set(manifest.entries.map((entry) => `split audios/${entry.filename}`)));
  assert.ok(result.includes("| やっぱり | やっぱり | As Expected |"));
  assert.ok(result.includes("not native-listening or pitch-accent certification"));
  assert.ok(result.includes("[listening-review queue](qa/listening-review-queue.md)"));
  assert.ok(result.includes("[audio hosting guide](../../docs/custom-vocabulary-audio-hosting.md)"));
  assert.ok(!result.includes("have not been added to the app or uploaded"));
  assert.ok(!result.includes("unresolved targeted cases"));
});

test("table content is escaped and incomplete pack totals are rejected", () => {
  const manifest = { packs: [{ id: "pack", title: "Pack", wordCount: 1 }], entries: [{ id: "word", packId: "pack", filename: "pack/word.mp3", characters: "言葉", reading: "ことば", primaryMeaning: "word | language [term]" }] };
  const report = { auditedAt: "2026-09-07T00:00:00Z", matchedAudioSize: { bytes: 1024, megabytes: 0.001, mebibytes: 0.001 }, packs: [{ packId: "pack", bytes: 1024, durationSeconds: 1, valid: 1 }] };
  const result = renderAudioIndex(manifest, report);
  assert.ok(result.includes("word \\| language \\[term\\]"));
  assert.ok(result.includes("(split%20audios/pack/word.mp3)"));
  assert.throws(() => renderAudioIndex(manifest, { ...report, packs: [{ ...report.packs[0], valid: 0 }] }));
});
