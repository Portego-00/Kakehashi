"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { WKUser } from "@/types/wanikani";

export type SessionStatus = "loading" | "authenticated" | "anonymous" | "unavailable";
type SessionContextValue = {
  status: SessionStatus;
  user: WKUser | null;
  error: string;
  signIn: (token: string) => Promise<WKUser>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};
const SessionContext = createContext<SessionContextValue | null>(null);

async function readSession() {
  const response = await fetch("/api/session/wanikani", { cache: "no-store" });
  if (response.status === 401) return null;
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error || "Could not read the current session.");
  return payload.user as WKUser;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<WKUser | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const next = await readSession();
      setUser(next);
      setStatus(next ? "authenticated" : "anonymous");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "WaniKani could not be reached. Try again shortly.");
      setStatus((current) => current === "authenticated" ? current : "unavailable");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const signIn = useCallback(async (token: string) => {
    const response = await fetch("/api/session/wanikani", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || "That API token could not be verified.");
    setUser(payload.user);
    setStatus("authenticated");
    setError("");
    return payload.user as WKUser;
  }, []);

  const signOut = useCallback(async () => {
    const response = await fetch("/api/session/wanikani", { method: "DELETE" });
    if (!response.ok) throw new Error("Kakehashi could not sign out. Check your connection and try again.");
    setUser(null);
    setStatus("anonymous");
    setError("");
  }, []);

  const value = useMemo(() => ({ status, user, error, signIn, signOut, refresh }), [status, user, error, signIn, signOut, refresh]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
