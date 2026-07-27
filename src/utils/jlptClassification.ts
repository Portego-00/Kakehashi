import * as wanakana from "wanakana";
import jlptVocabularyData from "../data/jlptVocabularyData.json";
import { getJLPTLevel as getKanjiJLPTLevel } from "../data/jlptKanji";

export const JLPT_LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;

export type JLPTLevel = (typeof JLPT_LEVELS)[number];

type VocabularyData = {
  levels: Record<JLPTLevel, [string, string][]>;
};

export type JLPTClassifiableSubject = {
  object: string;
  data: {
    characters?: string | null;
    readings?: { reading?: string | null; accepted_answer?: boolean }[] | null;
  };
};

const vocabularyLevelByForm = new Map<string, JLPTLevel>();
const vocabularyLevelsByExpression = new Map<string, Set<JLPTLevel>>();
const vocabularyData = jlptVocabularyData as unknown as VocabularyData;

export function sanitizeJLPTLevels(value: unknown): JLPTLevel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const requestedLevels = new Set(value);
  return JLPT_LEVELS.filter((level) => requestedLevels.has(level));
}

function normalizeMarkerCharacters(value: string): string {
  return value.replace(/[~〜～]/g, "");
}

export function normalizeJLPTVocabularyExpression(value: string): string {
  return normalizeMarkerCharacters(value.normalize("NFKC"))
    .replace(/\s+/g, "")
    .trim();
}

export function normalizeJLPTVocabularyReading(value: string): string {
  const normalized = normalizeMarkerCharacters(value.normalize("NFKC"))
    .replace(/\s+/g, "")
    .trim();
  return wanakana.toHiragana(normalized);
}

function vocabularyFormKey(expression: string, reading: string): string {
  return `${normalizeJLPTVocabularyExpression(expression)}\u0000${normalizeJLPTVocabularyReading(reading)}`;
}

for (const level of JLPT_LEVELS) {
  const rows = vocabularyData.levels[level];

  for (const [expression, reading] of rows) {
    const normalizedExpression = normalizeJLPTVocabularyExpression(expression);
    const key = vocabularyFormKey(expression, reading);

    // The source levels are disjoint, but retaining the easiest match makes a
    // future source update deterministic if an entry appears in two levels.
    if (!vocabularyLevelByForm.has(key)) {
      vocabularyLevelByForm.set(key, level);
    }

    const expressionLevels =
      vocabularyLevelsByExpression.get(normalizedExpression) ?? new Set<JLPTLevel>();
    expressionLevels.add(level);
    vocabularyLevelsByExpression.set(normalizedExpression, expressionLevels);
  }
}

function compareJLPTLevels(left: JLPTLevel, right: JLPTLevel): number {
  return JLPT_LEVELS.indexOf(left) - JLPT_LEVELS.indexOf(right);
}

export function getJLPTLevelForVocabulary(
  expression: string | null | undefined,
  readings: readonly (string | null | undefined)[] = [],
): JLPTLevel | null {
  if (!expression) {
    return null;
  }

  const exactLevels = new Set<JLPTLevel>();
  for (const reading of readings) {
    if (!reading) continue;
    const level = vocabularyLevelByForm.get(vocabularyFormKey(expression, reading));
    if (level) exactLevels.add(level);
  }

  if (exactLevels.size > 0) {
    return [...exactLevels].sort(compareJLPTLevels)[0] ?? null;
  }

  const expressionLevels = vocabularyLevelsByExpression.get(
    normalizeJLPTVocabularyExpression(expression),
  );

  // Only fall back to spelling alone when it is unambiguous. Words such as
  // 開く and 明日 have reading-specific levels and must not be guessed.
  if (expressionLevels?.size === 1) {
    return expressionLevels.values().next().value ?? null;
  }

  return null;
}

export function getJLPTLevelForSubject(
  subject: JLPTClassifiableSubject,
): JLPTLevel | null {
  const characters = subject.data.characters;

  if (subject.object === "kanji") {
    return characters ? getKanjiJLPTLevel(characters) : null;
  }

  if (subject.object !== "vocabulary" && subject.object !== "kana_vocabulary") {
    return null;
  }

  const readings = Array.isArray(subject.data.readings)
    ? subject.data.readings
        .filter((reading) => reading.accepted_answer !== false)
        .map((reading) => reading.reading)
        .filter((reading): reading is string => typeof reading === "string")
    : [];

  return getJLPTLevelForVocabulary(characters, readings);
}

export function subjectMatchesJLPTLevels(
  subject: JLPTClassifiableSubject,
  selectedLevels: ReadonlySet<JLPTLevel>,
): boolean {
  if (selectedLevels.size === 0) {
    return true;
  }

  const level = getJLPTLevelForSubject(subject);
  return level !== null && selectedLevels.has(level);
}
