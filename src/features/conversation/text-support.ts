/** Text is never normalized here: caption segments must reconstruct the exact transcript. */
export interface WordSegment {
  text: string;
  isWord: boolean;
}

interface NativeWordSegment {
  segment: string;
  isWordLike?: boolean;
}

type SegmenterConstructor = new (
  locale: string,
  options: { granularity: 'word' },
) => { segment(text: string): Iterable<NativeWordSegment> };

const HAN = /\p{Script=Han}/u;
const WORD = /[\p{L}\p{N}]/u;
const HAN_RUN = /^\p{Script=Han}+$/u;
// Keep accents, apostrophes and internal hyphens with words; preserve everything else verbatim.
const FALLBACK_PARTS = /[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['’\-][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*|[^\p{L}\p{N}]+/gu;

let mandarinEngine: typeof import('pinyin-pro') | undefined;
let japaneseEngine: { segment(text: string): string[] } | undefined;

function mandarin() {
  if (!mandarinEngine) {
    // Metro includes these assets, but dictionary initialization waits until Chinese is used.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Load the offline phonetics engine only for Chinese text.
    const engine: typeof import('pinyin-pro') = require('pinyin-pro');
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Keep the large phrase dictionary out of startup evaluation.
    const dictionary: typeof import('@pinyin-pro/data/modern') = require('@pinyin-pro/data/modern');
    engine.addDict(dictionary.default ?? dictionary, 'kakehashi-modern-chinese');
    mandarinEngine = engine;
  }
  return mandarinEngine;
}

function fallbackSegments(text: string, chinese: boolean): WordSegment[] {
  const result: WordSegment[] = [];
  for (const part of text.match(/\p{Script=Han}+|[^\p{Script=Han}]+/gu) ?? []) {
    if (chinese && HAN_RUN.test(part)) {
      const pieces = mandarin().segment(part);
      if (pieces.map((piece) => piece.origin).join('') === part) {
        result.push(...pieces.map((piece) => ({ text: piece.origin, isWord: true })));
        continue;
      }
    }
    result.push(...(part.match(FALLBACK_PARTS) ?? []).map((piece) => ({ text: piece, isWord: WORD.test(piece) })));
  }
  return result;
}

function japaneseSegments(text: string): WordSegment[] {
  if (!japaneseEngine) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Load the Japanese fallback only when native Segmenter is unavailable.
    const TinySegmenter: new () => { segment(text: string): string[] } = require('tiny-segmenter');
    japaneseEngine = new TinySegmenter();
  }
  const result: WordSegment[] = [];
  // TinySegmenter uses UTF-16 code units. Restrict it to its supported Japanese
  // character ranges so emoji and supplementary Han characters remain intact.
  const japaneseRun = /^[\u3005\u3006\u303b\u3040-\u30ff\u3400-\u9fff\uff66-\uff9f]+$/u;
  const runs = text.match(/[\u3005\u3006\u303b\u3040-\u30ff\u3400-\u9fff\uff66-\uff9f]+|[^\u3005\u3006\u303b\u3040-\u30ff\u3400-\u9fff\uff66-\uff9f]+/gu) ?? [];
  for (const run of runs) {
    if (japaneseRun.test(run)) {
      const words = japaneseEngine.segment(run);
      if (words.join('') === run) {
        result.push(...words.map((word) => ({ text: word, isWord: WORD.test(word) })));
        continue;
      }
    }
    result.push(...fallbackSegments(run, false));
  }
  return result;
}

/** Native boundaries, with offline Chinese/Japanese tokenizers for Hermes without Segmenter. */
export function segmentWords(text: string, languageID: string): WordSegment[] {
  if (!text) return [];
  const locale = languageID.replace(/_/g, '-');
  const chinese = /^zh(?:-|$)/i.test(locale);
  try {
    const Segmenter = (Intl as typeof Intl & { Segmenter?: SegmenterConstructor }).Segmenter;
    if (Segmenter) {
      const result = Array.from(new Segmenter(locale, { granularity: 'word' }).segment(text), (piece) => ({
        text: piece.segment,
        isWord: piece.isWordLike ?? WORD.test(piece.segment),
      }));
      if (result.map((piece) => piece.text).join('') === text) return result;
    }
  } catch {
    // Older engines can omit Segmenter or reject a locale. The caption remains usable offline.
  }
  return /^ja(?:-|$)/i.test(locale) ? japaneseSegments(text) : fallbackSegments(text, chinese);
}

/** Offline phrase-aware dictionary readings; original punctuation, spacing and mixed scripts remain. */
export function pinyin(text: string): string {
  if (!HAN.test(text)) return '';
  const readings = mandarin().pinyin(text, { type: 'all', toneType: 'symbol', toneSandhi: false, v: false });
  let result = '';
  let previousWasReading = false;
  let annotated = false;
  for (const item of readings) {
    const isReading = item.isZh && !HAN.test(item.pinyin) && item.pinyin !== item.origin;
    if (isReading) {
      // Do not insert spaces into original Latin words, punctuation, emoji or whitespace.
      if (previousWasReading || /[\p{L}\p{N}]$/u.test(result)) result += ' ';
      result += item.pinyin;
      annotated = true;
    } else {
      if (previousWasReading && /^[\p{L}\p{N}]/u.test(item.origin)) result += ' ';
      result += item.origin;
    }
    previousWasReading = isReading;
  }
  return annotated ? result : '';
}
