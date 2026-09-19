"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { Assignment } from "@/types/wanikani";
import { calculateSrsBreakdown, type SrsBucket } from "./calculations";
import { analyticsDayKey } from "./analytics-insights";

const STORAGE_PREFIX = "kakehashi:analytics:srs-history:v1:";
const CHANGE_EVENT = "kakehashi:analytics:srs-history-change";
export const MAX_SRS_BACKUP_BYTES = 512_000;
const BUCKETS: SrsBucket[] = ["Locked", "Apprentice", "Guru", "Master", "Enlightened", "Burned"];

export interface SrsSnapshot { date: string; stages: Record<SrsBucket, number> }
export interface SrsSnapshotBackup { version: 1; accountKey: string; snapshots: SrsSnapshot[] }
export interface SrsSnapshotState { snapshots: SrsSnapshot[]; persistence: "device" | "memory"; error: string | null }
const EMPTY: SrsSnapshotState = { snapshots: [], persistence: "device", error: null };
const cache = new Map<string, { raw: string | null; state: SrsSnapshotState }>();

export function srsSnapshotStorageKey(accountKey: string) { return `${STORAGE_PREFIX}${encodeURIComponent(accountKey)}`; }

function isObject(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function exactKeys(value: Record<string, unknown>, keys: string[]) { return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)); }

export function parseSrsSnapshotBackup(text: string, accountKey: string, now = new Date()): SrsSnapshotBackup {
  if (new Blob([text]).size > MAX_SRS_BACKUP_BYTES) throw new Error("The snapshot backup is too large (maximum 500 KB).");
  let input: unknown;
  try { input = JSON.parse(text); } catch { throw new Error("Choose a valid JSON snapshot backup."); }
  if (!isObject(input) || !exactKeys(input, ["version", "accountKey", "snapshots"]) || input.version !== 1 || typeof input.accountKey !== "string" || !Array.isArray(input.snapshots)) throw new Error("This file is not a Kakehashi SRS snapshot backup.");
  if (input.accountKey !== accountKey) throw new Error("This snapshot backup belongs to a different account.");
  if (input.snapshots.length > 365) throw new Error("A snapshot backup may contain at most 365 daily records.");
  const today = analyticsDayKey(now);
  const seen = new Set<string>();
  const snapshots = input.snapshots.map((entry): SrsSnapshot => {
    if (!isObject(entry) || !exactKeys(entry, ["date", "stages"]) || typeof entry.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || !isObject(entry.stages) || !exactKeys(entry.stages, BUCKETS)) throw new Error("The backup contains an invalid daily snapshot.");
    const parsed = new Date(`${entry.date}T00:00:00.000Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== entry.date || entry.date > today || seen.has(entry.date)) throw new Error("The backup contains duplicate, invalid, or future dates.");
    const stages = {} as Record<SrsBucket, number>;
    for (const bucket of BUCKETS) {
      const count = entry.stages[bucket];
      if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0 || count > 100_000) throw new Error("Snapshot counts must be whole numbers between 0 and 100,000.");
      stages[bucket] = count;
    }
    seen.add(entry.date);
    return { date: entry.date, stages };
  });
  return { version: 1, accountKey, snapshots: snapshots.sort((a, b) => a.date.localeCompare(b.date)) };
}

export function mergeSrsSnapshots(existing: SrsSnapshot[], incoming: SrsSnapshot[], now = new Date()): SrsSnapshot[] {
  const first = new Date(now); first.setDate(first.getDate() - 364);
  const minimumDate = analyticsDayKey(first); const maximumDate = analyticsDayKey(now);
  const records = new Map(existing.map((snapshot) => [snapshot.date, snapshot]));
  for (const snapshot of incoming) records.set(snapshot.date, snapshot);
  return [...records.values()].filter((snapshot) => snapshot.date >= minimumDate && snapshot.date <= maximumDate).sort((a, b) => a.date.localeCompare(b.date));
}

export function readSrsSnapshots(accountKey: string): SrsSnapshotState {
  if (!accountKey || typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(srsSnapshotStorageKey(accountKey));
    const previous = cache.get(accountKey);
    if (previous?.raw === raw) return previous.state;
    const snapshots = raw ? parseSrsSnapshotBackup(raw, accountKey).snapshots : [];
    const state: SrsSnapshotState = { snapshots, persistence: "device", error: null };
    cache.set(accountKey, { raw, state });
    return state;
  } catch (error) {
    const previous = cache.get(accountKey);
    if (previous?.state.persistence === "memory") return previous.state;
    const state: SrsSnapshotState = { snapshots: previous?.state.snapshots ?? [], persistence: "memory", error: error instanceof Error ? error.message : "Snapshots are available for this visit only." };
    cache.set(accountKey, { raw: null, state });
    return state;
  }
}

function saveSrsSnapshots(accountKey: string, snapshots: SrsSnapshot[]): SrsSnapshotState {
  const raw = JSON.stringify({ version: 1, accountKey, snapshots } satisfies SrsSnapshotBackup);
  const previousRaw = cache.get(accountKey)?.raw ?? null;
  let state: SrsSnapshotState = { snapshots, persistence: "device", error: null };
  try { window.localStorage.setItem(srsSnapshotStorageKey(accountKey), raw); }
  catch { state = { snapshots, persistence: "memory", error: "Browser storage is unavailable. Snapshots will last for this visit only." }; }
  cache.set(accountKey, { raw: state.persistence === "device" ? raw : previousRaw, state });
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: accountKey }));
  return state;
}

export function recordSrsSnapshot(accountKey: string, assignments: Assignment[], now = new Date()): SrsSnapshotState {
  if (!accountKey || typeof window === "undefined") return EMPTY;
  const existing = readSrsSnapshots(accountKey);
  const today = { date: analyticsDayKey(now), stages: calculateSrsBreakdown(assignments) };
  const snapshots = mergeSrsSnapshots(existing.snapshots, [today], now);
  if (JSON.stringify(existing.snapshots) === JSON.stringify(snapshots)) return existing;
  return saveSrsSnapshots(accountKey, snapshots);
}

export function importSrsSnapshots(text: string, accountKey: string, now = new Date()): SrsSnapshotState {
  const incoming = parseSrsSnapshotBackup(text, accountKey, now);
  const existing = readSrsSnapshots(accountKey);
  // The current device's observations take precedence for duplicate dates.
  return saveSrsSnapshots(accountKey, mergeSrsSnapshots(incoming.snapshots, existing.snapshots, now));
}

export function exportSrsSnapshots(accountKey: string): string {
  return JSON.stringify({ version: 1, accountKey, snapshots: readSrsSnapshots(accountKey).snapshots } satisfies SrsSnapshotBackup, null, 2);
}

export function useSrsSnapshots(accountKey: string, assignments: Assignment[], enabled = true) {
  const subscribe = useCallback((notify: () => void) => {
    const onChange = (event: Event) => { if (event instanceof CustomEvent && event.detail === accountKey) notify(); };
    const onStorage = (event: StorageEvent) => { if (event.key === null || event.key === srsSnapshotStorageKey(accountKey)) notify(); };
    window.addEventListener(CHANGE_EVENT, onChange); window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener(CHANGE_EVENT, onChange); window.removeEventListener("storage", onStorage); };
  }, [accountKey]);
  const getSnapshot = useCallback(() => readSrsSnapshots(accountKey), [accountKey]);
  const state = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  useEffect(() => {
    if (!enabled || !accountKey) return;
    recordSrsSnapshot(accountKey, assignments);
    const onFocus = () => recordSrsSnapshot(accountKey, assignments);
    let timer: ReturnType<typeof setTimeout>;
    const scheduleNextDay = () => {
      const nextDay = new Date(); nextDay.setDate(nextDay.getDate() + 1); nextDay.setHours(0, 0, 0, 100);
      timer = setTimeout(() => { recordSrsSnapshot(accountKey, assignments); scheduleNextDay(); }, Math.max(100, nextDay.getTime() - Date.now()));
    };
    scheduleNextDay();
    window.addEventListener("focus", onFocus);
    return () => { window.removeEventListener("focus", onFocus); clearTimeout(timer); };
  }, [accountKey, assignments, enabled]);
  return { ...state, importBackup: (text: string) => importSrsSnapshots(text, accountKey), exportBackup: () => exportSrsSnapshots(accountKey) };
}
