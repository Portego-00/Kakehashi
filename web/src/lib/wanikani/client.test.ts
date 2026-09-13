import { afterEach, describe, expect, it, vi } from "vitest";
import { wkRequest } from "./client";

describe("WaniKani browser client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("marks reconciliation reads as an explicit server-cache bypass", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("X-Kakehashi-Cache")).toBe("bypass");
      return new Response(JSON.stringify({ id: 9 }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(wkRequest<{ id: number }>("assignments/9", { cache: "no-store", fresh: true })).resolves.toEqual({ id: 9 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
