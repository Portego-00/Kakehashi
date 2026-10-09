import { act, renderHook } from "@testing-library/react-native";
import { useBunproVoiceAnswer } from "../use-bunpro-voice-answer";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";

const mockEvents: Record<string, (value: any) => void> = {};
jest.mock("expo-speech-recognition", () => ({ ExpoSpeechRecognitionModule: { requestPermissionsAsync: jest.fn(async () => ({ granted: true })), start: jest.fn(), abort: jest.fn() }, useSpeechRecognitionEvent: (event: string, handler: (value: any) => void) => { mockEvents[event] = handler; } }));
jest.mock("../../modules/AudioSessionManager", () => ({ __esModule: true, default: { overrideSpeaker: jest.fn(async () => undefined) } }));
beforeEach(() => jest.clearAllMocks());

it("uses the question language and places the transcript into the draft without grading", async () => {
  const onAnswer = jest.fn();
  const hook = renderHook(() => useBunproVoiceAnswer({ enabled: true, questionKey: "meaning:1", language: "en-US", onAnswer }));
  await act(async () => hook.result.current.start());
  expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledWith(expect.objectContaining({ lang: "en-US", interimResults: false }));
  act(() => mockEvents.result({ isFinal: true, results: [{ transcript: " a cat " }] }));
  expect(onAnswer).toHaveBeenCalledWith("a cat");
});
it("ignores results after a provider switch or a changed question", async () => {
  const onAnswer = jest.fn();
  const hook = renderHook(({ enabled, key }) => useBunproVoiceAnswer({ enabled, questionKey: key, language: "ja-JP", onAnswer }), { initialProps: { enabled: true, key: "1" } });
  await act(async () => hook.result.current.start());
  hook.rerender({ enabled: false, key: "1" });
  act(() => mockEvents.result({ isFinal: true, results: [{ transcript: "ねこ" }] }));
  expect(onAnswer).not.toHaveBeenCalled();
  expect(ExpoSpeechRecognitionModule.abort).toHaveBeenCalled();
  hook.rerender({ enabled: true, key: "2" });
  await act(async () => hook.result.current.start());
  hook.rerender({ enabled: true, key: "3" });
  act(() => mockEvents.result({ isFinal: true, results: [{ transcript: "いぬ" }] }));
  expect(onAnswer).not.toHaveBeenCalled();
});
it("does not start a microphone capture if permission returns after the session became inactive", async () => {
  let resolve!: (permission: any) => void;
  jest.mocked(ExpoSpeechRecognitionModule.requestPermissionsAsync).mockReturnValueOnce(new Promise(yes => { resolve = yes; }));
  const hook = renderHook(({ enabled }) => useBunproVoiceAnswer({ enabled, questionKey: "1", language: "ja-JP", onAnswer: jest.fn() }), { initialProps: { enabled: true } });
  let start!: Promise<void>;
  act(() => { start = hook.result.current.start(); });
  hook.rerender({ enabled: false });
  await act(async () => { resolve({ granted: true }); await start; });
  expect(ExpoSpeechRecognitionModule.start).not.toHaveBeenCalled();
});
