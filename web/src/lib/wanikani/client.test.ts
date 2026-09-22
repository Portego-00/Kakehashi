import { afterEach, describe, expect, it, vi } from "vitest";
import { resetWkRequestCooldown, wkCollection, wkRequest } from "./client";
import { readReviewLedger, setReviewRecordingAccount } from "@/features/progress/analytics-review-ledger";
import { testReview } from "@/features/progress/analytics-test-fixtures";

describe("WaniKani browser client", () => {
  afterEach(() => { resetWkRequestCooldown(); vi.useRealTimers(); vi.unstubAllGlobals(); setReviewRecordingAccount(null); localStorage.clear(); });

  it("retries a rate-limited page and makes other requests share its cooldown", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ error: "Rate limit" }, { status: 429, headers: { "Retry-After": "3" } }))
      .mockImplementation(async () => Response.json({ id: 7 }));
    vi.stubGlobal("fetch", fetchMock);
    const first = wkRequest("subjects");
    await vi.advanceTimersByTimeAsync(0);
    const second = wkRequest("user");
    await vi.advanceTimersByTimeAsync(2_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(Promise.all([first, second])).resolves.toEqual([{ id: 7 }, { id: 7 }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("cancels a rate-limit wait without retrying the request", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(Response.json({}, { status: 429, headers: { "Retry-After": "60" } }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const result = wkRequest("user", { signal: controller.signal });
    const rejected = expect(result).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await rejected;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("preserves a lesson start timestamp when retrying an explicit rate limit", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({}, { status: 429, headers: { "Retry-After": "2" } }))
      .mockResolvedValueOnce(Response.json({ id: 9 }));
    vi.stubGlobal("fetch", fetchMock);
    const startedAt = new Date().toISOString();
    const result = wkRequest("assignments/9/start", { method: "PUT", body: { assignment: { started_at: startedAt } } });
    await vi.advanceTimersByTimeAsync(2_000);
    await result;
    expect(fetchMock.mock.calls.map((call) => JSON.parse(call[1].body).assignment.started_at)).toEqual([startedAt, startedAt]);
  });

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
