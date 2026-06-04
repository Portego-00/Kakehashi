import {
  PERMANENT_KEYS,
  permanentStorage,
} from "./permanentStorage";

const LESSON_SESSION_SCHEMA_VERSION = 1;

export type PersistedLessonMode = "lesson" | "review" | "batch_complete";

export interface PersistedLessonItem {
  id: number;
  assignmentId: number;
  subjectId: number;
  availableAt?: string | null;
  subject: any;
  meaningDone: boolean;
  readingDone: boolean;
  meaningIncorrect: number;
  readingIncorrect: number;
  submitted?: boolean;
  submissionFailed?: boolean;
}

export interface PersistedLessonBatch {
  items: PersistedLessonItem[];
  completed: boolean;
}

export interface PersistedLessonQuestion {
  type: "meaning" | "reading";
  itemId: number;
}

export interface PersistedLessonTypeCounts {
  radical: number;
  kanji: number;
  vocabulary: number;
}

export interface PersistedLessonProgress {
  totalItems: number;
  completedItems: number;
  currentBatch: number;
  totalBatches: number;
}

export interface PersistedLessonBatchStats {
  batchNumber: number;
  itemCount: number;
  typeCounts: PersistedLessonTypeCounts;
}

export interface PersistedLessonSessionState {
  allLessons: PersistedLessonItem[];
  lessonBatches: PersistedLessonBatch[];
  currentBatchIndex: number;
  currentItemIndex: number;
  mode: PersistedLessonMode;
  reviewItems: PersistedLessonItem[];
  masterQueue: PersistedLessonQuestion[];
  activeQueue: PersistedLessonQuestion[];
  currentQuestion: PersistedLessonQuestion | null;
  completedBatchStats: PersistedLessonBatchStats | null;
  isFinalBatchComplete: boolean;
  progress: PersistedLessonProgress;
  typeCounts: PersistedLessonTypeCounts;
  relatedSubjects: Record<number, any>;
}

export interface PersistedLessonSession {
  schemaVersion: typeof LESSON_SESSION_SCHEMA_VERSION;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
  state: PersistedLessonSessionState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPersistedLessonMode(value: unknown): value is PersistedLessonMode {
  return value === "lesson" || value === "review" || value === "batch_complete";
}

function isPersistedLessonQuestion(
  value: unknown
): value is PersistedLessonQuestion {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.type === "meaning" || value.type === "reading") &&
    typeof value.itemId === "number" &&
    Number.isFinite(value.itemId)
  );
}

function isPersistedLessonTypeCounts(
  value: unknown
): value is PersistedLessonTypeCounts {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.radical === "number" &&
    typeof value.kanji === "number" &&
    typeof value.vocabulary === "number"
  );
}

function isPersistedLessonProgress(
  value: unknown
): value is PersistedLessonProgress {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.totalItems === "number" &&
    typeof value.completedItems === "number" &&
    typeof value.currentBatch === "number" &&
    typeof value.totalBatches === "number"
  );
}

function isPersistedLessonState(
  value: unknown
): value is PersistedLessonSessionState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Array.isArray(value.allLessons) &&
    value.allLessons.length > 0 &&
    Array.isArray(value.lessonBatches) &&
    value.lessonBatches.length > 0 &&
    typeof value.currentBatchIndex === "number" &&
    typeof value.currentItemIndex === "number" &&
    isPersistedLessonMode(value.mode) &&
    Array.isArray(value.reviewItems) &&
    Array.isArray(value.masterQueue) &&
    value.masterQueue.every(isPersistedLessonQuestion) &&
    Array.isArray(value.activeQueue) &&
    value.activeQueue.every(isPersistedLessonQuestion) &&
    (value.currentQuestion === null ||
      isPersistedLessonQuestion(value.currentQuestion)) &&
    (value.completedBatchStats === null ||
      isRecord(value.completedBatchStats)) &&
    typeof value.isFinalBatchComplete === "boolean" &&
    isPersistedLessonProgress(value.progress) &&
    isPersistedLessonTypeCounts(value.typeCounts) &&
    isRecord(value.relatedSubjects)
  );
}

function parsePersistedLessonSession(
  rawValue: string | undefined
): PersistedLessonSession | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!isRecord(parsed)) {
      return null;
    }

    if (parsed.schemaVersion !== LESSON_SESSION_SCHEMA_VERSION) {
      return null;
    }

    if (
      parsed.userId !== null &&
      typeof parsed.userId !== "string"
    ) {
      return null;
    }

    if (
      typeof parsed.createdAt !== "string" ||
      typeof parsed.updatedAt !== "string" ||
      !isPersistedLessonState(parsed.state)
    ) {
      return null;
    }

    return parsed as unknown as PersistedLessonSession;
  } catch {
    return null;
  }
}

export async function loadPersistedLessonSession(
  currentUserId?: string | null
): Promise<PersistedLessonSession | null> {
  const session = parsePersistedLessonSession(
    permanentStorage.getString(PERMANENT_KEYS.LESSON_SESSION)
  );

  if (!session) {
    return null;
  }

  if (
    session.userId &&
    currentUserId &&
    session.userId !== currentUserId
  ) {
    await clearPersistedLessonSession();
    return null;
  }

  return session;
}

export async function savePersistedLessonSession(
  state: PersistedLessonSessionState,
  options: { userId?: string | null; createdAt?: string | null } = {}
): Promise<void> {
  const now = new Date().toISOString();
  const session: PersistedLessonSession = {
    schemaVersion: LESSON_SESSION_SCHEMA_VERSION,
    userId: options.userId ?? null,
    createdAt: options.createdAt ?? now,
    updatedAt: now,
    state,
  };

  permanentStorage.set(PERMANENT_KEYS.LESSON_SESSION, JSON.stringify(session));
}

export async function clearPersistedLessonSession(): Promise<void> {
  permanentStorage.delete(PERMANENT_KEYS.LESSON_SESSION);
}
