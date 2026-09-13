import { createCustomSrsState } from "../../../web/src/features/custom-srs/model";
import { loadCustomSrsState } from "../../../web/src/features/custom-srs/storage";
import { CUSTOM_SRS_POLICY } from "../../../web/src/features/custom-srs/scheduler";
import { customVocabularyPacks } from "./catalog";
import type { CustomSrsMutation, CustomSrsState } from "./types";

export type CustomSrsAccount = { id: string; token: string };
export type CustomSrsSnapshot = {
  accountId: string | null;
  state: CustomSrsState;
  revision: number;
  loading: boolean;
  syncing: boolean;
  error: string | null;
};
type CloudResult = { state: CustomSrsState; revision: number };

/** The server rejected a stale queue action; refresh before deciding whether it can be retried. */
export class CustomSrsConflictError extends Error {
  readonly status = 409;

  constructor() {
    super("Your progress changed on another device. Refresh and try again.");
    this.name = "CustomSrsConflictError";
  }
}

type Dependencies = {
  request: (token: string, action: CustomSrsMutation | { action: "read" }) => Promise<CloudResult>;
  cache: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
};

export function customSrsCacheKey(accountId: string) {
  return `kakehashi:custom-srs:native:v1:account:${encodeURIComponent(accountId)}`;
}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (object(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function parseCustomSrsCloudResult(value: unknown): CloudResult {
  if (!object(value) || value.available !== true || !Number.isSafeInteger(value.revision) || Number(value.revision) < -1 || !object(value.state)) {
    throw new Error("The server did not confirm your custom vocabulary progress.");
  }
  const raw = value.state;
  if (raw.version !== 1 || canonical(raw.policy) !== canonical(CUSTOM_SRS_POLICY) || !object(raw.assignments) || !Array.isArray(raw.enrolledPackIds) || !Array.isArray(raw.reviewLog)) {
    throw new Error("Your progress uses an unsupported format. Update the app before studying.");
  }
  const state = loadCustomSrsState({ getItem: () => JSON.stringify(raw) }, "native", customVocabularyPacks);
  const knownIds = new Set(customVocabularyPacks.flatMap((pack) => pack.words.map((word) => word.id)));
  for (const id of Object.keys(raw.assignments)) {
    const original = raw.assignments[id];
    const normalized = state.assignments[id];
    if (knownIds.has(id) && (!object(original) || !normalized || canonical({ ...original, packId: normalized.packId }) !== canonical(normalized))) {
      throw new Error("Your cloud progress could not be read safely. Please try again.");
    }
  }
  return { state, revision: Number(value.revision) };
}

/** Account-scoped, server-authoritative store. No local scheduler or unsaved optimistic progress. */
export function createCustomSrsClient(dependencies: Dependencies) {
  let account: CustomSrsAccount | null = null;
  let generation = 0;
  let snapshot: CustomSrsSnapshot = {
    accountId: null, state: createCustomSrsState(), revision: -1,
    loading: false, syncing: false, error: null,
  };
  let refreshRequest: Promise<CustomSrsState> | null = null;
  let mutationTail: Promise<unknown> = Promise.resolve();
  const pendingCacheWrites = new Map<string, string>();
  let cacheWriteInFlight = false;
  let pendingMutations = 0;
  const subscribers = new Set<() => void>();
  const emit = (patch: Partial<CustomSrsSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    for (const callback of subscribers) callback();
  };
  const isCurrent = (expected: number) => generation === expected && account !== null;
  const requireCurrent = (expected: number) => {
    if (!isCurrent(expected)) throw new Error("Your account changed. Open this study session again.");
  };
  const flushCacheWrites = async () => {
    if (cacheWriteInFlight) return;
    cacheWriteInFlight = true;
    try {
      while (pendingCacheWrites.size > 0) {
        const next = pendingCacheWrites.entries().next().value;
        if (!next) break;
        const [key, value] = next;
        pendingCacheWrites.delete(key);
        try { await dependencies.cache.setItem(key, value); } catch {
          // A failed device cache must not prevent later snapshots from saving.
        }
      }
    } finally {
      cacheWriteInFlight = false;
    }
  };
  const accept = async (result: CloudResult, expected: number) => {
    requireCurrent(expected);
    if (result.revision >= snapshot.revision) {
      emit({ state: result.state, revision: result.revision, loading: false, error: null });
      const cacheKey = customSrsCacheKey(account!.id);
      const cachedResult = JSON.stringify({ available: true, ...result });
      // Disk is only a convenience: keep one in-flight write and only the newest
      // pending snapshot per account. A stalled cache cannot block cloud results
      // or retain an unbounded chain of obsolete full-state snapshots.
      pendingCacheWrites.set(cacheKey, cachedResult);
      void flushCacheWrites();
    } else {
      // An older read must not roll back restored or newly saved progress, but
      // it still finished. Otherwise cached accounts can stay loading forever.
      emit({ loading: false, error: null });
    }
    requireCurrent(expected);
    return snapshot.state;
  };
  const refresh = (): Promise<CustomSrsState> => {
    if (!account) return Promise.reject(new Error("Custom vocabulary is not available for this account."));
    if (refreshRequest) return refreshRequest;
    const expected = generation;
    const token = account.token;
    emit({ syncing: true });
    const request = dependencies.request(token, { action: "read" })
      .then((result) => accept(result, expected))
      .catch((error: Error) => {
        if (isCurrent(expected)) emit({ loading: false, error: error.message });
        throw error;
      }).finally(() => {
        if (isCurrent(expected) && refreshRequest === request) {
          refreshRequest = null;
          emit({ syncing: pendingMutations > 0 });
        }
      });
    refreshRequest = request;
    return request;
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(callback: () => void) { subscribers.add(callback); return () => subscribers.delete(callback); },
    setAccount(next: CustomSrsAccount | null) {
      if (account?.id === next?.id && account?.token === next?.token) return;
      account = next;
      generation += 1;
      const expected = generation;
      refreshRequest = null;
      mutationTail = Promise.resolve();
      pendingMutations = 0;
      emit({ accountId: next?.id ?? null, state: createCustomSrsState(), revision: -1, loading: Boolean(next), syncing: false, error: null });
      if (!next) return;
      void dependencies.cache.getItem(customSrsCacheKey(next.id)).then((raw) => {
        if (!raw || !isCurrent(expected)) return;
        const cached = parseCustomSrsCloudResult(JSON.parse(raw));
        if (snapshot.revision < cached.revision) emit({ state: cached.state, revision: cached.revision });
      }).catch(() => undefined);
    },
    refresh,
    mutate(action: CustomSrsMutation): Promise<CustomSrsState> {
      if (!account) return Promise.reject(new Error("Custom vocabulary is not available for this account."));
      const expected = generation;
      const token = account.token;
      pendingMutations += 1;
      emit({ syncing: true, error: null });
      const request = mutationTail.catch(() => undefined).then(async () => {
        requireCurrent(expected);
        return accept(await dependencies.request(token, action), expected);
      }).catch((error: Error) => {
        if (isCurrent(expected)) emit({ error: error.message });
        throw error;
      }).finally(() => {
        if (isCurrent(expected)) {
          pendingMutations -= 1;
          emit({ syncing: pendingMutations > 0 || refreshRequest !== null });
        }
      });
      mutationTail = request;
      return request;
    },
  };
}

export async function requestCustomSrsCloud(
  token: string,
  action: CustomSrsMutation | { action: "read" },
  options: { url?: string; anonKey?: string; fetcher?: typeof fetch; timeoutMs?: number } = {},
): Promise<CloudResult> {
  const url = options.url ?? process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = options.anonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) throw new Error("Custom vocabulary cloud sync is not configured in this app build.");
  if (!token) throw new Error("Sign in to sync your custom vocabulary progress.");
  const controller = new AbortController();
  let timeoutExpired = false;
  const timeout = setTimeout(() => { timeoutExpired = true; controller.abort(); }, options.timeoutMs ?? 30_000);
  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(`${url.replace(/\/+$/, "")}/functions/v1/custom-srs`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json", "x-wanikani-token": token },
      body: JSON.stringify(action), signal: controller.signal,
    });
    let value: unknown;
    try { value = await response.json(); } catch { throw new Error("Cloud sync returned an unreadable response. Retry to confirm your progress."); }
    if (!response.ok) {
      if (response.status === 409) throw new CustomSrsConflictError();
      const messages: Record<number, string> = {
        401: "Your WaniKani session needs to be renewed. Sign in again.",
        403: "Custom vocabulary is not available for this account.",
        429: "Too many study requests. Wait a moment and try again.",
      };
      throw new Error(messages[response.status] ?? "Your cloud progress could not be confirmed. Please retry before leaving.");
    }
    return parseCustomSrsCloudResult(value);
  } catch (error) {
    if (timeoutExpired) throw new Error("Cloud sync timed out. Retry to confirm your progress before leaving.");
    if (error instanceof CustomSrsConflictError) throw error;
    // Do not expose native networking diagnostics containing authenticated request metadata.
    if (error instanceof Error && /^(Your |Custom vocabulary |Too many |Cloud sync |The server)/.test(error.message)) throw error;
    throw new Error("Cloud sync could not be reached. Reconnect and retry to save your progress.");
  } finally { clearTimeout(timeout); }
}
