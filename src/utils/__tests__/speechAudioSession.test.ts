import fetchMock from "jest-fetch-mock";
import * as Speech from "expo-speech";
import { setAudioModeAsync, setIsAudioActiveAsync } from "expo-audio";
import { Platform } from "react-native";
import { waitFor } from "@testing-library/react-native";

import { Audio } from "../expoAvCompat";
import { AzureSpeechService } from "../azureSpeech";
import { speakKanjiReading } from "../kanjiPronunciationSpeech";
import { azureSpeechKeyService } from "../../services/azureSpeechKeyService";

jest.mock("expo-audio", () => ({
  createAudioPlayer: jest.fn(),
  setAudioModeAsync: jest.fn(),
  setIsAudioActiveAsync: jest.fn(),
}));

jest.mock("expo-speech", () => ({
  maxSpeechInputLength: 4000,
  speak: jest.fn(),
  stop: jest.fn(() => Promise.resolve()),
}));

jest.mock("../../modules/AudioSessionManager", () => ({
  __esModule: true,
  default: { overrideSpeaker: jest.fn(() => Promise.resolve()) },
}));

jest.mock("../../services/azureSpeechKeyService", () => ({
  azureSpeechKeyService: {
    getActiveKey: jest.fn(() => Promise.resolve({
      subscriptionKey: "speech-key",
      region: "test-region",
      keyId: "primary",
      version: 1,
    })),
  },
}));

describe("native speech audio-session integration", () => {
  const originalPlatform = Platform.OS;
  let session: { playsInSilentMode: boolean; active: boolean };
  let sessionsAtSpeechStart: typeof session[];

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.resetMocks();
    Platform.OS = "ios";
    session = { playsInSilentMode: false, active: false };
    sessionsAtSpeechStart = [];
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});

    // Match expo-audio's iOS contract: configuring a category does not activate
    // AVAudioSession. expo-speech uses that session without preparing it.
    jest.mocked(setAudioModeAsync).mockImplementation(async (mode) => {
      session.playsInSilentMode = mode.playsInSilentMode ?? false;
    });
    jest.mocked(setIsAudioActiveAsync).mockImplementation(async (active) => {
      session.active = active;
    });
    jest.mocked(Speech.speak).mockImplementation((_text, options) => {
      sessionsAtSpeechStart.push({ ...session });
      options?.onDone?.();
    });
  });

  afterEach(() => {
    Platform.OS = originalPlatform;
    jest.restoreAllMocks();
  });

  it("prepares the first context sentence's native fallback before speaking", async () => {
    fetchMock.mockResponseOnce("Unavailable", { status: 503 });
    const onEnd = jest.fn();
    const onError = jest.fn();

    await new AzureSpeechService().speak("猫がいます。", undefined, onEnd, onError);

    expect(sessionsAtSpeechStart).toEqual([{ playsInSilentMode: true, active: true }]);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("activates the session even when the vocabulary screen configured audio already", async () => {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    fetchMock.mockResponseOnce("Unavailable", { status: 503 });

    await new AzureSpeechService().speak("猫がいます。");

    expect(sessionsAtSpeechStart).toEqual([{ playsInSilentMode: true, active: true }]);
  });

  it("prepares a kanji reading without needing earlier audio playback", async () => {
    await speakKanjiReading("きゅう");

    expect(sessionsAtSpeechStart).toEqual([{ playsInSilentMode: true, active: true }]);
  });

  it("can speak after another audio source has prepared and activated the session", async () => {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    await setIsAudioActiveAsync(true);
    fetchMock.mockResponseOnce("Unavailable", { status: 503 });

    await new AzureSpeechService().speak("猫がいます。");

    expect(sessionsAtSpeechStart).toEqual([{ playsInSilentMode: true, active: true }]);
  });

  it("prepares fallback speech when fetching the Azure key fails at startup", async () => {
    jest.mocked(azureSpeechKeyService.getActiveKey).mockRejectedValueOnce(new Error("Offline"));

    await new AzureSpeechService().speak("猫がいます。");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(sessionsAtSpeechStart).toEqual([{ playsInSilentMode: true, active: true }]);
  });

  it("waits for configuration and activation before starting fallback speech", async () => {
    let configure!: () => void;
    let activate!: () => void;
    jest.mocked(setAudioModeAsync).mockImplementationOnce(() => new Promise((resolve) => {
      configure = () => {
        session.playsInSilentMode = true;
        resolve();
      };
    }));
    jest.mocked(setIsAudioActiveAsync).mockImplementationOnce(() => new Promise((resolve) => {
      activate = () => {
        session.active = true;
        resolve();
      };
    }));
    fetchMock.mockResponseOnce("Unavailable", { status: 503 });

    const speech = new AzureSpeechService().speak("猫がいます。");
    await waitFor(() => expect(setAudioModeAsync).toHaveBeenCalledTimes(1));
    expect(setIsAudioActiveAsync).not.toHaveBeenCalled();
    expect(Speech.speak).not.toHaveBeenCalled();
    configure();
    await waitFor(() => expect(setIsAudioActiveAsync).toHaveBeenCalledTimes(1));
    expect(Speech.speak).not.toHaveBeenCalled();
    activate();
    await speech;

    expect(sessionsAtSpeechStart).toEqual([{ playsInSilentMode: true, active: true }]);
  });

  it("does not start fallback speech after being stopped during activation", async () => {
    let activate!: () => void;
    jest.mocked(setIsAudioActiveAsync).mockImplementationOnce(() => new Promise((resolve) => {
      activate = resolve;
    }));
    fetchMock.mockResponseOnce("Unavailable", { status: 503 });
    const service = new AzureSpeechService();
    const onEnd = jest.fn();
    const onError = jest.fn();

    const speech = service.speak("猫がいます。", undefined, onEnd, onError);
    await waitFor(() => expect(setIsAudioActiveAsync).toHaveBeenCalledTimes(1));
    await service.stop();
    activate();
    await speech;

    expect(Speech.speak).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(service.isCurrentlySpeaking()).toBe(false);
  });

  it("speaks only the newest kanji reading when an earlier activation finishes late", async () => {
    let activate!: () => void;
    jest.mocked(setIsAudioActiveAsync).mockImplementationOnce(() => new Promise((resolve) => {
      activate = resolve;
    }));

    const firstReading = speakKanjiReading("きゅう");
    await waitFor(() => expect(setIsAudioActiveAsync).toHaveBeenCalledTimes(1));
    await speakKanjiReading("やすむ");
    activate();
    await firstReading;

    expect(Speech.speak).toHaveBeenCalledTimes(1);
    expect(Speech.speak).toHaveBeenCalledWith("やすむ", expect.any(Object));
  });

  it("reports an activation failure without starting speech or reporting completion", async () => {
    const error = new Error("Audio session unavailable");
    jest.mocked(setIsAudioActiveAsync).mockRejectedValueOnce(error);
    fetchMock.mockResponseOnce("Unavailable", { status: 503 });
    const service = new AzureSpeechService();
    const onEnd = jest.fn();
    const onError = jest.fn();

    await service.speak("猫がいます。", undefined, onEnd, onError);

    expect(Speech.speak).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(error);
    expect(service.isCurrentlySpeaking()).toBe(false);
  });

  it("handles kanji activation failure and allows the next tap to retry", async () => {
    const error = new Error("Audio session unavailable");
    jest.mocked(setIsAudioActiveAsync).mockRejectedValueOnce(error);
    const warning = jest.spyOn(console, "warn").mockImplementation(() => {});

    await expect(speakKanjiReading("きゅう")).resolves.toBeUndefined();

    expect(Speech.speak).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledWith("Failed to play kanji pronunciation:", error);

    await speakKanjiReading("きゅう");

    expect(sessionsAtSpeechStart).toEqual([{ playsInSilentMode: true, active: true }]);
  });

  it("leaves Android native speech independent of iOS audio-session setup", async () => {
    Platform.OS = "android";
    fetchMock.mockResponseOnce("Unavailable", { status: 503 });

    await new AzureSpeechService().speak("猫がいます。");
    await speakKanjiReading("きゅう");

    expect(Speech.speak).toHaveBeenCalledTimes(2);
    expect(setAudioModeAsync).not.toHaveBeenCalled();
    expect(setIsAudioActiveAsync).not.toHaveBeenCalled();
  });
});
