import AsyncStorage from "@react-native-async-storage/async-storage";

export const LEVEL_TIMING_EXCLUDED_STORAGE_KEY_PREFIX =
  "wanikani_level_timing_disabled_levels_v1";

type LevelTimingExcludedLevelsListener = (
  userId: string | null,
  levels: number[]
) => void;

const listeners = new Set<LevelTimingExcludedLevelsListener>();

export function normalizeLevelTimingExcludedLevels(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Set<number>();
  for (const entry of value) {
    const parsed = Number(entry);
    if (Number.isFinite(parsed) && parsed >= 1) {
      unique.add(Math.trunc(parsed));
    }
  }

  return Array.from(unique).sort((a, b) => a - b);
}

export function areLevelTimingExcludedLevelsEqual(
  left: readonly number[],
  right: readonly number[]
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

export function getLevelTimingExcludedStorageKey(
  userId: string | null | undefined
): string {
  return `${LEVEL_TIMING_EXCLUDED_STORAGE_KEY_PREFIX}:${userId ?? "anonymous"}`;
}

function notifyLevelTimingExcludedLevelsChanged(
  userId: string | null,
  levels: number[]
) {
  for (const listener of listeners) {
    listener(userId, levels);
  }
}

export function subscribeLevelTimingExcludedLevels(
  listener: LevelTimingExcludedLevelsListener
): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export async function loadLevelTimingExcludedLevels(
  userId: string | null | undefined
): Promise<number[]> {
  const raw = await AsyncStorage.getItem(getLevelTimingExcludedStorageKey(userId));
  if (!raw) {
    return [];
  }

  return normalizeLevelTimingExcludedLevels(JSON.parse(raw));
}

export async function saveLevelTimingExcludedLevels(
  userId: string | null | undefined,
  levels: readonly number[]
): Promise<void> {
  const normalizedLevels = normalizeLevelTimingExcludedLevels([...levels]);
  await AsyncStorage.setItem(
    getLevelTimingExcludedStorageKey(userId),
    JSON.stringify(normalizedLevels)
  );
  notifyLevelTimingExcludedLevelsChanged(userId ?? null, normalizedLevels);
}
