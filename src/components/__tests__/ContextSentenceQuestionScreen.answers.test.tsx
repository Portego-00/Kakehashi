import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Animated } from "react-native";
import type { ContextSentenceQuestion } from "../../types/contextSentencePractice";
import { azureSpeechService } from "../../utils/azureSpeech";
import ContextSentenceQuestionScreen from "../ContextSentenceQuestionScreen";
import KanaInput from "../TextToKanaInput";

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Icon" }));
jest.mock("expo-blur", () => ({ BlurView: "BlurView" }));
jest.mock("@react-native-community/slider", () => "Slider");
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: "SafeAreaView",
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    useSharedValue: (value: number) => React.useRef({ value }).current,
    withTiming: (value: number) => value,
  };
});
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("../../utils/haptics", () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: "success", Error: "error" },
}));
jest.mock("../../utils/cache", () => ({ getAllSubjects: jest.fn() }));
jest.mock("../../utils/textHighlighting", () => ({
  findVocabularyMatchesWithJpdbFirstPass: jest.fn(),
  getHighlightSegments: jest.fn(() => []),
  isWaniKaniBackedMatch: jest.fn(),
}));
jest.mock("../../utils/subjectColors", () => ({
  useSubjectColors: () => ({ vocabulary: "#9933cc" }),
  withAlpha: (color: string) => color,
}));
jest.mock("../../utils/theme", () => ({
  useTheme: () => ({ theme: { textColor: "#111", textSecondary: "#666",
    backgroundColor: "white", cardBackground: "white", border: "#ddd", primary: "#9933cc" } }),
}));
jest.mock("../../utils/azureSpeech", () => ({
  azureSpeechService: { speak: jest.fn(async () => {}), stop: jest.fn(async () => {}) },
}));
jest.mock("../VocabularyTooltip", () => ({ VocabularyTooltip: () => null }));
jest.mock("../AnkiDroidExportButton", () => ({ AnkiDroidExportButton: () => null }));
jest.mock("../TextToKanaInput", () => "KanaInput");

const question: ContextSentenceQuestion = {
  id: 1,
  vocab: { id: 101, object: "vocabulary", data: {
    characters: "猫", meanings: [{ meaning: "Cat", primary: true }],
    readings: [{ reading: "ねこ", primary: true }],
  } } as ContextSentenceQuestion["vocab"],
  sentence: "猫がいます。", translation: "There is a cat.", sentenceWithBlank: "＿＿＿がいます。",
  kanjiChoices: [
    { vocabId: 101, kanji: "猫", isCorrect: true },
    { vocabId: 102, kanji: "犬", isCorrect: false },
    { vocabId: 103, kanji: "鳥", isCorrect: false },
    { vocabId: 104, kanji: "馬", isCorrect: false },
  ],
};

function renderQuestion(overrides: Partial<React.ComponentProps<typeof ContextSentenceQuestionScreen>> = {}) {
  const onAnswer = jest.fn();
  const props = { question, solutionMode: "multiple_choice" as const, stopAfterAnswer: true,
    onAnswer, onExit: jest.fn(), currentItem: 1, totalItems: 3, correctAnswersCount: 0, accuracyPercent: 0,
    ...overrides };
  return { ...render(<ContextSentenceQuestionScreen {...props} />), onAnswer, props };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.mocked(azureSpeechService.speak).mockImplementation(async (_text, onStart, onEnd) => {
    onStart?.();
    onEnd?.();
  });
  jest.spyOn(Animated, "timing").mockImplementation(() => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() }));
});
afterEach(async () => {
  await act(async () => {});
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it.each([true, false])("accepts a choice immediately with stopAfterAnswer=%s", async (stopAfterAnswer) => {
  const screen = renderQuestion({ stopAfterAnswer });
  await act(async () => {});
  fireEvent.press(screen.getByText("猫"));
  expect(screen.queryByText("Submit Answer")).toBeNull();
  if (stopAfterAnswer) {
    fireEvent.press(screen.getByText("Next Question"));
  } else {
    act(() => jest.advanceTimersByTime(500));
  }
  expect(screen.onAnswer).toHaveBeenCalledTimes(1);
  expect(screen.onAnswer).toHaveBeenCalledWith(true, "猫");
  await act(async () => {});
});

it("locks the chosen answer during feedback so quick taps cannot submit two answers", async () => {
  const screen = renderQuestion({ stopAfterAnswer: false });
  await act(async () => {});
  const correct = screen.getByText("猫");
  const incorrect = screen.getByText("犬");
  act(() => { fireEvent.press(correct); fireEvent.press(incorrect); });
  act(() => jest.advanceTimersByTime(500));
  expect(screen.onAnswer).toHaveBeenCalledTimes(1);
  expect(screen.onAnswer).toHaveBeenCalledWith(true, "猫");
  await act(async () => {});
});

it("plays the sentence on a correct answer and offers the same audio for replay", async () => {
  const screen = renderQuestion({ enableSentenceAudio: true });
  expect(azureSpeechService.speak).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText("猫"));
  await act(async () => {});
  expect(azureSpeechService.speak).toHaveBeenCalledWith(question.sentence,
    expect.any(Function), expect.any(Function), expect.any(Function), { speedMultiplier: 1 });
  fireEvent.press(screen.getByLabelText("Replay sentence audio"));
  await act(async () => {});
  expect(azureSpeechService.speak).toHaveBeenCalledTimes(2);
});

it.each([false, true])("does not autoplay a wrong answer (sentence audio enabled=%s)", async (enableSentenceAudio) => {
  const screen = renderQuestion({ enableSentenceAudio });
  fireEvent.press(screen.getByText("犬"));
  await act(async () => {});
  expect(azureSpeechService.speak).not.toHaveBeenCalled();
});

it("respects disabled sentence audio after a correct answer", async () => {
  const screen = renderQuestion();
  fireEvent.press(screen.getByText("猫"));
  await act(async () => {});
  expect(azureSpeechService.speak).not.toHaveBeenCalled();
  expect(screen.queryByLabelText("Replay sentence audio")).toBeNull();
});

it("waits for correct-answer audio to finish before advancing automatically", async () => {
  let finishAudio!: () => void;
  jest.mocked(azureSpeechService.speak).mockImplementation((_text, onStart, onEnd) => new Promise(resolve => {
    onStart?.();
    finishAudio = () => { onEnd?.(); resolve(); };
  }));
  const screen = renderQuestion({ enableSentenceAudio: true, stopAfterAnswer: false });
  fireEvent.press(screen.getByText("猫"));
  await act(async () => {});
  act(() => jest.advanceTimersByTime(1500));
  expect(screen.onAnswer).not.toHaveBeenCalled();
  await act(async () => finishAudio());
  act(() => jest.advanceTimersByTime(1));
  expect(screen.onAnswer).toHaveBeenCalledTimes(1);
});

it("advances after Stop even if sentence playback never settles, ignoring its late completion", async () => {
  let finishAudio!: () => void;
  jest.mocked(azureSpeechService.speak).mockImplementation((_text, _onStart, onEnd) => new Promise(resolve => {
    finishAudio = () => { onEnd?.(); resolve(); };
  }));
  const screen = renderQuestion({ enableSentenceAudio: true, stopAfterAnswer: false });
  fireEvent.press(screen.getByText("猫"));
  await act(async () => {});
  fireEvent.press(screen.getByLabelText("Stop sentence audio"));
  await act(async () => {});
  act(() => jest.advanceTimersByTime(60000));
  expect(screen.onAnswer).toHaveBeenCalledTimes(1);
  expect(screen.onAnswer).toHaveBeenCalledWith(true, "猫");
  await act(async () => finishAudio());
  act(() => jest.advanceTimersByTime(60000));
  expect(screen.onAnswer).toHaveBeenCalledTimes(1);
});

it("ignores late audio completion after a different question opens", async () => {
  let finishAudio!: () => void;
  jest.mocked(azureSpeechService.speak).mockImplementation((_text, onStart, onEnd) => new Promise(resolve => {
    onStart?.();
    finishAudio = () => { onEnd?.(); resolve(); };
  }));
  const screen = renderQuestion({ enableSentenceAudio: true, stopAfterAnswer: false });
  fireEvent.press(screen.getByText("猫"));
  await act(async () => {});
  screen.rerender(<ContextSentenceQuestionScreen {...screen.props} question={{ ...question, id: 2 }} />);
  await act(async () => finishAudio());
  act(() => jest.advanceTimersByTime(1500));
  expect(screen.onAnswer).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Play sentence audio")).toBeTruthy();
});

it.each(["finish", "stop"])("waits for a requested replay after Stop during answer feedback (replay ends by %s)", async (replayEnd) => {
  const finishAudio: (() => void)[] = [];
  jest.mocked(azureSpeechService.speak).mockImplementation((_text, onStart, onEnd) => new Promise(resolve => {
    onStart?.();
    finishAudio.push(() => { onEnd?.(); resolve(); });
  }));
  const screen = renderQuestion({ enableSentenceAudio: true, stopAfterAnswer: false });
  fireEvent.press(screen.getByText("猫"));
  await act(async () => {});
  act(() => jest.advanceTimersByTime(100));
  fireEvent.press(screen.getByLabelText("Stop sentence audio"));
  await act(async () => {});
  fireEvent.press(screen.getByLabelText("Replay sentence audio"));
  await act(async () => {});
  expect(finishAudio).toHaveLength(2);

  await act(async () => finishAudio[0]());
  act(() => jest.advanceTimersByTime(1500));
  expect(screen.onAnswer).not.toHaveBeenCalled();
  if (replayEnd === "stop") {
    fireEvent.press(screen.getByLabelText("Stop sentence audio"));
    await act(async () => {});
  } else {
    await act(async () => finishAudio[1]());
  }
  act(() => jest.advanceTimersByTime(1));
  expect(screen.onAnswer).toHaveBeenCalledTimes(1);
  expect(screen.onAnswer).toHaveBeenCalledWith(true, "猫");
  await act(async () => finishAudio[1]());
  act(() => jest.advanceTimersByTime(1500));
  expect(screen.onAnswer).toHaveBeenCalledTimes(1);
});

it("cancels a queued answer when the screen closes", async () => {
  const screen = renderQuestion({ stopAfterAnswer: false });
  fireEvent.press(screen.getByText("猫"));
  screen.unmount();
  await act(async () => jest.advanceTimersByTime(1500));
  expect(screen.onAnswer).not.toHaveBeenCalled();
});

it("keeps the result usable when sentence playback fails", async () => {
  jest.mocked(azureSpeechService.speak).mockRejectedValueOnce(new Error("Audio unavailable"));
  const screen = renderQuestion({ enableSentenceAudio: true });
  fireEvent.press(screen.getByText("猫"));
  await act(async () => {});
  expect(screen.getByLabelText("Replay sentence audio")).toBeTruthy();
  const next = screen.getByText("Next Question");
  act(() => { fireEvent.press(next); fireEvent.press(next); });
  expect(screen.onAnswer).toHaveBeenCalledTimes(1);
});

it("allows a typed answer to be edited after feedback", async () => {
  const screen = renderQuestion({ solutionMode: "writing", enableSentenceAudio: true });
  const input = screen.UNSAFE_getByType(KanaInput);
  fireEvent(input, "kanaChange", "いぬ");
  fireEvent(input, "submitEditing");
  fireEvent(input, "kanaChange", "ねこ");
  fireEvent(input, "submitEditing");
  await act(async () => {});
  expect(azureSpeechService.speak).toHaveBeenCalledTimes(1);
  fireEvent(input, "submitEditing");
  expect(screen.onAnswer).toHaveBeenCalledWith(true, "ねこ");
});
