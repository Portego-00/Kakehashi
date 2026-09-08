import { afterEach, describe, expect, it, vi } from "vitest";
import { customVocabularyAudio } from "./audio";

const lookup = vi.hoisted(() => vi.fn(() => []));
vi.mock("./audio-manifest", () => ({ getCustomVocabularyAudio: lookup }));

afterEach(() => {
  vi.unstubAllEnvs();
  lookup.mockClear();
});

describe("web custom vocabulary audio configuration", () => {
  it("requires the explicit public audio origin instead of using unrelated Supabase configuration", () => {
    vi.stubEnv("NEXT_PUBLIC_CUSTOM_VOCABULARY_AUDIO_SUPABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://unrelated.supabase.co");
    customVocabularyAudio("kana-cat");
    expect(lookup).toHaveBeenCalledWith("kana-cat", undefined);
  });

  it("passes only the public project origin to the shared publication lookup", () => {
    vi.stubEnv("NEXT_PUBLIC_CUSTOM_VOCABULARY_AUDIO_SUPABASE_URL", "https://audio.supabase.co");
    customVocabularyAudio("kana-cat");
    expect(lookup).toHaveBeenCalledWith("kana-cat", "https://audio.supabase.co");
  });
});
