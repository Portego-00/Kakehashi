import type { Assignment, Subject } from "@/types/wanikani";
import type { AnalyticsInsights } from "./analytics-insights";
import type { AnalyticsShareOptions } from "./analytics-export";

export const PUBLIC_SNAPSHOT_STAGES = ["Apprentice", "Guru", "Master", "Enlightened", "Burned"] as const;
export const MAX_PUBLIC_SNAPSHOT_LENGTH = 4096;
const MAX_SUBJECTS = 100_000;
const DAY = 86_400_000;

export type PublicAnalyticsSnapshot = {
  version: 1;
  username?: string;
  level: number;
  accuracy: number | null;
  learnedGuruKanji: number;
  burned: number;
  srs: Record<(typeof PUBLIC_SNAPSHOT_STAGES)[number], number>;
  capturedAt: string;
  daysStudying?: number;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isCount(value: unknown, maximum = MAX_SUBJECTS): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

function validateSnapshot(value: unknown): value is PublicAnalyticsSnapshot {
  if (!isObject(value) || value.version !== 1) return false;
  const allowed = new Set(["version", "username", "level", "accuracy", "learnedGuruKanji", "burned", "srs", "capturedAt", "daysStudying"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) return false;
  if (!isCount(value.level, 60) || value.level < 1 || !isCount(value.learnedGuruKanji) || !isCount(value.burned)) return false;
  if (value.accuracy !== null && (typeof value.accuracy !== "number" || !Number.isFinite(value.accuracy) || value.accuracy < 0 || value.accuracy > 100)) return false;
  if ("username" in value && (typeof value.username !== "string" || !value.username.trim() || value.username.length > 80 || /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(value.username))) return false;
  if ("daysStudying" in value && !isCount(value.daysStudying, 365_250)) return false;
  if (typeof value.capturedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.capturedAt)) return false;
  const timestamp = Date.parse(value.capturedAt);
  if (!Number.isFinite(timestamp) || timestamp < Date.UTC(2000, 0, 1) || timestamp > Date.UTC(2100, 0, 1) || new Date(timestamp).toISOString() !== value.capturedAt) return false;
  const srs = value.srs;
  if (!isObject(srs) || Object.keys(srs).length !== PUBLIC_SNAPSHOT_STAGES.length || !PUBLIC_SNAPSHOT_STAGES.every((stage) => isCount(srs[stage]))) return false;
  const total = PUBLIC_SNAPSHOT_STAGES.reduce((sum, stage) => sum + Number(srs[stage]), 0);
  return total <= MAX_SUBJECTS && value.burned === srs.Burned && value.learnedGuruKanji <= total - Number(srs.Apprentice);
}

export function createPublicAnalyticsSnapshot(insights: AnalyticsInsights, options: AnalyticsShareOptions, subjects: Subject[], assignments: Assignment[], capturedAt = new Date()): PublicAnalyticsSnapshot {
  const visibleKanji = new Set(subjects.filter((subject) => subject.object === "kanji" && !subject.data.hidden_at).map((subject) => subject.id));
  const learnedGuruKanji = new Set(assignments.filter((assignment) => !assignment.data.hidden && assignment.data.srs_stage >= 5 && visibleKanji.has(assignment.data.subject_id)).map((assignment) => assignment.data.subject_id)).size;
  const srs = Object.fromEntries(PUBLIC_SNAPSHOT_STAGES.map((stage) => [stage, insights.srsByType.reduce((sum, row) => sum + row.stages[stage], 0)])) as PublicAnalyticsSnapshot["srs"];
  const startedAt = Date.parse(options.startedAt);
  const snapshot: PublicAnalyticsSnapshot = {
    version: 1,
    ...(!options.hideUsername && options.username.trim() ? { username: options.username.trim() } : {}),
    level: options.level,
    accuracy: insights.lifetimeAccuracy.percentage,
    learnedGuruKanji,
    burned: srs.Burned,
    srs,
    capturedAt: capturedAt.toISOString(),
    ...(!options.hideDays && Number.isFinite(startedAt) ? { daysStudying: Math.max(0, Math.floor((capturedAt.getTime() - startedAt) / DAY)) } : {}),
  };
  if (!validateSnapshot(snapshot)) throw new Error("These statistics cannot be included in a public snapshot.");
  return snapshot;
}

export function encodePublicAnalyticsSnapshot(snapshot: PublicAnalyticsSnapshot): string {
  if (!validateSnapshot(snapshot)) throw new Error("This progress snapshot is invalid.");
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
  const encoded = btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join("")).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  if (encoded.length > MAX_PUBLIC_SNAPSHOT_LENGTH) throw new Error("This progress snapshot is too large to share.");
  return encoded;
}

export function parsePublicAnalyticsSnapshot(fragment: unknown): PublicAnalyticsSnapshot | null {
  if (typeof fragment !== "string" || fragment.length > MAX_PUBLIC_SNAPSHOT_LENGTH + 10) return null;
  const encoded = fragment.replace(/^#/, "").replace(/^snapshot=/, "");
  if (!encoded.length || encoded.length > MAX_PUBLIC_SNAPSHOT_LENGTH || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
  try {
    const base64 = encoded.replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return validateSnapshot(value) ? value : null;
  } catch {
    return null;
  }
}

export function createPublicAnalyticsSnapshotUrl(snapshot: PublicAnalyticsSnapshot, origin: string): string {
  const url = new URL("/shared-progress", origin);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("A public snapshot requires an HTTP or HTTPS origin.");
  url.hash = `snapshot=${encodePublicAnalyticsSnapshot(snapshot)}`;
  return url.toString();
}
