/* eslint-disable import/first -- Jest boundary mocks must load before services. */
import fetchMock from "jest-fetch-mock";

const mockMmkvData = new Map<string, string>();
const mockAuthState = {
  apiToken: "secret-wanikani-token",
  userData: { id: "verified-user-a" },
};

jest.mock("react-native-mmkv", () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    getString: (key: string) => mockMmkvData.get(key),
    set: (key: string, value: string) => {
      mockMmkvData.set(key, value);
    },
    delete: (key: string) => {
      mockMmkvData.delete(key);
    },
    getAllKeys: () => [...mockMmkvData.keys()],
  })),
}));

jest.mock("../../utils/store", () => ({
  useAuthStore: {
    getState: () => mockAuthState,
  },
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "1.0.0-test" } },
}));

import {
  getUserDeviceDayKeyPrefix,
  getUserPushedSumsKey,
} from "../studyTimeStorageScope";
import {
  timeTrackingService,
  timeTrackingStorage,
} from "../timeTrackingService";
import {
  getDeviceId,
  maybeSyncStudyTime,
} from "../timeTrackingSyncService";

describe("study time dirty-ledger upload", () => {
  const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const userId = "verified-user-a";
  const deviceId = "current-device-a";

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 7, 31, 12, 0, 0));
  });

  beforeEach(() => {
    mockMmkvData.clear();
    fetchMock.resetMocks();
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "publishable-anon-key";
    timeTrackingService.setUserDeviceScope(null, null);
    timeTrackingStorage.set("ttv1.device_id", deviceId);
    expect(getDeviceId()).toBe(deviceId);
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
    jest.useRealTimers();
  });

  it("uploads every retained dirty day in sequential batches of at most 14", async () => {
    const dayKeyPrefix = getUserDeviceDayKeyPrefix(userId, deviceId);
    for (let day = 1; day <= 31; day += 1) {
      const dateKey = `2026-08-${String(day).padStart(2, "0")}`;
      timeTrackingStorage.set(
        `${dayKeyPrefix}${dateKey}`,
        JSON.stringify({ reviews: day * 1_000, app_total: day * 2_000 }),
      );
    }
    timeTrackingService.setUserDeviceScope(userId, deviceId);
    fetchMock.mockResponses(
      [JSON.stringify({ ok: true }), { status: 200 }],
      [JSON.stringify({ ok: true }), { status: 200 }],
      [JSON.stringify({ ok: true }), { status: 200 }],
    );

    await maybeSyncStudyTime({ force: true });

    const payloads = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse(String(init?.body)),
    );
    expect(payloads.map((payload) => payload.days.length)).toEqual([14, 14, 3]);
    expect(payloads.flatMap((payload) => payload.days.map((day: any) => day.day)))
      .toEqual(
        Array.from({ length: 31 }, (_, index) =>
          `2026-08-${String(31 - index).padStart(2, "0")}`,
        ),
      );

    const pushedSums = JSON.parse(
      timeTrackingStorage.getString(
        getUserPushedSumsKey(userId, deviceId),
      ) ?? "{}",
    );
    expect(Object.keys(pushedSums)).toHaveLength(31);
  });

  it("persists each acknowledged batch and resumes after a later batch fails", async () => {
    const dayKeyPrefix = getUserDeviceDayKeyPrefix(userId, deviceId);
    for (let day = 1; day <= 31; day += 1) {
      const dateKey = `2026-08-${String(day).padStart(2, "0")}`;
      timeTrackingStorage.set(
        `${dayKeyPrefix}${dateKey}`,
        JSON.stringify({ reviews: day * 1_000, app_total: day * 2_000 }),
      );
    }
    timeTrackingService.setUserDeviceScope(userId, deviceId);
    fetchMock.mockResponses(
      [JSON.stringify({ ok: true }), { status: 200 }],
      ["temporary failure", { status: 503 }],
    );

    await maybeSyncStudyTime({ force: true });

    const markerKey = getUserPushedSumsKey(userId, deviceId);
    expect(
      Object.keys(
        JSON.parse(timeTrackingStorage.getString(markerKey) ?? "{}"),
      ),
    ).toHaveLength(14);

    fetchMock.resetMocks();
    fetchMock.mockResponses(
      [JSON.stringify({ ok: true }), { status: 200 }],
      [JSON.stringify({ ok: true }), { status: 200 }],
    );
    await maybeSyncStudyTime({ force: true });

    const retryPayloads = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse(String(init?.body)),
    );
    expect(retryPayloads.map((payload) => payload.days.length)).toEqual([14, 3]);
    expect(retryPayloads[0].days[0].day).toBe("2026-08-17");
    expect(
      Object.keys(
        JSON.parse(timeTrackingStorage.getString(markerKey) ?? "{}"),
      ),
    ).toHaveLength(31);
  });

  it("keeps every supported activity in the upload payload", async () => {
    const dateKey = "2026-08-31";
    timeTrackingStorage.set(
      `${getUserDeviceDayKeyPrefix(userId, deviceId)}${dateKey}`,
      JSON.stringify({
        word_search: 12_000,
        jlpt: 8_000,
        app_total: 25_000,
      }),
    );
    timeTrackingService.setUserDeviceScope(userId, deviceId);
    fetchMock.mockResponseOnce(JSON.stringify({ ok: true }), { status: 200 });

    await maybeSyncStudyTime({ force: true });

    const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(payload.days[0]).toMatchObject({
      day: dateKey,
      activityMs: { word_search: 12_000, jlpt: 8_000 },
      studyTotalMs: 20_000,
      appTotalMs: 25_000,
    });
  });

  it("keeps acknowledgement markers bounded to the retained local ledger", async () => {
    const dateKey = "2026-08-31";
    timeTrackingStorage.set(
      `${getUserDeviceDayKeyPrefix(userId, deviceId)}${dateKey}`,
      JSON.stringify({ reviews: 1_000, app_total: 2_000 }),
    );
    timeTrackingStorage.set(
      getUserPushedSumsKey(userId, deviceId),
      JSON.stringify({ [dateKey]: 3_000, "2020-01-01": 9_000 }),
    );
    timeTrackingService.setUserDeviceScope(userId, deviceId);

    await maybeSyncStudyTime({ force: true });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      JSON.parse(
        timeTrackingStorage.getString(
          getUserPushedSumsKey(userId, deviceId),
        ) ?? "{}",
      ),
    ).toEqual({ [dateKey]: 3_000 });
  });

  it("uploads claimed legacy plus same-day scoped time exactly once", async () => {
    const dateKey = "2026-08-30";
    const legacyKey = `ttv1.day.${dateKey}`;
    const legacyRaw = JSON.stringify({ reviews: 20_000, app_total: 30_000 });
    timeTrackingStorage.set(legacyKey, legacyRaw);
    timeTrackingStorage.set(
      `${getUserDeviceDayKeyPrefix(userId, deviceId)}${dateKey}`,
      JSON.stringify({ reviews: 5_000, lessons: 3_000, app_total: 12_000 }),
    );
    timeTrackingService.setUserDeviceScope(userId, deviceId);
    expect(
      timeTrackingService.acceptLegacyHistoryForCurrentUser(userId, deviceId),
    ).toBe(true);
    fetchMock.mockResponseOnce(JSON.stringify({ ok: true }), { status: 200 });

    await maybeSyncStudyTime({ force: true });

    const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(payload.days).toEqual([
      expect.objectContaining({
        day: dateKey,
        activityMs: { reviews: 25_000, lessons: 3_000 },
        studyTotalMs: 28_000,
        appTotalMs: 42_000,
      }),
    ]);
    expect(timeTrackingStorage.getString(legacyKey)).toBe(legacyRaw);

    fetchMock.resetMocks();
    await maybeSyncStudyTime({ force: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
