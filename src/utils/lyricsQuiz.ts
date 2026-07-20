import type { TimedLyricsLine } from "../services/lyricsService";
import {
  getHighlightSegments,
  type VocabularyMatch,
} from "./textHighlighting";

const JAPANESE_OPTION_PATTERN =
  /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\u3005\u3006\u303b\uff66-\uff9f]/;
const MAX_OPTION_LENGTH = 12;
const MIN_QUESTION_LINE_DURATION_MS = 1200;
const FALLBACK_LAST_LINE_DURATION_MS = 4000;

export interface LyricsQuizQuestion {
  lineIndex: number;
  lineText: string;
  beforeBlank: string;
  answer: string;
  afterBlank: string;
  blankStart: number;
  answerItem: VocabularyMatch;
  options: string[];
  pauseTimeMs: number;
  lineEndTimeMs: number;
}

interface LineCandidate {
  text: string;
  start: number;
  match: VocabularyMatch;
}

function stableHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function isUsableOption(value: string): boolean {
  const trimmedValue = value.trim();
  return (
    trimmedValue === value &&
    value.length > 0 &&
    value.length <= MAX_OPTION_LENGTH &&
    JAPANESE_OPTION_PATTERN.test(value)
  );
}

function getLineCandidates(
  lineText: string,
  vocabularyMatches: VocabularyMatch[],
): LineCandidate[] {
  const segments = getHighlightSegments(lineText, vocabularyMatches);
  const candidates: LineCandidate[] = [];
  const seenRanges = new Set<string>();
  let cursor = 0;

  for (const segment of segments) {
    const start = cursor;
    cursor += segment.text.length;

    if (!segment.match || !isUsableOption(segment.text)) {
      continue;
    }

    const rangeKey = `${start}:${cursor}`;
    if (seenRanges.has(rangeKey)) {
      continue;
    }

    seenRanges.add(rangeKey);
    candidates.push({
      text: segment.text,
      start,
      match: segment.match as VocabularyMatch,
    });
  }

  return candidates;
}

function orderDeterministically(values: string[], seed: string): string[] {
  return [...values].sort((left, right) => {
    const leftHash = stableHash(`${seed}|${left}`);
    const rightHash = stableHash(`${seed}|${right}`);
    if (leftHash !== rightHash) {
      return leftHash - rightHash;
    }
    return left.localeCompare(right, "ja");
  });
}

function buildQuestionsFromMatches(
  timedLyrics: TimedLyricsLine[],
  targetMatches: VocabularyMatch[],
  optionMatches: VocabularyMatch[],
): LyricsQuizQuestion[] {
  if (
    timedLyrics.length === 0 ||
    targetMatches.length === 0 ||
    optionMatches.length === 0
  ) {
    return [];
  }

  const candidatesByLine = timedLyrics.map((line) =>
    getLineCandidates(line.words ?? "", targetMatches),
  );
  const preferredOptionPool = Array.from(
    new Set(
      candidatesByLine.flatMap((candidates) =>
        candidates.map(({ text }) => text),
      ),
    ),
  );
  const optionPool = Array.from(
    new Set(
      timedLyrics.flatMap((line) =>
        getLineCandidates(line.words ?? "", optionMatches).map(
          ({ text }) => text,
        ),
      ),
    ),
  );

  if (optionPool.length < 4) {
    return [];
  }

  const questions: LyricsQuizQuestion[] = [];
  let eligibleLineOrdinal = 0;

  timedLyrics.forEach((line, lineIndex) => {
    const candidates = candidatesByLine[lineIndex];
    if (candidates.length === 0) {
      return;
    }

    const nextLine = timedLyrics[lineIndex + 1];
    const lineEndTimeMs = nextLine?.startTimeMs ??
      line.startTimeMs + FALLBACK_LAST_LINE_DURATION_MS;
    const lineDurationMs = lineEndTimeMs - line.startTimeMs;
    if (lineDurationMs < MIN_QUESTION_LINE_DURATION_MS) {
      return;
    }

    const shouldCreateQuestion = eligibleLineOrdinal % 2 === 0;
    eligibleLineOrdinal += 1;
    if (!shouldCreateQuestion) {
      return;
    }

    const targetIndex =
      stableHash(`${lineIndex}|${line.startTimeMs}|${line.words}`) %
      candidates.length;
    const target = candidates[targetIndex];
    const preferredDistractors = orderDeterministically(
      preferredOptionPool.filter((option) => option !== target.text),
      `${lineIndex}|${target.text}|preferred-distractors`,
    );
    const preferredDistractorSet = new Set(preferredDistractors);
    const fallbackDistractors = orderDeterministically(
      optionPool.filter(
        (option) =>
          option !== target.text && !preferredDistractorSet.has(option),
      ),
      `${lineIndex}|${target.text}|fallback-distractors`,
    );
    const distractors = [
      ...preferredDistractors,
      ...fallbackDistractors,
    ].slice(0, 3);

    if (distractors.length < 3) {
      return;
    }

    const options = orderDeterministically(
      [target.text, ...distractors],
      `${lineIndex}|${line.words}|options`,
    );
    const answerMidpoint = target.start + target.text.length / 2;
    const estimatedWordFraction =
      line.words.length > 0 ? answerMidpoint / line.words.length : 0.5;
    const pauseFraction = Math.min(0.78, Math.max(0.28, estimatedWordFraction));
    const pauseTimeMs = Math.min(
      lineEndTimeMs - 250,
      line.startTimeMs + Math.max(250, lineDurationMs * pauseFraction),
    );

    questions.push({
      lineIndex,
      lineText: line.words,
      beforeBlank: line.words.slice(0, target.start),
      answer: target.text,
      afterBlank: line.words.slice(target.start + target.text.length),
      blankStart: target.start,
      answerItem: target.match,
      options,
      pauseTimeMs,
      lineEndTimeMs,
    });
  });

  return questions;
}

function isKnownWaniKaniItem(
  match: VocabularyMatch,
  userLevel: number,
): boolean {
  return (
    userLevel > 0 &&
    match.isWaniKaniSubject !== false &&
    match.level > 0 &&
    match.level <= userLevel
  );
}

/**
 * Builds a stable quiz for a set of synchronized lyric lines. Questions are
 * intentionally placed on alternating eligible lines so the song still has
 * room to breathe between prompts. WaniKani items at or below the user's
 * current level are used as blanks whenever the song can build a valid quiz
 * from them; the full vocabulary set remains available for distractors and as
 * a fallback for songs without usable known items.
 */
export function buildLyricsQuizQuestions(
  timedLyrics: TimedLyricsLine[],
  vocabularyMatches: VocabularyMatch[],
  userLevel = 0,
): LyricsQuizQuestion[] {
  const knownWaniKaniMatches = vocabularyMatches.filter((match) =>
    isKnownWaniKaniItem(match, userLevel),
  );

  if (knownWaniKaniMatches.length > 0) {
    const personalizedQuestions = buildQuestionsFromMatches(
      timedLyrics,
      knownWaniKaniMatches,
      vocabularyMatches,
    );
    if (personalizedQuestions.length > 0) {
      return personalizedQuestions;
    }
  }

  return buildQuestionsFromMatches(
    timedLyrics,
    vocabularyMatches,
    vocabularyMatches,
  );
}

export function getLyricsQuizSessionKey(
  songTitle: string,
  artist: string,
  timedLyrics: TimedLyricsLine[],
): string {
  const lyricsSignature = timedLyrics
    .map((line) => `${line.startTimeMs}:${line.words}`)
    .join("|");
  return `${songTitle}|${artist}|${stableHash(lyricsSignature)}`;
}
