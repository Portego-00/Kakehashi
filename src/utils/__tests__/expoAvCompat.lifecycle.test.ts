import { setAudioModeAsync as setNativeAudioModeAsync } from "expo-audio";
import { Audio, type AudioSound } from "../expoAvCompat";

type PlaybackUpdate = {
  playing?: boolean;
  didJustFinish?: boolean;
  currentTime?: number;
};
const mockPlayers: { emit(update: PlaybackUpdate): void }[] = [];
let mockNextPlayerId = 0;

function mockCreatePlayer() {
  let status = {
    id: mockNextPlayerId++,
    isLoaded: true,
    playing: false,
    isBuffering: false,
    playbackRate: 1,
    shouldCorrectPitch: false,
    mute: false,
    loop: false,
    didJustFinish: false,
    currentTime: 0,
    duration: 1,
  };
  let listener: ((nextStatus: typeof status) => void) | undefined;
  const player = {
    get currentStatus() { return status; },
    volume: 1,
    play: jest.fn(() => { status = { ...status, playing: true }; }),
    pause: jest.fn(() => { status = { ...status, playing: false }; }),
    seekTo: jest.fn(async () => {}),
    remove: jest.fn(),
    addListener: jest.fn((_event, callback) => {
      listener = callback;
      return { remove: jest.fn() };
    }),
    emit(update: Partial<typeof status>) {
      status = { ...status, ...update };
      // Retain the callback to also simulate a late native event after remove.
      listener?.(status);
    },
  };
  mockPlayers.push(player);
  return player;
}

jest.mock("expo-audio", () => ({
  createAudioPlayer: jest.fn(() => mockCreatePlayer()),
  setAudioModeAsync: jest.fn(async () => {}),
}));

describe("audio compatibility listener and ducking lifecycle", () => {
  let sounds: AudioSound[];

  beforeEach(() => {
    jest.clearAllMocks();
    mockPlayers.length = 0;
    sounds = [];
  });

  afterEach(async () => {
    await Promise.all(sounds.map((sound) => sound.unloadAsync()));
    await Audio.setAudioModeAsync({});
  });

  async function createSound(duckOthers = true) {
    const { sound } = await Audio.Sound.createAsync(
      { uri: "file:///cached-pronunciation.mp3" },
      { shouldPlay: true, duckOthers },
    );
    sounds.push(sound);
    return sound;
  }

  it("does not replay loaded status or restore ducking after immediate unload", async () => {
    const sound = await createSound();
    const onStatus = jest.fn();

    sound.setOnPlaybackStatusUpdate(onStatus);
    await sound.unloadAsync();
    mockPlayers[0].emit({ playing: true });
    await Audio.setAudioModeAsync({});

    expect(onStatus).toHaveBeenCalled();
    expect(onStatus.mock.calls.every(([status]) => !status.isLoaded)).toBe(true);
    expect(await sound.getStatusAsync()).toMatchObject({ isLoaded: false });
    expect(setNativeAudioModeAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ interruptionModeAndroid: "mixWithOthers" }),
    );
  });

  it("only delivers queued status to the current listener and respects detachment", async () => {
    const sound = await createSound();
    const obsoleteListener = jest.fn();
    const currentListener = jest.fn();

    sound.setOnPlaybackStatusUpdate(obsoleteListener);
    sound.setOnPlaybackStatusUpdate(currentListener);
    mockPlayers[0].emit({ currentTime: 0.5 });
    await Promise.resolve();

    expect(obsoleteListener).not.toHaveBeenCalled();
    expect(currentListener).toHaveBeenLastCalledWith(
      expect.objectContaining({ positionMillis: 500 }),
    );

    currentListener.mockClear();
    sound.setOnPlaybackStatusUpdate(currentListener);
    sound.setOnPlaybackStatusUpdate(null);
    mockPlayers[0].emit({ playing: false, didJustFinish: true });
    await Promise.resolve();
    expect(currentListener).not.toHaveBeenCalled();
  });

  it("keeps other audio ducked until the last overlapping pronunciation stops", async () => {
    await createSound();
    const secondSound = await createSound();

    mockPlayers[0].emit({ playing: false, didJustFinish: true });
    await Audio.setAudioModeAsync({});
    expect(setNativeAudioModeAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ interruptionModeAndroid: "duckOthers" }),
    );

    await secondSound.unloadAsync();
    await Audio.setAudioModeAsync({});
    expect(setNativeAudioModeAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ interruptionModeAndroid: "mixWithOthers" }),
    );
  });

  it("never ducks other audio for an opted-out keep-alive sound", async () => {
    await createSound(false);
    mockPlayers[0].emit({ currentTime: 0.1 });
    await Audio.setAudioModeAsync({});

    expect(setNativeAudioModeAsync).toHaveBeenCalledTimes(1);
    expect(setNativeAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({ interruptionModeAndroid: "mixWithOthers" }),
    );
  });
});
