import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_STUDY_FILTERS } from "./engine";
import { fetchImmersionExamples, streamAnimeContext } from "./immersion";
import type { StudyQuestion } from "./types";

function listeningPair(characters: string, subjectId: number): StudyQuestion[] {
  const base = {
    subjectId,
    subjectType: "vocabulary" as const,
    prompt: characters,
    promptLabel: "Listening",
    characters,
    audioUrl: "https://example.com/wanikani.mp3",
  };
  return [
    { ...base, id: `${subjectId}:characters`, kind: "listening-characters", acceptedAnswers: [characters], displayAnswer: characters },
    { ...base, id: `${subjectId}:meaning`, kind: "listening-meaning", acceptedAnswers: [`Meaning ${subjectId}`], displayAnswer: `Meaning ${subjectId}` },
  ];
}

describe("ImmersionKit browser transport", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("bypasses the production server proxy and normalizes the public API response in the browser", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(async (input) => {
      const url = String(input);
      if (url === "/api/study/immersion") {
        return new Response(JSON.stringify({ error: "ImmersionKit returned 403." }), { status: 502 });
      }
      if (url.endsWith("/index_meta")) {
        return new Response(JSON.stringify({ data: {
          fate_zero: { title: "Fate Zero", category: "anime" },
          skyrim: { title: "Skyrim", category: "games" },
          death_note: { title: "Death Note", category: "anime" },
        } }), { status: 200 });
      }
      if (url.startsWith("https://apiv2.immersionkit.com/search?")) {
        return new Response(JSON.stringify({ examples: [
          { id: "anime_1", sentence: "本当の家族だ", translation: "A real family.", title: "fate_zero", image: "one frame.jpg", sound: "one clip.mp3" },
          { id: "anime_1", sentence: "本当の家族だ", translation: "A duplicate.", title: "fate_zero", image: "duplicate.jpg", sound: "one clip.mp3" },
          { id: "games_1", sentence: "家族はいない", translation: "No family.", title: "skyrim", image: "game.jpg", sound: "game.mp3" },
          { id: "anime_2", sentence: "家族です", translation: "It is family.", title: "death_note", image: "other.jpg", sound: "other.mp3" },
        ] }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchImmersionExamples("家族", ["fate_zero", "skyrim"], controller.signal)).resolves.toEqual([
      {
        sentence: "本当の家族だ",
        translation: "A real family.",
        title: "Fate Zero",
        audio: "https://immersionkit.s3.bhs.io.cloud.ovh.net/media/anime/Fate%20Zero/media/one%20clip.mp3",
        imageUrl: "https://immersionkit.s3.bhs.io.cloud.ovh.net/media/anime/Fate%20Zero/media/one%20frame.jpg",
      },
    ]);
    const calls = fetchMock.mock.calls.map(([input, init]) => ({ url: String(input), init }));
    expect(calls.map(({ url }) => url)).not.toContain("/api/study/immersion");
    const searchCall = calls.find(({ url }) => url.startsWith("https://apiv2.immersionkit.com/search?"));
    expect(Object.fromEntries(new URL(searchCall!.url).searchParams)).toEqual({ q: "家族", exactMatch: "true", limit: "50", offset: "0" });
    expect(searchCall?.init).toEqual(expect.objectContaining({
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    }));
    expect(searchCall?.init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("uses the same-origin route only when the browser cannot reach the public API", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/index_meta")) return new Response(JSON.stringify({ data: {} }), { status: 200 });
      if (url.startsWith("https://apiv2.immersionkit.com/search?")) throw new TypeError("Failed to fetch");
      if (url === "/api/study/immersion") {
        return new Response(JSON.stringify({ examples: [{ sentence: "家族です", translation: "It is family.", title: "Fallback Anime" }] }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchImmersionExamples("家族", ["*"])).resolves.toEqual([
      { sentence: "家族です", translation: "It is family.", title: "Fallback Anime" },
    ]);
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toContain("/api/study/immersion");
  });

  it("preserves direct HTTP failures without retrying through the blocked server route", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/index_meta")) return new Response(JSON.stringify({ data: {} }), { status: 200 });
      if (url.startsWith("https://apiv2.immersionkit.com/search?")) {
        return new Response(JSON.stringify({ error: "Slow down" }), { status: 429, headers: { "Retry-After": "3" } });
      }
      return new Response(null, { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchImmersionExamples("家族", ["*"])).rejects.toMatchObject({ status: 429, retryAfterMs: 3_000 });
    expect(fetchMock.mock.calls.map(([input]) => String(input))).not.toContain("/api/study/immersion");
  });

  it("does not mask an invalid public API response with the server fallback", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/index_meta")) return new Response(JSON.stringify({ data: {} }), { status: 200 });
      if (url.startsWith("https://apiv2.immersionkit.com/search?")) return new Response("not json", { status: 200 });
      return new Response(null, { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchImmersionExamples("家族", ["*"])).rejects.toBeInstanceOf(SyntaxError);
    expect(fetchMock.mock.calls.map(([input]) => String(input))).not.toContain("/api/study/immersion");
  });

  it("does not start the fallback route after the caller cancels a direct request", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      if (url.endsWith("/index_meta")) return Promise.resolve(new Response(JSON.stringify({ data: {} }), { status: 200 }));
      if (url.startsWith("https://apiv2.immersionkit.com/search?")) {
        return new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true }));
      }
      return Promise.resolve(new Response(null, { status: 500 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = fetchImmersionExamples("家族", ["*"], controller.signal);
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock.mock.calls.map(([input]) => String(input))).not.toContain("/api/study/immersion");
  });

  it("does not contact either service when anime context is disabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchImmersionExamples("家族", ["!"])).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the real folder during an index outage and recovers updated metadata on the next lookup", async () => {
    let indexCalls = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/index_meta")) {
        if (++indexCalls === 1) return new Response(null, { status: 503 });
        return Response.json({ data: { frieren_beyond_journey_s_end: { title: "Updated folder", category: "anime" } } });
      }
      expect(new URL(url).searchParams.get("index")).toBe("frieren_beyond_journey_s_end");
      return Response.json({ examples: [{ id: "anime_1", title: "frieren_beyond_journey_s_end", sentence: "十分すぎるか", translation: "There's more than enough.", image: "frame.jpg", sound: "clip.mp3" }] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const sources = ["frieren_beyond_journey_s_end"];
    await expect(fetchImmersionExamples("十分", sources)).resolves.toEqual([expect.objectContaining({
      imageUrl: "https://immersionkit.s3.bhs.io.cloud.ovh.net/media/anime/Frieren%20Beyond%20Journey's%20End/media/frame.jpg",
      audio: "https://immersionkit.s3.bhs.io.cloud.ovh.net/media/anime/Frieren%20Beyond%20Journey's%20End/media/clip.mp3",
    })]);
    await expect(fetchImmersionExamples("十分", sources)).resolves.toEqual([expect.objectContaining({ title: "Updated folder" })]);
  });
});

describe("progressive anime listening context", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("finds a later playable scene and can use an audio-only result", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/index_meta")) return new Response(null, { status: 503 });
      const word = new URL(url).searchParams.get("q");
      return Response.json({ examples: [
        { id: "anime_1", title: "death_note", sentence: "猫だ", translation: "A cat.", image: "cat.jpg" },
        { id: "anime_2", title: "death_note", sentence: "猫の声", translation: "The sound of a cat.", sound: "cat.mp3" },
        { id: "anime_3", title: "death_note", sentence: "猫が来た。", translation: "A cat came.", image: "arrival.jpg", sound: "arrival.mp3" },
        ...(word === "犬" ? [{ id: "anime_4", title: "death_note", sentence: "犬が来た。", translation: "A dog came.", sound: "dog.mp3" }] : []),
      ] });
    }));
    const stream = streamAnimeContext([...listeningPair("猫", 1), ...listeningPair("犬", 2)], DEFAULT_STUDY_FILTERS);

    const cats = (await stream.next()).value as StudyQuestion[];
    expect(cats).toHaveLength(2);
    expect(cats[0]).toMatchObject({ audioUrl: expect.stringMatching(/arrival\.mp3$/), imageUrl: expect.stringMatching(/arrival\.jpg$/) });
    const dogs = (await stream.next()).value as StudyQuestion[];
    expect(dogs).toHaveLength(2);
    expect(dogs[0]).toMatchObject({ audioUrl: expect.stringMatching(/dog\.mp3$/), imageUrl: undefined });
  });

  it("yields the first playable item, then waits and retries the rate-limited remainder", async () => {
    let searchRequests = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/index_meta")) return new Response(JSON.stringify({ data: {
        first_anime: { title: "First anime", category: "anime" },
        second_anime: { title: "Second anime", category: "anime" },
      } }), { status: 200 });
      if (!url.startsWith("https://apiv2.immersionkit.com/search?")) return new Response(null, { status: 500 });
      searchRequests += 1;
      if (searchRequests === 1) return new Response(JSON.stringify({ examples: [{ id: "anime_1", sentence: "猫が好きです。", translation: "I like cats.", title: "first_anime", sound: "cat.mp3", image: "cat.jpg" }] }), { status: 200 });
      if (searchRequests === 2) return new Response(JSON.stringify({ error: "Slow down" }), { status: 429, headers: { "Retry-After": "0" } });
      return new Response(JSON.stringify({ examples: [{ id: "anime_2", sentence: "犬が好きです。", translation: "I like dogs.", title: "second_anime", sound: "dog.mp3", image: "dog.jpg" }] }), { status: 200 });
    });
    const sleep = vi.fn(async () => undefined);
    vi.stubGlobal("fetch", fetchMock);

    const questions = [...listeningPair("猫", 1), ...listeningPair("犬", 2)];
    const stream = streamAnimeContext(questions, { ...DEFAULT_STUDY_FILTERS, animeSources: ["*"] }, { sleep });

    const first = await stream.next();
    expect(first.done).toBe(false);
    expect(first.value?.map((question: StudyQuestion) => question.id)).toEqual(["1:characters", "1:meaning"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const second = await stream.next();
    expect(second.done).toBe(false);
    expect(second.value?.map((question: StudyQuestion) => question.id)).toEqual(["2:characters", "2:meaning"]);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.map(([input]) => String(input))).not.toContain("/api/study/immersion");
  });
});
