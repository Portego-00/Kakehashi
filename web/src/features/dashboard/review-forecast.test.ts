import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Assignment, Subject } from "@/types/wanikani";
import { createCustomSrsState, enrollCustomVocabularyPack } from "@/features/custom-srs/model";
import type { CustomVocabularyPack } from "@/features/custom-srs/types";
import { createReviewForecast, customReviewForecastEntries, getDailyReviewForecast, getHourlyReviewForecast, wanikaniReviewForecastEntries, type ReviewForecastEntry } from "./review-forecast";

const HOUR_MS = 3_600_000;

function entry(id: string, availableAt: Date | string, overrides: Partial<ReviewForecastEntry> = {}): ReviewForecastEntry {
  return { id, availableAt: typeof availableAt === "string" ? availableAt : availableAt.toISOString(), subjectType: "vocabulary", srsStage: 1, ...overrides };
}

function assignment(id: number, data: Partial<Assignment["data"]> = {}, updatedAt = "2026-09-06T10:00:00Z"): Assignment {
  return {
    id, object: "assignment", url: "", data_updated_at: updatedAt,
    data: { subject_id: id, subject_type: "kanji", srs_stage: 1, available_at: "2026-09-06T12:00:00Z", started_at: "2026-08-01T12:00:00Z", unlocked_at: null, passed_at: null, burned_at: null, resurrected_at: null, hidden: false, created_at: "", ...data },
  };
}

function subject(id: number, type: Subject["object"] = "kanji", level = 10): Subject {
  return {
    id, object: type, url: "", data_updated_at: "",
    data: { level, created_at: "", slug: String(id), document_url: "", hidden_at: null, characters: "字", meanings: [], auxiliary_meanings: [] },
  };
}

describe("review forecast schedules", () => {
  it("keeps Now, current-hour future reviews, and exact hour boundaries distinct", () => {
    const now = new Date(2026, 8, 6, 12, 30);
    const forecast = createReviewForecast([
      entry("overdue", new Date(now.getTime() - 2 * HOUR_MS)),
      entry("due-exactly-now", now, { subjectType: "radical", srsStage: 4, critical: true }),
      entry("later-this-hour", new Date(2026, 8, 6, 12, 45), { subjectType: "kanji", srsStage: 5 }),
      entry("at-next-hour", new Date(2026, 8, 6, 13), { subjectType: "kana_vocabulary", srsStage: 7 }),
      entry("after-next-hour", new Date(2026, 8, 6, 13, 15), { srsStage: 8 }),
    ], now);

    expect(forecast.dueNow).toMatchObject({ count: 2, critical: true });
    expect(forecast.hourly.slice(0, 3).map(({ label, count, cumulativeCount }) => ({ label, count, cumulativeCount }))).toEqual([
      { label: "Now", count: 0, cumulativeCount: 2 },
      { label: "1P", count: 2, cumulativeCount: 4 },
      { label: "2P", count: 1, cumulativeCount: 5 },
    ]);
    expect(forecast.days[0]).toMatchObject({ count: 3, cumulativeCount: 5 });
    expect(forecast.days[0].hours.filter(({ count }) => count).map(({ count, cumulativeCount }) => [count, cumulativeCount])).toEqual([[1, 3], [2, 5]]);
    expect(forecast.hourly[2].cumulativeSubjectBreakdown).toEqual({ radical: 1, kanji: 1, vocabulary: 2, kana_vocabulary: 1 });
    expect(forecast.hourly[2].cumulativeSrsBreakdown).toEqual({ apprentice: 2, guru: 1, master: 1, enlightened: 1 });
    expect(forecast.nextReviewAt).toEqual(new Date(2026, 8, 6, 12, 45));
  });

  it("keeps seven contiguous calendar days and complete 24/48-column charts across empty gaps", () => {
    const now = new Date(2026, 8, 6, 23, 40);
    const forecast = createReviewForecast([
      entry("tomorrow-midnight", new Date(2026, 8, 7)),
      entry("last-minute", new Date(2026, 8, 12, 23, 59, 59)),
      entry("outside-week", new Date(2026, 8, 13)),
    ], now);
    expect(forecast.days).toHaveLength(7);
    expect(getDailyReviewForecast(forecast).map(({ count }) => count)).toEqual([0, 1, 0, 0, 0, 0, 1]);
    expect(forecast.days.map(({ cumulativeCount }) => cumulativeCount)).toEqual([0, 1, 1, 1, 1, 1, 2]);
    expect(forecast.days.map(({ start }) => start.getDate())).toEqual([6, 7, 8, 9, 10, 11, 12]);
    expect(forecast.days.slice(0, 2).map(({ label }) => label)).toEqual(["Today", "Tomorrow"]);
    expect(forecast.laterCount).toBe(1);
    expect(getHourlyReviewForecast(forecast, 24)).toHaveLength(24);
    expect(getHourlyReviewForecast(forecast, 48)).toHaveLength(48);
    expect(forecast.hourly[1]).toMatchObject({ label: "12A", count: 1, dayLabel: "(T)" });
    expect(forecast.hourly.slice(2).every(({ cumulativeCount }) => cumulativeCount === 1)).toBe(true);
    expect(forecast.hourly.slice(2).every((point, index) => point.end.getTime() - forecast.hourly[index + 1].end.getTime() === HOUR_MS)).toBe(true);
  });

  it("deduplicates schedules, rejects invalid/inactive entries, and keeps breakdown totals exact", () => {
    const now = new Date(2026, 8, 6, 12);
    const active = Array.from({ length: 8 }, (_, index) => entry(`stage-${index + 1}`, new Date(now.getTime() + index * HOUR_MS), { srsStage: index + 1 }));
    const forecast = createReviewForecast([
      ...active,
      active[0],
      entry("invalid-date", "invalid"),
      entry("lesson", now, { srsStage: 0 }),
      entry("burned", now, { srsStage: 9 }),
      entry("fractional-stage", now, { srsStage: 1.5 }),
    ], now);
    expect(forecast.days[0].cumulativeCount).toBe(8);
    expect(forecast.days[0].cumulativeSrsBreakdown).toEqual({ apprentice: 4, guru: 2, master: 1, enlightened: 1 });
    for (const point of [...forecast.days, ...forecast.hourly, ...forecast.days.flatMap(({ hours }) => hours)]) {
      expect(Object.values(point.cumulativeSubjectBreakdown).reduce((sum, count) => sum + count, 0)).toBe(point.cumulativeCount);
      expect(Object.values(point.cumulativeSrsBreakdown).reduce((sum, count) => sum + count, 0)).toBe(point.cumulativeCount);
      if (point.key !== "now") {
        expect(Object.values(point.subjectBreakdown).reduce((sum, count) => sum + count, 0)).toBe(point.count);
        expect(Object.values(point.srsBreakdown).reduce((sum, count) => sum + count, 0)).toBe(point.count);
      }
    }
  });

  it("returns the same complete timeline when nothing is scheduled", () => {
    const forecast = createReviewForecast([], new Date(2026, 8, 6));
    expect(forecast.dueNow.count).toBe(0);
    expect(forecast.days).toHaveLength(7);
    expect(forecast.hourly).toHaveLength(48);
    expect(forecast.hourly.every(({ count, cumulativeCount }) => count === 0 && cumulativeCount === 0)).toBe(true);
    expect(forecast.nextReviewAt).toBeNull();
    expect(forecast.laterCount).toBe(0);
  });
});

describe("review forecast source adapters", () => {
  it("filters inactive WaniKani rows and identifies only current-level apprentice radical/kanji as critical", () => {
    const hiddenSubject = subject(7);
    hiddenSubject.data.hidden_at = "2026-09-01T00:00:00Z";
    const assignments = [
      assignment(1, { subject_type: "radical", srs_stage: 4 }),
      assignment(2, { srs_stage: 4 }),
      assignment(3, { srs_stage: 5 }),
      assignment(4, { subject_type: "vocabulary" }),
      assignment(5),
      assignment(6, { hidden: true }),
      assignment(7),
      assignment(8, { started_at: null }),
      assignment(9, { srs_stage: 9 }),
      assignment(10, { available_at: "invalid" }),
      assignment(11, { srs_stage: 2, burned_at: "2026-09-01T00:00:00Z", resurrected_at: "2026-09-02T00:00:00Z" }),
      assignment(12, { subject_type: "kana_vocabulary" }),
      assignment(13, { srs_stage: 0 }),
    ];
    const subjects = [subject(1, "radical"), subject(2), subject(3), subject(4, "vocabulary"), subject(5, "kanji", 9), hiddenSubject];
    const entries = wanikaniReviewForecastEntries(assignments, subjects, 10);
    expect(entries.map(({ id }) => id)).toEqual(["1", "2", "3", "4", "5", "11", "12"]);
    expect(entries.filter(({ critical }) => critical).map(({ id }) => id)).toEqual(["1", "2"]);
    expect(entries.at(-1)?.subjectType).toBe("kana_vocabulary");
  });

  it("uses the latest WaniKani state when duplicate resource pages overlap", () => {
    const older = assignment(1, {}, "2026-09-01T00:00:00Z");
    const newer = assignment(1, { hidden: true }, "2026-09-02T00:00:00Z");
    expect(wanikaniReviewForecastEntries([newer, older], [], 10)).toEqual([]);
    expect(wanikaniReviewForecastEntries([older, older], [], 10)).toHaveLength(1);
  });

  it("includes only matching enrolled custom words, preserving kana/kanji vocabulary types", () => {
    const now = new Date("2026-09-06T12:00:00Z");
    const pack: CustomVocabularyPack = {
      id: "test", title: "Test", description: "", script: "mixed",
      words: ["メモ", "女子", "やっぱり", "じゃあ", "どうぞ", "すごい"].map((characters) => ({ id: characters, characters, reading: characters, meanings: [], partsOfSpeech: [], meaningMnemonic: "", contextSentences: [] })),
    };
    const state = enrollCustomVocabularyPack(createCustomSrsState(now), pack, now);
    for (const assignment of Object.values(state.assignments)) {
      Object.assign(assignment, { stage: 1, startedAt: now.toISOString(), availableAt: now.toISOString() });
    }
    state.assignments["やっぱり"].stage = 9;
    state.assignments["じゃあ"].availableAt = "invalid";
    state.assignments["どうぞ"].packId = "not-enrolled";
    state.assignments["すごい"].burnedAt = now.toISOString();
    state.assignments.orphan = { ...state.assignments["メモ"], wordId: "orphan" };
    expect(customReviewForecastEntries(state, [pack])).toEqual([
      { id: "メモ", availableAt: now.toISOString(), subjectType: "kana_vocabulary", srsStage: 1 },
      { id: "女子", availableAt: now.toISOString(), subjectType: "vocabulary", srsStage: 1 },
    ]);
    expect(customReviewForecastEntries({ ...state, enrolledPackIds: [] }, [pack])).toEqual([]);
  });
});

describe("local calendar and daylight saving time", () => {
  const originalTimezone = process.env.TZ;
  beforeAll(() => { process.env.TZ = "Europe/Madrid"; });
  afterAll(() => {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  });

  it.each([
    [new Date("2026-03-28T12:00:00+01:00"), 23],
    [new Date("2026-10-24T12:00:00+02:00"), 25],
  ])("uses local midnights through a DST change starting %s", (now, expectedHours) => {
    const firstForecast = createReviewForecast([], now);
    expect(firstForecast.days[1].hours).toHaveLength(expectedHours);
    const lastDay = firstForecast.days[6];
    const forecast = createReviewForecast([
      entry("start-next-day", firstForecast.days[1].start),
      entry("last-day", new Date(lastDay.end.getTime() - 1)),
      entry("following-day", lastDay.end),
    ], now);
    expect(forecast.days.map(({ count }) => count)).toEqual([0, 1, 0, 0, 0, 0, 1]);
    expect(forecast.laterCount).toBe(1);
    expect(forecast.days.every(({ start, end }) => start.getHours() === 0 && end.getHours() === 0)).toBe(true);
    expect(forecast.days[1].hours.map(({ key }) => key).length).toBe(new Set(forecast.days[1].hours.map(({ key }) => key)).size);
  });

  it("keeps both repeated hours and starts after the actual current instant", () => {
    const now = new Date("2026-10-25T02:30:00+02:00");
    const forecast = createReviewForecast([
      entry("before-clock-change", "2026-10-25T02:45:00+02:00"),
      entry("after-clock-change", "2026-10-25T02:15:00+01:00"),
    ], now);
    expect(forecast.hourly[1].end.toISOString()).toBe("2026-10-25T01:00:00.000Z");
    expect(forecast.hourly.slice(1, 3).map(({ count }) => count)).toEqual([1, 1]);
    expect(forecast.days[0].hours.filter(({ label }) => label === "2A").map(({ count }) => count)).toEqual([1, 1]);
    const secondHour = createReviewForecast([], new Date("2026-10-25T02:30:00+01:00"));
    expect(secondHour.hourly[1].end.toISOString()).toBe("2026-10-25T02:00:00.000Z");
  });
});
