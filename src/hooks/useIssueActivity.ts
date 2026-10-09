import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { getIssueActivity, type IssueActivity } from "../services/issueActivityService";
import { isUnreadIssueActivity, loadIssueVisits, subscribeIssueVisits } from "../utils/issueReadState";

export function useIssueActivity(userId: string | undefined, username: string | undefined) {
  const [items, setItems] = useState<IssueActivity[]>([]);
  const [visits, setVisits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const load = useCallback(async (signal?: AbortSignal, preserveOrder = true) => {
    if (!userId || !username) return;
    const generation = ++requestId.current;
    try {
      const [next, read] = await Promise.all([getIssueActivity(userId, username, signal), loadIssueVisits(userId)]);
      if (signal?.aborted || generation !== requestId.current) return;
      setVisits(read);
      setItems((previous) => {
        if (!preserveOrder) return next;
        const byId = new Map(next.map((item) => [item.issue.id, item]));
        const existing = previous.flatMap((item) => { const updated = byId.get(item.issue.id); byId.delete(item.issue.id); return updated ? [updated] : []; });
        return [...existing, ...byId.values()];
      });
      setError("");
    } catch (cause) {
      if (!signal?.aborted && generation === requestId.current) setError(cause instanceof Error ? cause.message : "Your activity could not be loaded.");
    } finally { if (!signal?.aborted && generation === requestId.current) setLoading(false); }
  }, [userId, username]);
  useEffect(() => { setItems([]); setVisits({}); }, [userId]);
  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    setLoading(true);
    void load(controller.signal);
    const timer = setInterval(() => void load(controller.signal), 60_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [load]));
  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeIssueVisits(() => { if (userId) void loadIssueVisits(userId).then((next) => { if (active) setVisits(next); }); });
    return () => { active = false; unsubscribe(); };
  }, [userId]);
  return { items, loading, error, reload: () => { setLoading(true); void load(undefined, false); }, visits, unreadCount: items.filter((item) => isUnreadIssueActivity(item, visits)).length };
}
