import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import type { BunproDueResponse, BunproQueueResponse } from "../types/bunpro";
import { BunproApiError, getActiveBunproApiToken, getBunproAnalytics, getBunproDue, getBunproQueue } from "../utils/bunproApi";
import { bunproAnalyticsResources, type BunproAnalyticsData } from "../utils/bunproAnalytics";
import { isPortegoUsername } from "../utils/portegoAccess";
import { useAuthStore } from "../utils/store";

type Status = "disabled" | "unconfigured" | "loading" | "ready" | "error";
type Snapshot = {
  accountKey: string;
  status: Status;
  token: string | null;
  due: BunproDueResponse | null;
  queue: BunproQueueResponse | null;
  analytics: BunproAnalyticsData | null;
  error: string | null;
  refreshing: boolean;
};
const empty = { token: null, due: null, queue: null, analytics: null, error: null, refreshing: false };

/** Screen-scoped, read-only Bunpro data; no calls are made for other accounts. */
export function useBunproDashboard({ scope = "home", enabled = true, refreshKey = 0 }: { scope?: "home" | "analytics"; enabled?: boolean; refreshKey?: number } = {}) {
  const username = useAuthStore(state => state.userData?.username);
  const userId = useAuthStore(state => state.userData?.id);
  const wkToken = useAuthStore(state => state.apiToken);
  const eligible = isPortegoUsername(username);
  // Re-authentication must also invalidate responses from a previous account session.
  const accountKey = `${userId ?? ""}:${username ?? ""}:${wkToken ?? ""}:${scope}`;
  const [snapshot, setSnapshot] = useState<Snapshot>({ ...empty, accountKey, status: eligible && enabled ? "loading" : "disabled" });
  const requestRef = useRef<{ id: number; controller: AbortController | null }>({ id: 0, controller: null });
  const tokenRef = useRef<string | null>(null);
  const currentAccountRef = useRef(accountKey);
  currentAccountRef.current = accountKey;

  const refresh = useCallback(async () => {
    requestRef.current.controller?.abort();
    const id = ++requestRef.current.id;
    if (!eligible || !enabled) {
      tokenRef.current = null;
      setSnapshot({ ...empty, accountKey, status: "disabled" });
      return;
    }
    const controller = new AbortController();
    requestRef.current.controller = controller;
    const isCurrent = () => !controller.signal.aborted && requestRef.current.id === id && currentAccountRef.current === accountKey;
    setSnapshot(previous => previous.accountKey === accountKey ? { ...previous, refreshing: true, error: null } : { ...empty, accountKey, status: "loading", refreshing: true });
    try {
      const token = await getActiveBunproApiToken();
      if (!isCurrent()) return;
      if (!token) {
        tokenRef.current = null;
        setSnapshot({ ...empty, accountKey, status: "unconfigured" });
        return;
      }
      if (tokenRef.current !== token) {
        tokenRef.current = token;
        setSnapshot({ ...empty, accountKey, status: "loading", token, refreshing: true });
      }
      const options = { apiToken: token, signal: controller.signal };
      if (scope === "analytics") {
        const analytics = await getBunproAnalytics(options);
        if (isCurrent()) setSnapshot({ ...empty, accountKey, status: "ready", token, due: analytics.due, analytics });
      } else {
        const [due, queue] = await Promise.all([getBunproDue(options), getBunproQueue(options)]);
        const validatedDue = bunproAnalyticsResources.due.schema.parse(due);
        if (!Array.isArray(queue?.data) || queue.data.some(item => !item?.attributes || typeof item.attributes !== "object") || (queue.included != null && !Array.isArray(queue.included))) {
          throw new Error("Bunpro returned an invalid lesson queue.");
        }
        if (isCurrent()) setSnapshot({ ...empty, accountKey, status: "ready", token, due: validatedDue, queue });
      }
    } catch (error) {
      if (!isCurrent()) return;
      const invalidToken = error instanceof BunproApiError && [401, 403].includes(error.status);
      // Do not retain personal statistics after an authentication failure.
      setSnapshot(previous => ({ ...(invalidToken || previous.accountKey !== accountKey ? empty : previous), accountKey, status: "error", refreshing: false, error: invalidToken ? "Your Bunpro API key needs reconnecting." : "Bunpro could not be refreshed. Please try again." }));
    }
  }, [accountKey, eligible, enabled, scope]);

  useFocusEffect(useCallback(() => {
    // Reading this marker deliberately makes a parent refresh re-run the effect.
    void refreshKey;
    void refresh();
    return () => {
      requestRef.current.controller?.abort();
      requestRef.current.id++;
    };
    // A parent pull-to-refresh can refresh this screen without sharing credentials.
  }, [refresh, refreshKey]));

  const visible = !eligible || !enabled ? { ...empty, status: "disabled" as const } : snapshot.accountKey === accountKey ? snapshot : { ...empty, status: "loading" as const };
  return { status: visible.status, token: visible.token, due: visible.due, queue: visible.queue, analytics: visible.analytics, error: visible.error, refreshing: visible.refreshing, eligible, refresh };
}
