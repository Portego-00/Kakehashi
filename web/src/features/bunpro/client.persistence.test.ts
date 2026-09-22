import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ identity: vi.fn(), upstream: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/analytics-server", () => ({ analyticsIdentityFromSealedSession: mocks.identity }));
import { DELETE, GET, POST } from "@/app/api/bunpro/route";
import { BUNPRO_COOKIE } from "@/lib/server/bunpro";
import { sealToken } from "@/lib/server/session-crypto";
import { WANIKANI_SESSION_COOKIE } from "@/lib/server/wanikani-session";
import { bunpro } from "./client";
import { BUNPRO_CREDENTIAL_STORAGE_KEY } from "./credential";

let cookie: string | undefined;
beforeEach(() => {
  window.localStorage.clear();
  cookie = undefined;
  mocks.identity.mockReset().mockResolvedValue({ id: "1", username: "Portego" });
  mocks.upstream.mockReset().mockImplementation(async () => Response.json({ total_due_grammar: 2 }));
  vi.stubGlobal("fetch", vi.fn(async (url: string | URL, options?: RequestInit) => {
    if (url instanceof URL) return mocks.upstream(url, options);
    const headers = new Headers(options?.headers);
    headers.set("host", "kakehashiapp.com");
    headers.set("origin", "https://kakehashiapp.com");
    headers.set("cookie", `${WANIKANI_SESSION_COOKIE}=verified${cookie ? `; ${BUNPRO_COOKIE}=${cookie}` : ""}`);
    const request = new NextRequest(`https://kakehashiapp.com${url}`, { ...options, headers, signal: options?.signal ?? undefined });
    const response = await (options?.method === "POST" ? POST : options?.method === "DELETE" ? DELETE : GET)(request);
    const saved = response.cookies.get(BUNPRO_COOKIE);
    if (saved) cookie = saved.value || undefined;
    return response;
  }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); window.localStorage.clear(); });

async function connect(token = "test-api-key") {
  return bunpro("", { method: "POST", body: JSON.stringify({ action: "connect", token }) });
}

it("keeps Bunpro connected after a reload and loss of its cookie", async () => {
  await connect();
  cookie = undefined;
  vi.resetModules();
  const reloaded = await import("./client");
  expect(await reloaded.bunpro("action=connection")).toEqual({ connected: true });
  expect(await reloaded.bunpro("action=due")).toEqual({ total_due_grammar: 2 });
  expect(JSON.stringify(window.localStorage)).not.toContain("test-api-key");
});

it("preserves existing cookie connections in browser storage automatically", async () => {
  cookie = sealToken(JSON.stringify({ owner: "1", token: "legacy-key" }));
  expect(await bunpro("action=connection")).toEqual({ connected: true });
  cookie = undefined;
  expect(await bunpro("action=connection")).toEqual({ connected: true });
});

it("disconnects both the cookie and the saved browser connection", async () => {
  await connect();
  await bunpro("", { method: "DELETE" });
  expect(await bunpro("action=connection")).toEqual({ connected: false });
});

it("keeps the saved key after an upstream outage or rejected replacement", async () => {
  await connect();
  cookie = undefined;
  mocks.upstream.mockResolvedValueOnce(Response.json({}, { status: 503 }));
  await expect(bunpro("action=connection")).rejects.toThrow();
  mocks.upstream.mockResolvedValueOnce(Response.json({}, { status: 401 }));
  await expect(connect("invalid-key")).rejects.toThrow();
  expect(await bunpro("action=connection")).toEqual({ connected: true });
  expect(mocks.upstream).toHaveBeenLastCalledWith(expect.any(URL), expect.objectContaining({
    headers: expect.objectContaining({ Authorization: "Bearer test-api-key" }),
  }));
});

it("does not use a saved connection for another account", async () => {
  await connect();
  cookie = undefined;
  mocks.upstream.mockClear();
  mocks.identity.mockResolvedValue({ id: "2", username: "Portego" });
  expect(await bunpro("action=connection")).toEqual({ connected: false });
  expect(mocks.upstream).not.toHaveBeenCalled();
  mocks.identity.mockResolvedValue({ id: "1", username: "Portego" });
  expect(await bunpro("action=connection")).toEqual({ connected: true });
});

it("persists a replacement key and prefers it to a stale cookie", async () => {
  await connect();
  const oldCookie = cookie;
  await connect("replacement-key");
  cookie = oldCookie;
  expect(await bunpro("action=connection")).toEqual({ connected: true });
  expect(mocks.upstream).toHaveBeenLastCalledWith(expect.any(URL), expect.objectContaining({
    headers: expect.objectContaining({ Authorization: "Bearer replacement-key" }),
  }));
});

it("recovers invalid browser storage from a valid existing cookie", async () => {
  await connect();
  window.localStorage.setItem(BUNPRO_CREDENTIAL_STORAGE_KEY, "invalid-sealed-credential");
  expect(await bunpro("action=connection")).toEqual({ connected: true });
  cookie = undefined;
  expect(await bunpro("action=connection")).toEqual({ connected: true });
});

it("still supports cookie connections when browser storage is blocked", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage blocked"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage blocked"); });
  await connect();
  expect(await bunpro("action=connection")).toEqual({ connected: true });
});

it("does not restore a disconnected credential from an in-flight connection check", async () => {
  await connect();
  let finish!: (value: Response) => void;
  mocks.upstream.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
  const pending = bunpro("action=connection");
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
  await bunpro("", { method: "DELETE" });
  finish(Response.json({}));
  await pending;
  expect(await bunpro("action=connection")).toEqual({ connected: false });
});

it("saves a replacement even if the old cookie is migrated while saving", async () => {
  cookie = sealToken(JSON.stringify({ owner: "1", token: "legacy-key" }));
  let finish!: (value: Response) => void;
  mocks.upstream.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
  const pending = connect("replacement-key");
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
  await bunpro("action=connection");
  finish(Response.json({}));
  await pending;
  cookie = undefined;
  await bunpro("action=connection");
  expect(mocks.upstream).toHaveBeenLastCalledWith(expect.any(URL), expect.objectContaining({
    headers: expect.objectContaining({ Authorization: "Bearer replacement-key" }),
  }));
});
