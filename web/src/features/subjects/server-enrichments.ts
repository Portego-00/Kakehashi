import pitchDataset from "../../../../assets/pitch/wanikani_pitch_accents.json";
import patternDataset from "../../../../assets/patterns/wanikani_vocabulary_patterns.json";
import type { PitchAccentEntry, SubjectEnrichments, UsagePattern } from "./enrichments";

type RawPitchEntry = { r?: unknown; p?: unknown; rs?: unknown };
type PatternEntry = { level: number; characters: string; patterns: UsagePattern[] };

const pitchById = pitchDataset as Record<string, RawPitchEntry>;
const patternEntries = ((patternDataset as { entries?: Record<string, PatternEntry> }).entries ?? {});
const patternsByCharacters = new Map<string, UsagePattern[]>();

for (const entry of Object.values(patternEntries)) {
  if (entry?.characters && !patternsByCharacters.has(normalizeCharacters(entry.characters))) {
    patternsByCharacters.set(normalizeCharacters(entry.characters), entry.patterns ?? []);
  }
}

function normalizeCharacters(value: string) {
  return value.trim().normalize("NFKC");
}

function normalizeReading(value: string) {
  return value.trim().replace(/[〜～]/g, "").replace(/[\u30A1-\u30F6]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0x60));
}

function normalizePitchEntry(value: unknown): PitchAccentEntry | null {
  if (!value || typeof value !== "object") return null;
  const item = value as { r?: unknown; p?: unknown };
  if (typeof item.r !== "string" || !Array.isArray(item.p)) return null;
  const accents = [...new Set(item.p.map(Number).filter((accent) => Number.isInteger(accent) && accent >= 0))].sort((left, right) => left - right);
  return accents.length ? { r: item.r, p: accents } : null;
}

function pitchAccents(id: number, readings: string[]) {
  const raw = pitchById[String(id)];
  if (!raw) return [];
  const candidates = new Set(readings.map(normalizeReading));
  const seen = new Set<string>();
  return [...(Array.isArray(raw.rs) ? raw.rs : []), raw].flatMap((item) => {
    const entry = normalizePitchEntry(item);
    if (!entry || (candidates.size && !candidates.has(normalizeReading(entry.r)))) return [];
    const key = `${normalizeReading(entry.r)}|${entry.p.join(",")}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [entry];
  });
}

function patterns(level: number, characters: string) {
  const normalized = normalizeCharacters(characters);
  return patternEntries[`${level}|${normalized}`]?.patterns ?? patternsByCharacters.get(normalized) ?? [];
}

export function getSubjectEnrichments(input: { id: number; level: number; characters: string; readings: string[] }): SubjectEnrichments {
  return {
    pitchAccents: pitchAccents(input.id, input.readings),
    patterns: patterns(input.level, input.characters),
  };
}
