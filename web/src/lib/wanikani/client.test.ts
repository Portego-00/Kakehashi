import { afterEach, describe, expect, it, vi } from "vitest";
import { wkCollection, wkRequest } from "./client";
import { readReviewLedger, setReviewRecordingAccount } from "@/features/progress/analytics-review-ledger";
import { testReview } from "@/features/progress/analytics-test-fixtures";

describe("WaniKani browser client", () => {
  afterEach(() => { vi.unstubAllGlobals(); setReviewRecordingAccount(null); localStorage.clear(); });

  it("marks reconciliation reads as an explicit server-cache bypass", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("X-Kakehashi-Cache")).toBe("bypass");
      return new Response(JSON.stringify({ id: 9 }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(wkRequest<{ id: number }>("assignments/9", { cache: "no-store", fresh: true })).resolves.toEqual({ id: 9 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("follows every collection page and forwards cancellation", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 1 }], pages: { next_url: "https://api.wanikani.com/v2/reviews?page_after_id=1" } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 2 }], pages: { next_url: null } })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(wkCollection("reviews", Infinity, { signal: controller.signal })).resolves.toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/wanikani/reviews?page_after_id=1", expect.objectContaining({ signal: controller.signal }));
  });

  it("rejects truncated collections instead of treating partial data as complete", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 1 }], pages: { next_url: "reviews?page_after_id=1" } }))));
    await expect(wkCollection("reviews", 1)).rejects.toThrow("exceeded the page limit");
  });

  it("rejects repeated page cursors instead of looping indefinitely", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(JSON.stringify({ data: [], pages: { next_url: "reviews" } }))));
    await expect(wkCollection("reviews", Infinity)).rejects.toThrow("repeated collection page");
  });

  it("records only successful official review writes and never failed submissions", async () => {
    setReviewRecordingAccount("account:client-reviews");
    const response = testReview(1, 10);
    vi.stubGlobal("fetch", vi.fn().mockImplementationOnce(async () => new Response(JSON.stringify(response), { status: 200 }))
      .mockImplementationOnce(async () => new Response(JSON.stringify({ error: "Failed" }), { status: 503 }))
      .mockImplementationOnce(async () => new Response(JSON.stringify(testReview(2, 10)), { status: 200 })));
    await wkRequest("reviews", { method: "POST", body: { review: { assignment_id: 110 } } });
    await expect(wkRequest("reviews", { method: "POST", body: { review: { assignment_id: 110 } } })).rejects.toThrow("Failed");
    await wkRequest("reviews");
    expect(readReviewLedger("account:client-reviews").reviews.map((review) => review.id)).toEqual([1]);
  });

  it("does not attribute a delayed review response to the next account", async () => {
    setReviewRecordingAccount("account:delayed-old");
    let resolveResponse: (response: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolveResponse = resolve; })));
    const pending = wkRequest("reviews", { method: "POST", body: { review: { assignment_id: 110 } } });
    setReviewRecordingAccount("account:delayed-new");
    resolveResponse(new Response(JSON.stringify(testReview(1, 10)), { status: 200 }));
    await pending;
    expect(readReviewLedger("account:delayed-old").reviews).toEqual([]);
    expect(readReviewLedger("account:delayed-new").reviews).toEqual([]);
  });
});
