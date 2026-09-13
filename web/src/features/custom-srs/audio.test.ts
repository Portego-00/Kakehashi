import { afterEach, describe, expect, it, vi } from "vitest";
import { customVocabularyAudio } from "./audio";
import publication from "./audio-publication.generated.json";
import { CUSTOM_VOCABULARY_PACKS } from "./catalog";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("web custom vocabulary audio configuration", () => {
  it("plays published audio without optional build configuration and ignores unrelated Supabase configuration", () => {
    vi.stubEnv("NEXT_PUBLIC_CUSTOM_VOCABULARY_AUDIO_SUPABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://unrelated.supabase.co");
    expect(customVocabularyAudio("conversation-douzo")).toEqual([expect.objectContaining({
      url: `https://zcvoxqcvobgvcwcrqytz.supabase.co/storage/v1/object/public/custom-vocabulary-audio/${publication.entries["conversation-douzo"].objectPath}`,
    })]);
  });

  it("passes only the public project origin to the shared publication lookup", () => {
    vi.stubEnv("NEXT_PUBLIC_CUSTOM_VOCABULARY_AUDIO_SUPABASE_URL", "https://audio.supabase.co");
    expect(customVocabularyAudio("conversation-douzo")[0]?.url).toBe(`https://audio.supabase.co/storage/v1/object/public/custom-vocabulary-audio/${publication.entries["conversation-douzo"].objectPath}`);
  });

  it("uses the released origin for an empty optional override", () => {
    vi.stubEnv("NEXT_PUBLIC_CUSTOM_VOCABULARY_AUDIO_SUPABASE_URL", "");
    expect(customVocabularyAudio("conversation-douzo")[0]?.url).toContain("https://zcvoxqcvobgvcwcrqytz.supabase.co/");
  });

  it("has a published recording for every word in every pack without configuring credentials", () => {
    vi.stubEnv("NEXT_PUBLIC_CUSTOM_VOCABULARY_AUDIO_SUPABASE_URL", undefined);
    const words = CUSTOM_VOCABULARY_PACKS.flatMap((pack) => pack.words);
    expect(words).toHaveLength(565);
    for (const word of words) {
      const recordings = customVocabularyAudio(word.id);
      expect(recordings, word.id).toHaveLength(1);
      expect(recordings[0].metadata.pronunciation).toBe(word.reading);
    }
    expect(customVocabularyAudio("not-published")).toEqual([]);
  });

  it("does not silently replace an invalid explicit origin", () => {
    vi.stubEnv("NEXT_PUBLIC_CUSTOM_VOCABULARY_AUDIO_SUPABASE_URL", "https://user:secret@example.com");
    expect(customVocabularyAudio("conversation-douzo")).toEqual([]);
  });
});
