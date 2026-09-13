import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { CUSTOM_VOCABULARY_WORDS, customVocabularyPack } from "@/features/custom-srs/catalog";
import { completeCustomLesson, createCustomSrsState, enrollCustomVocabularyPack, recordCustomReview } from "@/features/custom-srs/model";
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

function request(method: "GET" | "POST", body?: unknown, options: { cookie?: boolean; origin?: string; accountId?: string } = {}) {
  const cookie = options.cookie === false ? undefined : "kakehashi_wk_session=sealed-session";
  const url = new URL("http://localhost/api/custom-srs");
  if (options.accountId !== undefined) url.searchParams.set("accountId", options.accountId);
  return new NextRequest(url, {
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
    mocks.identity.mockReset().mockResolvedValue({ id: "123", username: "Portego", level: 12 });
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
    expect((await POST(request("POST", { action: "complete_lesson", wordId: "pack:word", eventId: crypto.randomUUID() }, { cookie: false }))).status).toBe(401);
    expect((await POST(request("POST", { action: "complete_lesson", wordId: "pack:word", eventId: crypto.randomUUID() }, { origin: "https://evil.example" }))).status).toBe(403);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("accepts the asserted account only when it matches the sealed session identity", async () => {
    expect((await GET(request("GET", undefined, { accountId: "123" }))).status).toBe(200);
    expect((await POST(request("POST", { action: "enroll_pack", packId: "conversation-glue", eventId: crypto.randomUUID(), accountId: "123" }))).status).toBe(200);
    expect(mocks.read).toHaveBeenCalledWith("123", expect.any(Array));
    expect(mocks.mutate).toHaveBeenCalledWith("123", expect.any(Array), expect.any(Function));
  });

  it.each([true, false])("rejects an old account's queued reads and mutations before storage or browser fallback (configured=%s)", async (configured) => {
    mocks.configured.mockReturnValue(configured);
    const mutations = [
      { action: "enroll_pack", packId: "conversation-glue" },
      { action: "complete_lesson", wordId: "conversation-glue-douzo" },
      { action: "submit_review", wordId: "conversation-glue-douzo", incorrectAnswers: 0 },
    ];
    const responses = [await GET(request("GET", undefined, { accountId: "456" }))];
    for (const mutation of mutations) {
      responses.push(await POST(request("POST", { ...mutation, eventId: crypto.randomUUID(), accountId: "456" })));
    }
    for (const response of responses) {
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "The custom study account has changed. Sign back in to sync this account's saved progress." });
    }
    expect(mocks.configured).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it.each(["", "x".repeat(129)])("rejects invalid asserted account metadata %j", async (accountId) => {
    expect((await GET(request("GET", undefined, { accountId }))).status).toBe(400);
    expect((await POST(request("POST", { action: "enroll_pack", packId: "conversation-glue", eventId: crypto.randomUUID(), accountId }))).status).toBe(400);
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("rejects invalid review occurrence timestamps", async () => {
    expect((await POST(request("POST", { action: "submit_review", wordId: "word", incorrectAnswers: 0, eventId: crypto.randomUUID(), expectedAssignmentUpdatedAt: "not-a-date" }))).status).toBe(400);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("does not apply a stale queued review to a later due occurrence, even after its event log was trimmed", async () => {
    const pack = customVocabularyPack("conversation-glue")!;
    const wordId = pack.words[0].id;
    const introducedAt = new Date("2026-08-30T00:00:00.000Z");
    const introduced = completeCustomLesson(enrollCustomVocabularyPack(createCustomSrsState(introducedAt), pack, introducedAt), wordId, introducedAt);
    const previous = recordCustomReview(introduced, wordId, 0, new Date("2026-08-31T10:00:00.000Z"), crypto.randomUUID());
    const current = { ...previous, reviewLog: [] };
    mocks.mutate.mockImplementation(async (_id, _packs, transform) => ({ state: transform(current, new Date("2026-09-10T10:00:00.000Z")), revision: 8 }));

    const response = await POST(request("POST", {
      action: "submit_review", wordId, incorrectAnswers: 0, eventId: crypto.randomUUID(), accountId: "123",
      expectedAssignmentUpdatedAt: introduced.assignments[wordId].updatedAt,
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ available: true, state: current, revision: 8 });
  });

  it("accepts a matching review occurrence and replays its durable event without advancing twice", async () => {
    const pack = customVocabularyPack("conversation-glue")!;
    const wordId = pack.words[0].id;
    const introducedAt = new Date("2026-08-30T00:00:00.000Z");
    let current = completeCustomLesson(enrollCustomVocabularyPack(createCustomSrsState(introducedAt), pack, introducedAt), wordId, introducedAt);
    const payload = {
      action: "submit_review", wordId, incorrectAnswers: 0, eventId: crypto.randomUUID(), accountId: "123",
      expectedAssignmentUpdatedAt: current.assignments[wordId].updatedAt,
    };
    mocks.mutate.mockImplementation(async (_id, _packs, transform) => {
      current = transform(current, new Date("2026-08-31T10:00:00.000Z"));
      return { state: current, revision: 8 };
    });

    const first = await POST(request("POST", payload));
    expect(first.status).toBe(200);
    expect(current.assignments[wordId].stage).toBe(2);
    expect(current.reviewLog).toHaveLength(1);
    const firstState = current;
    const replay = await POST(request("POST", payload));
    expect(replay.status).toBe(200);
    expect(current).toBe(firstState);
    expect(await replay.json()).toEqual({ available: true, state: firstState, revision: 8 });
  });

  it.each(["portego", " PORTEGO "])("allows the normalized Portego username %j", async (username) => {
    mocks.identity.mockResolvedValue({ id: "123", username, level: 12 });
    expect((await GET(request("GET"))).status).toBe(200);
    expect((await POST(request("POST", { action: "enroll_pack", packId: "conversation-glue", eventId: crypto.randomUUID() }))).status).toBe(200);
  });

  it.each([
    { username: "Tester", configured: true },
    { username: "Tester", configured: false },
    { username: "PortegoFan", configured: true },
    { username: "", configured: true },
    { username: undefined, configured: false },
  ])("denies other or absent usernames before backend access ($username, configured=$configured)", async ({ username, configured }) => {
    mocks.identity.mockResolvedValue({ id: "123", username, level: 12 });
    mocks.configured.mockReturnValue(configured);

    for (const response of [
      await GET(request("GET")),
      await POST(request("POST", { action: "enroll_pack", packId: "conversation-glue", eventId: crypto.randomUUID() })),
    ]) {
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "Custom vocabulary is not available for this account." });
      expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    }
    expect(mocks.configured).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("fails closed when the session identity cannot be verified", async () => {
    mocks.identity.mockRejectedValue(new Error("Session invalid"));
    mocks.configured.mockReturnValue(false);

    expect((await GET(request("GET"))).status).toBe(503);
    expect((await POST(request("POST", { action: "enroll_pack", packId: "conversation-glue", eventId: crypto.randomUUID() }))).status).toBe(503);
    expect(mocks.configured).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
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

  it("allows browser persistence only after verifying Portego when the private backend is absent", async () => {
    mocks.configured.mockReturnValue(false);
    expect(await (await GET(request("GET"))).json()).toEqual({ available: false, state: null, revision: -1 });
    expect(await (await POST(request("POST", { action: "complete_lesson", wordId: "pack:word", eventId: crypto.randomUUID() }))).json()).toEqual({ available: false, state: null, revision: -1 });
    expect(mocks.identity).toHaveBeenCalledTimes(2);
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.mutate).not.toHaveBeenCalled();
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
