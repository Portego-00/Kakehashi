import { useMemo } from "react";
import {
  Assignment,
  LevelProgression,
  ReviewStatistic,
  Subject,
} from "../utils/api";
import { useAuthStore } from "../utils/store";
import { useDashboardData } from "./useDashboardData";

export interface WrappedSubjectStat {
  subjectId: number;
  characters: string;
  primaryMeaning: string;
  primaryReading?: string;
  subjectType: "radical" | "kanji" | "vocabulary";
  meaningCorrect: number;
  meaningIncorrect: number;
  readingCorrect: number;
  readingIncorrect: number;
  totalIncorrect: number;
  percentageCorrect: number;
  maxStreak: number;
  /** Time in ms from unlock to guru */
  timeToGuru?: number;
}

export interface WrappedLevelSubject {
  id: number;
  /** The text character(s). May be `null` for image-only radicals. */
  characters: string | null;
  type: "radical" | "kanji";
  /** WaniKani character_images array — needed for SVG fallback on image-only radicals */
  characterImages?: {
    url: string;
    content_type: string;
    metadata: { inline_styles?: boolean; color?: string; dimensions?: string; style_name?: string };
  }[];
}

export interface WrappedData {
  level: number;
  /** Time in days to complete the level */
  timeDays: number;
  /** Time in hours (remainder after days) */
  timeHours: number;
  /** Total time in ms */
  timeMs: number;
  /** How this compares to average (positive = slower, negative = faster) */
  comparedToAverageDays: number;
  /** Whether this was faster than average */
  isFasterThanAverage: boolean;
  /** Total subjects at this level */
  totalSubjects: number;
  /** Breakdown by type */
  radicalCount: number;
  kanjiCount: number;
  vocabCount: number;
  /** Overall accuracy percentage for level subjects */
  overallAccuracy: number;
  /** Meaning accuracy */
  meaningAccuracy: number;
  /** Reading accuracy */
  readingAccuracy: number;
  /** Total reviews done during the level time period (all subjects, not just level subjects) */
  totalReviews: number;
  /** Most missed subjects (top 5) — prioritises radicals & kanji */
  mostMissed: WrappedSubjectStat[];
  /** Star performer - highest streak or best accuracy (radicals & kanji first) */
  starPerformer: WrappedSubjectStat | null;
  /** Fastest to guru (radicals & kanji first) */
  fastestToGuru: WrappedSubjectStat | null;
  /** Radicals and kanji at this level — used for the drop animation */
  levelUpSubjects: WrappedLevelSubject[];
  /** Username */
  username: string;
  /** Date level was started */
  startedAt: string | null;
  /** Date level was passed */
  passedAt: string | null;
  /** Is data ready */
  isReady: boolean;
}

export function useWrappedData(level: number): WrappedData {
  const { dashboardData } = useDashboardData();
  const storedUserData = useAuthStore((state) => state.userData);

  return useMemo(() => {
    const {
      subjects,
      assignments,
      reviewStatistics,
      levelProgressions,
    } = dashboardData;

    const username = storedUserData?.username || "";

    // Default empty state
    const empty: WrappedData = {
      level,
      timeDays: 0,
      timeHours: 0,
      timeMs: 0,
      comparedToAverageDays: 0,
      isFasterThanAverage: false,
      totalSubjects: 0,
      radicalCount: 0,
      kanjiCount: 0,
      vocabCount: 0,
      overallAccuracy: 0,
      meaningAccuracy: 0,
      readingAccuracy: 0,
      totalReviews: 0,
      mostMissed: [],
      starPerformer: null,
      fastestToGuru: null,
      levelUpSubjects: [],
      username,
      startedAt: null,
      passedAt: null,
      isReady: false,
    };

    if (
      !subjects?.length ||
      !assignments?.length ||
      !levelProgressions?.length
    ) {
      return empty;
    }

    // ── Level timing ────────────────────────────────────────────────
    const progression = (levelProgressions as LevelProgression[]).find(
      (lp) => lp.data.level === level
    );

    let timeMs = 0;
    let startedAt: string | null = null;
    let passedAt: string | null = null;

    if (progression) {
      startedAt = progression.data.unlocked_at || progression.data.started_at;
      passedAt = progression.data.passed_at;
      if (startedAt && passedAt) {
        timeMs = new Date(passedAt).getTime() - new Date(startedAt).getTime();
      }
    }

    const timeDays = Math.floor(timeMs / (1000 * 60 * 60 * 24));
    const timeHours = Math.floor(
      (timeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );

    // ── Average level time ──────────────────────────────────────────
    const completedProgressions = (levelProgressions as LevelProgression[]).filter(
      (lp) =>
        (lp.data.unlocked_at || lp.data.started_at) &&
        lp.data.passed_at &&
        lp.data.level !== level
    );

    let avgTimeMs = 0;
    if (completedProgressions.length > 0) {
      const total = completedProgressions.reduce((sum, lp) => {
        const start = lp.data.unlocked_at || lp.data.started_at!;
        return (
          sum +
          (new Date(lp.data.passed_at!).getTime() -
            new Date(start).getTime())
        );
      }, 0);
      avgTimeMs = total / completedProgressions.length;
    }

    const diffMs = timeMs - avgTimeMs;
    const comparedToAverageDays = Math.round(
      diffMs / (1000 * 60 * 60 * 24)
    );
    const isFasterThanAverage = diffMs < 0;

    // ── Assignment map (built first so we can filter by started) ────
    const assignmentMap = new Map<number, Assignment>();
    (assignments as Assignment[]).forEach((a) => {
      assignmentMap.set(a.data.subject_id, a);
    });

    // ── Level subjects ──────────────────────────────────────────────
    // All subjects defined at this level
    const allLevelSubjects = (subjects as Subject[]).filter(
      (s) => s.data.level === level && !s.data.hidden_at
    );

    // Only subjects the user has actually started (has assignment with started_at).
    // Vocabulary is NOT required to level up, so many vocab items may still be
    // locked when the user passes a level. We only want to show what was learned.
    const levelSubjects = allLevelSubjects.filter((s) => {
      const assignment = assignmentMap.get(s.id);
      return assignment && assignment.data.started_at;
    });

    // Guru+ subjects (SRS stage >= 5) for the "learned" counts.
    // Apprentice items are still in progress and shouldn't count as learned.
    const guruPlusSubjects = levelSubjects.filter((s) => {
      const a = assignmentMap.get(s.id);
      return a && a.data.srs_stage >= 5;
    });

    const radicalCount = guruPlusSubjects.filter(
      (s) => s.object === "radical"
    ).length;
    const kanjiCount = guruPlusSubjects.filter(
      (s) => s.object === "kanji"
    ).length;
    const vocabCount = guruPlusSubjects.filter(
      (s) =>
        s.object === "vocabulary" || s.object === "kana_vocabulary"
    ).length;

    // ── Review statistics map ───────────────────────────────────────
    const reviewStatMap = new Map<number, ReviewStatistic>();
    if (reviewStatistics?.length) {
      (reviewStatistics as ReviewStatistic[]).forEach((rs) => {
        reviewStatMap.set(rs.data.subject_id, rs);
      });
    }

    // ── Build per-subject stats ─────────────────────────────────────
    let totalMeaningCorrect = 0;
    let totalMeaningIncorrect = 0;
    let totalReadingCorrect = 0;
    let totalReadingIncorrect = 0;

    const subjectStats: WrappedSubjectStat[] = [];

    for (const subject of levelSubjects) {
      const rs = reviewStatMap.get(subject.id);
      const assignment = assignmentMap.get(subject.id);
      if (!rs) continue;

      const mc = rs.data.meaning_correct;
      const mi = rs.data.meaning_incorrect;
      const rc = rs.data.reading_correct;
      const ri = rs.data.reading_incorrect;

      totalMeaningCorrect += mc;
      totalMeaningIncorrect += mi;
      totalReadingCorrect += rc;
      totalReadingIncorrect += ri;

      let timeToGuru: number | undefined;
      if (assignment?.data.unlocked_at && assignment?.data.passed_at) {
        timeToGuru =
          new Date(assignment.data.passed_at).getTime() -
          new Date(assignment.data.unlocked_at).getTime();
      }

      const primaryMeaning =
        subject.data.meanings?.find((m) => m.primary)?.meaning ||
        subject.data.meanings?.[0]?.meaning ||
        "";
      const primaryReading = subject.data.readings?.find(
        (r) => r.primary
      )?.reading;

      subjectStats.push({
        subjectId: subject.id,
        characters: subject.data.characters || primaryMeaning,
        primaryMeaning,
        primaryReading: primaryReading || undefined,
        subjectType: subject.object as "radical" | "kanji" | "vocabulary",
        meaningCorrect: mc,
        meaningIncorrect: mi,
        readingCorrect: rc,
        readingIncorrect: ri,
        totalIncorrect: mi + ri,
        percentageCorrect: rs.data.percentage_correct,
        maxStreak: Math.max(
          rs.data.meaning_max_streak,
          rs.data.reading_max_streak
        ),
        timeToGuru,
      });
    }

    // ── Aggregated accuracy ─────────────────────────────────────────
    const totalCorrect = totalMeaningCorrect + totalReadingCorrect;
    const totalIncorrect = totalMeaningIncorrect + totalReadingIncorrect;
    const totalAnswers = totalCorrect + totalIncorrect;
    const overallAccuracy =
      totalAnswers > 0
        ? Math.round((totalCorrect / totalAnswers) * 100)
        : 0;
    const meaningAccuracy =
      totalMeaningCorrect + totalMeaningIncorrect > 0
        ? Math.round(
            (totalMeaningCorrect /
              (totalMeaningCorrect + totalMeaningIncorrect)) *
              100
          )
        : 0;
    const readingAccuracy =
      totalReadingCorrect + totalReadingIncorrect > 0
        ? Math.round(
            (totalReadingCorrect /
              (totalReadingCorrect + totalReadingIncorrect)) *
              100
          )
        : 0;

    // Helper: sort with radicals & kanji first, then vocab
    const isLevelUpType = (t: string) => t === "radical" || t === "kanji";

    // ── Most missed (top 5 by lowest accuracy %, min 1 wrong) ──────
    const mostMissed = [...subjectStats]
      .filter((s) => s.totalIncorrect > 0)
      .sort((a, b) => a.percentageCorrect - b.percentageCorrect)
      .slice(0, 5);

    // ── Star performer (highest max streak, then best accuracy) ─────
    // Prefer radicals & kanji
    const starPerformer =
      [...subjectStats]
        .filter((s) => s.maxStreak > 0)
        .sort((a, b) => {
          const aIsLU = isLevelUpType(a.subjectType) ? 0 : 1;
          const bIsLU = isLevelUpType(b.subjectType) ? 0 : 1;
          if (aIsLU !== bIsLU) return aIsLU - bIsLU;
          if (b.maxStreak !== a.maxStreak)
            return b.maxStreak - a.maxStreak;
          return b.percentageCorrect - a.percentageCorrect;
        })[0] || null;

    // ── Fastest to guru ─────────────────────────────────────────────
    // Prefer radicals & kanji
    const fastestToGuru =
      [...subjectStats]
        .filter((s) => s.timeToGuru !== undefined && s.timeToGuru > 0)
        .sort((a, b) => {
          const aIsLU = isLevelUpType(a.subjectType) ? 0 : 1;
          const bIsLU = isLevelUpType(b.subjectType) ? 0 : 1;
          if (aIsLU !== bIsLU) return aIsLU - bIsLU;
          return a.timeToGuru! - b.timeToGuru!;
        })[0] || null;

    // ── Level-up subjects (radicals + kanji only, for drop animation) ─
    const levelUpSubjects: WrappedLevelSubject[] = levelSubjects
      .filter((s) => s.object === "radical" || s.object === "kanji")
      .map((s) => ({
        id: s.id,
        characters: s.data.characters ?? null,
        type: s.object as "radical" | "kanji",
        characterImages: s.data.character_images ?? undefined,
      }));

    // ── Total reviews during the level period ───────────────────────
    // Count review activity from assignments during the level time period
    // (similar to ReviewHeatmap approach since /reviews endpoint is deprecated)
    let totalReviews = 0;
    if (startedAt && passedAt) {
      const startDate = new Date(startedAt);
      const endDate = new Date(passedAt);

      (assignments as Assignment[]).forEach((assignment) => {
        const data = assignment.data;

        // Count if assignment was updated during the level period (indicates review activity)
        if (data.started_at && assignment.data_updated_at) {
          const updatedDate = new Date(assignment.data_updated_at);
          if (updatedDate >= startDate && updatedDate <= endDate) {
            totalReviews++;
          }
        }

        // Also count milestone achievements during the period
        const milestoneDates = [
          data.started_at,
          data.passed_at,
          data.burned_at,
        ].filter(Boolean);

        milestoneDates.forEach((dateStr) => {
          const date = new Date(dateStr!);
          if (date >= startDate && date <= endDate) {
            totalReviews++;
          }
        });
      });
    }

    return {
      level,
      timeDays,
      timeHours,
      timeMs,
      comparedToAverageDays: Math.abs(comparedToAverageDays),
      isFasterThanAverage,
      totalSubjects: guruPlusSubjects.length,
      radicalCount,
      kanjiCount,
      vocabCount,
      overallAccuracy,
      meaningAccuracy,
      readingAccuracy,
      totalReviews,
      mostMissed,
      starPerformer,
      fastestToGuru,
      levelUpSubjects,
      username,
      startedAt,
      passedAt,
      isReady: levelSubjects.length > 0,
    };
  }, [level, dashboardData, storedUserData]);
}
