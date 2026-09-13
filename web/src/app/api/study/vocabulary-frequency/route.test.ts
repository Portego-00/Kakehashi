import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { clearRateLimitsForTests } from "@/lib/server/rate-limit";
import { POST } from "./route";

function frequencyRequest(
  body: unknown,
  options: { origin?: string; contentType?: string | null } = {},
) {
  const headers: Record<string, string> = {
    host: "localhost:3100",
    origin: options.origin ?? "http://localhost:3100",
    "x-forwarded-for": "203.0.113.88",
  };
  if (options.contentType !== null) headers["content-type"] = options.contentType ?? "application/json";
  return new Request("http://localhost:3100/api/study/vocabulary-frequency", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("vocabulary frequency route", () => {
  beforeEach(() => clearRateLimitsForTests());
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses the exact expression and reading match across both Jiten result lists", async () => {
    const signal = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(signal);
    const remote = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      results: [
        { wordId: 1, readingIndex: 0, text: "開く", rubyText: "開[あ]く", frequencyRank: 500 },
      ],
      dictionaryResults: [
        { wordId: 2, readingIndex: 0, text: "開く", rubyText: "開[ひら]く", frequencyRank: 1_200 },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", remote);

    const response = await POST(frequencyRequest({ expression: "開く", readings: ["ひらく"] }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      result: {
        provider: "jiten",
        frequencyRank: 1_200,
        wordId: 2,
        readingIndex: 0,
        matchedText: "開く",
        matchedReading: "ひらく",
        sourceUrl: "https://jiten.moe/search?query=%E9%96%8B%E3%81%8F",
      },
    });
    expect(timeout).toHaveBeenCalledWith(8_000);
    const requestUrl = new URL(String(remote.mock.calls[0]?.[0]));
    expect(requestUrl.origin + requestUrl.pathname).toBe("https://api.jiten.moe/api/vocabulary/search");
    expect(Object.fromEntries(requestUrl.searchParams)).toEqual({ query: "開く", limit: "50", offset: "0" });
    expect(remote.mock.calls[0]?.[1]).toMatchObject({ method: "GET", cache: "no-store", signal });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("returns a stable not-found response when no exact spelling matches", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      results: [{ wordId: 4, readingIndex: 0, text: "犬", rubyText: "犬[いぬ]", frequencyRank: 100 }],
      dictionaryResults: [],
    }), { status: 200 })));

    const response = await POST(frequencyRequest({ expression: "猫", readings: ["ねこ"] }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ result: null });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("rejects cross-origin, non-JSON, unknown, and oversized input without contacting Jiten", async () => {
    const remote = vi.fn();
    vi.stubGlobal("fetch", remote);

    expect((await POST(frequencyRequest(
      { expression: "猫", readings: ["ねこ"] },
      { origin: "https://attacker.example" },
    ))).status).toBe(403);
    expect((await POST(frequencyRequest(
      { expression: "猫", readings: ["ねこ"] },
      { contentType: "text/plain" },
    ))).status).toBe(415);
    expect((await POST(frequencyRequest(
      { expression: "猫", readings: ["ねこ"], extra: true },
    ))).status).toBe(400);
    expect((await POST(frequencyRequest(
      JSON.stringify({ expression: "猫", readings: ["ねこ"], padding: "x".repeat(5_000) }),
    ))).status).toBe(413);
    expect(remote).not.toHaveBeenCalled();
  });

  it("preserves Jiten rate-limit timing and rejects malformed successful payloads", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response("{}", {
      status: 429,
      headers: { "Retry-After": "3" },
    })));
    const limited = await POST(frequencyRequest({ expression: "川", readings: ["かわ"] }));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("3");

    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ results: {} }), { status: 200 })));
    const malformed = await POST(frequencyRequest({ expression: "川", readings: ["かわ"] }));
    expect(malformed.status).toBe(502);
    expect(malformed.headers.get("cache-control")).toBe("private, no-store");
  });
});
