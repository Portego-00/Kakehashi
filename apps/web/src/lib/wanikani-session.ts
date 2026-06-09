import type { WaniKaniUser } from "@kakehashi/core";

const WANIKANI_SESSION_STORAGE_KEY = "kakehashi_wanikani_session_v1";
export const WANIKANI_SESSION_CHANGE_EVENT = "kakehashi:wanikani-session-change";

export type StoredWaniKaniSession = {
  apiToken: string;
  user: WaniKaniUser;
  connectedAt: string;
  lastValidatedAt: string;
};

export function loadWaniKaniSession(): StoredWaniKaniSession | null {
  const storage = getStorage();
  if (!storage) return null;

  const rawValue = storage.getItem(WANIKANI_SESSION_STORAGE_KEY);
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (isStoredWaniKaniSession(parsed)) {
      return parsed;
    }
  } catch {
    // Fall through to clearing an unreadable local session.
  }

  storage.removeItem(WANIKANI_SESSION_STORAGE_KEY);
  return null;
}

export function saveWaniKaniSession(input: {
  apiToken: string;
  user: WaniKaniUser;
  connectedAt?: string;
  lastValidatedAt?: string;
}): StoredWaniKaniSession {
  const now = new Date().toISOString();
  const session: StoredWaniKaniSession = {
    apiToken: input.apiToken.trim(),
    user: input.user,
    connectedAt: input.connectedAt ?? now,
    lastValidatedAt: input.lastValidatedAt ?? now,
  };

  getStorage()?.setItem(WANIKANI_SESSION_STORAGE_KEY, JSON.stringify(session));
  notifyWaniKaniSessionChange();
  return session;
}

export function clearWaniKaniSession(): void {
  getStorage()?.removeItem(WANIKANI_SESSION_STORAGE_KEY);
  notifyWaniKaniSessionChange();
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function notifyWaniKaniSessionChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(WANIKANI_SESSION_CHANGE_EVENT));
}

function isStoredWaniKaniSession(value: unknown): value is StoredWaniKaniSession {
  if (!isRecord(value)) return false;
  if (typeof value.apiToken !== "string") return false;
  if (typeof value.connectedAt !== "string") return false;
  if (typeof value.lastValidatedAt !== "string") return false;
  if (!isRecord(value.user)) return false;

  return (
    typeof value.user.id === "string" &&
    typeof value.user.username === "string" &&
    typeof value.user.level === "number"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
