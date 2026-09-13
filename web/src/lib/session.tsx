"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { setDemoMode } from "@/features/demo/runtime";
import type { WKUser } from "@/types/wanikani";

export type SessionStatus = "loading" | "authenticated" | "anonymous" | "unavailable";
type SessionContextValue = {
  status: SessionStatus;
  user: WKUser | null;
  isDemo: boolean;
  error: string;
  signIn: (token: string) => Promise<WKUser>;
  startDemo: () => Promise<WKUser>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};
const SessionContext = createContext<SessionContextValue | null>(null);
const SESSION_EVENT_KEY = "kakehashi-web:session-change";
type SessionPayload = { user: WKUser; demo?: boolean };

async function readSession(): Promise<SessionPayload | null> {
  const response = await fetch("/api/session/wanikani", { cache: "no-store" });
  if (response.status === 401) return null;
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error || "Could not read the current session.");
  return payload;
}

function notifySessionChange() {
  try { window.localStorage.setItem(SESSION_EVENT_KEY, crypto.randomUUID()); }
  catch { /* Cross-tab notification is best-effort when storage is unavailable. */ }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<WKUser | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [error, setError] = useState("");
  const identity = useRef("");
  const revision = useRef(0);
  const mutationsPending = useRef(0);
  const mutationQueue = useRef<Promise<unknown>>(Promise.resolve());

  const applySession = useCallback(async (next: SessionPayload | null, expectedRevision: number) => {
    if (expectedRevision !== revision.current) return;
    const demo = next?.demo === true;
    const nextIdentity = next ? `${demo ? "demo" : "account"}:${next.user.data.id ?? next.user.id}:${next.user.data.username}` : "";
    if (identity.current !== nextIdentity) {
      setStatus("loading");
      await queryClient.cancelQueries();
      if (expectedRevision !== revision.current) return;
      queryClient.clear();
    }
    if (demo) {
      const [{ seedDemoLibrary }, { seedDemoStudy }] = await Promise.all([import("@/features/demo/media"), import("@/features/demo/study")]);
      if (expectedRevision !== revision.current) return;
      setDemoMode(true);
      seedDemoStudy();
      await seedDemoLibrary();
      if (expectedRevision !== revision.current) return;
    }
    setDemoMode(demo);
    identity.current = nextIdentity;
    setIsDemo(demo);
    setUser(next?.user ?? null);
    setStatus(next ? "authenticated" : "anonymous");
    setError("");
  }, [queryClient]);

  const refresh = useCallback(async () => {
    if (mutationsPending.current) return;
    const requestRevision = ++revision.current;
    try {
      const next = await readSession();
      if (requestRevision === revision.current) await applySession(next, requestRevision);
    } catch (cause) {
      if (requestRevision !== revision.current) return;
      setError(cause instanceof Error ? cause.message : "WaniKani could not be reached. Try again shortly.");
      setStatus((current) => current === "authenticated" ? current : "unavailable");
    }
  }, [applySession]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== SESSION_EVENT_KEY) return;
      setStatus("loading");
      void mutationQueue.current.catch(() => undefined).then(() => refresh());
    };
    window.addEventListener("storage", onStorage);
    return () => { window.clearTimeout(timer); window.removeEventListener("storage", onStorage); };
  }, [refresh]);

  // Serialize cookie changes so a slow earlier response cannot undo a later sign-out.
  const mutateSession = useCallback((path: string, options: RequestInit, fallback: string, signingOut = false) => {
    const expectedRevision = ++revision.current;
    mutationsPending.current += 1;
    const operation = mutationQueue.current.catch(() => undefined).then(async () => {
      const response = await fetch(path, options);
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || fallback);
      if (expectedRevision === revision.current) await applySession(signingOut ? null : payload, expectedRevision);
      notifySessionChange();
      return payload as SessionPayload;
    }).finally(() => { mutationsPending.current -= 1; });
    mutationQueue.current = operation;
    return operation;
  }, [applySession]);

  const signIn = useCallback(async (token: string) => {
    const payload = await mutateSession("/api/session/wanikani", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }, "That API token could not be verified.");
    return payload.user;
  }, [mutateSession]);

  const startDemo = useCallback(async () => {
    const payload = await mutateSession("/api/session/demo", { method: "POST" }, "The demo could not be opened. Please try again.");
    return payload.user;
  }, [mutateSession]);

  const signOut = useCallback(async () => {
    await mutateSession("/api/session/wanikani", { method: "DELETE" }, "Kakehashi could not sign out. Check your connection and try again.", true);
  }, [mutateSession]);

  const value = useMemo(() => ({ status, user, isDemo, error, signIn, startDemo, signOut, refresh }), [status, user, isDemo, error, signIn, startDemo, signOut, refresh]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
