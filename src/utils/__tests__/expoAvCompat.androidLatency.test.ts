import { Audio } from "../expoAvCompat";
import { resolveOfflineVocabularyAudioUri } from "../../services/offlineVocabularyAudioService";
import { createAudioPlayer } from "expo-audio";

// Android's expo-audio getters use runOnMain: a synchronous read waits for the
// UI thread. Charge a fixed delay for that boundary to reproduce a busy phone
// deterministically, without depending on this computer's speed.
let mockNativeWaitMs = 0;
let mockVolume = 1;
let mockStatusListener: ((status: typeof mockStatus) => void) | undefined;
const mockStatus = {
  id: 1,
  isLoaded: true,
  playing: true,
  isBuffering: false,
  playbackRate: 1,
  shouldCorrectPitch: false,
  mute: false,
  loop: false,
  didJustFinish: false,
  currentTime: 0,
  duration: 1,
  playbackState: "ready",
  timeControlStatus: "playing",
  reasonForWaitingToPlay: null,
};
const mockPlayer = {
  get currentStatus() {
    mockNativeWaitMs += 250;
    return mockStatus;
  },
  get volume() {
    mockNativeWaitMs += 250;
    return mockVolume;
  },
  set volume(value: number) { mockVolume = value; },
  play: jest.fn(),
  pause: jest.fn(),
  remove: jest.fn(),
  seekTo: jest.fn(async () => {}),
  addListener: jest.fn((_event, listener) => {
    mockStatusListener = listener;
    return { remove: jest.fn() };
  }),
};

jest.mock("expo-audio", () => ({
  createAudioPlayer: jest.fn(() => mockPlayer),
  setAudioModeAsync: jest.fn(async () => {}),
}));
jest.mock("react-native", () => ({ Platform: { OS: "android" } }));
jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///documents/",
  getInfoAsync: jest.fn(async () => ({ exists: true, isDirectory: false })),
}));
jest.mock("expo-sqlite", () => ({}));
jest.mock("../cache", () => ({}));
jest.mock("../permanentStorage", () => ({}));

describe("cached Android pronunciation responsiveness", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNativeWaitMs = 0;
    mockVolume = 1;
    mockStatusListener = undefined;
  });

  it("does not multiply UI-thread waits when starting a cached lesson recording", async () => {
    const uri = await resolveOfflineVocabularyAudioUri(123, {
      url: "https://audio.example/reading.mp3",
    });
    expect(uri).toMatch(/^file:\/\/\/documents\/offline-vocabulary-audio\//);
    const { sound } = await Audio.Sound.createAsync({ uri: uri! }, { shouldPlay: true });
    // The lesson attaches this callback after createAsync resolves.
    const onStatus = jest.fn();
    sound.setOnPlaybackStatusUpdate(onStatus);
    await Promise.resolve();

    expect(mockPlayer.play).toHaveBeenCalled();
    expect(createAudioPlayer).toHaveBeenCalledWith({ uri }, expect.any(Object));
    expect(onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ isPlaying: true }));
    expect(mockNativeWaitMs).toBeLessThanOrEqual(250);
    await sound.unloadAsync();
  });

  it("keeps playback progress callbacks off the synchronous native boundary", async () => {
    const { sound } = await Audio.Sound.createAsync({ uri: "file:///cached.mp3" });
    const onStatus = jest.fn();
    sound.setOnPlaybackStatusUpdate(onStatus);
    await Promise.resolve();
    mockNativeWaitMs = 0;

    mockStatusListener?.({ ...mockStatus, currentTime: 0.1 });

    expect(onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ positionMillis: 100 }));
    expect(mockNativeWaitMs).toBe(0);
    await sound.unloadAsync();
  });

  it("delivers configured volume and finish/unload events without additional native reads", async () => {
    const { sound } = await Audio.Sound.createAsync(
      { uri: "file:///cached.mp3" },
      { shouldPlay: true, volume: 0.4 },
    );
    const onStatus = jest.fn();
    sound.setOnPlaybackStatusUpdate(onStatus);
    await Promise.resolve();
    mockNativeWaitMs = 0;

    mockStatusListener?.({ ...mockStatus, playing: false, didJustFinish: true });
    expect(onStatus).toHaveBeenLastCalledWith(expect.objectContaining({
      volume: 0.4,
      isPlaying: false,
      didJustFinish: true,
    }));
    await sound.unloadAsync();
    expect(onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ isLoaded: false }));
    expect(mockNativeWaitMs).toBe(0);
  });
});
