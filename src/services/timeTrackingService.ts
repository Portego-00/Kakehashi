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
  LEGACY_HISTORY_ASSIGNMENT_KEY,
  LEGACY_UNSCOPED_DAY_KEY_PREFIX,
  getUserDeviceDayKeyPrefix,
  isValidStudyTimeDeviceId,
  normalizeStudyTimeUserId,
  parseLegacyStudyTimeAssignment,
  type LegacyStudyTimeAssignment,
} from "./studyTimeStorageScope";

// Match the authenticated server/web window so rows excluded as "this device"
// never disappear locally before they age out of combined history.
const MAX_HISTORY_DAYS = 430;

// Dedicated instance so frequent small heartbeat writes never contend with the
// main app cache, and the data survives cache clears.
const timeTrackingStorage = new MMKV({ id: "kakehashi-time-tracking" });

export type LegacyHistoryRecoveryStatus = {
  state: "none" | "available" | "accepted";
  dayCount: number;
};

function parseStoredDay(raw: string | undefined): DayRecord | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as DayRecord)
      : null;
  } catch {
    return null;
  }
}

function mergeDayRecords(
  scoped: DayRecord | null,
  legacy: DayRecord | null,
): DayRecord | null {
  if (!scoped && !legacy) {
    return null;
  }

  const merged: DayRecord = {};
  for (const record of [legacy, scoped]) {
    if (!record) {
      continue;
    }
    for (const [key, value] of Object.entries(record)) {
      if (Number.isFinite(value) && value > 0) {
        merged[key] = (merged[key] ?? 0) + value;
      }
    }
  }
  return merged;
}

function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

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
  private legacyDaySnapshot: Map<string, DayRecord> | null = null;
  private legacyAssignmentCache:
    | LegacyStudyTimeAssignment
    | null
    | undefined = undefined;
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
    // v1 rows are immutable in this client. Refresh their snapshot only when
    // the authenticated scope changes, which also accommodates an older app
    // version having written more rows before this scope became active.
    this.legacyDaySnapshot = null;
    this.legacyAssignmentCache = undefined;
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
   * Reports unscoped v1 history only while it is still unclaimed or belongs
   * to this exact verified-user/device scope. Another login cannot inspect or
   * attach a claim that has already been accepted elsewhere.
   */
  getLegacyHistoryRecoveryStatus(
    userId: unknown,
    deviceId: string | null | undefined,
  ): LegacyHistoryRecoveryStatus {
    const normalizedUserId = normalizeStudyTimeUserId(userId);
    const normalizedDeviceId = deviceId?.trim() || null;
    if (
      !normalizedUserId ||
      !normalizedDeviceId ||
      !isValidStudyTimeDeviceId(normalizedDeviceId) ||
      !this.dayStore.isScopedTo(normalizedUserId, normalizedDeviceId)
    ) {
      return { state: "none", dayCount: 0 };
    }

    const assignment = this.readLegacyAssignment();
    if (
      assignment &&
      (assignment.userId !== normalizedUserId ||
        assignment.deviceId !== normalizedDeviceId)
    ) {
      return { state: "none", dayCount: 0 };
    }

    const dayCount = this.getLegacyDayKeys().length;
    if (dayCount === 0) {
      return { state: "none", dayCount: 0 };
    }
    return { state: assignment ? "accepted" : "available", dayCount };
  }

  /**
   * Persist explicit consent to attach the immutable v1 ledger to the current
   * authenticated scope. No v1 key is copied, changed, or deleted.
   */
  acceptLegacyHistoryForCurrentUser(
    userId: unknown,
    deviceId: string | null | undefined,
  ): boolean {
    const normalizedUserId = normalizeStudyTimeUserId(userId);
    const normalizedDeviceId = deviceId?.trim() || null;
    if (
      !normalizedUserId ||
      !normalizedDeviceId ||
      !isValidStudyTimeDeviceId(normalizedDeviceId) ||
      !this.dayStore.isScopedTo(normalizedUserId, normalizedDeviceId) ||
      this.getLegacyDayKeys().length === 0
    ) {
      return false;
    }

    const existing = this.readLegacyAssignment();
    if (existing) {
      return (
        existing.userId === normalizedUserId &&
        existing.deviceId === normalizedDeviceId
      );
    }

    const assignment: LegacyStudyTimeAssignment = {
      version: 1,
      userId: normalizedUserId,
      deviceId: normalizedDeviceId,
      acceptedAt: Date.now(),
    };
    try {
      timeTrackingStorage.set(
        LEGACY_HISTORY_ASSIGNMENT_KEY,
        JSON.stringify(assignment),
      );
      this.legacyAssignmentCache = assignment;
      return true;
    } catch {
      return false;
    }
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
    const todayKey = this.getTodayDateKey();
    return (
      mergeDayRecords(
        this.core.getLiveDayRecord(todayKey),
        this.getClaimedLegacyDay(todayKey),
      ) ?? {}
    );
  }

  /** Inclusive range summary; today's live time is included when in range. */
  getSummaryBetween(startKey: string, endKey: string): RangeSummary {
    const todayKey = this.getTodayDateKey();
    return summarizeRange(this.getCombinedDayStore(), startKey, endKey, {
      dateKey: todayKey,
      record:
        mergeDayRecords(
          this.core.getLiveDayRecord(todayKey),
          this.getClaimedLegacyDay(todayKey),
        ) ?? {},
    });
  }

  getAllTimeSummary(): { summary: RangeSummary; firstDayKey: string | null } {
    const keys = this.getCombinedDayKeys();
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
        ? this.getLiveToday()
        : this.getCombinedDay(dateKey);
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
          ? this.getLiveToday()
          : this.getCombinedDay(dateKey);
      series.push({ dateKey, studyMs: record ? studyMsOfRecord(record) : 0 });
    }

    return series;
  }

  /** Persisted (folded) records for the most recent days, oldest first. */
  getRecentDayRecords(dayCount: number): { dateKey: string; record: DayRecord }[] {
    const keys = this.getCombinedDayKeys();
    return keys.slice(-dayCount).map((dateKey) => ({
      dateKey,
      record: this.getCombinedDay(dateKey) ?? {},
    }));
  }

  /** Every local day still inside the 430-day cloud retention window. */
  getAllRetainedDayRecords(): { dateKey: string; record: DayRecord }[] {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - (MAX_HISTORY_DAYS - 1));
    const minKey = getLocalDateKey(minDate.getTime());
    const maxKey = this.getTodayDateKey();

    return this.getCombinedDayKeys()
      .filter((dateKey) => dateKey >= minKey && dateKey <= maxKey)
      .map((dateKey) => ({
        dateKey,
        record: this.getCombinedDay(dateKey) ?? {},
      }));
  }

  private readLegacyAssignment(): LegacyStudyTimeAssignment | null {
    if (this.legacyAssignmentCache !== undefined) {
      return this.legacyAssignmentCache;
    }
    try {
      const raw = timeTrackingStorage.getString(LEGACY_HISTORY_ASSIGNMENT_KEY);
      this.legacyAssignmentCache = raw
        ? parseLegacyStudyTimeAssignment(JSON.parse(raw))
        : null;
    } catch {
      this.legacyAssignmentCache = null;
    }
    return this.legacyAssignmentCache;
  }

  private isLegacyClaimedByCurrentScope(): boolean {
    const assignment = this.readLegacyAssignment();
    return Boolean(
      assignment &&
        this.dayStore.isScopedTo(assignment.userId, assignment.deviceId),
    );
  }

  private getLegacyDayKeys(): string[] {
    return [...this.getLegacyDaySnapshot().keys()];
  }

  private getLegacyDaySnapshot(): Map<string, DayRecord> {
    if (this.legacyDaySnapshot) {
      return this.legacyDaySnapshot;
    }

    const snapshot = new Map<string, DayRecord>();
    try {
      const dateKeys = timeTrackingStorage
        .getAllKeys()
        .filter((key) => key.startsWith(LEGACY_UNSCOPED_DAY_KEY_PREFIX))
        .map((key) => key.slice(LEGACY_UNSCOPED_DAY_KEY_PREFIX.length))
        .filter(isDateKey)
        .sort();
      for (const dateKey of dateKeys) {
        const record = parseStoredDay(
          timeTrackingStorage.getString(
            LEGACY_UNSCOPED_DAY_KEY_PREFIX + dateKey,
          ),
        );
        if (record) {
          snapshot.set(dateKey, record);
        }
      }
    } catch {
      // Keep the empty snapshot for this scope; a later scope handoff retries.
    }
    this.legacyDaySnapshot = snapshot;
    return snapshot;
  }

  private getClaimedLegacyDay(dateKey: string): DayRecord | null {
    if (!this.isLegacyClaimedByCurrentScope()) {
      return null;
    }
    return this.getLegacyDaySnapshot().get(dateKey) ?? null;
  }

  private getCombinedDay(dateKey: string): DayRecord | null {
    return mergeDayRecords(
      this.dayStore.getDay(dateKey),
      this.getClaimedLegacyDay(dateKey),
    );
  }

  private getCombinedDayKeys(): string[] {
    const keys = new Set(this.dayStore.getAllDayKeys());
    if (this.isLegacyClaimedByCurrentScope()) {
      for (const dateKey of this.getLegacyDayKeys()) {
        keys.add(dateKey);
      }
    }
    return [...keys].sort();
  }

  private getCombinedDayStore(): DayStore {
    return {
      getDay: (dateKey) => this.getCombinedDay(dateKey),
      setDay: () => {
        throw new Error("Combined study-time history is read-only");
      },
      getAllDayKeys: () => this.getCombinedDayKeys(),
    };
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
