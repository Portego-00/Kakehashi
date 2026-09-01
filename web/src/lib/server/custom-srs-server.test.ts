import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("does not hydrate database cards whose scheduler policy cannot be verified", async () => {
    const row = { revision: 4, state: { version: 1, policy: {}, enrolledPackIds: ["pack"], assignments: { "pack:ことば": { wordId: "pack:ことば", packId: "pack", stage: 1, card: { due: "bad", state: "Broken" } } }, reviewLog: [], updatedAt: "2026-08-31T10:00:00Z" } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([row]), { status: 200, headers: { "Content-Type": "application/json" } })));
    const { readRemoteCustomSrsState } = await import("./custom-srs-server");

    await expect(readRemoteCustomSrsState("123", [pack], new Date("2026-08-31T10:00:00Z"))).resolves.toMatchObject({ revision: 4, state: { enrolledPackIds: [], assignments: {} } });
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
