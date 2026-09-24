export type MixedReviewLane = "wanikani" | "grammar" | "vocab";

export type MixedReviewHead = {
  /** Changes for every new question occurrence, including an immediate retry. */
  id: string;
  /** Keep paired WaniKani questions together when back-to-back is enabled. */
  keepTurn?: boolean;
};

export type MixedReviewProgress = { completed: number; total: number };
export type MixedReviewAccuracy = { correct: number; answered: number };
export type MixedReviewAnswer = {
  id: string;
  source: "wanikani" | "bunpro";
  title: string;
  correct: boolean;
  saveStatus?: "saved" | "unconfirmed";
  saveError?: string;
  subjectId?: number;
  bunproSubject?: { kind: "grammar" | "vocab"; slug: string };
};

/** Provider queues stay mounted; only the active provider may accept input. */
export type MixedReviewBridge = {
  active: boolean;
  report: (head: MixedReviewHead | null) => void;
  reportError: (message: string | null) => void;
  reportProgress: (progress: MixedReviewProgress) => void;
  reportAccuracy: (accuracy: MixedReviewAccuracy) => void;
  reportPending?: (count: number) => void;
  reportSaving?: (saving: boolean) => void;
  onAnswer: (answer: MixedReviewAnswer) => void;
  previous: MixedReviewAnswer | null;
  progress: MixedReviewProgress;
  accuracy: MixedReviewAccuracy;
  onExit: () => void;
  onWrapUp: () => void;
  wrapUpRequest?: { id: number; limit: number };
};
