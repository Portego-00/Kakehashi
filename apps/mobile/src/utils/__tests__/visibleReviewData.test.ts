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
