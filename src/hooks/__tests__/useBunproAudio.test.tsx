import { act, renderHook } from "@testing-library/react-native";
import { useBunproAudio } from "../useBunproAudio";
import { Audio } from "../../utils/expoAvCompat";

jest.mock("../../utils/expoAvCompat", () => ({ Audio: { Sound: { createAsync: jest.fn() } } }));
function sound() { return { unloadAsync: jest.fn(async () => undefined), playAsync: jest.fn(async () => undefined), setOnPlaybackStatusUpdate: jest.fn() }; }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((yes) => { resolve = yes; }); return { promise, resolve }; }
beforeEach(() => jest.clearAllMocks());

it("discards audio that finishes loading after the question changes", async () => {
  const loaded = deferred<any>();
  const stale = sound();
  jest.mocked(Audio.Sound.createAsync).mockReturnValue(loaded.promise);
  const { result } = renderHook(() => useBunproAudio());
  let playback!: Promise<void>;
  await act(async () => { playback = result.current.play("question-1", ["https://example.com/1.mp3"]); });
  await act(async () => { await result.current.stop(); });
  await act(async () => { loaded.resolve({ sound: stale }); await playback; });
  expect(stale.playAsync).not.toHaveBeenCalled();
  expect(stale.unloadAsync).toHaveBeenCalledTimes(1);
  expect(result.current.playingKey).toBeNull();
});

it("a stale load cannot interrupt a later question's sound", async () => {
  const firstLoad = deferred<any>();
  const stale = sound();
  const current = sound();
  jest.mocked(Audio.Sound.createAsync).mockReturnValueOnce(firstLoad.promise).mockResolvedValueOnce({ sound: current } as any);
  const { result } = renderHook(() => useBunproAudio());
  let firstPlayback!: Promise<void>;
  await act(async () => { firstPlayback = result.current.play("one", ["https://example.com/1.mp3"]); });
  await act(async () => { await result.current.play("two", ["https://example.com/2.mp3"]); });
  await act(async () => { firstLoad.resolve({ sound: stale }); await firstPlayback; });
  expect(current.playAsync).toHaveBeenCalledTimes(1);
  expect(current.unloadAsync).not.toHaveBeenCalled();
  expect(stale.playAsync).not.toHaveBeenCalled();
  expect(result.current.playingKey).toBe("two");
});

it("cancels in-flight loading on unmount before any audio can play", async () => {
  const loaded = deferred<any>();
  const stale = sound();
  jest.mocked(Audio.Sound.createAsync).mockReturnValue(loaded.promise);
  const { result, unmount } = renderHook(() => useBunproAudio());
  let playback!: Promise<void>;
  await act(async () => { playback = result.current.play("one", ["https://example.com/1.mp3"]); });
  unmount();
  await act(async () => { loaded.resolve({ sound: stale }); await playback; });
  expect(stale.playAsync).not.toHaveBeenCalled();
  expect(stale.unloadAsync).toHaveBeenCalledTimes(1);
});

it("plays both voices in sequence and remains busy until the last one finishes", async () => {
  const first = sound(); const second = sound();
  jest.mocked(Audio.Sound.createAsync).mockResolvedValueOnce({ sound: first } as any).mockResolvedValueOnce({ sound: second } as any);
  const { result } = renderHook(() => useBunproAudio());
  await act(async () => { await result.current.play("q1", ["female.mp3", "male.mp3"], true); });
  expect(first.playAsync).toHaveBeenCalledTimes(1);
  await act(async () => first.setOnPlaybackStatusUpdate.mock.calls[0][0]({ isLoaded: true, didJustFinish: true }));
  expect(second.playAsync).toHaveBeenCalledTimes(1);
  await act(async () => first.setOnPlaybackStatusUpdate.mock.calls[0][0]({ isLoaded: true, didJustFinish: true }));
  expect(Audio.Sound.createAsync).toHaveBeenCalledTimes(2);
  expect(result.current.playingKey).toBe("q1");
  await act(async () => second.setOnPlaybackStatusUpdate.mock.calls[0][0]({ isLoaded: true, didJustFinish: true }));
  expect(result.current.playingKey).toBeNull();
});

it("times out a stalled load and discards it if it eventually arrives", async () => {
  jest.useFakeTimers();
  try {
    const loaded = deferred<any>();
    const stale = sound();
    jest.mocked(Audio.Sound.createAsync).mockReturnValueOnce(loaded.promise);
    const { result } = renderHook(() => useBunproAudio());
    let playback!: Promise<void>;
    await act(async () => { playback = result.current.play("slow", ["slow.mp3"]); });
    act(() => jest.advanceTimersByTime(15000));
    expect(result.current.loadingKey).toBeNull();
    expect(result.current.error).toMatch(/timed out/);
    await act(async () => { loaded.resolve({ sound: stale }); await playback; });
    expect(stale.playAsync).not.toHaveBeenCalled();
    expect(stale.unloadAsync).toHaveBeenCalledTimes(1);
  } finally { jest.useRealTimers(); }
});

it("reports unavailable audio instead of leaving auto-advance waiting forever", async () => {
  jest.mocked(Audio.Sound.createAsync).mockRejectedValue(new Error("Unavailable"));
  const { result } = renderHook(() => useBunproAudio());
  await act(async () => { await result.current.play("q1", ["missing.mp3"]); });
  expect(result.current.error).toMatch(/could not be played/);
  expect(result.current.playingKey).toBeNull();
  expect(result.current.loadingKey).toBeNull();
});
