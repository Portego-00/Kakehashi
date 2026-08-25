import type { Assignment, Subject, SubjectType } from "@/types/wanikani";

export type StudyModeId =
  | "recent-lessons"
  | "random-test"
  | "vocab-reading"
  | "hiragana-meaning"
  | "similar-kanji"
  | "kana-to-kanji"
  | "listening"
  | "context-sentences"
  | "text-analysis"
  | "kanji-writing"
  | "crossword"
  | "kana-wordle"
  | "custom-review"
  | "custom-lessons"
  | "subject-lists";

export type QuizModeId = Exclude<
  StudyModeId,
  "text-analysis" | "kanji-writing" | "crossword" | "kana-wordle" | "custom-lessons" | "subject-lists"
>;

export type QuestionKind =
  | "meaning"
  | "reading"
  | "meaning-to-reading"
  | "kana-to-meaning"
  | "kana-to-kanji"
  | "similar-kanji"
  | "listening"
  | "listening-characters"
  | "listening-meaning"
  | "context";

export type SrsGroup = "apprentice" | "guru" | "master" | "enlightened" | "burned";
export type RecentLessonsWindow = "apprentice" | "24h" | "7d" | "30d";
export type StudyAnswerMode = "multiple-choice" | "typed";
export type ListeningSource = "wanikani" | "anime";
export type WritingPracticeMode = "guided" | "freehand";
export type SimilarKanjiSource = "wanikani" | "niai";
export type SimilarKanjiMode = "matching" | "choice";
export type CrosswordSize = "small" | "medium" | "large";
export type CrosswordClueMode = "english" | "kanji" | "english_kanji";
export type JlptLevel = "N5" | "N4" | "N3" | "N2" | "N1";

export interface StudyFilters {
  count: number;
  useCustomLevelRange: boolean;
  subjectTypes: SubjectType[];
  srsGroups: SrsGroup[];
  selectedSrsStages: number[];
  minLevel: number;
  maxLevel: number;
  selectedSubjectIds: number[];
  selectedListIds: string[];
  questionKinds: Array<"meaning" | "reading">;
  recentWindow: RecentLessonsWindow;
  answerMode: StudyAnswerMode;
  listeningSource: ListeningSource;
  animeSources: string[];
  listeningAutoPlayAudio: boolean;
  writingMode: WritingPracticeMode;
  wordLength: number;
  wordleMaxAttempts: number;
  similarKanjiSource: SimilarKanjiSource;
  similarKanjiMode: SimilarKanjiMode;
  similarKanjiOnlyLearned: boolean;
  similarKanjiGroupSize: number;
  contextSentenceAudio: boolean;
  contextAutoPlaySentenceAudio: boolean;
  contextHideTranslation: boolean;
  contextSentenceBreakdown: boolean;
  contextStopAfterAnswer: boolean;
  crosswordSize: CrosswordSize;
  crosswordMaxWords: number;
  crosswordJlptLevels: JlptLevel[];
  crosswordHiraganaOnly: boolean;
  crosswordClueMode: CrosswordClueMode;
  crosswordShowKanjiSolutions: boolean;
  crosswordPlayAudioOnCorrect: boolean;
}

export interface StudyTokenDetail {
  text: string;
  type: "grammar" | "verb" | "vocabulary" | "kanji" | "plain";
  meaning?: string;
  reading?: string;
  partsOfSpeech?: string[];
}

export interface StudyQuestion {
  id: string;
  subjectId: number;
  subjectType: SubjectType;
  kind: QuestionKind;
  prompt: string;
  promptLabel: string;
  acceptedAnswers: string[];
  displayAnswer: string;
  choices?: string[];
  characters?: string | null;
  meaning?: string;
  sentence?: { ja: string; en: string; masked: string; tokens?: StudyTokenDetail[] };
  audioUrl?: string;
  sourceTitle?: string;
  imageUrl?: string;
  autoPlayAudio?: boolean;
  sentenceAudioEnabled?: boolean;
  autoPlaySentenceAudio?: boolean;
  hideTranslationUntilTap?: boolean;
  enableSentenceBreakdown?: boolean;
  stopAfterAnswer?: boolean;
  originalQuestionId?: string;
  retryNumber?: number;
}

export interface StudyAnswer {
  questionId: string;
  value: string;
  correct: boolean;
  answeredAt: string;
}

export interface StudySession {
  version: 1;
  id: string;
  mode: QuizModeId;
  createdAt: string;
  updatedAt: string;
  currentIndex: number;
  questions: StudyQuestion[];
  answers: StudyAnswer[];
  complete: boolean;
}

export interface StudyDataset {
  subjects: Subject[];
  assignments: Assignment[];
}

export interface SubjectList {
  id: string;
  name: string;
  subjectIds: number[];
  createdAt: string;
  updatedAt: string;
}

export interface WordleTile {
  character: string;
  state: "correct" | "present" | "absent";
}

export interface CrosswordEntry {
  id: string;
  subjectId: number;
  answer: string;
  clue: string;
  characters: string;
  meaning: string;
  audioUrl?: string;
  row: number;
  col: number;
  direction: "across" | "down";
  number: number;
}

export interface CrosswordPuzzle {
  rows: number;
  cols: number;
  cells: Array<Array<{ answer: string; number?: number; entryIds: string[] } | null>>;
  entries: CrosswordEntry[];
}
