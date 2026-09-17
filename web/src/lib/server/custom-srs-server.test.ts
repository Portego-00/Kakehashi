import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeCustomLesson, createCustomSrsState, enrollCustomVocabularyPack } from "@/features/custom-srs/model";
import type { CustomVocabularyPack } from "@/features/custom-srs/types";

const pack: CustomVocabularyPack = {
  id: "pack",
  title: "Pack",
  description: "Pack",
  script: "hiragana",
  words: [{ id: "pack:ことば", characters: "ことば", reading: "ことば", meanings: ["word"], partsOfSpeech: ["noun"], meaningMnemonic: "A word.", readingMnemonic: "Kana.", contextSentences: [] }],
};

vi.mock("server-only", () => ({}));

describe("custom SRS server store", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPABASE_URL", "https://supabase.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
  });

  it("returns an empty state when the authenticated account has no row", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } })));
    const { readRemoteCustomSrsState } = await import("./custom-srs-server");
    await expect(readRemoteCustomSrsState("123", [pack], new Date("2026-08-31T10:00:00Z"))).resolves.toMatchObject({ revision: -1, state: { enrolledPackIds: [] } });
    expect(fetch).toHaveBeenCalledWith(expect.objectContaining({ href: expect.stringContaining("custom_srs_states") }), expect.objectContaining({ cache: "no-store" }));
  });

  it("refuses incompatible cloud progress instead of returning an empty writable state", async () => {
    const row = { revision: 4, state: { version: 1, policy: {}, enrolledPackIds: ["pack"], assignments: { "pack:ことば": { wordId: "pack:ことば", packId: "pack", stage: 1, card: { due: "bad", state: "Broken" } } }, reviewLog: [], updatedAt: "2026-08-31T10:00:00Z" } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([row]), { status: 200, headers: { "Content-Type": "application/json" } })));
    const { readRemoteCustomSrsState } = await import("./custom-srs-server");

    await expect(readRemoteCustomSrsState("123", [pack], new Date("2026-08-31T10:00:00Z"))).rejects.toThrow("unsupported");
  });

  it("retries optimistic write conflicts without losing the requested mutation", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response("null", { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ revision: 0 }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const { mutateRemoteCustomSrsState } = await import("./custom-srs-server");
    const result = await mutateRemoteCustomSrsState("123", [pack], (state, now) => ({ ...state, enrolledPackIds: ["pack"], updatedAt: now.toISOString() }), () => new Date("2026-08-31T10:00:00Z"));
    expect(result).toMatchObject({ revision: 0, state: { enrolledPackIds: ["pack"] } });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("returns the authoritative revision without writing for an already-applied or stale occurrence", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const { mutateRemoteCustomSrsState } = await import("./custom-srs-server");

    const result = await mutateRemoteCustomSrsState("123", [pack], (state) => state, () => new Date("2026-08-31T10:00:00Z"));

    expect(result).toMatchObject({ revision: -1, state: { enrolledPackIds: [] } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBeInstanceOf(URL);
  });

  it("never writes when a learned card is corrupt or the database response is unreadable", async () => {
    const state = completeCustomLesson(enrollCustomVocabularyPack(createCustomSrsState(), pack), pack.words[0].id);
    state.assignments[pack.words[0].id].card = null;
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ state, revision: 3 }])));
    vi.stubGlobal("fetch", fetchMock);
    const { mutateRemoteCustomSrsState, readRemoteCustomSrsState } = await import("./custom-srs-server");
    const transform = vi.fn();
    await expect(mutateRemoteCustomSrsState("123", [pack], transform)).rejects.toThrow("could not be read safely");
    expect(transform).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce(new Response("not-json"));
    await expect(readRemoteCustomSrsState("123", [pack])).rejects.toThrow("unreadable");
  });

  it("reads and writes only the selected card and returns a delta for a current client", async () => {
    const state = enrollCustomVocabularyPack(createCustomSrsState(), pack);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ state, revision: 3 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ revision: 4 })));
    vi.stubGlobal("fetch", fetchMock);
    const { mutateRemoteCustomSrsState } = await import("./custom-srs-server");
    const result = await mutateRemoteCustomSrsState("123", [pack], (current, now) => completeCustomLesson(current, pack.words[0].id, now), undefined, 3, { wordIds: [pack.words[0].id], eventId: "event" });
    expect(result).toMatchObject({ available: true, revision: 4, delta: { baseRevision: 3 } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("read_custom_srs_cards");
    const payload = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(Object.keys(payload.p_assignments)).toEqual([pack.words[0].id]);
    expect(payload).not.toHaveProperty("p_state");
  });

  it("does not expose or attempt remote storage without a service credential", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { customSrsBackendConfigured, readRemoteCustomSrsState } = await import("./custom-srs-server");
    expect(customSrsBackendConfigured()).toBe(false);
    await expect(readRemoteCustomSrsState("123", [pack])).resolves.toMatchObject({ revision: -1 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
