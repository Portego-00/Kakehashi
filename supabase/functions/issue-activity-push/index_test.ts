import { handleIssueActivityPushRequest, validateRegistration } from "./index.ts";

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function assert(value: unknown): asserts value { if (!value) throw new Error("Assertion failed"); }
const OWNER = "owner-wanikani-id";
const INSTALLATION = "11111111-1111-4111-8111-111111111111";
const TOKEN = "ExponentPushToken[only-this-iphone]";
const SECRET = "server-only-webhook-secret-at-least-32-characters";
const environment: Record<string, string | undefined> = {
  SUPABASE_URL: "https://project.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test",
  ISSUE_ACTIVITY_OWNER_WANIKANI_ID: OWNER, ISSUE_ACTIVITY_APPROVED_INSTALLATION_ID: INSTALLATION,
  ISSUE_ACTIVITY_WEBHOOK_SECRET: SECRET,
};
function env(values: Record<string, string | undefined> = {}) { return (name: string) => ({ ...environment, ...values })[name]; }
function request(route = "", body: unknown = {}, headers: Record<string, string> = {}) {
  return new Request(`https://project.supabase.co/functions/v1/issue-activity-push${route}`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-issue-activity-secret": SECRET, Authorization: "Bearer wani-token", ...headers }, body: JSON.stringify(body),
  });
}
function registration() { return { installationId: INSTALLATION, expoPushToken: TOKEN, platform: "ios" }; }
function delivery(values: Record<string, unknown> = {}) {
  return { id: "event-id", claim_id: "claim-id", issue_id: "issue-id", source_id: "source-id", activity_type: "issue_liked", title: "Issue liked", body: "Someone liked an issue", push_token: TOKEN, status: "sending", attempts: 1, receipt_attempts: 0, ticket_id: null, ...values };
}

Deno.test("registration rejects injected identity, wrong platform, malformed token and extra fields", () => {
  equal(validateRegistration(registration()), registration());
  for (const value of [
    { ...registration(), userId: OWNER }, { ...registration(), platform: "android" },
    { ...registration(), expoPushToken: "apns-token" }, { ...registration(), installationId: "iphone-name" },
    { ...registration(), destination: "other-phone" },
  ]) equal(validateRegistration(value), null);
});

Deno.test("unapproved installation, malformed payload and unauthenticated wakeup never access services", async () => {
  let calls = 0;
  const fakeFetch = (() => { calls++; throw new Error("Unexpected service access"); }) as typeof fetch;
  for (const [req, expected] of [
    [request("/register", { ...registration(), installationId: "22222222-2222-4222-8222-222222222222" }), 403],
    [request("/register", { ...registration(), userId: OWNER }), 400],
    [request("", {}, { "x-issue-activity-secret": "wrong" }), 401],
    [request("", { to: TOKEN }), 400],
    [request("/register", registration(), { Authorization: "" }), 401],
  ] as const) equal((await handleIssueActivityPushRequest(req, { env: env(), fetch: fakeFetch })).status, expected);
  equal(calls, 0);
});

Deno.test("server fails closed until an installation has been explicitly approved", async () => {
  let calls = 0;
  const response = await handleIssueActivityPushRequest(request("/register", registration()), {
    env: env({ ISSUE_ACTIVITY_APPROVED_INSTALLATION_ID: undefined }),
    fetch: (() => { calls++; throw new Error("Unexpected"); }) as typeof fetch,
  });
  equal(response.status, 503); equal(calls, 0);
});

Deno.test("a different WaniKani account cannot register even on the approved installation", async () => {
  const calls: string[] = [];
  const response = await handleIssueActivityPushRequest(request("/register", registration()), {
    env: env(), fetch: ((input) => { calls.push(String(input)); return Promise.resolve(Response.json({ data: { id: "someone-else", username: "portego" } })); }) as typeof fetch,
  });
  equal(response.status, 403); equal(calls, ["https://api.wanikani.com/v2/user"]);
});

Deno.test("eligibility verifies immutable WaniKani identity without storing a destination", async () => {
  let calls = 0;
  const response = await handleIssueActivityPushRequest(request("/eligibility", { installationId: INSTALLATION, platform: "ios" }), {
    env: env(), fetch: ((input, init) => {
      calls++; equal(String(input), "https://api.wanikani.com/v2/user");
      equal(new Headers(init?.headers).get("authorization"), "Bearer wani-token");
      return Promise.resolve(Response.json({ data: { id: OWNER, username: "updated-username" } }));
    }) as typeof fetch,
  });
  equal(response.status, 200); equal(await response.json(), { eligible: true }); equal(calls, 1);
});

Deno.test("registration sends only server-pinned identity and the phone token to the service-only RPC", async () => {
  let stored: unknown; let headers: Headers | undefined;
  const response = await handleIssueActivityPushRequest(request("/register", registration()), {
    env: env(), fetch: ((input, init) => {
      if (String(input) === "https://api.wanikani.com/v2/user") return Promise.resolve(Response.json({ data: { id: OWNER } }));
      equal(String(input), "https://project.supabase.co/rest/v1/rpc/register_issue_activity_push");
      stored = JSON.parse(String(init?.body)); headers = new Headers(init?.headers);
      return Promise.resolve(Response.json(true));
    }) as typeof fetch,
  });
  equal(response.status, 200); equal(await response.json(), { registered: true });
  equal(stored, { p_owner_id: OWNER, p_installation_id: INSTALLATION, p_expo_push_token: TOKEN });
  equal(headers?.get("apikey"), "sb_secret_test"); equal(headers?.get("authorization"), null);
});

async function runDelivery(row: ReturnType<typeof delivery>, expoResponse: Response | Error) {
  let notification: unknown; let finished: Record<string, unknown> | undefined; let expoUrl = "";
  const response = await handleIssueActivityPushRequest(request(), {
    env: env(), fetch: ((input, init) => {
      const url = String(input);
      if (url.endsWith("/claim_issue_activity_push")) {
        equal(JSON.parse(String(init?.body)), { p_owner_id: OWNER, p_installation_id: INSTALLATION, p_limit: 10 });
        return Promise.resolve(Response.json([row]));
      }
      if (url.startsWith("https://exp.host/")) {
        expoUrl = url; notification = JSON.parse(String(init?.body));
        if (expoResponse instanceof Error) return Promise.reject(expoResponse);
        return Promise.resolve(expoResponse);
      }
      assert(url.endsWith("/finish_issue_activity_push")); finished = JSON.parse(String(init?.body));
      return Promise.resolve(Response.json(true));
    }) as typeof fetch,
  });
  equal(response.status, 200); assert(finished);
  return { notification, finished, expoUrl };
}

Deno.test("queue dispatch sends to its single private token and saves an Expo ticket for later receipt checking", async () => {
  const result = await runDelivery(delivery(), Response.json({ data: { status: "ok", id: "expo-ticket" } }));
  equal(result.notification, { to: TOKEN, sound: "default", title: "Issue liked", body: "Someone liked an issue", data: { kind: "issueActivity", activityType: "issue_liked", issueId: "issue-id", sourceId: "source-id" } });
  equal(result.finished, { p_id: "event-id", p_claim_id: "claim-id", p_status: "awaiting_receipt", p_error: null, p_ticket_id: "expo-ticket", p_retry_seconds: 900 });
});

Deno.test("receipt success records provider acceptance without sending a second notification", async () => {
  const result = await runDelivery(delivery({ status: "checking_receipt", ticket_id: "expo-ticket", receipt_attempts: 1 }), Response.json({ data: { "expo-ticket": { status: "ok" } } }));
  equal(result.expoUrl, "https://exp.host/--/api/v2/push/getReceipts");
  equal(result.notification, { ids: ["expo-ticket"] }); equal(result.finished.p_status, "delivered");
});

Deno.test("DeviceNotRegistered is terminal for both immediate tickets and later receipts", async () => {
  const failure = { status: "error", message: `Private upstream ${TOKEN}`, details: { error: "DeviceNotRegistered" } };
  for (const receipt of [false, true]) {
    const result = await runDelivery(delivery(receipt ? { status: "checking_receipt", ticket_id: "expo-ticket" } : {}), Response.json({ data: receipt ? { "expo-ticket": failure } : failure }));
    equal(result.finished.p_status, "failed"); equal(result.finished.p_error, "DeviceNotRegistered");
    assert(!JSON.stringify(result.finished).includes(TOKEN));
  }
});

Deno.test("transient errors back off with a bounded send retry budget", async () => {
  const transient = await runDelivery(delivery(), new Error(`Network error ${TOKEN}`));
  equal(transient.finished.p_status, "pending"); equal(transient.finished.p_retry_seconds, 120);
  const exhausted = await runDelivery(delivery({ attempts: 8 }), new Response(null, { status: 503 }));
  equal(exhausted.finished.p_status, "failed");
});

Deno.test("missing receipts are polled without resending, and stop after the receipt budget", async () => {
  const missing = await runDelivery(delivery({ status: "checking_receipt", ticket_id: "expo-ticket", receipt_attempts: 1 }), Response.json({ data: {} }));
  equal(missing.finished.p_status, "awaiting_receipt"); equal(missing.finished.p_retry_seconds, 3600);
  const exhausted = await runDelivery(delivery({ status: "checking_receipt", ticket_id: "expo-ticket", receipt_attempts: 24 }), Response.json({ data: {} }));
  equal(exhausted.finished.p_status, "failed");
});

Deno.test("a confirmed rate-limited receipt retries sending within the send budget", async () => {
  const failure = { "expo-ticket": { status: "error", details: { error: "MessageRateExceeded" } } };
  const result = await runDelivery(delivery({ status: "checking_receipt", ticket_id: "expo-ticket", receipt_attempts: 1 }), Response.json({ data: failure }));
  equal(result.finished.p_status, "pending"); equal(result.finished.p_retry_seconds, 120);
  const exhausted = await runDelivery(delivery({ status: "checking_receipt", ticket_id: "expo-ticket", receipt_attempts: 1, attempts: 8 }), Response.json({ data: failure }));
  equal(exhausted.finished.p_status, "failed");
});

Deno.test("storage failures reveal neither tokens nor diagnostics", async () => {
  const response = await handleIssueActivityPushRequest(request(), {
    env: env(), fetch: (() => Promise.resolve(Response.json({ error: `private ${TOKEN}` }, { status: 500 }))) as typeof fetch,
  });
  equal(response.status, 503); equal(await response.json(), { error: "Personal notifications are temporarily unavailable." });
});
