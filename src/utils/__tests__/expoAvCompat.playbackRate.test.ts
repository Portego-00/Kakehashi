import { createAudioPlayer } from "expo-audio";
import { Audio } from "../expoAvCompat";

function mockCreatePlayer() {
  let rate = 1;
  let loaded = false;
  let playing = false;
  return {
    // Match the native API: assignment cannot change playback speed.
    get playbackRate() { return rate; },
    shouldCorrectPitch: false,
    volume: 1,
    get currentStatus() {
      return {
        isLoaded: loaded, playing, playbackRate: rate,
        shouldCorrectPitch: this.shouldCorrectPitch,
        isBuffering: !loaded, mute: false, loop: false,
        didJustFinish: false, currentTime: 0, duration: 4,
      };
    },
    setPlaybackRate: jest.fn(function (this: { shouldCorrectPitch: boolean }, value: number) {
      rate = value;
      mockPitchWhenRateSet = this.shouldCorrectPitch;
    }),
    play: jest.fn(() => { playing = true; }),
    pause: jest.fn(() => { playing = false; }),
    seekTo: jest.fn(async () => {}),
    remove: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    finishLoading() { loaded = true; },
  };
}

let mockPitchWhenRateSet: boolean | undefined;
let mockPlayer: ReturnType<typeof mockCreatePlayer>;

jest.mock("expo-audio", () => ({
  createAudioPlayer: jest.fn(() => mockPlayer),
  setAudioModeAsync: jest.fn(async () => {}),
}));

describe("recorded context sentence playback speed", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPitchWhenRateSet = undefined;
    mockPlayer = mockCreatePlayer();
  });

  it.each([
    [0.5, true],
    [1.5, true],
    [0.5, false],
    [1.5, false],
  ])("retains %sx speed through loading with shouldPlay=%s", async (rate, shouldPlay) => {
    const { sound } = await Audio.Sound.createAsync(
      { uri: "https://audio.example/media-sentence.mp3" },
      { rate, shouldCorrectPitch: true, shouldPlay },
    );
    try {
      expect(mockPitchWhenRateSet).toBe(true);
      expect(mockPlayer.setPlaybackRate).toHaveBeenCalledWith(rate);
      expect(createAudioPlayer).toHaveBeenCalledTimes(1);
      mockPlayer.finishLoading();
      if (!shouldPlay) await sound.playAsync();
      expect(await sound.getStatusAsync()).toMatchObject({
        isLoaded: true, isPlaying: true, rate, shouldCorrectPitch: true,
      });
    } finally {
      await sound.unloadAsync();
    }
  });

  it("preserves the default rate when no speed was requested", async () => {
    const { sound } = await Audio.Sound.createAsync({ uri: "file:///reading.mp3" });
    try {
      mockPlayer.finishLoading();
      expect(await sound.playAsync()).toMatchObject({ rate: 1 });
      expect(mockPlayer.setPlaybackRate).not.toHaveBeenCalled();
    } finally {
      await sound.unloadAsync();
    }
  });
});
