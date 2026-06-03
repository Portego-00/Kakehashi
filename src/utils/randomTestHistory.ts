import AsyncStorage from "@react-native-async-storage/async-storage";

export const RANDOM_TEST_SUBJECT_HISTORY_STORAGE_KEY =
  "extra_study_random_test_subject_history_v1";
export const RANDOM_TEST_HISTORY_SESSION_LIMIT = 5;

export interface RandomTestSubjectHistoryEntry {
  generatedAt: number;
  subjectIds: number[];
}

interface RandomTestSelectableSubject {
  id: number;
}

function normalizeSubjectIds(values: unknown): number[] {
  if (!Array.isArray(values)) return [];

  const seen = new Set<number>();
  const out: number[] = [];
  for (const value of values) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const subjectId = Math.floor(value);
    if (subjectId <= 0 || seen.has(subjectId)) continue;
    seen.add(subjectId);
    out.push(subjectId);
  }
  return out;
}

export function sanitizeRandomTestSubjectHistory(
  value: unknown,
  limit = RANDOM_TEST_HISTORY_SESSION_LIMIT
): RandomTestSubjectHistoryEntry[] {
  if (!Array.isArray(value)) return [];

  const out: RandomTestSubjectHistoryEntry[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;

    const subjectIds = normalizeSubjectIds(
      (entry as Partial<RandomTestSubjectHistoryEntry>).subjectIds
    );
    if (subjectIds.length === 0) continue;

    const generatedAt = (entry as Partial<RandomTestSubjectHistoryEntry>)
      .generatedAt;
    out.push({
      generatedAt:
        typeof generatedAt === "number" && Number.isFinite(generatedAt)
          ? generatedAt
          : 0,
      subjectIds,
    });

    if (out.length >= limit) break;
  }

  return out;
}

export async function loadRandomTestSubjectHistory(): Promise<
  RandomTestSubjectHistoryEntry[]
> {
  const rawValue = await AsyncStorage.getItem(
    RANDOM_TEST_SUBJECT_HISTORY_STORAGE_KEY
  );
  if (!rawValue) return [];

  try {
    return sanitizeRandomTestSubjectHistory(JSON.parse(rawValue));
  } catch {
    return [];
  }
}

export async function saveRandomTestSubjectHistoryEntry(
  subjectIds: number[],
  generatedAt = Date.now()
): Promise<void> {
  const normalizedSubjectIds = normalizeSubjectIds(subjectIds);
  if (normalizedSubjectIds.length === 0) return;

  const history = await loadRandomTestSubjectHistory();
  const nextHistory = sanitizeRandomTestSubjectHistory([
    { generatedAt, subjectIds: normalizedSubjectIds },
    ...history,
  ]);

  await AsyncStorage.setItem(
    RANDOM_TEST_SUBJECT_HISTORY_STORAGE_KEY,
    JSON.stringify(nextHistory)
  );
}

export function getRecentRandomTestSubjectIds(
  history: RandomTestSubjectHistoryEntry[],
  sessionLimit = RANDOM_TEST_HISTORY_SESSION_LIMIT
): number[] {
  const seen = new Set<number>();
  const out: number[] = [];

  for (const entry of history.slice(0, sessionLimit)) {
    for (const subjectId of entry.subjectIds) {
      if (seen.has(subjectId)) continue;
      seen.add(subjectId);
      out.push(subjectId);
    }
  }

  return out;
}

function sampleSubjects<T>(
  subjects: T[],
  count: number,
  randomFn: () => number
): T[] {
  const pool = [...subjects];
  const maxSubjects = Math.min(Math.max(0, Math.floor(count)), pool.length);

  for (let i = 0; i < maxSubjects; i++) {
    const randomIndex = i + Math.floor(randomFn() * (pool.length - i));
    [pool[i], pool[randomIndex]] = [pool[randomIndex], pool[i]];
  }

  return pool.slice(0, maxSubjects);
}

export function selectRandomTestSubjects<T extends RandomTestSelectableSubject>(
  subjects: T[],
  count: number,
  options: {
    avoidSubjectIds?: ReadonlySet<number>;
    randomFn?: () => number;
  } = {}
): T[] {
  const maxSubjects = Math.min(Math.max(0, Math.floor(count)), subjects.length);
  if (maxSubjects === 0) return [];

  const avoidSubjectIds = options.avoidSubjectIds ?? new Set<number>();
  const randomFn = options.randomFn ?? Math.random;
  const freshSubjects = subjects.filter(
    (subject) => !avoidSubjectIds.has(subject.id)
  );

  if (freshSubjects.length >= maxSubjects) {
    return sampleSubjects(freshSubjects, maxSubjects, randomFn);
  }

  const recentSubjects = subjects.filter((subject) =>
    avoidSubjectIds.has(subject.id)
  );
  const selectedSubjects = [
    ...sampleSubjects(freshSubjects, freshSubjects.length, randomFn),
    ...sampleSubjects(recentSubjects, maxSubjects - freshSubjects.length, randomFn),
  ];

  return sampleSubjects(selectedSubjects, selectedSubjects.length, randomFn);
}
