import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getNewsFeed: vi.fn() }));

vi.mock("@/features/content/news-source", () => ({ getNewsFeed: mocks.getNewsFeed }));

import { GET } from "./route";

describe("NHK feed route", () => {
  beforeEach(() => mocks.getNewsFeed.mockReset());

  it("defaults to Easy and forwards an explicit source preference", async () => {
    mocks.getNewsFeed.mockResolvedValue({ articles: [], updatedAt: "2026-08-25T00:00:00.000Z", source: "live" });

    const easy = await GET(new Request("http://localhost/news/feed"));
    const both = await GET(new Request("http://localhost/news/feed?source=both"));

    expect(easy.status).toBe(200);
    expect(both.status).toBe(200);
    expect(mocks.getNewsFeed.mock.calls).toEqual([["easy"], ["both"]]);
    expect(easy.headers.get("cache-control")).toContain("stale-while-revalidate=3600");
  });

  it("rejects unknown source values before touching the source module", async () => {
    const response = await GET(new Request("http://localhost/news/feed?source=everything"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "News source must be easy, regular, or both." });
    expect(mocks.getNewsFeed).not.toHaveBeenCalled();
  });
});
