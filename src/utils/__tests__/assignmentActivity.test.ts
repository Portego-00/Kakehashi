import { describe, expect, it } from "@jest/globals";
import type { Assignment } from "../api";
import { getAssignmentActivityByDay } from "../assignmentActivity";

const rangeStart = new Date(2026, 8, 1);
const rangeEnd = new Date(2026, 8, 30, 23, 59, 59, 999);
const now = new Date(2026, 8, 22, 12);
const timestamp = (day: number, hour = 12, minute = 0) =>
  new Date(2026, 8, day, hour, minute).toISOString();

function makeAssignment(
  id: number,
  data: Partial<Assignment["data"]> = {},
  updatedAt = timestamp(18),
): Assignment {
  return {
    id,
    object: "assignment",
    url: `https://api.wanikani.com/v2/assignments/${id}`,
    data_updated_at: updatedAt,
    data: {
      created_at: timestamp(1),
      subject_id: id,
      subject_type: "kanji",
      srs_stage: 1,
      unlocked_at: timestamp(1),
      started_at: timestamp(2),
      passed_at: null,
      burned_at: null,
      available_at: timestamp(18),
      resurrected_at: null,
      hidden: false,
      ...data,
    },
  };
}

function activity(assignments: Assignment[]) {
  return getAssignmentActivityByDay(assignments, rangeStart, rangeEnd, now);
}

describe("getAssignmentActivityByDay", () => {
  it("does not turn a vacation scheduling update into study activity", () => {
    expect(activity([makeAssignment(1)])).toEqual({ "2026-09-02": 1 });
  });

  it("ignores scheduling and resurrection dates while preserving study milestones", () => {
    expect(activity([makeAssignment(1, {
      passed_at: timestamp(8),
      burned_at: timestamp(12),
      available_at: timestamp(15),
      resurrected_at: timestamp(20),
    })])).toEqual({
      "2026-09-02": 1,
      "2026-09-08": 1,
      "2026-09-12": 1,
    });
  });

  it("counts each assignment once per local day even with multiple milestones", () => {
    const data = {
      started_at: timestamp(2, 9),
      passed_at: timestamp(2, 12),
      burned_at: timestamp(2, 18),
    };
    expect(activity([
      makeAssignment(1, data, timestamp(2)),
      makeAssignment(2, data, timestamp(2)),
    ])).toEqual({ "2026-09-02": 2 });
  });

  it("excludes hidden and unstarted assignments", () => {
    expect(activity([
      makeAssignment(1, { hidden: true }),
      makeAssignment(2, { started_at: null, passed_at: timestamp(8) }),
    ])).toEqual({});
  });

  it("ignores invalid and future milestone timestamps", () => {
    expect(activity([
      makeAssignment(1, { passed_at: "invalid", burned_at: timestamp(22, 13) }),
      makeAssignment(2, { started_at: "invalid" }),
      makeAssignment(3, { started_at: timestamp(23) }),
    ])).toEqual({ "2026-09-02": 1 });
  });

  it("includes range boundaries and excludes milestones outside the selected range", () => {
    const beforeRange = new Date(2026, 7, 31, 23, 59, 59, 999).toISOString();
    expect(getAssignmentActivityByDay([
      makeAssignment(1, { started_at: rangeStart.toISOString() }),
      makeAssignment(2, { started_at: beforeRange, passed_at: rangeEnd.toISOString() }),
      makeAssignment(3, { started_at: new Date(2026, 9, 1).toISOString() }),
    ], rangeStart, rangeEnd, new Date(2026, 9, 2))).toEqual({
      "2026-09-01": 1,
      "2026-09-30": 1,
    });
  });

  it("uses local calendar days around midnight", () => {
    expect(activity([
      makeAssignment(1, {
        started_at: timestamp(2, 23, 30),
        passed_at: timestamp(3, 0, 30),
      }),
    ])).toEqual({ "2026-09-02": 1, "2026-09-03": 1 });
  });
});
