import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

afterEach(() => vi.unstubAllGlobals());

describe("immersion source selection", () => {
  it("returns no example without calling ImmersionKit when no anime are selected", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(new Request("http://localhost/api/study/immersion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "日本", sources: ["!"] }),
    }));
    await expect(response.json()).resolves.toEqual({ example: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns every matching scene instead of discarding all but one", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/index_meta")) {
        return new Response(JSON.stringify({ data: { fate_zero: { title: "Fate Zero", category: "anime" }, skyrim: { title: "Skyrim", category: "games" } } }), { status: 200 });
      }
      return new Response(JSON.stringify({ examples: [
        { id: "anime_1", sentence: "本当の家族だ", translation: "A real family.", title: "fate_zero", image: "one.jpg", sound: "one.mp3" },
        { id: "anime_2", sentence: "家族と帰る", translation: "Go home with family.", title: "fate_zero", image: "two.jpg", sound: "two.mp3" },
        { id: "games_1", sentence: "家族はいない", translation: "No family.", title: "skyrim", image: "game.jpg", sound: "game.mp3" },
      ] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(new Request("http://localhost/api/study/immersion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "家族", sources: ["*"] }),
    }));

    const payload = await response.json();
    expect(payload.examples).toEqual(expect.arrayContaining([
      expect.objectContaining({ sentence: "本当の家族だ", title: "Fate Zero" }),
      expect.objectContaining({ sentence: "家族と帰る", title: "Fate Zero" }),
    ]));
    expect(payload.examples).toHaveLength(2);
  });

  it("caps the buffered scene list at the same fifty examples used by mobile", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      if (String(input).endsWith("/index_meta")) return new Response(JSON.stringify({ data: {} }), { status: 200 });
      return new Response(JSON.stringify({ examples: Array.from({ length: 72 }, (_, index) => ({
        id: `anime_example_${index}`,
        sentence: `家族の例${index}`,
        translation: `Family example ${index}`,
        title: "fate_zero",
        image: `${index}.jpg`,
      })) }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(new Request("http://localhost/api/study/immersion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "家族", sources: ["*"] }),
    }));

    const payload = await response.json();
    expect(payload.examples).toHaveLength(50);
  });

  it("preserves ImmersionKit rate-limit timing for progressive client retries", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      if (String(input).endsWith("/index_meta")) return new Response(JSON.stringify({ data: {} }), { status: 200 });
      return new Response(JSON.stringify({ error: "Too many requests" }), { status: 429, headers: { "Retry-After": "3" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(new Request("http://localhost/api/study/immersion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "家族", sources: ["*"] }),
    }));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("3");
  });
});
