import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

import { clearRateLimitsForTests } from "@/lib/server/rate-limit";
import { POST } from "./route";

function request(body: unknown, origin = "http://localhost:3100") {
  return new NextRequest("http://localhost:3100/video/transcript", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "localhost:3100",
      origin,
      "x-forwarded-for": "203.0.113.44",
    },
    body: JSON.stringify(body),
  });
}

describe("YouTube transcript route", () => {
  beforeEach(() => clearRateLimitsForTests());
  afterEach(() => vi.unstubAllGlobals());

  it("imports bounded timed captions from the no-key provider", async () => {
    const fetchMock = vi.fn(async () => new Response(`# Transcript: 日本語レッスン

Language: ja · Duration: 0:12 · Words: 4

[0:00] こんにちは。
[0:05] また明日。`, { headers: { "content-type": "text/markdown; charset=utf-8" } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({ videoId: "abcdefghijk", language: "ja" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      title: "日本語レッスン",
      language: "ja",
      transcript: "[0:00]こんにちは。\n[0:05]また明日。",
      cueCount: 2,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://youtube-transcript.ai/transcript/abcdefghijk.txt?lang=ja",
      expect.objectContaining({ headers: { Accept: "text/markdown,text/plain;q=0.9" } }),
    );
  });

  it("rejects invalid or cross-origin requests before contacting the provider", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect((await POST(request({ videoId: "too-short" }))).status).toBe(400);
    expect((await POST(request({ videoId: "abcdefghijk" }, "https://attacker.example"))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps videos usable when captions do not exist", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Not found", {
      status: 404,
      headers: { "content-type": "text/plain" },
    })));

    const response = await POST(request({ videoId: "abcdefghijk" }));
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ error: "No captions are available for this YouTube video." });
  });
});
