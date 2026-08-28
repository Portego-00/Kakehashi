import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { clearRateLimitsForTests } from "@/lib/server/rate-limit";

const mocks = vi.hoisted(() => ({
  analyticsBackendConfigured: vi.fn(() => true),
  analyticsIdentityFromSealedSession: vi.fn(),
  recordWebAppSession: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/analytics-server", () => mocks);

import { POST } from "./route";

function request(cookie = "sealed-session", origin = "http://localhost") {
  return new NextRequest("http://localhost/api/analytics/session", {
    method: "POST",
    headers: { host: "localhost", origin, cookie: `kakehashi_wk_session=${cookie}` },
  });
}

describe("app-session analytics route", () => {
  beforeEach(() => {
    clearRateLimitsForTests();
    mocks.analyticsBackendConfigured.mockReturnValue(true);
    mocks.analyticsIdentityFromSealedSession.mockReset().mockResolvedValue({ id: "123", username: "Tester", level: 21 });
    mocks.recordWebAppSession.mockReset().mockResolvedValue(true);
  });

  it("authenticates the session and records it", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ recorded: true });
    expect(mocks.analyticsIdentityFromSealedSession).toHaveBeenCalledWith("sealed-session");
    expect(mocks.recordWebAppSession).toHaveBeenCalledWith({ id: "123", username: "Tester", level: 21 });
  });

  it("rejects missing sessions and cross-origin writes", async () => {
    const missing = new NextRequest("http://localhost/api/analytics/session", { method: "POST", headers: { host: "localhost", origin: "http://localhost" } });
    expect((await POST(missing)).status).toBe(401);
    expect((await POST(request("sealed-session", "https://evil.example"))).status).toBe(403);
  });
});
