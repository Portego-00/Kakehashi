"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export function communityAccountScope(user: unknown) {
  const record = user && typeof user === "object" ? user as { id?: unknown; data?: { username?: unknown } } : null;
  const value = record?.id ?? record?.data?.username ?? "anonymous";
  return String(value).trim().toLocaleLowerCase() || "anonymous";
}

export function communityDraftKey(accountScope: string, name: string) {
  return `community-draft:${encodeURIComponent(accountScope)}:${encodeURIComponent(name)}`;
}

export function readCommunityDraft<T>(key: string, fallback: T): T {
  try { const value = window.localStorage.getItem(key); return value ? { ...fallback, ...JSON.parse(value) } : fallback; }
  catch { return fallback; }
}

export function writeCommunityDraft(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

export function clearCommunityDraft(key: string) {
  try { window.localStorage.removeItem(key); }
  catch { /* Storage may be unavailable in hardened browser modes. */ }
}

export function getOrCreateOperationId(operations: Map<string, string>, key: string, create: () => string) {
  const existing = operations.get(key);
  if (existing) return existing;
  const next = create(); operations.set(key, next); return next;
}

export function confirmOperation(operations: Map<string, string>, key: string) { operations.delete(key); }

export function usePersistentCommunityDraft<T>(accountScope: string, name: string, initialValue: T) {
  const [fallback] = useState<T>(() => initialValue);
  const key = communityDraftKey(accountScope, name);
  const stored = useMemo(() => readCommunityDraft(key, fallback), [fallback, key]);
  const [updates, setUpdates] = useState<Record<string, T>>({});
  const value = Object.prototype.hasOwnProperty.call(updates, key) ? updates[key] : stored;
  const update = useCallback((next: T | ((current: T) => T)) => {
    const resolved = typeof next === "function" ? (next as (current: T) => T)(value) : next;
    writeCommunityDraft(key, resolved); setUpdates((current) => ({ ...current, [key]: resolved }));
  }, [key, value]);
  const clear = useCallback(() => { clearCommunityDraft(key); setUpdates((current) => ({ ...current, [key]: fallback })); }, [fallback, key]);
  return [value, update, clear] as const;
}

export function useDraftNavigationGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const beforeLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!target || target.target === "_blank" || target.hasAttribute("download")) return;
      if (!window.confirm("Leave this page? Your unsent draft is saved for this account.")) { event.preventDefault(); event.stopPropagation(); }
    };
    let restoringHistory = false;
    const beforeHistoryNavigation = () => {
      if (restoringHistory) { restoringHistory = false; return; }
      if (!window.confirm("Leave this page? Your unsent draft is saved for this account.")) { restoringHistory = true; window.history.go(1); }
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", beforeHistoryNavigation);
    document.addEventListener("click", beforeLink, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); window.removeEventListener("popstate", beforeHistoryNavigation); document.removeEventListener("click", beforeLink, true); };
  }, [dirty]);
}
