import { describe, expect, it } from "vitest";
import type { Assignment } from "@/types/wanikani";
import { assignmentActivityDays } from "@/features/dashboard/dashboard-data";
import { calculateApproximateActivity } from "./calculations";

const now = new Date("2026-09-22T18:00:00");
const assignment: Assignment = {
  id: 1,
  object: "assignment",
  url: "",
  data_updated_at: "2026-09-18T12:00:00",
  data: {
    created_at: "2026-09-01T12:00:00",
    subject_id: 1,
    subject_type: "kanji",
    srs_stage: 2,
    unlocked_at: "2026-09-01T12:00:00",
    started_at: "2026-09-02T12:00:00",
    passed_at: null,
    burned_at: null,
    resurrected_at: null,
    available_at: "2026-09-23T12:00:00",
    hidden: false,
  },
};

describe.each([
  ["dashboard", (rows: Assignment[]) => assignmentActivityDays(rows, "all", now)],
  ["analytics", (rows: Assignment[]) => calculateApproximateActivity(rows, now, "all")],
] as const)("%s assignment activity", (_name, activityDays) => {
  it("does not count a vacation scheduling update as review activity", () => {
    const days = activityDays([assignment]);

    expect(days.find((day) => day.key === "2026-09-18")?.count).toBe(0);
    expect(days.find((day) => day.key === "2026-09-02")?.count).toBe(1);
  });

  it("does not create the 3,352-item spike when vacation reschedules assignments", () => {
    const rows = Array.from({ length: 3_352 }, (_, index) => ({
      ...assignment,
      id: index + 1,
      data: { ...assignment.data, subject_id: index + 1 },
    }));

    const days = activityDays(rows);

    expect(days.find((day) => day.key === "2026-09-18")?.count).toBe(0);
    expect(days.find((day) => day.key === "2026-09-02")?.count).toBe(3_352);
  });

  it("keeps real milestones on a vacation-update day and counts each item once", () => {
    const rows = [{ ...assignment, data: {
      ...assignment.data,
      passed_at: "2026-09-18T10:00:00",
      burned_at: "2026-09-20T12:00:00",
    } }];
    const before = activityDays(rows);
    const after = activityDays(rows.map((row) => ({
      ...row,
      data_updated_at: "2026-09-20T12:00:00",
      data: { ...row.data, available_at: null, srs_stage: 9 },
    })));

    expect(after).toEqual(before);
    expect(after.filter((day) => day.count).map(({ key, count }) => ({ key, count }))).toEqual([
      { key: "2026-09-02", count: 1 },
      { key: "2026-09-18", count: 1 },
      { key: "2026-09-20", count: 1 },
    ]);
  });

  it("ignores hidden, unstarted, invalid, future, and scheduling-only activity", () => {
    const rows = [
      { ...assignment, data: { ...assignment.data, hidden: true } },
      { ...assignment, id: 2, data: { ...assignment.data, started_at: null, passed_at: "2026-09-18T12:00:00" } },
      { ...assignment, id: 3, data: { ...assignment.data, started_at: "invalid", passed_at: "2026-09-23T12:00:00", burned_at: "invalid", resurrected_at: "2026-09-18T12:00:00" } },
    ];

    expect(activityDays(rows).every((day) => day.count === 0)).toBe(true);
  });

  it("buckets milestones by local calendar day and deduplicates an item's milestones", () => {
    const rows = [{ ...assignment, data: {
      ...assignment.data,
      started_at: new Date(2026, 8, 18, 0, 5).toISOString(),
      passed_at: new Date(2026, 8, 18, 23, 55).toISOString(),
      burned_at: new Date(2026, 8, 19, 0, 5).toISOString(),
    } }];
    const days = activityDays(rows);

    expect(days.find((day) => day.key === "2026-09-18")?.count).toBe(1);
    expect(days.find((day) => day.key === "2026-09-19")?.count).toBe(1);
  });
});
