import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { fetchAvailableReviewCount, userQuery, wkKeys } from "./queries";

describe("WaniKani queries", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("checks Vacation Mode on mount without polling every minute", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { current_vacation_started_at: null } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const observer = new QueryObserver(client, userQuery());
    const unsubscribe = observer.subscribe(() => {});
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(120_000);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
      client.clear();
      vi.useRealTimers();
    }
  });

  it("uses WaniKani's filtered review scope and collection total", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("/api/wanikani/assignments?immediately_available_for_review=true&hidden=false");
      expect(init?.cache).toBe("no-store");
      expect(new Headers(init?.headers).get("X-Kakehashi-Cache")).toBe("bypass");
      return new Response(JSON.stringify({
        object: "collection",
        url: "",
        pages: { next_url: "https://api.wanikani.com/v2/assignments?page_after_id=500", previous_url: null, per_page: 500 },
        total_count: 214,
        data_updated_at: "2026-08-28T12:00:00Z",
        data: [],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAvailableReviewCount()).resolves.toBe(214);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("uses an assignments prefix that invalidates collections and the live count", () => {
    expect(wkKeys.assignments()).toEqual(["wanikani", "assignments"]);
    expect(wkKeys.assignments("")).toEqual(["wanikani", "assignments", ""]);
    expect(wkKeys.availableReviewCount()).toEqual(["wanikani", "assignments", "available-review-count"]);
  });
});
