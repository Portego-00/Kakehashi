import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Animated } from "react-native";
import type { ListeningQuestion } from "../../types/listening";
import ListeningQuestionScreen from "../ListeningQuestionScreen";

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Icon" }));
jest.mock("@react-native-community/slider", () => "Slider");
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
jest.mock("@react-navigation/native", () => ({ ...jest.requireActual("@react-navigation/native"), useIsFocused: () => true }));
jest.mock("../../utils/store", () => ({ useSettingsStore: () => ({ showContextSentenceSpeedControl: false }) }));
jest.mock("../../utils/subjectColors", () => ({ useSubjectColors: () => ({ vocabulary: "#9933cc" }) }));
jest.mock("../../utils/haptics", () => ({ impactAsync: jest.fn(), notificationAsync: jest.fn(), ImpactFeedbackStyle: { Light: "light" }, NotificationFeedbackType: { Success: "success", Error: "error" } }));
jest.mock("../../utils/expoAvCompat", () => ({ Audio: { Sound: { createAsync: jest.fn() } } }));
jest.mock("../../modules/AudioSessionManager", () => ({ __esModule: true, default: null }));
jest.mock("../../hooks/useBluetoothAudioKeepAlive", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../TextToKanaInput", () => "KanaInput");

const question: ListeningQuestion = {
  id: 1,
  vocab: { id: 101, object: "vocabulary", data: {
    characters: "猫", meanings: [{ meaning: "Cat", primary: true }],
    readings: [{ reading: "ねこ", primary: true }],
  } } as ListeningQuestion["vocab"],
  example: { id: "sentence-1", sentence: "猫がいます。", translation: "There is a cat.", title: "Example" },
  sentenceWithBlank: "＿＿＿がいます。",
  kanjiChoices: [
    { vocabId: 101, kanji: "猫", reading: "ねこ", isCorrect: true },
    { vocabId: 102, kanji: "犬", reading: "いぬ", isCorrect: false },
    { vocabId: 103, kanji: "鳥", reading: "とり", isCorrect: false },
    { vocabId: 104, kanji: "馬", reading: "うま", isCorrect: false },
  ],
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(Animated, "timing").mockImplementation(() => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() }));
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it.each(["1", "2", "3", "4"])("selects listening choice %s and submits once with Enter", async (key) => {
  const onKanjiAnswer = jest.fn();
  const screen = render(<ListeningQuestionScreen
    question={question} questionPhase="kanji" solutionMode="multiple_choice"
    onKanjiAnswer={onKanjiAnswer} onMeaningAnswer={jest.fn()} onExit={jest.fn()}
    currentItem={1} totalItems={4} correctAnswersCount={0} accuracyPercent={0} lastCompletedItem={null}
    autoPlayAudio={false}
  />);
  const keyboard = screen.getByTestId("multiple-choice-keyboard");
  fireEvent(keyboard, "keyUpPress", { nativeEvent: { unicodeChar: key, hasNoModifiers: true } });
  expect(onKanjiAnswer).not.toHaveBeenCalled();
  act(() => {
    fireEvent(keyboard, "keyUpPress", { nativeEvent: { unicodeChar: "\r", hasNoModifiers: true } });
    fireEvent(keyboard, "keyUpPress", { nativeEvent: { unicodeChar: "\r", hasNoModifiers: true } });
  });
  await act(async () => { jest.advanceTimersByTime(350); });
  const choice = question.kanjiChoices[Number(key) - 1];
  expect(onKanjiAnswer).toHaveBeenCalledTimes(1);
  expect(onKanjiAnswer).toHaveBeenCalledWith(choice.isCorrect, choice.kanji);
});

it("preserves touch selection and submission across consecutive listening questions without a keyboard", async () => {
  const onKanjiAnswer = jest.fn();
  const props = {
    question, questionPhase: "kanji" as const, solutionMode: "multiple_choice" as const,
    onKanjiAnswer, onMeaningAnswer: jest.fn(), onExit: jest.fn(),
    currentItem: 1, totalItems: 4, correctAnswersCount: 0, accuracyPercent: 0,
    lastCompletedItem: null, autoPlayAudio: false,
  };
  const screen = render(<ListeningQuestionScreen {...props} />);
  fireEvent.press(screen.getByText("犬"));
  expect(onKanjiAnswer).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText("Submit Answer"));
  await act(async () => { jest.advanceTimersByTime(350); });
  expect(onKanjiAnswer).toHaveBeenCalledTimes(1);
  expect(onKanjiAnswer).toHaveBeenLastCalledWith(false, "犬");

  screen.rerender(<ListeningQuestionScreen {...props} question={{ ...question, id: 2 }} currentItem={2} />);
  fireEvent.press(screen.getByText("猫"));
  fireEvent.press(screen.getByText("Submit Answer"));
  await act(async () => { jest.advanceTimersByTime(350); });
  expect(onKanjiAnswer).toHaveBeenCalledTimes(2);
  expect(onKanjiAnswer).toHaveBeenLastCalledWith(true, "猫");
});
