import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createNotebookState, DEFAULT_NOTEBOOK_LIMITS, NotebookError, type NotebookMutation } from "@/features/notebooks/model";
import { clearRateLimitsForTests } from "@/lib/server/rate-limit";

const mocks = vi.hoisted(() => ({ configured: vi.fn(), identity: vi.fn(), read: vi.fn(), mutate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/analytics-server", () => ({ analyticsIdentityFromSealedSession: mocks.identity }));
vi.mock("@/lib/server/notebooks-server", () => ({ notebooksBackendConfigured: mocks.configured, notebookServerLimits: () => DEFAULT_NOTEBOOK_LIMITS, readRemoteNotebookState: mocks.read, mutateRemoteNotebookState: mocks.mutate }));
import { GET, POST } from "./route";
const create: NotebookMutation = { action: "create_page", page: { id: "page", title: "Grammar" } };
function request(method: "GET" | "POST", body?: unknown, options: { cookie?: string | null; origin?: string | null; contentLength?: string; account?: string | null } = {}) {
  return new NextRequest("https://kakehashi.test/api/notebooks", { method, headers: { host: "kakehashi.test", ...(options.account === null ? {} : { "X-Notebook-Account": options.account ?? "123" }), ...(options.origin === null ? {} : { origin: options.origin ?? "https://kakehashi.test" }), ...(options.cookie === null ? {} : { cookie: options.cookie ?? "kakehashi_wk_session=sealed" }), ...(body ? { "Content-Type": "application/json" } : {}), ...(options.contentLength ? { "Content-Length": options.contentLength } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
describe("authenticated notebook route", () => {
  beforeEach(() => {
    clearRateLimitsForTests(); mocks.configured.mockReset().mockReturnValue(true); mocks.identity.mockReset().mockResolvedValue({ id: "123", username: "Portego", level: 5 });
    mocks.read.mockReset().mockResolvedValue({ state: createNotebookState(), revision: -1 }); mocks.mutate.mockReset().mockResolvedValue({ state: createNotebookState(), revision: 0 });
  });
  it("loads only the sealed account with private cache headers", async () => {
    const response = await GET(request("GET")); expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ available: true, revision: -1, state: { version: 1 } });
    expect(mocks.identity).toHaveBeenCalledWith("sealed"); expect(mocks.read).toHaveBeenCalledWith("123"); expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0"); expect(response.headers.get("Vary")).toBe("Cookie");
  });
  it("supports a verified opaque UUID account and matching mutation scope", async () => {
    const account = "1c2f2a60-7be3-4adc-a9ea-0d3b189748d0";
    mocks.identity.mockResolvedValue({ id: account, username: "Portego" });
    expect((await GET(request("GET"))).status).toBe(200);
    expect((await POST(request("POST", create, { account }))).status).toBe(200);
    expect(mocks.mutate).toHaveBeenCalledWith(account, create);
  });
  it.each(["Portego", " PORTEGO "])("allows only the verified username %j", async (username) => {
    mocks.identity.mockResolvedValue({ id: "123", username, level: 5 });
    expect((await GET(request("GET"))).status).toBe(200);
    expect((await POST(request("POST", create))).status).toBe(200);
  });
  it.each(["Learner", "PortegoFan", "", undefined])("rejects username %j before reading request bodies or storage", async (username) => {
    mocks.identity.mockResolvedValue({ id: "123", username, level: 5 });
    const write = request("POST", { ...create, username: "Portego" });
    write.headers.set("X-WaniKani-Username", "Portego");
    const body = vi.spyOn(write, "body", "get");
    for (const response of [await GET(request("GET")), await POST(write)]) {
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "forbidden" });
      expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
      expect(response.headers.get("Vary")).toBe("Cookie");
    }
    expect(body).not.toHaveBeenCalled();
    expect(mocks.configured).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it("requires authenticated same-origin requests and rejects the shared demo", async () => {
    expect((await GET(request("GET", undefined, { cookie: null }))).status).toBe(401);
    expect((await POST(request("POST", create, { cookie: null }))).status).toBe(401);
    for (const origin of [null, "https://evil.test"]) expect((await POST(request("POST", create, { origin }))).status).toBe(403);
    for (const cookie of ["kakehashi_demo_session=1", "kakehashi_demo_session=1; kakehashi_wk_session=sealed"]) { expect((await GET(request("GET", undefined, { cookie }))).status).toBe(403); expect((await POST(request("POST", create, { cookie }))).status).toBe(403); }
    expect(mocks.read).not.toHaveBeenCalled(); expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it("does not accept an account ID or arbitrary state in the request", async () => {
    expect((await POST(request("POST", { ...create, userId: "456" }))).status).toBe(400); expect((await POST(request("POST", { action: "replace_state", state: createNotebookState() }))).status).toBe(400); expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it("rejects missing or switched account scopes before mutation", async () => {
    for (const account of [null, "456"]) {
      const response = await POST(request("POST", create, { account }));
      expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ code: "account_changed" });
    }
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it("rejects oversized bodies after verifying access and before writing", async () => {
    expect((await POST(request("POST", create, { contentLength: "5000000" }))).status).toBe(400); expect(mocks.identity).toHaveBeenCalledWith("sealed"); expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it("authenticates before reporting backend availability", async () => {
    mocks.configured.mockReturnValue(false); mocks.identity.mockRejectedValue(new Error("invalid token")); expect((await GET(request("GET"))).status).toBe(503); expect((await POST(request("POST", create))).status).toBe(503); expect(mocks.configured).not.toHaveBeenCalled();
  });
  it("never persists a demo identity", async () => {
    mocks.identity.mockResolvedValue({ id: "demo-level-21", username: "Demo" }); expect((await GET(request("GET"))).status).toBe(403); expect((await POST(request("POST", create))).status).toBe(403); expect(mocks.read).not.toHaveBeenCalled(); expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it("reports unavailable cloud storage without claiming a successful save", async () => {
    mocks.configured.mockReturnValue(false); const read = await GET(request("GET")); expect(read.status).toBe(200); expect(await read.json()).toMatchObject({ available: false, state: null });
    const write = await POST(request("POST", create)); expect(write.status).toBe(503); expect(await write.json()).toMatchObject({ available: false, state: null }); expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it("sends validated mutations with the server identity and returns canonical capture IDs", async () => {
    mocks.mutate.mockResolvedValue({ state: createNotebookState(), revision: 1, sentenceId: "canonical" });
    const response = await POST(request("POST", create)); expect(response.status).toBe(200); expect(mocks.mutate).toHaveBeenCalledWith("123", create); expect(await response.json()).toMatchObject({ sentenceId: "canonical" });
  });
  it.each([["conflict", 409], ["limit", 413], ["not_found", 404]] as const)("reports %s errors distinctly", async (code, status) => {
    mocks.mutate.mockRejectedValue(new NotebookError("Helpful error", code)); const response = await POST(request("POST", create)); expect(response.status).toBe(status); expect(await response.json()).toEqual({ error: "Helpful error", code });
  });
  it("rate-limits autosaves with a retry delay", async () => {
    for (let i = 0; i < 600; i++) expect((await POST(request("POST", create))).status).toBe(200);
    const response = await POST(request("POST", create)); expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBeTruthy(); expect(mocks.mutate).toHaveBeenCalledTimes(600);
  });
});
