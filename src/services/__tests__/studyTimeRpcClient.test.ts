import * as SecureStore from "expo-secure-store";
import fetchMock from "jest-fetch-mock";
import {
  getStudyTimeHistoryRpc,
  getStudyTimeSessionStorageKey,
  postStudyTimeRpc,
  resetStudyTimeRpcClientForTests,
  syncStudyTimeDaysRpc,
} from "../studyTimeRpcClient";

const USER_ID = "verified-user-a";
const DEVICE_ID = "current-device-a";
const WANI_KANI_TOKEN = "secret-wanikani-token";
const SESSION_A = `st1_${"a".repeat(64)}`;
const SESSION_B = `st1_${"b".repeat(64)}`;
const SESSION_C = `st1_${"c".repeat(64)}`;
const SESSION_D = `st1_${"d".repeat(64)}`;
const SESSION_E = `st1_${"e".repeat(64)}`;

function futureExpiry(minutes = 5): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function createdSession(
  sessionToken = SESSION_A,
  userId = USER_ID,
) {
  return {
    ok: true,
    sessionToken,
    expiresAt: futureExpiry(),
    user: { id: userId, name: "Tester", level: 20 },
  };
}

function storedSession(
  sessionToken = SESSION_B,
  receivedAtMs = Date.now(),
) {
  return JSON.stringify({
    version: 2,
    userId: USER_ID,
    deviceId: DEVICE_ID,
    sessionToken,
    expiresAt: futureExpiry(),
    receivedAtMs,
  });
}

function rpcName(input: RequestInfo | URL | undefined): string {
  if (!input) return "";
  return new URL(String(input)).pathname.split("/").at(-1) ?? "";
}

describe("study time PostgREST RPC client", () => {
  const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  let secureEntries: Map<string, string>;

  beforeEach(() => {
    fetchMock.resetMocks();
    jest.clearAllMocks();
    resetStudyTimeRpcClientForTests();
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://project.supabase.co/";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "publishable-anon-key";
    secureEntries = new Map();
    jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key) =>
      secureEntries.get(key) ?? null
    );
    jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => {
      secureEntries.set(key, value);
    });
    jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (key) => {
      secureEntries.delete(key);
    });
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
  });

  it("creates a scoped capability and reads history only through PostgREST RPC", async () => {
    const expiresAt = futureExpiry();
    fetchMock.mockResponses(
      [
        JSON.stringify({
          ...createdSession(),
          expiresAt,
        }),
        { status: 200 },
      ],
      [JSON.stringify({ ok: true, days: [], expiresAt }), { status: 200 }],
    );

    await expect(
      getStudyTimeHistoryRpc(WANI_KANI_TOKEN, USER_ID, DEVICE_ID),
    ).resolves.toMatchObject({ ok: true, days: [] });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "https://project.supabase.co/rest/v1/rpc/create_study_time_session",
      "https://project.supabase.co/rest/v1/rpc/get_study_time_history",
    ]);
    expect(fetchMock.mock.calls.every(([url]) =>
      !String(url).includes("/functions/v1/"),
    )).toBe(true);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      wani_kani_token: WANI_KANI_TOKEN,
      device_id: DEVICE_ID,
    });
    const historyBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(historyBody).toEqual({ session_token: SESSION_A });
    expect(String(fetchMock.mock.calls[1][1]?.body)).not.toContain(
      WANI_KANI_TOKEN,
    );
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      apikey: "publishable-anon-key",
      "Content-Type": "application/json",
    });
    expect(fetchMock.mock.calls[0][1]?.headers).not.toHaveProperty(
      "Authorization",
    );

    const storageKey = getStudyTimeSessionStorageKey(USER_ID, DEVICE_ID);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      storageKey,
      expect.any(String),
    );
    expect(secureEntries.get(storageKey)).not.toContain(WANI_KANI_TOKEN);
  });

  it("accepts a newly issued capability when the device clock is ahead of the server", async () => {
    const serverExpiresAt = new Date(Date.now() - 10 * 60_000).toISOString();
    fetchMock.mockResponses(
      [
        JSON.stringify({
          ...createdSession(),
          expiresAt: serverExpiresAt,
        }),
        { status: 200 },
      ],
      [
        JSON.stringify({
          ok: true,
          days: [],
          expiresAt: serverExpiresAt,
        }),
        { status: 200 },
      ],
    );

    await expect(
      getStudyTimeHistoryRpc(WANI_KANI_TOKEN, USER_ID, DEVICE_ID),
    ).resolves.toMatchObject({ ok: true, days: [] });

    const stored = JSON.parse(
      secureEntries.get(getStudyTimeSessionStorageKey(USER_ID, DEVICE_ID)) ??
        "null",
    );
    expect(stored).toMatchObject({
      version: 2,
      sessionToken: SESSION_A,
      expiresAt: serverExpiresAt,
      receivedAtMs: expect.any(Number),
    });
  });

  it("reuses a fresh capability persisted for the exact user and device", async () => {
    const storageKey = getStudyTimeSessionStorageKey(USER_ID, DEVICE_ID);
    secureEntries.set(storageKey, storedSession());
    const expiresAt = futureExpiry();
    fetchMock.mockResponseOnce(
      JSON.stringify({
        ok: true,
        synced: true,
        acceptedDays: 1,
        expiresAt,
      }),
      { status: 200 },
    );

    await syncStudyTimeDaysRpc(WANI_KANI_TOKEN, USER_ID, DEVICE_ID, [
      { day: "2026-09-08" },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(rpcName(fetchMock.mock.calls[0][0])).toBe("sync_study_time_days");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      session_token: SESSION_B,
      days: [{ day: "2026-09-08" }],
    });
  });

  it("rejects a newly issued capability for a different WaniKani user", async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify(createdSession(SESSION_C, "verified-user-b")),
      { status: 200 },
    );

    await expect(
      getStudyTimeHistoryRpc(WANI_KANI_TOKEN, USER_ID, DEVICE_ID),
    ).rejects.toThrow("session response was invalid");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it("rejects a newly issued capability outside the exact server token format", async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify(createdSession("st1_not-a-server-capability")),
      { status: 200 },
    );

    await expect(
      getStudyTimeHistoryRpc(WANI_KANI_TOKEN, USER_ID, DEVICE_ID),
    ).rejects.toThrow("session response was invalid");
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it("discards a stored capability outside the exact server token format", async () => {
    const storageKey = getStudyTimeSessionStorageKey(USER_ID, DEVICE_ID);
    secureEntries.set(storageKey, storedSession("legacy-session-token"));
    const expiresAt = futureExpiry();
    fetchMock.mockResponses(
      [
        JSON.stringify({ ...createdSession(SESSION_C), expiresAt }),
        { status: 200 },
      ],
      [JSON.stringify({ ok: true, days: [], expiresAt }), { status: 200 }],
    );

    await expect(
      getStudyTimeHistoryRpc(WANI_KANI_TOKEN, USER_ID, DEVICE_ID),
    ).resolves.toMatchObject({ ok: true, days: [] });

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(storageKey);
    expect(fetchMock.mock.calls.map(([url]) => rpcName(url))).toEqual([
      "create_study_time_session",
      "get_study_time_history",
    ]);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      session_token: SESSION_C,
    });
  });

  it("self-invalidates the prior wall-clock expiry storage schema", async () => {
    const storageKey = getStudyTimeSessionStorageKey(USER_ID, DEVICE_ID);
    secureEntries.set(
      storageKey,
      JSON.stringify({
        version: 1,
        userId: USER_ID,
        deviceId: DEVICE_ID,
        sessionToken: SESSION_B,
        expiresAt: futureExpiry(),
      }),
    );
    const expiresAt = futureExpiry();
    fetchMock.mockResponses(
      [
        JSON.stringify({ ...createdSession(SESSION_C), expiresAt }),
        { status: 200 },
      ],
      [JSON.stringify({ ok: true, days: [], expiresAt }), { status: 200 }],
    );

    await getStudyTimeHistoryRpc(WANI_KANI_TOKEN, USER_ID, DEVICE_ID);

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(storageKey);
    expect(fetchMock.mock.calls.map(([url]) => rpcName(url))).toEqual([
      "create_study_time_session",
      "get_study_time_history",
    ]);
  });

  it("reissues a locally aged capability before the five-minute server TTL", async () => {
    const storageKey = getStudyTimeSessionStorageKey(USER_ID, DEVICE_ID);
    secureEntries.set(
      storageKey,
      storedSession(SESSION_B, Date.now() - 4 * 60_000),
    );
    const expiresAt = futureExpiry();
    fetchMock.mockResponses(
      [
        JSON.stringify({ ...createdSession(SESSION_C), expiresAt }),
        { status: 200 },
      ],
      [JSON.stringify({ ok: true, days: [], expiresAt }), { status: 200 }],
    );

    await getStudyTimeHistoryRpc(WANI_KANI_TOKEN, USER_ID, DEVICE_ID);

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(storageKey);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      session_token: SESSION_C,
    });
  });

  it("single-flights capability creation across sync and history", async () => {
    let resolveCreation!: (response: Response) => void;
    const creationResponse = new Promise<Response>((resolve) => {
      resolveCreation = resolve;
    });
    const expiresAt = futureExpiry();
    fetchMock.mockImplementation(async (input) => {
      switch (rpcName(input)) {
        case "create_study_time_session":
          return creationResponse;
        case "sync_study_time_days":
          return new Response(
            JSON.stringify({
              ok: true,
              synced: true,
              acceptedDays: 1,
              expiresAt,
            }),
            { status: 200 },
          );
        case "get_study_time_history":
          return new Response(
            JSON.stringify({ ok: true, days: [], expiresAt }),
            { status: 200 },
          );
        default:
          throw new Error("Unexpected RPC");
      }
    });

    const sync = syncStudyTimeDaysRpc(
      WANI_KANI_TOKEN,
      USER_ID,
      DEVICE_ID,
      [{ day: "2026-09-08" }],
    );
    const history = getStudyTimeHistoryRpc(
      WANI_KANI_TOKEN,
      USER_ID,
      DEVICE_ID,
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        rpcName(url) === "create_study_time_session"
      ),
    ).toHaveLength(1);

    resolveCreation(
      new Response(JSON.stringify({ ...createdSession(), expiresAt }), {
        status: 200,
      }),
    );
    await expect(Promise.all([sync, history])).resolves.toHaveLength(2);
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        rpcName(url) === "create_study_time_session"
      ),
    ).toHaveLength(1);
  });

  it("recreates and retries exactly once when the capability has expired", async () => {
    secureEntries.set(
      getStudyTimeSessionStorageKey(USER_ID, DEVICE_ID),
      storedSession(SESSION_D),
    );
    const expiresAt = futureExpiry();
    fetchMock.mockResponses(
      [JSON.stringify({ ok: false, error: "session_expired" }), { status: 200 }],
      [
        JSON.stringify({
          ...createdSession(SESSION_E),
          expiresAt,
        }),
        { status: 200 },
      ],
      [JSON.stringify({ ok: true, days: [], expiresAt }), { status: 200 }],
    );

    await expect(
      getStudyTimeHistoryRpc(WANI_KANI_TOKEN, USER_ID, DEVICE_ID),
    ).resolves.toMatchObject({ ok: true, days: [] });

    expect(fetchMock.mock.calls.map(([url]) => rpcName(url))).toEqual([
      "get_study_time_history",
      "create_study_time_session",
      "get_study_time_history",
    ]);
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toEqual({
      session_token: SESSION_E,
    });
  });

  it("clears and retries once when PostgREST rejects a capability with 401", async () => {
    secureEntries.set(
      getStudyTimeSessionStorageKey(USER_ID, DEVICE_ID),
      storedSession(SESSION_D),
    );
    const expiresAt = futureExpiry();
    fetchMock.mockResponses(
      ["unauthorized", { status: 401 }],
      [
        JSON.stringify({
          ...createdSession(SESSION_E),
          expiresAt,
        }),
        { status: 200 },
      ],
      [JSON.stringify({ ok: true, days: [], expiresAt }), { status: 200 }],
    );

    await expect(
      getStudyTimeHistoryRpc(WANI_KANI_TOKEN, USER_ID, DEVICE_ID),
    ).resolves.toMatchObject({ ok: true, days: [] });

    expect(fetchMock.mock.calls.map(([url]) => rpcName(url))).toEqual([
      "get_study_time_history",
      "create_study_time_session",
      "get_study_time_history",
    ]);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(1);
  });

  it("shares one refresh when concurrent requests receive staggered expiry results", async () => {
    secureEntries.set(
      getStudyTimeSessionStorageKey(USER_ID, DEVICE_ID),
      storedSession(SESSION_D),
    );
    const expiresAt = futureExpiry();
    let resolveFirstExpired!: (response: Response) => void;
    let resolveSecondExpired!: (response: Response) => void;
    const expiredResponses = [
      new Promise<Response>((resolve) => {
        resolveFirstExpired = resolve;
      }),
      new Promise<Response>((resolve) => {
        resolveSecondExpired = resolve;
      }),
    ];
    let expiredRequestCount = 0;
    let signalReplacementRequest!: () => void;
    const replacementRequested = new Promise<void>((resolve) => {
      signalReplacementRequest = resolve;
    });

    fetchMock.mockImplementation(async (input, init) => {
      const operation = rpcName(input);
      const body = JSON.parse(String(init?.body));
      if (
        operation === "get_study_time_history" &&
        body.session_token === SESSION_D
      ) {
        const response = expiredResponses[expiredRequestCount];
        expiredRequestCount += 1;
        if (!response) {
          throw new Error("Unexpected stale capability request");
        }
        return response;
      }
      if (operation === "create_study_time_session") {
        return new Response(
          JSON.stringify({ ...createdSession(SESSION_E), expiresAt }),
          { status: 200 },
        );
      }
      if (
        operation === "get_study_time_history" &&
        body.session_token === SESSION_E
      ) {
        signalReplacementRequest();
        return new Response(
          JSON.stringify({ ok: true, days: [], expiresAt }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected RPC: ${operation}`);
    });

    const first = getStudyTimeHistoryRpc(
      WANI_KANI_TOKEN,
      USER_ID,
      DEVICE_ID,
    );
    const second = getStudyTimeHistoryRpc(
      WANI_KANI_TOKEN,
      USER_ID,
      DEVICE_ID,
    );
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(expiredRequestCount).toBe(2);

    resolveFirstExpired(
      new Response(
        JSON.stringify({ ok: false, error: "session_expired" }),
        { status: 200 },
      ),
    );
    await replacementRequested;
    resolveSecondExpired(
      new Response(
        JSON.stringify({ ok: false, error: "session_expired" }),
        { status: 200 },
      ),
    );

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        rpcName(url) === "create_study_time_session"
      ),
    ).toHaveLength(1);
    const historyTokens = fetchMock.mock.calls
      .filter(([url]) => rpcName(url) === "get_study_time_history")
      .map(([, init]) => JSON.parse(String(init?.body)).session_token);
    expect(historyTokens).toEqual([
      SESSION_D,
      SESSION_D,
      SESSION_E,
      SESSION_E,
    ]);
  });

  it("does not let a late old-session success replace a refreshed capability", async () => {
    const storageKey = getStudyTimeSessionStorageKey(USER_ID, DEVICE_ID);
    secureEntries.set(storageKey, storedSession(SESSION_D));
    const expiresAt = futureExpiry();
    let resolveOldSuccess!: (response: Response) => void;
    const oldSuccess = new Promise<Response>((resolve) => {
      resolveOldSuccess = resolve;
    });
    let oldRequestCount = 0;

    fetchMock.mockImplementation(async (input, init) => {
      const operation = rpcName(input);
      const body = JSON.parse(String(init?.body));
      if (
        operation === "get_study_time_history" &&
        body.session_token === SESSION_D
      ) {
        oldRequestCount += 1;
        if (oldRequestCount === 1) {
          return oldSuccess;
        }
        return new Response(
          JSON.stringify({ ok: false, error: "session_expired" }),
          { status: 200 },
        );
      }
      if (operation === "create_study_time_session") {
        return new Response(
          JSON.stringify({ ...createdSession(SESSION_E), expiresAt }),
          { status: 200 },
        );
      }
      if (
        operation === "get_study_time_history" &&
        body.session_token === SESSION_E
      ) {
        return new Response(
          JSON.stringify({ ok: true, days: [], expiresAt }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected RPC: ${operation}`);
    });

    const lateSuccess = getStudyTimeHistoryRpc(
      WANI_KANI_TOKEN,
      USER_ID,
      DEVICE_ID,
    );
    await Promise.resolve();
    await Promise.resolve();
    const refreshed = getStudyTimeHistoryRpc(
      WANI_KANI_TOKEN,
      USER_ID,
      DEVICE_ID,
    );
    await expect(refreshed).resolves.toMatchObject({ ok: true, days: [] });

    resolveOldSuccess(
      new Response(JSON.stringify({ ok: true, days: [], expiresAt }), {
        status: 200,
      }),
    );
    await expect(lateSuccess).resolves.toMatchObject({ ok: true, days: [] });

    expect(JSON.parse(secureEntries.get(storageKey) ?? "null")).toMatchObject({
      sessionToken: SESSION_E,
    });
  });

  it("does not recreate a session for non-expiry result failures", async () => {
    secureEntries.set(
      getStudyTimeSessionStorageKey(USER_ID, DEVICE_ID),
      storedSession(),
    );
    fetchMock.mockResponseOnce(
      JSON.stringify({ ok: false, error: "rate_limited" }),
      { status: 200 },
    );

    await expect(
      syncStudyTimeDaysRpc(WANI_KANI_TOKEN, USER_ID, DEVICE_ID, [
        { day: "2026-09-08" },
      ]),
    ).rejects.toThrow("rate limited");
    expect(fetchMock.mock.calls.map(([url]) => rpcName(url))).toEqual([
      "sync_study_time_days",
    ]);
  });

  it("requires a complete sync acknowledgement before reporting success", async () => {
    secureEntries.set(
      getStudyTimeSessionStorageKey(USER_ID, DEVICE_ID),
      storedSession(),
    );
    fetchMock.mockResponseOnce(
      JSON.stringify({
        ok: true,
        synced: true,
        acceptedDays: 0,
        expiresAt: futureExpiry(),
      }),
      { status: 200 },
    );

    await expect(
      syncStudyTimeDaysRpc(WANI_KANI_TOKEN, USER_ID, DEVICE_ID, [
        { day: "2026-09-08" },
      ]),
    ).rejects.toThrow("acknowledgement was invalid");
  });

  it("accepts a complete sync acknowledgement when server expiry appears past locally", async () => {
    secureEntries.set(
      getStudyTimeSessionStorageKey(USER_ID, DEVICE_ID),
      storedSession(),
    );
    fetchMock.mockResponseOnce(
      JSON.stringify({
        ok: true,
        synced: true,
        acceptedDays: 1,
        expiresAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      }),
      { status: 200 },
    );

    await expect(
      syncStudyTimeDaysRpc(WANI_KANI_TOKEN, USER_ID, DEVICE_ID, [
        { day: "2026-09-08" },
      ]),
    ).resolves.toBeUndefined();
  });

  it("sanitizes timeouts and native errors that contain credentials", async () => {
    fetchMock.mockImplementationOnce((_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new Error(`request exposed ${WANI_KANI_TOKEN}`));
        });
      }),
    );

    await expect(
      postStudyTimeRpc(
        "create_study_time_session",
        { wani_kani_token: WANI_KANI_TOKEN, device_id: DEVICE_ID },
        5,
      ),
    ).rejects.toThrow("timed out");

    fetchMock.mockRejectOnce(new Error(`network exposed ${WANI_KANI_TOKEN}`));
    await expect(
      postStudyTimeRpc("create_study_time_session", {
        wani_kani_token: WANI_KANI_TOKEN,
        device_id: DEVICE_ID,
      }),
    ).rejects.toThrow("could not be reached");
  });
});
