export const LEGACY_UNSCOPED_DAY_KEY_PREFIX = "ttv1.day.";
const USER_DAY_KEY_PREFIX = "ttv2.user.";
const PUSHED_SUMS_KEY_PREFIX = "ttv3.sync.pushed_sums.";
export const LEGACY_HISTORY_ASSIGNMENT_KEY = "ttv4.legacy_history_assignment";

export type LegacyStudyTimeAssignment = {
  version: 1;
  userId: string;
  deviceId: string;
  acceptedAt: number;
};

/** Normalize the two WaniKani identity shapes without accepting objects. */
export function normalizeStudyTimeUserId(value: unknown): string | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? String(value) : null;
  }
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 256
    ? normalized
    : null;
}

function encodeScopePart(value: string): string {
  return encodeURIComponent(value.trim());
}

export function getUserDeviceDayKeyPrefix(
  userId: string,
  deviceId: string,
): string {
  return (
    `${USER_DAY_KEY_PREFIX}${encodeScopePart(userId)}.device.` +
    `${encodeScopePart(deviceId)}.day.`
  );
}

export function getUserPushedSumsKey(
  userId: string,
  deviceId: string,
): string {
  return (
    `${PUSHED_SUMS_KEY_PREFIX}${encodeScopePart(userId)}.` +
    encodeScopePart(deviceId)
  );
}

export function isValidStudyTimeDeviceId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(value);
}

/** Parse the one owner claim for the otherwise-unscoped v1 ledger. */
export function parseLegacyStudyTimeAssignment(
  value: unknown,
): LegacyStudyTimeAssignment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<LegacyStudyTimeAssignment>;
  const userId = normalizeStudyTimeUserId(candidate.userId);
  if (
    candidate.version !== 1 ||
    !userId ||
    !isValidStudyTimeDeviceId(candidate.deviceId) ||
    !Number.isSafeInteger(candidate.acceptedAt) ||
    (candidate.acceptedAt ?? -1) < 0
  ) {
    return null;
  }

  return {
    version: 1,
    userId,
    deviceId: candidate.deviceId,
    acceptedAt: candidate.acceptedAt as number,
  };
}
