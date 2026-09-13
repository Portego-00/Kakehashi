#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const API_REVISION = "20170710";
const API_ORIGIN = "https://api.wanikani.com";
const researchDirectory = dirname(fileURLToPath(import.meta.url));
const outputDirectory = resolve(researchDirectory, "data");
const token = process.env.WANIKANI_API_TOKEN?.trim();

function acceptedMeanings(subject) {
  return [...new Set([
    ...(subject.data.meanings ?? []).filter((meaning) => meaning.accepted_answer).map((meaning) => meaning.meaning),
    ...(subject.data.auxiliary_meanings ?? []).filter((meaning) => meaning.type === "whitelist").map((meaning) => meaning.meaning),
  ])];
}

async function fetchSubjects(types) {
  const subjects = [];
  const seenUrls = new Set();
  let pageCount = 0;
  let expectedTotal;
  let nextUrl = `${API_ORIGIN}/v2/subjects?types=${types.join(",")}`;
  while (nextUrl) {
    const url = new URL(nextUrl);
    if (url.origin !== API_ORIGIN || url.pathname !== "/v2/subjects" || url.username || url.password) {
      throw new Error("WaniKani returned an unsafe pagination URL");
    }
    if (seenUrls.has(url.href)) throw new Error("WaniKani returned a pagination loop");
    seenUrls.add(url.href);
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Wanikani-Revision": API_REVISION,
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`WaniKani subjects request failed with HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.data) || !Number.isInteger(payload.total_count)) throw new Error("WaniKani returned an invalid subjects collection");
    expectedTotal ??= payload.total_count;
    if (expectedTotal !== payload.total_count) throw new Error("WaniKani subject count changed during pagination");
    subjects.push(...payload.data);
    pageCount += 1;
    nextUrl = payload.pages?.next_url ?? null;
  }
  if (subjects.length !== expectedTotal || new Set(subjects.map((subject) => subject.id)).size !== subjects.length) {
    throw new Error("WaniKani subjects collection was incomplete or duplicated");
  }
  return { subjects, pageCount };
}

function latestUpdate(subjects) {
  return subjects.map((subject) => subject.data_updated_at).filter(Boolean).sort().at(-1) ?? null;
}

async function main() {
  if (!token) throw new Error("WANIKANI_API_TOKEN is required");
  const fetchedAt = new Date().toISOString();
  const [vocabulary, kanji] = await Promise.all([
    fetchSubjects(["vocabulary", "kana_vocabulary"]),
    fetchSubjects(["kanji"]),
  ]);
  const vocabularySubjects = vocabulary.subjects.map((subject) => ({
    id: subject.id,
    object: subject.object,
    characters: subject.data.characters,
    slug: subject.data.slug,
    readings: subject.object === "kana_vocabulary"
      ? [subject.data.characters]
      : (subject.data.readings ?? []).map((reading) => reading.reading),
    meanings: acceptedMeanings(subject),
    level: subject.data.level,
    hiddenAt: subject.data.hidden_at,
  }));
  const kanjiSubjects = kanji.subjects.map((subject) => ({
    id: subject.id,
    characters: subject.data.characters,
    slug: subject.data.slug,
    meanings: acceptedMeanings(subject),
    level: subject.data.level,
    hiddenAt: subject.data.hidden_at,
  }));
  const countsByLevel = Object.fromEntries(Array.from({ length: 60 }, (_, index) => {
    const level = index + 1;
    return [level, kanjiSubjects.filter((subject) => subject.level === level).length];
  }));
  const vocabularySnapshot = {
    apiRevision: API_REVISION,
    endpoint: "/v2/subjects?types=vocabulary,kana_vocabulary",
    fetchedAt,
    dataUpdatedAt: latestUpdate(vocabulary.subjects),
    totalCount: vocabularySubjects.length,
    pageCount: vocabulary.pageCount,
    countsByType: {
      kana_vocabulary: vocabularySubjects.filter((subject) => subject.object === "kana_vocabulary").length,
      vocabulary: vocabularySubjects.filter((subject) => subject.object === "vocabulary").length,
    },
    countsByVisibility: {
      visible: vocabularySubjects.filter((subject) => subject.hiddenAt === null).length,
      hidden: vocabularySubjects.filter((subject) => subject.hiddenAt !== null).length,
    },
    subjects: vocabularySubjects,
  };
  const kanjiSnapshot = {
    apiRevision: API_REVISION,
    endpoint: "/v2/subjects?types=kanji",
    fetchedAt,
    dataUpdatedAt: latestUpdate(kanji.subjects),
    totalCount: kanjiSubjects.length,
    pageCount: kanji.pageCount,
    countsByVisibility: {
      visible: kanjiSubjects.filter((subject) => subject.hiddenAt === null).length,
      hidden: kanjiSubjects.filter((subject) => subject.hiddenAt !== null).length,
    },
    countsByLevel,
    subjects: kanjiSubjects,
  };
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(resolve(outputDirectory, "wanikani-vocabulary-exclusions.snapshot.json"), `${JSON.stringify(vocabularySnapshot, null, 2)}\n`, "utf8"),
    writeFile(resolve(outputDirectory, "wanikani-kanji-levels.snapshot.json"), `${JSON.stringify(kanjiSnapshot, null, 2)}\n`, "utf8"),
  ]);
  console.log(`Refreshed ${vocabularySubjects.length} vocabulary and ${kanjiSubjects.length} kanji subjects with accepted meanings.`);
}

await main();
