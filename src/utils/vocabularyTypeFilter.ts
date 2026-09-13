export interface VocabularyTypedSubject {
  object: string;
  data: { parts_of_speech?: readonly string[] | null };
}

// Used until the catalog is loaded; loaded catalogs supply their own labels.
const COMMON_VOCABULARY_TYPES = [
  "noun", "proper noun", "verbal noun", "pronoun", "numeral", "counter",
  "verb", "godan verb", "ichidan verb", "suru verb", "kuru verb",
  "transitive verb", "intransitive verb", "i-adjective", "na-adjective",
  "no-adjective", "adverb", "expression", "interjection", "conjunction",
  "prefix", "suffix", "particle",
];

function normalizeVocabularyType(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeVocabularyTypes(values: readonly string[]): string[] {
  return Array.from(new Set(values.map(normalizeVocabularyType).filter(Boolean)));
}

export function formatVocabularyType(value: string): string {
  const normalized = normalizeVocabularyType(value);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function matchesVocabularyTypes(
  subject: VocabularyTypedSubject,
  selected: readonly string[] = [],
): boolean {
  const types = normalizeVocabularyTypes(selected);
  if (types.length === 0) return true;
  if (subject.object !== "vocabulary" && subject.object !== "kana_vocabulary") {
    return false;
  }
  return (subject.data.parts_of_speech ?? []).some((value) =>
    types.includes(normalizeVocabularyType(value)),
  );
}

export function getVocabularyTypeOptions(
  subjects: readonly VocabularyTypedSubject[] = [],
  selected: readonly string[] = [],
): { value: string; label: string }[] {
  const catalogTypes = subjects.flatMap((subject) =>
    subject.object === "vocabulary" || subject.object === "kana_vocabulary"
      ? subject.data.parts_of_speech ?? []
      : [],
  );
  const values = normalizeVocabularyTypes([
    ...(subjects.length === 0 ? COMMON_VOCABULARY_TYPES : catalogTypes),
    ...selected,
  ]);
  return values.sort((a, b) => a.localeCompare(b)).map((value) => ({
    value,
    label: formatVocabularyType(value),
  }));
}
