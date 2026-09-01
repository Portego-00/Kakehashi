import fetchMock from "jest-fetch-mock";
import * as Speech from "expo-speech";

import { Audio } from "@/src/utils/expoAvCompat";
import { AzureSpeechService } from "../azureSpeech";

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
