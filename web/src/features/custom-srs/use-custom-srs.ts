"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { completeCustomLesson, enrollCustomVocabularyPack, recordCustomReview } from "./model";
import { customSrsOutboxSnapshot, enqueueCustomSrsMutation, flushCustomSrsOutbox, newerCustomSrsResponse, parseCustomSrsOutbox, projectCustomSrsOutbox, readCustomSrsOutbox, rememberCustomSrsRemote, retryCustomSrsOutbox, subscribeCustomSrsOutbox, type MutationPayload, type RemoteStateResponse } from "./outbox";
import { customSrsSnapshot, customSrsStorageKey, loadCustomSrsState, saveCustomSrsState, subscribeCustomSrs, withCustomSrsStorageLock } from "./storage";
import type { CustomSrsState, CustomVocabularyPack } from "./types";
import { isDemoMode } from "@/features/demo/runtime";

type CloudRevisionNotice = {
  revision: number;
  nonce: string;
};

function cloudRevisionStorageKey(scope: string | number) {
  return `${customSrsStorageKey(scope)}:cloud-revision`;
}

function notifyCloudRevision(scope: string | number, revision: number) {
  if (typeof window === "undefined") return;
  try {
    const notice: CloudRevisionNotice = {
      revision,
      nonce: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    };
    window.localStorage.setItem(cloudRevisionStorageKey(scope), JSON.stringify(notice));
  } catch {
    // Progress is already saved remotely; cross-tab refresh is best-effort.
  }
}

function revisionFromStorageEvent(event: StorageEvent, key: string) {
  if (event.key !== key || !event.newValue) return null;
  try {
    const notice = JSON.parse(event.newValue) as Partial<CloudRevisionNotice>;
    return Number.isInteger(notice.revision) ? notice.revision as number : null;
  } catch {
    return null;
  }
}

export class CustomSrsApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "CustomSrsApiError";
  }
}

async function parseResponse(response: Response) {
  const payload = await response.json().catch(() => null) as (Partial<RemoteStateResponse> & { error?: string }) | null;
  if (!response.ok) throw new CustomSrsApiError(payload?.error || "Custom vocabulary progress could not be reached.", response.status);
  if (!payload || typeof payload.available !== "boolean") throw new CustomSrsApiError("Custom vocabulary progress returned an invalid response.", 502);
  return payload as RemoteStateResponse;
}

export async function fetchCustomSrsState(signal?: AbortSignal, scope?: string | number) {
  if (isDemoMode()) return { available: false, state: null, revision: 0 };
  const account = scope === undefined ? "" : `?accountId=${encodeURIComponent(String(scope))}`;
  return parseResponse(await fetch(`/api/custom-srs${account}`, { cache: "no-store", signal }));
}

export async function mutateCustomSrs(payload: MutationPayload) {
  if (isDemoMode()) return { available: false, state: null, revision: 0 };
  return parseResponse(await fetch("/api/custom-srs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  }));
}

export function useCustomSrs(scope: string | number, packs: readonly CustomVocabularyPack[]) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["custom-srs", String(scope)] as const, [scope]);
  const cloudRevisionKey = useMemo(() => cloudRevisionStorageKey(scope), [scope]);
  const active = useRef({ scope, mounted: true });
  const [storageError, setStorageError] = useState("");
  useEffect(() => {
    active.current = { scope, mounted: true };
    return () => { active.current.mounted = false; };
  }, [scope]);
  const remote = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const incoming = await fetchCustomSrsState(signal, scope);
      return newerCustomSrsResponse(queryClient.getQueryData<RemoteStateResponse>(queryKey), incoming);
    },
    staleTime: 30_000,
  });
  const subscribe = useCallback((onChange: () => void) => subscribeCustomSrs(scope, onChange), [scope]);
  const getSnapshot = useCallback(() => customSrsSnapshot(scope), [scope]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => "");
  const localState = useMemo(() => {
    void snapshot;
    if (typeof window === "undefined") return loadCustomSrsState({ getItem: () => null }, scope, packs);
    return loadCustomSrsState(window.localStorage, scope, packs);
  }, [packs, scope, snapshot]);
  const subscribeOutbox = useCallback((onChange: () => void) => subscribeCustomSrsOutbox(scope, onChange), [scope]);
  const getOutboxSnapshot = useCallback(() => customSrsOutboxSnapshot(scope), [scope]);
  const outboxSnapshot = useSyncExternalStore(subscribeOutbox, getOutboxSnapshot, () => "");
  const restored = useMemo(() => {
    try { return { outbox: parseCustomSrsOutbox(outboxSnapshot, scope), error: "" }; }
    catch (cause) { return { outbox: null, error: cause instanceof Error ? cause.message : "Saved answers could not be read." }; }
  }, [outboxSnapshot, scope]);
  const outbox = restored.outbox;
  const state = useMemo(() => {
    if (remote.data?.available === false && !outbox?.pending.length) return localState;
    if (outbox) return projectCustomSrsOutbox(outbox, packs, remote.data);
    return remote.data?.available && remote.data.state ? remote.data.state : localState;
  }, [localState, outbox, packs, remote.data]);

  useEffect(() => {
    if (!remote.data?.available) return;
    void rememberCustomSrsRemote(scope, remote.data).catch((cause) => {
      if (active.current.mounted && active.current.scope === scope) setStorageError(cause instanceof Error ? cause.message : "Browser storage is unavailable.");
    });
  }, [remote.data, scope]);

  const sync = useCallback(async function drain() {
    const isActive = () => active.current.mounted && active.current.scope === scope && !isDemoMode();
    if (!isActive()) return;
    try {
      await flushCustomSrsOutbox(scope, mutateCustomSrs, (incoming) => {
        queryClient.setQueryData<RemoteStateResponse>(queryKey, (current) => newerCustomSrsResponse(current, incoming));
        notifyCloudRevision(scope, incoming.revision);
      }, isActive);
      // A remount can attach while the old worker is finishing. Resume its queue
      // once the delivery lock is released, rather than waiting for another click.
      const remaining = readCustomSrsOutbox(scope);
      if (isActive() && remaining?.pending.length && remaining.retryAt <= Date.now()) queueMicrotask(() => void drain());
    } catch (cause) {
      if (isActive()) setStorageError(cause instanceof Error ? cause.message : "Browser storage is unavailable.");
    }
  }, [queryClient, queryKey, scope]);

  const retrySync = useCallback(async () => {
    try {
      await retryCustomSrsOutbox(scope);
      setStorageError("");
      void sync();
    } catch (cause) {
      setStorageError(cause instanceof Error ? cause.message : "Browser storage is unavailable.");
    }
  }, [scope, sync]);

  useEffect(() => {
    if (!outbox?.pending.length || restored.error || isDemoMode()) return;
    const delay = Math.max(0, outbox.retryAt - Date.now());
    if (delay > 30_000) return; // Authentication/conflict failures need an explicit retry.
    const timer = window.setTimeout(() => void sync(), delay);
    return () => window.clearTimeout(timer);
  }, [outbox, restored.error, sync]);

  useEffect(() => {
    const onOnline = () => { void retrySync(); };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [retrySync]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      const announcedRevision = revisionFromStorageEvent(event, cloudRevisionKey);
      if (announcedRevision === null) return;
      const current = queryClient.getQueryData<RemoteStateResponse>(queryKey);
      if (current?.available && current.revision >= announcedRevision) return;
      void queryClient.refetchQueries({ queryKey, exact: true, type: "active" });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [cloudRevisionKey, queryClient, queryKey]);

  const updateLocal = useCallback((transform: (current: CustomSrsState) => CustomSrsState) => withCustomSrsStorageLock(scope, () => {
    if (typeof window === "undefined") throw new CustomSrsApiError("Browser storage is unavailable.", 0);
    const next = transform(loadCustomSrsState(window.localStorage, scope, packs));
    if (!saveCustomSrsState(window.localStorage, scope, next)) throw new CustomSrsApiError("Browser storage is full or unavailable.", 0);
    return next;
  }), [packs, scope]);

  const commit = useCallback(async (payload: MutationPayload, localTransform: (current: CustomSrsState, now: Date) => CustomSrsState) => {
    void queryClient.cancelQueries({ queryKey, exact: true });
    const remoteState = queryClient.getQueryData<RemoteStateResponse>(queryKey);
    if (remoteState?.available === false && !readCustomSrsOutbox(scope)?.pending.length) return updateLocal((current) => localTransform(current, new Date()));
    try {
      const next = await enqueueCustomSrsMutation(scope, { payload, createdAt: new Date().toISOString() }, packs, remoteState);
      setStorageError("");
      void sync();
      return next;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Browser storage is full or unavailable.";
      setStorageError(message);
      throw new CustomSrsApiError(message, 0);
    }
  }, [packs, queryClient, queryKey, scope, sync, updateLocal]);

  const enrollPack = useCallback((pack: CustomVocabularyPack, eventId = crypto.randomUUID()) => commit(
    { action: "enroll_pack", packId: pack.id, eventId, accountId: String(scope) },
    (current, now) => enrollCustomVocabularyPack(current, pack, now),
  ), [commit, scope]);
  const completeLesson = useCallback((wordId: string, eventId = crypto.randomUUID()) => commit(
    { action: "complete_lesson", wordId, eventId, accountId: String(scope) },
    (current, now) => completeCustomLesson(current, wordId, now),
  ), [commit, scope]);
  const submitReview = useCallback((wordId: string, incorrectAnswers: number, eventId = crypto.randomUUID()) => commit(
    { action: "submit_review", wordId, incorrectAnswers, eventId, accountId: String(scope), expectedAssignmentUpdatedAt: state.assignments[wordId]?.updatedAt ?? "" },
    (current, now) => recordCustomReview(current, wordId, incorrectAnswers, now, eventId),
  ), [commit, scope, state.assignments]);

  const error = storageError || restored.error || outbox?.syncError || remote.error;
  const isUnavailable = Boolean(restored.error) || (remote.isError && remote.data === undefined && !outbox);
  return {
    state,
    storageMode: remote.data?.available === false && !outbox?.pending.length ? "browser" as const : "cloud" as const,
    isLoading: remote.isLoading && !outbox,
    isRefreshing: remote.isFetching,
    isUnavailable,
    isSaving: false,
    pendingCount: outbox?.pending.length ?? 0,
    isSyncing: Boolean(outbox?.pending.length && !outbox.syncError),
    syncError: storageError || restored.error || outbox?.syncError || "",
    error: error instanceof Error ? error.message : error || "",
    enrollPack,
    completeLesson,
    submitReview,
    retrySync,
    refresh: remote.refetch,
  };
}
