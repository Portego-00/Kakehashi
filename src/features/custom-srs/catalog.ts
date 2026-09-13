import {
  CUSTOM_VOCABULARY_PACKS,
  CUSTOM_VOCABULARY_WORDS,
  customVocabularyPack,
  customVocabularyWord,
} from "../../../web/src/features/custom-srs/catalog";

export { CUSTOM_VOCABULARY_PACKS, CUSTOM_VOCABULARY_WORDS };
export const customVocabularyPacks = CUSTOM_VOCABULARY_PACKS;
export const customVocabularyWords = CUSTOM_VOCABULARY_WORDS;
export const getCustomVocabularyPack = customVocabularyPack;
export const getCustomVocabularyWord = customVocabularyWord;
