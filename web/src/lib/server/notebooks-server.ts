import "server-only";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readBoundedJson } from "@/features/content/server-security";
import { applyNotebookMutation, createNotebookState, DEFAULT_NOTEBOOK_LIMITS, NOTEBOOK_HARD_MAX_BYTES, NotebookError, validateNotebookState, type NotebookLimits, type NotebookMutation, type NotebookState } from "@/features/notebooks/model";

type StoredState = { state: NotebookState; revision: number };
function developmentEnv() {
  if (process.env.NODE_ENV === "production") return {} as Record<string, string>;
  try {
    return Object.fromEntries(readFileSync(resolve(process.cwd(), "../.env"), "utf8").split(/\r?\n/).filter((line) => line && !line.trimStart().startsWith("#") && line.includes("=")).map((line) => { const index = line.indexOf("="); return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")]; }));
  } catch { return {} as Record<string, string>; }
}
const localEnv = developmentEnv();
const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || localEnv.SUPABASE_URL || localEnv.NEXT_PUBLIC_SUPABASE_URL || localEnv.EXPO_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || localEnv.SUPABASE_SERVICE_ROLE_KEY || localEnv.SUPABASE_SECRET_KEY || "";
const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
function headers() { return { apikey: serviceKey, ...(JWT_SHAPE.test(serviceKey) ? { Authorization: `Bearer ${serviceKey}` } : {}), Accept: "application/json", "Content-Type": "application/json" }; }
export function notebooksBackendConfigured() { return Boolean(supabaseUrl && serviceKey); }
export function notebookServerLimits(): NotebookLimits {
  const configured = Number(process.env.NOTEBOOK_MAX_BYTES || localEnv.NOTEBOOK_MAX_BYTES || DEFAULT_NOTEBOOK_LIMITS.maxBytes);
  return { ...DEFAULT_NOTEBOOK_LIMITS, maxBytes: Number.isSafeInteger(configured) ? Math.max(65_536, Math.min(NOTEBOOK_HARD_MAX_BYTES, configured)) : DEFAULT_NOTEBOOK_LIMITS.maxBytes };
}
function verifiedUserId(userId: string) { if ((!/^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/.test(userId) || userId === "demo-level-21")) throw new NotebookError("A verified WaniKani account is required for cloud notebooks.", "invalid", 403); }
function backendError(status: number) { return new Error(`Notebook storage is unavailable (HTTP ${status}).`); }
export async function readRemoteNotebookState(userId: string): Promise<StoredState> {
  verifiedUserId(userId);
  if (!notebooksBackendConfigured()) return { state: createNotebookState(), revision: -1 };
  const url = new URL(`${supabaseUrl}/rest/v1/notebook_states`);
  url.searchParams.set("select", "state,revision"); url.searchParams.set("user_id", `eq.${userId}`); url.searchParams.set("limit", "1");
  const response = await fetch(url, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(12_000) });
  const payload = await readBoundedJson(response, NOTEBOOK_HARD_MAX_BYTES * 2 + 16_384);
  if (!response.ok) throw backendError(response.status);
  if (!Array.isArray(payload)) throw new Error("Notebook storage returned an invalid response.");
  if (!payload.length) return { state: createNotebookState(), revision: -1 };
  const row = payload[0];
  if (!row || typeof row !== "object" || !Number.isSafeInteger(row.revision) || row.revision < 0) throw new Error("Notebook storage returned an invalid revision.");
  // A reduced account quota must not make an existing notebook unreadable.
  return { state: validateNotebookState(row.state, { ...DEFAULT_NOTEBOOK_LIMITS, maxBytes: NOTEBOOK_HARD_MAX_BYTES }), revision: row.revision };
}
async function compareAndSet(userId: string, expectedRevision: number, state: NotebookState): Promise<number | null> {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/compare_and_set_notebook_state`, { method: "POST", headers: headers(), body: JSON.stringify({ p_user_id: userId, p_expected_revision: expectedRevision, p_state: state }), cache: "no-store", signal: AbortSignal.timeout(12_000) });
  const payload = await readBoundedJson(response, 16_384);
  if (!response.ok) throw backendError(response.status);
  if (payload === null) return null;
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || !("revision" in payload) || !Number.isSafeInteger(payload.revision) || Number(payload.revision) < 0) throw new Error("Notebook storage returned an invalid write result.");
  return Number(payload.revision);
}
export async function mutateRemoteNotebookState(userId: string, mutation: NotebookMutation, clock = () => new Date()): Promise<StoredState & { sentenceId?: string }> {
  verifiedUserId(userId);
  if (!notebooksBackendConfigured()) throw new Error("Notebook cloud storage is not configured.");
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await readRemoteNotebookState(userId);
    const next = applyNotebookMutation(current.state, mutation, clock(), notebookServerLimits());
    if (JSON.stringify(next.state) === JSON.stringify(current.state)) return { ...next, revision: current.revision };
    const revision = await compareAndSet(userId, current.revision, next.state);
    if (revision !== null) return { ...next, revision };
  }
  throw new NotebookError("Your notebook changed in another session. Try saving again.", "conflict");
}
