import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type JsonPrimitive = boolean | null | number | string;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

type SourceWord = { characters: string; id: string; reading: string } & Record<string, JsonValue>;
type SourcePack = {
  description: string;
  id: string;
  levelRange?: { max: number; min: number };
  script: string;
  title: string;
  words: SourceWord[];
};

type SnapshotEntry = {
  characters: string;
  id: string;
  jmdictEntSeq: number;
  nonMnemonicSha256: string;
  reading: string;
} & Record<string, JsonValue>;

type JmdictSnapshot = {
  schemaVersion: number;
  catalog: {
    packCount: number;
    packMetadataSha256: string;
    sourceFileOrder: string[];
    sourceFiles: Array<{ packCount: number; path: string; wordCount: number }>;
    wordCount: number;
  };
  entries: SnapshotEntry[];
  verification: {
    ambiguousWordCount: number;
    expectedWordCount: number;
    resolvedWordCount: number;
    uniqueIdCount: number;
    unresolvedWordCount: number;
  };
  wanikaniVocabularyExclusion: {
    ambiguousPotentialCollisionCount: number;
    ambiguousReadingPairCount: number;
    dataUpdatedAt: string;
    readingPairCount: number;
    resolvedReadingPairCount: number;
    sameEntryCollisionCount: number;
    snapshotSha256: string;
    subjectCount: number;
    unmatchedReadingPairCount: number;
  };
};

const SOURCE_PATHS = [
  "research/data/kana-vocabulary-packs.json",
  "research/data/custom-vocab-kana-candidates.json",
  "research/data/custom-vocab-kana-expansion.json",
  "research/data/custom-vocab-kanji-candidates.json",
  "research/data/custom-vocab-kanji-expansion.json",
] as const;

const VERIFICATION_BOOLEAN_FIELDS = [
  "readingElementFound",
  "writtenFormVerified",
  "readingPairVerified",
  "reRestrVerified",
  "reNokanjiVerified",
  "stagkVerified",
  "stagrVerified",
  "applicableSenseVerified",
] as const;

function readJson(relativePath: string): JsonValue {
  return JSON.parse(readFileSync(resolve(process.cwd(), "..", relativePath), "utf8")) as JsonValue;
}

function sourcePacks(value: JsonValue): SourcePack[] {
  if (!Array.isArray(value) && (value === null || typeof value !== "object")) throw new TypeError("Source catalog must be an array or object");
  const packs = Array.isArray(value) ? value : value.packs;
  if (!Array.isArray(packs)) throw new TypeError("Source catalog must contain an array of packs");
  return packs as SourcePack[];
}

function canonicalize(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function sha256(value: JsonValue): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(value)), "utf8").digest("hex");
}

function withoutMnemonicFields(word: SourceWord): JsonValue {
  return Object.fromEntries(
    Object.entries(word).filter(([key]) => !["meaningMnemonic", "readingMnemonic", "readingMap", "jmdictPriorityTags"].includes(key)),
  ) as JsonValue;
}

const sourceCatalogs = SOURCE_PATHS.map((path) => ({ path, packs: sourcePacks(readJson(path)) }));
const packs = sourceCatalogs.flatMap((catalog) => catalog.packs);
const words = packs.flatMap((pack) => pack.words);
const snapshot = readJson("research/data/custom-vocab-jmdict-readings.snapshot.json") as JmdictSnapshot;

describe("custom vocabulary JMdict evidence integrity", () => {
  it("reproduces the snapshot's catalog metadata and every non-mnemonic word hash", () => {
    const packMetadata = packs.map((pack) => ({
      description: pack.description,
      id: pack.id,
      levelRange: pack.levelRange ?? null,
      script: pack.script,
      title: pack.title,
      wordIds: pack.words.map((word) => word.id),
    }));

    expect(snapshot.catalog.sourceFileOrder).toEqual(SOURCE_PATHS);
    expect(snapshot.catalog.sourceFiles).toEqual(
      sourceCatalogs.map(({ path, packs: sourceFilePacks }) => ({
        path,
        packCount: sourceFilePacks.length,
        wordCount: sourceFilePacks.flatMap((pack) => pack.words).length,
      })),
    );
    expect(snapshot.catalog.packCount).toBe(packs.length);
    expect(snapshot.catalog.wordCount).toBe(words.length);
    expect(sha256(packMetadata)).toBe(snapshot.catalog.packMetadataSha256);

    const snapshotById = new Map(snapshot.entries.map((entry) => [entry.id, entry]));
    for (const word of words) {
      expect(sha256(withoutMnemonicFields(word)), word.id).toBe(snapshotById.get(word.id)?.nonMnemonicSha256);
    }
  });

  it("maps every source word to one fully verified JMdict snapshot entry", () => {
    const sourceIds = words.map((word) => word.id);
    const snapshotIds = snapshot.entries.map((entry) => entry.id);

    expect(new Set(sourceIds).size).toBe(sourceIds.length);
    expect(new Set(snapshotIds).size).toBe(snapshotIds.length);
    expect([...snapshotIds].sort()).toEqual([...sourceIds].sort());

    const sourceById = new Map(words.map((word) => [word.id, word]));
    for (const entry of snapshot.entries) {
      const word = sourceById.get(entry.id);
      expect(word, entry.id).toBeDefined();
      expect(entry.characters, entry.id).toBe(word?.characters);
      expect(entry.reading, entry.id).toBe(word?.reading);
      expect(Number.isSafeInteger(entry.jmdictEntSeq), entry.id).toBe(true);
      expect(entry.jmdictEntSeq, entry.id).toBeGreaterThan(0);

      const recordedBooleanFields = Object.entries(entry)
        .filter(([, value]) => typeof value === "boolean")
        .map(([key]) => key)
        .sort();
      expect(recordedBooleanFields, entry.id).toEqual([...VERIFICATION_BOOLEAN_FIELDS].sort());
      for (const field of VERIFICATION_BOOLEAN_FIELDS) expect(entry[field], `${entry.id}: ${field}`).toBe(true);
    }
  });

  it("records a complete, unambiguous 500-plus-word resolution", () => {
    expect(snapshot.verification).toMatchObject({
      ambiguousWordCount: 0,
      expectedWordCount: words.length,
      resolvedWordCount: words.length,
      uniqueIdCount: words.length,
      unresolvedWordCount: 0,
    });
    expect(snapshot.entries).toHaveLength(words.length);
    expect(words.length).toBeGreaterThanOrEqual(500);
  });

  it("proves that no custom word shares a JMdict entry with WaniKani vocabulary", () => {
    const wanikaniSnapshotPath = resolve(process.cwd(), "../research/data/wanikani-vocabulary-exclusions.snapshot.json");
    const wanikaniSnapshotText = readFileSync(wanikaniSnapshotPath, "utf8");
    const wanikaniSnapshot = JSON.parse(wanikaniSnapshotText) as { dataUpdatedAt: string; totalCount: number };
    const evidence = snapshot.wanikaniVocabularyExclusion;

    expect(snapshot.schemaVersion).toBe(2);
    expect(evidence.snapshotSha256).toBe(createHash("sha256").update(wanikaniSnapshotText, "utf8").digest("hex"));
    expect(evidence.dataUpdatedAt).toBe(wanikaniSnapshot.dataUpdatedAt);
    expect(evidence.subjectCount).toBe(wanikaniSnapshot.totalCount);
    expect(evidence.readingPairCount).toBeGreaterThanOrEqual(evidence.subjectCount);
    expect(evidence.resolvedReadingPairCount + evidence.unmatchedReadingPairCount + evidence.ambiguousReadingPairCount).toBe(evidence.readingPairCount);
    expect(evidence.sameEntryCollisionCount).toBe(0);
    expect(evidence.ambiguousPotentialCollisionCount).toBe(0);
  });
});
