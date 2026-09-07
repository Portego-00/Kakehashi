import { act, render, waitFor } from "@testing-library/react-native";
import React from "react";

import type ReviewQuestionScreen from "../../src/components/ReviewQuestionScreen";
import ReviewScreen from "../(app)/reviews";

let mockQuestionProps: React.ComponentProps<typeof ReviewQuestionScreen> | null = null;
const mockQueueProgress = jest.fn();
const mockRefresh = jest.fn(async () => {});
const mockSubject = {
  id: 1,
  object: "vocabulary",
  data: {
    characters: "学校",
    level: 1,
    meanings: [{ meaning: "school", primary: true, accepted_answer: true }],
    readings: [{ reading: "がっこう", primary: true, accepted_answer: true }],
  },
};
const mockDashboard = {
  currentLevel: 1,
  subjects: [mockSubject],
  assignments: [{
    id: 10,
    data: { subject_id: 1, srs_stage: 3, available_at: "2020-01-01T00:00:00Z" },
  }],
};

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: jest.fn(), dismissAll: jest.fn() },
}));
jest.mock("@react-navigation/native", () => ({ useIsFocused: () => true }));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("../../src/contexts/AuthContext", () => ({
  useSession: () => ({ isLoading: false }),
}));
jest.mock("../../src/hooks/useDashboardData", () => ({
  useDashboardData: () => ({
    dashboardData: mockDashboard,
    refreshLessonsAndReviews: mockRefresh,
    refreshRecentMistakes: mockRefresh,
  }),
}));
jest.mock("../../src/hooks/useBluetoothAudioKeepAlive", () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock("../../src/hooks/useActivityTracking", () => ({ useActivityTracking: jest.fn() }));
jest.mock("../../src/utils/store", () => ({
  useAuthStore: () => ({ apiToken: "test-token" }),
  useSettingsStore: () => ({
    ankiCardMode: false,
    ankiGroupQuestions: false,
    ankiCardModeScope: "both",
    reviewOrder: "lowestLevelFirst",
    reviewTypeOrderEnabled: false,
    prioritizeCriticalItems: false,
    acceptUserSynonymsAsAnswers: false,
    backToBackQuestions: true,
    reviewQuestionOrderEnabled: true,
    meaningFirst: true,
    srsProgressionCardDisplayMode: "hidden",
    backToBackImmediateRetryIncorrect: true,
    reviewBatchSizeEnabled: false,
    reviewWrapUpTargetSubjects: 10,
    autoplayVocabularyAudio: false,
    showAnswerStopSubjectDetails: false,
    showVocabContextSentencesInReviews: false,
  }),
}));
jest.mock("../../src/utils/theme", () => ({
  useTheme: () => ({
    theme: { backgroundColor: "#fff", textColor: "#111", secondary: "#666" },
  }),
}));
jest.mock("../../src/utils/api", () => ({
  ApiError: Error,
  getReviewCount: jest.fn(async () => 1),
  isAssignmentInReviewQueueState: () => true,
  isRateLimitError: () => false,
  isUnauthorizedError: () => false,
}));
jest.mock("../../src/utils/cache", () => ({ getAllSubjects: jest.fn() }));
jest.mock("../../src/services/errorService", () => ({
  errorService: { logError: jest.fn() },
}));
jest.mock("../../src/services/offlineStudyProgressService", () => ({
  getPendingProgressAssignmentIds: jest.fn(async () => ({
    lesson: new Set(), review: new Set(),
  })),
  getPendingProgressCounts: jest.fn(async () => ({ lesson: 0, review: 0 })),
  queueProgressAndAttemptSend: (...args: unknown[]) => mockQueueProgress(...args),
  syncPendingProgress: jest.fn(async () => ({ sent: 0 })),
}));
jest.mock("../../src/services/studyProgressAssignmentCacheService", () => ({
  markReviewSubmittedInAssignmentCaches: jest.fn(async () => {}),
}));
jest.mock("../../src/components/ReviewQuestionScreen", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    __esModule: true,
    default: (props: typeof mockQuestionProps) => {
      mockQuestionProps = props;
      return <Text testID="accounting-question">{props?.questionType}</Text>;
    },
  };
});
jest.mock("../../src/components/ReviewResultsScreen", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return { __esModule: true, default: () => <Text>Results</Text> };
});

function currentQuestion() {
  if (!mockQuestionProps) throw new Error("Review question has not loaded");
  return mockQuestionProps;
}

async function answerCurrent(isCorrect: boolean, wasIncorrect = false) {
  const question = currentQuestion();
  await act(async () => {
    question.onAnswer(question.item, question.questionType, isCorrect, wasIncorrect, false);
  });
}

describe("review parent manual-correction accounting", () => {
  beforeEach(() => {
    mockQuestionProps = null;
    mockQueueProgress.mockReset();
    mockQueueProgress.mockResolvedValue({
      queued: false,
      response: {
        data: { starting_srs_stage: 3, ending_srs_stage: 4 },
        resources_updated: {
          assignment: { data: { srs_stage: 4, available_at: "2030-01-01T00:00:00Z" } },
        },
      },
    });
  });

  it.each([false, true])(
    "submits no mistakes for two correct overrides (retry flag %s)",
    async (wasIncorrect) => {
      const screen = render(<ReviewScreen />);
      await screen.findByTestId("accounting-question");
      await answerCurrent(true, wasIncorrect);
      await answerCurrent(true, wasIncorrect);

      await waitFor(() => expect(mockQueueProgress).toHaveBeenCalledTimes(1));
      expect(mockQueueProgress).toHaveBeenCalledWith("test-token", expect.objectContaining({
        assignmentId: 10,
        meaningIncorrectCount: 0,
        readingIncorrectCount: 0,
      }));
      screen.unmount();
    },
  );

  it("retains an earlier recorded mistake without adding one for a later correct override", async () => {
    const screen = render(<ReviewScreen />);
    await screen.findByTestId("accounting-question");
    expect(currentQuestion().questionType).toBe("meaning");
    await answerCurrent(false, true);
    await answerCurrent(true);
    await answerCurrent(true);

    await waitFor(() => expect(mockQueueProgress).toHaveBeenCalledTimes(1));
    expect(mockQueueProgress).toHaveBeenCalledWith("test-token", expect.objectContaining({
      assignmentId: 10,
      meaningIncorrectCount: 1,
      readingIncorrectCount: 0,
    }));
    screen.unmount();
  });
});
