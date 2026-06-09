// Utility functions for calculating level time remaining
import { Assignment, Subject } from './api';

/**
 * Apprentice stage durations in seconds, matching WaniKani's SRS system.
 */
const APPRENTICE_STAGE_DURATIONS_NORMAL: Record<number, number> = {
  1: 4 * 60 * 60,
  2: 8 * 60 * 60,
  3: 23 * 60 * 60,
  4: 47 * 60 * 60,
};

const APPRENTICE_STAGE_DURATIONS_ACCELERATED: Record<number, number> = {
  1: 2 * 60 * 60,
  2: 4 * 60 * 60,
  3: 8 * 60 * 60,
  4: 23 * 60 * 60,
};

// Date.distantFuture equivalent in JavaScript
const DISTANT_FUTURE = 8640000000000000;
const DISTANT_PAST = -8640000000000000;

type LevelAssignment = Assignment & { subject?: Subject; isLocked?: boolean };

export type LevelTimingDataPoint = {
  level: number;
  timeInDays: number;
  isComplete: boolean;
  isCurrent: boolean;
  startedAt: string | null;
  passedAt: string | null;
};

export type WkstatsLevelTimingSummary = {
  timeline: LevelTimingDataPoint[];
  averageLevelDurationDays: number;
  medianLevelDurationDays: number;
  fastestLevelDurationDays: number;
  slowestLevelDurationDays: number;
  currentLevelDurationDays: number;
  levelUpInDays: number;
};

export type LevelTimeRemainingCalculationOptions = {
  excludedLevels?: readonly number[];
  currentLevel?: number;
};

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getLatestResetTimestamp(resets: any[]): number | null {
  let latestResetTime: number | null = null;

  for (const row of resets ?? []) {
    const reset = row?.data ?? row;
    const resetTime = parseTimestamp(reset?.confirmed_at);
    if (resetTime === null) {
      continue;
    }

    if (latestResetTime === null || resetTime > latestResetTime) {
      latestResetTime = resetTime;
    }
  }

  return latestResetTime;
}

function buildMinValidStartByLevel(
  resets: any[],
  maxLevel: number
): Map<number, number> {
  const minValidStartByLevel = new Map<number, number>();

  const normalizedResets = (Array.isArray(resets) ? resets : [])
    .map((row) => row?.data ?? row)
    .sort((a, b) => {
      const aTimestamp = parseTimestamp(a?.confirmed_at) ?? 0;
      const bTimestamp = parseTimestamp(b?.confirmed_at) ?? 0;
      return aTimestamp - bTimestamp;
    });

  for (const reset of normalizedResets) {
    const resetTime = parseTimestamp(reset?.confirmed_at);
    const targetLevel = Number(reset?.target_level);
    if (resetTime === null || !Number.isFinite(targetLevel) || targetLevel < 1) {
      continue;
    }

    for (let level = targetLevel; level <= maxLevel; level += 1) {
      const minStart = minValidStartByLevel.get(level);
      if (minStart === undefined || resetTime > minStart) {
        minValidStartByLevel.set(level, resetTime);
      }
    }
  }

  return minValidStartByLevel;
}

function keepLatestValidProgressionByLevel(
  levelProgressions: any[],
  minValidStartByLevel: Map<number, number>
): Map<number, any> {
  const latestProgressionByLevel = new Map<number, any>();

  for (const row of levelProgressions ?? []) {
    const progression = row?.data ?? row;
    const level = Number(progression?.level);
    if (!Number.isFinite(level) || level < 1) {
      continue;
    }

    const startIso = progression?.unlocked_at || progression?.started_at;
    const startTimestamp = parseTimestamp(startIso);
    const minValidStart = minValidStartByLevel.get(level);

    if (
      minValidStart !== undefined &&
      startTimestamp !== null &&
      startTimestamp < minValidStart
    ) {
      continue;
    }

    const existing = latestProgressionByLevel.get(level);
    if (!existing) {
      latestProgressionByLevel.set(level, progression);
      continue;
    }

    const existingStart =
      parseTimestamp(existing.unlocked_at || existing.started_at) ??
      Number.NEGATIVE_INFINITY;
    const candidateStart = startTimestamp ?? Number.NEGATIVE_INFINITY;

    if (candidateStart > existingStart) {
      latestProgressionByLevel.set(level, progression);
      continue;
    }

    if (candidateStart === existingStart) {
      const existingPassed =
        parseTimestamp(existing.passed_at) ?? Number.NEGATIVE_INFINITY;
      const candidatePassed =
        parseTimestamp(progression.passed_at) ?? Number.NEGATIVE_INFINITY;
      if (candidatePassed > existingPassed) {
        latestProgressionByLevel.set(level, progression);
      }
    }
  }

  return latestProgressionByLevel;
}

export function buildResetAwareLevelTimingData(
  levelProgressions: any[],
  resets: any[] = [],
  currentLevel?: number
): LevelTimingDataPoint[] {
  if (!Array.isArray(levelProgressions) || levelProgressions.length === 0) {
    return [];
  }

  const maxProgressionLevel = levelProgressions.reduce((maxLevel, row) => {
    const progression = row?.data ?? row;
    const level = Number(progression?.level);
    if (!Number.isFinite(level)) return maxLevel;
    return Math.max(maxLevel, level);
  }, 0);
  const resolvedCurrentLevel = Number.isFinite(currentLevel)
    ? Number(currentLevel)
    : maxProgressionLevel;
  const maxLevel = Math.max(resolvedCurrentLevel || 0, maxProgressionLevel);

  const minValidStartByLevel = buildMinValidStartByLevel(resets, maxLevel);
  const latestProgressionByLevel = keepLatestValidProgressionByLevel(
    levelProgressions,
    minValidStartByLevel
  );

  const normalizedProgressions = Array.from(latestProgressionByLevel.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, progression]) => progression);

  const progressionsByLevel = new Map<number, any>();
  normalizedProgressions.forEach((progression) => {
    progressionsByLevel.set(Number(progression.level), progression);
  });

  return normalizedProgressions
    .map((progression) => {
      const level = Number(progression.level);
      const passedAt = progression.passed_at;
      let startTime = progression.unlocked_at;

      if (!startTime) {
        startTime = progression.started_at;
      }

      if (!startTime && level === resolvedCurrentLevel) {
        const prevLevelProgression = progressionsByLevel.get(level - 1);
        const prevPassedAt = prevLevelProgression?.passed_at;
        if (prevPassedAt) {
          startTime = prevPassedAt;
        }
      }

      let timeInDays = 0;
      let isComplete = false;

      if (startTime && passedAt) {
        const startDate = new Date(startTime);
        const passDate = new Date(passedAt);
        timeInDays =
          (passDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        isComplete = true;
      } else if (startTime && level === resolvedCurrentLevel) {
        const startDate = new Date(startTime);
        const now = new Date();
        timeInDays =
          (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        isComplete = false;
      }

      return {
        level,
        timeInDays,
        isComplete,
        isCurrent: level === resolvedCurrentLevel,
        startedAt: startTime ?? null,
        passedAt: passedAt ?? null,
      };
    })
    .filter((data) => (data.isComplete && data.timeInDays > 0) || data.isCurrent)
    .sort((a, b) => a.level - b.level);
}

export function calculateWkstatsLevelTimingSummary(
  levelProgressions: any[],
  resets: any[] = [],
  currentLevel?: number
): WkstatsLevelTimingSummary {
  const timeline = buildResetAwareLevelTimingData(
    levelProgressions,
    resets,
    currentLevel
  );
  const completedDurations = timeline
    .filter((entry) => entry.isComplete && !entry.isCurrent)
    .map((entry) => entry.timeInDays)
    .filter((days) => Number.isFinite(days) && days > 0);

  const averageLevelDurationDays = completedDurations.length
    ? completedDurations.reduce((sum, value) => sum + value, 0) /
      completedDurations.length
    : 8;

  let medianLevelDurationDays = 8;
  if (completedDurations.length > 0) {
    const sorted = [...completedDurations].sort((a, b) => a - b);
    const mid = (sorted.length - 1) / 2;
    medianLevelDurationDays =
      (sorted[Math.floor(mid)] + sorted[Math.ceil(mid)]) / 2;
  }

  const fastestLevelDurationDays = completedDurations.length
    ? Math.min(...completedDurations)
    : 0;
  const slowestLevelDurationDays = completedDurations.length
    ? Math.max(...completedDurations)
    : 0;

  const currentLevelDurationDays =
    timeline.find((entry) => entry.isCurrent)?.timeInDays ?? 0;
  const levelUpInDays = Math.max(
    medianLevelDurationDays - currentLevelDurationDays,
    0
  );

  return {
    timeline,
    averageLevelDurationDays,
    medianLevelDurationDays,
    fastestLevelDurationDays,
    slowestLevelDurationDays,
    currentLevelDurationDays,
    levelUpInDays,
  };
}

function pickLatestProgressionsByLevel(
  levelProgressions: any[],
  cutoffTimestamp: number | null
): any[] {
  const latestByLevel = new Map<number, any>();

  for (const row of levelProgressions ?? []) {
    const normalized = row?.data ?? row;
    const level = Number(normalized?.level);
    if (!Number.isFinite(level) || level < 1) {
      continue;
    }

    const startIso =
      row?.data?.unlocked_at ??
      row?.unlocked_at ??
      row?.data?.started_at ??
      row?.started_at;
    const startTimestamp = parseTimestamp(startIso);

    if (
      cutoffTimestamp !== null &&
      startTimestamp !== null &&
      startTimestamp < cutoffTimestamp
    ) {
      continue;
    }

    const existing = latestByLevel.get(level);
    if (!existing) {
      latestByLevel.set(level, row);
      continue;
    }

    const existingStartIso =
      existing?.data?.unlocked_at ??
      existing?.unlocked_at ??
      existing?.data?.started_at ??
      existing?.started_at;
    const existingStartTimestamp = parseTimestamp(existingStartIso) ?? Number.NEGATIVE_INFINITY;
    const candidateStartTimestamp = startTimestamp ?? Number.NEGATIVE_INFINITY;

    if (candidateStartTimestamp > existingStartTimestamp) {
      latestByLevel.set(level, row);
      continue;
    }

    if (candidateStartTimestamp === existingStartTimestamp) {
      const existingPassedTimestamp =
        parseTimestamp(existing?.data?.passed_at ?? existing?.passed_at) ??
        Number.NEGATIVE_INFINITY;
      const candidatePassedTimestamp =
        parseTimestamp(row?.data?.passed_at ?? row?.passed_at) ??
        Number.NEGATIVE_INFINITY;
      if (candidatePassedTimestamp > existingPassedTimestamp) {
        latestByLevel.set(level, row);
      }
    }
  }

  return Array.from(latestByLevel.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) => row);
}

function getResetAwareLevelProgressions(
  levelProgressions: any[],
  resets: any[]
): any[] {
  const latestResetTimestamp = getLatestResetTimestamp(resets);
  const postResetProgressions = pickLatestProgressionsByLevel(
    levelProgressions,
    latestResetTimestamp
  );

  // Fallback to all history if we couldn't build a meaningful post-reset sample.
  if (latestResetTimestamp !== null && postResetProgressions.length === 0) {
    return pickLatestProgressionsByLevel(levelProgressions, null);
  }

  return postResetProgressions;
}

/**
 * Calculates the estimated time until a user can level up
 * 
 * @param assignments Current level assignments with attached subject data
 * @param allLevelProgressions All level progressions for the user
 * @returns Object with finish date and whether it's an estimate
 */
export function calculateLevelTimeRemaining(
  assignments: LevelAssignment[],
  allLevelProgressions: any[],
  resets: any[] = [],
  options: LevelTimeRemainingCalculationOptions = {}
): { finish: Date; isEstimate: boolean } {
  const radicalDates: Date[] = [];
  const guruDates: Date[] = [];
  const subjects: Subject[] = [];

  // Process radicals to find guru dates.
  for (const assignment of assignments) {
    if (assignment.data.subject_type !== 'radical') {
      continue;
    }

    if (!assignment.subject) {
      continue;
    }

    const guruDate = calculateGuruDate(assignment, assignment.subject);
    if (guruDate) {
      radicalDates.push(guruDate);
    }
  }

  radicalDates.sort((a, b) => a.getTime() - b.getTime());
  const nowMs = Date.now();

  const lastRadicalGuruTime = radicalDates.length > 0
    ? Math.max(
        0,
        (radicalDates[radicalDates.length - 1].getTime() - nowMs) / 1000
      )
    : 0;

  // Process kanji assignments.
  for (const assignment of assignments) {
    if (assignment.data.subject_type !== 'kanji') {
      continue;
    }

    if (assignment.subject) {
      subjects.push(assignment.subject);
    }

    const isLocked = assignment.isLocked === true || !assignment.data.unlocked_at;

    if (isLocked) {
      guruDates.push(new Date(DISTANT_FUTURE));
      continue;
    }

    if (assignment.subject) {
      const guruDate = calculateGuruDate(assignment, assignment.subject);
      if (guruDate) {
        guruDates.push(guruDate);
      }
    }
  }

  guruDates.sort((a, b) => a.getTime() - b.getTime());

  const dropGuruCount = Math.floor(guruDates.length * 0.1);
  const trimmedGuruDates = dropGuruCount > 0
    ? guruDates.slice(0, guruDates.length - dropGuruCount)
    : [...guruDates];

  const sortedSubjects = [...subjects].sort((a, b) => b.data.level - a.data.level);

  const dropSubjectCount = Math.floor(sortedSubjects.length * 0.1);
  const trimmedSubjects = dropSubjectCount > 0
    ? sortedSubjects.slice(0, sortedSubjects.length - dropSubjectCount)
    : sortedSubjects;

  if (trimmedGuruDates.length === 0 || trimmedSubjects.length === 0) {
    return { finish: new Date(), isEstimate: false };
  }

  const lastGuruDate = trimmedGuruDates[trimmedGuruDates.length - 1];
  const lastSubject = trimmedSubjects[trimmedSubjects.length - 1];

  if (lastGuruDate.getTime() === DISTANT_FUTURE && lastSubject) {
    let average = calculateAverageLevelTimeRemaining(
      allLevelProgressions,
      resets,
      options
    );

    // Floor estimate at minimum apprentice-to-guru time for a fresh item plus
    // any time left before the last radical can be guru'd.
    const minGuruTime =
      minimumTimeUntilGuru(lastSubject, 1) + lastRadicalGuruTime;

    average = Math.max(average, minGuruTime);

    return {
      finish: new Date(Date.now() + average * 1000),
      isEstimate: true
    };
  }

  return { finish: lastGuruDate, isEstimate: false };
}

/**
 * Calculates when an assignment will reach Guru status
 */
function calculateGuruDate(
  assignment: LevelAssignment,
  subject: Subject
): Date | null {
  if (assignment.data.passed_at) {
    return new Date(assignment.data.passed_at);
  }

  if (assignment.data.srs_stage >= 5) {
    return new Date(DISTANT_PAST);
  }

  const reviewDate = getReviewDate(assignment);
  if (!reviewDate) {
    return null;
  }

  const nextSrsStage = assignment.data.srs_stage <= 0
    ? 1
    : assignment.data.srs_stage + 1;
  const guruSeconds = minimumTimeUntilGuru(subject, nextSrsStage);
  return new Date(reviewDate.getTime() + guruSeconds * 1000);
}

function getReviewDate(assignment: LevelAssignment): Date | null {
  const isLocked = assignment.isLocked === true || !assignment.data.unlocked_at;
  if (assignment.data.burned_at || isLocked) {
    return null;
  }

  // Round "available now" items to the current hour for coarse review timing.
  const reviewDate = new Date();
  reviewDate.setMinutes(0, 0, 0);

  if (!assignment.data.available_at) {
    return reviewDate;
  }

  const availableDate = new Date(assignment.data.available_at);
  if (Number.isNaN(availableDate.getTime())) {
    return reviewDate;
  }

  return reviewDate < availableDate ? availableDate : reviewDate;
}

function minimumTimeUntilGuru(subject: Subject, srsStage: number): number {
  let time = 0;
  for (let stage = srsStage; stage >= 1 && stage <= 4; stage += 1) {
    time += apprenticeStageDurationSeconds(subject, stage);
  }
  return time;
}

function apprenticeStageDurationSeconds(subject: Subject, stage: number): number {
  const level = subject.data.level;
  const isAccelerated = typeof level === 'number' && level <= 2;
  const durations = isAccelerated
    ? APPRENTICE_STAGE_DURATIONS_ACCELERATED
    : APPRENTICE_STAGE_DURATIONS_NORMAL;
  return durations[stage] ?? 0;
}

/**
 * Calculates the average time remaining in a level based on past level progressions
 */
function calculateAverageLevelTimeRemaining(
  levelProgressions: any[],
  resets: any[] = [],
  options: LevelTimeRemainingCalculationOptions = {}
): number {
  const hasLevelMetadata = (levelProgressions ?? []).some((level) => {
    const normalized = level?.data ?? level;
    const parsedLevel = Number(normalized?.level);
    return Number.isFinite(parsedLevel) && parsedLevel >= 1;
  });

  const resetAwareProgressions = hasLevelMetadata
    ? getResetAwareLevelProgressions(levelProgressions, resets)
    : levelProgressions ?? [];
  const timeSpentAtEachLevel: number[] = [];
  const excludedLevelSet = new Set<number>();

  for (const level of options.excludedLevels ?? []) {
    const parsedLevel = Number(level);
    if (Number.isFinite(parsedLevel) && parsedLevel >= 1) {
      excludedLevelSet.add(Math.trunc(parsedLevel));
    }
  }

  const currentLevel = Number.isFinite(options.currentLevel)
    ? Math.trunc(Number(options.currentLevel))
    : null;

  for (let index = 0; index < resetAwareProgressions.length; index += 1) {
    const level = resetAwareProgressions[index];
    const normalized = level?.data ?? level;
    const progressionLevel = Number(normalized?.level);
    const hasProgressionLevel = Number.isFinite(progressionLevel);
    const normalizedProgressionLevel = hasProgressionLevel
      ? Math.trunc(progressionLevel)
      : null;
    const isCurrentLevelProgression =
      currentLevel !== null
        ? normalizedProgressionLevel === currentLevel
        : index === resetAwareProgressions.length - 1;

    if (
      normalizedProgressionLevel !== null &&
      excludedLevelSet.has(normalizedProgressionLevel) &&
      !isCurrentLevelProgression
    ) {
      continue;
    }

    const timeSpentCurrent = getTimeSpentCurrent(level);
    if (timeSpentCurrent > 0) {
      timeSpentAtEachLevel.push(timeSpentCurrent);
    }
  }

  if (timeSpentAtEachLevel.length === 0) {
    return 0;
  }

  const currentLevelTime = timeSpentAtEachLevel[timeSpentAtEachLevel.length - 1];
  const lastPassIndex = timeSpentAtEachLevel.length - 1;

  const lowerIndex = Math.floor(lastPassIndex / 4) + (lastPassIndex % 4 === 3 ? 1 : 0);
  const upperIndex = Math.floor(lastPassIndex * 3 / 4) + (lastPassIndex === 1 ? 1 : 0);

  const medianPassRange = timeSpentAtEachLevel.slice(lowerIndex, upperIndex + 1);

  const sum = medianPassRange.reduce((acc, time) => acc + time, 0);
  const averageTime = sum / medianPassRange.length;
  const remainingTime = averageTime - currentLevelTime;
  return remainingTime;
}

function getTimeSpentCurrent(level: any): number {
  const directTimeSpent = level?.timeSpentCurrent;
  if (typeof directTimeSpent === 'number') {
    return directTimeSpent;
  }

  const nestedTimeSpent = level?.data?.timeSpentCurrent;
  if (typeof nestedTimeSpent === 'number') {
    return nestedTimeSpent;
  }

  const startedAt = level?.data?.started_at ?? level?.started_at;
  const unlockedAt = level?.data?.unlocked_at ?? level?.unlocked_at;
  const passedAt = level?.data?.passed_at ?? level?.passed_at;

  const startTimeIso = startedAt || unlockedAt;
  if (!startTimeIso) {
    return 0;
  }

  const startTimeMs = Date.parse(startTimeIso);
  if (Number.isNaN(startTimeMs)) {
    return 0;
  }

  const endTimeMs = passedAt ? Date.parse(passedAt) : Date.now();
  if (Number.isNaN(endTimeMs)) {
    return 0;
  }

  const deltaSeconds = Math.floor((endTimeMs - startTimeMs) / 1000);
  return deltaSeconds > 0 ? deltaSeconds : 0;
}

/**
 * Represents the progress of a single level
 */
export interface LevelProgress {
  level: number;
  radical: {
    total: number;
    guru: number;
    passed: number;
    notStarted: number;
    apprentice: number;
  };
  kanji: {
    total: number;
    guru: number;
    passed: number;
    notStarted: number;
    apprentice: number;
  };
  vocabulary: {
    total: number;
    guru: number;
    passed: number;
    notStarted: number;
    apprentice: number;
  };
  overall: {
    total: number;
    guru: number;
    passed: number;
    notStarted: number;
    apprentice: number;
    completionPercent: number;
  };
}

/**
 * Identifies previous levels that are not yet completed (have subjects not at Guru+ level)
 * and calculates their progress breakdown. Also includes the current level.
 */
export function getIncompletePreviousLevels(
  subjects: Subject[],
  assignments: Assignment[],
  currentLevel: number
): LevelProgress[] {
  // Create assignment lookup for faster access
  const assignmentMap = new Map<number, Assignment>();
  assignments.forEach(assignment => {
    assignmentMap.set(assignment.data.subject_id, assignment);
  });

  // Group subjects by level (skip hidden/deprecated subjects)
  const subjectsByLevel = new Map<number, Subject[]>();
  subjects.filter(s => !s.data.hidden_at).forEach(subject => {
    const level = subject.data.level;
    if (level <= currentLevel) { // Include current level and previous levels
      if (!subjectsByLevel.has(level)) {
        subjectsByLevel.set(level, []);
      }
      subjectsByLevel.get(level)!.push(subject);
    }
  });

  const incompleteLevels: LevelProgress[] = [];

  // Analyze each level (including current)
  for (const [level, levelSubjects] of subjectsByLevel) {
    const progress = calculateLevelProgress(levelSubjects, assignmentMap);

    // For current level, always include it
    // For previous levels, only include if incomplete
    const isCurrentLevel = level === currentLevel;
    const hasIncompleteSubjects = progress.overall.total > progress.overall.guru;

    if (isCurrentLevel || hasIncompleteSubjects) {
      incompleteLevels.push({
        level,
        ...progress
      });
    }
  }

  // Sort by level (ascending)
  incompleteLevels.sort((a, b) => a.level - b.level);

  return incompleteLevels;
}

/**
 * Calculates detailed progress breakdown for a specific level
 */
function calculateLevelProgress(
  levelSubjects: Subject[],
  assignmentMap: Map<number, Assignment>
): Omit<LevelProgress, 'level'> {
  const progress = {
    radical: { total: 0, guru: 0, passed: 0, notStarted: 0, apprentice: 0 },
    kanji: { total: 0, guru: 0, passed: 0, notStarted: 0, apprentice: 0 },
    vocabulary: { total: 0, guru: 0, passed: 0, notStarted: 0, apprentice: 0 },
    overall: { total: 0, guru: 0, passed: 0, notStarted: 0, apprentice: 0, completionPercent: 0 }
  };

  levelSubjects.forEach(subject => {
    const assignment = assignmentMap.get(subject.id);
    const rawType = subject.object;

    // Map kana_vocabulary to vocabulary, skip unknown types
    const subjectType = rawType === 'kana_vocabulary' ? 'vocabulary'
      : rawType as 'radical' | 'kanji' | 'vocabulary';

    if (!['radical', 'kanji', 'vocabulary'].includes(subjectType)) {
      return;
    }

    const typeProgress = progress[subjectType];
    typeProgress.total++;
    progress.overall.total++;

    if (!assignment || !assignment.data.started_at) {
      // Not started
      typeProgress.notStarted++;
      progress.overall.notStarted++;
    } else if (assignment.data.passed_at) {
      // Passed (Guru+ and beyond)
      typeProgress.passed++;
      progress.overall.passed++;
      
      // Also count as guru since passed means at least Guru
      typeProgress.guru++;
      progress.overall.guru++;
    } else if (assignment.data.srs_stage >= 5) {
      // At Guru level but not passed yet
      typeProgress.guru++;
      progress.overall.guru++;
    } else if (assignment.data.srs_stage >= 1) {
      // Apprentice level (1-4)
      typeProgress.apprentice++;
      progress.overall.apprentice++;
    } else {
      // Started but at lesson stage (SRS 0)
      typeProgress.notStarted++;
      progress.overall.notStarted++;
    }
  });

  // Calculate overall completion percentage (Guru+ subjects / total subjects)
  progress.overall.completionPercent = progress.overall.total > 0 
    ? Math.round((progress.overall.guru / progress.overall.total) * 100)
    : 0;

  return progress;
}

/**
 * Gets the progress breakdown for a specific level
 */
export function getLevelProgressBreakdown(
  level: number,
  subjects: Subject[],
  assignments: Assignment[]
): LevelProgress | null {
  // Filter subjects for the specific level (skip hidden/deprecated subjects)
  const levelSubjects = subjects.filter(subject => subject.data.level === level && !subject.data.hidden_at);
  
  if (levelSubjects.length === 0) {
    return null;
  }

  // Create assignment lookup
  const assignmentMap = new Map<number, Assignment>();
  assignments.forEach(assignment => {
    assignmentMap.set(assignment.data.subject_id, assignment);
  });

  const progress = calculateLevelProgress(levelSubjects, assignmentMap);
  
  return {
    level,
    ...progress
  };
}

/**
 * Formats a date into a human-readable time interval string
 */
export function formatTimeInterval(targetDate: Date): string {
  const now = new Date();

  if (targetDate <= now) {
    return "Now";
  }

  const diffMs = targetDate.getTime() - now.getTime();

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }

  if (hours > 0) {
    // Hide minutes while hours are present.
    return `${hours}h`;
  }

  return `${minutes}m`;
}
