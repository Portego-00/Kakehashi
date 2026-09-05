"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { completeCustomLesson, enrollCustomVocabularyPack, recordCustomReview } from "./model";
import { customSrsSnapshot, customSrsStorageKey, loadCustomSrsState, saveCustomSrsState, subscribeCustomSrs, withCustomSrsStorageLock } from "./storage";
import type { CustomSrsState, CustomVocabularyPack } from "./types";

type RemoteStateResponse = {
  available: boolean;
  state: CustomSrsState | null;
  revision: number;
};

type MutationPayload =
  | { action: "enroll_pack"; packId: string; eventId: string }
  | { action: "complete_lesson"; wordId: string; eventId: string }
  | { action: "submit_review"; wordId: string; incorrectAnswers: number; eventId: string };

type CloudRevisionNotice = {
  revision: number;
  nonce: string;
};

function cloudRevisionStorageKey(scope: string | number) {
  return `${customSrsStorageKey(scope)}:cloud-revision`;
}

function newestRemoteResponse(current: RemoteStateResponse | undefined, incoming: RemoteStateResponse) {
  if (current?.available && incoming.available && incoming.revision <= current.revision) return current;
  return incoming;
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

export async function fetchCustomSrsState(signal?: AbortSignal) {
  return parseResponse(await fetch("/api/custom-srs", { cache: "no-store", signal }));
}

export async function mutateCustomSrs(payload: MutationPayload) {
  return parseResponse(await fetch("/api/custom-srs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }));
}

export function useCustomSrs(scope: string | number, packs: readonly CustomVocabularyPack[]) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["custom-srs", String(scope)] as const, [scope]);
  const cloudRevisionKey = useMemo(() => cloudRevisionStorageKey(scope), [scope]);
  const remote = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const incoming = await fetchCustomSrsState(signal);
      return newestRemoteResponse(queryClient.getQueryData<RemoteStateResponse>(queryKey), incoming);
    },
    staleTime: 30_000,
  });
  const mutation = useMutation({ mutationFn: mutateCustomSrs });
  const subscribe = useCallback((onChange: () => void) => subscribeCustomSrs(scope, onChange), [scope]);
  const getSnapshot = useCallback(() => customSrsSnapshot(scope), [scope]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => "");
  const localState = useMemo(() => {
    void snapshot;
    if (typeof window === "undefined") return loadCustomSrsState({ getItem: () => null }, scope, packs);
    return loadCustomSrsState(window.localStorage, scope, packs);
  }, [packs, scope, snapshot]);
  const state = remote.data?.available && remote.data.state ? remote.data.state : localState;

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
    await queryClient.cancelQueries({ queryKey, exact: true });
    if (remote.data?.available === false) return updateLocal((current) => localTransform(current, new Date()));
    const result = await mutation.mutateAsync(payload);
    let applied = result;
    queryClient.setQueryData<RemoteStateResponse>(queryKey, (current) => {
      applied = newestRemoteResponse(current, result);
      return applied;
    });
    if (!applied.available || !applied.state) return updateLocal((current) => localTransform(current, new Date()));
    if (result.available && result.state) notifyCloudRevision(scope, applied.revision);
    return applied.state ?? result.state;
  }, [mutation, queryClient, queryKey, remote.data?.available, scope, updateLocal]);

  const enrollPack = useCallback((pack: CustomVocabularyPack, eventId = crypto.randomUUID()) => commit(
    { action: "enroll_pack", packId: pack.id, eventId },
    (current, now) => enrollCustomVocabularyPack(current, pack, now),
  ), [commit]);
  const completeLesson = useCallback((wordId: string, eventId = crypto.randomUUID()) => commit(
    { action: "complete_lesson", wordId, eventId },
    (current, now) => completeCustomLesson(current, wordId, now),
  ), [commit]);
  const submitReview = useCallback((wordId: string, incorrectAnswers: number, eventId = crypto.randomUUID()) => commit(
    { action: "submit_review", wordId, incorrectAnswers, eventId },
    (current, now) => recordCustomReview(current, wordId, incorrectAnswers, now, eventId),
  ), [commit]);

  const error = mutation.error ?? remote.error;
  const isUnavailable = remote.isError && remote.data === undefined;
  return {
    state,
    storageMode: remote.data?.available === false ? "browser" as const : "cloud" as const,
    isLoading: remote.isLoading,
    isRefreshing: remote.isFetching,
    isUnavailable,
    isSaving: mutation.isPending,
    error: error instanceof Error ? error.message : "",
    enrollPack,
    completeLesson,
    submitReview,
    refresh: remote.refetch,
  };
}
