import type { JpdbParsedToken } from "./jpdb";
import type { WaniKaniSubjectResource } from "@kakehashi/core";

export type HighlightMatch = {
  id: number;
  characters: string;
  meaning: string;
  type: "radical" | "kanji" | "vocabulary" | "kana_vocabulary";
  level: number;
  readings?: Array<{ reading: string; primary?: boolean }>;
  source: "wanikani" | "jpdb";
  partsOfSpeech?: string[];
};

export type HighlightSegment = {
  text: string;
  match?: HighlightMatch;
  tokenType?: "grammar" | "verb" | "vocabulary";
};

type HighlightRange = {
  start: number;
  end: number;
  match: HighlightMatch;
  tokenType?: "grammar" | "verb" | "vocabulary";
};

const japaneseBoundary = /[\u3040-\u30ff\u3400-\u9fff々ー]/;

export function buildHighlightSegments(input: {
  text: string;
  subjects: WaniKaniSubjectResource[];
  jpdbTokens?: JpdbParsedToken[];
}): HighlightSegment[] {
  const text = input.text;
  if (!text) return [{ text }];

  const ranges = [
    ...buildJpdbRanges(text, input.jpdbTokens ?? [], input.subjects),
    ...buildWaniKaniRanges(text, input.subjects),
  ].sort((left, right) => {
    if (left.start !== right.start) return left.start - right.start;
    const lengthDelta = right.end - right.start - (left.end - left.start);
    if (lengthDelta !== 0) return lengthDelta;
    return getRangePriority(right) - getRangePriority(left);
  });

  const accepted: HighlightRange[] = [];
  for (const range of ranges) {
    if (accepted.some((existing) => rangesOverlap(existing, range))) continue;
    accepted.push(range);
  }

  accepted.sort((left, right) => left.start - right.start);

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const range of accepted) {
    if (range.start > cursor) {
      segments.push({ text: text.slice(cursor, range.start) });
    }
    segments.push({
      text: text.slice(range.start, range.end),
      match: range.match,
      tokenType: range.tokenType,
    });
    cursor = range.end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor) });
  }

  return segments;
}

function buildWaniKaniRanges(
  text: string,
  subjects: WaniKaniSubjectResource[]
): HighlightRange[] {
  const ranges: HighlightRange[] = [];
  const candidates = subjects
    .map(subjectToMatch)
    .filter((match): match is HighlightMatch => Boolean(match))
    .sort((left, right) => right.characters.length - left.characters.length);

  for (const match of candidates) {
    const surfaces = getMatchSurfaces(match);
    for (const surface of surfaces) {
      if (surface.length < 2 && match.type !== "kanji") continue;
      for (const occurrence of findOccurrences(text, surface)) {
        ranges.push({
          ...occurrence,
          match,
        });
      }
    }
  }

  return ranges;
}

function buildJpdbRanges(
  text: string,
  tokens: JpdbParsedToken[],
  subjects: WaniKaniSubjectResource[]
): HighlightRange[] {
  const ranges: HighlightRange[] = [];
  const wkLookup = buildWaniKaniLookup(subjects);

  for (const token of tokens) {
    if (token.end <= token.start) continue;
    const surface = text.slice(token.start, token.end);
    const mappedSubject =
      wkLookup.get(token.spelling) ||
      wkLookup.get(token.surface) ||
      wkLookup.get(token.reading);
    const mappedMatch = mappedSubject ? subjectToMatch(mappedSubject) : null;
    const match =
      mappedMatch ??
      ({
        id: -8_000_000 - token.start * 1000 - token.end,
        characters: token.spelling || token.surface || token.reading || surface,
        meaning: buildJpdbMeaning(token),
        type: /[\u3400-\u9fff々]/.test(token.spelling || token.surface)
          ? "vocabulary"
          : "kana_vocabulary",
        level: 0,
        readings: token.reading ? [{ reading: token.reading, primary: true }] : undefined,
        source: "jpdb",
        partsOfSpeech: token.partsOfSpeech,
      } satisfies HighlightMatch);

    ranges.push({
      start: token.start,
      end: token.end,
      match,
      tokenType: token.tokenType,
    });
  }

  return ranges;
}

function subjectToMatch(subject: WaniKaniSubjectResource): HighlightMatch | null {
  const characters = subject.data.characters?.trim();
  if (!characters) return null;
  const meaning =
    subject.data.meanings.find((entry) => entry.primary)?.meaning ||
    subject.data.meanings[0]?.meaning ||
    "";
  if (!meaning) return null;

  return {
    id: subject.id,
    characters,
    meaning,
    type: subject.object,
    level: subject.data.level,
    readings: subject.data.readings,
    source: "wanikani",
  };
}

function getMatchSurfaces(match: HighlightMatch): string[] {
  const surfaces = new Set<string>();
  surfaces.add(match.characters);
  for (const reading of match.readings ?? []) {
    if (reading.reading.length > 1) {
      surfaces.add(reading.reading);
    }
  }
  return Array.from(surfaces).sort((left, right) => right.length - left.length);
}

function findOccurrences(text: string, surface: string): Array<{ start: number; end: number }> {
  const occurrences: Array<{ start: number; end: number }> = [];
  let index = text.indexOf(surface);

  while (index !== -1) {
    const end = index + surface.length;
    if (isAcceptableBoundary(text, index, end)) {
      occurrences.push({ start: index, end });
    }
    index = text.indexOf(surface, index + 1);
  }

  return occurrences;
}

function isAcceptableBoundary(text: string, start: number, end: number): boolean {
  const before = start > 0 ? text[start - 1] : "";
  const after = end < text.length ? text[end] : "";
  if (before && /[A-Za-z0-9]/.test(before)) return false;
  if (after && /[A-Za-z0-9]/.test(after)) return false;
  if (before && after && !japaneseBoundary.test(text.slice(start, end))) return false;
  return true;
}

function rangesOverlap(left: HighlightRange, right: HighlightRange): boolean {
  return left.start < right.end && right.start < left.end;
}

function getRangePriority(range: HighlightRange): number {
  if (range.match.source === "wanikani") return 2;
  if (range.tokenType === "vocabulary") return 1;
  return 0;
}

function buildWaniKaniLookup(subjects: WaniKaniSubjectResource[]): Map<string, WaniKaniSubjectResource> {
  const lookup = new Map<string, WaniKaniSubjectResource>();
  for (const subject of subjects) {
    const characters = subject.data.characters?.trim();
    if (characters) lookup.set(characters, subject);
    for (const reading of subject.data.readings ?? []) {
      if (reading.reading.trim()) lookup.set(reading.reading.trim(), subject);
    }
  }
  return lookup;
}

function buildJpdbMeaning(token: JpdbParsedToken): string {
  const parts = token.partsOfSpeech.length > 0 ? `\nPart of speech: ${token.partsOfSpeech.join(", ")}` : "";
  return `${token.meaning || "Detected by JPDB parser."}${parts}`;
}
