import { describe, expect, it } from "vitest";
import {
  isStudyPlan,
  planForLessons,
  planForPace,
  projectStudyWorkload,
  subjectsPerLevel,
  type PlannerAssignment,
} from "../../../../src/features/level-goals/planner";
import {
  EMPTY_GOAL_STATE,
  parseGoalState,
} from "../../../../src/features/level-goals/model";
const plan = { daysPerLevel: 7, dailyLessons: 10, reviewBatch: 50 };
const now = new Date("2026-10-04T08:00:00");
const row = (
  id: number,
  stage: number,
  due = now.toISOString(),
): PlannerAssignment => ({
  data: {
    subject_id: id,
    srs_stage: stage,
    started_at: "2026-09-01T08:00:00",
    available_at: due,
  },
});
describe("study pace planner", () => {
  it("links the pace and lesson controls using the catalog", () => {
    expect(planForPace(plan, 7, 140).dailyLessons).toBe(20);
    expect(planForLessons(plan, 10, 140).daysPerLevel).toBe(14);
    expect(planForPace(plan, 7, null).dailyLessons).toBe(10);
    expect(
      subjectsPerLevel(
        [
          { id: 1, object: "kanji", data: { level: 7 } },
          { id: 1, object: "kanji", data: { level: 7 } },
          {
            id: 2,
            object: "vocabulary",
            data: { level: 7, hidden_at: "2026-01-01" },
          },
        ],
        7,
      ),
    ).toBe(1);
  });
  it("persists a valid plan alongside an existing goal state and drops malformed plans", () => {
    expect(
      parseGoalState(JSON.stringify({ ...EMPTY_GOAL_STATE, studyPlan: plan }))
        .studyPlan,
    ).toEqual(plan);
    expect(
      parseGoalState(
        JSON.stringify({
          ...EMPTY_GOAL_STATE,
          studyPlan: { ...plan, dailyLessons: -2 },
        }),
      ).studyPlan,
    ).toBeUndefined();
    expect(isStudyPlan({ ...plan, reviewBatch: 7 })).toBe(false);
  });
  it("uses scheduled reviews plus their correct-answer SRS chain", () => {
    const days = projectStudyWorkload(
      [row(1, 1)],
      [],
      { ...plan, dailyLessons: 1 },
      7,
      now,
    );
    expect(days[0].existing).toBe(2); // due at 08:00, then at 16:00
    expect(days[1].existing).toBe(1); // next day at 16:00
    expect(days[3].existing).toBe(1); // two days later
    expect(days.reduce((sum, day) => sum + day.known, 0)).toBe(1);
  });
  it("estimates new lessons and never makes session size change the workload", () => {
    const a = projectStudyWorkload([], [], plan, 7, now);
    const b = projectStudyWorkload([], [], { ...plan, reviewBatch: 5 }, 7, now);
    expect(a).toEqual(b);
    expect(a[0].lessons).toBe(20); // first and second reviews at noon and 20:00
    expect(
      projectStudyWorkload([], [], { ...plan, dailyLessons: 20 }, 7, now)[0]
        .lessons,
    ).toBe(40);
  });
  it("excludes hidden and burned items, retains resurrected items and latest snapshots", () => {
    const old = { ...row(1, 1), data_updated_at: "2026-10-01" };
    const hidden = {
      ...row(1, 1),
      data_updated_at: "2026-10-03",
      data: { ...row(1, 1).data, hidden: true },
    };
    expect(
      projectStudyWorkload([old, hidden, row(2, 9)], [], plan, 7, now).every(
        (day) => day.existing === 0,
      ),
    ).toBe(true);
    expect(
      projectStudyWorkload([row(3, 1)], [], plan, 7, now)[0].existing,
    ).toBe(2);
  });
  it("does not count today's completed lessons twice and pauses during vacation", () => {
    const today = {
      data: { ...row(1, 1).data, started_at: now.toISOString() },
    };
    expect(
      projectStudyWorkload([today], [], { ...plan, dailyLessons: 1 }, 7, now)[0]
        .lessons,
    ).toBe(0);
    expect(
      projectStudyWorkload([row(1, 1)], [], plan, 7, now, true).every(
        (day) => day.total === 0,
      ),
    ).toBe(true);
  });
});
