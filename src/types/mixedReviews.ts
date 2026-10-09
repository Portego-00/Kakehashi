import type { BunproProgression } from "../utils/bunpro-progression";
import type { SubjectType } from "../utils/subjectColors";

export type MixedReviewLane = "wanikani" | "grammar" | "vocab";

export type MixedReviewHead = {
  /** Changes for every new question occurrence, including an immediate retry. */
  id: string;
  /** Keep paired WaniKani questions together when back-to-back is enabled. */
  keepTurn?: boolean;
  retryKey?: string;
  pending?: { id: string; subjectId: string; open: boolean }[];
  activate?: (id: string) => void;
  remaining?: number;
  ready?: boolean;
};

export type MixedReviewProgress = { completed: number; total: number };
export type MixedReviewAccuracy = { correct: number; answered: number };
export type MixedReviewAnswer = {
  id: string;
  source: "wanikani" | "bunpro";
  title: string;
  correct: boolean;
  practiceOnly?: boolean;
  saveStatus?: "pending" | "saved" | "unconfirmed";
  saveError?: string;
  meaning?: string;
  reading?: string;
  question?: string;
  translation?: string;
  enteredAnswer?: string;
  correctAnswer?: string;
  stage?: string;
  previousStage?: string;
  audioSources?: { female_audio_url?: unknown; male_audio_url?: unknown };
  subjectId?: number;
  subjectType?: SubjectType;
  bunproSubject?: { kind: "grammar" | "vocab"; slug: string };
};

/** Provider queues stay mounted; only the active provider may accept input. */
export type MixedReviewBridge = {
  bunproProgression?: BunproProgression | null;
  reportBunproProgression?: (value: BunproProgression) => void;
  active: boolean;
  report: (head: MixedReviewHead | null) => void;
  reportError: (message: string | null) => void;
  reportProgress: (progress: MixedReviewProgress) => void;
  reportAccuracy: (accuracy: MixedReviewAccuracy) => void;
  reportPending?: (count: number) => void;
  reportSaving?: (saving: boolean) => void;
  onAnswer: (answer: MixedReviewAnswer) => void;
  /** Updates persistence without replaying the previous-answer transition. */
  onSaveSettled?: (answer: MixedReviewAnswer) => void;
  previous: MixedReviewAnswer | null;
  progress: MixedReviewProgress;
  accuracy: MixedReviewAccuracy;
  onExit: () => void;
  onWrapUp: () => void;
  wrapUpRequest?: { id: number; limit: number };
};
