"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createListRepository, subscribeSubjectLists, type ListStorage, type SubjectList } from "./lists";

export const browserSubjectListStorage: ListStorage = {
  getItem: (key) => typeof window === "undefined" ? null : window.localStorage.getItem(key),
  setItem: (key, value) => { if (typeof window !== "undefined") window.localStorage.setItem(key, value); },
};

function timestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function mergeSubjectLists(local: SubjectList[], remote: SubjectList[]) {
  const remoteById = new Map(remote.map((list) => [list.id, list]));
  const merged = local.map((list) => {
    const cloud = remoteById.get(list.id);
    if (!cloud) return list;
    remoteById.delete(list.id);
    return timestamp(cloud.updatedAt) >= timestamp(list.updatedAt) ? cloud : list;
  });
  return [...merged, ...remote.filter((list) => remoteById.has(list.id))];
}

async function readCloudLists() {
  const response = await fetch("/api/subjects/lists", { cache: "no-store" });
  const payload = await response.json().catch(() => null) as { lists?: SubjectList[]; error?: string } | null;
  if (!response.ok || !Array.isArray(payload?.lists)) throw new Error(payload?.error || "Subject lists could not be loaded.");
  return payload.lists;
}

const uploadQueues = new Map<string, Promise<void>>();

function queueCloudWrite(username: string, lists: SubjectList[]) {
  const previous = uploadQueues.get(username) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(async () => {
    const response = await fetch("/api/subjects/lists", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lists }),
      cache: "no-store",
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error || "Subject lists could not be synced.");
    }
  });
  uploadQueues.set(username, next);
  void next.finally(() => { if (uploadQueues.get(username) === next) uploadQueues.delete(username); }).catch(() => undefined);
  return next;
}

export function useSubjectLists(username: string, storage: ListStorage = browserSubjectListStorage) {
  const repository = useMemo(() => createListRepository(storage, username), [storage, username]);
  const subscribe = useCallback((onChange: () => void) => subscribeSubjectLists(username, onChange), [username]);
  const getSnapshot = useCallback(() => repository.snapshot(), [repository]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => "");
  const lists = useMemo(() => {
    void snapshot;
    return repository.load();
  }, [repository, snapshot]);
  const hydrated = useRef(false);
  const [syncState, setSyncState] = useState({ username, syncing: true, error: "" });
  const syncing = syncState.username === username ? syncState.syncing : true;
  const syncError = syncState.username === username ? syncState.error : "";

  useEffect(() => {
    let cancelled = false;
    hydrated.current = false;
    void (async () => {
      try {
        const remote = await readCloudLists();
        if (cancelled) return;
        const merged = mergeSubjectLists(repository.load(), remote);
        if (JSON.stringify(merged) !== JSON.stringify(repository.load())) repository.replace(merged);
        hydrated.current = true;
        if (JSON.stringify(merged) !== JSON.stringify(remote)) await queueCloudWrite(username, merged);
        if (!cancelled) setSyncState({ username, syncing: false, error: "" });
      } catch (cause) {
        if (!cancelled) setSyncState({ username, syncing: false, error: cause instanceof Error ? cause.message : "Subject lists could not be loaded." });
      }
    })();
    return () => { cancelled = true; };
  }, [repository, username]);

  useEffect(() => {
    if (!hydrated.current) return;
    void queueCloudWrite(username, repository.load()).catch((cause) => setSyncState({ username, syncing: false, error: cause instanceof Error ? cause.message : "Subject lists could not be synced." }));
  }, [repository, snapshot, username]);

  return { repository, lists, syncing, syncError };
}
