import { describe, expect, it } from "vitest";
import {
  buildStudyTimeUpload,
  cacheRemoteStudyTimeDays,
  formatStudyTime,
  getStudyTimeDeviceId,
  markStudyTimeUploaded,
  readCombinedStudyTimeRange,
  readStudyTimeDay,
  readStudyTimeRange,
  recordForegroundTime,
  recordStudyTime,
  studyTimeCategoryForPathname,
  studyTimeStorageKey,
} from "./study-time";

const USER_ID = "wk-user-123";
const DEVICE_ID = "browser-device-123";

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

describe("browser study time", () => {
  it("tracks foreground seconds by study category", () => {
    const storage = memoryStorage();
    const date = new Date("2026-08-25T10:00:00");
    recordStudyTime(storage, USER_ID, DEVICE_ID, "reviews", 75, date);
    recordStudyTime(storage, USER_ID, DEVICE_ID, "news", 30, date);
    expect(readStudyTimeDay(storage, USER_ID, DEVICE_ID, date)).toMatchObject({ totalSeconds: 105, appTotalSeconds: 105, byCategory: { reviews: 75, news: 30 } });
  });

  it("tracks total foreground time without classifying non-study pages as study", () => {
    const storage = memoryStorage();
    const date = new Date("2026-08-25T10:00:00");
    recordForegroundTime(storage, USER_ID, DEVICE_ID, null, 45, date);
    recordForegroundTime(storage, USER_ID, DEVICE_ID, "lessons", 60, date);
    expect(readStudyTimeDay(storage, USER_ID, DEVICE_ID, date)).toMatchObject({ totalSeconds: 60, appTotalSeconds: 105, byCategory: { lessons: 60 } });
  });

  it("builds retry-safe absolute uploads and marks only successful versions", () => {
    const storage = memoryStorage();
    const date = new Date("2026-08-25T10:00:00");
    recordStudyTime(storage, USER_ID, DEVICE_ID, "reviews", 75, date);

    const first = buildStudyTimeUpload(storage, USER_ID, DEVICE_ID);
    expect(first.days).toHaveLength(1);
    expect(first.days[0]).toMatchObject({ day: "2026-08-25", appTotalSeconds: 75, byCategory: { reviews: 75 } });
    markStudyTimeUploaded(storage, USER_ID, DEVICE_ID, first.versions);
    expect(buildStudyTimeUpload(storage, USER_ID, DEVICE_ID).days).toEqual([]);

    recordStudyTime(storage, USER_ID, DEVICE_ID, "news", 30, date);
    expect(buildStudyTimeUpload(storage, USER_ID, DEVICE_ID).days[0]).toMatchObject({ appTotalSeconds: 105, byCategory: { reviews: 75, news: 30 } });
  });

  it("uses a new sync marker version so recent local days are re-uploaded as verified", () => {
    const storage = memoryStorage();
    const date = new Date("2026-08-25T10:00:00");
    recordStudyTime(storage, USER_ID, DEVICE_ID, "reviews", 75, date);
    storage.setItem("kakehashi-web:study-time-sync:tester:v1", JSON.stringify({ "2026-08-25": 150 }));

    expect(buildStudyTimeUpload(storage, USER_ID, DEVICE_ID).days).toHaveLength(1);
  });

  it("keeps a stable browser device identifier", () => {
    const storage = memoryStorage();
    expect(getStudyTimeDeviceId(storage, () => "browser-device-123")).toBe("browser-device-123");
    expect(getStudyTimeDeviceId(storage, () => "different-device-456")).toBe("browser-device-123");
  });

  it("maps only study surfaces and formats compact durations", () => {
    expect(studyTimeCategoryForPathname("/study/listening")).toBe("extra-study");
    expect(studyTimeCategoryForPathname("/dashboard")).toBeNull();
    expect(formatStudyTime(5_460)).toBe("1h 31m");
  });

  it("builds the mobile-style 14-bucket chart from persisted browser history", () => {
    const storage = memoryStorage();
    recordStudyTime(storage, USER_ID, DEVICE_ID, "reviews", 120, new Date("2026-08-24T12:00:00"));
    recordStudyTime(storage, USER_ID, DEVICE_ID, "lessons", 60, new Date("2026-08-25T12:00:00"));

    const range = readStudyTimeRange(storage, USER_ID, DEVICE_ID, "today", new Date("2026-08-25T18:00:00"));
    expect(range.series).toHaveLength(14);
    expect(range.series.at(-2)?.totalSeconds).toBe(120);
    expect(range.series.at(-1)?.totalSeconds).toBe(60);
    expect(range.summary.totalSeconds).toBe(60);
  });

  it("combines cached other-device totals with this browser without polluting local uploads", () => {
    const storage = memoryStorage();
    const deviceId = getStudyTimeDeviceId(storage, () => "browser-device-123");
    const date = new Date("2026-08-25T12:00:00");
    recordStudyTime(storage, USER_ID, deviceId, "reviews", 75, date);
    cacheRemoteStudyTimeDays(storage, USER_ID, deviceId, [{
      day: "2026-08-25",
      appTotalSeconds: 100,
      byCategory: { reviews: 25, lessons: 60 },
    }]);

    const combined = readCombinedStudyTimeRange(storage, USER_ID, deviceId, "today", date);

    expect(combined.summary).toMatchObject({
      totalSeconds: 160,
      appTotalSeconds: 175,
      byCategory: { reviews: 100, lessons: 60 },
    });
    expect(readStudyTimeDay(storage, USER_ID, deviceId, date)).toMatchObject({ totalSeconds: 75, byCategory: { reviews: 75 } });
    expect(buildStudyTimeUpload(storage, USER_ID, deviceId).days[0]).toMatchObject({ appTotalSeconds: 75, byCategory: { reviews: 75 } });
  });

  it("scopes offline remote history to both immutable user id and current browser device", () => {
    const storage = memoryStorage();
    cacheRemoteStudyTimeDays(storage, USER_ID, DEVICE_ID, [{
      day: "2026-08-25",
      appTotalSeconds: 60,
      byCategory: { lessons: 60 },
    }]);

    expect(readCombinedStudyTimeRange(storage, USER_ID, DEVICE_ID, "today", new Date("2026-08-25T12:00:00")).summary.totalSeconds).toBe(60);
    expect(readCombinedStudyTimeRange(storage, USER_ID, "different-device-456", "today", new Date("2026-08-25T12:00:00")).summary.totalSeconds).toBe(0);
    expect(readCombinedStudyTimeRange(storage, "different-user-456", DEVICE_ID, "today", new Date("2026-08-25T12:00:00")).summary.totalSeconds).toBe(0);
  });

  it("quarantines legacy username-only ledgers and starts empty after device-id regeneration", () => {
    const storage = memoryStorage();
    const date = new Date("2026-08-25T12:00:00");
    storage.setItem("kakehashi-web:study-time:tester:v1", JSON.stringify({
      version: 1,
      days: { "2026-08-25": { totalSeconds: 600, appTotalSeconds: 600, byCategory: { reviews: 600 } } },
    }));
    recordStudyTime(storage, USER_ID, DEVICE_ID, "reviews", 60, date);

    expect(readStudyTimeDay(storage, USER_ID, DEVICE_ID, date).totalSeconds).toBe(60);
    expect(readStudyTimeDay(storage, USER_ID, "replacement-device-456", date).totalSeconds).toBe(0);
    expect(storage.getItem(studyTimeStorageKey(USER_ID, "replacement-device-456"))).toBeNull();
  });

  it("rejects malformed, inconsistent, duplicate, or oversized remote history without replacing the cache", () => {
    const storage = memoryStorage();
    const valid = [{ day: "2026-08-25", appTotalSeconds: 60, byCategory: { lessons: 60 } }];
    expect(cacheRemoteStudyTimeDays(storage, USER_ID, DEVICE_ID, valid)).toBe(true);

    expect(cacheRemoteStudyTimeDays(storage, USER_ID, DEVICE_ID, [{
      day: "2026-08-25",
      appTotalSeconds: 59,
      byCategory: { lessons: 60 },
    }])).toBe(false);
    expect(cacheRemoteStudyTimeDays(storage, USER_ID, DEVICE_ID, [...valid, ...valid])).toBe(false);
    expect(cacheRemoteStudyTimeDays(storage, USER_ID, DEVICE_ID, Array.from({ length: 431 }, (_, index) => ({
      day: `2025-01-${String((index % 28) + 1).padStart(2, "0")}`,
      appTotalSeconds: 0,
      byCategory: {},
    })))).toBe(false);
    expect(readCombinedStudyTimeRange(storage, USER_ID, DEVICE_ID, "today", new Date("2026-08-25T12:00:00")).summary.totalSeconds).toBe(60);
  });

  it("accepts at most 100 aggregate device-days of remote seconds per calendar day", () => {
    const storage = memoryStorage();
    const maximum = 100 * 24 * 60 * 60;
    expect(cacheRemoteStudyTimeDays(storage, USER_ID, DEVICE_ID, [{
      day: "2026-08-25",
      appTotalSeconds: maximum,
      byCategory: { reviews: maximum },
    }])).toBe(true);
    expect(cacheRemoteStudyTimeDays(storage, USER_ID, DEVICE_ID, [{
      day: "2026-08-25",
      appTotalSeconds: maximum + 1,
      byCategory: { reviews: maximum },
    }])).toBe(false);
    expect(readCombinedStudyTimeRange(storage, USER_ID, DEVICE_ID, "today", new Date("2026-08-25T12:00:00")).summary.totalSeconds).toBe(maximum);
  });
});
