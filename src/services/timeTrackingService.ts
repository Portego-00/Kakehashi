import { AppState, type AppStateStatus } from "react-native";
import { MMKV } from "react-native-mmkv";
import {
  HEARTBEAT_INTERVAL_MS,
  TimeTrackingCore,
  getLocalDateKey,
  studyMsOfRecord,
  summarizeRange,
  type ActivityKey,
  type DayRecord,
  type DayStore,
  type RangeSummary,
} from "./timeTrackingCore";

const DAY_KEY_PREFIX = "ttv1.day.";
const MAX_HISTORY_DAYS = 400;

// Dedicated instance so frequent small heartbeat writes never contend with the
// main app cache, and the data survives cache clears.
const timeTrackingStorage = new MMKV({ id: "kakehashi-time-tracking" });

class MmkvDayStore implements DayStore {
  private cache = new Map<string, DayRecord>();

  getDay(dateKey: string): DayRecord | null {
    const cached = this.cache.get(dateKey);
    if (cached) {
      return cached;
    }

    try {
      const raw = timeTrackingStorage.getString(DAY_KEY_PREFIX + dateKey);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as DayRecord;
      if (!parsed || typeof parsed !== "object") {
        return null;
      }
      this.cache.set(dateKey, parsed);
      return parsed;
    } catch {
      return null;
    }
  }

  setDay(dateKey: string, record: DayRecord): void {
    this.cache.set(dateKey, record);
    try {
      // Synchronous MMKV write: this is the crash-safety point. Once this
      // returns, the folded time is durable even if the process dies.
      timeTrackingStorage.set(DAY_KEY_PREFIX + dateKey, JSON.stringify(record));
    } catch (error) {
      console.error("Failed to persist time tracking day record:", error);
    }
  }

  getAllDayKeys(): string[] {
    try {
      return timeTrackingStorage
        .getAllKeys()
        .filter((key) => key.startsWith(DAY_KEY_PREFIX))
        .map((key) => key.slice(DAY_KEY_PREFIX.length))
        .sort();
    } catch {
      return [];
    }
  }

  deleteDay(dateKey: string): void {
    this.cache.delete(dateKey);
    try {
      timeTrackingStorage.delete(DAY_KEY_PREFIX + dateKey);
    } catch {
      // Pruning is best-effort.
    }
  }
}

class TimeTrackingService {
  private dayStore = new MmkvDayStore();
  private core = new TimeTrackingCore(this.dayStore);
  private initialized = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTickCount = 0;
  private onSyncOpportunity: (() => void) | null = null;

  /** Idempotent; called once from the root layout. */
  initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    this.core.setForeground(AppState.currentState === "active");
    this.updateHeartbeat();

    AppState.addEventListener("change", this.handleAppStateChange);

    this.pruneOldDays();
  }

  /**
   * The sync layer registers here so the tracker can ping it at good moments
   * (foreground transitions, periodic while active) without a circular import.
   */
  setOnSyncOpportunity(callback: (() => void) | null): void {
    this.onSyncOpportunity = callback;
  }

  begin(activity: ActivityKey): number {
    return this.core.begin(activity);
  }

  end(token: number): void {
    this.core.end(token);
  }

  /** Persist any unfolded elapsed time right now (used before sync reads). */
  foldNow(): void {
    this.core.fold();
  }

  getCurrentActivity(): ActivityKey | null {
    return this.core.getCurrentActivity();
  }

  getTodayDateKey(): string {
    return getLocalDateKey(Date.now());
  }

  /** Today's record including the still-running clocks; read-only. */
  getLiveToday(): DayRecord {
    return this.core.getLiveDayRecord(this.getTodayDateKey());
  }

  /** Inclusive range summary; today's live time is included when in range. */
  getSummaryBetween(startKey: string, endKey: string): RangeSummary {
    const todayKey = this.getTodayDateKey();
    return summarizeRange(this.dayStore, startKey, endKey, {
      dateKey: todayKey,
      record: this.core.getLiveDayRecord(todayKey),
    });
  }

  getAllTimeSummary(): { summary: RangeSummary; firstDayKey: string | null } {
    const keys = this.dayStore.getAllDayKeys();
    const todayKey = this.getTodayDateKey();
    const firstDayKey = keys.length > 0 ? keys[0] : todayKey;
    return {
      summary: this.getSummaryBetween(firstDayKey, todayKey),
      firstDayKey: keys.length > 0 ? keys[0] : null,
    };
  }

  /** Study totals for the last `dayCount` calendar days (today last, live). */
  getDailyStudySeries(dayCount: number): { dateKey: string; studyMs: number }[] {
    const series: { dateKey: string; studyMs: number }[] = [];
    const todayKey = this.getTodayDateKey();

    for (let offset = dayCount - 1; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      const dateKey = getLocalDateKey(date.getTime());
      const record =
        dateKey === todayKey
          ? this.core.getLiveDayRecord(dateKey)
          : this.dayStore.getDay(dateKey);
      series.push({ dateKey, studyMs: record ? studyMsOfRecord(record) : 0 });
    }

    return series;
  }

  /** Persisted (folded) records for the most recent days, oldest first. */
  getRecentDayRecords(dayCount: number): { dateKey: string; record: DayRecord }[] {
    const keys = this.dayStore.getAllDayKeys();
    return keys.slice(-dayCount).map((dateKey) => ({
      dateKey,
      record: this.dayStore.getDay(dateKey) ?? {},
    }));
  }

  private handleAppStateChange = (nextState: AppStateStatus) => {
    const isActive = nextState === "active";
    const wasForeground = this.core.isForeground();
    this.core.setForeground(isActive);
    this.updateHeartbeat();

    // Sync on both transitions: leaving the app captures the session that
    // just ended (best effort — the upsert is duplicate-safe so a dropped
    // request is harmless), returning retries anything that was missed.
    if (isActive !== wasForeground) {
      this.onSyncOpportunity?.();
    }
  };

  private updateHeartbeat(): void {
    const shouldRun = this.core.isForeground();

    if (shouldRun && this.heartbeatTimer === null) {
      this.heartbeatTimer = setInterval(() => {
        this.core.fold();
        this.heartbeatTickCount += 1;
        // Roughly every 5 minutes of active use.
        if (this.heartbeatTickCount % 60 === 0) {
          this.onSyncOpportunity?.();
        }
      }, HEARTBEAT_INTERVAL_MS);
    } else if (!shouldRun && this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private pruneOldDays(): void {
    try {
      const minDate = new Date();
      minDate.setDate(minDate.getDate() - MAX_HISTORY_DAYS);
      const minKey = getLocalDateKey(minDate.getTime());

      for (const dateKey of this.dayStore.getAllDayKeys()) {
        if (dateKey < minKey) {
          this.dayStore.deleteDay(dateKey);
        }
      }
    } catch {
      // Best-effort cleanup.
    }
  }
}

export const timeTrackingService = new TimeTrackingService();
export { timeTrackingStorage };
