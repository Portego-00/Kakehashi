import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_STUDY_FILTERS } from "./engine";
import { streamAnimeContext } from "./immersion";
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

describe("progressive anime listening context", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("yields the first playable item, then waits and retries the rate-limited remainder", async () => {
    const responses = [
      new Response(JSON.stringify({ examples: [{ sentence: "猫が好きです。", translation: "I like cats.", title: "First anime", audio: "https://example.com/cat.mp3", imageUrl: "https://example.com/cat.jpg" }] }), { status: 200 }),
      new Response(JSON.stringify({ error: "Slow down" }), { status: 429, headers: { "Retry-After": "0" } }),
      new Response(JSON.stringify({ examples: [{ sentence: "犬が好きです。", translation: "I like dogs.", title: "Second anime", audio: "https://example.com/dog.mp3", imageUrl: "https://example.com/dog.jpg" }] }), { status: 200 }),
    ];
    const fetchMock = vi.fn(async () => responses.shift() ?? new Response(null, { status: 500 }));
    const sleep = vi.fn(async () => undefined);
    vi.stubGlobal("fetch", fetchMock);

    const questions = [...listeningPair("猫", 1), ...listeningPair("犬", 2)];
    const stream = streamAnimeContext(questions, { ...DEFAULT_STUDY_FILTERS, animeSources: ["*"] }, { sleep });

    const first = await stream.next();
    expect(first.done).toBe(false);
    expect(first.value?.map((question: StudyQuestion) => question.id)).toEqual(["1:characters", "1:meaning"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await stream.next();
    expect(second.done).toBe(false);
    expect(second.value?.map((question: StudyQuestion) => question.id)).toEqual(["2:characters", "2:meaning"]);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
