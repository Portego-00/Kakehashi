import { completeCustomLesson, enrollCustomVocabularyPack, recordCustomReview } from "./model";
import { customSrsStorageKey, withCustomSrsStorageLock } from "./storage";
import type { CustomSrsState, CustomVocabularyPack } from "./types";

export type RemoteStateResponse = { available: boolean; state: CustomSrsState | null; revision: number };
export type MutationPayload = { accountId: string; eventId: string } & (
  | { action: "enroll_pack"; packId: string }
  | { action: "complete_lesson"; wordId: string }
  | { action: "submit_review"; wordId: string; incorrectAnswers: number; expectedAssignmentUpdatedAt: string }
);
export type PendingCustomSrsMutation = { payload: MutationPayload; createdAt: string };
export type CustomSrsOutbox = {
  version: 1;
  confirmed: { state: CustomSrsState; revision: number };
  pending: PendingCustomSrsMutation[];
  syncError: string;
  attempts: number;
  retryAt: number;
};

const CHANGE_EVENT = "kakehashi-custom-srs-outbox-change";
const workers = new Map<string, Promise<void>>();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function withOutboxWriteLock<T>(scope: string | number, operation: () => T | Promise<T>) {
  if (typeof navigator === "undefined" || !navigator.locks) {
    throw new Error("This browser cannot safely save custom vocabulary answers. Use a browser with Web Locks on a secure connection.");
  }
  return withCustomSrsStorageLock(scope, operation);
}

export function customSrsOutboxKey(scope: string | number) {
  return `${customSrsStorageKey(scope)}:outbox`;
}

function validPending(value: PendingCustomSrsMutation, scope: string | number) {
  const payload = value?.payload;
  if (!payload || payload.accountId !== String(scope) || typeof payload.eventId !== "string" || !UUID.test(payload.eventId)
    || !Number.isFinite(Date.parse(value.createdAt))) return false;
  if (payload.action === "enroll_pack") return typeof payload.packId === "string" && Boolean(payload.packId.trim()) && payload.packId.length <= 120;
  if (typeof payload.wordId !== "string" || !payload.wordId.trim() || payload.wordId.length > 180) return false;
  if (payload.action === "complete_lesson") return true;
  return payload.action === "submit_review" && Number.isInteger(payload.incorrectAnswers)
    && payload.incorrectAnswers >= 0 && payload.incorrectAnswers <= 100
    && typeof payload.expectedAssignmentUpdatedAt === "string"
    && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(payload.expectedAssignmentUpdatedAt)
    && Number.isFinite(Date.parse(payload.expectedAssignmentUpdatedAt));
}

export function parseCustomSrsOutbox(raw: string, scope: string | number): CustomSrsOutbox | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as CustomSrsOutbox;
    if (value.version !== 1 || !value.confirmed?.state || value.confirmed.state.version !== 1
      || !value.confirmed.state.assignments || !Array.isArray(value.confirmed.state.enrolledPackIds)
      || !Array.isArray(value.confirmed.state.reviewLog) || !Number.isInteger(value.confirmed.revision) || !Array.isArray(value.pending)
      || typeof value.syncError !== "string" || !Number.isInteger(value.attempts) || value.attempts < 0 || !Number.isFinite(value.retryAt)
      || !value.pending.every((entry) => validPending(entry, scope))) throw new Error("Invalid outbox");
    return value;
  } catch {
    // Never silently replace an unreadable queue: it may contain unsynced answers.
    throw new Error("Saved custom vocabulary answers could not be read. Keep this browser's data and retry.");
  }
}

export function customSrsOutboxSnapshot(scope: string | number) {
  if (typeof window === "undefined") return "";
  try { return window.localStorage.getItem(customSrsOutboxKey(scope)) ?? ""; } catch { return ""; }
}

export function readCustomSrsOutbox(scope: string | number) {
  return parseCustomSrsOutbox(window.localStorage.getItem(customSrsOutboxKey(scope)) ?? "", scope);
}

export function saveCustomSrsOutbox(scope: string | number, value: CustomSrsOutbox) {
  // The confirmed snapshot and commands are one atomic localStorage write. An
  // accepted answer must survive a reload even if the POST has not started yet.
  window.localStorage.setItem(customSrsOutboxKey(scope), JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: customSrsOutboxKey(scope) }));
}

export function subscribeCustomSrsOutbox(scope: string | number, onChange: () => void) {
  const key = customSrsOutboxKey(scope);
  const onStorage = (event: StorageEvent) => { if (event.key === key || event.key === null) onChange(); };
  const onLocal = (event: Event) => { if ((event as CustomEvent<string>).detail === key) onChange(); };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onLocal);
  return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(CHANGE_EVENT, onLocal); };
}

export function applyCustomSrsMutation(state: CustomSrsState, entry: PendingCustomSrsMutation, packs: readonly CustomVocabularyPack[]) {
  const { payload } = entry;
  const now = new Date(entry.createdAt);
  if (payload.action === "enroll_pack") {
    const pack = packs.find((candidate) => candidate.id === payload.packId);
    if (!pack) throw new Error("Custom vocabulary pack not found.");
    return enrollCustomVocabularyPack(state, pack, now);
  }
  if (payload.action === "complete_lesson") return completeCustomLesson(state, payload.wordId, now);
  // Another device may already have reviewed this occurrence. Do not project a
  // stale answer onto its new schedule, even if the deduplication log was pruned.
  if (state.assignments[payload.wordId]?.updatedAt !== payload.expectedAssignmentUpdatedAt) return state;
  return recordCustomReview(state, payload.wordId, payload.incorrectAnswers, now, payload.eventId);
}

export function projectCustomSrsOutbox(outbox: CustomSrsOutbox, packs: readonly CustomVocabularyPack[], remote?: RemoteStateResponse) {
  const base = remote?.available && remote.state && remote.revision > outbox.confirmed.revision ? remote.state : outbox.confirmed.state;
  return outbox.pending.reduce((state, entry) => applyCustomSrsMutation(state, entry, packs), base);
}

export function newerCustomSrsResponse(current: RemoteStateResponse | undefined, incoming: RemoteStateResponse) {
  if (current?.available && incoming.available && incoming.revision <= current.revision) return current;
  return incoming;
}

export async function rememberCustomSrsRemote(scope: string | number, remote: RemoteStateResponse) {
  if (!remote.available || !remote.state) return;
  await withOutboxWriteLock(scope, () => {
    const existing = readCustomSrsOutbox(scope);
    if (existing && existing.confirmed.revision >= remote.revision) return;
    saveCustomSrsOutbox(scope, {
      version: 1,
      confirmed: { state: remote.state!, revision: remote.revision },
      pending: existing?.pending ?? [],
      syncError: existing?.syncError ?? "",
      attempts: existing?.attempts ?? 0,
      retryAt: existing?.retryAt ?? 0,
    });
  });
}

export async function enqueueCustomSrsMutation(scope: string | number, entry: PendingCustomSrsMutation, packs: readonly CustomVocabularyPack[], remote: RemoteStateResponse | undefined) {
  return withOutboxWriteLock(scope, () => {
    const existing = readCustomSrsOutbox(scope);
    if (!existing && (!remote?.available || !remote.state)) throw new Error("Load your custom vocabulary progress before studying.");
    const confirmed = remote?.available && remote.state && (!existing || remote.revision > existing.confirmed.revision)
      ? { state: remote.state, revision: remote.revision }
      : existing!.confirmed;
    const pending = existing?.pending ?? [];
    if (!validPending(entry, scope)) throw new Error("This custom vocabulary answer is invalid. Refresh the lesson and try again.");
    const reviewedWordId = entry.payload.action === "submit_review" ? entry.payload.wordId : null;
    if (reviewedWordId && pending.some((item) => item.payload.action !== "enroll_pack"
      && item.payload.wordId === reviewedWordId
      && item.payload.eventId !== entry.payload.eventId)) {
      throw new Error("This word's earlier answer is still syncing. Retry sync before reviewing it again.");
    }
    const outbox: CustomSrsOutbox = {
      version: 1, confirmed,
      pending: pending.some((item) => item.payload.eventId === entry.payload.eventId) ? pending : [...pending, entry],
      syncError: existing?.syncError ?? "", attempts: existing?.attempts ?? 0, retryAt: existing?.retryAt ?? 0,
    };
    const state = projectCustomSrsOutbox(outbox, packs);
    saveCustomSrsOutbox(scope, outbox);
    return state;
  });
}

export async function retryCustomSrsOutbox(scope: string | number) {
  await withOutboxWriteLock(scope, () => {
    const outbox = readCustomSrsOutbox(scope);
    if (outbox?.pending.length) saveCustomSrsOutbox(scope, { ...outbox, syncError: "", retryAt: 0 });
  });
}

export function flushCustomSrsOutbox(
  scope: string | number,
  send: (payload: MutationPayload) => Promise<RemoteStateResponse>,
  onRemote: (remote: RemoteStateResponse) => void,
  isActive: () => boolean,
): Promise<void> {
  const key = customSrsOutboxKey(scope);
  const existingWorker = workers.get(key);
  if (existingWorker) return existingWorker;
  const drain = async () => {
    while (isActive()) {
      const outbox = readCustomSrsOutbox(scope);
      const entry = outbox?.pending[0];
      if (!outbox || !entry || outbox.retryAt > Date.now()) return;
      try {
        const remote = await send(entry.payload);
        if (!remote.available || !remote.state) throw new Error("Cloud saving is unavailable. Your answers are saved on this device and will be retried.");
        await withOutboxWriteLock(scope, () => {
          const latest = readCustomSrsOutbox(scope);
          if (!latest) return;
          saveCustomSrsOutbox(scope, {
            ...latest,
            confirmed: remote.revision >= latest.confirmed.revision ? { state: remote.state!, revision: remote.revision } : latest.confirmed,
            pending: latest.pending.filter((item) => item.payload.eventId !== entry.payload.eventId),
            syncError: "", attempts: 0, retryAt: 0,
          });
        });
        onRemote(remote);
      } catch (cause) {
        await withOutboxWriteLock(scope, () => {
          const latest = readCustomSrsOutbox(scope);
          if (!latest) return;
          const status = cause && typeof cause === "object" && "status" in cause ? Number(cause.status) : 0;
          const retryable = !status || status === 408 || status === 429 || status >= 500;
          saveCustomSrsOutbox(scope, {
            ...latest,
            syncError: cause instanceof Error ? cause.message : "Custom vocabulary answers have not synced yet.",
            attempts: latest.attempts + 1,
            retryAt: retryable ? Date.now() + Math.min(30_000, 1_000 * 2 ** Math.min(latest.attempts, 5)) : Number.MAX_SAFE_INTEGER,
          });
        });
        return;
      }
    }
  };
  // Delivery locks are distinct from the short storage lock: a slow request must
  // never block the next durable local answer, including across browser tabs.
  const worker = Promise.resolve().then(async () => {
    if (typeof navigator !== "undefined" && navigator.locks) {
      await navigator.locks.request(`${key}:delivery`, { mode: "exclusive" }, async () => { await drain(); });
    } else throw new Error("This browser cannot safely sync custom vocabulary answers without Web Locks.");
  }).finally(() => { if (workers.get(key) === worker) workers.delete(key); });
  workers.set(key, worker);
  return worker;
}
