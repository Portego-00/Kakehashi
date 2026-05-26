import type { SrsLevelName } from "../../components/SrsLevelIcon";
import type { Subject as WKSubject } from "../../types/wanikani";
import {
  convertKatakanaToHiragana,
  convertRomajiToHiragana,
} from "../../utils/answerChecker";
import { getAllSubjects, getSubjectById } from "../../utils/cache";

import {
  ARABIC_NUMBER_REGEX,
  DIGIT_SEQUENCE_REGEX,
  KANA_CHARACTER_REGEX,
  KANJI_CHARACTER_REGEX,
  KANJI_DIGITS,
  LARGE_NUMBER_UNITS,
  TRANSCRIPT_PUNCTUATION_REGEX,
} from "./constants";
import type { SubjectPartsOfSpeechLookup, VoiceReadingLookup } from "./types";

export function getSubjectDataRecord(subject: WKSubject): Record<string, any> {
  return (subject.data ?? {}) as Record<string, any>;
}

export function getSubjectIdList(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (id): id is number => typeof id === "number" && Number.isFinite(id),
  );
}

export function getSubjectMeanings(
  subject: WKSubject,
): { meaning: string; primary: boolean }[] {
  const meanings = getSubjectDataRecord(subject).meanings;
  if (!Array.isArray(meanings)) {
    return [];
  }

  return meanings
    .map((meaning) => ({
      meaning: typeof meaning?.meaning === "string" ? meaning.meaning : "",
      primary: meaning?.primary === true,
    }))
    .filter((meaning) => meaning.meaning.length > 0);
}

export function getSubjectReadings(subject: WKSubject): {
  reading: string;
  primary: boolean;
  type: "onyomi" | "kunyomi" | "nanori";
}[] {
  const readings = getSubjectDataRecord(subject).readings;
  if (!Array.isArray(readings)) {
    return [];
  }

  return readings
    .map((reading) => {
      const readingType =
        reading?.type === "kunyomi" || reading?.type === "nanori"
          ? reading.type
          : "onyomi";
      return {
        reading: typeof reading?.reading === "string" ? reading.reading : "",
        primary: reading?.primary === true,
        type: readingType,
      };
    })
    .filter((reading) => reading.reading.length > 0);
}

export function normalizeCachedSubject(value: unknown): WKSubject | null {
  if (
    value &&
    typeof value === "object" &&
    typeof (value as WKSubject).id === "number" &&
    (value as WKSubject).data
  ) {
    return value as WKSubject;
  }

  return null;
}

export async function loadCachedSubjectsByIds(
  ids: number[],
): Promise<WKSubject[]> {
  if (ids.length === 0) {
    return [];
  }

  const subjects = await Promise.all(ids.map((id) => getSubjectById(id)));
  return subjects
    .map(normalizeCachedSubject)
    .filter((subject): subject is WKSubject => Boolean(subject));
}

export function mapSubjectForDetailGrid(subject: WKSubject) {
  const data = getSubjectDataRecord(subject);
  const characterImages = Array.isArray(data.character_images)
    ? data.character_images
    : [];

  return {
    id: subject.id,
    characters: typeof data.characters === "string" ? data.characters : null,
    meanings: getSubjectMeanings(subject).map((meaning) => meaning.meaning),
    characterImages,
    imageUrl: characterImages[0]?.url || null,
    level: Number(data.level ?? 0),
  };
}

export function compactJapaneseText(text: string | null | undefined): string {
  return (text ?? "")
    .normalize("NFKC")
    .trim()
    .replace(TRANSCRIPT_PUNCTUATION_REGEX, "")
    .replace(/\s+/g, "");
}

export function isSingleKanjiVocabularySubject(subject: WKSubject): boolean {
  const subjectCharacters = compactJapaneseText(subject?.data?.characters);
  return (
    subject.object === "vocabulary" &&
    subjectCharacters.length === 1 &&
    KANJI_CHARACTER_REGEX.test(subjectCharacters)
  );
}

export function matchesJapaneseAnswer(
  input: string,
  expected: string,
): boolean {
  return (
    input === expected ||
    input.replace(/^〜/, "") === expected.replace(/^〜/, "")
  );
}

export function normalizeJapaneseReading(
  text: string | null | undefined,
): string {
  const compactText = compactJapaneseText(text);
  if (!compactText) {
    return "";
  }

  const hiraganaCandidate = convertKatakanaToHiragana(compactText);
  if (/[A-Za-z]/.test(hiraganaCandidate)) {
    return convertRomajiToHiragana(hiraganaCandidate);
  }

  return hiraganaCandidate;
}

function convertFourDigitGroupToKanji(groupDigits: string): string {
  const paddedGroup = groupDigits.padStart(4, "0");
  const unitByIndex = ["千", "百", "十", ""];
  let result = "";

  for (let index = 0; index < 4; index += 1) {
    const digitValue = Number.parseInt(paddedGroup[index] || "0", 10);
    if (!Number.isFinite(digitValue) || digitValue <= 0) {
      continue;
    }

    const unit = unitByIndex[index] || "";
    if (digitValue === 1 && unit) {
      result += unit;
    } else {
      result += `${KANJI_DIGITS[digitValue]}${unit}`;
    }
  }

  return result;
}

export function convertArabicNumberToKanji(value: string): string | null {
  if (!ARABIC_NUMBER_REGEX.test(value)) {
    return null;
  }

  const normalizedValue = value.replace(/^0+(?=\d)/, "");
  if (normalizedValue === "0") {
    return "零";
  }

  const groups: string[] = [];
  for (let cursor = normalizedValue.length; cursor > 0; cursor -= 4) {
    const start = Math.max(0, cursor - 4);
    groups.unshift(normalizedValue.slice(start, cursor));
  }

  if (groups.length > LARGE_NUMBER_UNITS.length) {
    return null;
  }

  let result = "";
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const groupKanji = convertFourDigitGroupToKanji(groups[groupIndex] || "");
    if (!groupKanji) {
      continue;
    }

    const unitIndex = groups.length - 1 - groupIndex;
    const groupUnit = LARGE_NUMBER_UNITS[unitIndex] || "";
    result += `${groupKanji}${groupUnit}`;
  }

  return result || "零";
}

export function replaceArabicNumbersWithKanji(text: string): string {
  return text.replace(DIGIT_SEQUENCE_REGEX, (digits) => {
    return convertArabicNumberToKanji(digits) || digits;
  });
}

export function normalizeAnswerKey(answer: string): string {
  return answer.trim().toLowerCase();
}

export function getSrsStageDisplayInfo(stage: number): {
  label: string;
  iconLevel: SrsLevelName;
} {
  switch (stage) {
    case 1:
      return { label: "Apprentice I", iconLevel: "Apprentice I" };
    case 2:
      return { label: "Apprentice II", iconLevel: "Apprentice II" };
    case 3:
      return { label: "Apprentice III", iconLevel: "Apprentice III" };
    case 4:
      return { label: "Apprentice IV", iconLevel: "Apprentice IV" };
    case 5:
      return { label: "Guru I", iconLevel: "Guru I" };
    case 6:
      return { label: "Guru II", iconLevel: "Guru II" };
    case 7:
      return { label: "Master", iconLevel: "Master" };
    case 8:
      return { label: "Enlightened", iconLevel: "Enlightened" };
    default:
      if (stage >= 9) {
        return { label: "Burned", iconLevel: "Burned" };
      }
      return { label: "Lesson", iconLevel: "Apprentice I" };
  }
}

export function uniqueNonEmptyAnswers(
  answers: (string | null | undefined)[],
): string[] {
  const deduped = new Map<string, string>();

  answers.forEach((answer) => {
    if (typeof answer !== "string") {
      return;
    }

    const trimmed = answer.trim();
    if (!trimmed) {
      return;
    }

    const key = normalizeAnswerKey(trimmed);
    if (!deduped.has(key)) {
      deduped.set(key, trimmed);
    }
  });

  return Array.from(deduped.values());
}

export function extractAnkiPartOfSpeechValues(
  partsOfSpeech: (string | null | undefined)[] | null | undefined,
): string[] {
  if (!Array.isArray(partsOfSpeech) || partsOfSpeech.length === 0) {
    return [];
  }

  return uniqueNonEmptyAnswers(
    partsOfSpeech.filter(
      (partOfSpeech): partOfSpeech is string =>
        typeof partOfSpeech === "string",
    ),
  );
}

let subjectPartsOfSpeechLookupCache: SubjectPartsOfSpeechLookup | null = null;
let subjectPartsOfSpeechLookupPromise: Promise<SubjectPartsOfSpeechLookup> | null =
  null;

function buildSubjectPartsOfSpeechLookup(
  subjects: WKSubject[],
): SubjectPartsOfSpeechLookup {
  const byId: Record<number, string[]> = {};

  for (const subject of subjects) {
    const subjectId = Number(subject?.id);
    if (!Number.isFinite(subjectId)) {
      continue;
    }

    const partOfSpeechValues = extractAnkiPartOfSpeechValues(
      (
        subject?.data as {
          parts_of_speech?: (string | null | undefined)[] | null;
        }
      )?.parts_of_speech,
    );

    if (partOfSpeechValues.length > 0) {
      byId[subjectId] = partOfSpeechValues;
    }
  }

  return { byId };
}

export async function ensureSubjectPartsOfSpeechLookup(): Promise<SubjectPartsOfSpeechLookup> {
  if (subjectPartsOfSpeechLookupCache) {
    return subjectPartsOfSpeechLookupCache;
  }

  if (!subjectPartsOfSpeechLookupPromise) {
    subjectPartsOfSpeechLookupPromise = (async () => {
      const subjects = await getAllSubjects();
      if (!Array.isArray(subjects) || subjects.length === 0) {
        const emptyLookup = { byId: {} };
        subjectPartsOfSpeechLookupCache = emptyLookup;
        return emptyLookup;
      }

      const lookup = buildSubjectPartsOfSpeechLookup(subjects as WKSubject[]);
      subjectPartsOfSpeechLookupCache = lookup;
      return lookup;
    })().catch((error) => {
      subjectPartsOfSpeechLookupPromise = null;
      throw error;
    });
  }

  return subjectPartsOfSpeechLookupPromise;
}

export function buildVoiceReadingLookupFromSubjects(
  subjects: WKSubject[],
): VoiceReadingLookup {
  const wordReadings = new Map<string, Set<string>>();
  const singleKanjiReadings = new Map<string, Set<string>>();

  for (const subject of subjects) {
    const subjectCharacters = compactJapaneseText(subject?.data?.characters);
    if (!subjectCharacters) {
      continue;
    }

    const readings = Array.isArray(subject?.data?.readings)
      ? subject.data.readings
      : [];
    if (readings.length === 0) {
      continue;
    }

    if (!wordReadings.has(subjectCharacters)) {
      wordReadings.set(subjectCharacters, new Set<string>());
    }

    const knownWordReadings = wordReadings.get(subjectCharacters);
    if (!knownWordReadings) {
      continue;
    }

    for (const readingEntry of readings) {
      const normalizedReading = normalizeJapaneseReading(readingEntry?.reading);
      if (normalizedReading) {
        knownWordReadings.add(normalizedReading);
      }
    }

    if (
      subject.object !== "kanji" ||
      subjectCharacters.length !== 1 ||
      !KANJI_CHARACTER_REGEX.test(subjectCharacters)
    ) {
      continue;
    }

    if (!singleKanjiReadings.has(subjectCharacters)) {
      singleKanjiReadings.set(subjectCharacters, new Set<string>());
    }

    const knownKanjiReadings = singleKanjiReadings.get(subjectCharacters);
    if (!knownKanjiReadings) {
      continue;
    }

    for (const readingEntry of readings) {
      const normalizedReading = normalizeJapaneseReading(readingEntry?.reading);
      if (normalizedReading) {
        knownKanjiReadings.add(normalizedReading);
      }
    }
  }

  const wordReadingsRecord: Record<string, string[]> = {};
  wordReadings.forEach((readings, characters) => {
    wordReadingsRecord[characters] = Array.from(readings);
  });

  const singleKanjiReadingsRecord: Record<string, string[]> = {};
  singleKanjiReadings.forEach((readings, characters) => {
    singleKanjiReadingsRecord[characters] = Array.from(readings);
  });

  return {
    wordReadings: wordReadingsRecord,
    singleKanjiReadings: singleKanjiReadingsRecord,
  };
}

export let voiceReadingLookupCache: VoiceReadingLookup | null = null;
let voiceReadingLookupPromise: Promise<VoiceReadingLookup> | null = null;

export async function ensureVoiceReadingLookup(): Promise<VoiceReadingLookup> {
  if (voiceReadingLookupCache) {
    return voiceReadingLookupCache;
  }

  if (!voiceReadingLookupPromise) {
    voiceReadingLookupPromise = (async () => {
      const subjects = await getAllSubjects();
      if (!Array.isArray(subjects) || subjects.length === 0) {
        throw new Error(
          "No cached subjects available for voice reading lookup.",
        );
      }

      const lookup = buildVoiceReadingLookupFromSubjects(
        subjects as WKSubject[],
      );
      if (Object.keys(lookup.wordReadings).length === 0) {
        throw new Error(
          "Failed to build voice reading lookup from cached subjects.",
        );
      }

      voiceReadingLookupCache = lookup;
      return lookup;
    })().catch((error) => {
      voiceReadingLookupPromise = null;
      throw error;
    });
  }

  return voiceReadingLookupPromise;
}

export function getTokenReadings(
  token: string,
  singleKanjiReadings: Record<string, string[]>,
): string[] {
  if (KANJI_CHARACTER_REGEX.test(token)) {
    return Array.from(new Set(singleKanjiReadings[token] ?? []));
  }

  if (KANA_CHARACTER_REGEX.test(token)) {
    const normalizedKana = normalizeJapaneseReading(token);
    return normalizedKana ? [normalizedKana] : [];
  }

  return token ? [token] : [];
}

export function canComposeExpectedReading(
  tokenReadings: string[][],
  expectedReading: string,
): boolean {
  const memo = new Map<string, boolean>();

  const search = (tokenIndex: number, readingIndex: number): boolean => {
    const memoKey = `${tokenIndex}:${readingIndex}`;
    const memoizedResult = memo.get(memoKey);
    if (memoizedResult !== undefined) {
      return memoizedResult;
    }

    if (tokenIndex >= tokenReadings.length) {
      const matches = readingIndex === expectedReading.length;
      memo.set(memoKey, matches);
      return matches;
    }

    const options = tokenReadings[tokenIndex] ?? [];
    for (const option of options) {
      if (!option || !expectedReading.startsWith(option, readingIndex)) {
        continue;
      }

      if (search(tokenIndex + 1, readingIndex + option.length)) {
        memo.set(memoKey, true);
        return true;
      }
    }

    memo.set(memoKey, false);
    return false;
  };

  return search(0, 0);
}

export function resolveExpectedReadingFromKanji(
  lookupKey: string,
  expectedReadings: string[],
  lookup: VoiceReadingLookup,
): string | null {
  if (!lookupKey || expectedReadings.length === 0) {
    return null;
  }

  const wkReadings = lookup.wordReadings[lookupKey] ?? [];
  if (wkReadings.length > 0) {
    const wkReadingSet = new Set(wkReadings);
    for (const expectedReading of expectedReadings) {
      if (wkReadingSet.has(expectedReading)) {
        return expectedReading;
      }
    }
  }

  if (!KANJI_CHARACTER_REGEX.test(lookupKey)) {
    return null;
  }

  const tokenReadings = Array.from(lookupKey).map((token) =>
    getTokenReadings(token, lookup.singleKanjiReadings),
  );

  if (tokenReadings.some((options) => options.length === 0)) {
    return null;
  }

  for (const expectedReading of expectedReadings) {
    if (!expectedReading) {
      continue;
    }

    if (canComposeExpectedReading(tokenReadings, expectedReading)) {
      return expectedReading;
    }
  }

  return null;
}
