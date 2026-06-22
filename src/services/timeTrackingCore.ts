/**
 * Pure, dependency-free core for app/study time tracking.
 *
 * Reliability model:
 * - Time is accumulated into per-local-day, per-activity millisecond buckets.
 * - Callers "fold" elapsed time into the buckets frequently (heartbeat). Each
 *   fold advances the clock mark, so a fold can never be applied twice and a
 *   process kill loses at most one heartbeat interval of time.
 * - Only one activity accrues at a time (top of the registration stack), so
 *   study totals never double count even when screens overlap.
 * - All storage writes go through the injected DayStore so the platform layer
 *   can persist synchronously (MMKV) and tests can use an in-memory map.
 */

export type ActivityKey =
  | "reviews"
  | "bunpro_reviews"
  | "lessons"
  | "bunpro_lessons"
  | "recent_lessons_review"
  | "custom_review"
  | "custom_lesson"
  | "test_session"
  | "meaning_reading"
  | "similar_kanji"
  | "kana_kanji"
  | "writing_practice"
  | "writing_freehand"
  | "context_sentence"
  | "listening_practice"
  | "crossword"
  | "wordle"
  | "news"
  | "songs"
  | "epub"
  | "video";

export type ActivityCategory =
  | "reviews"
  | "lessons"
  | "extra_study"
  | "news"
  | "songs"
  | "epub"
  | "video";

export const CATEGORY_BY_ACTIVITY: Record<ActivityKey, ActivityCategory> = {
  reviews: "reviews",
  bunpro_reviews: "reviews",
  lessons: "lessons",
  bunpro_lessons: "lessons",
  recent_lessons_review: "extra_study",
  custom_review: "extra_study",
  custom_lesson: "extra_study",
  test_session: "extra_study",
  meaning_reading: "extra_study",
  similar_kanji: "extra_study",
  kana_kanji: "extra_study",
  writing_practice: "extra_study",
  writing_freehand: "extra_study",
  context_sentence: "extra_study",
  listening_practice: "extra_study",
  crossword: "extra_study",
  wordle: "extra_study",
  news: "news",
  songs: "songs",
  epub: "epub",
  video: "video",
};

export const ACTIVITY_CATEGORIES: ActivityCategory[] = [
  "reviews",
  "lessons",
  "extra_study",
  "news",
  "songs",
  "epub",
  "video",
];

/** Reserved bucket key for total foreground time, kept out of study totals. */
export const APP_TOTAL_KEY = "app_total";

/** Milliseconds per bucket key (ActivityKey or APP_TOTAL_KEY). */
export type DayRecord = Record<string, number>;

export interface DayStore {
  getDay(dateKey: string): DayRecord | null;
  setDay(dateKey: string, record: DayRecord): void;
  getAllDayKeys(): string[];
}

/**
 * A single fold should never span more than this. Folds normally happen every
 * few seconds; a larger delta means a lifecycle event was missed (e.g. the OS
 * suspended us without notice), and counting it would inflate the totals.
 */
export const MAX_FOLD_DELTA_MS = 60_000;

export const HEARTBEAT_INTERVAL_MS = 5_000;

export function getLocalDateKey(timestampMs: number): string {
  const date = new Date(timestampMs);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nextLocalMidnightMs(timestampMs: number): number {
  const date = new Date(timestampMs);
  date.setHours(24, 0, 0, 0);
  return date.getTime();
}

export type SpanPart = { dateKey: string; ms: number };

/** Split a [start, end) span into parts per local calendar day. */
export function splitSpanByLocalDay(startMs: number, endMs: number): SpanPart[] {
  const parts: SpanPart[] = [];
  let cursor = startMs;

  // Bounded loop: spans are already capped by MAX_FOLD_DELTA_MS, but guard
  // against pathological input anyway.
  for (let i = 0; cursor < endMs && i < 400; i += 1) {
    const boundary = nextLocalMidnightMs(cursor);
    const partEnd = Math.min(boundary, endMs);
    const ms = partEnd - cursor;
    if (ms > 0) {
      parts.push({ dateKey: getLocalDateKey(cursor), ms });
    }
    cursor = partEnd;
  }

  return parts;
}

type Registration = {
  token: number;
  activity: ActivityKey;
};

export class TimeTrackingCore {
  private store: DayStore;
  private now: () => number;
  private registrations: Registration[] = [];
  private nextToken = 1;
  private foreground = false;
  /** Last fold point for the always-on app-total clock (null while paused). */
  private appMarkMs: number | null = null;
  /** Last fold point for the current activity clock (null while paused). */
  private activityMarkMs: number | null = null;
  private currentActivity: ActivityKey | null = null;

  constructor(store: DayStore, now: () => number = Date.now) {
    this.store = store;
    this.now = now;
  }

  getCurrentActivity(): ActivityKey | null {
    return this.currentActivity;
  }

  isForeground(): boolean {
    return this.foreground;
  }

  setForeground(isForeground: boolean): boolean {
    if (this.foreground === isForeground) {
      return false;
    }

    // Fold while the old marks are still valid, then move the marks.
    const changed = this.fold();
    this.foreground = isForeground;
    const timestamp = this.now();
    this.appMarkMs = isForeground ? timestamp : null;
    this.activityMarkMs =
      isForeground && this.currentActivity !== null ? timestamp : null;
    return changed;
  }

  begin(activity: ActivityKey): number {
    this.fold();
    const token = this.nextToken;
    this.nextToken += 1;
    this.registrations.push({ token, activity });
    this.refreshCurrentActivity();
    return token;
  }

  end(token: number): void {
    this.fold();
    this.registrations = this.registrations.filter(
      (registration) => registration.token !== token
    );
    this.refreshCurrentActivity();
  }

  /**
   * Add elapsed time since the last fold to the day buckets and advance the
   * marks. Returns true when any bucket changed.
   */
  fold(): boolean {
    if (!this.foreground) {
      return false;
    }

    const timestamp = this.now();
    let changed = false;

    if (this.appMarkMs !== null) {
      changed = this.addSpan(this.appMarkMs, timestamp, APP_TOTAL_KEY) || changed;
      this.appMarkMs = timestamp;
    }

    if (this.currentActivity !== null && this.activityMarkMs !== null) {
      changed =
        this.addSpan(this.activityMarkMs, timestamp, this.currentActivity) ||
        changed;
      this.activityMarkMs = timestamp;
    }

    return changed;
  }

  /**
   * Today's record including time elapsed since the last fold, without
   * writing anything. Safe to call from UI on a display timer.
   */
  getLiveDayRecord(dateKey: string): DayRecord {
    const record: DayRecord = { ...(this.store.getDay(dateKey) ?? {}) };

    if (!this.foreground) {
      return record;
    }

    const timestamp = this.now();
    const addLivePart = (startMs: number | null, key: string) => {
      if (startMs === null) {
        return;
      }
      for (const part of clampedSpanParts(startMs, timestamp)) {
        if (part.dateKey === dateKey) {
          record[key] = (record[key] ?? 0) + part.ms;
        }
      }
    };

    addLivePart(this.appMarkMs, APP_TOTAL_KEY);
    if (this.currentActivity !== null) {
      addLivePart(this.activityMarkMs, this.currentActivity);
    }

    return record;
  }

  private refreshCurrentActivity(): void {
    const top =
      this.registrations.length > 0
        ? this.registrations[this.registrations.length - 1].activity
        : null;

    if (top === this.currentActivity) {
      return;
    }

    this.currentActivity = top;
    this.activityMarkMs =
      this.foreground && top !== null ? this.now() : null;
  }

  private addSpan(startMs: number, endMs: number, key: string): boolean {
    const parts = clampedSpanParts(startMs, endMs);
    if (parts.length === 0) {
      return false;
    }

    for (const part of parts) {
      const record = this.store.getDay(part.dateKey) ?? {};
      record[key] = (record[key] ?? 0) + part.ms;
      this.store.setDay(part.dateKey, record);
    }

    return true;
  }
}

function clampedSpanParts(startMs: number, endMs: number): SpanPart[] {
  const delta = endMs - startMs;
  if (!Number.isFinite(delta) || delta <= 0) {
    return [];
  }

  // If a fold arrives implausibly late (missed lifecycle event, device clock
  // jump), only credit the most recent MAX_FOLD_DELTA_MS.
  const clampedStart = delta > MAX_FOLD_DELTA_MS ? endMs - MAX_FOLD_DELTA_MS : startMs;
  return splitSpanByLocalDay(clampedStart, endMs);
}

// ---------------------------------------------------------------------------
// Aggregation helpers (pure, used by the stats UI and the sync payloads)
// ---------------------------------------------------------------------------

export type RangeSummary = {
  /** Total study milliseconds (all tracked activities, app total excluded). */
  studyMs: number;
  appTotalMs: number;
  byCategory: Record<ActivityCategory, number>;
  byActivity: Partial<Record<ActivityKey, number>>;
  /** Days in the range with any study time. */
  activeDayCount: number;
};

export function emptyRangeSummary(): RangeSummary {
  const byCategory = {} as Record<ActivityCategory, number>;
  for (const category of ACTIVITY_CATEGORIES) {
    byCategory[category] = 0;
  }
  return {
    studyMs: 0,
    appTotalMs: 0,
    byCategory,
    byActivity: {},
    activeDayCount: 0,
  };
}

export function studyMsOfRecord(record: DayRecord): number {
  let total = 0;
  for (const [key, ms] of Object.entries(record)) {
    if (key in CATEGORY_BY_ACTIVITY && Number.isFinite(ms) && ms > 0) {
      total += ms;
    }
  }
  return total;
}

export function addRecordToSummary(summary: RangeSummary, record: DayRecord): void {
  let dayStudyMs = 0;

  for (const [key, ms] of Object.entries(record)) {
    if (!Number.isFinite(ms) || ms <= 0) {
      continue;
    }

    if (key === APP_TOTAL_KEY) {
      summary.appTotalMs += ms;
      continue;
    }

    const category = CATEGORY_BY_ACTIVITY[key as ActivityKey];
    if (!category) {
      continue;
    }

    summary.byCategory[category] += ms;
    summary.byActivity[key as ActivityKey] =
      (summary.byActivity[key as ActivityKey] ?? 0) + ms;
    dayStudyMs += ms;
  }

  summary.studyMs += dayStudyMs;
  if (dayStudyMs > 0) {
    summary.activeDayCount += 1;
  }
}

/** Inclusive [startKey, endKey] summary over stored days. */
export function summarizeRange(
  store: DayStore,
  startKey: string,
  endKey: string,
  liveRecordForDay?: { dateKey: string; record: DayRecord }
): RangeSummary {
  const summary = emptyRangeSummary();

  for (const dateKey of store.getAllDayKeys()) {
    if (dateKey < startKey || dateKey > endKey) {
      continue;
    }
    if (liveRecordForDay && dateKey === liveRecordForDay.dateKey) {
      continue;
    }
    const record = store.getDay(dateKey);
    if (record) {
      addRecordToSummary(summary, record);
    }
  }

  if (
    liveRecordForDay &&
    liveRecordForDay.dateKey >= startKey &&
    liveRecordForDay.dateKey <= endKey
  ) {
    addRecordToSummary(summary, liveRecordForDay.record);
  }

  return summary;
}
