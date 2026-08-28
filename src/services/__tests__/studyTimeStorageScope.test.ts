import {
  LEGACY_UNSCOPED_DAY_KEY_PREFIX,
  getUserDeviceDayKeyPrefix,
  getUserPushedSumsKey,
  isValidStudyTimeDeviceId,
  normalizeStudyTimeUserId,
} from "../studyTimeStorageScope";

describe("study time account storage scope", () => {
  it("normalizes supported WaniKani ids and rejects selector/mock objects", () => {
    expect(normalizeStudyTimeUserId("  verified-user-a  ")).toBe(
      "verified-user-a",
    );
    expect(normalizeStudyTimeUserId(123)).toBe("123");
    expect(normalizeStudyTimeUserId({ id: "not-a-scalar" })).toBeNull();
    expect(normalizeStudyTimeUserId(Number.NaN)).toBeNull();
  });

  it("isolates day records by verified user and never addresses legacy rows", () => {
    const userAPrefix = getUserDeviceDayKeyPrefix(
      "verified-user-a",
      "current-device-a",
    );
    const userBPrefix = getUserDeviceDayKeyPrefix(
      "verified-user-b",
      "current-device-a",
    );

    expect(userAPrefix).not.toBe(userBPrefix);
    expect(userAPrefix).not.toBe(LEGACY_UNSCOPED_DAY_KEY_PREFIX);
    expect(`${userAPrefix}2026-08-26`).not.toBe(
      `${LEGACY_UNSCOPED_DAY_KEY_PREFIX}2026-08-26`,
    );
  });

  it("gives a regenerated device an empty, independent ledger namespace", () => {
    expect(
      getUserDeviceDayKeyPrefix("verified-user-a", "current-device-a"),
    ).not.toBe(
      getUserDeviceDayKeyPrefix("verified-user-a", "regenerated-device-b"),
    );
  });

  it("isolates dirty-upload markers by both user and current device", () => {
    const userADeviceA = getUserPushedSumsKey(
      "verified-user-a",
      "current-device-a",
    );

    expect(
      getUserPushedSumsKey("verified-user-b", "current-device-a"),
    ).not.toBe(userADeviceA);
    expect(
      getUserPushedSumsKey("verified-user-a", "current-device-b"),
    ).not.toBe(userADeviceA);
  });

  it.each([
    "current-device-123",
    "abcdefgh",
    "A_B-C_123456",
  ])("accepts Edge-compatible device id %s", (deviceId) => {
    expect(isValidStudyTimeDeviceId(deviceId)).toBe(true);
  });

  it.each(["short", "invalid device", "dots.are.invalid", "", null])(
    "rejects invalid device id %s",
    (deviceId) => {
      expect(isValidStudyTimeDeviceId(deviceId)).toBe(false);
    },
  );
});
