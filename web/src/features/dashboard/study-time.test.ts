import { describe, expect, it } from "vitest";
import {
  buildStudyTimeUpload,
  formatStudyTime,
  getStudyTimeDeviceId,
  markStudyTimeUploaded,
  readStudyTimeDay,
  readStudyTimeRange,
  recordForegroundTime,
  recordStudyTime,
  studyTimeCategoryForPathname,
} from "./study-time";

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

describe("browser study time", () => {
  it("tracks foreground seconds by study category", () => {
    const storage = memoryStorage();
    const date = new Date("2026-08-25T10:00:00");
    recordStudyTime(storage, "Tester", "reviews", 75, date);
    recordStudyTime(storage, "Tester", "news", 30, date);
    expect(readStudyTimeDay(storage, "Tester", date)).toMatchObject({ totalSeconds: 105, appTotalSeconds: 105, byCategory: { reviews: 75, news: 30 } });
  });

  it("tracks total foreground time without classifying non-study pages as study", () => {
    const storage = memoryStorage();
    const date = new Date("2026-08-25T10:00:00");
    recordForegroundTime(storage, "Tester", null, 45, date);
    recordForegroundTime(storage, "Tester", "lessons", 60, date);
    expect(readStudyTimeDay(storage, "Tester", date)).toMatchObject({ totalSeconds: 60, appTotalSeconds: 105, byCategory: { lessons: 60 } });
  });

  it("builds retry-safe absolute uploads and marks only successful versions", () => {
    const storage = memoryStorage();
    const date = new Date("2026-08-25T10:00:00");
    recordStudyTime(storage, "Tester", "reviews", 75, date);

    const first = buildStudyTimeUpload(storage, "Tester");
    expect(first.days).toHaveLength(1);
    expect(first.days[0]).toMatchObject({ day: "2026-08-25", appTotalSeconds: 75, byCategory: { reviews: 75 } });
    markStudyTimeUploaded(storage, "Tester", first.versions);
    expect(buildStudyTimeUpload(storage, "Tester").days).toEqual([]);

    recordStudyTime(storage, "Tester", "news", 30, date);
    expect(buildStudyTimeUpload(storage, "Tester").days[0]).toMatchObject({ appTotalSeconds: 105, byCategory: { reviews: 75, news: 30 } });
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
    recordStudyTime(storage, "alice", "reviews", 120, new Date("2026-08-24T12:00:00"));
    recordStudyTime(storage, "alice", "lessons", 60, new Date("2026-08-25T12:00:00"));

    const range = readStudyTimeRange(storage, "alice", "today", new Date("2026-08-25T18:00:00"));
    expect(range.series).toHaveLength(14);
    expect(range.series.at(-2)?.totalSeconds).toBe(120);
    expect(range.series.at(-1)?.totalSeconds).toBe(60);
    expect(range.summary.totalSeconds).toBe(60);
  });
});
