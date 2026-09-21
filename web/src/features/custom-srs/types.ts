import type { CardInput, RatingType, StateType } from "ts-fsrs";

export type CustomSrsStage = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type CustomVocabularyScript = "hiragana" | "katakana" | "mixed" | "kanji";

export interface CustomVocabularyLevelRange {
  min: number;
  max: number;
}

export interface CustomVocabularyContextSentence {
  ja: string;
  en: string;
}

export interface CustomVocabularyWord {
  id: string;
  characters: string;
  reading: string;
  meanings: string[];
  partsOfSpeech: string[];
  meaningMnemonic: string;
  readingMnemonic?: string;
  contextSentences: CustomVocabularyContextSentence[];
  requiredLevel?: number;
  kanjiLevels?: Record<string, number>;
}

export interface CustomVocabularyPack {
  id: string;
  title: string;
  description: string;
  script: CustomVocabularyScript;
  levelRange?: CustomVocabularyLevelRange;
  words: CustomVocabularyWord[];
}

export interface SerializedFsrsCard extends Omit<CardInput, "due" | "last_review" | "state"> {
  due: string;
  last_review?: string;
  state: StateType;
}

export interface CustomSrsAssignment {
  archivedAt?: string | null;
  wordId: string;
  packId: string;
  stage: CustomSrsStage;
  availableAt: string | null;
  startedAt: string | null;
  burnedAt: string | null;
  updatedAt: string;
  correctReviews: number;
  incorrectReviews: number;
  card: SerializedFsrsCard | null;
}

export interface CustomSrsReviewLog {
  eventId: string;
  wordId: string;
  packId: string;
  reviewedAt: string;
  startingStage: CustomSrsStage;
  endingStage: CustomSrsStage;
  incorrectAnswers: number;
  rating: RatingType;
  nextReviewAt: string | null;
}

export interface LegacyCustomSrsPolicyMetadata {
  id: "fsrs-wk-shaped";
  version: 1;
  library: "ts-fsrs";
  libraryVersion: "5.4.1";
  bootstrapStrategy: "explicit-learning-card";
  parameters: {
    requestRetention: number;
    maximumInterval: number;
    enableFuzz: boolean;
    learningSteps: string[];
    relearningSteps: string[];
    weights: number[];
  };
}

export interface CustomSrsSettings {
  mode: "wanikani" | "fsrs";
  stageIntervals: number[];
  learningSteps: string[];
  relearningSteps: string[];
  requestRetention: number;
  maximumInterval: number;
  roundToHour: boolean;
}

export interface ConfigurableCustomSrsPolicy extends Omit<LegacyCustomSrsPolicyMetadata, "id" | "version"> {
  id: "custom-srs";
  version: 2;
  settings: CustomSrsSettings;
  settingsRevision: number;
  lastSettingsEventId: string | null;
}

export type CustomSrsPolicyMetadata = LegacyCustomSrsPolicyMetadata | ConfigurableCustomSrsPolicy;

export interface CustomSrsState {
  personalLibraryRevision?: number;
  version: 1;
  policy: CustomSrsPolicyMetadata;
  enrolledPackIds: string[];
  assignments: Record<string, CustomSrsAssignment>;
  reviewLog: CustomSrsReviewLog[];
  updatedAt: string;
}

export interface CustomPackProgress {
  total: number;
  lessons: number;
  apprentice: number;
  guru: number;
  master: number;
  enlightened: number;
  burned: number;
  due: number;
}
