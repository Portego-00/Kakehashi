import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { clearRateLimitsForTests } from "@/lib/server/rate-limit";

const mocks = vi.hoisted(() => ({
  analyticsBackendConfigured: vi.fn(() => true),
  analyticsIdentityFromSealedSession: vi.fn(),
  publicAnalyticsBackend: vi.fn(() => ({ url: "https://supabase.test", anonKey: "public-key" })),
  readAppSessionStartedAt: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/analytics-server", () => mocks);

import { GET } from "./route";

function request(timezone = "Europe/Madrid", cookie = "sealed-session") {
  return new NextRequest(`http://localhost/api/analytics/streak?timezone=${encodeURIComponent(timezone)}`, {
    headers: { cookie: `kakehashi_wk_session=${cookie}` },
  });
}

describe("app-streak analytics route", () => {
  beforeEach(() => {
    clearRateLimitsForTests();
    mocks.analyticsBackendConfigured.mockReturnValue(true);
    mocks.analyticsIdentityFromSealedSession.mockReset().mockResolvedValue({ id: "123", username: "Tester", level: 21 });
    mocks.readAppSessionStartedAt.mockReset().mockResolvedValue([
      "2026-08-24T22:30:00.000Z",
      "2026-08-25T08:00:00.000Z",
    ]);
  });

  it("returns unique app-active days in the browser timezone", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ activeDays: ["2026-08-25"], available: true });
    expect(mocks.readAppSessionStartedAt).toHaveBeenCalledWith("123");
  });

  it("requires an authenticated WaniKani session", async () => {
    const response = await GET(new NextRequest("http://localhost/api/analytics/streak"));
    expect(response.status).toBe(401);
  });

  it("returns the mobile-compatible fallback when the server read fails", async () => {
    mocks.readAppSessionStartedAt.mockRejectedValueOnce(new Error("Read denied"));

    const response = await GET(request());

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      publicBackend: { url: "https://supabase.test", anonKey: "public-key" },
    });
  });
});
