import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { Alert } from "react-native";
import {
  getPendingProgressAssignmentIds,
  getPendingProgressCounts,
  queueProgressAndAttemptSend,
  syncPendingProgress,
} from "../../src/services/offlineStudyProgressService";
import {
  getAvailableLessons,
  getLiveLessonAssignmentIds,
  getSubjects,
} from "../../src/utils/api";
import { clearPersistedLessonSession } from "../../src/utils/lessonSessionPersistence";
import { useAuthStore, useSettingsStore } from "../../src/utils/store";
import LessonsScreen from "../(app)/lessons";

jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), back: jest.fn(), dismissAll: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("../../src/contexts/AuthContext", () => ({
  useSession: () => ({ isLoading: false }),
}));
jest.mock("../../src/hooks/useActivityTracking", () => ({ useActivityTracking: jest.fn() }));
jest.mock("../../src/hooks/useDashboardData", () => ({
  useDashboardData: () => ({ refreshLessonsAndReviews: jest.fn() }),
}));
jest.mock("../../src/hooks/useSubjectLists", () => ({
  useSubjectLists: () => ({ lists: [], reload: jest.fn() }),
}));
jest.mock("../../src/utils/api", () => ({
  getAvailableLessons: jest.fn(),
  getLiveLessonAssignmentIds: jest.fn(),
  getSubjects: jest.fn(),
  isRateLimitError: () => false,
  isUnauthorizedError: () => false,
}));
jest.mock("../../src/services/offlineStudyProgressService", () => ({
  getPendingProgressAssignmentIds: jest.fn(),
  getPendingProgressCounts: jest.fn(),
  queueProgressAndAttemptSend: jest.fn(),
  syncPendingProgress: jest.fn(),
}));
jest.mock("../../src/services/studyProgressAssignmentCacheService", () => ({
  markLessonStartedInAssignmentCaches: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../src/utils/store", () => ({
  useAuthStore: jest.fn(),
  useSettingsStore: jest.fn(),
}));
jest.mock("../../src/utils/theme", () => ({ useTheme: () => ({ theme: {} }) }));
jest.mock("../../src/utils/subjectColors", () => ({ useSubjectColors: () => ({}) }));
jest.mock("../../src/utils/permanentStorage", () => {
  const storage = new Map<string, string>();
  return {
    PERMANENT_KEYS: { LESSON_SESSION: "lesson_session" },
    permanentStorage: {
      getString: (key: string) => storage.get(key),
      set: (key: string, value: string) => storage.set(key, value),
      delete: (key: string) => storage.delete(key),
    },
  };
});
jest.mock("../../src/components/AddToSubjectListsModal", () => () => null);
jest.mock("../../src/components/LessonDetailScreen", () => {
  const React = jest.requireActual("react");
  const { Text, TouchableOpacity, View } = jest.requireActual("react-native");
  return function LessonDetail({
    item,
    batchItems,
    onNext,
    onExit,
  }: {
    item: { subjectId: number };
    batchItems: { subjectId: number }[];
    onNext: () => void;
    onExit: () => void;
  }) {
    return (
      <View>
        <Text>Lesson {item.subjectId}</Text>
        <Text>Batch: {batchItems.map((lesson) => lesson.subjectId).join(",")}</Text>
        <TouchableOpacity onPress={onNext}><Text>Next lesson</Text></TouchableOpacity>
        <TouchableOpacity onPress={onExit}><Text>Exit lessons</Text></TouchableOpacity>
      </View>
    );
  };
});
jest.mock("../../src/components/ReviewQuestionScreen", () => {
  const React = jest.requireActual("react");
  const { Text, TouchableOpacity, View } = jest.requireActual("react-native");
  return function ReviewQuestion({
    item,
    questionType,
    onAnswer,
    onExit,
  }: {
    item: { id: number; subject: { id: number } };
    questionType: "meaning" | "reading";
    onAnswer: (item: { id: number; subject: { id: number } }, type: "meaning" | "reading", correct: boolean) => Promise<void>;
    onExit: () => void;
  }) {
    return (
      <View>
        <Text>Question {item.subject.id}: {questionType}</Text>
        <TouchableOpacity onPress={() => onAnswer(item, questionType, true)}>
          <Text>Answer correctly</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onExit}><Text>Exit quiz</Text></TouchableOpacity>
      </View>
    );
  };
});

const assignments = Array.from({ length: 10 }, (_, index) => ({
  id: 1001 + index,
  data: { subject_id: 2001 + index, available_at: null },
}));
const subjects = assignments.map((assignment) => ({
  id: assignment.data.subject_id,
  object: "kanji",
  data: {
    level: 1,
    meanings: [{ meaning: "fixture", primary: true }],
    readings: [{ reading: "かな", primary: true }],
  },
}));
let availableAssignments = [...assignments];
let completedAssignmentIds: number[] = [];

async function mountLessons(selectedLessonIds?: number[]) {
  jest.mocked(useLocalSearchParams).mockReturnValue(
    selectedLessonIds ? { selectedLessonIds: JSON.stringify(selectedLessonIds) } : {}
  );
  const view = render(<LessonsScreen />);
  await act(async () => {});
  return view;
}

async function startQuiz(batchSize: number) {
  await screen.findByText("Next lesson");
  for (let index = 0; index < batchSize; index += 1) {
    fireEvent.press(screen.getByText("Next lesson"));
  }
  await screen.findByText("Answer correctly");
}

async function answerCorrectly() {
  await act(async () => {
    fireEvent.press(screen.getByText("Answer correctly"));
  });
}

describe("lesson session resume", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await clearPersistedLessonSession();
    availableAssignments = [...assignments];
    completedAssignmentIds = [];
    jest.mocked(useAuthStore).mockReturnValue({
      apiToken: "test-token",
      userData: { id: "test-user", level: 1 },
      setUserData: jest.fn(),
    });
    jest.mocked(useSettingsStore).mockReturnValue({
      lessonBatchSize: 5,
      dailyLessonLimit: 0,
      lessonOrder: "ascendingSubjectId",
      lessonTypeOrderEnabled: false,
      lessonTypeOrder: [],
      backToBackQuestions: true,
      reviewQuestionOrderEnabled: true,
      meaningFirst: true,
      acceptUserSynonymsAsAnswers: false,
    });
    jest.mocked(getAvailableLessons).mockImplementation(async () => ({
      data: [...availableAssignments],
    } as Awaited<ReturnType<typeof getAvailableLessons>>));
    jest.mocked(getLiveLessonAssignmentIds).mockImplementation(async () =>
      new Set(availableAssignments.map((assignment) => assignment.id))
    );
    jest.mocked(getSubjects).mockImplementation(async (_token, params) => ({
      data: subjects.filter((subject) => params?.ids?.includes(subject.id)),
    } as Awaited<ReturnType<typeof getSubjects>>));
    jest.mocked(getPendingProgressAssignmentIds).mockResolvedValue({
      lesson: new Set(), review: new Set(),
    });
    jest.mocked(getPendingProgressCounts).mockResolvedValue({ lesson: 0, review: 0, total: 0 });
    jest.mocked(syncPendingProgress).mockResolvedValue({
      processed: 0,
      sent: 0,
      droppedValidation: 0,
      remaining: 0,
      stoppedOnFailure: false,
    });
    jest.mocked(queueProgressAndAttemptSend).mockImplementation(async (_token, entry) => {
      completedAssignmentIds.push(entry.assignmentId);
      availableAssignments = availableAssignments.filter((assignment) => assignment.id !== entry.assignmentId);
      return { queued: true, response: null };
    });
    jest.spyOn(Alert, "alert").mockImplementation((title, _message, buttons) => {
      const choice = title === "Resume Lessons?" ? "Resume" : "Exit";
      buttons?.find((button) => button.text === choice)?.onPress?.();
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([false, true])("resumes only the two unfinished picked lessons (older save: %s)", async (hasOlderSave) => {
    if (hasOlderSave) {
      const ordinary = await mountLessons();
      await screen.findByText("Lesson 2001");
      ordinary.unmount();
    }

    const picked = await mountLessons([1001, 1002, 1003, 1004, 1005, 1006, 1007]);
    await startQuiz(5);
    for (let index = 0; index < 10; index += 1) {
      await answerCorrectly();
    }
    await screen.findByText("Batch Complete!");
    expect(completedAssignmentIds).toEqual([1001, 1002, 1003, 1004, 1005]);
    fireEvent.press(screen.getByText("Next batch"));
    fireEvent.press(screen.getByText("Exit lessons"));
    expect(router.replace).toHaveBeenCalled();
    picked.unmount();

    await mountLessons();
    await screen.findByText("Lesson 2006");
    expect(Alert.alert).toHaveBeenCalledWith(
      "Resume Lessons?", expect.any(String), expect.any(Array), { cancelable: false }
    );
    expect(screen.getByText("Batch: 2006,2007")).toBeTruthy();
  });

  it("resumes an interrupted picked quiz at its unanswered reading and clears the finished session", async () => {
    const picked = await mountLessons([1002, 1007]);
    await startQuiz(2);
    await answerCorrectly();
    await answerCorrectly();
    await answerCorrectly();
    expect(screen.getByText("Question 2007: reading")).toBeTruthy();
    expect(completedAssignmentIds).toEqual([1002]);
    fireEvent.press(screen.getByText("Exit quiz"));
    picked.unmount();

    const resumed = await mountLessons();
    expect(screen.getByText("Question 2007: reading")).toBeTruthy();
    await answerCorrectly();
    expect(completedAssignmentIds).toEqual([1002, 1007]);
    await screen.findByText("Lessons Complete!");
    await act(async () => {
      fireEvent.press(screen.getByText("Finish"));
    });
    resumed.unmount();

    jest.mocked(Alert.alert).mockClear();
    await mountLessons();
    expect(screen.getByText("Lesson 2001")).toBeTruthy();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it.each(["empty", "failed"])("retains the previous session when the new picked session is %s", async (result) => {
    const ordinary = await mountLessons();
    await screen.findByText("Lesson 2001");
    fireEvent.press(screen.getByText("Next lesson"));
    ordinary.unmount();

    if (result === "empty") {
      jest.mocked(getAvailableLessons).mockResolvedValueOnce({
        object: "collection",
        url: "https://api.wanikani.com/v2/assignments",
        pages: { per_page: 500, next_url: null, previous_url: null },
        total_count: 0,
        data_updated_at: "2026-09-08T00:00:00Z",
        data: [],
      });
    } else {
      jest.spyOn(console, "error").mockImplementation(() => {});
      jest.mocked(getAvailableLessons).mockRejectedValueOnce(new Error("Network unavailable"));
    }
    const picked = await mountLessons([1009]);
    expect(screen.getByText("No lessons available")).toBeTruthy();
    picked.unmount();

    jest.mocked(Alert.alert).mockClear();
    await mountLessons();
    expect(screen.getByText("Lesson 2002")).toBeTruthy();
    expect(screen.getByText("Batch: 2001,2002,2003,2004,2005")).toBeTruthy();
    expect(Alert.alert).toHaveBeenCalledWith(
      "Resume Lessons?", expect.any(String), expect.any(Array), { cancelable: false }
    );
  });

  it("keeps the picked assignments when the available lesson list changes order and membership", async () => {
    availableAssignments = [assignments[9], assignments[6], assignments[2], assignments[1]];

    await mountLessons([1002, 1007]);

    expect(screen.getByText("Batch: 2002,2007")).toBeTruthy();
  });

  it("drops an unavailable picked assignment without substituting an unpicked lesson", async () => {
    availableAssignments = assignments.filter((assignment) => assignment.id !== 1002);

    await mountLessons([1002, 1007]);

    expect(screen.getByText("Batch: 2007")).toBeTruthy();
  });
});
