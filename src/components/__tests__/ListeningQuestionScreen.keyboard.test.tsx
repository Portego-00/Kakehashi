import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Animated, Dimensions, Image, StyleSheet, TouchableOpacity } from "react-native";
import type { ListeningQuestion } from "../../types/listening";
import { Audio, type AudioSound, type AVPlaybackStatus } from "../../utils/expoAvCompat";
import ListeningQuestionScreen from "../ListeningQuestionScreen";
import KanaInput from "../TextToKanaInput";

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Icon" }));
jest.mock("@react-native-community/slider", () => "Slider");
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
jest.mock("expo-router/react-navigation", () => ({ ...jest.requireActual("expo-router/react-navigation"), useIsFocused: () => true }));
jest.mock("../../utils/store", () => ({ useSettingsStore: () => ({ showContextSentenceSpeedControl: false }) }));
jest.mock("../../utils/subjectColors", () => ({ useSubjectColors: () => ({ vocabulary: "#9933cc" }) }));
jest.mock("../../utils/haptics", () => ({ impactAsync: jest.fn(), notificationAsync: jest.fn(), ImpactFeedbackStyle: { Light: "light" }, NotificationFeedbackType: { Success: "success", Error: "error" } }));
jest.mock("../../utils/expoAvCompat", () => ({ Audio: { Sound: { createAsync: jest.fn() } } }));
jest.mock("../../modules/AudioSessionManager", () => ({ __esModule: true, default: { overrideSpeaker: jest.fn(async () => "Speaker output active") } }));
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

it("fits both listening choices to the measured grid through folding and keeps the selection", async () => {
  const originalWindow = Dimensions.get("window");
  const onKanjiAnswer = jest.fn();
  const screen = render(<ListeningQuestionScreen
    question={question} questionPhase="kanji" solutionMode="multiple_choice"
    onKanjiAnswer={onKanjiAnswer} onMeaningAnswer={jest.fn()} onExit={jest.fn()}
    currentItem={1} totalItems={4} correctAnswersCount={0} accuracyPercent={0} lastCompletedItem={null}
    autoPlayAudio={false}
  />);
  fireEvent.press(screen.getByText("犬"));
  try {
    for (const [width, height, gridWidth] of [[951, 669, 815], [466, 678, 410], [669, 951, 613], [951, 669, 815]]) {
      act(() => Dimensions.set({ window: { ...originalWindow, width, height } }));
      fireEvent(screen.getByTestId("multiple-choice-keyboard"), "layout", {
        nativeEvent: { layout: { x: 0, y: 0, width: gridWidth, height: 160 } },
      });
      const choices = screen.UNSAFE_getAllByType(TouchableOpacity).filter((node) =>
        question.kanjiChoices.some((choice) => node.props.children?.props?.children === choice.kanji),
      );
      expect(choices).toHaveLength(4);
      const firstStyle = StyleSheet.flatten(choices[0].props.style);
      expect(firstStyle.width * 2 + 12).toBeCloseTo(gridWidth);
      expect(StyleSheet.flatten(choices[1].props.style).borderColor).toBe("white");
      expect(onKanjiAnswer).not.toHaveBeenCalled();
    }
    fireEvent.press(screen.getByText("Submit Answer"));
    await act(async () => { jest.advanceTimersByTime(350); });
    expect(onKanjiAnswer).toHaveBeenCalledTimes(1);
    expect(onKanjiAnswer).toHaveBeenCalledWith(false, "犬");
  } finally {
    screen.unmount();
    act(() => Dimensions.set({ window: originalWindow }));
  }
});

it("keeps an unsubmitted listening answer and the mounted input while the window changes", async () => {
  const originalWindow = Dimensions.get("window");
  const onKanjiAnswer = jest.fn();
  const screen = render(<ListeningQuestionScreen
    question={question} questionPhase="kanji" solutionMode="writing"
    onKanjiAnswer={onKanjiAnswer} onMeaningAnswer={jest.fn()} onExit={jest.fn()}
    currentItem={1} totalItems={4} correctAnswersCount={0} accuracyPercent={0} lastCompletedItem={null}
    autoPlayAudio={false}
  />);
  const input = screen.UNSAFE_getByType(KanaInput);
  fireEvent(input, "kanaChange", "猫");
  try {
    for (const [width, height] of [[951, 669], [466, 678], [669, 951], [951, 669]]) {
      act(() => Dimensions.set({ window: { ...originalWindow, width, height } }));
      expect(screen.UNSAFE_getByType(KanaInput)).toBe(input);
      expect(StyleSheet.flatten(input.props.style).maxWidth).toBe(width * 0.4);
      expect(onKanjiAnswer).not.toHaveBeenCalled();
    }
    fireEvent(input, "submitEditing");
    await act(async () => { jest.advanceTimersByTime(350); });
    expect(onKanjiAnswer).toHaveBeenCalledTimes(1);
    expect(onKanjiAnswer).toHaveBeenCalledWith(true, "猫");
  } finally {
    screen.unmount();
    act(() => Dimensions.set({ window: originalWindow }));
  }
});

it.each([true, false])("keeps a recovered scene visible after an answer graded %s", async (correct) => {
  const originalWindow = Dimensions.get("window");
  const onKanjiAnswer = jest.fn();
  const imageUrl = "https://immersionkit.s3.bhs.io.cloud.ovh.net/media/anime/Death%20Note/media/frame.jpg";
  const props = {
    question: { ...question, example: { ...question.example, imageUrl } },
    solutionMode: "multiple_choice" as const, onKanjiAnswer,
    onMeaningAnswer: jest.fn(), onExit: jest.fn(), currentItem: 1, totalItems: 4,
    correctAnswersCount: 0, accuracyPercent: 0, lastCompletedItem: null, autoPlayAudio: false,
  };
  const screen = render(<ListeningQuestionScreen {...props} questionPhase="kanji" />);
  const scene = () => screen.UNSAFE_getByType(Image);
  const imageContainerStyle = () => StyleSheet.flatten(screen.getByTestId("listening-media").props.style);
  expect(scene().props.source.uri).toBe(imageUrl);
  fireEvent(scene(), "error", { nativeEvent: { error: "Network error" } });
  expect(scene().props.source.uri).toMatch(/frame\.jpg\?retry=\d+$/);

  const choice = correct ? "猫" : "犬";
  fireEvent.press(screen.getByText(choice));
  fireEvent.press(screen.getByText("Submit Answer"));
  await act(async () => jest.advanceTimersByTime(350));
  expect(onKanjiAnswer).toHaveBeenCalledWith(correct, choice);
  screen.rerender(<ListeningQuestionScreen {...props} questionPhase="meaning" />);

  try {
    for (const [width, height] of [[951, 669], [466, 678], [669, 951]]) {
      act(() => Dimensions.set({ window: { ...originalWindow, width, height } }));
      expect(imageContainerStyle().height).toBe(height * 0.25);
      expect(imageContainerStyle().opacity).toBeUndefined();
      expect(scene().props.source.uri).toMatch(/frame\.jpg\?retry=\d+$/);
      expect(screen.getByText("Meaning Question")).toBeTruthy();
    }
  } finally {
    screen.unmount();
    act(() => Dimensions.set({ window: originalWindow }));
  }
});

it.each(["playback error", "load timeout"])("lets the learner retry after a clip %s", async (failure) => {
  const audio = "https://immersionkit.s3.bhs.io.cloud.ovh.net/media/anime/Death%20Note/media/clip.mp3";
  const sound = {
    setOnPlaybackStatusUpdate: jest.fn(),
    stopAsync: jest.fn(async () => undefined),
    unloadAsync: jest.fn(async () => undefined),
  };
  const createAudio = jest.mocked(Audio.Sound.createAsync);
  createAudio.mockResolvedValue({ sound: sound as unknown as AudioSound, status: { isLoaded: false } });
  const screen = render(<ListeningQuestionScreen
    question={{ ...question, example: { ...question.example, audio } }} questionPhase="kanji" solutionMode="multiple_choice"
    onKanjiAnswer={jest.fn()} onMeaningAnswer={jest.fn()} onExit={jest.fn()}
    currentItem={1} totalItems={4} correctAnswersCount={0} accuracyPercent={0} lastCompletedItem={null}
    autoPlayAudio={false}
  />);
  const playButton = () => screen.getByRole("button", { name: "Play anime clip" });
  await act(async () => fireEvent.press(playButton()));
  expect(createAudio).toHaveBeenLastCalledWith({ uri: audio }, expect.any(Object));
  expect(playButton().props.accessibilityState.disabled).toBe(true);

  await act(async () => {
    if (failure === "load timeout") jest.advanceTimersByTime(8_000);
    else (sound.setOnPlaybackStatusUpdate.mock.calls[0][0] as (status: AVPlaybackStatus) => void)({ isLoaded: false, error: failure });
  });
  expect(screen.getByText("Could not play the clip. Tap Play to retry.")).toBeTruthy();
  expect(sound.unloadAsync).toHaveBeenCalled();

  await act(async () => fireEvent.press(playButton()));
  expect(createAudio).toHaveBeenLastCalledWith({ uri: expect.stringMatching(/clip\.mp3\?retry=\d+$/) }, expect.any(Object));
  expect(screen.queryByText("Could not play the clip. Tap Play to retry.")).toBeNull();
});
