import "server-only";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function developmentEnv() {
  if (process.env.NODE_ENV === "production") return {} as Record<string, string>;
  try {
    return Object.fromEntries(readFileSync(resolve(process.cwd(), "../.env"), "utf8").split(/\r?\n/).filter((line) => line && !line.trimStart().startsWith("#") && line.includes("=")).map((line) => { const index = line.indexOf("="); return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")]; }));
  } catch { return {} as Record<string, string>; }
}
export const localEnv = developmentEnv();
const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || localEnv.SUPABASE_URL || localEnv.NEXT_PUBLIC_SUPABASE_URL || localEnv.EXPO_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || localEnv.SUPABASE_SERVICE_ROLE_KEY || localEnv.SUPABASE_SECRET_KEY || "";
const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
export function notebookBackendHeaders() { return { apikey: serviceKey, ...(JWT_SHAPE.test(serviceKey) ? { Authorization: `Bearer ${serviceKey}` } : {}), Accept: "application/json", "Content-Type": "application/json" }; }

export function notebookBackendUrl() { return supabaseUrl; }
export function notebookBackendConfigured() { return Boolean(supabaseUrl && serviceKey); }
