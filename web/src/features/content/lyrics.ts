import { collectJapaneseTerms } from "./annotation";
import type { TimedLyricLine } from "./types";

const LRC_TIMESTAMP_RE = /\[(?:\d{1,2}:)?\d{1,2}(?:\.\d{1,3})?\]/g;
const LEADING_COMMA_RE = /^\s*,\s*/;
const JAPANESE_TEXT_RE = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\u3005\u3006\u303b\uff66-\uff9f]/;
export const LYRIC_TRANSLATION_LINE_LIMIT = 120;
export const LYRIC_TRANSLATION_LINE_MAX_CHARACTERS = 2_000;
export const LYRIC_TRANSLATION_SOURCE_MAX_CHARACTERS = 50_000;
export const LYRIC_TRANSLATION_MAX_CHARACTERS = 8_000;

export type LyricLineTranslations = Record<string, string>;

export interface LyricsQuestion {
  id: string;
  lineIndex: number;
  before: string;
  answer: string;
  after: string;
  options: string[];
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function lyricsTranslationFingerprint(sourceText: string) {
  return `${sourceText.length}:${stableHash(sourceText).toString(36)}`;
}

export function normalizeLyricLineForTranslation(line: string) {
  return line.replace(LRC_TIMESTAMP_RE, "").trim();
}

export function uniqueLyricLinesForTranslation(lines: readonly string[]) {
  return [...new Set(lines
    .map((line) => normalizeLyricLineForTranslation(line))
    .filter((line) => line.length > 0 && JAPANESE_TEXT_RE.test(line)))];
}

export function selectLyricLinesForTranslation(lines: readonly string[]) {
  const uniqueLines = uniqueLyricLinesForTranslation(lines);
  const selectedLines: string[] = [];
  let totalCharacters = 0;

  for (const line of uniqueLines) {
    if (line.length > LYRIC_TRANSLATION_LINE_MAX_CHARACTERS) continue;
    if (selectedLines.length >= LYRIC_TRANSLATION_LINE_LIMIT) continue;
    if (totalCharacters + line.length > LYRIC_TRANSLATION_SOURCE_MAX_CHARACTERS) continue;
    selectedLines.push(line);
    totalCharacters += line.length;
  }

  return { lines: selectedLines, skippedCount: uniqueLines.length - selectedLines.length };
}

export function sanitizeLyricLineTranslations(value: unknown, allowedLines?: ReadonlySet<string>): LyricLineTranslations {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, unknown>).reduce<LyricLineTranslations>((translations, [source, translation]) => {
    const normalizedSource = normalizeLyricLineForTranslation(source);
    if (!normalizedSource || !JAPANESE_TEXT_RE.test(normalizedSource) || (allowedLines && !allowedLines.has(normalizedSource))) return translations;
    if (typeof translation !== "string") return translations;
    const normalizedTranslation = translation.trim();
    if (!normalizedTranslation || normalizedTranslation.length > LYRIC_TRANSLATION_MAX_CHARACTERS) return translations;
    translations[normalizedSource] = normalizedTranslation;
    return translations;
  }, {});
}

export function buildDisplayTranslationsForLines(lines: readonly string[], translations: LyricLineTranslations) {
  const resolved = lines.map((line) => {
    const normalizedLine = normalizeLyricLineForTranslation(line);
    if (!normalizedLine || !JAPANESE_TEXT_RE.test(normalizedLine)) return null;
    return translations[normalizedLine]?.trim() || null;
  });

  for (let index = 1; index < resolved.length; index += 1) {
    const current = resolved[index];
    const comma = current?.match(LEADING_COMMA_RE);
    if (!current || !comma) continue;
    let previousIndex = index - 1;
    while (previousIndex >= 0 && !resolved[previousIndex]) previousIndex -= 1;
    if (previousIndex < 0) continue;
    const previous = resolved[previousIndex]!.replace(/\s+$/, "");
    resolved[previousIndex] = previous.endsWith(",") ? previous : `${previous},`;
    resolved[index] = current.slice(comma[0].length).trimStart() || null;
  }

  return resolved;
}

function deterministicOrder(values: string[], seed: string) {
  return [...values].sort((left, right) => stableHash(`${seed}:${left}`) - stableHash(`${seed}:${right}`) || left.localeCompare(right, "ja"));
}

export function buildLyricsQuiz(lines: TimedLyricLine[]): LyricsQuestion[] {
  const termPool = [...new Set(lines.flatMap((line) => collectJapaneseTerms(line.text)).filter((term) => [...term].length <= 12))];
  if (termPool.length < 4) return [];
  const questions: LyricsQuestion[] = [];
  lines.forEach((line, lineIndex) => {
    if (lineIndex % 2 !== 0) return;
    const candidates = collectJapaneseTerms(line.text).filter((term) => termPool.includes(term));
    if (!candidates.length) return;
    const answer = candidates[stableHash(`${lineIndex}:${line.text}`) % candidates.length];
    const start = line.text.indexOf(answer);
    if (start < 0) return;
    const distractors = deterministicOrder(termPool.filter((term) => term !== answer), `${lineIndex}:${answer}`).slice(0, 3);
    if (distractors.length < 3) return;
    questions.push({ id: `question-${lineIndex}-${start}`, lineIndex, before: line.text.slice(0, start), answer, after: line.text.slice(start + answer.length), options: deterministicOrder([answer, ...distractors], line.text) });
  });
  return questions;
}

export function parseYouTubeId(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") return /^[\w-]{11}$/.test(url.pathname.slice(1)) ? url.pathname.slice(1) : null;
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) {
      const id = url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/") ? url.pathname.split("/")[2] : url.searchParams.get("v");
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }
  } catch { return null; }
  return null;
}
