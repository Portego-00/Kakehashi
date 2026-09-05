import { createCustomSrsState, reconcileCustomSrsState } from "./model";
import { CUSTOM_SRS_POLICY } from "./scheduler";
import type { CustomSrsAssignment, CustomSrsReviewLog, CustomSrsState, CustomVocabularyPack, SerializedFsrsCard } from "./types";

const PREFIX = "kakehashi:custom-srs:v1";
const MAX_LOADED_REVIEW_LOGS = 2_000;
export const CUSTOM_SRS_EVENT = "kakehashi-custom-srs-change";

type CustomSrsStorage = Pick<Storage, "getItem" | "setItem">;

export function customSrsStorageKey(scope: string | number) {
  return `${PREFIX}:account:${encodeURIComponent(String(scope).trim().toLowerCase())}`;
}

export async function withCustomSrsStorageLock<T>(scope: string | number, operation: () => T | Promise<T>) {
  if (typeof navigator === "undefined" || !navigator.locks) return operation();
  return navigator.locks.request(`${customSrsStorageKey(scope)}:write`, { mode: "exclusive" }, operation);
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isDateString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

function isNullableDate(value: unknown): value is string | null {
  return value === null || isDateString(value);
}

function isNonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isNonNegativeFinite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function sameNumbers(value: unknown, expected: readonly number[]) {
  return Array.isArray(value) && value.length === expected.length && value.every((item, index) => item === expected[index]);
}

function sameStrings(value: unknown, expected: readonly string[]) {
  return Array.isArray(value) && value.length === expected.length && value.every((item, index) => item === expected[index]);
}

function validPolicy(value: unknown) {
  if (!isRecord(value) || !isRecord(value.parameters)) return false;
  const policy = value;
  const parameters = value.parameters;
  const expected = CUSTOM_SRS_POLICY;
  return policy.id === expected.id
    && policy.version === expected.version
    && policy.library === expected.library
    && policy.libraryVersion === expected.libraryVersion
    && policy.bootstrapStrategy === expected.bootstrapStrategy
    && parameters.requestRetention === expected.parameters.requestRetention
    && parameters.maximumInterval === expected.parameters.maximumInterval
    && parameters.enableFuzz === expected.parameters.enableFuzz
    && sameStrings(parameters.learningSteps, expected.parameters.learningSteps)
    && sameStrings(parameters.relearningSteps, expected.parameters.relearningSteps)
    && sameNumbers(parameters.weights, expected.parameters.weights);
}

function validCard(value: unknown): value is SerializedFsrsCard {
  if (!isRecord(value)) return false;
  return isDateString(value.due)
    && ["New", "Learning", "Review", "Relearning"].includes(String(value.state))
    && isNonNegativeFinite(value.stability)
    && isNonNegativeFinite(value.difficulty)
    && isNonNegativeInteger(value.elapsed_days)
    && isNonNegativeInteger(value.scheduled_days)
    && isNonNegativeInteger(value.learning_steps)
    && isNonNegativeInteger(value.reps)
    && isNonNegativeInteger(value.lapses)
    && (value.last_review === undefined || isDateString(value.last_review));
}

function validAssignment(value: unknown, wordId: string, packId: string): value is CustomSrsAssignment {
  if (!isRecord(value)) return false;
  if (value.wordId !== wordId
    || value.packId !== packId
    || !isNonNegativeInteger(value.stage)
    || Number(value.stage) > 9
    || !isNullableDate(value.availableAt)
    || !isNullableDate(value.startedAt)
    || !isNullableDate(value.burnedAt)
    || !isDateString(value.updatedAt)
    || !isNonNegativeInteger(value.correctReviews)
    || !isNonNegativeInteger(value.incorrectReviews)) return false;

  const stage = Number(value.stage);
  if (stage === 0) return value.card === null && value.availableAt === null && value.startedAt === null && value.burnedAt === null;
  if (!validCard(value.card) || !isDateString(value.startedAt)) return false;
  if (stage === 9) return value.availableAt === null && isDateString(value.burnedAt);
  return isDateString(value.availableAt) && value.burnedAt === null;
}

function validReviewLog(value: unknown, knownWords: ReadonlyMap<string, string>): value is CustomSrsReviewLog {
  if (!isRecord(value)) return false;
  return typeof value.eventId === "string"
    && value.eventId.length > 0
    && typeof value.wordId === "string"
    && knownWords.get(value.wordId) === value.packId
    && isDateString(value.reviewedAt)
    && isNonNegativeInteger(value.startingStage)
    && Number(value.startingStage) <= 9
    && isNonNegativeInteger(value.endingStage)
    && Number(value.endingStage) <= 9
    && isNonNegativeInteger(value.incorrectAnswers)
    && (value.rating === "Again" || value.rating === "Good")
    && isNullableDate(value.nextReviewAt);
}

export function loadCustomSrsState(storage: Pick<CustomSrsStorage, "getItem">, scope: string | number, packs: readonly CustomVocabularyPack[], now = new Date()) {
  try {
    const raw = storage.getItem(customSrsStorageKey(scope));
    const value = raw ? JSON.parse(raw) as Partial<CustomSrsState> : null;
    if (!value || value.version !== 1 || !validPolicy(value.policy) || !Array.isArray(value.enrolledPackIds) || !isRecord(value.assignments) || !Array.isArray(value.reviewLog)) return createCustomSrsState(now);

    const packsById = new Map(packs.map((pack) => [pack.id, pack]));
    const rawEnrolledPackIds = [...new Set(value.enrolledPackIds.filter((id): id is string => typeof id === "string"))];
    const staleEnrolledPackIds = new Set(rawEnrolledPackIds.filter((id) => !packsById.has(id)));
    const enrolledPackIds = rawEnrolledPackIds.filter((id) => packsById.has(id));
    if (staleEnrolledPackIds.size) {
      for (const pack of packs) {
        const cameFromSplitPack = pack.words.some((word) => {
          const assignment = value.assignments![word.id];
          return isRecord(assignment) && typeof assignment.packId === "string" && staleEnrolledPackIds.has(assignment.packId);
        });
        if (cameFromSplitPack && !enrolledPackIds.includes(pack.id)) enrolledPackIds.push(pack.id);
      }
    }
    const knownWords = new Map<string, string>();
    for (const packId of enrolledPackIds) for (const word of packsById.get(packId)!.words) knownWords.set(word.id, packId);
    const assignments: Record<string, CustomSrsAssignment> = {};
    for (const [wordId, packId] of knownWords) {
      const assignment = value.assignments[wordId];
      const migratedAssignment = isRecord(assignment) && assignment.packId !== packId ? { ...assignment, packId } : assignment;
      if (validAssignment(migratedAssignment, wordId, packId)) assignments[wordId] = migratedAssignment;
    }
    const reviewLog = value.reviewLog.slice(-MAX_LOADED_REVIEW_LOGS).map((log) => {
      if (!isRecord(log) || typeof log.wordId !== "string") return log;
      const packId = knownWords.get(log.wordId);
      return packId && log.packId !== packId ? { ...log, packId } : log;
    }).filter((log): log is CustomSrsReviewLog => validReviewLog(log, knownWords));
    return reconcileCustomSrsState({
      version: 1,
      policy: CUSTOM_SRS_POLICY,
      enrolledPackIds,
      assignments,
      reviewLog,
      updatedAt: isDateString(value.updatedAt) ? value.updatedAt : now.toISOString(),
    }, packs, now);
  } catch {
    return createCustomSrsState(now);
  }
}

export function saveCustomSrsState(storage: CustomSrsStorage, scope: string | number, state: CustomSrsState) {
  try {
    storage.setItem(customSrsStorageKey(scope), JSON.stringify(state));
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CUSTOM_SRS_EVENT, { detail: { scope: String(scope) } }));
    return true;
  } catch {
    return false;
  }
}

export function customSrsSnapshot(scope: string | number) {
  if (typeof window === "undefined") return "";
  try { return window.localStorage.getItem(customSrsStorageKey(scope)) ?? ""; } catch { return ""; }
}

export function subscribeCustomSrs(scope: string | number, onChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const key = customSrsStorageKey(scope);
  const normalizedScope = String(scope);
  const onStorage = (event: StorageEvent) => { if (event.key === key) onChange(); };
  const onCustomChange = (event: Event) => { if ((event as CustomEvent<{ scope?: string }>).detail?.scope === normalizedScope) onChange(); };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CUSTOM_SRS_EVENT, onCustomChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CUSTOM_SRS_EVENT, onCustomChange);
  };
}
