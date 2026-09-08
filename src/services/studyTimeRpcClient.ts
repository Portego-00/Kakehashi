import * as SecureStore from "expo-secure-store";
import {
  isValidStudyTimeDeviceId,
  normalizeStudyTimeUserId,
} from "./studyTimeStorageScope";

const DEFAULT_TIMEOUT_MS = 10_000;
const SESSION_MAX_REUSE_AGE_MS = 4 * 60_000;
// Keep the original key so schema-v1 entries are found and self-invalidated.
const SESSION_STORAGE_KEY_PREFIX = "kakehashi.studyTime.session.v1";
const SESSION_TOKEN_PATTERN = /^st1_[0-9a-f]{64}$/;

type StudyTimeRpcName =
  | "create_study_time_session"
  | "sync_study_time_days"
  | "get_study_time_history";

type JsonObject = Record<string, unknown>;

type StudyTimeSession = {
  version: 2;
  userId: string;
  deviceId: string;
  sessionToken: string;
  expiresAt: string;
  receivedAtMs: number;
};

type SessionContext = {
  waniKaniToken: string;
  userId: string;
  deviceId: string;
};

class StudyTimeRpcRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "StudyTimeRpcRequestError";
  }
}

class StudyTimeRpcResultError extends Error {
  constructor(
    readonly operation: StudyTimeRpcName,
    readonly code: string,
  ) {
    super(studyTimeRpcResultMessage(operation, code));
    this.name = "StudyTimeRpcResultError";
  }
}

const memorySessions = new Map<string, StudyTimeSession>();
const sessionCreations = new Map<string, Promise<StudyTimeSession>>();
const sessionRefreshes = new Map<string, Promise<StudyTimeSession>>();

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function studyTimeRpcResultMessage(
  operation: StudyTimeRpcName,
  code: string,
): string {
  switch (code) {
    case "invalid_token":
      return "Study time cloud sync requires a valid WaniKani login";
    case "rate_limited":
      return "Study time cloud sync is temporarily rate limited";
    case "upstream_unavailable":
      return "WaniKani could not be reached to start study time sync";
    case "storage_unavailable":
      return "Study time cloud storage is temporarily unavailable";
    case "session_expired":
      return "Study time cloud session expired";
    case "invalid_request":
      return `Study time cloud request was rejected (${operation})`;
    default:
      return `Study time cloud request failed (${operation})`;
  }
}

function isJwtShaped(value: string): boolean {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

export function isStudyTimeRpcConfigured(): boolean {
  return Boolean(
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

/** Direct PostgREST RPC transport. This module never invokes Edge Functions. */
export async function postStudyTimeRpc(
  rpcName: StudyTimeRpcName,
  body: JsonObject,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !anonKey) {
    throw new Error("Study time cloud sync is not configured");
  }

  const controller = new AbortController();
  let didTimeout = false;
  const timeout = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  const headers: Record<string, string> = {
    Accept: "application/json",
    apikey: anonKey,
    "Content-Type": "application/json",
  };
  // Legacy anon keys are JWTs and PostgREST expects them as the bearer token.
  // New publishable keys are deliberately sent only through the apikey header.
  if (isJwtShaped(anonKey)) {
    headers.Authorization = `Bearer ${anonKey}`;
  }

  try {
    const response = await fetch(
      `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/rpc/${rpcName}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new StudyTimeRpcRequestError(
        `Study time cloud request failed (HTTP ${response.status})`,
        response.status,
      );
    }
    return response;
  } catch (error) {
    if (didTimeout) {
      throw new Error("Study time cloud request timed out");
    }
    if (error instanceof StudyTimeRpcRequestError) {
      throw error;
    }
    // Do not pass native fetch diagnostics through: implementations may attach
    // request data containing a WaniKani token or session capability.
    throw new Error("Study time cloud request could not be reached");
  } finally {
    clearTimeout(timeout);
  }
}

function encodeSecureStoreKeyPart(value: string): string {
  let encoded = "";
  for (let index = 0; index < value.length; index += 1) {
    encoded += value.charCodeAt(index).toString(16).padStart(4, "0");
  }
  return encoded;
}

export function getStudyTimeSessionStorageKey(
  userId: string,
  deviceId: string,
): string {
  return (
    `${SESSION_STORAGE_KEY_PREFIX}.u${encodeSecureStoreKeyPart(userId)}.` +
    `d${encodeSecureStoreKeyPart(deviceId)}`
  );
}

function sessionScopeKey(context: Pick<SessionContext, "userId" | "deviceId">) {
  return getStudyTimeSessionStorageKey(context.userId, context.deviceId);
}

function expiresAtMs(value: unknown): number | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 128) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidSessionToken(value: unknown): value is string {
  return typeof value === "string" && SESSION_TOKEN_PATTERN.test(value);
}

function isFreshSession(
  session: StudyTimeSession,
  context: Pick<SessionContext, "userId" | "deviceId">,
): boolean {
  const ageMs = Date.now() - session.receivedAtMs;
  return (
    session.version === 2 &&
    session.userId === context.userId &&
    session.deviceId === context.deviceId &&
    isValidSessionToken(session.sessionToken) &&
    expiresAtMs(session.expiresAt) !== null &&
    Number.isSafeInteger(session.receivedAtMs) &&
    session.receivedAtMs >= 0 &&
    ageMs >= 0 &&
    ageMs < SESSION_MAX_REUSE_AGE_MS
  );
}

function parseStoredSession(
  value: unknown,
  context: Pick<SessionContext, "userId" | "deviceId">,
): StudyTimeSession | null {
  if (!isJsonObject(value)) {
    return null;
  }
  const candidate = value as Partial<StudyTimeSession>;
  const session: StudyTimeSession = {
    version: candidate.version as 2,
    userId: typeof candidate.userId === "string" ? candidate.userId : "",
    deviceId: typeof candidate.deviceId === "string" ? candidate.deviceId : "",
    sessionToken:
      typeof candidate.sessionToken === "string" ? candidate.sessionToken : "",
    expiresAt: typeof candidate.expiresAt === "string" ? candidate.expiresAt : "",
    receivedAtMs:
      typeof candidate.receivedAtMs === "number" ? candidate.receivedAtMs : -1,
  };
  return isFreshSession(session, context) ? session : null;
}

async function deleteStoredSession(scopeKey: string): Promise<void> {
  memorySessions.delete(scopeKey);
  try {
    await SecureStore.deleteItemAsync(scopeKey);
  } catch {
    // An expired/rejected capability remains unusable and is never logged.
  }
}

async function readStoredSession(
  context: SessionContext,
): Promise<StudyTimeSession | null> {
  const scopeKey = sessionScopeKey(context);
  const memorySession = memorySessions.get(scopeKey);
  if (memorySession && isFreshSession(memorySession, context)) {
    return memorySession;
  }
  memorySessions.delete(scopeKey);

  let raw: string | null;
  try {
    raw = await SecureStore.getItemAsync(scopeKey);
  } catch {
    return null;
  }
  if (!raw) {
    return null;
  }

  try {
    const session = parseStoredSession(JSON.parse(raw), context);
    if (session) {
      memorySessions.set(scopeKey, session);
      return session;
    }
  } catch {
    // Invalid secure entries are discarded below.
  }
  await deleteStoredSession(scopeKey);
  return null;
}

async function saveSession(session: StudyTimeSession): Promise<void> {
  const scopeKey = sessionScopeKey(session);
  memorySessions.set(scopeKey, session);
  try {
    await SecureStore.setItemAsync(scopeKey, JSON.stringify(session));
  } catch {
    // Keep the short-lived capability only in memory if secure storage is
    // temporarily unavailable. It is never persisted through a weaker store.
  }
}

async function readRpcPayload(
  response: Response,
  operation: StudyTimeRpcName,
): Promise<JsonObject> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Study time cloud response was invalid (${operation})`);
  }
  if (!isJsonObject(payload)) {
    throw new Error(`Study time cloud response was invalid (${operation})`);
  }
  if (payload.ok === false) {
    throw new StudyTimeRpcResultError(
      operation,
      typeof payload.error === "string" ? payload.error : "unknown",
    );
  }
  return payload;
}

function parseCreatedSession(
  payload: JsonObject,
  context: SessionContext,
): StudyTimeSession {
  const user = isJsonObject(payload.user) ? payload.user : null;
  const returnedUserId = normalizeStudyTimeUserId(user?.id);
  const expiry = expiresAtMs(payload.expiresAt);
  if (
    payload.ok !== true ||
    !isValidSessionToken(payload.sessionToken) ||
    !returnedUserId ||
    returnedUserId !== context.userId ||
    typeof payload.expiresAt !== "string" ||
    expiry === null
  ) {
    throw new Error("Study time cloud session response was invalid");
  }

  return {
    version: 2,
    userId: context.userId,
    deviceId: context.deviceId,
    sessionToken: payload.sessionToken,
    expiresAt: payload.expiresAt,
    receivedAtMs: Date.now(),
  };
}

async function createSession(context: SessionContext): Promise<StudyTimeSession> {
  const scopeKey = sessionScopeKey(context);
  const cached = memorySessions.get(scopeKey);
  if (cached && isFreshSession(cached, context)) {
    return cached;
  }
  const existing = sessionCreations.get(scopeKey);
  if (existing) {
    return existing;
  }

  const creation = (async () => {
    const response = await postStudyTimeRpc("create_study_time_session", {
      wani_kani_token: context.waniKaniToken,
      device_id: context.deviceId,
    });
    const payload = await readRpcPayload(response, "create_study_time_session");
    const session = parseCreatedSession(payload, context);
    await saveSession(session);
    return session;
  })();

  sessionCreations.set(scopeKey, creation);
  try {
    return await creation;
  } finally {
    if (sessionCreations.get(scopeKey) === creation) {
      sessionCreations.delete(scopeKey);
    }
  }
}

async function getSession(context: SessionContext): Promise<StudyTimeSession> {
  const scopeKey = sessionScopeKey(context);
  const refresh = sessionRefreshes.get(scopeKey);
  if (refresh) {
    return refresh;
  }
  return (await readStoredSession(context)) ?? createSession(context);
}

async function refreshSession(
  context: SessionContext,
  rejectedSessionToken: string,
): Promise<StudyTimeSession> {
  const scopeKey = sessionScopeKey(context);
  const replacement = memorySessions.get(scopeKey);
  if (
    replacement &&
    replacement.sessionToken !== rejectedSessionToken &&
    isFreshSession(replacement, context)
  ) {
    return replacement;
  }
  const existing = sessionRefreshes.get(scopeKey);
  if (existing) {
    return existing;
  }

  const refresh = (async () => {
    // A second request can receive a late rejection for the old capability
    // after another request has already refreshed it. Never discard that
    // freshly issued replacement or create another one.
    const latest = memorySessions.get(scopeKey);
    if (
      latest &&
      latest.sessionToken !== rejectedSessionToken &&
      isFreshSession(latest, context)
    ) {
      return latest;
    }
    await deleteStoredSession(scopeKey);
    return createSession(context);
  })();
  sessionRefreshes.set(scopeKey, refresh);
  try {
    return await refresh;
  } finally {
    if (sessionRefreshes.get(scopeKey) === refresh) {
      sessionRefreshes.delete(scopeKey);
    }
  }
}

function normalizeContext(
  waniKaniToken: string,
  expectedUserId: string,
  deviceId: string,
): SessionContext {
  const userId = normalizeStudyTimeUserId(expectedUserId);
  if (!waniKaniToken || !userId || !isValidStudyTimeDeviceId(deviceId)) {
    throw new Error("Study time cloud sync requires login");
  }
  return { waniKaniToken, userId, deviceId };
}

function isExpiredSessionError(error: unknown): boolean {
  return (
    (error instanceof StudyTimeRpcRequestError && error.status === 401) ||
    (error instanceof StudyTimeRpcResultError && error.code === "session_expired")
  );
}

async function withSession<T>(
  context: SessionContext,
  request: (session: StudyTimeSession) => Promise<T>,
): Promise<T> {
  const session = await getSession(context);
  try {
    return await request(session);
  } catch (error) {
    if (!isExpiredSessionError(error)) {
      throw error;
    }
  }

  // A rejected capability gets exactly one recreation and retry. Concurrent
  // sync/history requests share the complete refresh operation.
  const refreshedSession = await refreshSession(context, session.sessionToken);
  return request(refreshedSession);
}

export async function syncStudyTimeDaysRpc(
  waniKaniToken: string,
  expectedUserId: string,
  deviceId: string,
  days: unknown[],
): Promise<void> {
  const context = normalizeContext(waniKaniToken, expectedUserId, deviceId);
  await withSession(context, async (session) => {
    const response = await postStudyTimeRpc("sync_study_time_days", {
      session_token: session.sessionToken,
      days,
    });
    const payload = await readRpcPayload(response, "sync_study_time_days");
    if (
      payload.ok !== true ||
      payload.synced !== true ||
      !Number.isSafeInteger(payload.acceptedDays) ||
      payload.acceptedDays !== days.length
    ) {
      throw new Error("Study time cloud sync acknowledgement was invalid");
    }
  });
}

export async function getStudyTimeHistoryRpc(
  waniKaniToken: string,
  expectedUserId: string,
  deviceId: string,
): Promise<unknown> {
  const context = normalizeContext(waniKaniToken, expectedUserId, deviceId);
  return withSession(context, async (session) => {
    const response = await postStudyTimeRpc("get_study_time_history", {
      session_token: session.sessionToken,
    });
    const payload = await readRpcPayload(response, "get_study_time_history");
    if (payload.ok !== true || !Array.isArray(payload.days)) {
      throw new Error("Study time cloud history response was invalid");
    }
    // Session expiry is absolute and non-sliding. Keep the issuance metadata
    // instead of letting a late response overwrite a concurrently refreshed
    // capability; the server's session_expired result remains authoritative.
    return payload;
  });
}

/** Clears process-only state so transport tests remain independent. */
export function resetStudyTimeRpcClientForTests(): void {
  memorySessions.clear();
  sessionCreations.clear();
  sessionRefreshes.clear();
}
