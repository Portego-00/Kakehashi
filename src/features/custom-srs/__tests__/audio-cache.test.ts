import { getCachedOrDownloadVocabularyAudioUri } from "../../../services/offlineVocabularyAudioService";
import { CUSTOM_VOCABULARY_WORDS } from "../catalog";
import { customVocabularySubjectId } from "../subject";
import { prefetchCustomVocabularyAudio, resolveCustomVocabularyAudioForPlayback } from "../audio-cache";

jest.mock("../../../services/offlineVocabularyAudioService", () => ({ getCachedOrDownloadVocabularyAudioUri: jest.fn(async () => "file:///cached.mp3") }));
jest.mock("../audio", () => ({ getNativeCustomVocabularyAudio: (wordId: string) => wordId === "unpublished" ? [] : [{ url: `https://audio.example/${wordId}.mp3`, content_type: "audio/mpeg" }] }));

beforeEach(() => jest.clearAllMocks());

it("does not download when the existing offline setting is disabled", async () => {
  await prefetchCustomVocabularyAudio(CUSTOM_VOCABULARY_WORDS.map((word) => word.id), { enabled: false });
  expect(getCachedOrDownloadVocabularyAudioUri).not.toHaveBeenCalled();
});

it("deduplicates and caps active-batch prefetch to 20 using isolated negative identities", async () => {
  const ids = CUSTOM_VOCABULARY_WORDS.slice(0, 30).map((word) => word.id);
  await prefetchCustomVocabularyAudio([ids[0], ...ids], { enabled: true });
  expect(getCachedOrDownloadVocabularyAudioUri).toHaveBeenCalledTimes(20);
  for (const [id] of jest.mocked(getCachedOrDownloadVocabularyAudioUri).mock.calls) expect(id).toBeLessThan(0);
});

it("stops scheduling downloads after the active batch is abandoned", async () => {
  const controller = new AbortController();
  jest.mocked(getCachedOrDownloadVocabularyAudioUri).mockImplementationOnce(async () => {
    controller.abort();
    return "file:///cached.mp3";
  });
  await prefetchCustomVocabularyAudio(CUSTOM_VOCABULARY_WORDS.map((word) => word.id), { enabled: true, signal: controller.signal });
  expect(getCachedOrDownloadVocabularyAudioUri).toHaveBeenCalledTimes(1);
});

it("caches only a published URL belonging to a known custom word", async () => {
  const word = CUSTOM_VOCABULARY_WORDS[0];
  const id = customVocabularySubjectId(word.id);
  expect(await resolveCustomVocabularyAudioForPlayback(id, { url: `https://audio.example/${word.id}.mp3` })).toBe("file:///cached.mp3");
  expect(await resolveCustomVocabularyAudioForPlayback(id, { url: "https://other.example/file.mp3" })).toBeNull();
  expect(await resolveCustomVocabularyAudioForPlayback(1, { url: `https://audio.example/${word.id}.mp3` })).toBeNull();
  expect(getCachedOrDownloadVocabularyAudioUri).toHaveBeenCalledTimes(1);
});

it("lets playback fall back to streaming if the disk cache fails", async () => {
  jest.mocked(getCachedOrDownloadVocabularyAudioUri).mockRejectedValueOnce(new Error("Disk full"));
  const word = CUSTOM_VOCABULARY_WORDS[0];
  expect(await resolveCustomVocabularyAudioForPlayback(customVocabularySubjectId(word.id), { url: `https://audio.example/${word.id}.mp3` })).toBeNull();
});
