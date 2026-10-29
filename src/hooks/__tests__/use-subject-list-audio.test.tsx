import { act, renderHook } from "@testing-library/react-native";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import type { AudioStatus } from "expo-audio";
import { AppState } from "react-native";
import { resolveOfflineVocabularyAudioUri } from "../../services/offlineVocabularyAudioService";
import type { Subject } from "../../utils/api";
import { useSubjectListAudio } from "../use-subject-list-audio";

jest.mock("expo-audio", () => ({ createAudioPlayer: jest.fn(), setAudioModeAsync: jest.fn() }));
jest.mock("../../services/offlineVocabularyAudioService", () => ({ resolveOfflineVocabularyAudioUri: jest.fn() }));

const female = { url: "female.mp3", content_type: "audio/mpeg", metadata: { voice_actor_name: "Kyoko", gender: "female", pronunciation: "に" } };
const male = { url: "male.mp3", content_type: "audio/mpeg", metadata: { voice_actor_name: "Kenichi", gender: "male", pronunciation: "に" } };
const subject: Subject = {
  id: 2, object: "vocabulary", url: "", data_updated_at: "2026-10-20T00:00:00Z",
  data: {
    created_at: "2026-10-20T00:00:00Z", hidden_at: null, document_url: "", character_images: null,
    slug: "二", characters: "二", level: 1,
    meanings: [{ meaning: "Two", primary: true, accepted_answer: true }],
    readings: [{ reading: "に", type: "onyomi", primary: true, accepted_answer: true }],
    pronunciation_audios: [female, male], auxiliary_meanings: [], parts_of_speech: [],
    component_subject_ids: [], amalgamation_subject_ids: [], visually_similar_subject_ids: [],
    meaning_mnemonic: "", meaning_hint: null, reading_mnemonic: null, reading_hint: null,
  },
};

function player() {
  let listener: (status: Partial<AudioStatus>) => void = () => undefined;
  const removeListener = jest.fn();
  return {
    play: jest.fn(), remove: jest.fn(), removeListener,
    addListener: jest.fn((_event, callback) => { listener = callback; return { remove: removeListener }; }),
    emit: (status: Partial<AudioStatus>) => listener(status),
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}
const players: ReturnType<typeof player>[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(AppState, "addEventListener").mockReturnValue({ remove: jest.fn() });
  players.length = 0;
  jest.mocked(setAudioModeAsync).mockResolvedValue(undefined);
  jest.mocked(resolveOfflineVocabularyAudioUri).mockResolvedValue(null);
  jest.mocked(createAudioPlayer).mockImplementation(() => {
    const sound = player();
    players.push(sound);
    return sound as unknown as ReturnType<typeof createAudioPlayer>;
  });
});

afterEach(() => jest.restoreAllMocks());

it.each(["female", "male"] as const)("uses the %s voice and its offline recording", async (voice) => {
  jest.mocked(resolveOfflineVocabularyAudioUri).mockResolvedValue("file:///cached.mp3");
  const { result } = renderHook(() => useSubjectListAudio(true));
  expect(createAudioPlayer).not.toHaveBeenCalled();
  await act(async () => { await result.current.play(subject, voice); });
  expect(resolveOfflineVocabularyAudioUri).toHaveBeenCalledWith(2, voice === "female" ? female : male);
  expect(createAudioPlayer).toHaveBeenCalledWith("file:///cached.mp3", { updateInterval: 100 });
  expect(players[0].play).toHaveBeenCalledTimes(1);
  expect(result.current.loading).toBe(true);
  act(() => players[0].emit({ isLoaded: true }));
  expect(result.current.loading).toBe(false);
  act(() => players[0].emit({ didJustFinish: true }));
  expect(players[0].remove).toHaveBeenCalledTimes(1);
  expect(players[0].removeListener).toHaveBeenCalledTimes(1);
  expect(result.current.activeSubjectId).toBeNull();
});

it("plays both voices in sequence and ignores duplicate finish events", async () => {
  const { result } = renderHook(() => useSubjectListAudio(true));
  await act(async () => { await result.current.play(subject, "both"); });
  await act(async () => players[0].emit({ didJustFinish: true }));
  expect(players).toHaveLength(2);
  expect(createAudioPlayer).toHaveBeenLastCalledWith("male.mp3", expect.anything());
  expect(result.current.activeSubjectId).toBe(2);
  act(() => players[0].emit({ didJustFinish: true }));
  expect(players).toHaveLength(2);
  act(() => players[1].emit({ didJustFinish: true }));
  expect(result.current.activeSubjectId).toBeNull();
});

it("chooses the random voice on tap and falls back to the available voice", async () => {
  const random = jest.spyOn(Math, "random").mockReturnValue(0.9);
  try {
    const { result } = renderHook(() => useSubjectListAudio(true));
    await act(async () => { await result.current.play(subject, "random"); });
    expect(createAudioPlayer).toHaveBeenLastCalledWith("male.mp3", expect.anything());
    act(() => result.current.stop());
    await act(async () => {
      await result.current.play({ ...subject, data: { ...subject.data, pronunciation_audios: [female] } }, "male");
    });
    expect(createAudioPlayer).toHaveBeenLastCalledWith("female.mp3", expect.anything());
  } finally { random.mockRestore(); }
});

it("stops on a second tap and replaces the player when another word is played", async () => {
  const { result } = renderHook(() => useSubjectListAudio(true));
  await act(async () => { await result.current.play(subject, "female"); });
  await act(async () => { await result.current.play(subject, "female"); });
  expect(players).toHaveLength(1);
  expect(players[0].remove).toHaveBeenCalledTimes(1);
  expect(result.current.activeSubjectId).toBeNull();
  await act(async () => { await result.current.play(subject, "female"); });
  await act(async () => { await result.current.play({ ...subject, id: 3 }, "male"); });
  expect(players[1].remove).toHaveBeenCalledTimes(1);
  expect(result.current.activeSubjectId).toBe(3);
});

it("discards stale cache lookups without interrupting the current word", async () => {
  const pending = deferred<string | null>();
  jest.mocked(resolveOfflineVocabularyAudioUri).mockReturnValueOnce(pending.promise);
  const { result } = renderHook(() => useSubjectListAudio(true));
  let first!: Promise<void>;
  await act(async () => { first = result.current.play(subject, "female"); });
  await act(async () => { await result.current.play({ ...subject, id: 3 }, "male"); });
  await act(async () => { pending.resolve("file:///stale.mp3"); await first; });
  expect(players).toHaveLength(1);
  expect(players[0].remove).not.toHaveBeenCalled();
  expect(result.current.activeSubjectId).toBe(3);
});

it.each(["disabled", "unmounted"])("cancels pending audio when %s", async (reason) => {
  const pending = deferred<string | null>();
  jest.mocked(resolveOfflineVocabularyAudioUri).mockReturnValueOnce(pending.promise);
  const { result, rerender, unmount } = renderHook(({ enabled }: { enabled: boolean }) => useSubjectListAudio(enabled), { initialProps: { enabled: true } });
  let playback!: Promise<void>;
  await act(async () => { playback = result.current.play(subject, "female"); });
  if (reason === "disabled") rerender({ enabled: false });
  else unmount();
  await act(async () => { pending.resolve(null); await playback; });
  expect(createAudioPlayer).not.toHaveBeenCalled();
});

it("releases playback on navigation, unmount, and backgrounding", async () => {
  const { result, rerender, unmount } = renderHook(({ enabled }: { enabled: boolean }) => useSubjectListAudio(enabled), { initialProps: { enabled: true } });
  await act(async () => { await result.current.play(subject, "female"); });
  rerender({ enabled: false });
  expect(players[0].remove).toHaveBeenCalledTimes(1);
  rerender({ enabled: true });
  await act(async () => { await result.current.play(subject, "female"); });
  act(() => jest.mocked(AppState.addEventListener).mock.calls.at(-1)?.[1]("background"));
  expect(players[1].remove).toHaveBeenCalledTimes(1);
  await act(async () => { await result.current.play(subject, "female"); });
  unmount();
  expect(players[2].remove).toHaveBeenCalledTimes(1);
});

it("reports failed or stalled playback and permits retry", async () => {
  jest.useFakeTimers();
  try {
    const { result } = renderHook(() => useSubjectListAudio(true));
    await act(async () => { await result.current.play(subject, "female"); });
    act(() => players[0].emit({ playbackState: "failed" }));
    expect(result.current.error).toMatch(/couldn’t play/);
    expect(players[0].remove).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.play(subject, "female"); });
    expect(result.current.error).toBeNull();
    act(() => jest.advanceTimersByTime(15000));
    expect(result.current.activeSubjectId).toBeNull();
    expect(result.current.error).toMatch(/couldn’t play/);
    expect(players[1].remove).toHaveBeenCalledTimes(1);
  } finally { jest.useRealTimers(); }
});

it("uses the online recording when offline lookup fails", async () => {
  jest.mocked(resolveOfflineVocabularyAudioUri).mockRejectedValue(new Error("Cache unavailable"));
  const { result } = renderHook(() => useSubjectListAudio(true));
  await act(async () => { await result.current.play(subject, "female"); });
  expect(createAudioPlayer).toHaveBeenCalledWith("female.mp3", expect.anything());
  expect(result.current.error).toBeNull();
});
