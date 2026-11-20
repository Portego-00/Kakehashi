import { fireEvent, render, screen } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import React, { type ComponentProps } from "react";
import { Alert } from "react-native";
import type ReviewQuestionScreen from "../../src/components/ReviewQuestionScreen";
import { getAllSubjects } from "../../src/utils/cache";
import { useSettingsStore } from "../../src/utils/store";
import CustomLessonScreen from "../(app)/custom-lesson";

jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), back: jest.fn(), dismissAll: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("../../src/hooks/useActivityTracking", () => ({ useActivityTracking: jest.fn() }));
jest.mock("../../src/hooks/useSubjectLists", () => ({
  useSubjectLists: () => ({ lists: [], reload: jest.fn() }),
}));
jest.mock("../../src/utils/api", () => ({ getSubjects: jest.fn() }));
jest.mock("../../src/utils/cache", () => ({ getAllSubjects: jest.fn() }));
jest.mock("../../src/utils/store", () => ({
  useAuthStore: () => ({ apiToken: "test-token" }),
  useSettingsStore: jest.fn(),
}));
jest.mock("../../src/utils/theme", () => ({ useTheme: () => ({ theme: {} }) }));
jest.mock("../../src/utils/subjectColors", () => ({ useSubjectColors: () => ({}) }));
jest.mock("../../src/components/AddToSubjectListsModal", () => () => null);
jest.mock("../../src/components/LessonDetailScreen", () => {
  const React = jest.requireActual("react");
  const { Pressable, Text } = jest.requireActual("react-native");
  return function LessonDetail({ item, onNext }: { item: { id: number }; onNext: () => void }) {
    return <Pressable onPress={onNext}><Text>Next lesson {item.id}</Text></Pressable>;
  };
});
jest.mock("../../src/components/ReviewQuestionScreen", () => {
  const React = jest.requireActual("react");
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return function ReviewQuestion({
    item,
    questionType,
    onAnswer,
    onSkip,
    currentItem,
    correctAnswersCount,
  }: ComponentProps<typeof ReviewQuestionScreen>) {
    return (
      <View>
        <Text testID="prompt">{item.id}:{questionType}</Text>
        <Text testID="accuracy">{correctAnswersCount}/{currentItem}</Text>
        <Pressable onPress={() => onAnswer(item, questionType, true, false)}><Text>Correct</Text></Pressable>
        <Pressable onPress={() => onAnswer(item, questionType, false, true)}><Text>Incorrect</Text></Pressable>
        <Pressable onPress={() => onSkip?.(item, questionType)}><Text>Skip</Text></Pressable>
        <Pressable onPress={() => {
          onAnswer(item, "meaning", false, true, true);
          onAnswer(item, "reading", true, false, true);
        }}><Text>Only reading correct</Text></Pressable>
        <Pressable onPress={() => {
          onAnswer(item, "meaning", true, false, true);
          onAnswer(item, "reading", true, false, true);
        }}><Text>Both correct</Text></Pressable>
      </View>
    );
  };
});

const subjects = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
  object: "kanji",
  data: {
    level: index + 1,
    meanings: [{ meaning: `Meaning ${index + 1}`, primary: true }],
    readings: [{ reading: "かな", primary: true }],
  },
}));
const settings = {
  lessonBatchSize: 6,
  customReviewOrder: "lowestLevelFirst",
  backToBackQuestions: true,
};

async function startBatch(firstId: number, lastId: number) {
  await screen.findByText(`Next lesson ${firstId}`);
  for (let id = firstId; id <= lastId; id += 1) {
    fireEvent.press(screen.getByText(`Next lesson ${id}`));
  }
}

function answerBatch(firstId: number, lastId: number) {
  for (let id = firstId; id <= lastId; id += 1) {
    for (const type of ["meaning", "reading"]) {
      expect(screen.getByTestId("prompt")).toHaveTextContent(`${id}:${type}`, { exact: true });
      fireEvent.press(screen.getByText("Correct"));
    }
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useSettingsStore).mockReturnValue(settings);
  jest.mocked(useLocalSearchParams).mockReturnValue({
    subjectIds: subjects.map(({ id }) => id).join(","),
  });
  jest.mocked(getAllSubjects).mockResolvedValue(subjects as Awaited<ReturnType<typeof getAllSubjects>>);
});

afterEach(() => jest.restoreAllMocks());

it("completes both six-subject batches when the list has twelve subjects with readings", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  render(<CustomLessonScreen />);

  await startBatch(1, 6);
  answerBatch(1, 6);
  expect(screen.getByText("Batch Complete!")).toBeOnTheScreen();
  expect(screen.getByText("6 of 12 items completed")).toBeOnTheScreen();
  expect(alert).not.toHaveBeenCalled();

  fireEvent.press(screen.getByText("Next batch"));
  await startBatch(7, 12);
  expect(screen.getByTestId("accuracy")).toHaveTextContent("0/0");
  answerBatch(7, 12);
  expect(alert).toHaveBeenCalledTimes(1);
  expect(alert.mock.calls[0][0]).toBe("Custom Lessons Complete");
  alert.mock.calls[0][2]?.[0]?.onPress?.();
  expect(router.replace).toHaveBeenCalledWith("/");
});

it("retries missed and skipped prompts, including a miss on the final remaining prompt", async () => {
  jest.spyOn(Math, "random").mockReturnValue(0);
  render(<CustomLessonScreen />);
  await startBatch(1, 6);

  fireEvent.press(screen.getByText("Incorrect"));
  fireEvent.press(screen.getByText("Skip"));
  expect(screen.getByTestId("accuracy")).toHaveTextContent("0/1");
  answerBatch(1, 5);

  fireEvent.press(screen.getByText("Correct"));
  expect(screen.getByTestId("prompt")).toHaveTextContent("6:reading", { exact: true });
  fireEvent.press(screen.getByText("Incorrect"));
  expect(screen.getByTestId("prompt")).toHaveTextContent("6:reading", { exact: true });
  expect(screen.queryByText("Batch Complete!")).toBeNull();
  fireEvent.press(screen.getByText("Correct"));
  expect(screen.getByText("Batch Complete!")).toBeOnTheScreen();
});

it("retries a grouped card when only its reading was correct", async () => {
  jest.mocked(useSettingsStore).mockReturnValue({
    ...settings,
    ankiCardMode: true,
    ankiGroupQuestions: true,
    ankiCardModeScope: "both",
  });
  jest.mocked(useLocalSearchParams).mockReturnValue({ subjectIds: "1" });
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  render(<CustomLessonScreen />);
  await startBatch(1, 1);

  fireEvent.press(screen.getByText("Only reading correct"));
  expect(alert).not.toHaveBeenCalled();
  expect(screen.getByTestId("accuracy")).toHaveTextContent("0/1");
  fireEvent.press(screen.getByText("Both correct"));
  expect(alert).toHaveBeenCalledTimes(1);
  expect(alert.mock.calls[0][0]).toBe("Custom Lessons Complete");
});

it("completes both batches with the quiz disabled", async () => {
  jest.mocked(useSettingsStore).mockReturnValue({ ...settings, skipCustomLessonQuiz: true });
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  render(<CustomLessonScreen />);

  await startBatch(1, 6);
  expect(screen.getByText("Batch Complete!")).toBeOnTheScreen();
  fireEvent.press(screen.getByText("Next batch"));

  await startBatch(7, 12);
  expect(alert).toHaveBeenCalledTimes(1);
  expect(alert.mock.calls[0][0]).toBe("Custom Lessons Complete");
});
