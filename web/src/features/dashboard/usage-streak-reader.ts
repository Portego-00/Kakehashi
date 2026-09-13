import { activeDayKeysForSessions, parseActiveDayKeys } from "./usage-streak-calendar";

type Backend = { url: string; key: string };
type SessionRow = { id: string | number; session_started_at: string };
const PAGE_SIZE = 1_000;
const LEGACY_ROW_LIMIT = 30_000;
const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

async function readPayload(response: Response): Promise<unknown> {
  const maximum = 2_000_000;
  if (Number(response.headers.get("content-length")) > maximum) throw new Error("App-session history is too large.");
  if (!response.body) return null;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maximum) { await reader.cancel(); throw new Error("App-session history is too large."); }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text ? JSON.parse(text) : null;
}

export async function readAppSessionActiveDays(backend: Backend, userId: string, timezone: string, signal?: AbortSignal) {
  const headers = {
    apikey: backend.key,
    ...(JWT_SHAPE.test(backend.key) ? { Authorization: `Bearer ${backend.key}` } : {}),
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(12_000)]) : AbortSignal.timeout(12_000);
  const baseUrl = backend.url.replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/rest/v1/rpc/get_app_session_active_days`, {
    method: "POST", headers, cache: "no-store", signal: requestSignal,
    body: JSON.stringify({ p_user_id: userId, p_timezone: timezone }),
  });
  const payload = await readPayload(response);
  if (response.ok) {
    const days = parseActiveDayKeys(payload && typeof payload === "object" ? (payload as { activeDays?: unknown }).activeDays : null);
    if (!days) throw new Error("The app-session day response is invalid.");
    return days;
  }
  const code = payload && typeof payload === "object" ? (payload as { code?: string }).code : undefined;
  if (code !== "PGRST202" && code !== "42883") throw new Error("App-session history is unavailable.");

  // Compatibility during the additive migration. Never accept a truncated history as a complete streak.
  const sessions: string[] = [];
  let cursor: SessionRow | undefined;
  for (let page = 0; page <= LEGACY_ROW_LIMIT / PAGE_SIZE; page += 1) {
    const limit = page === LEGACY_ROW_LIMIT / PAGE_SIZE ? 1 : PAGE_SIZE;
    const url = new URL(`${baseUrl}/rest/v1/app_sessions`);
    url.searchParams.set("select", "id,session_started_at");
    url.searchParams.set("user_id", `eq.${userId}`);
    url.searchParams.set("order", "session_started_at.asc,id.asc");
    url.searchParams.set("limit", String(limit));
    if (cursor) {
      url.searchParams.set("or", `(session_started_at.gt.${cursor.session_started_at},and(session_started_at.eq.${cursor.session_started_at},id.gt.${cursor.id}))`);
    }
    const legacyResponse = await fetch(url, { headers, cache: "no-store", signal: requestSignal });
    const rows = await readPayload(legacyResponse);
    if (!legacyResponse.ok || !Array.isArray(rows) || rows.length > limit || rows.some((row) => !row || !/^[a-zA-Z0-9-]+$/.test(String(row.id ?? "")) || typeof row.session_started_at !== "string" || !/^\d{4}-\d{2}-\d{2}T[\d:.+-]+Z?$/.test(row.session_started_at) || Number.isNaN(Date.parse(row.session_started_at)))) {
      throw new Error("App-session history is unavailable or incomplete.");
    }
    if (sessions.length + rows.length > LEGACY_ROW_LIMIT) throw new Error("App-session history has too many rows for the legacy reader.");
    sessions.push(...rows.map((row: SessionRow) => row.session_started_at));
    if (rows.length < limit) return activeDayKeysForSessions(sessions, timezone);
    const nextCursor = rows.at(-1) as SessionRow;
    if (cursor && nextCursor.id === cursor.id && nextCursor.session_started_at === cursor.session_started_at) throw new Error("App-session history did not advance.");
    cursor = nextCursor;
  }
  throw new Error("App-session history is incomplete.");
}
