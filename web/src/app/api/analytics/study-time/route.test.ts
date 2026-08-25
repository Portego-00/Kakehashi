import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { clearRateLimitsForTests } from "@/lib/server/rate-limit";

const mocks = vi.hoisted(() => ({
  analyticsBackendConfigured: vi.fn(() => true),
  analyticsIdentityFromSealedSession: vi.fn(),
  syncWebStudyTime: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/analytics-server", () => mocks);

import { POST } from "./route";

function request(body: unknown) {
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

describe("study-time analytics route", () => {
  beforeEach(() => {
    clearRateLimitsForTests();
    mocks.analyticsBackendConfigured.mockReturnValue(true);
    mocks.analyticsIdentityFromSealedSession.mockReset().mockResolvedValue({ id: "123", username: "Tester", level: 21 });
    mocks.syncWebStudyTime.mockReset().mockResolvedValue(true);
  });

  it("validates and uploads absolute browser totals", async () => {
    const days = [{ day: "2026-08-25", appTotalSeconds: 600, byCategory: { reviews: 120, "extra-study": 90 } }];
    const response = await POST(request({ deviceId: "browser-device-123", days }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ synced: true });
    expect(mocks.syncWebStudyTime).toHaveBeenCalledWith(
      { id: "123", username: "Tester", level: 21 },
      "browser-device-123",
      days,
    );
  });

  it("rejects malformed or inflated totals before writing", async () => {
    const response = await POST(request({
      deviceId: "browser-device-123",
      days: [{ day: "2026-08-25", appTotalSeconds: 90_000, byCategory: {} }],
    }));
    expect(response.status).toBe(400);
    expect(mocks.syncWebStudyTime).not.toHaveBeenCalled();
  });
});
