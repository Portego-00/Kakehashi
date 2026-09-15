import { describe, expect, it } from "@jest/globals";
import {
  buildVisibleReviewDataFromAssignments,
  isAssignmentInReviewQueueState,
  type Assignment,
} from "../api";

function makeAssignmentData(
  overrides: Partial<Assignment["data"]> = {}
): Assignment["data"] {
  return {
    created_at: "2026-03-01T10:00:00.000Z",
    subject_id: 1,
    subject_type: "kanji",
    srs_stage: 1,
    unlocked_at: "2026-03-01T10:00:00.000Z",
    started_at: "2026-03-01T10:05:00.000Z",
    passed_at: null,
    burned_at: null,
    available_at: "2026-03-01T11:00:00.000Z",
    resurrected_at: null,
    hidden: false,
    ...overrides,
  };
}

function makeAssignment(id: number, data: Assignment["data"]): Assignment {
  return {
    id,
    object: "assignment",
    url: `https://api.wanikani.com/v2/assignments/${id}`,
    data_updated_at: "2026-03-01T11:00:00.000Z",
    data,
  };
}

describe("isAssignmentInReviewQueueState", () => {
  it("keeps resurrected assignments reviewable even when burned_at is set", () => {
    const resurrectedData = makeAssignmentData({
      subject_id: 101,
      srs_stage: 1,
      burned_at: "2025-01-10T10:00:00.000Z",
      resurrected_at: "2026-03-01T10:59:00.000Z",
      available_at: "2026-03-01T10:59:00.000Z",
    });

    expect(isAssignmentInReviewQueueState(resurrectedData)).toBe(true);
  });

  it("excludes current burned stage assignments", () => {
    const burnedData = makeAssignmentData({
      subject_id: 102,
      srs_stage: 9,
      burned_at: "2026-03-01T10:00:00.000Z",
      available_at: "2026-03-01T10:00:00.000Z",
    });

    expect(isAssignmentInReviewQueueState(burnedData)).toBe(false);
  });
});

describe("buildVisibleReviewDataFromAssignments", () => {
  it("counts resurrected items in current/upcoming review totals", () => {
    const now = new Date("2026-03-01T12:00:00.000Z");

    const resurrectedCurrent = makeAssignment(
      1,
      makeAssignmentData({
        subject_id: 201,
        srs_stage: 1,
        burned_at: "2025-12-01T00:00:00.000Z",
        resurrected_at: "2026-03-01T11:30:00.000Z",
        available_at: "2026-03-01T11:30:00.000Z",
      })
    );

    const resurrectedUpcoming = makeAssignment(
      2,
      makeAssignmentData({
        subject_id: 202,
        srs_stage: 2,
        burned_at: "2025-11-01T00:00:00.000Z",
        resurrected_at: "2026-03-01T11:45:00.000Z",
        available_at: "2026-03-01T12:20:00.000Z",
      })
    );

    const burnedExcluded = makeAssignment(
      3,
      makeAssignmentData({
        subject_id: 203,
        srs_stage: 9,
        burned_at: "2026-03-01T09:00:00.000Z",
        available_at: "2026-03-01T10:00:00.000Z",
      })
    );

    const visible = buildVisibleReviewDataFromAssignments(
      [resurrectedCurrent, resurrectedUpcoming, burnedExcluded],
      { now, hoursAhead: 24 }
    );

    expect(visible.currentReviews).toBe(1);
    expect(Object.values(visible.upcomingReviewTimes).reduce((a, b) => a + b, 0)).toBe(1);
  });
});


describe("Watch forecast breakdown", () => {
  const now = new Date("2026-09-13T12:15:00.000Z");

  it("keeps subject and SRS totals consistent with the exact schedule", () => {
    const future = "2026-09-13T13:00:00.000Z";
    const rows = [
      { subject_type: "radical", srs_stage: 1 },
      { subject_type: "kanji", srs_stage: 4 },
      { subject_type: "vocabulary", srs_stage: 5 },
      { subject_type: "kana_vocabulary", srs_stage: 6 },
      { subject_type: "kanji", srs_stage: 7 },
      { subject_type: "radical", srs_stage: 8 },
    ] satisfies Partial<Assignment["data"]>[];
    const assignments = rows.map((row, index) => makeAssignment(index + 1,
      makeAssignmentData({ ...row, available_at: future })));
    assignments.push(makeAssignment(7, makeAssignmentData({
      subject_type: "kana_vocabulary", available_at: now.toISOString(),
    })));

    const result = buildVisibleReviewDataFromAssignments(assignments, { now });

    expect(result.currentReviews).toBe(1);
    expect(result.currentSubjectCounts).toEqual({ radical: 0, kanji: 0, vocabulary: 1 });
    expect(result.forecastBreakdown).toEqual([{
      date: future, count: 6, radical: 2, kanji: 2, vocabulary: 2,
      apprentice: 2, guru: 2, master: 1, enlightened: 1,
    }]);
    expect(result.upcomingReviewTimes).toEqual({ [future]: 6 });
    expect(result.upcomingReviews.reduce((total, count) => total + count, 0)).toBe(6);
  });

  it("excludes hidden, unstarted, locked and burned subjects and the exclusive horizon", () => {
    const assignments = [
      { hidden: true }, { started_at: null }, { srs_stage: 0 }, { srs_stage: 9 },
      { available_at: "not-a-date" }, { available_at: "2026-09-14T12:15:00.000Z" },
    ].map((row, index) => makeAssignment(index + 1, makeAssignmentData({
      available_at: "2026-09-13T13:00:00.000Z", ...row,
    })));
    const result = buildVisibleReviewDataFromAssignments(assignments, { now });
    expect(result.currentReviews).toBe(0);
    expect(result.forecastBreakdown).toEqual([]);
    expect(result.upcomingReviewTimes).toEqual({});
    expect(result.upcomingReviews.every((count) => count === 0)).toBe(true);
  });

  it("normalizes timestamp offsets and sorts exact slots before sending them to Watch", () => {
    const assignments = ["2026-09-13T15:00:00+02:00", "2026-09-13T12:30:00Z", "2026-09-13T13:00:00.000Z"]
      .map((available_at, index) => makeAssignment(index + 1, makeAssignmentData({ available_at })));
    const result = buildVisibleReviewDataFromAssignments(assignments, { now });
    expect(result.forecastBreakdown?.map(({ date, count }) => ({ date, count }))).toEqual([
      { date: "2026-09-13T12:30:00.000Z", count: 1 },
      { date: "2026-09-13T13:00:00.000Z", count: 2 },
    ]);
  });

  it("omits misleading breakdowns when legacy cached assignment metadata is incomplete", () => {
    const result = buildVisibleReviewDataFromAssignments([
      { data: { subject_id: 1, started_at: "2026-01-01T00:00:00Z", available_at: "2026-09-13T12:00:00Z" } },
      { data: { subject_id: 2, started_at: "2026-01-01T00:00:00Z", available_at: "2026-09-13T13:00:00Z" } },
    ], { now });
    expect(result.currentReviews).toBe(1);
    expect(result.currentSubjectCounts).toBeUndefined();
    expect(result.forecastBreakdown).toBeUndefined();
    expect(Object.values(result.upcomingReviewTimes)).toEqual([1]);
  });
});
