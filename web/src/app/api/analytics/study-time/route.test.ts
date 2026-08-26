import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { clearRateLimitsForTests } from "@/lib/server/rate-limit";

const mocks = vi.hoisted(() => ({
  analyticsPrivateBackendConfigured: vi.fn(() => true),
  analyticsIdentityFromSealedSession: vi.fn(),
  readVerifiedStudyTimeDays: vi.fn(),
  syncWebStudyTime: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/analytics-server", () => mocks);

import { GET, POST } from "./route";

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/analytics/study-time", {
    method: "POST",
    headers: {
      host: "localhost",
      origin: "http://localhost",
      cookie: "kakehashi_wk_session=sealed-session",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function getRequest(deviceId = "browser-device-123", cookie = "sealed-session") {
  return new NextRequest(`http://localhost/api/analytics/study-time?deviceId=${encodeURIComponent(deviceId)}`, {
    headers: cookie ? { cookie: `kakehashi_wk_session=${cookie}` } : undefined,
  });
}

describe("study-time analytics route", () => {
  beforeEach(() => {
    clearRateLimitsForTests();
    mocks.analyticsPrivateBackendConfigured.mockReturnValue(true);
    mocks.analyticsIdentityFromSealedSession.mockReset().mockResolvedValue({ id: "123", username: "Tester", level: 21 });
    mocks.readVerifiedStudyTimeDays.mockReset().mockResolvedValue([]);
    mocks.syncWebStudyTime.mockReset().mockResolvedValue(true);
  });

  it("validates and uploads absolute browser totals", async () => {
    const days = [{ day: "2026-08-25", appTotalSeconds: 600, byCategory: { reviews: 120, "extra-study": 90 } }];
    const response = await POST(postRequest({ deviceId: "browser-device-123", days }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ synced: true });
    expect(mocks.syncWebStudyTime).toHaveBeenCalledWith(
      { id: "123", username: "Tester", level: 21 },
      "browser-device-123",
      days,
    );
  });

  it("rejects malformed or inflated totals before writing", async () => {
    const response = await POST(postRequest({
      deviceId: "browser-device-123",
      days: [{ day: "2026-08-25", appTotalSeconds: 90_000, byCategory: {} }],
    }));
    expect(response.status).toBe(400);
    expect(mocks.syncWebStudyTime).not.toHaveBeenCalled();
  });

  it("rejects study categories that exceed the total foreground app time", async () => {
    const response = await POST(postRequest({
      deviceId: "browser-device-123",
      days: [{ day: "2026-08-25", appTotalSeconds: 60, byCategory: { reviews: 61 } }],
    }));

    expect(response.status).toBe(400);
    expect(mocks.syncWebStudyTime).not.toHaveBeenCalled();
  });

  it("returns verified totals from other devices for the authenticated user", async () => {
    mocks.readVerifiedStudyTimeDays.mockResolvedValueOnce([{
      day: "2026-08-25",
      appTotalSeconds: 240,
      byCategory: { reviews: 120, lessons: 60 },
    }]);

    const response = await GET(getRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      available: true,
      days: [{ day: "2026-08-25", appTotalSeconds: 240, byCategory: { reviews: 120, lessons: 60 } }],
    });
    expect(mocks.analyticsIdentityFromSealedSession).toHaveBeenCalledWith("sealed-session");
    expect(mocks.readVerifiedStudyTimeDays).toHaveBeenCalledWith("123", "browser-device-123");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("Vary")).toBe("Cookie");
  });

  it("requires a session and a valid browser device identifier for reads", async () => {
    expect((await GET(getRequest("browser-device-123", ""))).status).toBe(401);
    expect((await GET(getRequest("bad"))).status).toBe(400);
    expect(mocks.readVerifiedStudyTimeDays).not.toHaveBeenCalled();
  });

  it("degrades to cached local data when a private analytics backend is unavailable", async () => {
    mocks.analyticsPrivateBackendConfigured.mockReturnValueOnce(false);

    const response = await GET(getRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ available: false, days: [] });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("Vary")).toBe("Cookie");
    expect(mocks.analyticsIdentityFromSealedSession).not.toHaveBeenCalled();
  });
});
