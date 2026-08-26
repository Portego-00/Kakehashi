import {
  aggregateStudyTimeRows,
  clearStudyTimeHistoryIdentityCacheForTests,
  handleStudyTimeHistoryRequest,
  studyTimeHistoryAuthStateForTests,
  waniKaniUserId,
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

const environment = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "project-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test_service_role",
};

function env(overrides: Partial<typeof environment> = {}) {
  const values: Record<string, string | undefined> = {
    ...environment,
    ...overrides,
  };
  return (name: string) => values[name];
}

function historyRequest(
  body: unknown = { deviceId: "current-device-123" },
  headers: Record<string, string> = {},
): Request {
  return new Request(
    "https://project.supabase.co/functions/v1/study-time-history",
    {
      method: "POST",
      headers: {
        apikey: environment.SUPABASE_ANON_KEY,
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

Deno.test("history endpoint supports CORS preflight with no-store responses", async () => {
  const response = await handleStudyTimeHistoryRequest(
    new Request("https://example.test/history", { method: "OPTIONS" }),
  );

  assertEquals(response.status, 204);
  assertEquals(response.headers.get("access-control-allow-origin"), "*");
  assert(
    response.headers.get("access-control-allow-headers")?.includes(
      "x-wanikani-token",
    ),
  );
  assertEquals(response.headers.get("cache-control"), "no-store");
});

Deno.test("history endpoint rejects wrong project keys before WaniKani or storage", async () => {
  clearStudyTimeHistoryIdentityCacheForTests();
  let calls = 0;
  const response = await handleStudyTimeHistoryRequest(
    historyRequest(undefined, { apikey: "wrong-project-key" }),
    {
      env: env(),
      fetch: (() => {
        calls += 1;
        return Promise.resolve(json({}));
      }) as typeof fetch,
    },
  );

  assertEquals(response.status, 401);
  assertEquals(calls, 0);
});

Deno.test("history endpoint requires WaniKani auth and validates the exact body before upstream calls", async () => {
  clearStudyTimeHistoryIdentityCacheForTests();
  let calls = 0;
  const fakeFetch = (() => {
    calls += 1;
    return Promise.resolve(json({}));
  }) as typeof fetch;

  const missingToken = await handleStudyTimeHistoryRequest(
    historyRequest(undefined, { "x-wanikani-token": "" }),
    { env: env(), fetch: fakeFetch },
  );
  assertEquals(missingToken.status, 401);

  for (
    const payload of [
      null,
      {},
      { deviceId: "short" },
      { deviceId: "invalid device id" },
      { deviceId: "current-device-123", userId: "attacker" },
    ]
  ) {
    const response = await handleStudyTimeHistoryRequest(
      historyRequest(payload),
      {
        env: env(),
        fetch: fakeFetch,
      },
    );
    assertEquals(response.status, 400);
  }

  assertEquals(calls, 0);
});

Deno.test("WaniKani user ids support both response shapes", () => {
  assertEquals(waniKaniUserId({ id: "top-level-id" }), "top-level-id");
  assertEquals(waniKaniUserId({ data: { id: 12345 } }), "12345");
  assertEquals(
    waniKaniUserId({ id: "fallback-id", data: { id: "canonical-id" } }),
    "canonical-id",
  );
  assertEquals(waniKaniUserId({ data: { id: "" } }), "");
});

Deno.test("history endpoint distinguishes invalid WaniKani tokens from upstream failures", async () => {
  clearStudyTimeHistoryIdentityCacheForTests();
  let storageCalls = 0;
  const invalid = await handleStudyTimeHistoryRequest(historyRequest(), {
    env: env(),
    fetch: ((input) => {
      const url = String(input);
      if (url.includes("/rest/v1/")) storageCalls += 1;
      return Promise.resolve(new Response(null, { status: 401 }));
    }) as typeof fetch,
  });
  assertEquals(invalid.status, 401);
  assertEquals(await invalid.json(), {
    error: "WaniKani authorization is invalid",
  });

  clearStudyTimeHistoryIdentityCacheForTests();
  const upstream = await handleStudyTimeHistoryRequest(historyRequest(), {
    env: env(),
    fetch: (() =>
      Promise.resolve(new Response(null, { status: 503 }))) as typeof fetch,
  });
  assertEquals(upstream.status, 502);
  assertEquals(storageCalls, 0);
});

Deno.test("history aggregates every mobile activity and web category alias without leaking identity", async () => {
  clearStudyTimeHistoryIdentityCacheForTests();
  const captured: { storageUrl?: URL; storageHeaders?: Headers } = {};
  const fakeFetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "https://api.wanikani.com/v2/user") {
      return Promise.resolve(json({ data: { id: "private-user-id" } }));
    }
    captured.storageUrl = new URL(url);
    captured.storageHeaders = new Headers(init?.headers);
    return Promise.resolve(json([
      {
        day: "2026-08-25",
        app_total_ms: 1_000,
        activity_ms: {
          reviews: 100,
          bunpro_reviews: 200,
          lessons: 300,
          bunpro_lessons: 400,
          recent_lessons_review: 10,
          custom_review: 10,
          custom_lesson: 10,
          test_session: 10,
          meaning_reading: 10,
          similar_kanji: 10,
          kana_kanji: 10,
          writing_practice: 10,
          writing_freehand: 10,
          context_sentence: 10,
          listening_practice: 10,
          crossword: 10,
          wordle: 10,
        },
      },
      {
        day: "2026-08-25",
        app_total_ms: "2000",
        activity_ms: {
          reviews: 5,
          lessons: 6,
          extra_study: 7,
          "extra-study": 8,
          news: 9,
          songs: 10,
          epub: 11,
          reading: 12,
          video: 13,
          unknown: 999,
        },
      },
      {
        day: "2026-08-26",
        app_total_ms: 50,
        activity_ms: { news: 20, reviews: -5, video: "not-a-number" },
      },
    ]));
  }) as typeof fetch;

  const response = await handleStudyTimeHistoryRequest(historyRequest(), {
    env: env(),
    fetch: fakeFetch,
    now: () => new Date("2026-08-26T12:00:00.000Z"),
  });

  assertEquals(response.status, 200);
  const payload = await response.json();
  assertEquals(payload, {
    days: [
      {
        day: "2026-08-25",
        appTotalMs: 3_000,
        byCategoryMs: {
          reviews: 305,
          lessons: 706,
          extra_study: 145,
          news: 9,
          songs: 10,
          epub: 23,
          video: 13,
        },
      },
      {
        day: "2026-08-26",
        appTotalMs: 50,
        byCategoryMs: {
          reviews: 0,
          lessons: 0,
          extra_study: 0,
          news: 20,
          songs: 0,
          epub: 0,
          video: 0,
        },
      },
    ],
  });

  assert(captured.storageUrl);
  assertEquals(
    captured.storageUrl.searchParams.get("user_id"),
    "eq.private-user-id",
  );
  assertEquals(
    captured.storageUrl.searchParams.get("device_id"),
    "neq.current-device-123",
  );
  assertEquals(captured.storageUrl.searchParams.get("verified"), "eq.true");
  assertEquals(
    captured.storageUrl.searchParams.get("verified_at"),
    "not.is.null",
  );
  assertEquals(captured.storageUrl.searchParams.getAll("day"), [
    "gte.2025-06-24",
    "lte.2026-08-27",
  ]);
  assertEquals(
    captured.storageHeaders?.get("apikey"),
    environment.SUPABASE_SERVICE_ROLE_KEY,
  );
  assertEquals(
    captured.storageHeaders?.get("authorization"),
    null,
  );
  const serialized = JSON.stringify(payload);
  assert(!serialized.includes("private-user-id"));
  assert(!serialized.includes("valid-wanikani-token"));
  assert(!serialized.includes("current-device-123"));
});

Deno.test("history sends bearer authorization only for JWT-shaped service keys", async () => {
  clearStudyTimeHistoryIdentityCacheForTests();
  const jwtServiceKey = "header.payload.signature";
  let storageHeaders: Headers | undefined;
  const response = await handleStudyTimeHistoryRequest(
    historyRequest(undefined, {
      "x-wanikani-token": "jwt-storage-token",
    }),
    {
      env: env({ SUPABASE_SERVICE_ROLE_KEY: jwtServiceKey }),
      fetch: ((input, init) => {
        if (String(input) === "https://api.wanikani.com/v2/user") {
          return Promise.resolve(json({ id: "jwt-storage-user" }));
        }
        storageHeaders = new Headers(init?.headers);
        return Promise.resolve(json([]));
      }) as typeof fetch,
    },
  );

  assertEquals(response.status, 200);
  assertEquals(storageHeaders?.get("apikey"), jwtServiceKey);
  assertEquals(
    storageHeaders?.get("authorization"),
    `Bearer ${jwtServiceKey}`,
  );
});

Deno.test("history negatively caches invalid and failed WaniKani verification", async () => {
  clearStudyTimeHistoryIdentityCacheForTests();
  let invalidCalls = 0;
  const invalidFetch = (() => {
    invalidCalls += 1;
    return Promise.resolve(new Response(null, { status: 401 }));
  }) as typeof fetch;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await handleStudyTimeHistoryRequest(
      historyRequest(undefined, { "x-wanikani-token": "cached-invalid-token" }),
      { env: env(), fetch: invalidFetch },
    );
    assertEquals(response.status, 401);
  }
  assertEquals(invalidCalls, 1);
  assertEquals(studyTimeHistoryAuthStateForTests().negativeCacheSize, 1);

  clearStudyTimeHistoryIdentityCacheForTests();
  let upstreamCalls = 0;
  const upstreamFetch = (() => {
    upstreamCalls += 1;
    return Promise.resolve(new Response(null, { status: 503 }));
  }) as typeof fetch;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await handleStudyTimeHistoryRequest(
      historyRequest(undefined, {
        "x-wanikani-token": "cached-upstream-token",
      }),
      { env: env(), fetch: upstreamFetch },
    );
    assertEquals(response.status, 502);
    assertEquals(await response.json(), {
      error: "WaniKani could not be reached",
    });
  }
  assertEquals(upstreamCalls, 1);
});

Deno.test("history retries WaniKani after a negative-auth cache entry expires", async () => {
  clearStudyTimeHistoryIdentityCacheForTests();
  let nowMs = 1_000_000;
  let waniKaniCalls = 0;
  const fakeFetch = ((input) => {
    if (String(input) === "https://api.wanikani.com/v2/user") {
      waniKaniCalls += 1;
      return waniKaniCalls === 1
        ? Promise.resolve(new Response(null, { status: 401 }))
        : Promise.resolve(json({ id: "revalidated-user" }));
    }
    return Promise.resolve(json([]));
  }) as typeof fetch;
  const options = {
    env: env(),
    fetch: fakeFetch,
    now: () => new Date(nowMs),
  };
  const headers = { "x-wanikani-token": "temporarily-invalid-token" };

  const first = await handleStudyTimeHistoryRequest(
    historyRequest(undefined, headers),
    options,
  );
  const cached = await handleStudyTimeHistoryRequest(
    historyRequest(undefined, headers),
    options,
  );
  assertEquals(first.status, 401);
  assertEquals(cached.status, 401);
  assertEquals(waniKaniCalls, 1);

  nowMs += 60_001;
  const retried = await handleStudyTimeHistoryRequest(
    historyRequest(undefined, headers),
    options,
  );
  assertEquals(retried.status, 200);
  assertEquals(waniKaniCalls, 2);
});

Deno.test("history bounds negative auth and rate-limit state", async () => {
  clearStudyTimeHistoryIdentityCacheForTests();
  const fakeFetch =
    (() =>
      Promise.resolve(new Response(null, { status: 401 }))) as typeof fetch;

  for (let index = 0; index < 510; index += 1) {
    const response = await handleStudyTimeHistoryRequest(
      historyRequest(undefined, {
        "x-wanikani-token": `invalid-token-${index}`,
      }),
      { env: env(), fetch: fakeFetch },
    );
    assertEquals(response.status, 401);
  }

  const state = studyTimeHistoryAuthStateForTests();
  assertEquals(state.negativeCacheSize, 500);
  assertEquals(state.rateLimitSize, 500);
});

Deno.test("history rate-limits repeated valid-token storage reads", async () => {
  clearStudyTimeHistoryIdentityCacheForTests();
  let waniKaniCalls = 0;
  let storageCalls = 0;
  const fakeFetch = ((input) => {
    if (String(input) === "https://api.wanikani.com/v2/user") {
      waniKaniCalls += 1;
      return Promise.resolve(json({ id: "rate-limited-user" }));
    }
    storageCalls += 1;
    return Promise.resolve(json([]));
  }) as typeof fetch;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await handleStudyTimeHistoryRequest(
      historyRequest(undefined, { "x-wanikani-token": "valid-rate-token" }),
      { env: env(), fetch: fakeFetch, now: () => new Date(1_000_000) },
    );
    assertEquals(response.status, 200);
  }
  const limited = await handleStudyTimeHistoryRequest(
    historyRequest(undefined, { "x-wanikani-token": "valid-rate-token" }),
    { env: env(), fetch: fakeFetch, now: () => new Date(1_000_000) },
  );

  assertEquals(limited.status, 429);
  assertEquals(await limited.json(), { error: "Too many requests" });
  assertEquals(waniKaniCalls, 1);
  assertEquals(storageCalls, 30);
});

Deno.test("history limits concurrent storage reads for one valid token", async () => {
  clearStudyTimeHistoryIdentityCacheForTests();
  let gateStorage = false;
  let gatedStorageCalls = 0;
  let releaseStorage: (() => void) | undefined;
  const storageGate = new Promise<void>((resolve) => {
    releaseStorage = resolve;
  });
  const fakeFetch = ((input) => {
    if (String(input) === "https://api.wanikani.com/v2/user") {
      return Promise.resolve(json({ id: "concurrent-storage-user" }));
    }
    if (!gateStorage) return Promise.resolve(json([]));
    gatedStorageCalls += 1;
    return storageGate.then(() => json([]));
  }) as typeof fetch;
  const options = { env: env(), fetch: fakeFetch };
  const requestHeaders = { "x-wanikani-token": "concurrent-storage-token" };

  const warm = await handleStudyTimeHistoryRequest(
    historyRequest(undefined, requestHeaders),
    options,
  );
  assertEquals(warm.status, 200);
  gateStorage = true;

  const responses = Array.from(
    { length: 3 },
    () =>
      handleStudyTimeHistoryRequest(
        historyRequest(undefined, requestHeaders),
        options,
      ),
  );
  for (let attempt = 0; attempt < 50 && gatedStorageCalls < 2; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  releaseStorage?.();
  const statuses = (await Promise.all(responses)).map((response) =>
    response.status
  );

  assertEquals(gatedStorageCalls, 2);
  assertEquals(statuses.filter((status) => status === 200).length, 2);
  assertEquals(statuses.filter((status) => status === 429).length, 1);
  assertEquals(studyTimeHistoryAuthStateForTests().activeTokenRequests, 0);
});

Deno.test("history caps concurrent WaniKani verification across distinct tokens", async () => {
  clearStudyTimeHistoryIdentityCacheForTests();
  let releaseVerification: (() => void) | undefined;
  const verificationGate = new Promise<void>((resolve) => {
    releaseVerification = resolve;
  });
  let waniKaniCalls = 0;
  let activeWaniKaniCalls = 0;
  let maximumActiveWaniKaniCalls = 0;
  const fakeFetch = ((input) => {
    if (String(input) === "https://api.wanikani.com/v2/user") {
      waniKaniCalls += 1;
      activeWaniKaniCalls += 1;
      maximumActiveWaniKaniCalls = Math.max(
        maximumActiveWaniKaniCalls,
        activeWaniKaniCalls,
      );
      return verificationGate.then(() => {
        activeWaniKaniCalls -= 1;
        return json({ id: "concurrent-user" });
      });
    }
    return Promise.resolve(json([]));
  }) as typeof fetch;

  const responses = Array.from(
    { length: 9 },
    (_, index) =>
      handleStudyTimeHistoryRequest(
        historyRequest(undefined, {
          "x-wanikani-token": `concurrent-valid-token-${index}`,
        }),
        { env: env(), fetch: fakeFetch },
      ),
  );

  for (let attempt = 0; attempt < 50 && waniKaniCalls < 8; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  releaseVerification?.();
  const statuses = (await Promise.all(responses)).map((response) =>
    response.status
  );

  assertEquals(waniKaniCalls, 8);
  assertEquals(maximumActiveWaniKaniCalls, 8);
  assertEquals(statuses.filter((status) => status === 200).length, 8);
  assertEquals(statuses.filter((status) => status === 429).length, 1);
  assertEquals(studyTimeHistoryAuthStateForTests().activeRequests, 0);
});

Deno.test("history paginates until a short page and caches verified identity", async () => {
  clearStudyTimeHistoryIdentityCacheForTests();
  let waniKaniCalls = 0;
  const offsets: number[] = [];
  const fakeFetch = ((input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "https://api.wanikani.com/v2/user") {
      waniKaniCalls += 1;
      return Promise.resolve(json({ id: "cached-user" }));
    }
    const parsed = new URL(url);
    const offset = Number(parsed.searchParams.get("offset"));
    offsets.push(offset);
    const pages: Record<number, unknown[]> = {
      0: [
        { day: "2026-08-25", app_total_ms: 1, activity_ms: {} },
        { day: "2026-08-25", app_total_ms: 2, activity_ms: {} },
      ],
      2: [
        { day: "2026-08-25", app_total_ms: 3, activity_ms: {} },
        { day: "2026-08-25", app_total_ms: 4, activity_ms: {} },
      ],
      4: [{ day: "2026-08-25", app_total_ms: 5, activity_ms: {} }],
    };
    return Promise.resolve(json(pages[offset]));
  }) as typeof fetch;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await handleStudyTimeHistoryRequest(historyRequest(), {
      env: env(),
      fetch: fakeFetch,
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      pageSize: 2,
    });
    assertEquals(response.status, 200);
    assertEquals((await response.json()).days[0].appTotalMs, 15);
  }

  assertEquals(waniKaniCalls, 1);
  assertEquals(offsets, [0, 2, 4, 0, 2, 4]);
});

Deno.test("history returns generic unavailable responses for configuration and storage errors", async () => {
  clearStudyTimeHistoryIdentityCacheForTests();
  const identityFetch =
    (() => Promise.resolve(json({ id: "user-id" }))) as typeof fetch;
  const missingConfig = await handleStudyTimeHistoryRequest(historyRequest(), {
    env: env({ SUPABASE_SERVICE_ROLE_KEY: undefined as unknown as string }),
    fetch: identityFetch,
  });
  assertEquals(missingConfig.status, 503);

  clearStudyTimeHistoryIdentityCacheForTests();
  const storageError = await handleStudyTimeHistoryRequest(historyRequest(), {
    env: env(),
    fetch: ((input) =>
      String(input) === "https://api.wanikani.com/v2/user"
        ? Promise.resolve(json({ id: "user-id" }))
        : Promise.resolve(
          json({ message: "secret database detail" }, 500),
        )) as typeof fetch,
  });
  assertEquals(storageError.status, 503);
  assertEquals(await storageError.json(), {
    error: "Study time history is unavailable",
  });
});

Deno.test("history fails closed instead of returning partial totals above the row bound", async () => {
  clearStudyTimeHistoryIdentityCacheForTests();
  let storagePages = 0;
  const response = await handleStudyTimeHistoryRequest(historyRequest(), {
    env: env(),
    fetch: ((input) => {
      if (String(input) === "https://api.wanikani.com/v2/user") {
        return Promise.resolve(json({ id: "large-account" }));
      }
      storagePages += 1;
      return Promise.resolve(
        json(
          Array.from({ length: 1_000 }, () => ({
            day: "2026-08-25",
            app_total_ms: 1,
            activity_ms: {},
          })),
        ),
      );
    }) as typeof fetch,
    now: () => new Date("2026-08-26T12:00:00.000Z"),
  });

  assertEquals(response.status, 503);
  assertEquals(storagePages, 31);
  assertEquals(await response.json(), {
    error: "Study time history is unavailable",
  });
});

Deno.test("aggregation ignores malformed rows and always returns sorted complete categories", () => {
  assertEquals(
    aggregateStudyTimeRows([
      { day: "bad-date", app_total_ms: 999, activity_ms: { reviews: 999 } },
      { day: "2026-01-02", app_total_ms: 2, activity_ms: null },
      { day: "2026-01-01", app_total_ms: 1, activity_ms: { reading: 3 } },
    ]),
    [
      {
        day: "2026-01-01",
        appTotalMs: 1,
        byCategoryMs: {
          reviews: 0,
          lessons: 0,
          extra_study: 0,
          news: 0,
          songs: 0,
          epub: 3,
          video: 0,
        },
      },
      {
        day: "2026-01-02",
        appTotalMs: 2,
        byCategoryMs: {
          reviews: 0,
          lessons: 0,
          extra_study: 0,
          news: 0,
          songs: 0,
          epub: 0,
          video: 0,
        },
      },
    ],
  );
});
