import AsyncStorage from "@react-native-async-storage/async-storage";

const READING_GOALS_STORAGE_KEY = "wanikani_reading_goals_v1";
const DEFAULT_GOAL_MINUTES = 5;
const MAX_GOAL_MINUTES = 180;
const MAX_HISTORY_DAYS = 400;

type ReadingGoalsState = {
  goalMinutes: number;
  dailySeconds: Record<string, number>;
};

export type ReadingGoalDay = {
  dateKey: string;
  label: string;
  completed: boolean;
  isToday: boolean;
};

export type ReadingGoalsProgress = {
  goalMinutes: number;
  todayMinutes: number;
  todaySeconds: number;
  todayRatio: number;
  todayCompleted: boolean;
  streakCurrent: number;
  streakBest: number;
  week: ReadingGoalDay[];
};

let writeQueue: Promise<void> = Promise.resolve();

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string): Date | null {
  const parts = dateKey.split("-");
  if (parts.length !== 3) {
    return null;
  }

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function isConsecutiveDate(previousKey: string, nextKey: string): boolean {
  const previous = parseDateKey(previousKey);
  const next = parseDateKey(nextKey);
  if (!previous || !next) {
    return false;
  }

  const oneDayMs = 24 * 60 * 60 * 1000;
  return Math.round((next.getTime() - previous.getTime()) / oneDayMs) === 1;
}

function clampGoalMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) {
    return DEFAULT_GOAL_MINUTES;
  }

  return Math.max(1, Math.min(MAX_GOAL_MINUTES, Math.round(minutes)));
}

function pruneHistory(dailySeconds: Record<string, number>, referenceDate: Date): Record<string, number> {
  const minDate = new Date(referenceDate);
  minDate.setDate(minDate.getDate() - MAX_HISTORY_DAYS);
  const minKey = getLocalDateKey(minDate);

  const next: Record<string, number> = {};
  for (const [key, value] of Object.entries(dailySeconds)) {
    if (key < minKey) {
      continue;
    }

    const numericValue = Math.max(0, Math.floor(value || 0));
    if (numericValue > 0) {
      next[key] = numericValue;
    }
  }

  return next;
}

async function readState(): Promise<ReadingGoalsState> {
  try {
    const raw = await AsyncStorage.getItem(READING_GOALS_STORAGE_KEY);
    if (!raw) {
      return { goalMinutes: DEFAULT_GOAL_MINUTES, dailySeconds: {} };
    }

    const parsed = JSON.parse(raw) as Partial<ReadingGoalsState> | null;
    const goalMinutes = clampGoalMinutes(parsed?.goalMinutes ?? DEFAULT_GOAL_MINUTES);
    const source = parsed?.dailySeconds && typeof parsed.dailySeconds === "object"
      ? parsed.dailySeconds
      : {};
    const dailySeconds: Record<string, number> = {};

    for (const [dateKey, value] of Object.entries(source)) {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        continue;
      }
      dailySeconds[dateKey] = Math.max(0, Math.floor(value));
    }

    return {
      goalMinutes,
      dailySeconds,
    };
  } catch (error) {
    console.error("Failed to read reading goals state:", error);
    return { goalMinutes: DEFAULT_GOAL_MINUTES, dailySeconds: {} };
  }
}

async function writeState(state: ReadingGoalsState): Promise<void> {
  try {
    await AsyncStorage.setItem(READING_GOALS_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Failed to write reading goals state:", error);
  }
}

function withWriteLock<T>(task: () => Promise<T>): Promise<T> {
  const nextPromise = writeQueue.then(task, task);
  writeQueue = nextPromise.then(() => undefined, () => undefined);
  return nextPromise;
}

function buildProgress(state: ReadingGoalsState, now: Date = new Date()): ReadingGoalsProgress {
  const goalMinutes = clampGoalMinutes(state.goalMinutes);
  const goalSeconds = goalMinutes * 60;
  const todayKey = getLocalDateKey(now);
  const todaySeconds = Math.max(0, Math.floor(state.dailySeconds[todayKey] || 0));
  const todayMinutes = Math.floor(todaySeconds / 60);
  const todayRatio = goalSeconds > 0 ? Math.max(0, Math.min(1, todaySeconds / goalSeconds)) : 0;
  const todayCompleted = todaySeconds >= goalSeconds;

  let streakCurrent = 0;
  const streakCursor = new Date(now);
  while (true) {
    const key = getLocalDateKey(streakCursor);
    const seconds = Math.max(0, Math.floor(state.dailySeconds[key] || 0));
    if (seconds < goalSeconds) {
      break;
    }
    streakCurrent += 1;
    streakCursor.setDate(streakCursor.getDate() - 1);
  }

  const completedKeys = Object.keys(state.dailySeconds)
    .filter((key) => Math.max(0, Math.floor(state.dailySeconds[key] || 0)) >= goalSeconds)
    .sort();
  let streakBest = 0;
  let running = 0;
  let previousKey: string | null = null;
  for (const key of completedKeys) {
    if (previousKey && isConsecutiveDate(previousKey, key)) {
      running += 1;
    } else {
      running = 1;
    }
    previousKey = key;
    if (running > streakBest) {
      streakBest = running;
    }
  }

  const week: ReadingGoalDay[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - offset);
    const dateKey = getLocalDateKey(date);
    const seconds = Math.max(0, Math.floor(state.dailySeconds[dateKey] || 0));
    const shortLabel = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);

    week.push({
      dateKey,
      label: shortLabel.slice(0, 1).toUpperCase(),
      completed: seconds >= goalSeconds,
      isToday: offset === 0,
    });
  }

  return {
    goalMinutes,
    todayMinutes,
    todaySeconds,
    todayRatio,
    todayCompleted,
    streakCurrent,
    streakBest,
    week,
  };
}

export const readingGoalsService = {
  async getProgress(now: Date = new Date()): Promise<ReadingGoalsProgress> {
    const state = await readState();
    return buildProgress(state, now);
  },

  async setGoalMinutes(minutes: number): Promise<ReadingGoalsProgress> {
    return withWriteLock(async () => {
      const state = await readState();
      const nextState: ReadingGoalsState = {
        ...state,
        goalMinutes: clampGoalMinutes(minutes),
        dailySeconds: pruneHistory(state.dailySeconds, new Date()),
      };

      await writeState(nextState);
      return buildProgress(nextState);
    });
  },

  async addReadingSeconds(seconds: number, now: Date = new Date()): Promise<ReadingGoalsProgress> {
    const normalizedSeconds = Math.max(0, Math.floor(seconds || 0));
    if (normalizedSeconds <= 0) {
      return this.getProgress(now);
    }

    return withWriteLock(async () => {
      const state = await readState();
      const key = getLocalDateKey(now);
      const current = Math.max(0, Math.floor(state.dailySeconds[key] || 0));
      const nextDailySeconds = {
        ...state.dailySeconds,
        [key]: current + normalizedSeconds,
      };

      const nextState: ReadingGoalsState = {
        ...state,
        dailySeconds: pruneHistory(nextDailySeconds, now),
      };

      await writeState(nextState);
      return buildProgress(nextState, now);
    });
  },
};
