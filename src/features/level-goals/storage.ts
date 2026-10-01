import {
  EMPTY_GOAL_STATE,
  goalStorageKey,
  parseGoalState,
  type LevelGoalState,
} from "./model";

/** One account-scoped store shared by every entry point. Save before publishing so failed writes never look successful. */
export function createGoalStore(storage: {
  read: (key: string) => string | null | undefined;
  write: (key: string, value: string) => void;
}) {
  const cache = new Map<string, LevelGoalState>();
  const listeners = new Set<() => void>();
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    read(account: string | null) {
      if (!account) return EMPTY_GOAL_STATE;
      if (!cache.has(account))
        cache.set(
          account,
          parseGoalState(storage.read(goalStorageKey(account))),
        );
      return cache.get(account)!;
    },
    update(
      account: string,
      updater: (state: LevelGoalState) => LevelGoalState,
    ) {
      const previous = this.read(account);
      const next = updater(previous);
      if (next === previous) return;
      storage.write(goalStorageKey(account), JSON.stringify(next));
      cache.set(account, next);
      listeners.forEach((listener) => listener());
    },
    invalidate(account: string) {
      cache.delete(account);
      listeners.forEach((listener) => listener());
    },
  };
}
