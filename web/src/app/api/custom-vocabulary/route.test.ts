import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { clearRateLimitsForTests } from "@/lib/server/rate-limit";
const mocks = vi.hoisted(() => ({ identity: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/analytics-server", () => ({ analyticsIdentityFromSealedSession: mocks.identity }));
vi.mock("@/lib/server/custom-srs-server", () => ({ personalVocabularyRpc: mocks.rpc }));
import { GET, POST } from "./route";
const deck = "personal:11111111-1111-4111-8111-111111111111";
function request(method: "GET" | "POST", accountId = "one", body?: unknown, origin = "http://localhost", cookie = true) {
  return new NextRequest(`http://localhost/api/custom-vocabulary?accountId=${accountId}`, { method, headers: { host: "localhost", origin, ...(cookie ? { cookie: "kakehashi_wk_session=sealed" } : {}), "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
beforeEach(() => { clearRateLimitsForTests(); mocks.identity.mockReset().mockResolvedValue({ id: "one", username: "Portego" }); mocks.rpc.mockReset().mockResolvedValue({ revision: 1, entries: [], cursor: null }); });
describe("private vocabulary API", () => {
  it("authorizes every read and mutation against the sealed account", async () => {
    expect((await GET(request("GET"))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("read_custom_vocabulary", { p_user_id: "one", p_after_revision: 0, p_after_id: "", p_until_revision: null });
    mocks.rpc.mockClear();
    expect((await GET(request("GET", "other"))).status).toBe(403);
    expect((await GET(request("GET", "one", undefined, undefined, false))).status).toBe(401);
    mocks.identity.mockResolvedValue({ id: "one", username: "not-allowed" });
    expect((await GET(request("GET"))).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("validates content and origin, and never trusts client ownership or progress", async () => {
    const body = { accountId: "one", eventId: crypto.randomUUID(), expectedRevision: 0, operations: [{ action: "create_deck", id: deck, title: "Reading" }] };
    expect((await POST(request("POST", "one", body, "https://evil.test"))).status).toBe(403);
    expect((await POST(request("POST", "one", { ...body, accountId: "other" }))).status).toBe(403);
    expect((await POST(request("POST", "one", { ...body, assignments: {} }))).status).toBe(400);
    expect((await POST(request("POST", "one", body))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({ p_user_id: "one", p_expected_revision: 0, p_initial_metadata: { enrolledPackIds: [] } });
    mocks.rpc.mockRejectedValue(new Error("Your library changed on another device. Refresh it before saving"));
    expect((await POST(request("POST", "one", body))).status).toBe(409);
  });
});
