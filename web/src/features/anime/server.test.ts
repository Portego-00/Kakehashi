import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildAnimeCatalog, matchAnimeCatalog, normalizeAnimeTitle, syncWatchedAnime } from "./server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("anime catalog server", () => {
  it("merges the live ImmersionKit title with preloaded MyAnimeList metadata", () => {
    const catalog = buildAnimeCatalog({ death_note: { title: "Death Note", category: "anime" }, ignored: { title: "Drama", category: "drama" } });
    expect(catalog).toHaveLength(1);
    expect(catalog[0]).toMatchObject({ id: "death_note", title: "Death Note", malId: 1535, aniListId: 1535 });
    expect(catalog[0].imageUrl).toContain("cdn.myanimelist.net");
    expect(catalog[0].score).toEqual(expect.any(Number));
  });

  it("matches list entries by provider ID first and normalized titles as a fallback", () => {
    const catalog = buildAnimeCatalog({ death_note: { title: "Death Note", category: "anime" }, your_name: { title: "Your Name", category: "anime" } });
    expect(matchAnimeCatalog("myanimelist", { ids: new Set([1535]), normalizedTitles: new Set() }, catalog)).toEqual(["death_note"]);
    expect(matchAnimeCatalog("anilist", { ids: new Set(), normalizedTitles: new Set([normalizeAnimeTitle("Kimi no Na wa")]) }, catalog)).toEqual(["your_name"]);
  });

  it("uses AniList's MAL cross-reference when an ImmersionKit slug has no AniList mapping", () => {
    const catalog = buildAnimeCatalog({ chobits: { title: "Chobits", category: "anime" } });
    expect(matchAnimeCatalog("anilist", { ids: new Set([999_999]), malIds: new Set([59]), normalizedTitles: new Set() }, catalog)).toEqual(["chobits"]);
  });

  it("keeps only active watched statuses when syncing MyAnimeList", async () => {
    vi.stubEnv("EXPO_PUBLIC_MAL_CLIENT_ID", "client-id");
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/index_meta")) return new Response(JSON.stringify({ data: { death_note: { title: "Death Note", category: "anime" } } }), { status: 200 });
      return new Response(JSON.stringify({ data: [
        { node: { id: 1535, title: "Death Note" }, list_status: { status: "completed" } },
        { node: { id: 999, title: "Plan to Watch" }, list_status: { status: "plan_to_watch" } },
      ], paging: {} }), { status: 200 });
    }));
    await expect(syncWatchedAnime("myanimelist", "reader")).resolves.toMatchObject({ watched: 1, matchedSources: ["death_note"] });
  });
});
