import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearRateLimitsForTests } from "@/lib/server/rate-limit";
import { DEMO_SESSION_COOKIE } from "@/features/demo/constants";
import { DEMO_USER } from "@/features/demo/runtime";
vi.mock("server-only", () => ({}));
const upstream = vi.hoisted(() => ({ user: vi.fn(), seal: vi.fn(), unseal: vi.fn() }));
vi.mock("@/lib/server/wanikani-session", () => ({
  WANIKANI_SESSION_COOKIE: "kakehashi_wk_session",
  getWaniKaniSessionUser: upstream.user,
  SessionUpstreamError: class extends Error {},
}));
vi.mock("@/lib/server/session-crypto", () => ({ sealToken: upstream.seal, unsealToken: upstream.unseal }));
import { POST } from "./route";
import { GET, POST as signIn, DELETE } from "../wanikani/route";

function request(path: string, method = "GET", cookie = "", origin = "http://localhost", body?: unknown) {
  return new NextRequest(`http://localhost/api/session/${path}`, {
    method, headers: { host: "localhost", origin, cookie, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe("demo session boundary", () => {
  beforeEach(() => { clearRateLimitsForTests(); vi.clearAllMocks(); });
  it("starts without an API token and removes an existing real credential", async () => {
    const response = await POST(request("demo", "POST", "kakehashi_wk_session=old"));
    expect(await response.json()).toEqual({ user: DEMO_USER, demo: true });
    expect(response.cookies.get(DEMO_SESSION_COOKIE)).toMatchObject({ value: "1", httpOnly: true, sameSite: "lax" });
    expect(response.cookies.get("kakehashi_wk_session")?.value).toBe("");
    expect(upstream.user).not.toHaveBeenCalled();
    expect(upstream.seal).not.toHaveBeenCalled();
  });
  it("resumes the demo without reading a real account or exposing credentials", async () => {
    const response = await GET(request("wanikani", "GET", `${DEMO_SESSION_COOKIE}=1`));
    expect(await response.json()).toEqual({ user: DEMO_USER, demo: true });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(upstream.user).not.toHaveBeenCalled();
    expect(upstream.unseal).not.toHaveBeenCalled();
  });
  it("rejects cross-origin demo starts", async () => {
    const response = await POST(request("demo", "POST", "", "https://other.example"));
    expect(response.status).toBe(403);
    expect(response.cookies.get(DEMO_SESSION_COOKIE)).toBeUndefined();
  });
  it("requires Secure on a deployed production host but supports plain HTTP loopback previews", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const local = await POST(request("demo", "POST"));
      expect(local.cookies.get(DEMO_SESSION_COOKIE)?.secure).toBe(false);
      const deployed = await POST(new NextRequest("https://kakehashi.example/api/session/demo", { method: "POST", headers: { host: "kakehashi.example", origin: "https://kakehashi.example" } }));
      expect(deployed.cookies.get(DEMO_SESSION_COOKIE)?.secure).toBe(true);
    } finally { vi.unstubAllEnvs(); }
  });
  it("exits demo only after successful token verification and clears both sessions on sign-out", async () => {
    upstream.user.mockResolvedValue(DEMO_USER);
    upstream.seal.mockReturnValue("sealed-account-token");
    const connected = await signIn(request("wanikani", "POST", `${DEMO_SESSION_COOKIE}=1`, undefined, { token: "x".repeat(32) }));
    expect(connected.status).toBe(200);
    expect(connected.cookies.get(DEMO_SESSION_COOKIE)?.value).toBe("");
    expect(connected.cookies.get("kakehashi_wk_session")?.value).toBe("sealed-account-token");
    const disconnected = await DELETE(request("wanikani", "DELETE", `${DEMO_SESSION_COOKIE}=1`));
    expect(disconnected.cookies.get(DEMO_SESSION_COOKIE)?.value).toBe("");
    expect(disconnected.cookies.get("kakehashi_wk_session")?.value).toBe("");
  });
});
