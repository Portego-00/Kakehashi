"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Review } from "@/types/wanikani";

const PREFIX = "kakehashi:analytics:review-ledger:v1:";
const CHANGE_EVENT = "kakehashi:analytics:review-recorded";
export const MAX_RECORDED_REVIEWS = 20_000;
type CompactReview = [id: number, assignmentId: number, subjectId: number, startingStage: number, endingStage: number, meaningErrors: number, readingErrors: number, createdAt: string];
type LedgerPayload = { version: 1; accountKey: string; recordingStartedAt: string; truncatedBefore: string | null; records: CompactReview[] };
export interface ReviewLedgerState { reviews: Review[]; recordingStartedAt: string | null; truncatedBefore: string | null; persistence: "device" | "memory" }
export interface ReviewRecordingContext { accountKey: string; revision: number }
const EMPTY: ReviewLedgerState = { reviews: [], recordingStartedAt: null, truncatedBefore: null, persistence: "device" };
const cache = new Map<string, { raw: string | null; payload: LedgerPayload | null; state: ReviewLedgerState }>();
let activeAccount: string | null = null;
let revision = 0;

export function reviewLedgerStorageKey(accountKey: string) { return `${PREFIX}${encodeURIComponent(accountKey)}`; }
function validDate(value: unknown): value is string { return typeof value === "string" && Number.isFinite(Date.parse(value)); }
function validInteger(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= maximum; }
function validCompact(value: unknown): value is CompactReview {
  return Array.isArray(value) && value.length === 8 && validInteger(value[0], 1) && validInteger(value[1], 1) && validInteger(value[2], 1) && validInteger(value[3], 1, 8) && validInteger(value[4], 1, 9) && validInteger(value[5], 0, 10_000) && validInteger(value[6], 0, 10_000) && validDate(value[7]);
}
function unpack(record: CompactReview): Review {
  const [id, assignment_id, subject_id, starting_srs_stage, ending_srs_stage, incorrect_meaning_answers, incorrect_reading_answers, created_at] = record;
  return { id, object: "review", url: `/api/wanikani/reviews/${id}`, data_updated_at: created_at, data: { assignment_id, subject_id, starting_srs_stage, ending_srs_stage, incorrect_meaning_answers, incorrect_reading_answers, created_at } };
}
function parsePayload(raw: string, accountKey: string): LedgerPayload | null {
  try {
    const value = JSON.parse(raw) as Partial<LedgerPayload>;
    if (value.version !== 1 || value.accountKey !== accountKey || !validDate(value.recordingStartedAt) || (value.truncatedBefore !== null && !validDate(value.truncatedBefore)) || !Array.isArray(value.records) || value.records.length > MAX_RECORDED_REVIEWS || !value.records.every(validCompact)) return null;
    return { version: 1, accountKey, recordingStartedAt: value.recordingStartedAt, truncatedBefore: value.truncatedBefore ?? null, records: value.records };
  } catch { return null; }
}

export function readReviewLedger(accountKey: string): ReviewLedgerState {
  if (!accountKey || typeof window === "undefined") return EMPTY;
  const previous = cache.get(accountKey);
  try {
    const raw = window.localStorage.getItem(reviewLedgerStorageKey(accountKey));
    if (previous?.raw === raw) return previous.state;
    const payload = raw ? parsePayload(raw, accountKey) : null;
    const state: ReviewLedgerState = payload ? { reviews: payload.records.map(unpack), recordingStartedAt: payload.recordingStartedAt, truncatedBefore: payload.truncatedBefore, persistence: "device" } : EMPTY;
    cache.set(accountKey, { raw, payload, state });
    return state;
  } catch {
    if (previous?.state.persistence === "memory") return previous.state;
    const state: ReviewLedgerState = { ...(previous?.state ?? EMPTY), persistence: "memory" };
    cache.set(accountKey, { raw: previous?.raw ?? null, payload: previous?.payload ?? null, state });
    return state;
  }
}

function writeLedger(payload: LedgerPayload): ReviewLedgerState {
  const raw = JSON.stringify(payload);
  const previousRaw = cache.get(payload.accountKey)?.raw ?? null;
  const state: ReviewLedgerState = { reviews: payload.records.map(unpack), recordingStartedAt: payload.recordingStartedAt, truncatedBefore: payload.truncatedBefore, persistence: "device" };
  try { window.localStorage.setItem(reviewLedgerStorageKey(payload.accountKey), raw); }
  catch { state.persistence = "memory"; }
  cache.set(payload.accountKey, { raw: state.persistence === "device" ? raw : previousRaw, payload, state });
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: payload.accountKey }));
  return state;
}

/** Call only after an authenticated identity has been established. */
export function setReviewRecordingAccount(accountKey: string | null, now = new Date()) {
  if (activeAccount !== accountKey) { activeAccount = accountKey; revision += 1; }
  if (!accountKey || typeof window === "undefined") return;
  readReviewLedger(accountKey);
  if (!cache.get(accountKey)?.payload) writeLedger({ version: 1, accountKey, recordingStartedAt: now.toISOString(), truncatedBefore: null, records: [] });
}

export function captureReviewRecordingContext(): ReviewRecordingContext | null {
  return activeAccount ? { accountKey: activeAccount, revision } : null;
}

/** Persist only a successful official review response, never its request body. */
export function recordCompletedWaniKaniReview(context: ReviewRecordingContext | null, response: unknown): boolean {
  if (!context || activeAccount !== context.accountKey || revision !== context.revision || typeof window === "undefined") return false;
  if (!response || typeof response !== "object") return false;
  const review = response as Partial<Review>;
  if (review.object !== "review" || !review.data) return false;
  const { data } = review;
  const record = [review.id, data.assignment_id, data.subject_id, data.starting_srs_stage, data.ending_srs_stage, data.incorrect_meaning_answers, data.incorrect_reading_answers, data.created_at];
  if (!validCompact(record)) return false;
  readReviewLedger(context.accountKey);
  const previous = cache.get(context.accountKey)?.payload;
  if (!previous || previous.records.some((item) => item[0] === record[0])) return false;
  const records = [...previous.records];
  const createdAt = Date.parse(record[7]);
  if (!records.length || Date.parse(records[records.length - 1][7]) <= createdAt) records.push(record);
  else {
    let low = 0; let high = records.length;
    while (low < high) { const middle = Math.floor((low + high) / 2); if (Date.parse(records[middle][7]) <= createdAt) low = middle + 1; else high = middle; }
    records.splice(low, 0, record);
  }
  let truncatedBefore = previous.truncatedBefore;
  if (records.length > MAX_RECORDED_REVIEWS) {
    const removed = records.splice(0, records.length - MAX_RECORDED_REVIEWS);
    const removedThrough = removed[removed.length - 1][7];
    if (!truncatedBefore || Date.parse(removedThrough) > Date.parse(truncatedBefore)) truncatedBefore = removedThrough;
  }
  writeLedger({ ...previous, records, truncatedBefore });
  return true;
}

export function useReviewLedger(accountKey: string) {
  const subscribe = useCallback((notify: () => void) => {
    const onChange = (event: Event) => { if (event instanceof CustomEvent && event.detail === accountKey) notify(); };
    const onStorage = (event: StorageEvent) => { if (event.key === null || event.key === reviewLedgerStorageKey(accountKey)) notify(); };
    window.addEventListener(CHANGE_EVENT, onChange); window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener(CHANGE_EVENT, onChange); window.removeEventListener("storage", onStorage); };
  }, [accountKey]);
  const getSnapshot = useCallback(() => readReviewLedger(accountKey), [accountKey]);
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}
