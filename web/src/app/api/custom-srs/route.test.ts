import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { CUSTOM_VOCABULARY_WORDS } from "@/features/custom-srs/catalog";
import { clearRateLimitsForTests } from "@/lib/server/rate-limit";

const mocks = vi.hoisted(() => ({
  configured: vi.fn(() => true),
  identity: vi.fn(),
  read: vi.fn(),
  mutate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/analytics-server", () => ({ analyticsIdentityFromSealedSession: mocks.identity }));
vi.mock("@/lib/server/custom-srs-server", () => ({
  customSrsBackendConfigured: mocks.configured,
  readRemoteCustomSrsState: mocks.read,
  mutateRemoteCustomSrsState: mocks.mutate,
}));

import { GET, POST } from "./route";

const emptyState = { version: 1, policy: {}, enrolledPackIds: [], assignments: {}, reviewLog: [], updatedAt: "2026-08-31T10:00:00Z" };

function request(method: "GET" | "POST", body?: unknown, options: { cookie?: boolean; origin?: string } = {}) {
  const cookie = options.cookie === false ? undefined : "kakehashi_wk_session=sealed-session";
  return new NextRequest("http://localhost/api/custom-srs", {
    method,
    headers: {
      host: "localhost",
      ...(options.origin === undefined ? { origin: "http://localhost" } : options.origin ? { origin: options.origin } : {}),
      ...(cookie ? { cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe("custom SRS route", () => {
  beforeEach(() => {
    clearRateLimitsForTests();
    mocks.configured.mockReset().mockReturnValue(true);
    mocks.identity.mockReset().mockResolvedValue({ id: "123", username: "Tester", level: 12 });
    mocks.read.mockReset().mockResolvedValue({ state: emptyState, revision: -1 });
    mocks.mutate.mockReset().mockImplementation(async (_id, _packs, transform) => ({ state: transform(emptyState, new Date("2026-08-31T10:00:00Z")), revision: 0 }));
  });

  it("loads private progress for the sealed WaniKani identity", async () => {
    const response = await GET(request("GET"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ available: true, revision: -1, state: { enrolledPackIds: [] } });
    expect(mocks.identity).toHaveBeenCalledWith("sealed-session");
    expect(mocks.read).toHaveBeenCalledWith("123", expect.any(Array));
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
  });

  it("requires authentication and a trusted same-origin mutation", async () => {
    expect((await GET(request("GET", undefined, { cookie: false }))).status).toBe(401);
    expect((await POST(request("POST", { action: "complete_lesson", wordId: "pack:word", eventId: crypto.randomUUID() }, { origin: "https://evil.example" }))).status).toBe(403);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("validates actions before mutating server-owned state", async () => {
    const malformed = await POST(request("POST", { action: "submit_review", wordId: "word", incorrectAnswers: -1, eventId: "bad" }));
    expect(malformed.status).toBe(400);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("resolves pack enrollment from the server-owned catalog", async () => {
    const response = await POST(request("POST", { action: "enroll_pack", packId: "conversation-glue", eventId: crypto.randomUUID() }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.state.enrolledPackIds).toEqual(["conversation-glue"]);
    expect(Object.keys(payload.state.assignments)).toHaveLength(16);
  });

  it("degrades explicitly to browser persistence when the private backend is absent", async () => {
    mocks.configured.mockReturnValue(false);
    expect(await (await GET(request("GET"))).json()).toEqual({ available: false, state: null, revision: -1 });
    expect(await (await POST(request("POST", { action: "complete_lesson", wordId: "pack:word", eventId: crypto.randomUUID() }))).json()).toEqual({ available: false, state: null, revision: -1 });
    expect(mocks.identity).not.toHaveBeenCalled();
  });

  it("allows a complete custom-vocabulary backlog plus bounded retries before rate limiting", async () => {
    const mutation = { action: "enroll_pack", packId: "conversation-glue", eventId: crypto.randomUUID() };
    const expectedLimit = Math.max(120, CUSTOM_VOCABULARY_WORDS.length + 64);

    for (let index = 0; index < expectedLimit; index += 1) {
      expect((await POST(request("POST", mutation))).status).toBe(200);
    }

    const limited = await POST(request("POST", mutation));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
    expect(mocks.mutate).toHaveBeenCalledTimes(expectedLimit);
  });
});
