import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  getCachedUsageStreakHistory,
  peekUsageStreakHistory,
  readUsageStreakHistory,
  subscribeUsageStreakHistory,
  type UsageStreakHistory,
} from "../services/usageStreakService";
import { buildRecentDays, getTimezone, toDayKeyInTimezone, usageStreakSnapshot } from "../utils/usageStreak";

export type { UsageStreakDay } from "../utils/usageStreak";

function currentClock() {
  const now = new Date();
  const timezone = getTimezone();
  return { now, timezone, today: toDayKeyInTimezone(now, timezone) };
}

type ReaderState = {
  scope: string;
  history: UsageStreakHistory | null;
  isLoading: boolean;
  error: string | null;
};

export function useUsageStreak(userId?: string) {
  const [clock, setClock] = useState(currentClock);
  const scope = JSON.stringify([userId, clock.timezone]);
  const currentUser = useRef(userId);
  currentUser.current = userId;
  const generation = useRef(0);
  const [state, setState] = useState<ReaderState>(() => ({
    scope,
    history: userId ? peekUsageStreakHistory(userId, clock.timezone) : null,
    isLoading: Boolean(userId),
    error: null,
  }));

  const load = useCallback(async (force: boolean) => {
    const nextClock = currentClock();
    setClock(nextClock);
    const nextScope = JSON.stringify([userId, nextClock.timezone]);
    const request = ++generation.current;
    const isCurrent = () => request === generation.current && currentUser.current === userId;
    setState((previous) => ({
      scope: nextScope,
      history: previous.scope === nextScope ? previous.history : null,
      isLoading: Boolean(userId),
      error: null,
    }));
    if (!userId) return;

    try {
      const cached = await getCachedUsageStreakHistory(userId, nextClock.timezone);
      if (!isCurrent()) return;
      if (cached) setState({ scope: nextScope, history: cached, isLoading: false, error: null });
      const history = await readUsageStreakHistory(userId, nextClock.timezone, { force });
      if (isCurrent()) setState({ scope: nextScope, history, isLoading: false, error: null });
    } catch (cause) {
      if (!isCurrent()) return;
      setState((previous) => ({
        ...previous,
        isLoading: false,
        error: cause instanceof Error ? cause.message : "Could not load streak data.",
      }));
    }
  }, [userId]);

  useEffect(() => {
    void load(false);
    return () => { generation.current += 1; };
  }, [load]);

  useEffect(() => subscribeUsageStreakHistory((confirmedUser) => {
    if (confirmedUser === userId) void load(false);
  }), [load, userId]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") void load(false);
    });
    // This timer only checks the local clock. It does not poll the server.
    const timer = setInterval(() => {
      if (AppState.currentState !== "active") return;
      const next = currentClock();
      if (next.today !== clock.today || next.timezone !== clock.timezone) void load(false);
    }, 30_000);
    return () => { subscription.remove(); clearInterval(timer); };
  }, [load, clock.today, clock.timezone]);

  const history = state.scope === scope ? state.history : null;
  const snapshot = useMemo(() => history && userId
    ? usageStreakSnapshot(history.activeDays, clock.timezone, clock.now)
    : {
      currentStreak: 0,
      longestStreak: 0,
      activeToday: false,
      freezeAvailable: false,
      freezeDaysUntilReload: 7,
      recentDays: buildRecentDays(new Set(), clock.today),
      timezone: clock.timezone,
    }, [history, userId, clock]);
  const refresh = useCallback(() => load(true), [load]);

  return {
    ...snapshot,
    isLoading: !history && (state.scope !== scope ? Boolean(userId) : state.isLoading),
    error: state.scope === scope ? state.error : null,
    refresh,
  };
}
