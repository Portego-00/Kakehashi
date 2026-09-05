import fetchMock from "jest-fetch-mock";
import * as Speech from "expo-speech";

import { Audio } from "@/src/utils/expoAvCompat";
import { AzureSpeechService } from "../azureSpeech";
import { waitFor } from "@testing-library/react-native";

jest.mock("expo-speech", () => ({
  maxSpeechInputLength: 4000,
  speak: jest.fn(),
  stop: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/src/utils/expoAvCompat", () => ({
  Audio: {
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
    Sound: {
      createAsync: jest.fn(),
    },
  },
}));

jest.mock("../../modules/AudioSessionManager", () => ({
  __esModule: true,
  default: {
    overrideSpeaker: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("../../services/azureSpeechKeyService", () => ({
  azureSpeechKeyService: {
    getActiveKey: jest.fn(() =>
      Promise.resolve({
        subscriptionKey: "speech-key",
        region: "test-region",
        keyId: "primary",
        version: 1,
      }),
    ),
    refreshActiveKeyFromServer: jest.fn(),
    rotateAfterQuotaExceeded: jest.fn(),
  },
}));

describe("Azure Speech cancellation", () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.resetMocks();
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("does not let an old details cleanup stop the next prompt's audio", async () => {
    let finishNativeStop!: () => void;
    const nativeStopPending = new Promise<void>((resolve) => {
      finishNativeStop = resolve;
    });
    jest.mocked(Speech.stop).mockReturnValueOnce(nativeStopPending);
    const sound = {
      playAsync: jest.fn().mockResolvedValue(undefined),
      stopAsync: jest.fn().mockResolvedValue(undefined),
      unloadAsync: jest.fn().mockResolvedValue(undefined),
      setOnPlaybackStatusUpdate: jest.fn(),
    };
    (Audio.Sound.createAsync as jest.Mock).mockResolvedValue({ sound });
    fetchMock.mockResponses("speech-token", "audio-bytes");
    // Encoding is unrelated to the ownership race; native playback creation,
    // public speak(), public stop(), and their cleanup ordering stay real.
    const service = new AzureSpeechService();
    const encoding = jest
      .spyOn(service as any, "blobToBase64")
      .mockResolvedValue("YXVkaW8=");

    const detailsCleanup = service.stop();
    const nextPrompt = service.speak("ねこ。猫がいます。");
    await waitFor(() => expect(sound.playAsync).toHaveBeenCalledTimes(1));
    finishNativeStop();
    await detailsCleanup;

    try {
      expect(sound.stopAsync).not.toHaveBeenCalled();
      expect(sound.unloadAsync).not.toHaveBeenCalled();
      expect(service.isCurrentlySpeaking()).toBe(true);
    } finally {
      await service.stop();
      await nextPrompt;
      encoding.mockRestore();
    }
  });

  it("unloads only the detached sound when its native stop finishes late", async () => {
    let finishOldSoundStop!: () => void;
    const oldSoundStop = new Promise<void>((resolve) => {
      finishOldSoundStop = resolve;
    });
    const createSound = () => ({
      playAsync: jest.fn().mockResolvedValue(undefined),
      stopAsync: jest.fn().mockResolvedValue(undefined),
      unloadAsync: jest.fn().mockResolvedValue(undefined),
      setOnPlaybackStatusUpdate: jest.fn(),
    });
    const oldSound = createSound();
    oldSound.stopAsync.mockReturnValueOnce(oldSoundStop);
    const nextSound = createSound();
    (Audio.Sound.createAsync as jest.Mock)
      .mockResolvedValueOnce({ sound: oldSound })
      .mockResolvedValueOnce({ sound: nextSound });
    fetchMock.mockResponses("token-1", "audio-1", "token-2", "audio-2");
    const service = new AzureSpeechService();
    const encoding = jest
      .spyOn(service as any, "blobToBase64")
      .mockResolvedValue("YXVkaW8=");
    const oldPrompt = service.speak("すうじ。数字を書いてください。");
    await waitFor(() => expect(oldSound.playAsync).toHaveBeenCalledTimes(1));
    const oldCleanup = service.stop();
    await waitFor(() => expect(oldSound.stopAsync).toHaveBeenCalledTimes(1));
    const onEnd = jest.fn();
    const nextPrompt = service.speak("ねこ。猫がいます。", undefined, onEnd);
    await waitFor(() => expect(nextSound.playAsync).toHaveBeenCalledTimes(1));
    finishOldSoundStop();
    await oldCleanup;
    await oldPrompt;

    try {
      expect(oldSound.unloadAsync).toHaveBeenCalledTimes(1);
      expect(nextSound.stopAsync).not.toHaveBeenCalled();
      expect(nextSound.unloadAsync).not.toHaveBeenCalled();
      expect(service.isCurrentlySpeaking()).toBe(true);
      nextSound.setOnPlaybackStatusUpdate.mock.calls[0][0]({
        isLoaded: true,
        didJustFinish: true,
      });
      await nextPrompt;
      expect(onEnd).toHaveBeenCalledTimes(1);
      expect(service.isCurrentlySpeaking()).toBe(false);
    } finally {
      await service.stop();
      await nextPrompt;
      encoding.mockRestore();
    }
    expect(nextSound.unloadAsync).toHaveBeenCalledTimes(1);
  });

  it("keeps the new native speech fallback active when an older cleanup settles", async () => {
    let finishNativeStop!: () => void;
    const nativeStopPending = new Promise<void>((resolve) => {
      finishNativeStop = resolve;
    });
    jest.mocked(Speech.stop).mockReturnValueOnce(nativeStopPending);
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    fetchMock.mockResponseOnce("Offline", { status: 503 });
    const service = new AzureSpeechService();
    const oldCleanup = service.stop();
    const onEnd = jest.fn();
    const nextPrompt = service.speak("ねこ。猫がいます。", undefined, onEnd);
    await waitFor(() => expect(Speech.speak).toHaveBeenCalledTimes(1));
    finishNativeStop();
    await oldCleanup;

    try {
      expect(service.isCurrentlySpeaking()).toBe(true);
      const options = jest.mocked(Speech.speak).mock.calls[0][1];
      options?.onDone?.();
      await nextPrompt;
      expect(onEnd).toHaveBeenCalledTimes(1);
      expect(service.isCurrentlySpeaking()).toBe(false);
    } finally {
      await service.stop();
      consoleError.mockRestore();
    }
  });

  it("aborts synthesis in progress and does not start stale audio", async () => {
    let requestSignal: AbortSignal | undefined;
    let markRequestStarted: (() => void) | undefined;
    const requestStarted = new Promise<void>((resolve) => {
      markRequestStarted = resolve;
    });

    fetchMock.mockImplementationOnce((_request, init) => {
      requestSignal = init?.signal ?? undefined;
      markRequestStarted?.();

      return new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener(
          "abort",
          () => {
            const error = new Error("The operation was aborted.");
            error.name = "AbortError";
            reject(error);
          },
          { once: true },
        );
      });
    });

    const service = new AzureSpeechService();
    const speakPromise = service.speak("自分で作った文です。");

    await requestStarted;
    await service.stop();
    await expect(speakPromise).resolves.toBeUndefined();

    expect(requestSignal?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(Speech.speak).not.toHaveBeenCalled();
    expect(Audio.Sound.createAsync).not.toHaveBeenCalled();
    expect(service.isCurrentlySpeaking()).toBe(false);
  });
});
