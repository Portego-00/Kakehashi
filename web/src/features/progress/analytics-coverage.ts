import type { Assignment, Subject } from "@/types/wanikani";
import { FREQUENCY_KANJI_LISTS } from "./catalogs/frequencyKanji";
import { JLPT_KANJI_LISTS } from "./catalogs/jlptKanji";
import { JOYO_KANJI_LISTS } from "./catalogs/joyoKanji";

export type CoverageCatalog = "jlpt" | "joyo" | "frequency" | "vocabulary";
export interface CoverageEntry { character: string; subject?: Subject; stage: number }
export interface CoverageGroup { key: string; label: string; entries: CoverageEntry[]; known: number; total: number }

export function coverageIndex(assignments: Assignment[], subjects: Subject[]) {
  const stages = new Map(assignments.filter((item) => !item.data.hidden).map((item) => [item.data.subject_id, item.data.srs_stage]));
  const kanji = new Map<string, Subject>();
  for (const subject of subjects) {
    if (subject.object === "kanji" && subject.data.characters && !subject.data.hidden_at) kanji.set(subject.data.characters, subject);
  }
  return { stages, kanji };
}

export function buildCoverageGroups(catalog: CoverageCatalog, assignments: Assignment[], subjects: Subject[], threshold = 5, previewLevel: number | null = null): CoverageGroup[] {
  const { stages, kanji } = coverageIndex(assignments, subjects);
  const passed = (entry: CoverageEntry) => previewLevel === null ? entry.stage >= threshold : Boolean(entry.subject && entry.subject.data.level <= previewLevel);
  if (catalog === "vocabulary") {
    const levels = new Map<number, CoverageEntry[]>();
    for (const subject of subjects) {
      if (!subject.data.hidden_at && (subject.object === "vocabulary" || subject.object === "kana_vocabulary")) {
        const entries = levels.get(subject.data.level) ?? [];
        entries.push({ character: subject.data.characters ?? subject.data.slug, subject, stage: stages.get(subject.id) ?? 0 });
        levels.set(subject.data.level, entries);
      }
    }
    return [...levels].sort(([a], [b]) => a - b).map(([level, entries]) => ({ key: String(level), label: `Level ${level}`, entries, known: entries.filter(passed).length, total: entries.length }));
  }
  const source = catalog === "jlpt" ? JLPT_KANJI_LISTS : catalog === "joyo" ? JOYO_KANJI_LISTS : FREQUENCY_KANJI_LISTS;
  return Object.entries(source).map(([key, characters]) => {
    const entries = [...new Set<string>(characters)].map((character): CoverageEntry => {
      const subject = kanji.get(character);
      return { character, subject, stage: subject ? stages.get(subject.id) ?? 0 : 0 };
    });
    const label = catalog === "jlpt" ? key : catalog === "joyo" ? key === "9" ? "Secondary" : `Grade ${key}` : `${Number(key) - 499}-${key}`;
    return { key, label, entries, known: entries.filter(passed).length, total: entries.length };
  });
}

const kanjiPattern = /\p{Script=Han}/u;
const japanesePattern = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

export function analyzeReading(text: string, assignments: Assignment[], subjects: Subject[], threshold = 5, previewLevel: number | null = null, extraKnown = "") {
  const { stages, kanji } = coverageIndex(assignments, subjects);
  const external = new Set([...extraKnown].filter((character) => kanjiPattern.test(character)));
  const occurrences = new Map<string, number>();
  for (const character of text) if (kanjiPattern.test(character)) occurrences.set(character, (occurrences.get(character) ?? 0) + 1);
  const entries = [...occurrences].map(([character, count]) => {
    const subject = kanji.get(character);
    const stage = subject ? stages.get(subject.id) ?? 0 : 0;
    const known = external.has(character) || (previewLevel === null ? stage >= threshold : Boolean(subject && subject.data.level <= previewLevel));
    return { character, count, subject, stage, known, external: external.has(character) };
  });
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  const known = entries.reduce((sum, entry) => sum + (entry.known ? entry.count : 0), 0);
  const uniqueKnown = entries.filter((entry) => entry.known).length;
  const vocabulary = new Map(subjects.filter((subject) => !subject.data.hidden_at && (subject.object === "vocabulary" || subject.object === "kana_vocabulary") && subject.data.characters).map((subject) => [subject.data.characters!.normalize("NFKC"), subject]));
  const words = new Map<string, { word: string; count: number; subject: Subject; known: boolean }>();
  // The platform segmenter handles Japanese word boundaries; only exact catalog matches count.
  if (typeof Intl.Segmenter !== "undefined") {
    for (const part of new Intl.Segmenter("ja", { granularity: "word" }).segment(text)) {
      if (!part.isWordLike || !japanesePattern.test(part.segment)) continue;
      const word = part.segment.normalize("NFKC");
      const subject = vocabulary.get(word);
      if (!subject) continue;
      const existing = words.get(word);
      if (existing) existing.count += 1;
      else words.set(word, { word, count: 1, subject, known: previewLevel === null ? (stages.get(subject.id) ?? 0) >= threshold : subject.data.level <= previewLevel });
    }
  }
  return {
    entries, total, known, uniqueTotal: entries.length, uniqueKnown,
    occurrencePercent: total ? known / total * 100 : null,
    uniquePercent: entries.length ? uniqueKnown / entries.length * 100 : null,
    unknown: entries.filter((entry) => !entry.known).sort((a, b) => b.count - a.count || (a.subject?.data.level ?? 100) - (b.subject?.data.level ?? 100)),
    words: [...words.values()].sort((a, b) => b.count - a.count),
  };
}
