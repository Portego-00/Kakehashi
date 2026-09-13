#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const API_REVISION = "20170710";
const KANJI_ENDPOINT = "https://api.wanikani.com/v2/subjects?types=kanji";
const ALLOWED_MNEMONIC_TAGS = new Set(["kanji", "vocabulary", "em"]);
const HAN_CHARACTER = /\p{Script=Han}/u;
const researchDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(researchDirectory, "..");
const defaultSources = [
  resolve(researchDirectory, "data/custom-vocab-kanji-candidates.json"),
  resolve(researchDirectory, "data/custom-vocab-kanji-expansion.json"),
];

function displayPath(path) {
  const local = relative(repositoryRoot, path);
  return local.startsWith("..") ? path : local;
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function normalizedMeaning(value) {
  return String(value)
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[\p{P}\p{S}\s]+/gu, "");
}

function distinctWrittenKanji(characters) {
  const seen = new Set();
  const result = [];
  for (const character of Array.from(characters)) {
    if (
      character !== "々" &&
      HAN_CHARACTER.test(character) &&
      !seen.has(character)
    ) {
      seen.add(character);
      result.push(character);
    }
  }
  return result;
}

function writtenKanjiOccurrences(characters) {
  return Array.from(characters).filter(
    (character) => character !== "々" && HAN_CHARACTER.test(character),
  );
}

function readPacks(path) {
  let value;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(
      `${displayPath(path)} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const packs = Array.isArray(value) ? value : value?.packs;
  if (!Array.isArray(packs)) {
    throw new Error(`${displayPath(path)} does not contain a packs array`);
  }
  return packs;
}

async function fetchVisibleKanji(token) {
  const subjects = [];
  const seenUrls = new Set();
  let url = KANJI_ENDPOINT;
  while (url) {
    const parsedUrl = new URL(url);
    if (parsedUrl.origin !== "https://api.wanikani.com" || parsedUrl.pathname !== "/v2/subjects" || parsedUrl.username || parsedUrl.password) {
      throw new Error("WaniKani returned an unsafe pagination URL");
    }
    if (seenUrls.has(parsedUrl.href)) throw new Error("WaniKani returned a pagination loop");
    seenUrls.add(parsedUrl.href);
    const response = await fetch(parsedUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Wanikani-Revision": API_REVISION,
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new Error(
        `WaniKani kanji request failed with HTTP ${response.status}`,
      );
    }
    const payload = await response.json();
    if (!Array.isArray(payload?.data)) {
      throw new Error("WaniKani kanji response did not contain a data array");
    }
    subjects.push(...payload.data);
    url = payload.pages?.next_url ?? null;
  }

  return new Map(
    subjects
      .filter(
        (subject) =>
          subject?.object === "kanji" &&
          !subject.data?.hidden_at &&
          typeof subject.data?.characters === "string",
      )
      .map((subject) => [
        subject.data.characters,
        {
          level: subject.data.level,
          acceptedMeanings: [
            ...(subject.data.meanings ?? [])
              .filter((meaning) => meaning.accepted_answer)
              .map((meaning) => meaning.meaning),
            ...(subject.data.auxiliary_meanings ?? [])
              .filter((meaning) => meaning.type === "whitelist")
              .map((meaning) => meaning.meaning),
          ],
        },
      ]),
  );
}

function validateMarkup(mnemonic, location, errors) {
  const stack = [];
  for (const match of mnemonic.matchAll(/<\/?([a-z]+)>/giu)) {
    const name = match[1].toLowerCase();
    const closing = match[0][1] === "/";
    if (!ALLOWED_MNEMONIC_TAGS.has(name)) {
      errors.push(`${location}: disallowed mnemonic tag <${name}>`);
    }
    if (closing) {
      const opened = stack.pop();
      if (opened !== name) {
        errors.push(
          `${location}: closing </${name}> does not match <${opened ?? "none"}>`,
        );
      }
    } else {
      stack.push(name);
    }
  }
  if (stack.length) {
    errors.push(
      `${location}: unclosed mnemonic tags: ${stack.join(", ")}`,
    );
  }

  for (const match of mnemonic.matchAll(/<[^>]*>/gu)) {
    if (!/^<\/?(?:kanji|vocabulary|em)>$/iu.test(match[0])) {
      errors.push(`${location}: unsupported markup ${match[0]}`);
    }
  }
}

function validateWord({
  word,
  pack,
  sourcePath,
  liveKanji,
  errors,
  wordIds,
}) {
  const prefix = `${displayPath(sourcePath)}:${pack.id ?? "<pack>"}:${word?.id ?? "<word>"}`;
  if (!word || typeof word !== "object" || Array.isArray(word)) {
    errors.push(`${prefix}: word must be an object`);
    return;
  }
  if (typeof word.id !== "string" || !word.id.trim()) {
    errors.push(`${prefix}: word id is missing`);
  } else if (wordIds.has(word.id)) {
    errors.push(
      `${prefix}: duplicate word id; first seen in ${wordIds.get(word.id)}`,
    );
  } else {
    wordIds.set(word.id, displayPath(sourcePath));
  }

  const { min, max } = pack.levelRange ?? {};
  if (
    !Number.isInteger(word.requiredLevel) ||
    word.requiredLevel < min ||
    word.requiredLevel > max
  ) {
    errors.push(
      `${prefix}: requiredLevel ${String(word.requiredLevel)} is outside ${min}–${max}`,
    );
  }
  if (typeof word.characters !== "string" || !word.characters) {
    errors.push(`${prefix}: characters is missing`);
    return;
  }
  if (
    !word.kanjiLevels ||
    typeof word.kanjiLevels !== "object" ||
    Array.isArray(word.kanjiLevels)
  ) {
    errors.push(`${prefix}: kanjiLevels must be an object`);
    return;
  }

  const writtenComponents = writtenKanjiOccurrences(word.characters);
  const components = distinctWrittenKanji(word.characters);
  const mappedComponents = Object.keys(word.kanjiLevels);
  if (
    components.length !== mappedComponents.length ||
    components.some((component) => !mappedComponents.includes(component))
  ) {
    errors.push(
      `${prefix}: kanjiLevels must map every distinct written component exactly once (${components.join(" + ")})`,
    );
  }

  const liveLevels = [];
  for (const component of components) {
    const live = liveKanji.get(component);
    if (!live) {
      errors.push(
        `${prefix}: ${component} is absent or hidden in the live WaniKani kanji catalog`,
      );
      continue;
    }
    liveLevels.push(live.level);
    if (word.kanjiLevels[component] !== live.level) {
      errors.push(
        `${prefix}: ${component} has stored level ${String(word.kanjiLevels[component])}, live level ${live.level}`,
      );
    }
  }
  if (
    liveLevels.length === components.length &&
    word.requiredLevel !== Math.max(...liveLevels)
  ) {
    errors.push(
      `${prefix}: requiredLevel must equal the highest live component level (${Math.max(...liveLevels)})`,
    );
  }

  if (typeof word.meaningMnemonic !== "string") {
    errors.push(`${prefix}: meaningMnemonic is missing`);
    return;
  }
  validateMarkup(word.meaningMnemonic, prefix, errors);

  const paragraphs = word.meaningMnemonic
    .split(/\r?\n[\t ]*\r?\n/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  if (paragraphs.length < 2) {
    errors.push(
      `${prefix}: meaningMnemonic needs a blank-line usage paragraph`,
    );
  } else {
    const usage = paragraphs
      .slice(1)
      .join(" ")
      .replace(/<\/?(?:kanji|vocabulary|em)>/giu, "")
      .trim();
    if (usage.length < 24) {
      errors.push(`${prefix}: usage paragraph is too thin`);
    }
  }

  const firstParagraph = paragraphs[0] ?? "";
  const cues = Array.from(
    firstParagraph.matchAll(/<kanji>([^<]+)<\/kanji>/giu),
    (match) => match[1].trim(),
  );
  const cueComponents = cues.length === writtenComponents.length
    ? writtenComponents
    : cues.length === components.length
      ? components
      : null;
  if (!cueComponents) {
    errors.push(
      `${prefix}: expected ${components.length} distinct or ${writtenComponents.length} occurrence-level ordered <kanji> cues for ${writtenComponents.join(" + ")}, found ${cues.length}`,
    );
  }
  for (
    let index = 0;
    index < Math.min(cues.length, cueComponents?.length ?? 0);
    index += 1
  ) {
    const component = cueComponents[index];
    const live = liveKanji.get(component);
    if (!live) continue;
    const accepted = new Set(live.acceptedMeanings.map(normalizedMeaning));
    if (!accepted.has(normalizedMeaning(cues[index]))) {
      errors.push(
        `${prefix}: cue ${index + 1} for ${component} is <kanji>${cues[index]}</kanji>, not one of the live accepted meanings (${live.acceptedMeanings.join(", ")})`,
      );
    }
  }

  const payoffs = Array.from(
    firstParagraph.matchAll(/<vocabulary>([^<]+)<\/vocabulary>/giu),
    (match) => normalizedMeaning(match[1]),
  );
  const acceptedWordMeanings = new Set(
    Array.isArray(word.meanings)
      ? word.meanings.map(normalizedMeaning)
      : [],
  );
  if (
    payoffs.length === 0 ||
    !payoffs.some((payoff) => acceptedWordMeanings.has(payoff))
  ) {
    errors.push(
      `${prefix}: first paragraph needs a <vocabulary> payoff matching an accepted word meaning`,
    );
  }
}

function validatePack({
  pack,
  sourcePath,
  liveKanji,
  errors,
  packIds,
  wordIds,
}) {
  const location = `${displayPath(sourcePath)}:${pack?.id ?? "<pack>"}`;
  if (!pack || typeof pack !== "object" || Array.isArray(pack)) {
    errors.push(`${location}: pack must be an object`);
    return 0;
  }
  if (typeof pack.id !== "string" || !pack.id.trim()) {
    errors.push(`${location}: pack id is missing`);
  } else if (packIds.has(pack.id)) {
    errors.push(
      `${location}: duplicate pack id; first seen in ${packIds.get(pack.id)}`,
    );
  } else {
    packIds.set(pack.id, displayPath(sourcePath));
  }

  const { min, max } = pack.levelRange ?? {};
  if (
    !Number.isInteger(min) ||
    !Number.isInteger(max) ||
    min < 1 ||
    max > 60 ||
    (min - 1) % 5 !== 0 ||
    max !== min + 4
  ) {
    errors.push(
      `${location}: levelRange must be an exact five-level band from 1–5 through 56–60`,
    );
  }
  if (!Array.isArray(pack.words) || pack.words.length === 0) {
    errors.push(`${location}: pack must contain words`);
    return 0;
  }

  for (const word of pack.words) {
    validateWord({
      word,
      pack,
      sourcePath,
      liveKanji,
      errors,
      wordIds,
    });
  }
  return pack.words.length;
}

async function main() {
  const token = process.env.WANIKANI_API_TOKEN?.trim();
  if (!token) {
    fail(
      "WANIKANI_API_TOKEN is required in the environment to audit live component meanings and levels.",
    );
    return;
  }

  const argumentsFromCli = process.argv.slice(2);
  const sourcePaths = argumentsFromCli.length
    ? argumentsFromCli.map((path) => resolve(process.cwd(), path))
    : defaultSources.filter(existsSync);
  if (sourcePaths.length === 0) {
    fail("No kanji vocabulary source files were found.");
    return;
  }
  const explicitlyMissing = sourcePaths.filter((path) => !existsSync(path));
  if (explicitlyMissing.length) {
    for (const path of explicitlyMissing) {
      fail(`Source file does not exist: ${displayPath(path)}`);
    }
    return;
  }

  let liveKanji;
  try {
    liveKanji = await fetchVisibleKanji(token);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    return;
  }

  const errors = [];
  const packIds = new Map();
  const wordIds = new Map();
  let packCount = 0;
  let wordCount = 0;
  for (const sourcePath of sourcePaths) {
    let packs;
    try {
      packs = readPacks(sourcePath);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      continue;
    }
    packCount += packs.length;
    for (const pack of packs) {
      wordCount += validatePack({
        pack,
        sourcePath,
        liveKanji,
        errors,
        packIds,
        wordIds,
      });
    }
  }

  if (errors.length) {
    console.error(
      `Kanji composition audit failed with ${errors.length} error${errors.length === 1 ? "" : "s"}:`,
    );
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Kanji composition audit passed: ${sourcePaths.length} source file${sourcePaths.length === 1 ? "" : "s"}, ${packCount} packs, ${wordCount} words, ${liveKanji.size} visible WaniKani kanji.`,
  );
}

await main();
