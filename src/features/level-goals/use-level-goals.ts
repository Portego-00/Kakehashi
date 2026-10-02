import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { permanentStorage } from "../../utils/permanentStorage";
import { useAuthStore } from "../../utils/store";
import {
  canAccessLevelGoals,
  EMPTY_GOAL_STATE,
  observeGoal,
  type GoalProgression,
  type LevelGoalState,
} from "./model";
import { createGoalStore } from "./storage";

const store = createGoalStore({
  read: (key) => permanentStorage.getString(key),
  write: (key, value) => permanentStorage.set(key, value),
});
export function useLevelGoals(
  currentLevel?: number,
  progressions: readonly GoalProgression[] = [],
) {
  const user = useAuthStore((s) => s.userData);
  const account = canAccessLevelGoals(user?.username)
    ? String(user?.id ?? user?.username)
    : null;
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
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
