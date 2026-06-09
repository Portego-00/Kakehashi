import { supabase } from "../lib/supabase";
import type { ReadingGoalDay, ReadingGoalsProgress } from "./readingGoalsService";

type EpubReadingStreakRow = {
  user_id: string;
  goal_minutes: number;
  today_minutes: number;
  today_seconds: number;
  today_ratio: number;
  today_completed: boolean;
  streak_current: number;
  streak_best: number;
  week: unknown;
  updated_at?: string | null;
};

const DEFAULT_GOAL_MINUTES = 5;
let didWarnAboutMissingTable = false;

function isMissingTableError(error: unknown, tableName: string): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = String((error as { code?: unknown }).code ?? "");
  const message = String((error as { message?: unknown }).message ?? "").toLowerCase();
  const target = tableName.toLowerCase();
  return code === "42P01" || (message.includes("does not exist") && message.includes(target));
}

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sanitizeNumber(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return value;
}

function sanitizeWeek(week: unknown): ReadingGoalDay[] {
  if (!Array.isArray(week)) {
    return [];
  }

  return week
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const day = entry as Partial<ReadingGoalDay>;
      if (typeof day.dateKey !== "string" || typeof day.label !== "string") {
        return null;
      }

      return {
        dateKey: day.dateKey,
        label: day.label,
        completed: Boolean(day.completed),
        isToday: Boolean(day.isToday),
      };
    })
    .filter((day): day is ReadingGoalDay => day !== null);
}

function toReadingGoalsProgress(row: EpubReadingStreakRow): ReadingGoalsProgress {
  const goalMinutes = Math.max(1, Math.round(sanitizeNumber(row.goal_minutes, DEFAULT_GOAL_MINUTES)));
  const todaySeconds = Math.max(0, Math.floor(sanitizeNumber(row.today_seconds, 0)));
  const week = sanitizeWeek(row.week);
  const inferredRatio = goalMinutes > 0 ? todaySeconds / (goalMinutes * 60) : 0;

  return {
    goalMinutes,
    todayMinutes: Math.max(0, Math.floor(sanitizeNumber(row.today_minutes, Math.floor(todaySeconds / 60)))),
    todaySeconds,
    todayRatio: Math.max(0, Math.min(1, sanitizeNumber(row.today_ratio, inferredRatio))),
    todayCompleted: Boolean(row.today_completed),
    streakCurrent: Math.max(0, Math.floor(sanitizeNumber(row.streak_current, 0))),
    streakBest: Math.max(0, Math.floor(sanitizeNumber(row.streak_best, 0))),
    week,
  };
}

function toRowPayload(userId: string, progress: ReadingGoalsProgress): Omit<EpubReadingStreakRow, "updated_at"> & { updated_at: string } {
  return {
    user_id: userId,
    goal_minutes: Math.max(1, Math.round(progress.goalMinutes || DEFAULT_GOAL_MINUTES)),
    today_minutes: Math.max(0, Math.floor(progress.todayMinutes || 0)),
    today_seconds: Math.max(0, Math.floor(progress.todaySeconds || 0)),
    today_ratio: Math.max(0, Math.min(1, sanitizeNumber(progress.todayRatio, 0))),
    today_completed: Boolean(progress.todayCompleted),
    streak_current: Math.max(0, Math.floor(progress.streakCurrent || 0)),
    streak_best: Math.max(0, Math.floor(progress.streakBest || 0)),
    week: Array.isArray(progress.week) ? progress.week : [],
    updated_at: new Date().toISOString(),
  };
}

function hasMeaningfulProgress(progress: ReadingGoalsProgress): boolean {
  if (progress.todaySeconds > 0 || progress.streakCurrent > 0 || progress.streakBest > 0) {
    return true;
  }

  return progress.week.some((day) => day.completed);
}

function getProgressScore(progress: ReadingGoalsProgress): number {
  const completedDaysInWeek = progress.week.reduce((count, day) => count + (day.completed ? 1 : 0), 0);
  return (
    progress.streakBest * 100000 +
    progress.streakCurrent * 1000 +
    completedDaysInWeek * 100 +
    progress.todaySeconds
  );
}

function chooseSyncedProgress(
  localProgress: ReadingGoalsProgress,
  remoteProgress: ReadingGoalsProgress | null,
  remoteUpdatedAt: string | null
): ReadingGoalsProgress {
  if (!remoteProgress) {
    return localProgress;
  }

  const localHasMeaningfulProgress = hasMeaningfulProgress(localProgress);
  const remoteHasMeaningfulProgress = hasMeaningfulProgress(remoteProgress);

  if (!remoteHasMeaningfulProgress) {
    return localProgress;
  }

  if (!localHasMeaningfulProgress) {
    return remoteProgress;
  }

  if (!remoteUpdatedAt) {
    return localProgress;
  }

  const todayKey = getLocalDateKey(new Date());
  const remoteUpdatedDayKey = getLocalDateKey(new Date(remoteUpdatedAt));
  if (remoteUpdatedDayKey !== todayKey) {
    return localProgress;
  }

  return getProgressScore(remoteProgress) > getProgressScore(localProgress)
    ? remoteProgress
    : localProgress;
}

function areProgressEqual(left: ReadingGoalsProgress, right: ReadingGoalsProgress): boolean {
  if (
    left.goalMinutes !== right.goalMinutes ||
    left.todayMinutes !== right.todayMinutes ||
    left.todaySeconds !== right.todaySeconds ||
    left.todayRatio !== right.todayRatio ||
    left.todayCompleted !== right.todayCompleted ||
    left.streakCurrent !== right.streakCurrent ||
    left.streakBest !== right.streakBest
  ) {
    return false;
  }

  if (left.week.length !== right.week.length) {
    return false;
  }

  for (let index = 0; index < left.week.length; index += 1) {
    const leftDay = left.week[index];
    const rightDay = right.week[index];
    if (
      leftDay.dateKey !== rightDay.dateKey ||
      leftDay.label !== rightDay.label ||
      leftDay.completed !== rightDay.completed ||
      leftDay.isToday !== rightDay.isToday
    ) {
      return false;
    }
  }

  return true;
}

class EpubReadingStreakService {
  async getProgress(userId: string): Promise<{ progress: ReadingGoalsProgress; updatedAt: string | null } | null> {
    const { data, error } = await supabase
      .from("epub_reading_streaks")
      .select(
        "user_id, goal_minutes, today_minutes, today_seconds, today_ratio, today_completed, streak_current, streak_best, week, updated_at"
      )
      .eq("user_id", userId)
      .maybeSingle<EpubReadingStreakRow>();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return {
      progress: toReadingGoalsProgress(data),
      updatedAt: typeof data.updated_at === "string" ? data.updated_at : null,
    };
  }

  async upsertProgress(userId: string, progress: ReadingGoalsProgress): Promise<void> {
    const payload = toRowPayload(userId, progress);

    const { error } = await supabase
      .from("epub_reading_streaks")
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      throw error;
    }
  }

  async syncProgress(userId: string, localProgress: ReadingGoalsProgress): Promise<ReadingGoalsProgress> {
    try {
      const remoteEntry = await this.getProgress(userId);
      const chosenProgress = chooseSyncedProgress(
        localProgress,
        remoteEntry?.progress ?? null,
        remoteEntry?.updatedAt ?? null
      );

      if (!remoteEntry || !areProgressEqual(chosenProgress, remoteEntry.progress)) {
        await this.upsertProgress(userId, chosenProgress);
      }

      return chosenProgress;
    } catch (error) {
      if (isMissingTableError(error, "epub_reading_streaks")) {
        if (!didWarnAboutMissingTable) {
          didWarnAboutMissingTable = true;
          console.warn(
            "EPUB streak sync table is missing. Run supabase_migration_epub_reading_streaks.sql to enable syncing."
          );
        }
        return localProgress;
      }

      console.error("Failed to sync EPUB reading streak progress:", error);
      return localProgress;
    }
  }
}

export const epubReadingStreakService = new EpubReadingStreakService();
