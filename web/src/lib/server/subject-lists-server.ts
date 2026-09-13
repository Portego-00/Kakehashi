import "server-only";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readBoundedJson } from "@/features/content/server-security";

type JsonRecord = Record<string, unknown>;

export type CloudSubjectList = {
  id: string;
  name: string;
  subjectIds: number[];
  createdAt: string;
  updatedAt: string;
};

type SubjectListRow = {
  user_id: string;
  list_id: string;
  name: string;
  subject_ids: unknown;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

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
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SECRET_KEY
  || localEnv.SUPABASE_SERVICE_ROLE_KEY
  || localEnv.SUPABASE_SECRET_KEY
  || process.env.SUPABASE_ANON_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  || localEnv.SUPABASE_ANON_KEY
  || localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || localEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY
  || "";

export function subjectListsBackendConfigured() {
  return Boolean(supabaseUrl && supabaseKey);
}

function headers(prefer?: string) {
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : null),
  };
}

function normalizedSubjectIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
}

function toCloudList(row: SubjectListRow): CloudSubjectList | null {
  if (!row || typeof row.list_id !== "string" || typeof row.name !== "string" || typeof row.created_at !== "string" || typeof row.updated_at !== "string") return null;
  return {
    id: row.list_id,
    name: row.name,
    subjectIds: normalizedSubjectIds(row.subject_ids),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function readRows(userId: string) {
  if (!subjectListsBackendConfigured()) return [];
  const url = new URL(`${supabaseUrl}/rest/v1/subject_lists`);
  url.searchParams.set("select", "user_id,list_id,name,subject_ids,created_at,updated_at,deleted_at");
  url.searchParams.set("user_id", `eq.${userId}`);
  url.searchParams.set("order", "updated_at.desc");
  url.searchParams.set("limit", "1000");
  const response = await fetch(url, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(12_000) });
  const payload = await readBoundedJson(response, 2_000_000).catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && !Array.isArray(payload) && typeof (payload as JsonRecord).message === "string" ? String((payload as JsonRecord).message) : `HTTP ${response.status}`;
    throw new Error(`Subject-list service rejected the read: ${message}`);
  }
  return Array.isArray(payload) ? payload as SubjectListRow[] : [];
}

export async function readCloudSubjectLists(userId: string) {
  const rows = await readRows(userId);
  return rows.flatMap((row) => row.deleted_at ? [] : (toCloudList(row) ? [toCloudList(row)!] : []));
}

export async function replaceCloudSubjectLists(userId: string, lists: CloudSubjectList[]) {
  if (!subjectListsBackendConfigured()) return false;
  const existing = await readRows(userId);
  const activeIds = new Set(lists.map((list) => list.id));
  if (lists.length) {
    const url = new URL(`${supabaseUrl}/rest/v1/subject_lists`);
    url.searchParams.set("on_conflict", "user_id,list_id");
    const response = await fetch(url, {
      method: "POST",
      headers: headers("resolution=merge-duplicates,return=minimal"),
      body: JSON.stringify(lists.map((list) => ({
        user_id: userId,
        list_id: list.id,
        name: list.name,
        subject_ids: normalizedSubjectIds(list.subjectIds),
        created_at: list.createdAt,
        updated_at: list.updatedAt,
        deleted_at: null,
      }))),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`Subject-list service rejected the write: HTTP ${response.status}`);
  }

  const removedIds = existing.filter((row) => !row.deleted_at && !activeIds.has(row.list_id)).map((row) => row.list_id);
  if (removedIds.length) {
    const timestamp = new Date().toISOString();
    const url = new URL(`${supabaseUrl}/rest/v1/subject_lists`);
    url.searchParams.set("user_id", `eq.${userId}`);
    url.searchParams.set("list_id", `in.(${removedIds.join(",")})`);
    const response = await fetch(url, {
      method: "PATCH",
      headers: headers("return=minimal"),
      body: JSON.stringify({ deleted_at: timestamp, updated_at: timestamp }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`Subject-list service rejected the delete: HTTP ${response.status}`);
  }
  return true;
}
