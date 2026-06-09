import patternDataset from "../../assets/patterns/wanikani_vocabulary_patterns.json";

export type WaniKaniVocabularyPatternExample = {
  ja: string;
  en: string;
};

export type WaniKaniVocabularyPatternGroup = {
  name: string;
  examples: WaniKaniVocabularyPatternExample[];
};

type WaniKaniVocabularyPatternEntry = {
  level: number;
  characters: string;
  patterns: WaniKaniVocabularyPatternGroup[];
};

type WaniKaniVocabularyPatternDataset = {
  entries?: Record<string, WaniKaniVocabularyPatternEntry>;
};

const typedPatternDataset = patternDataset as WaniKaniVocabularyPatternDataset;
const entriesByLevelAndCharacters = typedPatternDataset.entries ?? {};

const entriesByCharacters = new Map<string, WaniKaniVocabularyPatternGroup[]>();

function normalizeCharacters(characters: string): string {
  return characters.trim().normalize("NFKC");
}

function buildEntryKey(level: number, characters: string): string {
  return `${level}|${normalizeCharacters(characters)}`;
}

for (const entry of Object.values(entriesByLevelAndCharacters)) {
  if (!entry || typeof entry.characters !== "string") {
    continue;
  }

  const normalizedCharacters = normalizeCharacters(entry.characters);
  if (!normalizedCharacters || entriesByCharacters.has(normalizedCharacters)) {
    continue;
  }

  entriesByCharacters.set(normalizedCharacters, entry.patterns ?? []);
}

export function getWaniKaniVocabularyPatterns(
  level: number,
  characters: string
): WaniKaniVocabularyPatternGroup[] {
  if (!Number.isFinite(level) || typeof characters !== "string") {
    return [];
  }

  const normalizedCharacters = normalizeCharacters(characters);
  if (!normalizedCharacters) {
    return [];
  }

  const directEntry = entriesByLevelAndCharacters[
    buildEntryKey(level, normalizedCharacters)
  ];

  if (directEntry?.patterns?.length) {
    return directEntry.patterns;
  }

  return entriesByCharacters.get(normalizedCharacters) ?? [];
}
