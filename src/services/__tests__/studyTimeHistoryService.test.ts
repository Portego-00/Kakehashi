/* eslint-disable import/first -- Jest boundary mocks must load before services. */
import * as SecureStore from "expo-secure-store";
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

jest.mock("../timeTrackingSyncService", () => ({
  getDeviceId: () => "current-device-a",
}));

import {
  getStudyTimeHistoryCacheKey,
  maybeRefreshStudyTimeHistory,
} from "../studyTimeHistoryService";
import {
  resetStudyTimeRpcClientForTests,
} from "../studyTimeRpcClient";

describe("study time history transport", () => {
  const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const userId = "verified-user-a";
  const deviceId = "current-device-a";
  const sessionToken = `st1_${"a".repeat(64)}`;
  const sessionExpiry = () => new Date(Date.now() + 4 * 60_000).toISOString();

  beforeEach(() => {
    mockMmkvData.clear();
    fetchMock.resetMocks();
    resetStudyTimeRpcClientForTests();
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "publishable-anon-key";
    jest.mocked(SecureStore.getItemAsync).mockReset().mockResolvedValue(
      JSON.stringify({
        version: 2,
        userId,
        deviceId,
        sessionToken,
        expiresAt: sessionExpiry(),
        receivedAtMs: Date.now(),
      }),
    );
    jest.mocked(SecureStore.setItemAsync).mockReset().mockResolvedValue();
    jest.mocked(SecureStore.deleteItemAsync).mockReset().mockResolvedValue();
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
  });

  it("loads combined history without invoking an Edge Function", async () => {
    const expiresAt = new Date(Date.now() - 10 * 60_000).toISOString();
    fetchMock.mockResponseOnce(
      JSON.stringify({ ok: true, days: [], expiresAt }),
      { status: 200 },
    );

    await maybeRefreshStudyTimeHistory({ force: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://project.supabase.co/rest/v1/rpc/get_study_time_history",
    );
    expect(String(url)).not.toContain("/functions/v1/");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      session_token: sessionToken,
    });
    expect(
      mockMmkvData.has(getStudyTimeHistoryCacheKey(userId, deviceId)),
    ).toBe(true);
  });

  it("retains the existing five-minute persistent history cache guard", async () => {
    const expiresAt = sessionExpiry();
    fetchMock.mockResponseOnce(
      JSON.stringify({
        ok: true,
        days: [{
          day: "2026-09-08",
          appTotalMs: 1_000,
          byCategoryMs: {
            reviews: 1_000,
            lessons: 0,
            extra_study: 0,
            news: 0,
            songs: 0,
            epub: 0,
            video: 0,
          },
        }],
        expiresAt,
      }),
      { status: 200 },
    );

    await expect(
      maybeRefreshStudyTimeHistory({ force: true }),
    ).resolves.toMatchObject({ source: "network" });
    await expect(maybeRefreshStudyTimeHistory()).resolves.toMatchObject({
      source: "cache",
      days: [expect.objectContaining({ day: "2026-09-08" })],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      mockMmkvData.has(getStudyTimeHistoryCacheKey(userId, deviceId)),
    ).toBe(true);
  });
});
