import type { Subject } from "../utils/api";
import type { KanjiChoice, ListeningSolutionMode } from "./listening";

export interface ContextSentencePracticeConfig {
  includeVocabulary: boolean;
  includeKanaVocabulary: boolean;
  solutionMode: ListeningSolutionMode;
  numberOfQuestions: number;
  enableSentenceAudio: boolean;
  autoPlaySentenceAudio: boolean;
  hideTranslationUntilTap: boolean;
  enableJpdbSentenceBreakdown: boolean;
  stopAfterAnswer: boolean;
  srsGroups: {
    apprentice: boolean;
    guru: boolean;
    master: boolean;
    enlightened: boolean;
    burned: boolean;
  };
  useCustomLevelRange: boolean;
  minLevel: number;
  maxLevel: number;
  selectedListIds?: string[];
  devSelectedSubjectIds?: number[];
}

export interface ContextSentenceQuestion {
  id: number;
  vocab: Subject;
  sentence: string;
  translation: string;
  sentenceWithBlank: string;
  kanjiChoices: KanjiChoice[];
}

export interface ContextSentenceAnswer {
  vocab: Subject;
  sentence: string;
  translation: string;
  isCorrect: boolean;
  answer: string;
}
