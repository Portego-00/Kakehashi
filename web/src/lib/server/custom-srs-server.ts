import "server-only";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readBoundedJson } from "@/features/content/server-security";
import { createCustomSrsState, reconcileCustomSrsState } from "@/features/custom-srs/model";
import { customSrsWireResult } from "@/features/custom-srs/transport";
import { customSrsStatePatch } from "@/features/custom-srs/state-patch";
import { parseCustomSrsStateStrict } from "@/features/custom-srs/storage";
import type { CustomSrsState, CustomVocabularyPack } from "@/features/custom-srs/types";

type JsonRecord = Record<string, unknown>;
type Selection = { wordIds: string[]; eventId: string };
type StoredState = { state: CustomSrsState; revision: number };

function developmentEnv() {
  if (process.env.NODE_ENV === "production") return {} as Record<string, string>;
  try {
    return Object.fromEntries(
      readFileSync(resolve(process.cwd(), "../.env"), "utf8")
        .split(/\r?\n/)
        .filter((line) => line && !line.trimStart().startsWith("#") && line.includes("="))
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")];
        }),
    );
  } catch {
    return {} as Record<string, string>;
  }
}

const localEnv = developmentEnv();
const supabaseUrl = (
  process.env.SUPABASE_URL
  || process.env.NEXT_PUBLIC_SUPABASE_URL
  || process.env.EXPO_PUBLIC_SUPABASE_URL
  || localEnv.SUPABASE_URL
  || localEnv.NEXT_PUBLIC_SUPABASE_URL
  || localEnv.EXPO_PUBLIC_SUPABASE_URL
  || ""
).replace(/\/$/, "");
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SECRET_KEY
  || localEnv.SUPABASE_SERVICE_ROLE_KEY
  || localEnv.SUPABASE_SECRET_KEY
  || "";
const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function headers(additional: Record<string, string> = {}) {
  return {
    apikey: supabaseServiceKey,
    ...(JWT_SHAPE.test(supabaseServiceKey) ? { Authorization: `Bearer ${supabaseServiceKey}` } : {}),
    ...additional,
  };
}

function parseState(value: unknown, packs: readonly CustomVocabularyPack[], now: Date) {
  return parseCustomSrsStateStrict(value, packs, now);
}

function backendError(payload: unknown, status: number) {
  const message = payload && typeof payload === "object" && !Array.isArray(payload) && typeof (payload as JsonRecord).message === "string"
    ? String((payload as JsonRecord).message)
    : `HTTP ${status}`;
  return new Error(`Custom SRS store rejected the request: ${message}`);
}

export function customSrsBackendConfigured() {
  return Boolean(supabaseUrl && supabaseServiceKey);
}

export async function readCustomSrsRevision(userId: string): Promise<number> {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/read_custom_srs_revision`, {
    method: "POST", headers: headers({ "Content-Type": "application/json" }), cache: "no-store", signal: AbortSignal.timeout(12_000),
    body: JSON.stringify({ p_user_id: userId }),
  });
  const revision = await readBoundedJson(response, 1000);
  if (!response.ok || typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < -1) throw new Error("Invalid cloud revision.");
  return revision;
}

export async function readRemoteCustomSrsState(userId: string, packs: readonly CustomVocabularyPack[], now = new Date()): Promise<StoredState> {
  if (!customSrsBackendConfigured()) return { state: createCustomSrsState(now), revision: -1 };
  const url = new URL(`${supabaseUrl}/rest/v1/custom_srs_states`);
  url.searchParams.set("select", "state,revision");
  url.searchParams.set("user_id", `eq.${userId}`);
  url.searchParams.set("limit", "1");
  const response = await fetch(url, {
    headers: headers({ Accept: "application/json" }),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const payload = await readBoundedJson(response, 16_000_000).catch(() => null);
  if (!response.ok) throw backendError(payload, response.status);
  if (!Array.isArray(payload)) throw new Error("Custom SRS store returned an unreadable response.");
  if (!payload.length) return { state: createCustomSrsState(now), revision: -1 };
  const row = payload[0] as JsonRecord;
  const revision = row.revision as number;
  if (!Number.isSafeInteger(revision) || revision < 0) throw new Error("Custom SRS store returned an invalid revision.");
  return { state: parseState(row.state, packs, now), revision };
}

async function readSelectedState(userId: string, packs: readonly CustomVocabularyPack[], now: Date, selection: Selection): Promise<StoredState> {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/read_custom_srs_cards`, {
    method: "POST", headers: headers({ "Content-Type": "application/json" }), cache: "no-store", signal: AbortSignal.timeout(12_000),
    body: JSON.stringify({ p_user_id: userId, p_word_ids: selection.wordIds, p_event_id: selection.eventId }),
  });
  const payload = await readBoundedJson(response, 16_000_000);
  if (!response.ok) throw backendError(payload, response.status);
  if (payload === null) return { state: createCustomSrsState(now), revision: -1 };
  const row = payload as StoredState;
  if (!Number.isSafeInteger(row.revision) || row.revision < 0) throw new Error("Invalid cloud revision.");
  const ids = new Set(selection.wordIds);
  const selectedPacks = packs.map((pack) => ({ ...pack, words: pack.words.filter((word) => ids.has(word.id)) }));
  return { state: parseState(row.state, selectedPacks, now), revision: row.revision };
}

async function compareAndSetRemoteState(userId: string, expectedRevision: number, previous: CustomSrsState, state: CustomSrsState) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/patch_custom_srs_state_v2`, {
    method: "POST",
    headers: headers({ Accept: "application/json", "Content-Type": "application/json" }),
    body: JSON.stringify({ p_user_id: userId, p_expected_revision: expectedRevision, ...customSrsStatePatch(previous, state) }),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const payload = await readBoundedJson(response, 16_000_000).catch(() => null);
  if (!response.ok) throw backendError(payload, response.status);
  if (payload === null) return null;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Custom SRS store returned an invalid write result.");
  const revision = Number((payload as JsonRecord).revision);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : null;
}

export async function mutateRemoteCustomSrsState(
  userId: string,
  packs: readonly CustomVocabularyPack[],
  transform: (state: CustomSrsState, now: Date) => CustomSrsState,
  clock = () => new Date(),
  knownRevision?: number,
  selection?: Selection,
) {
  if (!customSrsBackendConfigured()) throw new Error("The custom SRS backend is not configured.");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const now = clock();
    const current = selection ? await readSelectedState(userId, packs, now, selection) : await readRemoteCustomSrsState(userId, packs, now);
    const transformed = transform(current.state, now);
    const respond = async (result: StoredState) => {
      if (selection && knownRevision !== current.revision) return customSrsWireResult(await readRemoteCustomSrsState(userId, packs, now));
      return customSrsWireResult(result, current, knownRevision);
    };
    if (transformed === current.state) return respond(current);
    const next = selection ? transformed : reconcileCustomSrsState(transformed, packs, now);
    const revision = await compareAndSetRemoteState(userId, current.revision, current.state, next);
    if (revision !== null) return respond({ state: next, revision });
  }
  throw new Error("Custom SRS state changed in another session. Retry the action.");
}

/** Private library RPCs use the same service credentials and verified account as SRS. */
export async function personalVocabularyRpc(name: "read_custom_vocabulary" | "mutate_custom_vocabulary", parameters: Record<string, unknown>) {
  if (!customSrsBackendConfigured()) throw new Error("Custom vocabulary cloud storage is not configured.");
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST", headers: headers({ "Content-Type": "application/json" }), cache: "no-store", signal: AbortSignal.timeout(20_000),
    body: JSON.stringify(parameters),
  });
  const payload = await readBoundedJson(response, 16_000_000);
  if (!response.ok) throw backendError(payload, response.status);
  return payload;
}
