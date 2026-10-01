"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useSession } from "@/lib/session";
import { waniKaniUserId } from "@/lib/wanikani/user-identity";
import {
  canAccessLevelGoals,
  EMPTY_GOAL_STATE,
  goalStorageKey,
  observeGoal,
  type GoalProgression,
  type LevelGoalState,
} from "../../../../src/features/level-goals/model";
import { createGoalStore } from "../../../../src/features/level-goals/storage";

const store = createGoalStore({
  read: (key) => window.localStorage.getItem(key),
  write: (key, value) => window.localStorage.setItem(key, value),
});
export function useLevelGoals(
  currentLevel?: number,
  progressions: readonly GoalProgression[] = [],
) {
  const { user, isDemo } = useSession();
  const account =
    !isDemo && canAccessLevelGoals(user?.data.username)
      ? waniKaniUserId(user) || user!.data.username
      : null;
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (
        account &&
        (event.key === goalStorageKey(account) || event.key === null)
      )
        store.invalidate(account);
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [account]);
  const read = useCallback(() => {
    try {
      return store.read(account);
    } catch {
      return EMPTY_GOAL_STATE;
    }
  }, [account]);
  const state = useSyncExternalStore(
    store.subscribe,
    read,
    () => EMPTY_GOAL_STATE,
  );
  const update = useCallback(
    (updater: (state: LevelGoalState) => LevelGoalState) => {
      if (!account) return false;
      try {
        store.update(account, updater);
        setError("");
        return true;
      } catch {
        setError("Your goal could not be saved. Please try again.");
        return false;
      }
    },
    [account],
  );
  useEffect(() => {
    if (!currentLevel || !account) return;
    const timer = setTimeout(
      () => update((s) => observeGoal(s, currentLevel, progressions, now)),
      0,
    );
    return () => clearTimeout(timer);
  }, [account, currentLevel, progressions, now, update]);
  return { state, update, error, now, allowed: !!account };
}
