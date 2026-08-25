import "server-only";

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { readBoundedJson } from "@/features/content/server-security";
import { unsealToken } from "@/lib/server/session-crypto";
import { canManageIssueAuthor, resolveCommunityModeFromEnvironment } from "./security-model";
import { applyLocalLikeToggle, findMutationReceipt } from "./repository-model";
import { identityFromUserPayload, type CommunityUserPayload } from "./identity-model";

type JsonRecord = Record<string, unknown>;
export type CommunityIdentity = { id: string; username: string; level: number; email: string };

function developmentEnv() {
  if (process.env.NODE_ENV === "production") return {} as Record<string, string>;
  try {
    return Object.fromEntries(readFileSync(resolve(process.cwd(), "../.env"), "utf8").split(/\r?\n/).filter((line) => line && !line.trimStart().startsWith("#") && line.includes("=")).map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")];
    }));
  } catch { return {} as Record<string, string>; }
}

const localEnv = developmentEnv();
const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || localEnv.SUPABASE_URL || localEnv.NEXT_PUBLIC_SUPABASE_URL || localEnv.EXPO_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || localEnv.SUPABASE_SERVICE_ROLE_KEY || localEnv.SUPABASE_SECRET_KEY || "";
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || localEnv.SUPABASE_ANON_KEY || localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || localEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
const localStore = process.env.COMMUNITY_LOCAL_STORE || localEnv.COMMUNITY_LOCAL_STORE || "";

export type CommunityMode = "supabase" | "supabase-native-dev" | "supabase-readonly" | "local-server" | "unavailable";
export function communityMode(): CommunityMode {
  return resolveCommunityModeFromEnvironment({ url: supabaseUrl, serviceRoleKey, anonKey, nodeEnv: process.env.NODE_ENV, localStore });
}
export function communityConfigured() { return communityMode() !== "unavailable"; }
export function communityWritable() { return communityMode() === "supabase" || communityMode() === "supabase-native-dev" || communityMode() === "local-server"; }

type LocalStore = {
  issues: JsonRecord[];
  issue_comments: JsonRecord[];
  issue_likes: JsonRecord[];
  comment_likes: JsonRecord[];
  patreon_supporters: JsonRecord[];
  mutation_receipts: JsonRecord[];
};
const localDirectory = resolve(process.cwd(), ".data");
const localFile = resolve(localDirectory, "community.json");
function emptyStore(): LocalStore { return { issues: [], issue_comments: [], issue_likes: [], comment_likes: [], patreon_supporters: [], mutation_receipts: [] }; }
function readLocalStore() { try { const value = JSON.parse(readFileSync(localFile, "utf8")) as Partial<LocalStore>; return { ...emptyStore(), ...value }; } catch { return emptyStore(); } }
function writeLocalStore(store: LocalStore) { mkdirSync(localDirectory, { recursive: true }); const next = `${localFile}.next`; writeFileSync(next, JSON.stringify(store, null, 2), { mode: 0o600 }); renameSync(next, localFile); }
function localRows(table: Exclude<keyof LocalStore, "mutation_receipts">, url: URL, store: LocalStore) {
  let rows = [...store[table]];
  for (const field of ["id", "issue_id", "comment_id", "user_id", "status"] as const) {
    const value = url.searchParams.get(field);
    if (value?.startsWith("eq.")) rows = rows.filter((row) => String(row[field] ?? "") === decodeURIComponent(value.slice(3)));
    if (value?.startsWith("in.(") && value.endsWith(")")) { const ids = new Set(value.slice(4, -1).split(",")); rows = rows.filter((row) => ids.has(String(row[field]))); }
  }
  const broad = url.searchParams.get("or");
  if (broad) { const needle = decodeURIComponent(broad).match(/\.ilike\.\*([^*]+)\*/)?.[1]?.toLocaleLowerCase(); if (needle) rows = rows.filter((row) => [row.title, row.content, row.user_username].some((value) => String(value || "").toLocaleLowerCase().includes(needle))); }
  const [orderField, direction] = (url.searchParams.get("order") || "").split(".");
  if (orderField) rows.sort((left, right) => { const a = left[orderField], b = right[orderField]; const value = typeof a === "number" && typeof b === "number" ? a - b : String(a || "").localeCompare(String(b || "")); return direction === "desc" ? -value : value; });
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0)); const limit = Math.max(0, Number(url.searchParams.get("limit") || rows.length));
  return rows.slice(offset, offset + limit);
}

function localCommunityRequest(path: string, init?: RequestInit) {
  const url = new URL(path, "http://community.local/"); const table = url.pathname.slice(1) as Exclude<keyof LocalStore, "mutation_receipts">;
  if (!( ["issues", "issue_comments", "issue_likes", "comment_likes", "patreon_supporters"] as string[]).includes(table)) throw new Error("Unsupported community collection.");
  const store = readLocalStore(); const method = init?.method || "GET";
  if (method === "GET") return localRows(table, url, store);
  const body = init?.body ? JSON.parse(String(init.body)) as JsonRecord : {};
  if (method === "POST") { const now = new Date().toISOString(); const record: JsonRecord = { id: randomUUID(), created_at: now, updated_at: now, likes_count: 0, reply_count: 0, ...body }; store[table].push(record); writeLocalStore(store); return (init?.headers as Record<string, string> | undefined)?.Prefer === "return=representation" ? [record] : null; }
  const matches = new Set(localRows(table, url, store).map((row) => row.id));
  if (method === "PATCH") { store[table] = store[table].map((row) => matches.has(row.id) ? { ...row, ...body, updated_at: new Date().toISOString() } : row); writeLocalStore(store); return (init?.headers as Record<string, string> | undefined)?.Prefer === "return=representation" ? store[table].filter((row) => matches.has(row.id)) : null; }
  if (method === "DELETE") { store[table] = store[table].filter((row) => !matches.has(row.id)); writeLocalStore(store); return null; }
  throw new Error("Unsupported community method.");
}

export async function communityIdentity() {
  const sealed = (await cookies()).get("kakehashi_wk_session")?.value;
  if (!sealed) throw new Error("Sign in to participate in the community.");
  const token = unsealToken(sealed);
  const response = await fetch("https://api.wanikani.com/v2/user", { headers: { Authorization: `Bearer ${token}`, "Wanikani-Revision": "20170710", Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  const payload = await readBoundedJson(response, 256_000).catch(() => null) as CommunityUserPayload | null;
  const identity = identityFromUserPayload(payload);
  if (!response.ok || !identity) throw new Error("Your WaniKani identity could not be verified.");
  return identity satisfies CommunityIdentity;
}

export async function communityIdentityOrNull() { try { return await communityIdentity(); } catch { return null; } }

export function canManageCommunityIssue(issue: JsonRecord, identity: CommunityIdentity) {
  return canManageIssueAuthor(issue, identity, (process.env.COMMUNITY_ADMIN_USER_IDS || "").split(","));
}

export async function supabaseRequest(path: string, init?: RequestInit) {
  const mode = communityMode();
  if (mode === "local-server") return localCommunityRequest(path, init);
  if (mode === "unavailable") throw new Error("The shared community service is not configured.");
  if (mode === "supabase-readonly" && init?.method && init.method !== "GET" && init.method !== "HEAD") throw new Error("Community posting requires the server-side Supabase secret key.");
  const key = mode === "supabase" ? serviceRoleKey : anonKey;
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...(init?.headers || {}) }, cache: "no-store", signal: init?.signal || AbortSignal.timeout(12_000) });
  const payload = response.status === 204 ? null : await readBoundedJson(response, 1_000_000).catch(() => null);
  if (!response.ok) { const record = payload && typeof payload === "object" ? payload as JsonRecord : null; throw new Error(typeof record?.message === "string" ? record.message : `Community service returned HTTP ${response.status}.`); }
  return payload;
}

async function supabaseRpc(name: string, body: JsonRecord) {
  return supabaseRequest(`rpc/${name}`, { method: "POST", body: JSON.stringify(body) });
}

async function supabaseCount(path: string) {
  if (communityMode() === "local-server") {
    const rows = localCommunityRequest(path, { method: "GET" });
    return Array.isArray(rows) ? rows.length : 0;
  }
  const key = communityMode() === "supabase" ? serviceRoleKey : anonKey;
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: "HEAD",
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact", Range: "0-0" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Community service returned HTTP ${response.status}.`);
  const total = Number(response.headers.get("content-range")?.split("/")[1]);
  return Number.isFinite(total) ? total : 0;
}

export async function communityIssueCounts(query: string) {
  const value = query ? encodeFilter(query) : "";
  const search = value ? `&or=(title.ilike.*${value}*,content.ilike.*${value}*,user_username.ilike.*${value}*)` : "";
  const [open, closed] = await Promise.all([
    supabaseCount(`issues?select=id&status=eq.open${search}`),
    supabaseCount(`issues?select=id&status=eq.closed${search}`),
  ]);
  return { open, closed };
}

function receipt(store: LocalStore, requestId: string) { return findMutationReceipt(store.mutation_receipts, requestId); }
function saveReceipt(store: LocalStore, requestId: string, identity: CommunityIdentity, action: string, targetId: string, result: unknown) { store.mutation_receipts.push({ id: requestId, user_id: identity.id, action, target_id: targetId, result, created_at: new Date().toISOString() }); }

export async function addCommunityComment(input: { issueId: string; content: string; replyToCommentId?: string | null; requestId: string }, identity: CommunityIdentity) {
  const mode = communityMode();
  if (mode === "supabase" || mode === "supabase-native-dev") {
    if (input.replyToCommentId) {
      const parents = await supabaseRequest(`issue_comments?select=id&id=eq.${encodeURIComponent(input.replyToCommentId)}&issue_id=eq.${encodeURIComponent(input.issueId)}&limit=1`);
      if (!Array.isArray(parents) || parents.length === 0) throw new Error("The reply target does not belong to this issue.");
    }
    if (mode === "supabase") return supabaseRpc("community_add_comment", { p_request_id: input.requestId, p_issue_id: input.issueId, p_user_id: identity.id, p_user_email: identity.email, p_user_username: identity.username, p_user_level: identity.level, p_content: input.content, p_reply_to_comment_id: input.replyToCommentId || null });
    const comment = { issue_id: input.issueId, user_id: identity.id, user_email: identity.email, user_username: identity.username, user_level: identity.level, content: input.content, reply_to_comment_id: input.replyToCommentId || null };
    let items: unknown;
    try {
      items = await supabaseRequest("issue_comments?select=*", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...comment, idempotency_key: input.requestId }) });
    } catch (error) {
      const message = error instanceof Error ? error.message.toLocaleLowerCase() : "";
      if (!message.includes("idempotency_key") || (!message.includes("column") && !message.includes("schema cache"))) throw error;
      items = await supabaseRequest("issue_comments?select=*", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(comment) });
    }
    const comments = await supabaseRequest(`issue_comments?select=id&issue_id=eq.${encodeURIComponent(input.issueId)}`);
    await supabaseRequest(`issues?id=eq.${encodeURIComponent(input.issueId)}`, { method: "PATCH", body: JSON.stringify({ reply_count: Array.isArray(comments) ? comments.length : 0, updated_at: new Date().toISOString() }) });
    return Array.isArray(items) ? items[0] : items;
  }
  const store = readLocalStore(); const prior = receipt(store, input.requestId); if (prior) return prior;
  if (!store.issues.some((issue) => issue.id === input.issueId)) throw new Error("Issue not found.");
  if (input.replyToCommentId && !store.issue_comments.some((comment) => comment.id === input.replyToCommentId && comment.issue_id === input.issueId)) throw new Error("The reply target does not belong to this issue.");
  const now = new Date().toISOString(); const item = { id: randomUUID(), issue_id: input.issueId, user_id: identity.id, user_email: identity.email, user_username: identity.username, user_level: identity.level, content: input.content, reply_to_comment_id: input.replyToCommentId || null, likes_count: 0, created_at: now, updated_at: now };
  store.issue_comments.push(item); const issue = store.issues.find((entry) => entry.id === input.issueId)!; issue.reply_count = store.issue_comments.filter((comment) => comment.issue_id === input.issueId).length; issue.updated_at = now;
  saveReceipt(store, input.requestId, identity, "addComment", input.issueId, item); writeLocalStore(store); return item;
}

export async function toggleCommunityLike(kind: "issue" | "comment", targetId: string, requestId: string, identity: CommunityIdentity) {
  const mode = communityMode();
  if (mode === "supabase") return supabaseRpc(kind === "issue" ? "community_toggle_issue_like" : "community_toggle_comment_like", { p_request_id: requestId, p_target_id: targetId, p_user_id: identity.id });
  if (mode === "supabase-native-dev") {
    const table = kind === "issue" ? "issue_likes" : "comment_likes";
    const targetColumn = kind === "issue" ? "issue_id" : "comment_id";
    const targetTable = kind === "issue" ? "issues" : "issue_comments";
    const existing = await supabaseRequest(`${table}?select=id&${targetColumn}=eq.${encodeURIComponent(targetId)}&user_id=eq.${encodeURIComponent(identity.id)}`) as JsonRecord[];
    const liked = existing.length === 0;
    if (liked) await supabaseRequest(table, { method: "POST", body: JSON.stringify({ [targetColumn]: targetId, user_id: identity.id }) });
    else await supabaseRequest(`${table}?id=in.(${existing.map((row) => row.id).join(",")})`, { method: "DELETE" });
    const allLikes = await supabaseRequest(`${table}?select=id&${targetColumn}=eq.${encodeURIComponent(targetId)}`);
    const likesCount = Array.isArray(allLikes) ? allLikes.length : 0;
    await supabaseRequest(`${targetTable}?id=eq.${encodeURIComponent(targetId)}`, { method: "PATCH", body: JSON.stringify({ likes_count: likesCount, updated_at: new Date().toISOString() }) });
    return { liked, likes_count: likesCount };
  }
  const store = readLocalStore();
  const result = applyLocalLikeToggle({ kind, targetId, requestId, userId: identity.id, likes: kind === "issue" ? store.issue_likes : store.comment_likes, targets: kind === "issue" ? store.issues : store.issue_comments, receipts: store.mutation_receipts, likeId: randomUUID(), now: new Date().toISOString() });
  writeLocalStore(store); return result;
}

export async function deleteCommunityIssue(issueId: string) {
  if (communityMode() === "supabase" || communityMode() === "supabase-native-dev") return supabaseRequest(`issues?id=eq.${encodeURIComponent(issueId)}`, { method: "DELETE" });
  const store = readLocalStore();
  const commentIds = new Set(store.issue_comments.filter((comment) => comment.issue_id === issueId).map((comment) => comment.id));
  store.issue_likes = store.issue_likes.filter((like) => like.issue_id !== issueId);
  store.comment_likes = store.comment_likes.filter((like) => !commentIds.has(like.comment_id));
  store.issue_comments = store.issue_comments.filter((comment) => comment.issue_id !== issueId);
  store.issues = store.issues.filter((issue) => issue.id !== issueId);
  writeLocalStore(store);
}

export function encodeFilter(value: string) { return encodeURIComponent(value.replace(/[, *()]/g, " ").trim()); }
