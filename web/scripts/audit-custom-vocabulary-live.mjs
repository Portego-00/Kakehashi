import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const token = process.env.WANIKANI_API_TOKEN?.trim();
if (!token) throw new Error("Set WANIKANI_API_TOKEN before running the live custom-vocabulary audit.");

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const catalogPath = resolve(scriptDirectory, "../src/features/custom-srs/catalog.generated.json");
const packs = JSON.parse(await readFile(catalogPath, "utf8"));
if (!Array.isArray(packs) || packs.length < 30) throw new Error("The generated custom-vocabulary catalog is incomplete.");
const words = packs.flatMap((pack) => pack.words.map((word) => ({ ...word, pack })));
if (words.length < 500) throw new Error("The generated custom-vocabulary catalog is incomplete.");
if (new Set(words.map((word) => word.id)).size !== words.length) throw new Error("The generated custom-vocabulary catalog has duplicate word IDs.");
const headers = { Authorization: `Bearer ${token}`, "Wanikani-Revision": "20170710" };
const HAN_CHARACTER = /\p{Script=Han}/u;

function writtenKey(value) {
  return String(value).normalize("NFKC").trim();
}

function readingKey(value) {
  return Array.from(writtenKey(value), (character) => {
    const codePoint = character.codePointAt(0);
    return codePoint >= 0x30a1 && codePoint <= 0x30f6
      ? String.fromCodePoint(codePoint - 0x60)
      : character;
  }).join("");
}

function lexicalWrittenKey(value) {
  return writtenKey(value).replace(/^[おご御](?=\p{Script=Han})/u, "").replace(/する$/u, "");
}

function meaningKey(value) {
  return writtenKey(value).toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, " ").trim();
}

async function fetchCollection(url, minimumCount) {
  const resources = [];
  const seenUrls = new Set();
  let expectedTotal = null;
  let nextUrl = url;
  while (nextUrl) {
    const parsedUrl = new URL(nextUrl);
    if (parsedUrl.origin !== "https://api.wanikani.com" || parsedUrl.username || parsedUrl.password || parsedUrl.pathname !== "/v2/subjects") {
      throw new Error("WaniKani returned an unsafe pagination URL; the live audit stopped before forwarding credentials.");
    }
    if (seenUrls.has(parsedUrl.href)) throw new Error("WaniKani live audit detected a pagination loop.");
    seenUrls.add(parsedUrl.href);
    const response = await fetch(parsedUrl, { headers, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`WaniKani live audit failed with HTTP ${response.status}.`);
    const collection = await response.json();
    if (!Array.isArray(collection.data)) throw new Error("WaniKani live audit received an invalid collection.");
    if (!Number.isInteger(collection.total_count) || collection.total_count < minimumCount) throw new Error("WaniKani live audit received an incomplete collection count.");
    expectedTotal ??= collection.total_count;
    if (collection.total_count !== expectedTotal) throw new Error("WaniKani live audit collection count changed during pagination.");
    resources.push(...collection.data);
    nextUrl = collection.pages?.next_url ?? null;
  }
  if (resources.length !== expectedTotal) throw new Error(`WaniKani live audit expected ${expectedTotal} subjects but received ${resources.length}.`);
  if (new Set(resources.map((resource) => resource.id)).size !== resources.length) throw new Error("WaniKani live audit received duplicate subject IDs.");
  return resources;
}

const [vocabularySubjects, kanjiSubjects] = await Promise.all([
  fetchCollection("https://api.wanikani.com/v2/subjects?types=vocabulary,kana_vocabulary", 6_000),
  fetchCollection("https://api.wanikani.com/v2/subjects?types=kanji", 2_000),
]);
if (vocabularySubjects.some((subject) => subject.object !== "vocabulary" && subject.object !== "kana_vocabulary")) throw new Error("WaniKani live audit received an unexpected vocabulary subject type.");
if (kanjiSubjects.some((subject) => subject.object !== "kanji")) throw new Error("WaniKani live audit received an unexpected kanji subject type.");

const vocabularyByWritten = new Map(vocabularySubjects.map((subject) => [writtenKey(subject.data.characters), subject]));
const vocabularyByLexicalWritten = new Map();
const vocabularyByReading = new Map();
for (const subject of vocabularySubjects) {
  const lexicalKey = lexicalWrittenKey(subject.data.characters);
  const lexicalBucket = vocabularyByLexicalWritten.get(lexicalKey) ?? [];
  lexicalBucket.push(subject);
  vocabularyByLexicalWritten.set(lexicalKey, lexicalBucket);
  const readings = subject.object === "kana_vocabulary"
    ? [subject.data.characters]
    : subject.data.readings.map((reading) => reading.reading);
  for (const reading of readings) {
    const key = readingKey(reading);
    const bucket = vocabularyByReading.get(key) ?? [];
    bucket.push(subject);
    vocabularyByReading.set(key, bucket);
  }
}

const exactCollisions = [];
const writtenVariantCollisions = [];
const lexicalCollisions = [];
for (const word of words) {
  const written = writtenKey(word.characters);
  const exact = vocabularyByWritten.get(written);
  if (exact) exactCollisions.push({ custom: word.characters, wanikaniSubjectId: exact.id });
  for (const subject of vocabularyByLexicalWritten.get(lexicalWrittenKey(written)) ?? []) {
    if (writtenKey(subject.data.characters) !== written) writtenVariantCollisions.push({
      custom: word.characters,
      wanikani: subject.data.characters,
      wanikaniSubjectId: subject.id,
    });
  }

  const candidateMeanings = new Set(word.meanings.map(meaningKey));
  for (const subject of vocabularyByReading.get(readingKey(word.reading)) ?? []) {
    if (writtenKey(subject.data.characters) === written) continue;
    const acceptedMeanings = [
      ...subject.data.meanings.map((meaning) => meaning.meaning),
      ...(subject.data.auxiliary_meanings ?? []).filter((meaning) => meaning.type === "whitelist").map((meaning) => meaning.meaning),
    ];
    const sharedMeanings = acceptedMeanings
      .map(meaningKey)
      .filter((meaning) => candidateMeanings.has(meaning));
    if (sharedMeanings.length) lexicalCollisions.push({
      custom: word.characters,
      wanikani: subject.data.characters,
      wanikaniSubjectId: subject.id,
      sharedMeanings,
    });
  }
}

const visibleKanjiLevels = new Map(kanjiSubjects
  .filter((subject) => subject.data.hidden_at === null)
  .map((subject) => [writtenKey(subject.data.characters), subject.data.level]));
const invalidLevels = [];
for (const word of words.filter((candidate) => HAN_CHARACTER.test(candidate.characters))) {
  const components = [...new Set(Array.from(word.characters).filter((character) => character !== "々" && HAN_CHARACTER.test(character)))];
  const levels = components.map((character) => visibleKanjiLevels.get(character));
  const expected = levels.every(Number.isInteger) ? Math.max(...levels) : null;
  if (expected !== word.requiredLevel || components.some((character, index) => word.kanjiLevels?.[character] !== levels[index])) {
    invalidLevels.push({ custom: word.characters, expected, actual: word.requiredLevel });
  }
}

if (exactCollisions.length || writtenVariantCollisions.length || lexicalCollisions.length || invalidLevels.length) {
  console.error(JSON.stringify({ exactCollisions, writtenVariantCollisions, lexicalCollisions, invalidLevels }, null, 2));
  throw new Error("Live WaniKani custom-vocabulary audit found catalog conflicts.");
}

console.log(`Live audit passed: ${words.length} custom words checked against ${vocabularySubjects.length} vocabulary subjects and ${visibleKanjiLevels.size} visible kanji.`);
