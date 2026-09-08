// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { POST as analyze } from "@/app/(app)/news/analyze/route";
import { POST as translateManga } from "@/app/(app)/manga/translate/route";
import { POST as translateMusic } from "@/app/(app)/music/translate/route";
import { POST as translateVideo } from "@/app/(app)/video/translate/route";
import { DEMO_SESSION_COOKIE } from "@/features/demo/constants";
import { DEMO_JPDB_KEY } from "@/features/demo/jpdb";
import { clearRateLimitsForTests, takeRateLimit } from "./rate-limit";
import { clearDemoJpdbBudgetsForTests, resolveJpdbCredential, takeDemoJpdbBudget } from "./demo-jpdb";

const demoCookie = `${DEMO_SESSION_COOKIE}=1`;
const endpoints = [
  { path: "/news/analyze", handler: analyze, body: { text: "猫" }, response: { tokens: [[[0, 0, 1]]], vocabulary: [["猫", "ねこ", ["n"], [["cat"]], []]] } },
  { path: "/manga/translate", handler: translateManga, body: { text: "猫" }, response: { text: "Cat." } },
  { path: "/music/translate", handler: translateMusic, body: { lines: ["猫"] }, response: { text: "Cat." } },
  { path: "/video/translate", handler: translateVideo, body: { lines: ["猫"] }, response: { text: "Cat." } },
];

function request(path: string, body: unknown, cookie = demoCookie, origin = "http://localhost:3100") {
  return new Request(`http://localhost:3100${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", host: "localhost:3100", origin, cookie, "x-forwarded-for": "203.0.113.91" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  clearRateLimitsForTests();
  clearDemoJpdbBudgetsForTests();
  vi.stubEnv("JPDB_DEMO_API_KEY", "server-demo-secret");
  vi.stubEnv("JPDB_API_KEY", "");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe.each(endpoints)("demo JPDB $path", ({ path, handler, body, response: upstreamBody }) => {
  it("uses the server credential only upstream, with no browser credential required", async () => {
    const remote = vi.fn<typeof fetch>(async () => Response.json(upstreamBody));
    vi.stubGlobal("fetch", remote);
    const response = await handler(request(path, { ...body, apiKey: DEMO_JPDB_KEY }));
    const result = await response.text();
    expect(response.status).toBe(200);
    expect(remote).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/jpdb\.io\/api\/v1\/(parse|ja2en)$/), expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer server-demo-secret" }),
    }));
    expect(result).toMatch(/cat/i);
    expect(result).not.toContain("server-demo-secret");
    expect(result).not.toContain(DEMO_JPDB_KEY);
    expect(response.headers.get("cache-control")).toContain("private, no-store");
  });

  it.each(["", `${DEMO_SESSION_COOKIE}=0`, `${DEMO_SESSION_COOKIE}=1; kakehashi_wk_session=real-account`])("refuses the demo credential outside an isolated demo session (%s)", async (cookie) => {
    const remote = vi.fn();
    vi.stubGlobal("fetch", remote);
    const response = await handler(request(path, { ...body, apiKey: DEMO_JPDB_KEY }, cookie));
    expect(response.status).toBe(403);
    expect(remote).not.toHaveBeenCalled();
  });

  it("does not lend the demo key to a regular account with no JPDB key", async () => {
    const remote = vi.fn();
    vi.stubGlobal("fetch", remote);
    expect((await handler(request(path, body, "kakehashi_wk_session=real-account"))).status).toBe(409);
    expect(remote).not.toHaveBeenCalled();
  });

  it("preserves a regular account's own JPDB credential", async () => {
    const remote = vi.fn<typeof fetch>(async () => Response.json(upstreamBody));
    vi.stubGlobal("fetch", remote);
    const response = await handler(request(path, { ...body, apiKey: "my-own-key" }, "kakehashi_wk_session=real-account"));
    await response.text();
    expect(remote).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer my-own-key" }) }));
  });

  it("returns a safe error when the demo service is not configured", async () => {
    vi.stubEnv("JPDB_DEMO_API_KEY", "");
    const remote = vi.fn();
    vi.stubGlobal("fetch", remote);
    const response = await handler(request(path, { ...body, apiKey: DEMO_JPDB_KEY }));
    expect(response.status).toBe(503);
    expect(remote).not.toHaveBeenCalled();
  });

  it("does not ask demo visitors to replace the owner's rejected key", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => Response.json({ error: "bad_key" }, { status: 403 })));
    const response = await handler(request(path, { ...body, apiKey: DEMO_JPDB_KEY }));
    const result = await response.text();
    expect(result).toContain("api_unavailable");
    expect(result).not.toContain("Settings");
    expect(result).not.toContain("server-demo-secret");
  });

  it("rejects cross-origin use before contacting JPDB", async () => {
    const remote = vi.fn();
    vi.stubGlobal("fetch", remote);
    const response = await handler(request(path, { ...body, apiKey: DEMO_JPDB_KEY }, demoCookie, "https://untrusted.example"));
    expect(response.status).toBe(403);
    expect(remote).not.toHaveBeenCalled();
  });
});

it("counts each translated line against the shared demo budget", async () => {
  const req = request("/video/translate", { lines: ["猫", "犬"], apiKey: DEMO_JPDB_KEY });
  for (let count = 0; count < 119; count++) expect(takeDemoJpdbBudget(req, true)).toBeNull();
  const remote = vi.fn<typeof fetch>(async () => Response.json({ text: "Cat." }));
  vi.stubGlobal("fetch", remote);
  const response = await translateVideo(req);
  const result = await response.text();
  expect(remote).toHaveBeenCalledTimes(1);
  expect(result).toContain('"translation":"Cat."');
  expect(result).toContain('"code":"too_many_requests"');
  expect(takeDemoJpdbBudget(req, false)).toBeNull();
});

it("rejects oversized demo selections without using the shared credential", async () => {
  const remote = vi.fn();
  vi.stubGlobal("fetch", remote);
  expect((await analyze(request("/news/analyze", { text: "猫".repeat(12_001), apiKey: DEMO_JPDB_KEY }))).status).toBe(400);
  expect((await translateManga(request("/manga/translate", { text: "猫".repeat(4_001), apiKey: DEMO_JPDB_KEY }))).status).toBe(400);
  expect((await translateVideo(request("/video/translate", { lines: Array.from({ length: 7 }, (_, i) => `${i}${"猫".repeat(1_999)}`), apiKey: DEMO_JPDB_KEY }))).status).toBe(400);
  expect(remote).not.toHaveBeenCalled();
});

it("does not fall back from an unavailable demo credential to the site's regular JPDB key", () => {
  vi.stubEnv("JPDB_DEMO_API_KEY", "");
  vi.stubEnv("JPDB_API_KEY", "other-private-key");
  const credential = resolveJpdbCredential(request("/news/analyze", {}), DEMO_JPDB_KEY, true);
  expect(credential.failure?.status).toBe(503);
  expect(credential.apiKey).toBeUndefined();
});

it("keeps the shared minute cap when unrelated traffic evicts ordinary client buckets", () => {
  for (let client = 0; client < 3; client++) {
    const req = request("/news/analyze", {});
    req.headers.set("x-forwarded-for", `203.0.113.${client}`);
    for (let count = 0; count < 100; count++) expect(takeDemoJpdbBudget(req, true)).toBeNull();
  }
  for (let client = 0; client < 2_100; client++) takeRateLimit(`unrelated-client-${client}`, 10, 60_000);
  const req = request("/news/analyze", {});
  req.headers.set("x-forwarded-for", "203.0.113.250");
  expect(takeDemoJpdbBudget(req, true)?.status).toBe(429);
});

it("keeps the daily cap across minute windows and resets it after 24 hours", () => {
  vi.useFakeTimers();
  const start = Date.UTC(2026, 8, 7);
  let calls = 0;
  for (let minute = 0; minute < 17; minute++) {
    vi.setSystemTime(start + minute * 60_000);
    for (let client = 0; client < 3; client++) {
      const req = request("/news/analyze", {});
      req.headers.set("x-forwarded-for", `203.0.113.${client}`);
      for (let count = 0; count < 100 && calls < 5_000; count++, calls++) expect(takeDemoJpdbBudget(req, true)).toBeNull();
    }
  }
  vi.setSystemTime(start + 18 * 60_000);
  const req = request("/news/analyze", {});
  expect(takeDemoJpdbBudget(req, true)?.status).toBe(429);
  vi.setSystemTime(start + 24 * 60 * 60_000);
  expect(takeDemoJpdbBudget(req, true)).toBeNull();
});

it("rejects a malformed manga key without falling back to another server credential", async () => {
  vi.stubEnv("JPDB_API_KEY", "other-private-key");
  const remote = vi.fn();
  vi.stubGlobal("fetch", remote);
  expect((await translateManga(request("/manga/translate", { text: "猫", apiKey: "x".repeat(513) }))).status).toBe(400);
  expect(remote).not.toHaveBeenCalled();
});
