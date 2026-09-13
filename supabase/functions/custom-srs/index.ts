import catalog from "../../../web/src/features/custom-srs/catalog.generated.json" with { type: "json" };
import { completeCustomLesson, createCustomSrsState, enrollCustomVocabularyPack, recordCustomReview } from "../../../web/src/features/custom-srs/model";
import { CUSTOM_SRS_POLICY } from "../../../web/src/features/custom-srs/scheduler";
import { loadCustomSrsState } from "../../../web/src/features/custom-srs/storage.ts";
import type { CustomSrsState, CustomVocabularyPack } from "../../../web/src/features/custom-srs/types";

const packs = catalog as CustomVocabularyPack[];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, content-type, x-wanikani-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "private, no-store",
};
type RecordValue = Record<string, unknown>;
type Identity = { id: string; username: string };
type Mutation =
  | { action: "read" }
  | { action: "enroll_pack"; packId: string; eventId: string }
  | { action: "complete_lesson"; wordId: string; eventId: string }
  | { action: "submit_review"; wordId: string; eventId: string; incorrectAnswers: number };

export interface CustomSrsDependencies {
  env: (name: string) => string | undefined;
  fetch: typeof fetch;
  now: () => Date;
}

class RequestError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

const identities = new Map<string, { identity: Identity; expiresAt: number }>();
const verifying = new Map<string, Promise<Identity>>();
const limits = new Map<string, { count: number; expiresAt: number }>();
const failures = new Map<string, { status: number; expiresAt: number }>();

export function clearCustomSrsAuthCacheForTests() {
  identities.clear(); verifying.clear(); limits.clear(); failures.clear();
}

function boundedSet<T>(map: Map<string, T>, key: string, value: T) {
  map.delete(key); map.set(key, value);
  while (map.size > 500) map.delete(map.keys().next().value!);
}

function object(value: unknown): value is RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (object(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: CORS });
}

// Reject identity and state injection: clients can send actions, never account IDs or cards.
export function validateCustomSrsRequest(value: unknown): Mutation | null {
  if (!object(value)) return null;
  const exactKeys = (...keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
  if (value.action === "read") return exactKeys("action") ? { action: "read" } : null;
  if (typeof value.eventId !== "string" || !UUID.test(value.eventId)) return null;
  if (value.action === "enroll_pack" && exactKeys("action", "packId", "eventId") && typeof value.packId === "string" && value.packId.length > 0 && value.packId.length <= 120) {
    return { action: value.action, packId: value.packId, eventId: value.eventId };
  }
  if (typeof value.wordId !== "string" || !value.wordId || value.wordId.length > 180) return null;
  if (value.action === "complete_lesson" && exactKeys("action", "wordId", "eventId")) {
    return { action: value.action, wordId: value.wordId, eventId: value.eventId };
  }
  if (value.action === "submit_review" && exactKeys("action", "wordId", "eventId", "incorrectAnswers") && Number.isSafeInteger(value.incorrectAnswers) && Number(value.incorrectAnswers) >= 0 && Number(value.incorrectAnswers) <= 100) {
    return { action: value.action, wordId: value.wordId, eventId: value.eventId, incorrectAnswers: Number(value.incorrectAnswers) };
  }
  return null;
}

async function boundedJson(source: Request | Response, maxBytes: number): Promise<unknown> {
  if (Number(source.headers.get("content-length")) > maxBytes) throw new Error("Response exceeds limit");
  const reader = source.body?.getReader();
  if (!reader) throw new Error("Missing JSON body");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new Error("Response exceeds limit"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(buffer));
}

async function verifyIdentity(token: string, dependencies: CustomSrsDependencies) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const key = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
  const now = dependencies.now().getTime();
  const limit = limits.get(key);
  if (limit && limit.expiresAt > now && limit.count >= 120) throw new RequestError(429, "Too many custom study requests. Try again shortly.");
  boundedSet(limits, key, { count: limit && limit.expiresAt > now ? limit.count + 1 : 1, expiresAt: limit && limit.expiresAt > now ? limit.expiresAt : now + 60_000 });
  const cached = identities.get(key);
  if (cached && cached.expiresAt > now) return cached.identity;
  const failure = failures.get(key);
  if (failure && failure.expiresAt > now) throw new RequestError(failure.status, failure.status === 401 ? "Your WaniKani session needs to be renewed." : "WaniKani could not verify your account. Try again shortly.");
  const pending = verifying.get(key);
  if (pending) return pending;
  if (verifying.size >= 8) throw new RequestError(429, "Account verification is busy. Try again shortly.");
  const request = (async () => {
    const response = await dependencies.fetch("https://api.wanikani.com/v2/user", {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "Wanikani-Revision": "20170710" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const status = response.status === 401 || response.status === 403 ? 401 : 503;
      boundedSet(failures, key, { status, expiresAt: now + (status === 401 ? 60_000 : 5_000) });
      throw new RequestError(status, status === 401 ? "Your WaniKani session needs to be renewed." : "WaniKani could not verify your account. Try again shortly.");
    }
    const value = await boundedJson(response, 100_000);
    if (!object(value) || !object(value.data)) throw new Error("Invalid identity");
    const rawId = value.data.id ?? value.id;
    const id = typeof rawId === "string" || typeof rawId === "number" ? String(rawId).trim() : "";
    const username = typeof value.data.username === "string" ? value.data.username.trim() : "";
    if (!id || !username) throw new Error("Invalid identity");
    const identity = { id, username };
    boundedSet(identities, key, { identity, expiresAt: now + 5 * 60_000 });
    return identity;
  })();
  verifying.set(key, request);
  try { return await request; } finally { verifying.delete(key); }
}

function serviceHeaders(key: string) {
  return {
    apikey: key,
    ...(/^[\w-]+\.[\w-]+\.[\w-]+$/.test(key) ? { Authorization: `Bearer ${key}` } : {}),
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function parseStoredState(value: unknown, now: Date): CustomSrsState {
  // Never overwrite an unrecognized cloud policy with an empty local state.
  if (!object(value) || value.version !== 1 || canonical(value.policy) !== canonical(CUSTOM_SRS_POLICY) || !object(value.assignments) || !Array.isArray(value.enrolledPackIds) || !Array.isArray(value.reviewLog)) {
    throw new Error("Cloud progress uses an unsupported schema");
  }
  const state = loadCustomSrsState({ getItem: () => JSON.stringify(value) }, "edge", packs, now);
  const knownIds = new Set(packs.flatMap((pack) => pack.words.map((word) => word.id)));
  for (const id of Object.keys(value.assignments)) {
    const original = value.assignments[id];
    const normalized = state.assignments[id];
    if (knownIds.has(id) && (!object(original) || !normalized || canonical({ ...original, packId: normalized.packId }) !== canonical(normalized))) {
      throw new Error("Cloud progress contains an invalid assignment");
    }
  }
  return state;
}

async function readState(userId: string, url: string, key: string, dependencies: CustomSrsDependencies) {
  const endpoint = new URL(`${url}/rest/v1/custom_srs_states`);
  endpoint.searchParams.set("select", "state,revision");
  endpoint.searchParams.set("user_id", `eq.${userId}`);
  endpoint.searchParams.set("limit", "1");
  const response = await dependencies.fetch(endpoint, { headers: serviceHeaders(key), signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error("Cloud read failed");
  const value = await boundedJson(response, 2_500_000);
  if (!Array.isArray(value)) throw new Error("Invalid cloud state");
  if (!value.length) return { state: createCustomSrsState(dependencies.now()), revision: -1 };
  const row = value[0];
  if (!object(row) || !Number.isSafeInteger(row.revision) || Number(row.revision) < 0) throw new Error("Invalid cloud revision");
  return { state: parseStoredState(row.state, dependencies.now()), revision: Number(row.revision) };
}

export async function handleCustomSrsRequest(request: Request, overrides: Partial<CustomSrsDependencies> = {}): Promise<Response> {
  const dependencies: CustomSrsDependencies = {
    env: (name) => Deno.env.get(name), fetch: (input, init) => fetch(input, init), now: () => new Date(), ...overrides,
  };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const token = request.headers.get("x-wanikani-token")?.trim();
  if (!token || token.length > 512) return json({ error: "A WaniKani session is required." }, 401);
  const url = dependencies.env("SUPABASE_URL")?.replace(/\/+$/, "");
  const key = dependencies.env("SUPABASE_SERVICE_ROLE_KEY") || dependencies.env("SUPABASE_SECRET_KEY");
  if (!url || !key) return json({ error: "Custom vocabulary cloud sync is not configured." }, 503);
  let action: Mutation | null;
  try { action = validateCustomSrsRequest(await boundedJson(request, 16_000)); }
  catch { action = null; }
  if (!action) return json({ error: "This custom study request is invalid." }, 400);

  try {
    const identity = await verifyIdentity(token, dependencies);
    if (identity.username.toLowerCase() !== "portego") return json({ error: "This feature is not available for this account." }, 403);
    if (action.action === "read") return json({ available: true, ...await readState(identity.id, url, key, dependencies) });
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const current = await readState(identity.id, url, key, dependencies);
      const now = dependencies.now();
      let state: CustomSrsState;
      try {
        if (action.action === "enroll_pack") {
          const pack = packs.find((pack) => pack.id === action.packId);
          if (!pack) throw new Error("Custom vocabulary pack not found.");
          state = enrollCustomVocabularyPack(current.state, pack, now);
        } else if (action.action === "complete_lesson") state = completeCustomLesson(current.state, action.wordId, now);
        else state = recordCustomReview(current.state, action.wordId, action.incorrectAnswers, now, action.eventId);
      } catch { throw new RequestError(409, "This word is no longer ready for this action. Refresh your progress and try again."); }
      if (state === current.state) return json({ available: true, ...current });
      const response = await dependencies.fetch(`${url}/rest/v1/rpc/compare_and_set_custom_srs_state`, {
        method: "POST", headers: serviceHeaders(key), signal: AbortSignal.timeout(12_000),
        body: JSON.stringify({ p_user_id: identity.id, p_expected_revision: current.revision, p_state: state }),
      });
      if (!response.ok) throw new Error("Cloud write failed");
      const result = await boundedJson(response, 2_500_000);
      if (result === null) continue;
      if (!object(result) || !Number.isSafeInteger(result.revision) || Number(result.revision) < 0) throw new Error("Invalid cloud write result");
      return json({ available: true, state, revision: Number(result.revision) });
    }
    return json({ error: "Your progress changed on another device. Retry to sync the latest progress." }, 409);
  } catch (error) {
    if (error instanceof RequestError) return json({ error: error.message }, error.status);
    // Never return upstream diagnostics: they can contain request credentials.
    return json({ error: action.action === "read" ? "Custom vocabulary progress could not be loaded. Try again." : "Your progress could not be confirmed as saved. Retry before leaving this session." }, 503);
  }
}

if (import.meta.main) Deno.serve((request) => handleCustomSrsRequest(request));
