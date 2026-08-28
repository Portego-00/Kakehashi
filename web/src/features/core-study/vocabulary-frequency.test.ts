import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchVocabularyFrequency,
  vocabularyFrequencyQueryKey,
  vocabularyFrequencyRequestForSubject,
  type VocabularyFrequencySubject,
} from "./vocabulary-frequency";

const subject: VocabularyFrequencySubject = {
  id: 42,
  object: "vocabulary",
  data: {
    characters: " 開く ",
    readings: [
      { reading: "ヒラク", accepted_answer: true },
      { reading: "ひらく", accepted_answer: true },
      { reading: "あく", accepted_answer: false },
    ],
  },
};

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("vocabulary frequency client", () => {
  it("builds a stable request from accepted WaniKani readings only", () => {
    expect(vocabularyFrequencyRequestForSubject(subject)).toEqual({
      expression: "開く",
      readings: ["ひらく"],
    });
    expect(vocabularyFrequencyQueryKey(subject)).toEqual([
      "vocabulary-frequency",
      42,
      "開く",
      "ひらく",
    ]);
  });

  it("posts to the same-origin route and validates the returned result", async () => {
    const result = {
      provider: "jiten" as const,
      frequencyRank: 1_200,
      wordId: 2,
      readingIndex: 0,
      matchedText: "開く",
      matchedReading: "ひらく",
      sourceUrl: "https://jiten.moe/search?query=%E9%96%8B%E3%81%8F",
    };
    const remote = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ result }), { status: 200 }));
    vi.stubGlobal("fetch", remote);
    const signal = new AbortController().signal;

    await expect(fetchVocabularyFrequency(subject, signal)).resolves.toEqual(result);
    expect(remote).toHaveBeenCalledWith("/api/study/vocabulary-frequency", expect.objectContaining({
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal,
    }));
    expect(JSON.parse(String(remote.mock.calls[0]?.[1]?.body))).toEqual({
      expression: "開く",
      readings: ["ひらく"],
    });
  });

  it("does not request frequency for unsupported subjects", async () => {
    const remote = vi.fn();
    vi.stubGlobal("fetch", remote);
    await expect(fetchVocabularyFrequency({ ...subject, object: "kanji" })).resolves.toBeNull();
    expect(remote).not.toHaveBeenCalled();
  });

  it("reuses found and not-found results across query clients and page reloads", async () => {
    const result = {
      provider: "jiten" as const,
      frequencyRank: 1_200,
      wordId: 2,
      readingIndex: 0,
      matchedText: "開く",
      matchedReading: "ひらく",
      sourceUrl: "https://jiten.moe/search?query=%E9%96%8B%E3%81%8F",
    };
    const foundRemote = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ result }), { status: 200 }));
    vi.stubGlobal("fetch", foundRemote);

    await expect(fetchVocabularyFrequency(subject)).resolves.toEqual(result);
    await expect(fetchVocabularyFrequency(subject)).resolves.toEqual(result);
    expect(foundRemote).toHaveBeenCalledOnce();

    window.localStorage.clear();
    const notFoundRemote = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ result: null }), { status: 200 }));
    vi.stubGlobal("fetch", notFoundRemote);
    await expect(fetchVocabularyFrequency(subject)).resolves.toBeNull();
    await expect(fetchVocabularyFrequency(subject)).resolves.toBeNull();
    expect(notFoundRemote).toHaveBeenCalledOnce();
  });
});
