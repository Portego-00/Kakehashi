/* eslint-disable import/first -- Jest boundary mocks must load before services. */
const mockMmkvData = new Map<string, string>();

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

import {
  LEGACY_UNSCOPED_DAY_KEY_PREFIX,
  getUserDeviceDayKeyPrefix,
} from "../studyTimeStorageScope";
import {
  timeTrackingService,
  timeTrackingStorage,
} from "../timeTrackingService";

describe("legacy study time recovery", () => {
  beforeEach(() => {
    mockMmkvData.clear();
    timeTrackingService.setUserDeviceScope(null, null);
  });

  it("combines legacy and scoped totals exactly once only after explicit acceptance", () => {
    const userId = "verified-user-a";
    const deviceId = "current-device-a";
    const dateKey = "2026-08-20";
    const legacyRaw = JSON.stringify({ reviews: 60_000, app_total: 90_000 });

    timeTrackingStorage.set(
      `${LEGACY_UNSCOPED_DAY_KEY_PREFIX}${dateKey}`,
      legacyRaw,
    );
    timeTrackingStorage.set(
      `${getUserDeviceDayKeyPrefix(userId, deviceId)}${dateKey}`,
      JSON.stringify({ reviews: 15_000, lessons: 5_000, app_total: 30_000 }),
    );
    timeTrackingService.setUserDeviceScope(userId, deviceId);

    expect(
      timeTrackingService.getLegacyHistoryRecoveryStatus(userId, deviceId),
    ).toMatchObject({ state: "available", dayCount: 1 });
    expect(
      timeTrackingService.getSummaryBetween(dateKey, dateKey).studyMs,
    ).toBe(20_000);

    expect(
      timeTrackingService.acceptLegacyHistoryForCurrentUser(userId, deviceId),
    ).toBe(true);
    expect(
      timeTrackingService.getSummaryBetween(dateKey, dateKey),
    ).toMatchObject({ studyMs: 80_000, appTotalMs: 120_000 });

    // Re-acceptance is idempotent and the unscoped source remains recoverable.
    expect(
      timeTrackingService.acceptLegacyHistoryForCurrentUser(userId, deviceId),
    ).toBe(true);
    expect(
      timeTrackingService.getSummaryBetween(dateKey, dateKey),
    ).toMatchObject({ studyMs: 80_000, appTotalMs: 120_000 });
    expect(
      timeTrackingStorage.getString(
        `${LEGACY_UNSCOPED_DAY_KEY_PREFIX}${dateKey}`,
      ),
    ).toBe(legacyRaw);
  });

  it("keeps accepted legacy history private to its claimed account and device", () => {
    const dateKey = "2026-08-21";
    timeTrackingStorage.set(
      `${LEGACY_UNSCOPED_DAY_KEY_PREFIX}${dateKey}`,
      JSON.stringify({ reviews: 45_000, app_total: 60_000 }),
    );

    timeTrackingService.setUserDeviceScope(
      "verified-user-a",
      "current-device-a",
    );
    expect(
      timeTrackingService.acceptLegacyHistoryForCurrentUser(
        "verified-user-a",
        "current-device-a",
      ),
    ).toBe(true);

    timeTrackingService.setUserDeviceScope(
      "verified-user-b",
      "current-device-a",
    );
    expect(
      timeTrackingService.getLegacyHistoryRecoveryStatus(
        "verified-user-b",
        "current-device-a",
      ),
    ).toEqual({ state: "none", dayCount: 0 });
    expect(
      timeTrackingService.getSummaryBetween(dateKey, dateKey).studyMs,
    ).toBe(0);

    timeTrackingService.setUserDeviceScope(
      "verified-user-a",
      "current-device-a",
    );
    expect(
      timeTrackingService.getSummaryBetween(dateKey, dateKey).studyMs,
    ).toBe(45_000);
  });

  it("parses the immutable legacy ledger only once per account scope", () => {
    const userId = "verified-user-cache";
    const deviceId = "current-device-cache";
    const dateKey = "2026-08-22";
    const legacyKey = `${LEGACY_UNSCOPED_DAY_KEY_PREFIX}${dateKey}`;
    timeTrackingStorage.set(
      legacyKey,
      JSON.stringify({ reviews: 30_000, app_total: 40_000 }),
    );
    timeTrackingService.setUserDeviceScope(userId, deviceId);
    const getStringSpy = jest.spyOn(timeTrackingStorage, "getString");

    expect(
      timeTrackingService.acceptLegacyHistoryForCurrentUser(userId, deviceId),
    ).toBe(true);
    for (let read = 0; read < 5; read += 1) {
      expect(
        timeTrackingService.getSummaryBetween(dateKey, dateKey).studyMs,
      ).toBe(30_000);
    }

    expect(
      getStringSpy.mock.calls.filter(([key]) => key === legacyKey),
    ).toHaveLength(1);
    getStringSpy.mockRestore();
  });
});
