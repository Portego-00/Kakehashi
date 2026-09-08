import { simulateStreakWithFreeze, toDayKeyInTimezone, usageStreakSnapshot } from "../usageStreak";

const at = (day: string) => new Date(`${day}T12:00:00Z`);
const daysFrom = (start: string, count: number) => Array.from({ length: count }, (_, index) => {
  const day = at(start);
  day.setUTCDate(day.getUTCDate() + index);
  return day.toISOString().slice(0, 10);
});

describe("usage streak calculation", () => {
  it("preserves a full multi-year streak and its longest streak", () => {
    const days = daysFrom("2022-01-01", 1500);
    expect(usageStreakSnapshot(days, "UTC", at(days.at(-1)!))).toMatchObject({
      currentStreak: 1500, longestStreak: 1500, freezeAvailable: true, freezeDaysUntilReload: 0,
    });
  });

  it("earns a freeze after seven active days, consumes a gap without incrementing, and recharges", () => {
    const firstWeek = daysFrom("2026-08-01", 7);
    expect(simulateStreakWithFreeze(new Set(firstWeek), "2026-08-07")).toMatchObject({
      currentStreak: 7, freezeAvailable: true,
    });
    expect(simulateStreakWithFreeze(new Set(firstWeek), "2026-08-08")).toMatchObject({
      currentStreak: 7, freezeAvailable: false, freezeChargeProgress: 0,
    });
    expect(usageStreakSnapshot(firstWeek, "UTC", at("2026-08-09"))).toMatchObject({
      currentStreak: 8, longestStreak: 8, freezeAvailable: false, freezeDaysUntilReload: 6,
    });
    expect(simulateStreakWithFreeze(new Set([...firstWeek, ...daysFrom("2026-08-09", 7)]), "2026-08-15")).toMatchObject({
      currentStreak: 14, longestStreak: 14, freezeAvailable: true,
    });
  });

  it("breaks on an uncovered gap but preserves the historical best", () => {
    const days = daysFrom("2026-08-01", 9);
    expect(usageStreakSnapshot(days, "UTC", at("2026-08-12"))).toMatchObject({
      currentStreak: 1, longestStreak: 9, freezeAvailable: false, freezeDaysUntilReload: 6,
    });
    expect(usageStreakSnapshot(daysFrom("2026-08-01", 3), "UTC", at("2026-08-05"))).toMatchObject({
      currentStreak: 1, longestStreak: 3,
    });
  });

  it("adds today only to the display and deduplicates session dates", () => {
    const confirmed = ["2026-09-06", "2026-09-06", "2026-09-07"];
    const original = [...confirmed];
    const result = usageStreakSnapshot(confirmed, "UTC", at("2026-09-08"));
    expect(result.currentStreak).toBe(3);
    expect(confirmed).toEqual(original);
    expect(result.recentDays.at(-1)).toMatchObject({ dayKey: "2026-09-08", active: true, isToday: true });
  });

  it("handles leap days and does not count future dates", () => {
    expect(usageStreakSnapshot(["2024-02-28", "2024-02-29", "2024-03-20"], "UTC", at("2024-03-01")))
      .toMatchObject({ currentStreak: 3, longestStreak: 3 });
  });

  it.each([
    ["2026-03-08T06:59:00Z", "America/New_York", "2026-03-08"],
    ["2026-03-08T07:01:00Z", "America/New_York", "2026-03-08"],
    ["2026-11-01T05:30:00Z", "America/New_York", "2026-11-01"],
    ["2026-11-01T06:30:00Z", "America/New_York", "2026-11-01"],
    ["2026-09-08T00:30:00Z", "America/Los_Angeles", "2026-09-07"],
    ["2026-09-08T00:30:00Z", "Asia/Tokyo", "2026-09-08"],
    ["2026-09-08T23:30:00Z", "Europe/Madrid", "2026-09-09"],
  ])("groups %s using %s", (timestamp, timezone, expected) => {
    expect(toDayKeyInTimezone(new Date(timestamp), timezone)).toBe(expected);
  });

  it("keeps the same result when timestamp histories are replaced with compact days", () => {
    for (const timezone of ["UTC", "Europe/Madrid", "America/New_York", "Asia/Tokyo"]) {
      const timestamps = daysFrom("2024-01-01", 900).flatMap((day, index) => index % 11 < 9
        ? [`${day}T00:15:00Z`, `${day}T15:00:00Z`, `${day}T23:45:00Z`] : []);
      const oldDays = new Set(timestamps.map((value) => toDayKeyInTimezone(new Date(value), timezone)));
      oldDays.add(toDayKeyInTimezone(at("2026-06-18"), timezone));
      const old = simulateStreakWithFreeze(oldDays, toDayKeyInTimezone(at("2026-06-18"), timezone));
      const compact = [...new Set(timestamps.map((value) => toDayKeyInTimezone(new Date(value), timezone)))].sort();
      const next = usageStreakSnapshot(compact, timezone, at("2026-06-18"));
      expect(next).toMatchObject({ currentStreak: old.currentStreak, longestStreak: old.longestStreak,
        freezeAvailable: old.freezeAvailable, freezeDaysUntilReload: old.freezeAvailable ? 0 : Math.max(1, 7 - old.freezeChargeProgress) });
    }
  });
});
