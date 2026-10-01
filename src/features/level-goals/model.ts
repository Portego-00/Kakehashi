import { isPortegoUsername } from "../../utils/portegoAccess";

export const canAccessLevelGoals = isPortegoUsername;
export const DAY_MS = 86_400_000;
export type GoalMode = "level" | "duration" | "date";
export type GoalOutcome = "active" | "missed" | "reached" | "late";
export type GoalProgression = {
  data: {
    level: number;
    unlocked_at?: string | null;
    started_at?: string | null;
    passed_at?: string | null;
    abandoned_at?: string | null;
  };
};
export type LevelGoal = {
  id: string;
  mode: GoalMode;
  startLevel: number;
  targetLevel: number;
  createdAt: string;
  deadline: string | null;
  durationDays: number | null;
  reachedAt: string | null;
  missedAt: string | null;
  celebrated: boolean;
};
export type GoalHistory = {
  goal: LevelGoal;
  outcome: GoalOutcome | "changed" | "ended";
  archivedAt: string;
};
export type LevelGoalState = {
  version: 1;
  active: LevelGoal | null;
  history: GoalHistory[];
  widgetHidden: boolean;
};
export const EMPTY_GOAL_STATE: LevelGoalState = {
  version: 1,
  active: null,
  history: [],
  widgetHidden: false,
};
export const goalStorageKey = (account: string) =>
  `kakehashi:level-goals:v1:${encodeURIComponent(account)}`;
export const localDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function parseGoalDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && localDateKey(date) === value
    ? date
    : null;
}
export const dateAfterDays = (days: number, now = new Date()) => {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
};
const isLevel = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 1 &&
  value <= 60;
const isTimestamp = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
function validGoal(value: unknown): value is LevelGoal {
  if (!value || typeof value !== "object") return false;
  const g = value as Partial<LevelGoal>;
  return (
    typeof g.id === "string" &&
    g.id.length <= 100 &&
    ["level", "duration", "date"].includes(g.mode ?? "") &&
    isLevel(g.startLevel) &&
    isLevel(g.targetLevel) &&
    g.targetLevel > g.startLevel &&
    isTimestamp(g.createdAt) &&
    (g.deadline === null ||
      (typeof g.deadline === "string" && !!parseGoalDate(g.deadline))) &&
    (g.mode === "level" ? g.deadline === null : g.deadline !== null) &&
    (g.durationDays === null ||
      (typeof g.durationDays === "number" &&
        Number.isInteger(g.durationDays) &&
        g.durationDays > 0 &&
        g.durationDays <= 3650)) &&
    (g.reachedAt === null || isTimestamp(g.reachedAt)) &&
    (g.missedAt === null || isTimestamp(g.missedAt)) &&
    typeof g.celebrated === "boolean"
  );
}
export function parseGoalState(raw: string | null | undefined): LevelGoalState {
  try {
    if (!raw || raw.length > 100_000) return EMPTY_GOAL_STATE;
    const state = JSON.parse(raw) as Partial<LevelGoalState>;
    if (state.version !== 1) return EMPTY_GOAL_STATE;
    return {
      version: 1,
      active: validGoal(state.active) ? state.active : null,
      widgetHidden: state.widgetHidden === true,
      history: Array.isArray(state.history)
        ? state.history
            .filter(
              (r) =>
                r &&
                validGoal(r.goal) &&
                [
                  "active",
                  "missed",
                  "reached",
                  "late",
                  "changed",
                  "ended",
                ].includes(r.outcome) &&
                isTimestamp(r.archivedAt),
            )
            .slice(0, 30)
        : [],
    };
  } catch {
    return EMPTY_GOAL_STATE;
  }
}
export function createLevelGoal(
  input: {
    id: string;
    mode: GoalMode;
    currentLevel: number;
    targetLevel: number;
    deadline?: string | null;
    durationDays?: number | null;
  },
  now = new Date(),
): LevelGoal {
  if (
    !isLevel(input.currentLevel) ||
    !isLevel(input.targetLevel) ||
    input.targetLevel <= input.currentLevel
  )
    throw new Error("Choose a level ahead of your current level.");
  const deadline =
    input.mode === "level"
      ? null
      : input.mode === "duration"
        ? dateAfterDays(input.durationDays ?? 30, now)
        : (input.deadline ?? null);
  if (
    input.mode !== "level" &&
    (!deadline || !parseGoalDate(deadline) || deadline <= localDateKey(now))
  )
    throw new Error("Choose a future date.");
  const goal: LevelGoal = {
    id: input.id,
    mode: input.mode,
    startLevel: input.currentLevel,
    targetLevel: input.targetLevel,
    createdAt: now.toISOString(),
    deadline,
    durationDays: input.mode === "duration" ? (input.durationDays ?? 30) : null,
    reachedAt: null,
    missedAt: null,
    celebrated: false,
  };
  if (!validGoal(goal)) throw new Error("Check your goal and try again.");
  return goal;
}
export function goalOutcome(goal: LevelGoal, now = new Date()): GoalOutcome {
  if (goal.reachedAt)
    return goal.deadline &&
      localDateKey(new Date(goal.reachedAt)) > goal.deadline
      ? "late"
      : "reached";
  return goal.deadline && localDateKey(now) > goal.deadline
    ? "missed"
    : "active";
}
/** Reconcile with verified level arrivals; a late refresh must not turn an on-time arrival into a missed goal. */
export function observeGoal(
  state: LevelGoalState,
  currentLevel: number,
  progressions: readonly GoalProgression[],
  now = new Date(),
): LevelGoalState {
  const goal = state.active;
  if (!goal || goal.reachedAt || !isLevel(currentLevel)) return state;
  if (currentLevel >= goal.targetLevel) {
    const arrival = progressions
      .filter((p) => p.data.level === goal.targetLevel && !p.data.abandoned_at)
      .map((p) => p.data.unlocked_at)
      .filter(
        (d): d is string =>
          isTimestamp(d) &&
          Date.parse(d) >= Date.parse(goal.createdAt) &&
          Date.parse(d) <= now.getTime(),
      )
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
    // If history is still loading, wait for it rather than invent an achievement date.
    if (!arrival) return state;
    return {
      ...state,
      active: {
        ...goal,
        reachedAt: arrival,
        missedAt:
          goal.deadline && localDateKey(new Date(arrival)) > goal.deadline
            ? (goal.missedAt ?? arrival)
            : null,
      },
    };
  }
  if (goalOutcome(goal, now) === "missed" && !goal.missedAt)
    return { ...state, active: { ...goal, missedAt: now.toISOString() } };
  return state;
}
export function replaceGoal(
  state: LevelGoalState,
  goal: LevelGoal | null,
  now = new Date(),
): LevelGoalState {
  const previous = state.active;
  const outcome = previous ? goalOutcome(previous, now) : null;
  const entry: GoalHistory | null =
    previous && outcome
      ? {
          goal: previous,
          outcome:
            outcome === "active" ? (goal ? "changed" : "ended") : outcome,
          archivedAt: now.toISOString(),
        }
      : null;
  const history = entry
    ? [entry, ...state.history].slice(0, 30)
    : state.history;
  return { ...state, active: goal, history };
}
const quantile = (sorted: number[], fraction: number) => {
  const p = (sorted.length - 1) * fraction;
  const i = Math.floor(p);
  return sorted[i] + (sorted[Math.ceil(p)] - sorted[i]) * (p - i);
};
export function goalPace(
  progressions: readonly GoalProgression[],
  currentLevel: number,
  excluded: readonly number[] = [1, 2],
) {
  const latestByLevel = new Map<number, GoalProgression>();
  // Only the current run: pre-reset progression rows must not skew the estimate.
  const currentArrival = progressions
    .filter((p) => p.data.level === currentLevel && !p.data.abandoned_at)
    .map((p) => p.data.unlocked_at)
    .filter((d): d is string => isTimestamp(d))
    .sort()
    .at(-1);
  const abandonedAt = progressions
    .filter(
      (p) =>
        p.data.abandoned_at &&
        (!currentArrival || p.data.abandoned_at <= currentArrival),
    )
    .map((p) => p.data.abandoned_at!)
    .sort()
    .at(-1);
  for (const p of progressions) {
    const d = p.data;
    if (
      d.abandoned_at ||
      excluded.includes(d.level) ||
      !d.unlocked_at ||
      !d.passed_at ||
      d.level >= currentLevel ||
      (abandonedAt && d.unlocked_at <= abandonedAt)
    )
      continue;
    const existing = latestByLevel.get(d.level);
    if (!existing || d.unlocked_at > existing.data.unlocked_at!)
      latestByLevel.set(d.level, p);
  }
  const durations = [...latestByLevel.values()]
    .sort((a, b) => a.data.level - b.data.level)
    .slice(-5)
    .map(
      (p) =>
        (Date.parse(p.data.passed_at!) - Date.parse(p.data.unlocked_at!)) /
        DAY_MS,
    )
    .filter((d) => Number.isFinite(d) && d > 0)
    .sort((a, b) => a - b);
  return durations.length
    ? {
        typical: quantile(durations, 0.5),
        faster: quantile(durations, 0.25),
        relaxed: quantile(durations, 0.75),
        count: durations.length,
      }
    : null;
}
export function projectedArrival(
  targetLevel: number,
  currentLevel: number,
  pace: number | null,
  progressions: readonly GoalProgression[],
  now = new Date(),
): string | null {
  if (targetLevel <= currentLevel) return null;
  if (pace === null || !Number.isFinite(pace) || pace <= 0) return null;
  const current = progressions
    .filter((p) => p.data.level === currentLevel && !p.data.abandoned_at)
    .sort(
      (a, b) =>
        Date.parse(b.data.unlocked_at ?? "") -
        Date.parse(a.data.unlocked_at ?? ""),
    )[0];
  const unlockedAt = current?.data.unlocked_at
    ? Date.parse(current.data.unlocked_at)
    : NaN;
  const elapsed = Number.isFinite(unlockedAt)
    ? Math.max(0, (now.getTime() - unlockedAt) / DAY_MS)
    : 0;
  // An overdue level still needs a review; never advertise an arrival in the past or instantly today.
  const days =
    Math.max(1, pace - elapsed) +
    Math.max(0, targetLevel - currentLevel - 1) * pace;
  return new Date(now.getTime() + days * DAY_MS).toISOString();
}
export function suggestedGoalLevel(
  currentLevel: number,
  deadline: string | null,
  pace: number | null,
  progressions: readonly GoalProgression[],
  now = new Date(),
): number {
  if (currentLevel >= 60) return 60;
  if (!deadline || !pace)
    return Math.min(60, Math.ceil((currentLevel + 1) / 5) * 5);
  let target = currentLevel + 1;
  for (let level = currentLevel + 1; level <= 60; level++) {
    const date = projectedArrival(level, currentLevel, pace, progressions, now);
    if (date && localDateKey(new Date(date)) <= deadline) target = level;
    else break;
  }
  return target;
}
export function goalMilestones(goal: LevelGoal, currentLevel: number) {
  const span = goal.targetLevel - goal.startLevel;
  const levels =
    span <= 5
      ? Array.from({ length: span + 1 }, (_, i) => goal.startLevel + i)
      : [
          ...new Set([
            goal.startLevel,
            Math.max(goal.startLevel, Math.min(currentLevel, goal.targetLevel)),
            Math.min(
              goal.targetLevel,
              Math.max(currentLevel + 1, goal.startLevel + 1),
            ),
            goal.targetLevel,
          ]),
        ].sort((a, b) => a - b);
  return levels;
}
export function goalTrackFraction(goal: LevelGoal, currentLevel: number) {
  const milestones = goalMilestones(goal, currentLevel);
  const reached = milestones.filter((level) => level <= currentLevel).length;
  return Math.max(0, Math.min(1, (reached - 1) / (milestones.length - 1)));
}
export const shortGoalDate = (value: string | null) =>
  value
    ? new Date(
        value.length === 10 ? `${value}T12:00:00` : value,
      ).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year:
          new Date(
            value.length === 10 ? `${value}T12:00:00` : value,
          ).getFullYear() !== new Date().getFullYear()
            ? "numeric"
            : undefined,
      })
    : "Learning your pace";
export const goalStatusLabel = (
  outcome: GoalOutcome,
  paused = false,
  behind = false,
) =>
  outcome === "reached"
    ? "Goal reached"
    : outcome === "late"
      ? "Reached after target"
      : outcome === "missed"
        ? "Time for a new plan"
        : paused
          ? "On vacation"
          : behind
            ? "A little more time"
            : "Your next milestone";
