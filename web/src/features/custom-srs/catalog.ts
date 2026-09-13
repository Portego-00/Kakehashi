import catalogData from "./catalog.generated.json";
import type { CustomVocabularyPack, CustomVocabularyWord } from "./types";

export const CUSTOM_VOCABULARY_PACKS = catalogData as unknown as readonly CustomVocabularyPack[];

export const CUSTOM_VOCABULARY_WORDS: readonly CustomVocabularyWord[] = CUSTOM_VOCABULARY_PACKS.flatMap((pack) => pack.words);

export function customVocabularyPack(packId: string) {
  return CUSTOM_VOCABULARY_PACKS.find((pack) => pack.id === packId);
}

export function customVocabularyWord(wordId: string) {
  return CUSTOM_VOCABULARY_WORDS.find((word) => word.id === wordId);
}
