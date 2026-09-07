import { getNativeCustomVocabularyAudio } from "../audio";
import { customVocabularyWordToDetails, customWordToSubject } from "../subject";
import { CUSTOM_VOCABULARY_WORDS } from "../catalog";

const mockAudio = {
  url: "https://audio.example/storage/v1/object/public/custom-vocabulary-audio/fixture.mp3",
  content_type: "audio/mpeg",
  metadata: { gender: "female", source_id: 1, pronunciation: "やっぱり", voice_actor_id: -1, voice_actor_name: "Shizuka", voice_description: "AI-generated Japanese pronunciation" },
};
jest.mock("../../../../web/src/features/custom-srs/audio-manifest", () => ({
  getCustomVocabularyAudio: (wordId: string, baseUrl?: string) => wordId === "conversation-yappari" && baseUrl === "https://audio.example" ? [mockAudio] : [],
}));
const originalHost = process.env.EXPO_PUBLIC_CUSTOM_VOCABULARY_AUDIO_SUPABASE_URL;
afterEach(() => {
  if (originalHost === undefined) delete process.env.EXPO_PUBLIC_CUSTOM_VOCABULARY_AUDIO_SUPABASE_URL;
  else process.env.EXPO_PUBLIC_CUSTOM_VOCABULARY_AUDIO_SUPABASE_URL = originalHost;
});

it("does not fall back to the general Supabase host when audio is not enabled", () => {
  delete process.env.EXPO_PUBLIC_CUSTOM_VOCABULARY_AUDIO_SUPABASE_URL;
  expect(getNativeCustomVocabularyAudio("conversation-yappari")).toEqual([]);
});

it("adapts published recordings for native lessons, reviews and details without a kana Reading tab", () => {
  process.env.EXPO_PUBLIC_CUSTOM_VOCABULARY_AUDIO_SUPABASE_URL = "https://audio.example";
  const word = CUSTOM_VOCABULARY_WORDS.find((entry) => entry.id === "conversation-yappari")!;
  const subject = customWordToSubject(word);
  expect(subject.id).toBeLessThan(0);
  expect(subject.data.readings).toEqual([]);
  expect(subject.data.pronunciation_audios).toEqual([mockAudio]);
  expect(customVocabularyWordToDetails(word).audioFiles).toEqual([mockAudio]);
  expect(getNativeCustomVocabularyAudio("unpublished")).toEqual([]);
});
