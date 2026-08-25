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
    expect(payload).toMatchObject({
      examples: [
        { sentence: "本当の家族だ", title: "Fate Zero" },
        { sentence: "家族と帰る", title: "Fate Zero" },
      ],
    });
    expect(payload.examples).toHaveLength(2);
  });
});
