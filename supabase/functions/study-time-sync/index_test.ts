import {
  clearStudyTimeSyncIdentityCacheForTests,
  handleStudyTimeSyncRequest,
  studyTimeSyncAuthStateForTests,
  validateStudyTimeSyncPayload,
  waniKaniIdentity,
} from "./index.ts";

function assert(
  condition: unknown,
  message = "Assertion failed",
): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Assertion failed\nActual: ${JSON.stringify(actual)}\nExpected: ${
        JSON.stringify(expected)
      }`,
    );
  }
}

const NOW = new Date("2026-08-26T12:00:00.000Z");
const environment: Record<string, string | undefined> = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "project-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test_service_role",
};

function env(overrides: Record<string, string | undefined> = {}) {
  const values = { ...environment, ...overrides };
  return (name: string) => values[name];
}

function validBody() {
  return {
    deviceId: "current-device-123",
    days: [{
      day: "2026-08-25",
      activityMs: {
        reviews: 120_000,
        bunpro_reviews: 30_000,
        custom_review: 50_000,
      },
      studyTotalMs: 200_000,
      appTotalMs: 300_000,
      appVersion: "1.2.3",
      platform: "ios",
    }],
  };
}

function syncRequest(
  body: unknown = validBody(),
  headers: Record<string, string> = {},
): Request {
  return new Request(
    "https://project.supabase.co/functions/v1/study-time-sync",
    {
      method: "POST",
      headers: {
        apikey: String(environment.SUPABASE_ANON_KEY),
        "Content-Type": "application/json",
        "x-wanikani-token": "valid-wanikani-token",
        ...headers,
      },
      body: JSON.stringify(body),
    },
  );
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status });
}

Deno.test("sync endpoint supports credential headers in CORS preflight", async () => {
  const response = await handleStudyTimeSyncRequest(
    new Request("https://example.test/sync", { method: "OPTIONS" }),
  );
  assertEquals(response.status, 204);
  assertEquals(response.headers.get("access-control-allow-origin"), "*");
  assert(
    response.headers.get("access-control-allow-headers")?.includes("apikey"),
  );
  assert(
    response.headers.get("access-control-allow-headers")?.includes(
      "x-wanikani-token",
    ),
  );
  assertEquals(response.headers.get("cache-control"), "no-store");
});

Deno.test("sync validation accepts the exact mobile contract and recomputes totals", () => {
  const validated = validateStudyTimeSyncPayload(validBody(), NOW);
  assert(validated);
  assertEquals(validated, validBody());
  assert(validated.days[0].activityMs.bunpro_reviews === 30_000);
});

Deno.test("sync validation rejects untrusted identity fields, bad dates, duplicates, and excess rows", () => {
  const identityInjection = { ...validBody(), userId: "attacker" };
  assertEquals(validateStudyTimeSyncPayload(identityInjection, NOW), null);

  const badDate = validBody();
  badDate.days[0].day = "2026-02-30";
  assertEquals(validateStudyTimeSyncPayload(badDate, NOW), null);

  const oldDate = validBody();
  oldDate.days[0].day = "2024-01-01";
  assertEquals(validateStudyTimeSyncPayload(oldDate, NOW), null);

  const earliestDate = validBody();
  earliestDate.days[0].day = "2025-06-24";
  assert(validateStudyTimeSyncPayload(earliestDate, NOW));

  const justBeforeWindow = validBody();
  justBeforeWindow.days[0].day = "2025-06-23";
  assertEquals(validateStudyTimeSyncPayload(justBeforeWindow, NOW), null);

  const latestDate = validBody();
  latestDate.days[0].day = "2026-08-27";
  assert(validateStudyTimeSyncPayload(latestDate, NOW));

  const futureDate = validBody();
  futureDate.days[0].day = "2026-08-28";
  assertEquals(validateStudyTimeSyncPayload(futureDate, NOW), null);

  const duplicate = validBody();
  duplicate.days.push({ ...duplicate.days[0] });
  assertEquals(validateStudyTimeSyncPayload(duplicate, NOW), null);

  const tooMany = validBody();
  tooMany.days = Array.from({ length: 15 }, (_, index) => ({
    ...tooMany.days[0],
    day: `2026-08-${String(index + 1).padStart(2, "0")}`,
  }));
  assertEquals(validateStudyTimeSyncPayload(tooMany, NOW), null);
});

Deno.test("sync validation rejects unknown activities and inconsistent or inflated totals", () => {
  const unknown = validBody();
  (unknown.days[0].activityMs as Record<string, number>).unrecognized = 1;
  unknown.days[0].studyTotalMs += 1;
  assertEquals(validateStudyTimeSyncPayload(unknown, NOW), null);

  const fractional = validBody();
  fractional.days[0].activityMs.reviews = 1.5;
  fractional.days[0].studyTotalMs = 80_001.5;
  assertEquals(validateStudyTimeSyncPayload(fractional, NOW), null);

  const mismatched = validBody();
  mismatched.days[0].studyTotalMs = 199_999;
  assertEquals(validateStudyTimeSyncPayload(mismatched, NOW), null);

  const studyExceedsApp = validBody();
  studyExceedsApp.days[0].appTotalMs = 199_999;
  assertEquals(validateStudyTimeSyncPayload(studyExceedsApp, NOW), null);

  const exceedsOneDay = validBody();
  exceedsOneDay.days[0].appTotalMs = 86_400_001;
  assertEquals(validateStudyTimeSyncPayload(exceedsOneDay, NOW), null);

  const invalidPlatform = validBody();
  invalidPlatform.days[0].platform = "attacker-platform";
  assertEquals(validateStudyTimeSyncPayload(invalidPlatform, NOW), null);

  const extraDayField = validBody() as ReturnType<typeof validBody> & {
    days: Array<
      ReturnType<typeof validBody>["days"][number] & { user_name?: string }
    >;
  };
  extraDayField.days[0].user_name = "attacker";
  assertEquals(validateStudyTimeSyncPayload(extraDayField, NOW), null);
});

Deno.test("sync endpoint rejects invalid project and WaniKani credentials before storage", async () => {
  clearStudyTimeSyncIdentityCacheForTests();
  let waniKaniCalls = 0;
  let storageCalls = 0;
  const fakeFetch = ((input: RequestInfo | URL) => {
    if (String(input) === "https://api.wanikani.com/v2/user") {
      waniKaniCalls += 1;
      return Promise.resolve(new Response(null, { status: 401 }));
    }
    storageCalls += 1;
    return Promise.resolve(json({}));
  }) as typeof fetch;

  const wrongProject = await handleStudyTimeSyncRequest(
    syncRequest(undefined, { apikey: "wrong-key" }),
    { env: env(), fetch: fakeFetch, now: () => NOW },
  );
  assertEquals(wrongProject.status, 401);
  assertEquals(waniKaniCalls, 0);
  assertEquals(storageCalls, 0);

  const wrongWaniKani = await handleStudyTimeSyncRequest(syncRequest(), {
    env: env(),
    fetch: fakeFetch,
    now: () => NOW,
  });
  assertEquals(wrongWaniKani.status, 401);
  assertEquals(waniKaniCalls, 1);
  assertEquals(storageCalls, 0);
});

Deno.test("sync endpoint rejects invalid payloads before WaniKani verification", async () => {
  clearStudyTimeSyncIdentityCacheForTests();
  let calls = 0;
  const invalid = validBody();
  invalid.days[0].studyTotalMs = 1;
  const response = await handleStudyTimeSyncRequest(syncRequest(invalid), {
    env: env(),
    fetch: (() => {
      calls += 1;
      return Promise.resolve(json({}));
    }) as typeof fetch,
    now: () => NOW,
  });
  assertEquals(response.status, 400);
  assertEquals(calls, 0);
});

Deno.test("sync derives every identity field from WaniKani and calls only the verified RPC", async () => {
  clearStudyTimeSyncIdentityCacheForTests();
  const captured: {
    waniKaniHeaders?: Headers;
    rpcUrl?: string;
    rpcHeaders?: Headers;
    rpcBody?: unknown;
  } = {};
  const fakeFetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "https://api.wanikani.com/v2/user") {
      captured.waniKaniHeaders = new Headers(init?.headers);
      return Promise.resolve(json({
        data: { id: "verified-user-id", username: "Verified Name", level: 42 },
      }));
    }
    captured.rpcUrl = url;
    captured.rpcHeaders = new Headers(init?.headers);
    captured.rpcBody = JSON.parse(String(init?.body));
    return Promise.resolve(new Response(null, { status: 204 }));
  }) as typeof fetch;

  const response = await handleStudyTimeSyncRequest(syncRequest(), {
    env: env(),
    fetch: fakeFetch,
    now: () => NOW,
  });

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { synced: true });
  assertEquals(response.headers.get("cache-control"), "no-store");
  assertEquals(
    captured.waniKaniHeaders?.get("authorization"),
    "Bearer valid-wanikani-token",
  );
  assertEquals(
    captured.rpcUrl,
    `${environment.SUPABASE_URL}/rest/v1/rpc/upsert_verified_study_time_days`,
  );
  assertEquals(
    captured.rpcHeaders?.get("apikey"),
    environment.SUPABASE_SERVICE_ROLE_KEY,
  );
  assertEquals(
    captured.rpcHeaders?.get("authorization"),
    null,
  );
  assertEquals(captured.rpcBody, {
    rows: [{
      user_id: "verified-user-id",
      device_id: "current-device-123",
      day: "2026-08-25",
      activity_ms: {
        reviews: 120_000,
        bunpro_reviews: 30_000,
        custom_review: 50_000,
      },
      study_total_ms: 200_000,
      app_total_ms: 300_000,
      user_name: "Verified Name",
      user_level: 42,
      app_version: "1.2.3",
      platform: "ios",
      updated_at: NOW.toISOString(),
    }],
  });
  assert(!JSON.stringify(captured.rpcBody).includes("valid-wanikani-token"));
});

Deno.test("sync sends bearer authorization only for JWT-shaped service keys", async () => {
  clearStudyTimeSyncIdentityCacheForTests();
  const jwtServiceKey = "header.payload.signature";
  let rpcHeaders: Headers | undefined;
  const response = await handleStudyTimeSyncRequest(
    syncRequest(undefined, { "x-wanikani-token": "jwt-sync-token" }),
    {
      env: env({ SUPABASE_SERVICE_ROLE_KEY: jwtServiceKey }),
      fetch: ((input, init) => {
        if (String(input) === "https://api.wanikani.com/v2/user") {
          return Promise.resolve(json({
            data: { id: "jwt-user", username: "JWT User", level: 2 },
          }));
        }
        rpcHeaders = new Headers(init?.headers);
        return Promise.resolve(new Response(null, { status: 204 }));
      }) as typeof fetch,
      now: () => NOW,
    },
  );

  assertEquals(response.status, 200);
  assertEquals(rpcHeaders?.get("apikey"), jwtServiceKey);
  assertEquals(
    rpcHeaders?.get("authorization"),
    `Bearer ${jwtServiceKey}`,
  );
});

Deno.test("sync negatively caches WaniKani authentication and upstream failures", async () => {
  clearStudyTimeSyncIdentityCacheForTests();
  let invalidCalls = 0;
  const invalidFetch = (() => {
    invalidCalls += 1;
    return Promise.resolve(new Response(null, { status: 401 }));
  }) as typeof fetch;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await handleStudyTimeSyncRequest(
      syncRequest(undefined, { "x-wanikani-token": "cached-invalid-sync" }),
      { env: env(), fetch: invalidFetch, now: () => NOW },
    );
    assertEquals(response.status, 401);
  }
  assertEquals(invalidCalls, 1);
  assertEquals(studyTimeSyncAuthStateForTests().negativeCacheSize, 1);

  clearStudyTimeSyncIdentityCacheForTests();
  let upstreamCalls = 0;
  const upstreamFetch = (() => {
    upstreamCalls += 1;
    return Promise.resolve(new Response(null, { status: 500 }));
  }) as typeof fetch;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await handleStudyTimeSyncRequest(
      syncRequest(undefined, { "x-wanikani-token": "cached-upstream-sync" }),
      { env: env(), fetch: upstreamFetch, now: () => NOW },
    );
    assertEquals(response.status, 502);
    assertEquals(await response.json(), {
      error: "WaniKani could not be reached",
    });
  }
  assertEquals(upstreamCalls, 1);
});

Deno.test("sync rate-limits repeated valid-token writes", async () => {
  clearStudyTimeSyncIdentityCacheForTests();
  let waniKaniCalls = 0;
  let rpcCalls = 0;
  const fakeFetch = ((input) => {
    if (String(input) === "https://api.wanikani.com/v2/user") {
      waniKaniCalls += 1;
      return Promise.resolve(json({
        data: { id: "rate-user", username: "Rate User", level: 3 },
      }));
    }
    rpcCalls += 1;
    return Promise.resolve(new Response(null, { status: 204 }));
  }) as typeof fetch;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await handleStudyTimeSyncRequest(
      syncRequest(undefined, { "x-wanikani-token": "valid-sync-rate-token" }),
      { env: env(), fetch: fakeFetch, now: () => NOW },
    );
    assertEquals(response.status, 200);
  }
  const limited = await handleStudyTimeSyncRequest(
    syncRequest(undefined, { "x-wanikani-token": "valid-sync-rate-token" }),
    { env: env(), fetch: fakeFetch, now: () => NOW },
  );

  assertEquals(limited.status, 429);
  assertEquals(await limited.json(), { error: "Too many requests" });
  assertEquals(waniKaniCalls, 1);
  assertEquals(rpcCalls, 30);
});

Deno.test("sync accepts top-level WaniKani identity and caches it by token digest", async () => {
  clearStudyTimeSyncIdentityCacheForTests();
  assertEquals(
    waniKaniIdentity({ id: 123, username: "Top User", level: 7 }),
    { userId: "123", userName: "Top User", userLevel: 7 },
  );
  assertEquals(
    waniKaniIdentity({
      id: "fallback",
      username: "Fallback",
      level: 1,
      data: { id: "canonical", username: "Canonical", level: 7 },
    }),
    { userId: "canonical", userName: "Canonical", userLevel: 7 },
  );

  let waniKaniCalls = 0;
  let rpcCalls = 0;
  const fakeFetch = ((input: RequestInfo | URL) => {
    if (String(input) === "https://api.wanikani.com/v2/user") {
      waniKaniCalls += 1;
      return Promise.resolve(json({ id: 123, username: "Top User", level: 7 }));
    }
    rpcCalls += 1;
    return Promise.resolve(new Response(null, { status: 204 }));
  }) as typeof fetch;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await handleStudyTimeSyncRequest(syncRequest(), {
      env: env(),
      fetch: fakeFetch,
      now: () => NOW,
    });
    assertEquals(response.status, 200);
  }
  assertEquals(waniKaniCalls, 1);
  assertEquals(rpcCalls, 2);
});

Deno.test("sync distinguishes WaniKani outages and hides storage failures", async () => {
  clearStudyTimeSyncIdentityCacheForTests();
  const upstream = await handleStudyTimeSyncRequest(syncRequest(), {
    env: env(),
    fetch: (() =>
      Promise.resolve(new Response(null, { status: 500 }))) as typeof fetch,
    now: () =>
      NOW,
  });
  assertEquals(upstream.status, 502);

  clearStudyTimeSyncIdentityCacheForTests();
  const storage = await handleStudyTimeSyncRequest(syncRequest(), {
    env: env(),
    fetch: ((input) =>
      String(input) === "https://api.wanikani.com/v2/user"
        ? Promise.resolve(json({
          data: { id: "user", username: "Name", level: 1 },
        }))
        : Promise.resolve(
          json({ message: "private database detail" }, 500),
        )) as typeof fetch,
    now: () =>
      NOW,
  });
  assertEquals(storage.status, 503);
  assertEquals(await storage.json(), {
    error: "Study time sync is unavailable",
  });
});

Deno.test("sync fails closed when service-role storage is not configured", async () => {
  clearStudyTimeSyncIdentityCacheForTests();
  let storageCalls = 0;
  const response = await handleStudyTimeSyncRequest(syncRequest(), {
    env: env({ SUPABASE_SERVICE_ROLE_KEY: undefined }),
    fetch: ((input) => {
      if (String(input) === "https://api.wanikani.com/v2/user") {
        return Promise.resolve(json({
          data: { id: "user", username: "Name", level: 1 },
        }));
      }
      storageCalls += 1;
      return Promise.resolve(json({}));
    }) as typeof fetch,
    now: () => NOW,
  });
  assertEquals(response.status, 503);
  assertEquals(storageCalls, 0);
});
