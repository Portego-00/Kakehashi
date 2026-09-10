"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/lib/session";
import { waniKaniUserId } from "@/lib/wanikani/user-identity";
import { canAccessNotebooks } from "./access";
import { NOTEBOOK_HANDWRITING_FEATURES } from "./handwriting";
import { applyNotebookMutation, createNotebookState, DEFAULT_NOTEBOOK_LIMITS, NOTEBOOK_HARD_MAX_BYTES, notebookExamplesNeedInitialization, validateNotebookState, type NotebookMutation, type NotebookState } from "./model";

export type NotebookResponse = { available: boolean; state: NotebookState; revision: number; sentenceId?: string };
const queues = new Map<string, Promise<unknown>>();
const DEMO_KEY = "kakehashi:notebooks:demo:v1";
const NOTEBOOK_FEATURE_HEADERS = { "X-Notebook-Features": NOTEBOOK_HANDWRITING_FEATURES };

export class NotebookApiError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = "NotebookApiError"; }
}

async function responseData(response: Response): Promise<NotebookResponse> {
  const value = await response.json().catch(() => null);
  if (!response.ok) throw new NotebookApiError(value?.error || "Your notebook could not be reached. Try again.", response.status);
  if (!value || typeof value.available !== "boolean" || !Number.isSafeInteger(value.revision)) throw new NotebookApiError("The notebook returned an incomplete response.", 502);
  return { ...value, state: value.state ? validateNotebookState(value.state, { ...DEFAULT_NOTEBOOK_LIMITS, maxBytes: NOTEBOOK_HARD_MAX_BYTES }) : createNotebookState() };
}

function readDemo(): NotebookResponse {
  try {
    const value = JSON.parse(localStorage.getItem(DEMO_KEY) || "null");
    if (value) return { available: true, state: validateNotebookState(value.state), revision: value.revision ?? 0 };
  } catch { /* A damaged demo can safely start empty. Personal notebooks use the server. */ }
  return { available: true, state: createNotebookState(), revision: 0 };
}

async function initializeExamples(incoming: NotebookResponse, scope: string, isDemo: boolean, signal: AbortSignal): Promise<NotebookResponse> {
  if (!incoming.available || !notebookExamplesNeedInitialization(incoming.state)) return incoming;
  signal.throwIfAborted();
  try {
    if (!isDemo) return await responseData(await fetch("/api/notebooks", { method: "POST", headers: { ...NOTEBOOK_FEATURE_HEADERS, "Content-Type": "application/json", "X-Notebook-Account": scope }, body: JSON.stringify({ action: "initialize_examples" }), signal: AbortSignal.any([signal, AbortSignal.timeout(25_000)]) }));
    const save = () => {
      signal.throwIfAborted();
      const current = readDemo();
      const next = applyNotebookMutation(current.state, { action: "initialize_examples" });
      if (next.state === current.state) return current;
      const result = { available: true, ...next, revision: current.revision + 1 };
      localStorage.setItem(DEMO_KEY, JSON.stringify(result));
      return result;
    };
    return navigator.locks ? await navigator.locks.request(DEMO_KEY, save) : save();
  } catch {
    signal.throwIfAborted();
    // Onboarding is optional: a temporary write failure must not hide existing
    // notebooks or prevent reading/exporting an account that is already full.
    return incoming;
  }
}

export function newerNotebookResponse(current: NotebookResponse | undefined, incoming: NotebookResponse) {
  return current && current.revision > incoming.revision ? current : incoming;
}

/** The account-scoped transport is independent of the editor's document format. */
export function useNotebooks() {
  const { user, status, isDemo } = useSession();
  const allowed = status === "authenticated" && !isDemo && canAccessNotebooks(user?.data.username);
  const scope = isDemo ? "demo" : waniKaniUserId(user) || "anonymous";
  const queryKey = useMemo(() => ["notebooks", scope] as const, [scope]);
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Record<string, number>>({});
  const [mutationError, setMutationError] = useState({ scope, message: "" });
  const sessionRef = useRef({ scope, status, allowed, active: false });
  useEffect(() => {
    const session = { scope, status, allowed, active: true };
    sessionRef.current = session;
    return () => { session.active = false; };
  }, [scope, status, allowed]);
  const query = useQuery({
    queryKey,
    enabled: allowed,
    queryFn: async ({ signal }) => {
      if (!allowed) throw new NotebookApiError("Notebooks are not available for this account.", 403);
      const session = sessionRef.current;
      const incoming = isDemo ? readDemo() : await responseData(await fetch("/api/notebooks", { cache: "no-store", headers: NOTEBOOK_FEATURE_HEADERS, signal }));
      if (!session.active || sessionRef.current !== session || !session.allowed) throw new NotebookApiError("Your notebook account changed.", 409);
      const current = newerNotebookResponse(queryClient.getQueryData<NotebookResponse>(queryKey), incoming);
      const initialized = await initializeExamples(current, scope, isDemo, signal);
      return newerNotebookResponse(queryClient.getQueryData<NotebookResponse>(queryKey), initialized);
    },
    staleTime: 30_000,
    retry: 1,
    // A save from the iPad does not emit this browser's storage event. Refresh
    // when returning immediately, and while reading an already-open notebook.
    refetchOnWindowFocus: "always",
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!allowed) {
      void queryClient.cancelQueries({ queryKey, exact: true });
      return;
    }
    const listener = (event: StorageEvent) => {
      if (event.key === (isDemo ? DEMO_KEY : `kakehashi:notebooks:revision:${scope}`)) void queryClient.invalidateQueries({ queryKey, exact: true });
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, [allowed, isDemo, queryClient, queryKey, scope]);

  const mutateResult = useCallback(async (mutation: NotebookMutation): Promise<NotebookResponse> => {
    if (status !== "authenticated") throw new NotebookApiError("Sign in to save your notebook.", 401);
    if (!allowed) throw new NotebookApiError("Notebooks are not available for this account.", 403);
    const session = sessionRef.current;
    const isCurrentSession = () => session.active && sessionRef.current === session && session.scope === scope && session.status === "authenticated" && session.allowed;
    const requireCurrentSession = () => {
      if (!isCurrentSession()) throw new NotebookApiError("Your account changed before this notebook could be saved. Your draft stays with the original account.", 409);
    };
    requireCurrentSession();
    setPending((counts) => ({ ...counts, [scope]: (counts[scope] ?? 0) + 1 }));
    setMutationError({ scope, message: "" });
    const previous = queues.get(scope) ?? Promise.resolve();
    const operation = previous.catch(() => undefined).then(async () => {
      requireCurrentSession();
      await queryClient.cancelQueries({ queryKey, exact: true });
      requireCurrentSession();
      const saveDemo = () => {
        requireCurrentSession();
        const current = readDemo();
        const next = applyNotebookMutation(current.state, mutation);
        const result = { available: true, ...next, revision: current.revision + 1 };
        localStorage.setItem(DEMO_KEY, JSON.stringify(result));
        return result;
      };
      const result = isDemo
        ? (navigator.locks ? await navigator.locks.request(DEMO_KEY, saveDemo) : saveDemo())
        : await responseData(await fetch("/api/notebooks", { method: "POST", headers: { ...NOTEBOOK_FEATURE_HEADERS, "Content-Type": "application/json", "X-Notebook-Account": scope }, body: JSON.stringify(mutation), signal: AbortSignal.timeout(25_000) }));
      if (!result.available) throw new NotebookApiError("Notebook storage is not available yet. Your changes are kept as a draft on this device.", 503);
      // An already-dispatched save can finish after navigation or sign-out. Its
      // caller may finish cleanup, but it must not repopulate a cleared account cache.
      if (!isCurrentSession()) return result;
      queryClient.setQueryData<NotebookResponse>(queryKey, (current) => newerNotebookResponse(current, result));
      if (!isDemo) {
        try { localStorage.setItem(`kakehashi:notebooks:revision:${scope}`, `${result.revision}:${crypto.randomUUID()}`); }
        catch { /* The cloud save already succeeded. */ }
      }
      return result;
    });
    queues.set(scope, operation);
    try { return await operation; }
    catch (error) {
      if (isCurrentSession()) {
        setMutationError({ scope, message: error instanceof Error ? error.message : "Your notebook could not be saved." });
        if (error instanceof NotebookApiError && error.status === 409) void queryClient.invalidateQueries({ queryKey, exact: true });
      }
      throw error;
    }
    finally { if (sessionRef.current.active) setPending((counts) => ({ ...counts, [scope]: Math.max(0, (counts[scope] ?? 1) - 1) })); if (queues.get(scope) === operation) queues.delete(scope); }
  }, [allowed, isDemo, queryClient, queryKey, scope, status]);

  const mutate = useCallback(async (mutation: NotebookMutation) => (await mutateResult(mutation)).state, [mutateResult]);
  return {
    state: allowed ? query.data?.state ?? EMPTY_STATE : EMPTY_STATE,
    revision: allowed ? query.data?.revision ?? -1 : -1,
    scope,
    isDemo,
    available: allowed && (query.data?.available ?? false),
    isLoading: allowed && query.isLoading,
    isSaving: allowed && (pending[scope] ?? 0) > 0,
    error: allowed ? (mutationError.scope === scope ? mutationError.message : "") || (query.error instanceof Error ? query.error.message : "") : "",
    mutate,
    mutateResult,
    getState: () => allowed && sessionRef.current.allowed && sessionRef.current.scope === scope ? queryClient.getQueryData<NotebookResponse>(queryKey)?.state ?? EMPTY_STATE : EMPTY_STATE,
    refresh: (...options: Parameters<typeof query.refetch>) => allowed && sessionRef.current.allowed && sessionRef.current.scope === scope ? query.refetch(...options) : Promise.reject(new NotebookApiError("Notebooks are not available for this account.", 403)),
  };
}

const EMPTY_STATE = createNotebookState();
