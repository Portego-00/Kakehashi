import { getNativeCustomVocabularyAudio } from "../audio";
import { customVocabularyWordToDetails, customWordToSubject } from "../subject";
import { CUSTOM_VOCABULARY_WORDS } from "../catalog";

import publication from "../../../../web/src/features/custom-srs/audio-publication.generated.json";
const originalHost = process.env.EXPO_PUBLIC_CUSTOM_VOCABULARY_AUDIO_SUPABASE_URL;
afterEach(() => {
  if (originalHost === undefined) delete process.env.EXPO_PUBLIC_CUSTOM_VOCABULARY_AUDIO_SUPABASE_URL;
  else process.env.EXPO_PUBLIC_CUSTOM_VOCABULARY_AUDIO_SUPABASE_URL = originalHost;
});

it("plays the published release without an audio-origin override", () => {
  delete process.env.EXPO_PUBLIC_CUSTOM_VOCABULARY_AUDIO_SUPABASE_URL;
  expect(getNativeCustomVocabularyAudio("conversation-yappari")[0]?.url).toBe(`https://zcvoxqcvobgvcwcrqytz.supabase.co/storage/v1/object/public/custom-vocabulary-audio/${publication.entries["conversation-yappari"].objectPath}`);
});

it("adapts published recordings for native lessons, reviews and details without a kana Reading tab", () => {
  process.env.EXPO_PUBLIC_CUSTOM_VOCABULARY_AUDIO_SUPABASE_URL = "https://audio.example";
  const word = CUSTOM_VOCABULARY_WORDS.find((entry) => entry.id === "conversation-yappari")!;
  const subject = customWordToSubject(word);
  const audio = getNativeCustomVocabularyAudio(word.id);
  expect(audio).toHaveLength(1);
  expect(audio[0].url).toBe(`https://audio.example/storage/v1/object/public/custom-vocabulary-audio/${publication.entries[word.id as keyof typeof publication.entries].objectPath}`);
  expect(subject.id).toBeLessThan(0);
  expect(subject.data.readings).toEqual([]);
  expect(subject.data.pronunciation_audios).toEqual(audio);
  expect(customVocabularyWordToDetails(word).audioFiles).toEqual(audio);
  expect(getNativeCustomVocabularyAudio("unpublished")).toEqual([]);
});

it("does not silently substitute an invalid explicit audio origin", () => {
  process.env.EXPO_PUBLIC_CUSTOM_VOCABULARY_AUDIO_SUPABASE_URL = "https://example.com/?secret=value";
  expect(getNativeCustomVocabularyAudio("conversation-yappari")).toEqual([]);
});

it("resolves every published word when the optional override is blank", () => {
  process.env.EXPO_PUBLIC_CUSTOM_VOCABULARY_AUDIO_SUPABASE_URL = "";
  expect(CUSTOM_VOCABULARY_WORDS).toHaveLength(565);
  for (const word of CUSTOM_VOCABULARY_WORDS) {
    const recordings = getNativeCustomVocabularyAudio(word.id);
    expect(recordings).toHaveLength(1);
    expect(recordings[0].metadata.pronunciation).toBe(word.reading);
  }
});
