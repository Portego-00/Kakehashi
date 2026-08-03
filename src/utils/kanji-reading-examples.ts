import { toHiragana } from "wanakana";

export type KanjiReadingType = "onyomi" | "kunyomi" | "nanori";

export interface KanjiReadingCandidate {
  reading: string;
  normalizedReading: string;
  type: KanjiReadingType;
  primary: boolean;
}

export interface KanjiReadingInput {
  reading: string;
  type?: string;
  primary?: boolean;
}

export interface VocabularyReadingInput {
  reading: string;
  primary?: boolean;
}

export interface KanjiReadingExampleVocabulary {
  id: number;
  characters: string;
  meanings: string[];
  readings: VocabularyReadingInput[];
  level?: number;
}

export interface KanjiReadingExampleGroup extends KanjiReadingCandidate {
  examples: KanjiReadingExampleVocabulary[];
}

interface MatchVocabularyToKanjiReadingOptions {
  kanjiCharacters: string;
  kanjiReadings: KanjiReadingInput[];
  vocabularyCharacters: string;
  vocabularyReadings: VocabularyReadingInput[];
}

interface GroupKanjiReadingExamplesOptions {
  kanjiCharacters: string;
  kanjiReadings: KanjiReadingInput[];
  vocabulary: KanjiReadingExampleVocabulary[];
}

const KANJI_READING_TYPES = new Set<KanjiReadingType>([
  "onyomi",
  "kunyomi",
  "nanori",
]);

const READING_TYPE_ORDER: Record<KanjiReadingType, number> = {
  onyomi: 0,
  kunyomi: 1,
  nanori: 2,
};

const RENDAKU_INITIALS: Record<string, string[]> = {
  か: ["が"],
  き: ["ぎ"],
  く: ["ぐ"],
  け: ["げ"],
  こ: ["ご"],
  さ: ["ざ"],
  し: ["じ"],
  す: ["ず"],
  せ: ["ぜ"],
  そ: ["ぞ"],
  た: ["だ"],
  ち: ["ぢ"],
  つ: ["づ"],
  て: ["で"],
  と: ["ど"],
  は: ["ば", "ぱ"],
  ひ: ["び", "ぴ"],
  ふ: ["ぶ", "ぷ"],
  へ: ["べ", "ぺ"],
  ほ: ["ぼ", "ぽ"],
};

const SOKUON_FINALS = new Set(["き", "く", "ち", "つ"]);

export function normalizeKanjiReading(reading: string): string {
  const withoutReadingSeparators = reading.replace(
    /[-.\u30fb\u3002〜～\s]/g,
    ""
  );
  return toHiragana(withoutReadingSeparators).trim();
}

function isKanjiReadingType(value: string | undefined): value is KanjiReadingType {
  return value !== undefined && KANJI_READING_TYPES.has(value as KanjiReadingType);
}

function getReadingSurfaceVariants(normalizedReading: string): string[] {
  if (!normalizedReading) {
    return [];
  }

  const baseVariants = new Set([normalizedReading]);
  const finalCharacter = normalizedReading[normalizedReading.length - 1];
  if (finalCharacter && SOKUON_FINALS.has(finalCharacter)) {
    baseVariants.add(`${normalizedReading.slice(0, -1)}っ`);
  }

  const variants = new Set(baseVariants);
  for (const baseVariant of baseVariants) {
    const initialCharacter = baseVariant[0];
    const rendakuInitials = RENDAKU_INITIALS[initialCharacter] ?? [];
    for (const rendakuInitial of rendakuInitials) {
      variants.add(`${rendakuInitial}${baseVariant.slice(1)}`);
    }
  }

  return Array.from(variants);
}

export function getUniqueKanjiReadingCandidates(
  readings: KanjiReadingInput[]
): KanjiReadingCandidate[] {
  const candidatesByNormalizedReading = new Map<string, KanjiReadingCandidate>();

  for (const reading of readings) {
    if (!isKanjiReadingType(reading.type)) {
      continue;
    }

    const normalizedReading = normalizeKanjiReading(reading.reading);
    if (!normalizedReading) {
      continue;
    }

    const nextCandidate: KanjiReadingCandidate = {
      reading: reading.reading.trim(),
      normalizedReading,
      type: reading.type,
      primary: reading.primary === true,
    };
    const existing = candidatesByNormalizedReading.get(normalizedReading);

    if (
      !existing ||
      (existing.type === "nanori" && nextCandidate.type !== "nanori") ||
      (!existing.primary && nextCandidate.primary)
    ) {
      candidatesByNormalizedReading.set(normalizedReading, nextCandidate);
    }
  }

  return Array.from(candidatesByNormalizedReading.values());
}

type KanjiPosition = "only" | "prefix" | "suffix" | "middle" | "unknown";

function getKanjiPosition(
  kanjiCharacters: string,
  vocabularyCharacters: string
): KanjiPosition {
  if (!kanjiCharacters || !vocabularyCharacters) {
    return "unknown";
  }
  if (vocabularyCharacters === kanjiCharacters) {
    return "only";
  }
  if (vocabularyCharacters.startsWith(kanjiCharacters)) {
    return "prefix";
  }
  if (vocabularyCharacters.endsWith(kanjiCharacters)) {
    return "suffix";
  }
  if (vocabularyCharacters.includes(kanjiCharacters)) {
    return "middle";
  }
  return "unknown";
}

function scoreSurfaceVariant(
  vocabularyReading: string,
  surfaceVariant: string,
  position: KanjiPosition
): number {
  if (!vocabularyReading || !surfaceVariant) {
    return Number.NEGATIVE_INFINITY;
  }

  if (position === "only") {
    return vocabularyReading === surfaceVariant
      ? 1000 + surfaceVariant.length
      : Number.NEGATIVE_INFINITY;
  }

  if (position === "prefix" && vocabularyReading.startsWith(surfaceVariant)) {
    return 700 + surfaceVariant.length * 10;
  }

  if (position === "suffix" && vocabularyReading.endsWith(surfaceVariant)) {
    return 700 + surfaceVariant.length * 10;
  }

  if (
    position === "middle" &&
    vocabularyReading.indexOf(surfaceVariant) > 0 &&
    vocabularyReading.indexOf(surfaceVariant) <
      vocabularyReading.length - surfaceVariant.length
  ) {
    return 600 + surfaceVariant.length * 10;
  }

  if (position === "unknown" && vocabularyReading.includes(surfaceVariant)) {
    return 500 + surfaceVariant.length * 10;
  }

  return Number.NEGATIVE_INFINITY;
}

export function matchVocabularyToKanjiReading({
  kanjiCharacters,
  kanjiReadings,
  vocabularyCharacters,
  vocabularyReadings,
}: MatchVocabularyToKanjiReadingOptions): KanjiReadingCandidate | null {
  const candidates = getUniqueKanjiReadingCandidates(kanjiReadings);
  if (candidates.length === 0 || vocabularyReadings.length === 0) {
    return null;
  }

  const position = getKanjiPosition(kanjiCharacters, vocabularyCharacters);
  let bestCandidate: KanjiReadingCandidate | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  candidates.forEach((candidate) => {
    const surfaceVariants = getReadingSurfaceVariants(candidate.normalizedReading);

    vocabularyReadings.forEach((vocabularyReadingEntry) => {
      const vocabularyReading = normalizeKanjiReading(
        vocabularyReadingEntry.reading
      );

      surfaceVariants.forEach((surfaceVariant) => {
        let score = scoreSurfaceVariant(
          vocabularyReading,
          surfaceVariant,
          position
        );
        if (!Number.isFinite(score)) {
          return;
        }

        if (surfaceVariant === candidate.normalizedReading) {
          score += 20;
        }
        if (candidate.primary) {
          score += 5;
        }
        if (vocabularyReadingEntry.primary) {
          score += 2;
        }
        if (candidate.type === "nanori") {
          score -= 5;
        }

        if (score > bestScore) {
          bestScore = score;
          bestCandidate = candidate;
        }
      });
    });
  });

  return bestCandidate;
}

export function groupKanjiReadingExamples({
  kanjiCharacters,
  kanjiReadings,
  vocabulary,
}: GroupKanjiReadingExamplesOptions): KanjiReadingExampleGroup[] {
  const candidates = getUniqueKanjiReadingCandidates(kanjiReadings);
  const groupsByReading = new Map<string, KanjiReadingExampleGroup>();

  candidates.forEach((candidate) => {
    groupsByReading.set(candidate.normalizedReading, {
      ...candidate,
      examples: [],
    });
  });

  vocabulary.forEach((example) => {
    const match = matchVocabularyToKanjiReading({
      kanjiCharacters,
      kanjiReadings,
      vocabularyCharacters: example.characters,
      vocabularyReadings: example.readings,
    });
    if (!match) {
      return;
    }

    groupsByReading.get(match.normalizedReading)?.examples.push(example);
  });

  return Array.from(groupsByReading.values())
    .filter((group) => group.examples.length > 0)
    .map((group) => ({
      ...group,
      examples: [...group.examples].sort(
        (left, right) =>
          (left.level ?? Number.MAX_SAFE_INTEGER) -
            (right.level ?? Number.MAX_SAFE_INTEGER) ||
          left.characters.length - right.characters.length ||
          left.id - right.id
      ),
    }))
    .sort(
      (left, right) =>
        READING_TYPE_ORDER[left.type] - READING_TYPE_ORDER[right.type] ||
        Number(right.primary) - Number(left.primary)
    );
}
