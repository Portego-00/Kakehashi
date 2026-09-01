import "server-only";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readBoundedJson } from "@/features/content/server-security";
import { createCustomSrsState, reconcileCustomSrsState } from "@/features/custom-srs/model";
import { loadCustomSrsState } from "@/features/custom-srs/storage";
import type { CustomSrsState, CustomVocabularyPack } from "@/features/custom-srs/types";

type JsonRecord = Record<string, unknown>;
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
  return loadCustomSrsState({ getItem: () => JSON.stringify(value) }, "server", packs, now);
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
  const payload = await readBoundedJson(response, 2_500_000).catch(() => null);
  if (!response.ok) throw backendError(payload, response.status);
  if (!Array.isArray(payload) || !payload.length) return { state: createCustomSrsState(now), revision: -1 };
  const row = payload[0] as JsonRecord;
  const revision = Number(row.revision);
  if (!Number.isSafeInteger(revision) || revision < 0) throw new Error("Custom SRS store returned an invalid revision.");
  return { state: parseState(row.state, packs, now), revision };
}

async function compareAndSetRemoteState(userId: string, expectedRevision: number, state: CustomSrsState) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/compare_and_set_custom_srs_state`, {
    method: "POST",
    headers: headers({ Accept: "application/json", "Content-Type": "application/json" }),
    body: JSON.stringify({ p_user_id: userId, p_expected_revision: expectedRevision, p_state: state }),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const payload = await readBoundedJson(response, 2_500_000).catch(() => null);
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
) {
  if (!customSrsBackendConfigured()) throw new Error("The custom SRS backend is not configured.");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const now = clock();
    const current = await readRemoteCustomSrsState(userId, packs, now);
    const next = reconcileCustomSrsState(transform(current.state, now), packs, now);
    const revision = await compareAndSetRemoteState(userId, current.revision, next);
    if (revision !== null) return { state: next, revision };
  }
  throw new Error("Custom SRS state changed in another session. Retry the action.");
}
