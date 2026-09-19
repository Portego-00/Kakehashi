import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setDemoMode } from "@/features/demo/runtime";
import { WaniKaniApiError } from "@/lib/wanikani/client";
import type { Review } from "@/types/wanikani";
import { analyticsHistoryQuery, analyticsSystemsQuery, reviewHistoryAvailability } from "./analytics-history";

afterEach(() => { setDemoMode(false); vi.unstubAllGlobals(); });

describe("analytics history availability", () => {
  it("distinguishes unavailable legacy history from a genuinely new account", () => {
    expect(reviewHistoryAvailability([], true)).toBe("unavailable");
    expect(reviewHistoryAvailability([], false)).toBe("available");
    expect(reviewHistoryAvailability([], true, true)).toBe("available");
    expect(reviewHistoryAvailability([{ id: 1 } as Review], true)).toBe("available");
  });

  it("keeps accounts in separate caches and only fetches over the authenticated proxy", async () => {
    setDemoMode(false);
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ data: [], pages: { next_url: null } })));
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient();
    await client.fetchQuery(analyticsHistoryQuery("account-one"));
    await client.fetchQuery(analyticsHistoryQuery("account-one"));
    await client.fetchQuery(analyticsHistoryQuery("account-two"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith("/api/wanikani/reviews", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(analyticsSystemsQuery("account-one").queryKey).not.toEqual(analyticsSystemsQuery("account-two").queryKey);
    client.clear();
  });

  it("retains rate-limit timing and does not retry expired credentials", () => {
    const options = analyticsHistoryQuery("account-one");
    expect(typeof options.retry === "function" && options.retry(0, new WaniKaniApiError("Expired", 401))).toBe(false);
    expect(typeof options.retryDelay === "function" && options.retryDelay(0, new WaniKaniApiError("Wait", 429, 429, 12_000))).toBe(12_000);
  });
});
