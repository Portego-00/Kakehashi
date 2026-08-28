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
import {
  getUserDeviceDayKeyPrefix,
  normalizeStudyTimeUserId,
} from "./studyTimeStorageScope";

// Match the authenticated server/web window so rows excluded as "this device"
// never disappear locally before they age out of combined history.
const MAX_HISTORY_DAYS = 430;

// Dedicated instance so frequent small heartbeat writes never contend with the
// main app cache, and the data survives cache clears.
const timeTrackingStorage = new MMKV({ id: "kakehashi-time-tracking" });

class MmkvDayStore implements DayStore {
  private cache = new Map<string, DayRecord>();
  private userId: string | null = null;
  private deviceId: string | null = null;

  setUserDeviceScope(userId: string | null, deviceId: string | null): void {
    if (this.userId === userId && this.deviceId === deviceId) {
      return;
    }
    this.cache.clear();
    this.userId = userId;
    this.deviceId = deviceId;
  }

  isScopedTo(userId: string | null, deviceId: string | null): boolean {
    return this.userId === userId && this.deviceId === deviceId;
  }

  private getDayKeyPrefix(): string | null {
    return this.userId && this.deviceId
      ? getUserDeviceDayKeyPrefix(this.userId, this.deviceId)
      : null;
  }

  getDay(dateKey: string): DayRecord | null {
    const dayKeyPrefix = this.getDayKeyPrefix();
    if (!dayKeyPrefix) {
      return null;
    }
    const cached = this.cache.get(dateKey);
    if (cached) {
      return cached;
    }

    try {
      const raw = timeTrackingStorage.getString(dayKeyPrefix + dateKey);
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
    const dayKeyPrefix = this.getDayKeyPrefix();
    if (!dayKeyPrefix) {
      return;
    }
    this.cache.set(dateKey, record);
    try {
      // Synchronous MMKV write: this is the crash-safety point. Once this
      // returns, the folded time is durable even if the process dies.
      timeTrackingStorage.set(dayKeyPrefix + dateKey, JSON.stringify(record));
    } catch (error) {
      console.error("Failed to persist time tracking day record:", error);
    }
  }

  getAllDayKeys(): string[] {
    const dayKeyPrefix = this.getDayKeyPrefix();
    if (!dayKeyPrefix) {
      return [];
    }
    try {
      return timeTrackingStorage
        .getAllKeys()
        .filter((key) => key.startsWith(dayKeyPrefix))
        .map((key) => key.slice(dayKeyPrefix.length))
        .sort();
    } catch {
      return [];
    }
  }

  deleteDay(dateKey: string): void {
    const dayKeyPrefix = this.getDayKeyPrefix();
    if (!dayKeyPrefix) {
      return;
    }
    this.cache.delete(dateKey);
    try {
      timeTrackingStorage.delete(dayKeyPrefix + dateKey);
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
   * Select the verified WaniKani user and current device for all local reads
   * and writes. Legacy `ttv1.day.*` records intentionally remain quarantined:
   * they carry no owner metadata, so assigning them to the next login could
   * leak another account.
   */
  setUserDeviceScope(
    userId: unknown,
    deviceId: string | null,
  ): void {
    const normalizedUserId = normalizeStudyTimeUserId(userId);
    const normalizedDeviceId = deviceId?.trim() || null;
    if (this.dayStore.isScopedTo(normalizedUserId, normalizedDeviceId)) {
      return;
    }

    const wasForeground = this.core.isForeground();
    if (wasForeground) {
      // Fold the final span into the old owner before changing the store.
      this.core.setForeground(false);
    }
    this.core.clearActivityRegistrations();
    this.dayStore.setUserDeviceScope(normalizedUserId, normalizedDeviceId);
    if (wasForeground) {
      this.core.setForeground(true);
    }
    this.pruneOldDays();
  }

  isScopedToUserDevice(
    userId: unknown,
    deviceId: string | null | undefined,
  ): boolean {
    const normalizedUserId = normalizeStudyTimeUserId(userId);
    const normalizedDeviceId = deviceId?.trim() || null;
    return Boolean(normalizedUserId && normalizedDeviceId) &&
      this.dayStore.isScopedTo(normalizedUserId, normalizedDeviceId);
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

  /** Whether a local day has study activity, including today's live clock. */
  hasStudyOnDay(dateKey: string): boolean {
    const record =
      dateKey === this.getTodayDateKey()
        ? this.core.getLiveDayRecord(dateKey)
        : this.dayStore.getDay(dateKey);
    return record ? studyMsOfRecord(record) > 0 : false;
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
      minDate.setDate(minDate.getDate() - (MAX_HISTORY_DAYS - 1));
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
