import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { clearRateLimitsForTests } from "@/lib/server/rate-limit";
import { POST } from "./route";

function request(body: unknown, origin = "http://localhost:3100") {
  return new Request("http://localhost:3100/news/analyze", {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost:3100", origin, "x-forwarded-for": "203.0.113.22" },
    body: JSON.stringify(body),
  });
}

describe("JPDB news analysis route", () => {
  beforeEach(() => clearRateLimitsForTests());
  afterEach(() => vi.unstubAllGlobals());

  it("normalizes JPDB tuples without exposing the API key", async () => {
    const remote = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      tokens: [[[0, 0, 2, [["学校", "がっこう"]]], [1, 2, 1, null]]],
      vocabulary: [["学校", "がっこう", ["n"], [["school"], ["academy"]], ["學校"]], ["へ", "へ", ["prt"], [["to"]], []]],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", remote);
    const response = await POST(request({ text: "学校へ", apiKey: "private-key" }));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ provider: "jpdb", tokens: [
      { start: 0, end: 2, surface: "学校", spelling: "学校", reading: "がっこう", surfaceReading: "がっこう", meaning: "school", meanings: ["school", "academy"], alternativeSpellings: ["學校"], partsOfSpeech: ["n"], tokenType: "vocabulary" },
      { start: 2, end: 3, surface: "へ", spelling: "へ", reading: "へ", surfaceReading: "へ", meaning: "to", meanings: ["to"], alternativeSpellings: [], partsOfSpeech: ["prt"], tokenType: "grammar" },
    ] });
    expect(remote).toHaveBeenCalledWith("https://jpdb.io/api/v1/parse", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer private-key" }) }));
    const remoteBody = JSON.parse(String(remote.mock.calls[0]?.[1]?.body));
    expect(remoteBody.token_fields).toContain("furigana");
    expect(remoteBody.vocabulary_fields).toContain("alt_spellings");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(JSON.stringify(payload)).not.toContain("private-key");
  });

  it("uses JPDB token furigana for an inflected surface reading", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      tokens: [[[0, 0, 5, [["触", "ふ"], "れさせて"]]]],
      vocabulary: [["触れる", "ふれる", ["v1", "vt"], [["to touch"]], []]],
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const response = await POST(request({ text: "触れさせて", apiKey: "private-key" }));
    const payload = await response.json();

    expect(payload.tokens[0]).toEqual(expect.objectContaining({
      surface: "触れさせて",
      spelling: "触れる",
      reading: "ふれる",
      surfaceReading: "ふれさせて",
    }));
  });

  it("falls back to the dictionary reading when JPDB furigana does not match the selected surface", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      tokens: [[[0, 0, 5, [["別", "べつ"]]]]],
      vocabulary: [["触れる", "ふれる", ["v1", "vt"], [["to touch"]], []]],
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const response = await POST(request({ text: "触れさせて", apiKey: "private-key" }));
    const payload = await response.json();

    expect(payload.tokens[0]).toEqual(expect.objectContaining({
      reading: "ふれる",
      surfaceReading: "ふれる",
    }));
  });

  it("requires a same-origin request and a configured key", async () => {
    expect((await POST(request({ text: "日本語", apiKey: "key" }, "https://attacker.example"))).status).toBe(403);
    expect((await POST(request({ text: "日本語" }))).status).toBe(409);
  });

  it("corrects a kana homophone to a particle when the sentence context is grammatical", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      tokens: [[[0, 0, 1], [1, 1, 1], [2, 2, 4]]],
      vocabulary: [
        ["水", "みず", ["n"], [["water"]], []],
        ["我", "が", ["n"], [["I", "me"]], []],
        ["溢れる", "あふれる", ["v1", "vi"], [["to overflow"]], []],
      ],
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const response = await POST(request({ text: "水があふれる", apiKey: "private-key" }));
    const payload = await response.json();

    expect(payload.tokens[1]).toEqual(expect.objectContaining({
      surface: "が",
      spelling: "が",
      reading: "が",
      meaning: "marks the grammatical subject",
      meanings: ["marks the grammatical subject", "but; however"],
      partsOfSpeech: ["prt"],
      tokenType: "grammar",
    }));
  });
});
