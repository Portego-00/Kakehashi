import { Subject } from "./wanikani";
import { ImmersionKitSentence } from "../services/immersionKitService";

export type { ImmersionKitSentence };

export type ListeningSolutionMode = "multiple_choice" | "writing";

export interface ListeningPracticeConfig {
  includeVocabulary: boolean;
  includeKanaVocabulary: boolean;
  solutionMode: ListeningSolutionMode;
  numberOfQuestions: number;
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
  sessionAnimes: string[] | null; // null = use global settings
  selectedListIds?: string[];
}

export interface KanjiChoice {
  kanji: string;
  vocabId: number;
  reading: string;
  isCorrect: boolean;
}

export interface ListeningQuestion {
  id: number;
  vocab: Subject;
  example: ImmersionKitSentence;
  sentenceWithBlank: string;
  kanjiChoices: KanjiChoice[];
}

export interface ListeningAnswer {
  vocab: Subject;
  example: ImmersionKitSentence;
  kanjiCorrect: boolean;
  meaningCorrect: boolean;
  kanjiAnswer: string;
  meaningAnswer: string;
}

export interface ListeningSessionResult {
  totalQuestions: number;
  kanjiCorrectCount: number;
  meaningCorrectCount: number;
  answers: ListeningAnswer[];
  completedAt: string;
}
