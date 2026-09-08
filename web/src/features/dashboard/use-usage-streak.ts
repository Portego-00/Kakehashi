"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { browserTimezone, cachedUsageStreak, dayKeyInTimezone, fetchUsageStreak } from "./usage-streak";

export function useUsageStreak({ userId, username, now, enabled }: { userId: string; username: string; now: Date; enabled: boolean }) {
  const timezone = browserTimezone();
  const today = dayKeyInTimezone(now, timezone);
  const nowMs = now.getTime();
  const cached = useMemo(() => cachedUsageStreak({ userId, timezone, now: new Date(nowMs) }), [userId, timezone, nowMs]);
  return useQuery({
    queryKey: ["analytics", "app-streak", userId, username, timezone, today],
    queryFn: ({ signal }) => fetchUsageStreak({ userId, username, timezone, now: new Date(nowMs), signal }),
    placeholderData: cached,
    staleTime: 5 * 60_000,
    enabled: enabled && Boolean(userId),
    retry: false,
  });
}
