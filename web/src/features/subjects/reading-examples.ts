import { toHiragana } from "wanakana";
import type { Subject, SubjectReading } from "@/types/wanikani";

export type KanjiReadingKind = "onyomi" | "kunyomi" | "nanori";
export type KanjiReadingCandidate = { reading: string; normalizedReading: string; type: KanjiReadingKind; primary: boolean };
export type KanjiReadingGroup = KanjiReadingCandidate & { subjects: Subject[] };

const KINDS = new Set<KanjiReadingKind>(["onyomi", "kunyomi", "nanori"]);
const ORDER: Record<KanjiReadingKind, number> = { onyomi: 0, kunyomi: 1, nanori: 2 };
const RENDAKU: Record<string, string[]> = { か: ["が"], き: ["ぎ"], く: ["ぐ"], け: ["げ"], こ: ["ご"], さ: ["ざ"], し: ["じ"], す: ["ず"], せ: ["ぜ"], そ: ["ぞ"], た: ["だ"], ち: ["ぢ"], つ: ["づ"], て: ["で"], と: ["ど"], は: ["ば", "ぱ"], ひ: ["び", "ぴ"], ふ: ["ぶ", "ぷ"], へ: ["べ", "ぺ"], ほ: ["ぼ", "ぽ"] };

export function normalizeKanjiReading(reading: string) {
  return toHiragana(reading.replace(/[-.\u30fb\u3002〜～\s]/g, "")).trim();
}

export function uniqueKanjiReadings(readings: SubjectReading[]): KanjiReadingCandidate[] {
  const candidates = new Map<string, KanjiReadingCandidate>();
  for (const reading of readings) {
    if (!reading.type || !KINDS.has(reading.type as KanjiReadingKind)) continue;
    const normalizedReading = normalizeKanjiReading(reading.reading);
    if (!normalizedReading) continue;
    const candidate = { reading: reading.reading.trim(), normalizedReading, type: reading.type as KanjiReadingKind, primary: reading.primary };
    const current = candidates.get(normalizedReading);
    if (!current || (current.type === "nanori" && candidate.type !== "nanori") || (!current.primary && candidate.primary)) candidates.set(normalizedReading, candidate);
  }
  return [...candidates.values()];
}

function variants(reading: string) {
  const bases = new Set([reading]);
  if (["き", "く", "ち", "つ"].includes(reading.at(-1) ?? "")) bases.add(`${reading.slice(0, -1)}っ`);
  const values = new Set(bases);
  for (const base of bases) for (const initial of RENDAKU[base[0]] ?? []) values.add(`${initial}${base.slice(1)}`);
  return [...values];
}

function surfaceScore(vocabularyReading: string, surface: string, kanji: string, vocabulary: string) {
  if (vocabulary === kanji) return vocabularyReading === surface ? 1_000 + surface.length : -Infinity;
  if (vocabulary.startsWith(kanji) && vocabularyReading.startsWith(surface)) return 700 + surface.length * 10;
  if (vocabulary.endsWith(kanji) && vocabularyReading.endsWith(surface)) return 700 + surface.length * 10;
  if (vocabulary.includes(kanji) && vocabularyReading.includes(surface)) return 600 + surface.length * 10;
  return -Infinity;
}

export function matchVocabularyToKanjiReading(kanji: Subject, vocabulary: Subject) {
  const candidates = uniqueKanjiReadings(kanji.data.readings ?? []);
  let best: KanjiReadingCandidate | null = null;
  let bestScore = -Infinity;
  for (const candidate of candidates) for (const surface of variants(candidate.normalizedReading)) for (const vocabularyReading of vocabulary.data.readings ?? []) {
    let score = surfaceScore(normalizeKanjiReading(vocabularyReading.reading), surface, kanji.data.characters ?? "", vocabulary.data.characters ?? "");
    if (!Number.isFinite(score)) continue;
    if (surface === candidate.normalizedReading) score += 20;
    if (candidate.primary) score += 5;
    if (vocabularyReading.primary) score += 2;
    if (candidate.type === "nanori") score -= 5;
    if (score > bestScore) { bestScore = score; best = candidate; }
  }
  return best;
}

export function groupVocabularyByKanjiReading(kanji: Subject, vocabulary: Subject[]): KanjiReadingGroup[] {
  const groups = new Map(uniqueKanjiReadings(kanji.data.readings ?? []).map((reading) => [reading.normalizedReading, { ...reading, subjects: [] as Subject[] }]));
  for (const subject of vocabulary) {
    const match = matchVocabularyToKanjiReading(kanji, subject);
    if (match) groups.get(match.normalizedReading)?.subjects.push(subject);
  }
  return [...groups.values()].filter((group) => group.subjects.length).map((group) => ({ ...group, subjects: group.subjects.sort((left, right) => left.data.level - right.data.level || left.id - right.id) })).sort((left, right) => ORDER[left.type] - ORDER[right.type] || Number(right.primary) - Number(left.primary));
}
