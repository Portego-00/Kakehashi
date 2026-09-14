const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXPO_TOKEN = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "private, no-store",
};
type ObjectValue = Record<string, unknown>;
type Activity = "issue_created" | "issue_comment_created" | "issue_liked" | "issue_comment_liked";
type Delivery = {
  id: string; claim_id: string; issue_id: string; source_id: string;
  activity_type: Activity; title: string; body: string; push_token: string;
  status: "sending" | "checking_receipt"; attempts: number; receipt_attempts: number;
  ticket_id: string | null;
};
type Outcome = {
  status: "pending" | "awaiting_receipt" | "delivered" | "failed";
  error?: string; ticketId?: string; retrySeconds?: number;
};
export interface IssueActivityPushDependencies {
  env: (name: string) => string | undefined;
  fetch: typeof fetch;
}
class RequestError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
function object(value: unknown): value is ObjectValue {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: CORS });
}
async function boundedJson(source: Request | Response, maxBytes: number): Promise<unknown> {
  if (Number(source.headers.get("content-length")) > maxBytes) throw new Error("JSON exceeds limit");
  const reader = source.body?.getReader();
  if (!reader) throw new Error("Missing JSON body");
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new Error("JSON exceeds limit"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(buffer));
}
function serviceHeaders(key: string) {
  return {
    apikey: key,
    ...(/^[\w-]+\.[\w-]+\.[\w-]+$/.test(key) ? { Authorization: `Bearer ${key}` } : {}),
    "Content-Type": "application/json", Accept: "application/json",
  };
}
async function secretMatches(actual: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([actual, expected].map(async (value) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))));
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
export function validateRegistration(value: unknown, eligibility = false): ObjectValue | null {
  if (!object(value)) return null;
  const keys = eligibility ? ["installationId", "platform"] : ["installationId", "platform", "expoPushToken"];
  if (Object.keys(value).length !== keys.length || !keys.every((key) => Object.hasOwn(value, key))) return null;
  if (value.platform !== "ios" || typeof value.installationId !== "string" || !UUID.test(value.installationId)) return null;
  if (!eligibility && (typeof value.expoPushToken !== "string" || value.expoPushToken.length > 256 || !EXPO_TOKEN.test(value.expoPushToken))) return null;
  return value;
}
async function verifyOwner(token: string, ownerId: string, dependencies: IssueActivityPushDependencies) {
  const response = await dependencies.fetch("https://api.wanikani.com/v2/user", {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "Wanikani-Revision": "20170710" },
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 401 || response.status === 403) throw new RequestError(401, "A valid WaniKani session is required.");
  if (!response.ok) throw new RequestError(503, "Account verification is unavailable.");
  const value = await boundedJson(response, 100_000);
  if (!object(value) || !object(value.data)) throw new Error("Invalid account response");
  const id = value.data.id ?? value.id;
  if ((typeof id !== "string" && typeof id !== "number") || String(id) !== ownerId) {
    throw new RequestError(403, "This iPhone is not approved for personal notifications.");
  }
}
export function notificationFor(delivery: Delivery) {
  return {
    to: delivery.push_token, sound: "default", title: delivery.title, body: delivery.body,
    data: { kind: "issueActivity", activityType: delivery.activity_type, issueId: delivery.issue_id, sourceId: delivery.source_id },
  };
}
function retry(delivery: Delivery, error: string): Outcome {
  const receipt = delivery.status === "checking_receipt";
  const attempt = receipt ? delivery.receipt_attempts : delivery.attempts;
  return {
    status: attempt >= (receipt ? 24 : 8) ? "failed" : receipt ? "awaiting_receipt" : "pending",
    error, retrySeconds: receipt ? 3600 : Math.min(3600, 60 * 2 ** Math.min(attempt, 6)),
  };
}
function expoError(value: unknown, delivery: Delivery): Outcome {
  const code = object(value) && object(value.details) && typeof value.details.error === "string" ? value.details.error : "ExpoError";
  if (["DeviceNotRegistered", "MessageTooBig", "InvalidCredentials", "MismatchSenderId"].includes(code)) return { status: "failed", error: code };
  // This receipt is a confirmed failed send, so retry delivery rather than
  // polling the same terminal receipt. An absent/unavailable receipt stays a poll.
  if (code === "MessageRateExceeded") return retry({ ...delivery, status: "sending" }, code);
  if (delivery.status === "checking_receipt") return { status: "failed", error: "ExpoError" };
  // Persist only known error codes, never Expo messages that can echo a token.
  return retry(delivery, "ExpoError");
}
async function deliver(delivery: Delivery, dependencies: IssueActivityPushDependencies): Promise<Outcome> {
  const receipt = delivery.status === "checking_receipt";
  const accessToken = dependencies.env("EXPO_ACCESS_TOKEN");
  const response = await dependencies.fetch(`https://exp.host/--/api/v2/push/${receipt ? "getReceipts" : "send"}`, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    body: JSON.stringify(receipt ? { ids: [delivery.ticket_id] } : notificationFor(delivery)),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    if (response.status === 429 || response.status >= 500) return retry(delivery, "ExpoUnavailable");
    return { status: "failed", error: response.status === 401 || response.status === 403 ? "InvalidCredentials" : "ExpoRequestRejected" };
  }
  const value = await boundedJson(response, 100_000);
  if (!object(value)) return retry(delivery, "InvalidExpoResponse");
  const result = receipt && object(value.data) ? value.data[String(delivery.ticket_id)] : Array.isArray(value.data) ? value.data[0] : value.data;
  if (!object(result)) return retry(delivery, receipt ? "ReceiptUnavailable" : "InvalidExpoResponse");
  if (result.status === "error") return expoError(result, delivery);
  if (result.status !== "ok") return retry(delivery, "InvalidExpoResponse");
  if (receipt) return { status: "delivered" };
  if (typeof result.id !== "string" || !result.id || result.id.length > 200) return retry(delivery, "InvalidExpoResponse");
  return { status: "awaiting_receipt", ticketId: result.id, retrySeconds: 900 };
}

export async function handleIssueActivityPushRequest(request: Request, overrides: Partial<IssueActivityPushDependencies> = {}): Promise<Response> {
  const dependencies: IssueActivityPushDependencies = { env: (name) => Deno.env.get(name), fetch: (input, init) => fetch(input, init), ...overrides };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const path = new URL(request.url).pathname.replace(/\/+$/, "");
  const registration = path.endsWith("/issue-activity-push/register");
  const eligibility = path.endsWith("/issue-activity-push/eligibility");
  if (!registration && !eligibility && !path.endsWith("/issue-activity-push")) return json({ error: "Not found." }, 404);
  const url = dependencies.env("SUPABASE_URL")?.replace(/\/+$/, "");
  const key = dependencies.env("SUPABASE_SERVICE_ROLE_KEY") || dependencies.env("SUPABASE_SECRET_KEY");
  const ownerId = dependencies.env("ISSUE_ACTIVITY_OWNER_WANIKANI_ID");
  const installationId = dependencies.env("ISSUE_ACTIVITY_APPROVED_INSTALLATION_ID")?.toLowerCase();
  if (!url || !key || !ownerId || !installationId || !UUID.test(installationId)) return json({ error: "Personal notifications are not configured." }, 503);
  const rpc = async (name: string, body: unknown) => {
    const response = await dependencies.fetch(`${url}/rest/v1/rpc/${name}`, { method: "POST", headers: serviceHeaders(key), body: JSON.stringify(body), signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error("Notification storage unavailable");
    return await boundedJson(response, 200_000);
  };
  try {
    if (registration || eligibility) {
      const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
      if (!token || token.length > 512) return json({ error: "A WaniKani session is required." }, 401);
      let payload: ObjectValue | null;
      try { payload = validateRegistration(await boundedJson(request, 4096), eligibility); } catch { payload = null; }
      if (!payload) return json({ error: "Invalid iPhone registration." }, 400);
      if (String(payload.installationId).toLowerCase() !== installationId) return json({ error: "This iPhone is not approved for personal notifications." }, 403);
      await verifyOwner(token, ownerId, dependencies);
      if (eligibility) return json({ eligible: true });
      const registered = await rpc("register_issue_activity_push", { p_owner_id: ownerId, p_installation_id: installationId, p_expo_push_token: payload.expoPushToken });
      if (registered !== true) return json({ error: "This iPhone is not approved for personal notifications." }, 403);
      return json({ registered: true });
    }
    const secret = dependencies.env("ISSUE_ACTIVITY_WEBHOOK_SECRET");
    if (!secret || secret.length < 32) return json({ error: "Personal notifications are not configured." }, 503);
    const provided = request.headers.get("x-issue-activity-secret") || "";
    if (!provided || provided.length > 1024 || !await secretMatches(provided, secret)) return json({ error: "Unauthorized." }, 401);
    let payload: unknown;
    try { payload = await boundedJson(request, 4096); } catch { return json({ error: "Invalid wakeup." }, 400); }
    // A wakeup cannot provide events, tokens, account IDs, or destination overrides.
    if (!object(payload) || Object.keys(payload).length !== 0) return json({ error: "Invalid wakeup." }, 400);
    const deliveries = await rpc("claim_issue_activity_push", { p_owner_id: ownerId, p_installation_id: installationId, p_limit: 10 });
    if (!Array.isArray(deliveries)) throw new Error("Invalid queue result");
    const results = await Promise.allSettled((deliveries as Delivery[]).map(async (delivery) => {
      let outcome: Outcome;
      try { outcome = await deliver(delivery, dependencies); } catch { outcome = retry(delivery, "ExpoUnavailable"); }
      // Keep persistence outside the transport catch: never discard an accepted ticket on a database error.
      const saved = await rpc("finish_issue_activity_push", {
        p_id: delivery.id, p_claim_id: delivery.claim_id, p_status: outcome.status,
        p_error: outcome.error ?? null, p_ticket_id: outcome.ticketId ?? null, p_retry_seconds: outcome.retrySeconds ?? 60,
      });
      if (saved !== true) throw new Error("Delivery claim expired");
    }));
    if (results.some((result) => result.status === "rejected")) throw new Error("Some deliveries could not be saved");
    return json({ processed: deliveries.length });
  } catch (error) {
    if (error instanceof RequestError) return json({ error: error.message }, error.status);
    // Do not log or expose credentials, push tokens, community content, or upstream diagnostics.
    return json({ error: "Personal notifications are temporarily unavailable." }, 503);
  }
}
if (import.meta.main) Deno.serve((request) => handleIssueActivityPushRequest(request));
