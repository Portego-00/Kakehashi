import {
  MAX_AGGREGATE_MS_PER_DAY,
  createStudyTimeHistoryCache,
  mergeOtherDeviceDaysIntoSummary,
  parseStudyTimeHistoryCache,
  parseStudyTimeHistoryResponse,
  type OtherDeviceStudyTimeDay,
} from "../studyTimeHistoryCore";
import {
  ACTIVITY_CATEGORIES,
  emptyRangeSummary,
  type ActivityCategory,
} from "../timeTrackingCore";

function categories(
  values: Partial<Record<ActivityCategory, number>> = {},
): Record<ActivityCategory, number> {
  return Object.fromEntries(
    ACTIVITY_CATEGORIES.map((category) => [category, values[category] ?? 0]),
  ) as Record<ActivityCategory, number>;
}

function otherDay(
  day: string,
  values: Partial<Record<ActivityCategory, number>>,
  appTotalMs: number,
): OtherDeviceStudyTimeDay {
  return { day, byCategoryMs: categories(values), appTotalMs };
}

describe("study time history validation", () => {
  it("validates every category and sorts days", () => {
    const parsed = parseStudyTimeHistoryResponse({
      days: [
        otherDay("2026-08-26", { lessons: 2_000 }, 3_000),
        otherDay("2026-08-25", { reviews: 1_000 }, 1_500),
      ],
    });

    expect(parsed.days.map((day) => day.day)).toEqual([
      "2026-08-25",
      "2026-08-26",
    ]);
  });

  it.each([
    { days: "not-an-array" },
    { days: [{ day: "2026-02-30", appTotalMs: 1, byCategoryMs: categories() }] },
    {
      days: [
        otherDay("2026-08-26", { reviews: 1 }, 1),
        otherDay("2026-08-26", { lessons: 1 }, 1),
      ],
    },
    { days: [otherDay("2026-08-26", { reviews: -1 }, 1)] },
    {
      days: [
        otherDay(
          "2026-08-26",
          { reviews: MAX_AGGREGATE_MS_PER_DAY + 1 },
          MAX_AGGREGATE_MS_PER_DAY + 1,
        ),
      ],
    },
    { days: [otherDay("2026-08-26", { reviews: 2_000 }, 1_000)] },
  ])("rejects malformed or unreasonable payloads", (payload) => {
    expect(() => parseStudyTimeHistoryResponse(payload)).toThrow();
  });

  it("allows more than 24 hours when several other devices are aggregated", () => {
    const twoDaysMs = 48 * 60 * 60 * 1000;
    expect(
      parseStudyTimeHistoryResponse({
        days: [otherDay("2026-08-26", { reviews: twoDaysMs }, twoDaysMs)],
      }).days[0].appTotalMs,
    ).toBe(twoDaysMs);
  });

  it("accepts the timezone-safe history union and rejects anything larger", () => {
    const start = new Date("2025-01-01T00:00:00.000Z");
    const days = Array.from({ length: 433 }, (_, index) => {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + index);
      return otherDay(date.toISOString().slice(0, 10), {}, 0);
    });

    expect(parseStudyTimeHistoryResponse({ days: days.slice(0, 432) }).days)
      .toHaveLength(432);
    expect(() => parseStudyTimeHistoryResponse({ days })).toThrow();
  });
});

describe("study time history cache", () => {
  const cache = createStudyTimeHistoryCache(
    "verified-user-a",
    "current-device-a",
    [otherDay("2026-08-26", { reviews: 1_000 }, 1_500)],
    123_456,
  );

  it("hydrates only for the same verified user and current device", () => {
    expect(
      parseStudyTimeHistoryCache(
        cache,
        "verified-user-a",
        "current-device-a",
      ),
    ).toEqual(cache);
    expect(
      parseStudyTimeHistoryCache(
        cache,
        "verified-user-b",
        "current-device-a",
      ),
    ).toBeNull();
    expect(
      parseStudyTimeHistoryCache(
        cache,
        "verified-user-a",
        "current-device-b",
      ),
    ).toBeNull();
  });

  it("rejects a corrupted cached payload", () => {
    expect(
      parseStudyTimeHistoryCache(
        { ...cache, days: [{ ...cache.days[0], appTotalMs: -1 }] },
        "verified-user-a",
        "current-device-a",
      ),
    ).toBeNull();
  });
});

describe("combined study time merge", () => {
  it("adds other-device duration without double-counting an active calendar day", () => {
    const local = emptyRangeSummary();
    local.studyMs = 10_000;
    local.appTotalMs = 15_000;
    local.byCategory.reviews = 10_000;
    local.byActivity.reviews = 10_000;
    local.activeDayCount = 1;

    const merged = mergeOtherDeviceDaysIntoSummary(
      local,
      [
        otherDay("2026-08-25", { lessons: 5_000 }, 7_000),
        otherDay("2026-08-26", { news: 3_000 }, 4_000),
      ],
      "2026-08-25",
      "2026-08-26",
      (day) => day === "2026-08-25",
    );

    expect(merged.studyMs).toBe(18_000);
    expect(merged.appTotalMs).toBe(26_000);
    expect(merged.byCategory.reviews).toBe(10_000);
    expect(merged.byCategory.lessons).toBe(5_000);
    expect(merged.byCategory.news).toBe(3_000);
    expect(merged.byActivity.reviews).toBe(10_000);
    expect(merged.activeDayCount).toBe(2);
    expect(local.studyMs).toBe(10_000);
  });

  it("ignores cached other-device days outside the requested range", () => {
    const local = emptyRangeSummary();
    const merged = mergeOtherDeviceDaysIntoSummary(
      local,
      [otherDay("2026-08-24", { reviews: 5_000 }, 6_000)],
      "2026-08-25",
      "2026-08-26",
      () => false,
    );

    expect(merged).toEqual(local);
  });
});
