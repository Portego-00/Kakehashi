import type { Assignment, Subject } from "@/types/wanikani";
import type { JpdbTokenAnnotation } from "./jpdb";

export interface TextSegment {
  id: string;
  text: string;
  start: number;
  end: number;
  japanese: boolean;
  wordLike: boolean;
}

export interface ReaderAnnotation {
  id: string;
  start: number;
  end: number;
  text: string;
  spelling: string;
  reading: string;
  meaning: string;
  meanings: string[];
  alternativeSpellings: string[];
  partsOfSpeech: string[];
  tokenType: JpdbTokenAnnotation["tokenType"];
  subject: Subject | null;
  known: boolean | null;
  srsStage: number | null;
  source: "jpdb" | "wanikani";
}

export type ReaderPiece =
  | { id: string; kind: "text"; text: string }
  | { id: string; kind: "annotation"; annotation: ReaderAnnotation };

const JAPANESE_CHARACTER = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\u3005\u3006\u303bｦ-ﾟ]/;

export function containsJapanese(value: string) {
  return JAPANESE_CHARACTER.test(value);
}

export function segmentJapaneseText(value: string): TextSegment[] {
  if (!value) return [];
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("ja", { granularity: "word" });
    return [...segmenter.segment(value)].map((segment, index) => ({
      id: `${segment.index}-${index}`,
      text: segment.segment,
      start: segment.index,
      end: segment.index + segment.segment.length,
      japanese: containsJapanese(segment.segment),
      wordLike: Boolean(segment.isWordLike),
    }));
  }
  const values = value.split(/([\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\u3005\u3006\u303bｦ-ﾟ]+)/).filter(Boolean);
  let cursor = 0;
  return values.map((text, index) => {
    const start = cursor;
    cursor += text.length;
    return { id: `${index}`, text, start, end: cursor, japanese: containsJapanese(text), wordLike: containsJapanese(text) };
  });
}

export function normalizeLookupTerm(value: string) {
  return value.normalize("NFKC").replace(/[\s。、！？「」『』（）［］【】…・]+/g, "").trim();
}

export function collectJapaneseTerms(value: string) {
  return [...new Set(segmentJapaneseText(value).filter((segment) => segment.japanese && segment.wordLike).map((segment) => normalizeLookupTerm(segment.text)).filter(Boolean))];
}

export function extractKanji(value: string) {
  return [...new Set(value.match(/[\u4e00-\u9faf]/gu) ?? [])];
}

export function passedKanjiCharacters(subjects: Subject[], assignments: Assignment[]) {
  const charactersById = new Map(subjects.filter((subject) => subject.object === "kanji" && subject.data.characters).map((subject) => [subject.id, subject.data.characters as string]));
  return new Set(assignments.flatMap((assignment) => {
    if (assignment.data.subject_type !== "kanji" || (assignment.data.srs_stage < 5 && !assignment.data.passed_at)) return [];
    const characters = charactersById.get(assignment.data.subject_id);
    return characters ? [characters] : [];
  }));
}

export function calculateKnownKanjiPercentage(value: string, passedKanji: Set<string>) {
  if (!value) return 0;
  const kanji = extractKanji(value);
  if (!kanji.length) return 100;
  return Math.round((kanji.filter((character) => passedKanji.has(character)).length / kanji.length) * 100);
}

function normalizeJapanese(value: string) {
  return value.normalize("NFKC").replace(/[\s~～]+/gu, "").trim();
}

function normalizeMeaning(value: string) {
  return value.toLocaleLowerCase().replace(/^to\s+/u, "").replace(/[^\p{L}\p{N}\s]+/gu, " ").replace(/\s+/gu, " ").trim();
}

function meaningMatches(tokenMeaning: string, subject: Subject) {
  const token = normalizeMeaning(tokenMeaning);
  if (!token || [...token].length < 2) return false;
  return subject.data.meanings.some(({ meaning }) => {
    const candidate = normalizeMeaning(meaning);
    if (!candidate) return false;
    if (candidate === token || candidate.includes(token) || token.includes(candidate)) return true;
    const parts = new Set(candidate.split(" "));
    return token.split(" ").some((part) => parts.has(part));
  });
}

function subjectParts(subject: Subject) {
  return (subject.data.parts_of_speech ?? []).map((part) => part.toLocaleLowerCase());
}

function subjectScore(subject: Subject, token: JpdbTokenAnnotation) {
  const characters = normalizeJapanese(subject.data.characters ?? "");
  const slug = normalizeJapanese(subject.data.slug);
  const surface = normalizeJapanese(token.surface);
  const spelling = normalizeJapanese(token.spelling);
  const reading = normalizeJapanese(token.reading);
  const readings = new Set((subject.data.readings ?? []).map((item) => normalizeJapanese(item.reading)));
  const exactSpelling = Boolean(spelling && (characters === spelling || slug === spelling));
  const exactSurface = Boolean(surface && (characters === surface || slug === surface));
  const readingMatch = Boolean(reading && readings.has(reading));
  const surfaceReadingMatch = Boolean(surface && readings.has(surface));

  // WaniKani does not teach grammar, and a kana surface must never become a
  // kanji subject merely because its pronunciation happens to match.
  if (token.tokenType === "grammar") return Number.NEGATIVE_INFINITY;
  if (subject.object === "kanji" && characters !== surface) return Number.NEGATIVE_INFINITY;
  if (/^[\u3040-\u30ffー]$/u.test(surface) && /[\u3400-\u9fff]/u.test(characters)) return Number.NEGATIVE_INFINITY;

  let score = exactSpelling ? 700 : 0;
  if (exactSurface) score += 600;
  if (readingMatch) score += 180;
  if (surfaceReadingMatch) score += 100;
  if (meaningMatches(token.meaning, subject)) score += 180;
  if (subject.object === "vocabulary" || subject.object === "kana_vocabulary") score += 50;
  const parts = subjectParts(subject);
  if (token.tokenType === "verb" && parts.some((part) => part.includes("verb"))) score += 50;
  if (token.partsOfSpeech.some((part) => part.startsWith("adj")) && parts.some((part) => part.includes("adjective"))) score += 35;
  if (/^[\u3040-\u30ffー]{1,2}$/u.test(surface) && !exactSurface && !exactSpelling && !meaningMatches(token.meaning, subject)) score -= 500;
  return score;
}

function subjectLookup(subjects: Subject[]) {
  const lookup = new Map<string, Subject[]>();
  for (const subject of subjects) {
    if (subject.object !== "vocabulary" && subject.object !== "kana_vocabulary" && subject.object !== "kanji") continue;
    const values = [subject.data.characters, subject.data.slug, ...(subject.data.readings ?? []).map((item) => item.reading)];
    for (const value of values) {
      const normalized = normalizeJapanese(value ?? "");
      if (!normalized) continue;
      const candidates = lookup.get(normalized) ?? [];
      if (!candidates.some((candidate) => candidate.id === subject.id)) candidates.push(subject);
      lookup.set(normalized, candidates);
    }
  }
  return lookup;
}

function matchWaniKaniSubject(token: JpdbTokenAnnotation, lookup: Map<string, Subject[]>) {
  const candidates = new Map<number, Subject>();
  [token.surface, token.spelling, token.reading].forEach((value) => lookup.get(normalizeJapanese(value))?.forEach((subject) => candidates.set(subject.id, subject)));
  const surface = normalizeJapanese(token.surface);
  if (surface.length === 1 && /[\u3400-\u9fff]/u.test(surface)) lookup.get(surface)?.filter((subject) => subject.object === "kanji").forEach((subject) => candidates.set(subject.id, subject));
  return [...candidates.values()].map((subject) => ({ subject, score: subjectScore(subject, token) })).filter(({ score }) => score >= 300).sort((left, right) => right.score - left.score || left.subject.data.level - right.subject.data.level)[0]?.subject ?? null;
}

function assignmentsBySubject(assignments: Assignment[]) {
  return new Map(assignments.map((assignment) => [assignment.data.subject_id, assignment]));
}

export function srsStageLabel(stage: number | null) {
  if (stage === null) return "Locked";
  return ["Lesson", "Apprentice I", "Apprentice II", "Apprentice III", "Apprentice IV", "Guru I", "Guru II", "Master", "Enlightened", "Burned"][stage] ?? `Stage ${stage}`;
}

export function annotateJpdbTokens(tokens: JpdbTokenAnnotation[], subjects: Subject[], assignments: Assignment[]): ReaderAnnotation[] {
  const lookup = subjectLookup(subjects);
  const assignmentBySubject = assignmentsBySubject(assignments);
  let previousEnd = -1;
  return tokens.flatMap((token, index) => {
    if (token.start < previousEnd || token.end <= token.start) return [];
    previousEnd = token.end;
    const subject = matchWaniKaniSubject(token, lookup);
    const assignment = subject ? assignmentBySubject.get(subject.id) : undefined;
    return [{
      id: `jpdb-${token.start}-${token.end}-${index}`,
      start: token.start,
      end: token.end,
      text: token.surface,
      spelling: token.spelling,
      reading: token.reading,
      meaning: token.meaning,
      meanings: token.meanings,
      alternativeSpellings: token.alternativeSpellings,
      partsOfSpeech: token.partsOfSpeech,
      tokenType: token.tokenType,
      subject,
      known: subject ? Boolean(assignment && (assignment.data.srs_stage >= 5 || assignment.data.passed_at)) : null,
      srsStage: assignment?.data.srs_stage ?? null,
      source: "jpdb" as const,
    }];
  });
}

export function annotateWithWaniKaniFallback(value: string, subjects: Subject[], assignments: Assignment[]): ReaderAnnotation[] {
  const lookup = subjectLookup(subjects);
  const assignmentBySubject = assignmentsBySubject(assignments);
  return segmentJapaneseText(value).flatMap((segment, index) => {
    if (!segment.japanese || !segment.wordLike) return [];
    const token: JpdbTokenAnnotation = { start: segment.start, end: segment.end, surface: segment.text, spelling: segment.text, reading: "", meaning: "", meanings: [], alternativeSpellings: [], partsOfSpeech: [], tokenType: "vocabulary" };
    const subject = matchWaniKaniSubject(token, lookup);
    const assignment = subject ? assignmentBySubject.get(subject.id) : undefined;
    return [{ id: `wk-${segment.start}-${index}`, start: segment.start, end: segment.end, text: segment.text, spelling: segment.text, reading: "", meaning: "", meanings: [], alternativeSpellings: [], partsOfSpeech: [], tokenType: "vocabulary" as const, subject, known: subject ? Boolean(assignment && (assignment.data.srs_stage >= 5 || assignment.data.passed_at)) : null, srsStage: assignment?.data.srs_stage ?? null, source: "wanikani" as const }];
  });
}

export function readerPieces(value: string, annotations: ReaderAnnotation[]): ReaderPiece[] {
  const pieces: ReaderPiece[] = [];
  let cursor = 0;
  for (const annotation of [...annotations].sort((left, right) => left.start - right.start || right.end - left.end)) {
    if (annotation.start < cursor || annotation.end > value.length) continue;
    if (annotation.start > cursor) pieces.push({ id: `text-${cursor}`, kind: "text", text: value.slice(cursor, annotation.start) });
    pieces.push({ id: annotation.id, kind: "annotation", annotation });
    cursor = annotation.end;
  }
  if (cursor < value.length) pieces.push({ id: `text-${cursor}`, kind: "text", text: value.slice(cursor) });
  return pieces;
}
