import AsyncStorage from "@react-native-async-storage/async-storage";
import { permanentStorage } from "./permanentStorage";

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

function parseLevelTimingExcludedLevels(
  raw: string | null | undefined
): number[] | null {
  if (!raw) {
    return null;
  }

  try {
    return normalizeLevelTimingExcludedLevels(JSON.parse(raw));
  } catch {
    return null;
  }
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
  const storageKey = getLevelTimingExcludedStorageKey(userId);

  try {
    const durableLevels = parseLevelTimingExcludedLevels(
      permanentStorage.getString(storageKey)
    );
    if (durableLevels) {
      return durableLevels;
    }
  } catch (error) {
    console.warn(
      "Failed to read level timing exclusions from durable storage:",
      error
    );
  }

  let legacyRaw: string | null = null;
  try {
    legacyRaw = await AsyncStorage.getItem(storageKey);
  } catch (error) {
    console.warn(
      "Failed to read level timing exclusions from AsyncStorage:",
      error
    );
    return [];
  }

  const legacyLevels = parseLevelTimingExcludedLevels(legacyRaw);
  if (!legacyLevels) {
    return [];
  }

  try {
    permanentStorage.set(storageKey, JSON.stringify(legacyLevels));
  } catch (error) {
    console.warn(
      "Failed to migrate level timing exclusions to durable storage:",
      error
    );
  }

  return legacyLevels;
}

export async function saveLevelTimingExcludedLevels(
  userId: string | null | undefined,
  levels: readonly number[]
): Promise<void> {
  const normalizedLevels = normalizeLevelTimingExcludedLevels([...levels]);
  const storageKey = getLevelTimingExcludedStorageKey(userId);
  const serializedLevels = JSON.stringify(normalizedLevels);
  let savedDurably = false;

  try {
    permanentStorage.set(storageKey, serializedLevels);
    savedDurably = true;
    notifyLevelTimingExcludedLevelsChanged(userId ?? null, normalizedLevels);
  } catch (error) {
    console.warn(
      "Failed to save level timing exclusions to durable storage:",
      error
    );
  }

  try {
    await AsyncStorage.setItem(storageKey, serializedLevels);
    if (!savedDurably) {
      notifyLevelTimingExcludedLevelsChanged(userId ?? null, normalizedLevels);
    }
  } catch (error) {
    if (!savedDurably) {
      throw error;
    }

    console.warn(
      "Failed to mirror level timing exclusions to AsyncStorage:",
      error
    );
  }
}
