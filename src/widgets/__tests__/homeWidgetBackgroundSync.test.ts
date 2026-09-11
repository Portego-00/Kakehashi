import {
  normalizeStreakSnapshotForUpdate,
  persistWidgetSnapshot,
  resolveBackgroundReviewSchedule,
  resolveProjectedReviewTotalForLocalDay,
  selectWidgetTimelineTimestamps,
} from "../homeWidgetBackgroundSync";

describe("home widget background review sync", () => {
  const existingSchedule = {
    nextReviewDate: "2026-09-10T09:00:00.000Z",
    reviewUpcomingBuckets: [
      { date: "2026-09-10T09:00:00.000Z", count: 7 },
    ],
  };

  it("clears stale upcoming reviews after an authoritative empty refresh", () => {
    expect(
      resolveBackgroundReviewSchedule(
        existingSchedule,
        {
          currentReviews: 0,
          upcomingReviews: [],
          upcomingReviewTimes: {},
        },
        new Date("2026-09-10T08:00:00.000Z"),
      ),
    ).toEqual({
      nextReviewDate: null,
      reviewUpcomingBuckets: [],
    });
  });

  it("preserves the schedule when a partial refresh did not fetch upcoming data", () => {
    expect(
      resolveBackgroundReviewSchedule(
        existingSchedule,
        { currentReviews: 3 },
        new Date("2026-09-10T08:00:00.000Z"),
      ),
    ).toEqual(existingSchedule);
  });

  it("drops the previous day's total after local midnight", () => {
    expect(
      resolveProjectedReviewTotalForLocalDay({
        baselineDate: new Date(2026, 8, 10, 23, 55),
        referenceDate: new Date(2026, 8, 11, 0, 0),
        currentReviews: 2,
        baselineTodayTotal: 80,
        upcomingBuckets: [
          { date: new Date(2026, 8, 10, 23, 0).toISOString(), count: 80 },
          { date: new Date(2026, 8, 11, 9, 0).toISOString(), count: 5 },
        ],
      }),
    ).toBe(5);
  });

  it("keeps today inactive when a background refresh runs after midnight", () => {
    const snapshot = {
      contentMode: "streak",
      streakTimezone: "UTC",
      currentStreak: 4,
      streakRecentDays: [
        {
          dayKey: "2026-09-09",
          label: "W",
          active: true,
          isToday: true,
        },
      ],
    };

    const updated = normalizeStreakSnapshotForUpdate(snapshot, {
      now: new Date("2026-09-10T00:01:00.000Z"),
      recordAppActivity: false,
    });

    expect(updated.streakRecentDays.at(-1)).toMatchObject({
      dayKey: "2026-09-10",
      active: false,
      isToday: true,
    });
    expect(
      updated.streakRecentDays.find((day) => day.dayKey === "2026-09-09"),
    ).toMatchObject({ active: true, isToday: false });
  });

  it("still records today when the foreground app updates the widget", () => {
    const updated = normalizeStreakSnapshotForUpdate(
      {
        contentMode: "streak",
        streakTimezone: "UTC",
        currentStreak: 4,
        streakRecentDays: [
          {
            dayKey: "2026-09-09",
            label: "W",
            active: true,
            isToday: true,
          },
        ],
      },
      {
        now: new Date("2026-09-10T00:01:00.000Z"),
        recordAppActivity: true,
      },
    );

    expect(updated.streakRecentDays.at(-1)).toMatchObject({
      dayKey: "2026-09-10",
      active: true,
      isToday: true,
    });
  });

  it("waits for a widget snapshot to be stored", async () => {
    let resolveWrite: (() => void) | undefined;
    const setItem = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        }),
    );
    let didFinish = false;

    const persistence = persistWidgetSnapshot(
      { setItem },
      "last-widget-snapshot",
      { reviewCount: 8 },
    ).then((result) => {
      didFinish = true;
      return result;
    });

    await Promise.resolve();
    expect(didFinish).toBe(false);
    expect(setItem).toHaveBeenCalledWith(
      "last-widget-snapshot",
      JSON.stringify({ reviewCount: 8 }),
    );

    resolveWrite?.();
    await expect(persistence).resolves.toBe(true);
  });

  it("contains snapshot storage failures without rejecting background work", async () => {
    await expect(
      persistWidgetSnapshot(
        { setItem: jest.fn(() => Promise.reject(new Error("storage full"))) },
        "last-widget-snapshot",
        { reviewCount: 8 },
      ),
    ).resolves.toBe(false);
  });

  it("keeps long-range timeline anchors when review updates fill the entry cap", () => {
    const now = new Date("2026-09-10T08:00:00.000Z").getTime();
    const hourlyReviewTimestamps = Array.from(
      { length: 64 },
      (_, offset) => now + (offset + 1) * 60 * 60 * 1000,
    );
    const midnightAnchors = Array.from(
      { length: 7 },
      (_, offset) => now + (offset + 1) * 24 * 60 * 60 * 1000,
    );

    const selected = selectWidgetTimelineTimestamps(
      hourlyReviewTimestamps,
      midnightAnchors,
      now,
      60,
    );

    expect(selected).toHaveLength(60);
    expect(selected).toEqual(expect.arrayContaining(midnightAnchors));
    expect(selected).toContain(now);
  });
});
