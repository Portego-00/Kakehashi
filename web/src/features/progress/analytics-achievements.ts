import type { Assignment, ReviewStatistic, SubjectType } from "@/types/wanikani";
import type { LevelTiming } from "./calculations";
import type { AnalyticsAchievement } from "./analytics-insights";

const DAY = 86_400_000;
const TIERS = ["bronze", "silver", "gold", "platinum"] as const;

function validDates(values: Array<string | null>, now: Date) {
  return values.filter((value): value is string => value !== null && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now.getTime()).sort((a, b) => Date.parse(a) - Date.parse(b));
}

export function calculateAnalyticsAchievements({ assignments, statistics, timings, currentLevel, now = new Date(), reviewHistoryAvailable = false, longestStreak = 0 }: {
  assignments: Assignment[];
  statistics: ReviewStatistic[];
  timings: LevelTiming[];
  currentLevel: number;
  now?: Date;
  reviewHistoryAvailable?: boolean;
  longestStreak?: number;
}): AnalyticsAchievement[] {
  const visible = assignments.filter((assignment) => !assignment.data.hidden);
  const achievements: AnalyticsAchievement[] = [];
  const addSeries = ({ id, label, thresholds, current, dates = [], category, description }: { id: string; label: string; thresholds: number[]; current: number; dates?: string[]; category: AnalyticsAchievement["category"]; description: (target: number) => string }) => {
    thresholds.forEach((target, index) => {
      const achieved = current >= target;
      achievements.push({ id: `${id}-${target}`, title: `${label} ${target.toLocaleString()}`, description: description(target), current, target, achieved, percentage: Math.min(100, Math.round(current / target * 100)), category, tier: TIERS[Math.min(3, Math.floor(index * 4 / thresholds.length))], earnedAt: achieved ? dates[target - 1] ?? null : null });
    });
  };
  const learned = visible.filter((assignment) => assignment.data.srs_stage > 0);
  const burned = visible.filter((assignment) => assignment.data.srs_stage >= 9 && assignment.data.burned_at);
  const byType = (items: Assignment[], types: SubjectType[]) => items.filter((assignment) => types.includes(assignment.data.subject_type));
  const lessonDates = (items: Assignment[]) => validDates(items.map((item) => item.data.started_at), now);
  const burnDates = (items: Assignment[]) => validDates(items.map((item) => item.data.burned_at), now);

  addSeries({ id: "subjects", label: "Subjects learned", thresholds: [1, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000, 9000], current: learned.length, dates: lessonDates(learned), category: "learning", description: (target) => `Learn ${target.toLocaleString()} subjects.` });
  for (const [type, label, thresholds] of [
    ["kanji", "Kanji learned", [10, 25, 50, 100, 250, 500, 1000, 1500, 2000]],
    ["vocabulary", "Vocabulary learned", [10, 50, 100, 250, 500, 1000, 2000, 4000, 6000]],
    ["radical", "Radicals learned", [10, 25, 50, 100, 200, 400]],
  ] as const) {
    const items = byType(learned, type === "vocabulary" ? ["vocabulary", "kana_vocabulary"] : [type]);
    addSeries({ id: type, label, thresholds: [...thresholds], current: items.length, dates: lessonDates(items), category: "learning", description: (target) => `Learn ${target.toLocaleString()} ${type === "vocabulary" ? "vocabulary items" : type === "kanji" ? "kanji" : "radicals"}.` });
  }
  addSeries({ id: "burns", label: "Subjects burned", thresholds: [1, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000], current: burned.length, dates: burnDates(burned), category: "mastery", description: (target) => `Reach Burned with ${target.toLocaleString()} subjects.` });
  const burnedKanji = byType(burned, ["kanji"]);
  addSeries({ id: "kanji-burns", label: "Kanji burned", thresholds: [10, 50, 100, 250, 500, 1000, 2000], current: burnedKanji.length, dates: burnDates(burnedKanji), category: "mastery", description: (target) => `Reach Burned with ${target.toLocaleString()} kanji.` });

  const levelDates = Array.from({ length: 60 }, (_, index) => timings.find((timing) => timing.level === index + 1)?.startedAt ?? "");
  addSeries({ id: "level", label: "Level", thresholds: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60], current: currentLevel, dates: levelDates, category: "level", description: (target) => `Reach WaniKani level ${target}.` });

  const started = validDates(timings.map((timing) => timing.startedAt), now)[0];
  const elapsedDays = started ? Math.max(0, Math.floor((now.getTime() - Date.parse(started)) / DAY)) : 0;
  for (const [index, target] of [30, 100, 365].entries()) {
    const achieved = elapsedDays >= target;
    achievements.push({ id: `journey-${target}`, title: `${target} days on the journey`, description: `${target} calendar days since the first recorded level.`, current: elapsedDays, target, achieved, percentage: Math.min(100, Math.round(elapsedDays / target * 100)), category: "time", tier: TIERS[index], earnedAt: achieved && started ? new Date(Date.parse(started) + target * DAY).toISOString() : null });
  }
  for (const [index, days] of [21, 14, 10, 7].entries()) {
    const completed = timings.filter((timing) => timing.level > 2 && timing.daysToPass !== null && timing.daysToPass <= days && timing.passedAt).sort((a, b) => Date.parse(a.passedAt!) - Date.parse(b.passedAt!));
    achievements.push({ id: `pace-${days}`, title: `A ${days}-day level`, description: `Pass a level in ${days} days or less, excluding accelerated levels 1 and 2.`, current: completed.length, target: 1, achieved: completed.length > 0, percentage: completed.length ? 100 : 0, category: "pace", tier: TIERS[index], earnedAt: completed[0]?.passedAt ?? null });
  }
  const flawlessSubjects = statistics.filter((statistic) => !statistic.data.hidden && statistic.data.meaning_incorrect + statistic.data.reading_incorrect === 0 && statistic.data.meaning_correct + statistic.data.reading_correct >= 10).length;
  addSeries({ id: "flawless", label: "Flawless subjects", thresholds: [1, 10, 50, 100, 250, 500], current: flawlessSubjects, category: "accuracy", description: (target) => `${target.toLocaleString()} subjects with at least 10 correct answers and no recorded errors.` });
  if (reviewHistoryAvailable) addSeries({ id: "streak", label: "Consecutive study days", thresholds: [3, 7, 14, 30, 60, 100, 365], current: longestStreak, category: "consistency", description: (target) => `Study on ${target} consecutive days within the selected activity period.` });
  // An unknown unlock date stays null; collection update dates are not proof of when a medal was earned.
  return achievements.map((achievement) => ({ ...achievement, earnedAt: achievement.earnedAt && Number.isFinite(Date.parse(achievement.earnedAt)) ? achievement.earnedAt : null }));
}
