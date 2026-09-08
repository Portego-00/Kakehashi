import { describe, expect, it } from "vitest";
import { customVocabularyAudioOrigin, getCustomVocabularyAudio, type CustomVocabularyAudioPublication } from "./audio-manifest";

const hash = "a".repeat(64);
const release: CustomVocabularyAudioPublication = {
  schemaVersion: 1,
  bucket: "custom-vocabulary-audio",
  voice: { name: "Shizuka", gender: "female", description: "AI-generated Japanese pronunciation", actorId: 1_500_000_001 },
  entries: {
    "conversation-douzo": { packId: "conversation-glue", reading: "どうぞ", sha256: hash, bytes: 30_000, objectPath: `v1/conversation-glue/conversation-douzo/${hash}.mp3` },
  },
};

describe("published custom vocabulary audio", () => {
  it("uses immutable CDN URLs and the existing pronunciation metadata shape", () => {
    expect(getCustomVocabularyAudio("conversation-douzo", "https://example.supabase.co", release)).toEqual([{
      url: `https://example.supabase.co/storage/v1/object/public/custom-vocabulary-audio/v1/conversation-glue/conversation-douzo/${hash}.mp3`,
      content_type: "audio/mpeg",
      metadata: { gender: "female", source_id: expect.any(Number), pronunciation: "どうぞ", voice_actor_id: 1_500_000_001, voice_actor_name: "Shizuka", voice_description: "AI-generated Japanese pronunciation" },
    }]);
  });

  it("does not enable recordings until they have been published", () => {
    expect(getCustomVocabularyAudio("unpublished-word", "https://example.supabase.co")).toEqual([]);
    expect(getCustomVocabularyAudio("unpublished-word", "https://example.supabase.co", release)).toEqual([]);
    expect(getCustomVocabularyAudio("conversation-douzo", undefined, release)).toEqual([]);
  });

  it("rejects unsafe origins and permits explicit local development", () => {
    for (const origin of ["http://example.com", "https://user:secret@example.com", "https://example.com/path", "https://example.com?key=secret", "https://example.com#fragment", "javascript:alert(1)"]) {
      expect(customVocabularyAudioOrigin(origin)).toBeNull();
    }
    expect(customVocabularyAudioOrigin("http://127.0.0.1:54321")).toBe("http://127.0.0.1:54321");
    expect(customVocabularyAudioOrigin("https://example.supabase.co/")).toBe("https://example.supabase.co");
  });

  it("rejects traversal, inherited keys, and paths not bound to the exact content hash", () => {
    expect(getCustomVocabularyAudio("__proto__", "https://example.supabase.co", release)).toEqual([]);
    expect(getCustomVocabularyAudio("../conversation-douzo", "https://example.supabase.co", release)).toEqual([]);
    const invalid = { ...release, entries: { "conversation-douzo": { ...release.entries["conversation-douzo"], objectPath: "v1/other.mp3" } } };
    expect(getCustomVocabularyAudio("conversation-douzo", "https://example.supabase.co", invalid)).toEqual([]);
  });
});
