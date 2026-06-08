import type { Subject as WKSubject } from "../../types/wanikani";

export type QuestionType = "meaning" | "reading";

export interface ReviewItem {
  id: number;
  subject: WKSubject;
  srsStage?: number;
}

export interface PreviousAnswerItem {
  id: number;
  subject: WKSubject;
  characters: string;
  meaning: string;
  backgroundColor: string;
  isCorrect: boolean;
  questionType: QuestionType;
}

export interface SRSProgressionInfo {
  newLevel: string;
  newStage: number;
  isCorrect: boolean;
  show: boolean;
  nextReviewInterval: string;
}

export interface ReviewQuestionProps {
  item: ReviewItem;
  questionType: QuestionType;
  onAnswer: (
    item: ReviewItem,
    questionType: QuestionType,
    isCorrect: boolean,
    wasIncorrect: boolean,
    isGroupedAnswer?: boolean,
  ) => void;
  onAskAgain?: (item: ReviewItem, questionType: QuestionType) => void;
  onSkip?: (item: ReviewItem, questionType: QuestionType) => void;
  onExit?: () => void;
  showHeader?: boolean;
  showBackgroundColor?: boolean;
  totalItems?: number;
  currentItem?: number;
  completedCount?: number;
  correctAnswersCount?: number;
  srsProgression?: SRSProgressionInfo;
  onSRSCardDismiss?: () => void;
  forceDisableAnkiGrouping?: boolean;
  isLessonFlow?: boolean;
  overridePromptText?: string;
  overridePromptSubtext?: string;
  overridePromptUsesJapaneseFont?: boolean;
  overridePausedCorrectAnswerText?: string;
  isWrapUpAvailable?: boolean;
  isWrapUpMode?: boolean;
  wrapUpTargetSubjects?: number;
  remainingSubjectsCount?: number;
  onWrapUp?: () => void;
  studyMaterials?: { meaning_synonyms?: string[] };
  onSynonymAdded?: (subjectId: number, newSynonyms: string[]) => void;
  contextSentencesHint?: { ja?: string; en?: string }[];
  contextHintMaxItems?: number;
  acceptCharactersAsCorrectForReading?: boolean;
  requireSubjectCharactersForReading?: boolean;
  showCharactersAndReadingForReadingQuestion?: boolean;
  reviewPermissionWarning?: string | null;
  onDismissReviewPermissionWarning?: () => void;
}

export interface VoiceReadingLookup {
  wordReadings: Record<string, string[]>;
  singleKanjiReadings: Record<string, string[]>;
}

export type ReviewDetailProgressionStatus = "loading" | "success" | "offline";

export interface ReviewDetailRelatedSubjects {
  componentSubjects: WKSubject[];
  amalgamationSubjects: WKSubject[];
  visuallySimilarSubjects: WKSubject[];
}

export interface SubjectPartsOfSpeechLookup {
  byId: Record<number, string[]>;
}

export const EMPTY_REVIEW_DETAIL_RELATED_SUBJECTS: ReviewDetailRelatedSubjects =
  {
    componentSubjects: [],
    amalgamationSubjects: [],
    visuallySimilarSubjects: [],
  };
