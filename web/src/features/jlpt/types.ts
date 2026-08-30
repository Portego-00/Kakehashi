export const JLPT_LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;
export const JLPT_BANK_VERSION = 6 as const;

export type JlptLevel = (typeof JLPT_LEVELS)[number];
export type JlptQuizMode = "quick" | "mock" | "weak";
export type JlptSkill =
  | "kanji"
  | "vocabulary"
  | "grammar"
  | "reading"
  | "listening";

export type JlptTestItemType =
  | "kanji-reading"
  | "orthography"
  | "word-formation"
  | "context-expression"
  | "paraphrase"
  | "usage"
  | "grammar-form"
  | "sentence-composition"
  | "text-grammar"
  | "reading-short"
  | "reading-mid"
  | "reading-long"
  | "reading-integrated"
  | "reading-thematic"
  | "information-retrieval"
  | "listening-task"
  | "listening-key-points"
  | "listening-outline"
  | "listening-verbal"
  | "listening-quick-response"
  | "listening-integrated";

export interface JlptQuestionOption {
  id: string;
  label: string;
}

export interface JlptPassage {
  title?: string;
  body: string;
  sourceLabel?: string;
  groupId?: string;
  groupQuestionIndex?: number;
  blankId?: string;
  blankOrder?: number;
}

export type JlptVerbalSceneSetting =
  | "cafe"
  | "classroom"
  | "home"
  | "landmark"
  | "library"
  | "office"
  | "service-counter"
  | "shop"
  | "street"
  | "train";

export type JlptVerbalScenePose =
  | "bowing"
  | "confused"
  | "holding"
  | "neutral"
  | "offering"
  | "pointing"
  | "requesting"
  | "sitting"
  | "speaking";

export type JlptVerbalSceneProp =
  | "box"
  | "bag"
  | "camera"
  | "calendar"
  | "charger"
  | "document"
  | "glass"
  | "machine"
  | "menu"
  | "pencil"
  | "plate"
  | "seat"
  | "shirt"
  | "sign"
  | "umbrella"
  | "window";

export interface JlptVerbalScenePerson {
  side: "left" | "right";
  pose: JlptVerbalScenePose;
}

/**
 * A compact semantic description rendered as an original line illustration.
 * The speaker is always marked visually with an arrow; `description` provides
 * the equivalent scene information for assistive technology.
 */
export interface JlptVerbalScene {
  setting: JlptVerbalSceneSetting;
  speaker: JlptVerbalScenePerson;
  partner: JlptVerbalScenePerson;
  prop?: {
    kind: JlptVerbalSceneProp;
    position: "left" | "center" | "right";
  };
  description: string;
}

export interface JlptListeningPrompt {
  script: string;
  visiblePrompt?: string;
  audioOnlyOptions?: boolean;
  verbalScene?: JlptVerbalScene;
  maxPlays: number;
  rate: number;
}

export interface JlptQuestionProvenance {
  /** Stable identity for the underlying knowledge point or scenario. */
  semanticKey: string;
  /** Zero-based controlled rendering variant within the semantic item. */
  variantIndex: number;
  authorship: "hand-authored" | "controlled-variant";
  editorialStatus: "machine-validated" | "sampled-ai-review" | "human-approved";
  contentVersion: number;
}

export interface JlptQuestion {
  id: string;
  level: JlptLevel;
  skill: JlptSkill;
  officialType: JlptTestItemType;
  provenance?: JlptQuestionProvenance;
  instruction: string;
  stem: string;
  focus?: string;
  passage?: JlptPassage;
  listening?: JlptListeningPrompt;
  options: JlptQuestionOption[];
  correctOptionId: string;
  explanation: string;
  shortQuiz?: boolean;
  relatedKanji?: string[];
  sentenceComposition?: {
    canonicalOrderOptionIds: readonly string[];
    starredPosition: number;
  };
}

export type JlptTestSectionId =
  | "vocabulary"
  | "grammar-reading"
  | "language-reading"
  | "listening";

export interface JlptTestSection {
  id: JlptTestSectionId;
  title: string;
  shortTitle: string;
  durationMinutes: number;
}

export interface JlptScoringSection {
  id: "language" | "language-reading" | "reading" | "listening";
  title: string;
  scoreRange: 60 | 120;
  officialSectionalPassMark: 19 | 38;
  skills: readonly JlptSkill[];
}

export interface JlptMockStructure {
  level: JlptLevel;
  sections: readonly JlptTestSection[];
  scoringSections: readonly JlptScoringSection[];
  officialOverallPassMark: number;
  officialTotalRange: 180;
}

export interface JlptAnswer {
  questionId: string;
  selectedOptionId: string;
  selectedOrderOptionIds?: string[];
  correct: boolean;
  answeredAt: string;
}

export type JlptSessionStatus =
  | "active"
  | "paused"
  | "section-complete"
  | "complete";

export interface JlptSession {
  version: 1;
  bankVersion: typeof JLPT_BANK_VERSION;
  id: string;
  level: JlptLevel;
  mode: JlptQuizMode;
  status: JlptSessionStatus;
  immediateFeedback: boolean;
  sectionQuestionIds: string[][];
  currentSectionIndex: number;
  currentQuestionIndex: number;
  answers: JlptAnswer[];
  listeningPlays: Record<string, number>;
  deadlineAt: string | null;
  remainingSeconds: number | null;
  createdAt: string;
  updatedAt: string;
  weakSkills?: JlptSkill[];
}

export interface JlptPerformanceSlice {
  id: string;
  label: string;
  correct: number;
  total: number;
  percent: number;
}

export interface JlptSessionResult {
  correct: number;
  total: number;
  percent: number;
  bySkill: JlptPerformanceSlice[];
  byType: JlptPerformanceSlice[];
  byScoringSection: JlptPerformanceSlice[];
  strongest: JlptPerformanceSlice | null;
  weakest: JlptPerformanceSlice | null;
  missedQuestionIds: string[];
}
