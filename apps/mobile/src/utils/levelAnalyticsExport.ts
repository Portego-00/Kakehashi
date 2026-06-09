import {
  type Assignment,
  type LevelProgression,
  type ReviewStatistic,
  type Subject,
} from "./api";
import { buildResetAwareLevelTimingData } from "./levelProgress";

const DAY_MS = 24 * 60 * 60 * 1000;

type ExportSubjectType = "radical" | "kanji" | "vocabulary";

type WrappedSubjectStat = {
  subjectId: number;
  characters: string;
  primaryMeaning: string;
  subjectType: ExportSubjectType;
  meaningCorrect: number;
  meaningIncorrect: number;
  readingCorrect: number;
  readingIncorrect: number;
  totalIncorrect: number;
  percentageCorrect: number;
  maxStreak: number;
  timeToGuru?: number;
};

export type LevelAnalyticsExportRow = {
  level: number;
  is_current_level: boolean;
  is_complete_level: boolean;
  level_started_at: string | null;
  level_passed_at: string | null;
  level_duration_days: number;
  level_duration_hours: number;
  level_duration_total_ms: number;
  compared_to_average_days: number;
  is_faster_than_average: boolean;
  learned_subjects_total: number;
  learned_radicals: number;
  learned_kanji: number;
  learned_vocabulary: number;
  overall_accuracy_percent: number;
  meaning_accuracy_percent: number;
  reading_accuracy_percent: number;
  total_reviews_in_level_window: number;
  most_missed_count: number;
  most_missed_subject_ids: string;
  most_missed_subjects: string;
  star_performer_subject_id: number | null;
  star_performer_characters: string | null;
  star_performer_primary_meaning: string | null;
  star_performer_subject_type: ExportSubjectType | null;
  star_performer_max_streak: number | null;
  star_performer_accuracy_percent: number | null;
  fastest_to_guru_subject_id: number | null;
  fastest_to_guru_characters: string | null;
  fastest_to_guru_primary_meaning: string | null;
  fastest_to_guru_subject_type: ExportSubjectType | null;
  fastest_to_guru_hours: number | null;
  username: string;
};

export type LevelAnalyticsDetailedExportRow = {
  level: number;
  subject_id: number;
  subject_object: string;
  subject_type: ExportSubjectType;
  slug: string;
  characters: string | null;
  primary_meaning: string | null;
  primary_reading: string | null;
  accepted_meanings: string;
  accepted_readings: string;
  is_hidden_subject: boolean;
  assignment_id: number | null;
  assignment_data_updated_at: string | null;
  assignment_srs_stage: number | null;
  assignment_available_at: string | null;
  assignment_unlocked_at: string | null;
  assignment_started_at: string | null;
  assignment_passed_at: string | null;
  assignment_burned_at: string | null;
  assignment_resurrected_at: string | null;
  assignment_hidden: boolean | null;
  meaning_correct: number | null;
  meaning_incorrect: number | null;
  reading_correct: number | null;
  reading_incorrect: number | null;
  meaning_accuracy_percent: number | null;
  reading_accuracy_percent: number | null;
  overall_accuracy_percent: number | null;
  percentage_correct: number | null;
  meaning_max_streak: number | null;
  reading_max_streak: number | null;
  meaning_current_streak: number | null;
  reading_current_streak: number | null;
  total_incorrect: number | null;
  review_stat_created_at: string | null;
  review_stat_data_updated_at: string | null;
  subject_created_at: string | null;
  subject_data_updated_at: string | null;
  document_url: string | null;
  username: string;
};

export type BuildLevelAnalyticsExportRowsParams = {
  subjects?: Subject[] | null;
  assignments?: Assignment[] | null;
  reviewStatistics?: ReviewStatistic[] | null;
  levelProgressions?: LevelProgression[] | null;
  resets?: unknown[] | null;
  currentLevel?: number | null;
  username?: string | null;
  selectedLevels?: number[] | null;
};

type LevelMetricsContext = {
  subjects: Subject[];
  assignments: Assignment[];
  currentLevel: number;
  username: string;
};

const SUMMARY_CSV_COLUMNS: (keyof LevelAnalyticsExportRow)[] = [
  "level",
  "is_current_level",
  "is_complete_level",
  "level_started_at",
  "level_passed_at",
  "level_duration_days",
  "level_duration_hours",
  "level_duration_total_ms",
  "compared_to_average_days",
  "is_faster_than_average",
  "learned_subjects_total",
  "learned_radicals",
  "learned_kanji",
  "learned_vocabulary",
  "overall_accuracy_percent",
  "meaning_accuracy_percent",
  "reading_accuracy_percent",
  "total_reviews_in_level_window",
  "most_missed_count",
  "most_missed_subject_ids",
  "most_missed_subjects",
  "star_performer_subject_id",
  "star_performer_characters",
  "star_performer_primary_meaning",
  "star_performer_subject_type",
  "star_performer_max_streak",
  "star_performer_accuracy_percent",
  "fastest_to_guru_subject_id",
  "fastest_to_guru_characters",
  "fastest_to_guru_primary_meaning",
  "fastest_to_guru_subject_type",
  "fastest_to_guru_hours",
  "username",
];

const DETAILED_CSV_COLUMNS: (keyof LevelAnalyticsDetailedExportRow)[] = [
  "level",
  "subject_id",
  "subject_object",
  "subject_type",
  "slug",
  "characters",
  "primary_meaning",
  "primary_reading",
  "accepted_meanings",
  "accepted_readings",
  "is_hidden_subject",
  "assignment_id",
  "assignment_data_updated_at",
  "assignment_srs_stage",
  "assignment_available_at",
  "assignment_unlocked_at",
  "assignment_started_at",
  "assignment_passed_at",
  "assignment_burned_at",
  "assignment_resurrected_at",
  "assignment_hidden",
  "meaning_correct",
  "meaning_incorrect",
  "reading_correct",
  "reading_incorrect",
  "meaning_accuracy_percent",
  "reading_accuracy_percent",
  "overall_accuracy_percent",
  "percentage_correct",
  "meaning_max_streak",
  "reading_max_streak",
  "meaning_current_streak",
  "reading_current_streak",
  "total_incorrect",
  "review_stat_created_at",
  "review_stat_data_updated_at",
  "subject_created_at",
  "subject_data_updated_at",
  "document_url",
  "username",
];

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSubjectType(subjectObject: string): ExportSubjectType {
  if (subjectObject === "radical") {
    return "radical";
  }

  if (subjectObject === "kanji") {
    return "kanji";
  }

  return "vocabulary";
}

function resolveCurrentLevel(params: BuildLevelAnalyticsExportRowsParams): number {
  const levelProgressions = Array.isArray(params.levelProgressions)
    ? params.levelProgressions
    : [];

  if (Number.isFinite(params.currentLevel)) {
    return Math.max(1, Math.trunc(Number(params.currentLevel)));
  }

  return Math.max(
    1,
    ...levelProgressions
      .map((progression) => Number(progression?.data?.level))
      .filter((level) => Number.isFinite(level)),
  );
}

function normalizeSelectedLevels(selectedLevels: number[] | null | undefined): Set<number> {
  const levels = new Set<number>();
  if (!Array.isArray(selectedLevels)) {
    return levels;
  }

  for (const rawLevel of selectedLevels) {
    const level = Number(rawLevel);
    if (Number.isFinite(level) && level >= 1) {
      levels.add(Math.trunc(level));
    }
  }

  return levels;
}

function shouldIncludeLevel(level: number, selectedLevels: Set<number>): boolean {
  if (selectedLevels.size === 0) {
    return true;
  }

  return selectedLevels.has(level);
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);
  if (!/[",\n\r]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replace(/"/g, '""')}"`;
}

function roundPercent(correct: number, incorrect: number): number | null {
  const total = correct + incorrect;
  if (total <= 0) {
    return null;
  }

  return Number(((correct / total) * 100).toFixed(2));
}

function serializeRows<T extends Record<string, unknown>>(
  columns: (keyof T)[],
  rows: T[]
): string {
  const lines: string[] = [columns.join(",")];

  for (const row of rows) {
    const line = columns.map((column) => escapeCsvCell(row[column])).join(",");
    lines.push(line);
  }

  return lines.join("\n");
}

function pickLatestProgressionsByLevel(
  levelProgressions: LevelProgression[]
): Map<number, LevelProgression["data"]> {
  const latestByLevel = new Map<number, LevelProgression["data"]>();

  for (const row of levelProgressions) {
    const data = row?.data;
    const level = Number(data?.level);
    if (!Number.isFinite(level) || level < 1 || !data) {
      continue;
    }

    const existing = latestByLevel.get(level);
    if (!existing) {
      latestByLevel.set(level, data);
      continue;
    }

    const existingStartTimestamp = parseTimestamp(
      existing.unlocked_at || existing.started_at
    );
    const candidateStartTimestamp = parseTimestamp(
      data.unlocked_at || data.started_at
    );

    const existingStart = existingStartTimestamp ?? Number.NEGATIVE_INFINITY;
    const candidateStart = candidateStartTimestamp ?? Number.NEGATIVE_INFINITY;

    if (candidateStart > existingStart) {
      latestByLevel.set(level, data);
      continue;
    }

    if (candidateStart === existingStart) {
      const existingPassed = parseTimestamp(existing.passed_at) ?? Number.NEGATIVE_INFINITY;
      const candidatePassed = parseTimestamp(data.passed_at) ?? Number.NEGATIVE_INFINITY;
      if (candidatePassed > existingPassed) {
        latestByLevel.set(level, data);
      }
    }
  }

  return latestByLevel;
}

function buildMostMissedSummary(subjects: WrappedSubjectStat[]): string {
  if (subjects.length === 0) {
    return "";
  }

  return subjects
    .map(
      (subject) =>
        `${subject.subjectId}:${subject.primaryMeaning}:${subject.totalIncorrect}`
    )
    .join(" | ");
}

function getRelevantLevels(
  context: LevelMetricsContext,
  timingData: ReturnType<typeof buildResetAwareLevelTimingData>
): number[] {
  const levels = new Set<number>(timingData.map((entry) => entry.level));
  const assignmentBySubjectId = new Map<number, Assignment>();

  for (const assignment of context.assignments) {
    assignmentBySubjectId.set(assignment.data.subject_id, assignment);
  }

  for (const subject of context.subjects) {
    const level = Number(subject?.data?.level);
    if (!Number.isFinite(level) || level < 1 || level > context.currentLevel) {
      continue;
    }

    const assignment = assignmentBySubjectId.get(subject.id);
    if (assignment?.data?.started_at) {
      levels.add(level);
    }
  }

  levels.add(context.currentLevel);

  return Array.from(levels.values()).sort((a, b) => a - b);
}

function computeLevelRow(
  level: number,
  context: LevelMetricsContext,
  timingByLevel: Map<number, ReturnType<typeof buildResetAwareLevelTimingData>[number]>,
  latestProgressionByLevel: Map<number, LevelProgression["data"]>,
  assignmentBySubjectId: Map<number, Assignment>,
  reviewStatBySubjectId: Map<number, ReviewStatistic>,
  completedTimingByLevel: Map<number, number>
): LevelAnalyticsExportRow {
  const timingEntry = timingByLevel.get(level);
  const progression = latestProgressionByLevel.get(level);
  const isCurrentLevel = level === context.currentLevel;
  const startedAt =
    timingEntry?.startedAt ??
    progression?.unlocked_at ??
    progression?.started_at ??
    null;
  const passedAt = timingEntry?.passedAt ?? progression?.passed_at ?? null;
  const isCompleteLevel = Boolean(passedAt);

  let timeMs = 0;
  if (timingEntry) {
    timeMs = Math.max(0, Math.round(timingEntry.timeInDays * DAY_MS));
  } else if (startedAt && passedAt) {
    timeMs = Math.max(0, Date.parse(passedAt) - Date.parse(startedAt));
  } else if (isCurrentLevel && startedAt) {
    timeMs = Math.max(0, Date.now() - Date.parse(startedAt));
  }

  const comparisonDurationsMs = Array.from(completedTimingByLevel.entries())
    .filter(([candidateLevel]) => candidateLevel !== level)
    .map(([, durationMs]) => durationMs)
    .filter((value) => Number.isFinite(value) && value > 0);
  const averageComparisonMs =
    comparisonDurationsMs.length > 0
      ? comparisonDurationsMs.reduce((sum, value) => sum + value, 0) /
        comparisonDurationsMs.length
      : 0;
  const comparisonDiffMs = timeMs - averageComparisonMs;
  const comparedToAverageDays =
    averageComparisonMs > 0
      ? Math.abs(Math.round(comparisonDiffMs / DAY_MS))
      : 0;
  const isFasterThanAverage =
    averageComparisonMs > 0 ? comparisonDiffMs < 0 : false;

  const allLevelSubjects = context.subjects.filter(
    (subject) => subject.data.level === level && !subject.data.hidden_at
  );
  const startedLevelSubjects = allLevelSubjects.filter((subject) => {
    const assignment = assignmentBySubjectId.get(subject.id);
    return Boolean(assignment?.data.started_at);
  });
  const guruPlusLevelSubjects = startedLevelSubjects.filter((subject) => {
    const assignment = assignmentBySubjectId.get(subject.id);
    return Boolean(assignment && assignment.data.srs_stage >= 5);
  });

  const learnedRadicals = guruPlusLevelSubjects.filter(
    (subject) => subject.object === "radical"
  ).length;
  const learnedKanji = guruPlusLevelSubjects.filter(
    (subject) => subject.object === "kanji"
  ).length;
  const learnedVocabulary = guruPlusLevelSubjects.filter(
    (subject) =>
      subject.object === "vocabulary" || subject.object === "kana_vocabulary"
  ).length;

  let totalMeaningCorrect = 0;
  let totalMeaningIncorrect = 0;
  let totalReadingCorrect = 0;
  let totalReadingIncorrect = 0;

  const subjectStats: WrappedSubjectStat[] = [];

  for (const subject of startedLevelSubjects) {
    const reviewStat = reviewStatBySubjectId.get(subject.id);
    if (!reviewStat) {
      continue;
    }

    const assignment = assignmentBySubjectId.get(subject.id);
    const meaningCorrect = reviewStat.data.meaning_correct;
    const meaningIncorrect = reviewStat.data.meaning_incorrect;
    const readingCorrect = reviewStat.data.reading_correct;
    const readingIncorrect = reviewStat.data.reading_incorrect;

    totalMeaningCorrect += meaningCorrect;
    totalMeaningIncorrect += meaningIncorrect;
    totalReadingCorrect += readingCorrect;
    totalReadingIncorrect += readingIncorrect;

    let timeToGuru: number | undefined;
    if (assignment?.data.unlocked_at && assignment?.data.passed_at) {
      timeToGuru =
        Date.parse(assignment.data.passed_at) -
        Date.parse(assignment.data.unlocked_at);
      if (!Number.isFinite(timeToGuru) || timeToGuru <= 0) {
        timeToGuru = undefined;
      }
    }

    const primaryMeaning =
      subject.data.meanings?.find((meaning) => meaning.primary)?.meaning ??
      subject.data.meanings?.[0]?.meaning ??
      "";

    subjectStats.push({
      subjectId: subject.id,
      characters: subject.data.characters || primaryMeaning,
      primaryMeaning,
      subjectType: normalizeSubjectType(subject.object),
      meaningCorrect,
      meaningIncorrect,
      readingCorrect,
      readingIncorrect,
      totalIncorrect: meaningIncorrect + readingIncorrect,
      percentageCorrect: reviewStat.data.percentage_correct,
      maxStreak: Math.max(
        reviewStat.data.meaning_max_streak,
        reviewStat.data.reading_max_streak
      ),
      timeToGuru,
    });
  }

  const totalCorrect = totalMeaningCorrect + totalReadingCorrect;
  const totalIncorrect = totalMeaningIncorrect + totalReadingIncorrect;
  const totalAnswers = totalCorrect + totalIncorrect;
  const overallAccuracyPercent =
    totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0;
  const meaningAccuracyPercent =
    totalMeaningCorrect + totalMeaningIncorrect > 0
      ? Math.round(
          (totalMeaningCorrect /
            (totalMeaningCorrect + totalMeaningIncorrect)) *
            100
        )
      : 0;
  const readingAccuracyPercent =
    totalReadingCorrect + totalReadingIncorrect > 0
      ? Math.round(
          (totalReadingCorrect /
            (totalReadingCorrect + totalReadingIncorrect)) *
            100
        )
      : 0;

  const isLevelUpType = (subjectType: ExportSubjectType): boolean =>
    subjectType === "radical" || subjectType === "kanji";

  const mostMissed = [...subjectStats]
    .filter((subject) => subject.totalIncorrect > 0)
    .sort((left, right) => left.percentageCorrect - right.percentageCorrect)
    .slice(0, 5);

  const starPerformer =
    [...subjectStats]
      .filter((subject) => subject.maxStreak > 0)
      .sort((left, right) => {
        const leftPriority = isLevelUpType(left.subjectType) ? 0 : 1;
        const rightPriority = isLevelUpType(right.subjectType) ? 0 : 1;
        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }
        if (right.maxStreak !== left.maxStreak) {
          return right.maxStreak - left.maxStreak;
        }
        return right.percentageCorrect - left.percentageCorrect;
      })[0] ?? null;

  const fastestToGuru =
    [...subjectStats]
      .filter((subject) => subject.timeToGuru !== undefined && subject.timeToGuru > 0)
      .sort((left, right) => {
        const leftPriority = isLevelUpType(left.subjectType) ? 0 : 1;
        const rightPriority = isLevelUpType(right.subjectType) ? 0 : 1;
        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }
        return (left.timeToGuru ?? Number.MAX_SAFE_INTEGER) -
          (right.timeToGuru ?? Number.MAX_SAFE_INTEGER);
      })[0] ?? null;

  let totalReviews = 0;
  if (startedAt) {
    const startDate = new Date(startedAt);
    const windowEndIso = passedAt || (isCurrentLevel ? new Date().toISOString() : null);
    if (windowEndIso) {
      const endDate = new Date(windowEndIso);
      for (const assignment of context.assignments) {
        const assignmentData = assignment.data;

        if (assignmentData.started_at && assignment.data_updated_at) {
          const updatedDate = new Date(assignment.data_updated_at);
          if (updatedDate >= startDate && updatedDate <= endDate) {
            totalReviews += 1;
          }
        }

        const milestoneDates = [
          assignmentData.started_at,
          assignmentData.passed_at,
          assignmentData.burned_at,
        ].filter(Boolean) as string[];

        for (const milestoneDateRaw of milestoneDates) {
          const milestoneDate = new Date(milestoneDateRaw);
          if (milestoneDate >= startDate && milestoneDate <= endDate) {
            totalReviews += 1;
          }
        }
      }
    }
  }

  return {
    level,
    is_current_level: isCurrentLevel,
    is_complete_level: isCompleteLevel,
    level_started_at: startedAt,
    level_passed_at: passedAt,
    level_duration_days: Number((timeMs / DAY_MS).toFixed(3)),
    level_duration_hours: Number((timeMs / (60 * 60 * 1000)).toFixed(2)),
    level_duration_total_ms: timeMs,
    compared_to_average_days: comparedToAverageDays,
    is_faster_than_average: isFasterThanAverage,
    learned_subjects_total: guruPlusLevelSubjects.length,
    learned_radicals: learnedRadicals,
    learned_kanji: learnedKanji,
    learned_vocabulary: learnedVocabulary,
    overall_accuracy_percent: overallAccuracyPercent,
    meaning_accuracy_percent: meaningAccuracyPercent,
    reading_accuracy_percent: readingAccuracyPercent,
    total_reviews_in_level_window: totalReviews,
    most_missed_count: mostMissed.length,
    most_missed_subject_ids: mostMissed.map((subject) => subject.subjectId).join("|"),
    most_missed_subjects: buildMostMissedSummary(mostMissed),
    star_performer_subject_id: starPerformer?.subjectId ?? null,
    star_performer_characters: starPerformer?.characters ?? null,
    star_performer_primary_meaning: starPerformer?.primaryMeaning ?? null,
    star_performer_subject_type: starPerformer?.subjectType ?? null,
    star_performer_max_streak: starPerformer?.maxStreak ?? null,
    star_performer_accuracy_percent: starPerformer?.percentageCorrect ?? null,
    fastest_to_guru_subject_id: fastestToGuru?.subjectId ?? null,
    fastest_to_guru_characters: fastestToGuru?.characters ?? null,
    fastest_to_guru_primary_meaning: fastestToGuru?.primaryMeaning ?? null,
    fastest_to_guru_subject_type: fastestToGuru?.subjectType ?? null,
    fastest_to_guru_hours:
      fastestToGuru?.timeToGuru !== undefined
        ? Number((fastestToGuru.timeToGuru / (60 * 60 * 1000)).toFixed(2))
        : null,
    username: context.username,
  };
}

export function getAvailableLevelAnalyticsLevels(
  params: BuildLevelAnalyticsExportRowsParams
): number[] {
  const subjects = Array.isArray(params.subjects) ? params.subjects : [];
  const assignments = Array.isArray(params.assignments) ? params.assignments : [];
  const levelProgressions = Array.isArray(params.levelProgressions)
    ? params.levelProgressions
    : [];
  const resolvedCurrentLevel = resolveCurrentLevel(params);

  const context: LevelMetricsContext = {
    subjects,
    assignments,
    currentLevel: resolvedCurrentLevel,
    username: params.username?.trim() ?? "",
  };

  const timingData = buildResetAwareLevelTimingData(
    levelProgressions,
    (params.resets ?? []) as unknown[],
    resolvedCurrentLevel
  );

  return getRelevantLevels(context, timingData);
}

export function buildLevelAnalyticsExportRows(
  params: BuildLevelAnalyticsExportRowsParams
): LevelAnalyticsExportRow[] {
  const subjects = Array.isArray(params.subjects) ? params.subjects : [];
  const assignments = Array.isArray(params.assignments) ? params.assignments : [];
  const reviewStatistics = Array.isArray(params.reviewStatistics)
    ? params.reviewStatistics
    : [];
  const levelProgressions = Array.isArray(params.levelProgressions)
    ? params.levelProgressions
    : [];
  const resolvedCurrentLevel = resolveCurrentLevel(params);
  const username = params.username?.trim() ?? "";

  if (subjects.length === 0 && levelProgressions.length === 0) {
    return [];
  }

  const context: LevelMetricsContext = {
    subjects,
    assignments,
    currentLevel: resolvedCurrentLevel,
    username,
  };

  const selectedLevelSet = normalizeSelectedLevels(params.selectedLevels);

  const timingData = buildResetAwareLevelTimingData(
    levelProgressions,
    (params.resets ?? []) as unknown[],
    resolvedCurrentLevel
  );
  const timingByLevel = new Map(timingData.map((entry) => [entry.level, entry]));
  const latestProgressionByLevel = pickLatestProgressionsByLevel(levelProgressions);

  const assignmentBySubjectId = new Map<number, Assignment>();
  for (const assignment of assignments) {
    assignmentBySubjectId.set(assignment.data.subject_id, assignment);
  }

  const reviewStatBySubjectId = new Map<number, ReviewStatistic>();
  for (const reviewStat of reviewStatistics) {
    reviewStatBySubjectId.set(reviewStat.data.subject_id, reviewStat);
  }

  const completedTimingByLevel = new Map<number, number>();
  for (const entry of timingData) {
    if (entry.isComplete && entry.timeInDays > 0) {
      completedTimingByLevel.set(entry.level, Math.round(entry.timeInDays * DAY_MS));
    }
  }

  const levels = getRelevantLevels(context, timingData).filter((level) =>
    shouldIncludeLevel(level, selectedLevelSet)
  );

  return levels.map((level) =>
    computeLevelRow(
      level,
      context,
      timingByLevel,
      latestProgressionByLevel,
      assignmentBySubjectId,
      reviewStatBySubjectId,
      completedTimingByLevel
    )
  );
}

export function buildLevelAnalyticsDetailedExportRows(
  params: BuildLevelAnalyticsExportRowsParams
): LevelAnalyticsDetailedExportRow[] {
  const subjects = Array.isArray(params.subjects) ? params.subjects : [];
  const assignments = Array.isArray(params.assignments) ? params.assignments : [];
  const reviewStatistics = Array.isArray(params.reviewStatistics)
    ? params.reviewStatistics
    : [];
  const selectedLevelSet = normalizeSelectedLevels(params.selectedLevels);
  const username = params.username?.trim() ?? "";

  if (subjects.length === 0) {
    return [];
  }

  const assignmentBySubjectId = new Map<number, Assignment>();
  for (const assignment of assignments) {
    assignmentBySubjectId.set(assignment.data.subject_id, assignment);
  }

  const reviewStatBySubjectId = new Map<number, ReviewStatistic>();
  for (const reviewStat of reviewStatistics) {
    reviewStatBySubjectId.set(reviewStat.data.subject_id, reviewStat);
  }

  const rows: LevelAnalyticsDetailedExportRow[] = [];

  for (const subject of subjects) {
    const level = Number(subject?.data?.level);
    if (!Number.isFinite(level) || level < 1) {
      continue;
    }

    if (!shouldIncludeLevel(level, selectedLevelSet)) {
      continue;
    }

    const assignment = assignmentBySubjectId.get(subject.id) ?? null;
    const reviewStat = reviewStatBySubjectId.get(subject.id) ?? null;

    const primaryMeaning =
      subject.data.meanings?.find((meaning) => meaning.primary)?.meaning ??
      subject.data.meanings?.[0]?.meaning ??
      null;
    const primaryReading =
      subject.data.readings?.find((reading) => reading.primary)?.reading ?? null;

    const acceptedMeanings = subject.data.meanings
      ?.filter((meaning) => meaning.accepted_answer)
      .map((meaning) => meaning.meaning)
      .join("|") ?? "";

    const acceptedReadings = subject.data.readings
      ?.filter((reading) => reading.accepted_answer)
      .map((reading) => reading.reading)
      .join("|") ?? "";

    const meaningCorrect = reviewStat?.data.meaning_correct ?? null;
    const meaningIncorrect = reviewStat?.data.meaning_incorrect ?? null;
    const readingCorrect = reviewStat?.data.reading_correct ?? null;
    const readingIncorrect = reviewStat?.data.reading_incorrect ?? null;

    const meaningAccuracyPercent =
      meaningCorrect !== null && meaningIncorrect !== null
        ? roundPercent(meaningCorrect, meaningIncorrect)
        : null;

    const readingAccuracyPercent =
      readingCorrect !== null && readingIncorrect !== null
        ? roundPercent(readingCorrect, readingIncorrect)
        : null;

    const overallAccuracyPercent =
      meaningCorrect !== null &&
      meaningIncorrect !== null &&
      readingCorrect !== null &&
      readingIncorrect !== null
        ? roundPercent(meaningCorrect + readingCorrect, meaningIncorrect + readingIncorrect)
        : null;

    rows.push({
      level,
      subject_id: subject.id,
      subject_object: subject.object,
      subject_type: normalizeSubjectType(subject.object),
      slug: subject.data.slug,
      characters: subject.data.characters,
      primary_meaning: primaryMeaning,
      primary_reading: primaryReading,
      accepted_meanings: acceptedMeanings,
      accepted_readings: acceptedReadings,
      is_hidden_subject: Boolean(subject.data.hidden_at),
      assignment_id: assignment?.id ?? null,
      assignment_data_updated_at: assignment?.data_updated_at ?? null,
      assignment_srs_stage: assignment?.data.srs_stage ?? null,
      assignment_available_at: assignment?.data.available_at ?? null,
      assignment_unlocked_at: assignment?.data.unlocked_at ?? null,
      assignment_started_at: assignment?.data.started_at ?? null,
      assignment_passed_at: assignment?.data.passed_at ?? null,
      assignment_burned_at: assignment?.data.burned_at ?? null,
      assignment_resurrected_at: assignment?.data.resurrected_at ?? null,
      assignment_hidden: assignment?.data.hidden ?? null,
      meaning_correct: meaningCorrect,
      meaning_incorrect: meaningIncorrect,
      reading_correct: readingCorrect,
      reading_incorrect: readingIncorrect,
      meaning_accuracy_percent: meaningAccuracyPercent,
      reading_accuracy_percent: readingAccuracyPercent,
      overall_accuracy_percent: overallAccuracyPercent,
      percentage_correct: reviewStat?.data.percentage_correct ?? null,
      meaning_max_streak: reviewStat?.data.meaning_max_streak ?? null,
      reading_max_streak: reviewStat?.data.reading_max_streak ?? null,
      meaning_current_streak: reviewStat?.data.meaning_current_streak ?? null,
      reading_current_streak: reviewStat?.data.reading_current_streak ?? null,
      total_incorrect:
        meaningIncorrect !== null && readingIncorrect !== null
          ? meaningIncorrect + readingIncorrect
          : null,
      review_stat_created_at: reviewStat?.data.created_at ?? null,
      review_stat_data_updated_at: reviewStat?.data_updated_at ?? null,
      subject_created_at: subject.data.created_at,
      subject_data_updated_at: subject.data_updated_at,
      document_url: subject.data.document_url,
      username,
    });
  }

  const typeWeight = (subjectType: string): number => {
    if (subjectType === "radical") {
      return 0;
    }
    if (subjectType === "kanji") {
      return 1;
    }
    return 2;
  };

  rows.sort((left, right) => {
    if (left.level !== right.level) {
      return left.level - right.level;
    }

    const leftWeight = typeWeight(left.subject_object);
    const rightWeight = typeWeight(right.subject_object);
    if (leftWeight !== rightWeight) {
      return leftWeight - rightWeight;
    }

    return left.subject_id - right.subject_id;
  });

  return rows;
}

export function serializeLevelAnalyticsExportRows(
  rows: LevelAnalyticsExportRow[]
): string {
  return serializeRows(SUMMARY_CSV_COLUMNS, rows);
}

export function serializeLevelAnalyticsDetailedExportRows(
  rows: LevelAnalyticsDetailedExportRow[]
): string {
  return serializeRows(DETAILED_CSV_COLUMNS, rows);
}
