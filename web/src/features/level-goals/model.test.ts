import { describe, expect, it, vi } from "vitest";
import {
  canAccessLevelGoals,
  createLevelGoal,
  dateAfterDays,
  DAY_MS,
  EMPTY_GOAL_STATE,
  goalMilestones,
  goalOutcome,
  goalPace,
  localDateKey,
  observeGoal,
  parseGoalDate,
  parseGoalState,
  projectedArrival,
  replaceGoal,
  suggestedGoalLevel,
  type GoalProgression,
} from "../../../../src/features/level-goals/model";
import { createGoalStore } from "../../../../src/features/level-goals/storage";
const now = new Date("2026-09-30T12:00:00");
const goal = (deadline: string | null = null) =>
  createLevelGoal(
    {
      id: "goal",
      mode: deadline ? "date" : "level",
      currentLevel: 7,
      targetLevel: 10,
      deadline,
    },
    now,
  );
const progression = (
  level: number,
  unlocked: string,
  passed?: string,
  abandoned?: string,
): GoalProgression => ({
  data: {
    level,
    unlocked_at: unlocked,
    passed_at: passed,
    abandoned_at: abandoned,
  },
});
describe("level goals", () => {
  it("limits access to Portego", () => {
    expect(canAccessLevelGoals(" Portego ")).toBe(true);
    expect(canAccessLevelGoals("portego")).toBe(true);
    expect(canAccessLevelGoals("Portego2")).toBe(false);
    expect(canAccessLevelGoals(null)).toBe(false);
  });
  it("validates levels and real future calendar dates", () => {
    expect(parseGoalDate("2026-02-30")).toBeNull();
    expect(parseGoalDate("2028-02-29")).not.toBeNull();
    expect(() =>
      createLevelGoal(
        {
          id: "g",
          mode: "date",
          currentLevel: 7,
          targetLevel: 10,
          deadline: "2026-09-30",
        },
        now,
      ),
    ).toThrow("future");
    expect(() =>
      createLevelGoal(
        { id: "g", mode: "level", currentLevel: 7, targetLevel: 7 },
        now,
      ),
    ).toThrow("ahead");
    expect(() =>
      createLevelGoal(
        { id: "g", mode: "level", currentLevel: 59, targetLevel: 61 },
        now,
      ),
    ).toThrow();
    expect(
      createLevelGoal(
        {
          id: "g",
          mode: "duration",
          currentLevel: 7,
          targetLevel: 10,
          durationDays: 30,
        },
        now,
      ).deadline,
    ).toBe("2026-10-30");
    expect(dateAfterDays(1, new Date("2026-12-31T23:30:00"))).toBe(
      "2027-01-01",
    );
  });
  it("allows the entire target day before marking a goal missed", () => {
    const g = goal("2026-10-05");
    expect(goalOutcome(g, new Date("2026-10-05T23:59:00"))).toBe("active");
    expect(goalOutcome(g, new Date("2026-10-06T00:01:00"))).toBe("missed");
  });
  it("uses actual arrival timestamps even when the app opens after the deadline", () => {
    const state = { ...EMPTY_GOAL_STATE, active: goal("2026-10-05") };
    const missed = observeGoal(state, 9, [], new Date("2026-10-10T12:00:00"));
    expect(missed.active?.missedAt).toBeTruthy();
    const reached = observeGoal(
      missed,
      10,
      [progression(10, "2026-10-05T12:00:00")],
      new Date("2026-10-10T12:00:00"),
    );
    expect(goalOutcome(reached.active!)).toBe("reached");
    expect(reached.active?.missedAt).toBeNull();
    const late = observeGoal(
      state,
      10,
      [progression(10, "2026-10-06T12:00:00")],
      new Date("2026-10-10T12:00:00"),
    );
    expect(goalOutcome(late.active!)).toBe("late");
  });
  it("waits for verified history and ignores a previous run or future arrival", () => {
    const state = { ...EMPTY_GOAL_STATE, active: goal() };
    expect(observeGoal(state, 10, [], now)).toBe(state);
    expect(
      observeGoal(
        state,
        10,
        [
          progression(10, "2026-09-29T12:00:00"),
          progression(10, "2026-10-01T12:00:00"),
        ],
        now,
      ),
    ).toBe(state);
  });
  it("keeps replaced and ended goals, without mutating the previous state", () => {
    const state = { ...EMPTY_GOAL_STATE, active: goal(), widgetHidden: true };
    const next = replaceGoal(state, { ...goal(), id: "next" }, now);
    expect(next.history[0].outcome).toBe("changed");
    expect(next.widgetHidden).toBe(true);
    expect(state.history).toHaveLength(0);
    expect(replaceGoal(next, null, now).history[0].outcome).toBe("ended");
    const reached = {
      ...state,
      active: { ...goal(), reachedAt: now.toISOString() },
    };
    expect(replaceGoal(reached, null, now).history[0].outcome).toBe("reached");
  });
  it("recovers malformed storage and preserves valid history", () => {
    expect(parseGoalState("invalid")).toEqual(EMPTY_GOAL_STATE);
    expect(parseGoalState("null")).toEqual(EMPTY_GOAL_STATE);
    expect(
      parseGoalState(
        JSON.stringify({
          ...EMPTY_GOAL_STATE,
          active: { ...goal(), targetLevel: 99 },
        }),
      ).active,
    ).toBeNull();
    const state = replaceGoal(
      { ...EMPTY_GOAL_STATE, active: goal() },
      null,
      now,
    );
    expect(parseGoalState(JSON.stringify(state))).toEqual(state);
  });
  it("uses recent completed levels and excludes abandoned runs and levels 1–2", () => {
    const rows = [
      progression(1, "2026-08-01", "2026-08-02"),
      progression(2, "2026-08-02", "2026-08-03"),
      progression(3, "2026-08-03", "2026-08-10"),
      progression(4, "2026-08-10", "2026-08-19"),
      progression(5, "2026-08-19", "2026-08-30"),
      progression(6, "2026-08-30", "2026-09-06"),
      progression(7, "2026-09-06"),
    ];
    expect(goalPace(rows, 7)).toEqual({
      typical: 8,
      faster: 7,
      relaxed: 9.5,
      count: 4,
    });
    const reset = [
      progression(7, "2026-08-01", undefined, "2026-09-01"),
      progression(3, "2026-09-02", "2026-09-12"),
      progression(4, "2026-09-12"),
    ];
    expect(goalPace([...rows.slice(0, 4), ...reset], 4)?.typical).toBe(10);
    expect(goalPace([], 1)).toBeNull();
  });
  it("accounts for current level time, caps overdue estimates, and suggests reachable targets", () => {
    const rows = [
      progression(7, new Date(now.getTime() - 3 * DAY_MS).toISOString()),
    ];
    expect(projectedArrival(10, 7, 7, rows, now)).toBe(
      new Date(now.getTime() + 18 * DAY_MS).toISOString(),
    );
    expect(suggestedGoalLevel(7, "2026-10-18", 7, rows, now)).toBe(10);
    expect(suggestedGoalLevel(59, null, null, [], now)).toBe(60);
    expect(
      localDateKey(
        new Date(
          projectedArrival(8, 7, 7, [progression(7, "2026-08-01")], now)!,
        ),
      ),
    ).toBe("2026-10-01");
    expect(projectedArrival(10, 7, null, [], now)).toBeNull();
    expect(goalMilestones(goal(), 8)).toEqual([7, 8, 9, 10]);
  });
});
describe("goal storage", () => {
  it("isolates accounts, persists across stores, and publishes only successful writes", () => {
    const data = new Map<string, string>();
    let fail = false;
    const adapter = {
      read: (key: string) => data.get(key),
      write: (key: string, value: string) => {
        if (fail) throw new Error("full");
        data.set(key, value);
      },
    };
    const store = createGoalStore(adapter);
    const listener = vi.fn();
    store.subscribe(listener);
    store.update("1", (s) => ({ ...s, active: goal() }));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.read("2").active).toBeNull();
    expect(createGoalStore(adapter).read("1").active).toEqual(goal());
    fail = true;
    expect(() =>
      store.update("1", (s) => ({ ...s, widgetHidden: true })),
    ).toThrow("full");
    expect(store.read("1").widgetHidden).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
