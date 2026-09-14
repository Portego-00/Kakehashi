import { act, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import type ReviewQuestionScreen from "../../src/components/ReviewQuestionScreen";
import ReviewScreen from "../(app)/reviews";

let mockQuestionProps: React.ComponentProps<
  typeof ReviewQuestionScreen
> | null = null;
const mockQueueProgress = jest.fn();
const mockPersistProgress = jest.fn(
  async (_payload: unknown): Promise<void> => {},
);
const mockGetReviewCount = jest.fn(async (_apiToken: string) => 1);
const mockGetSubjects = jest.fn(
  async (
    _apiToken: string,
    _params?: { ids?: number[] },
  ): Promise<{ data: unknown[] }> => ({ data: [] }),
);
const mockMarkReviewSubmittedInAssignmentCaches = jest.fn(
  async (..._args: unknown[]) => {},
);
const mockRefresh = jest.fn(async () => {});
let mockAnkiCardMode = false;
let mockAnkiGroupQuestions = false;
let mockReviewBatchSizeEnabled = false;
let mockReviewBatchSize = 5;
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
  assignments: [
    {
      id: 10,
      data: {
        subject_id: 1,
        srs_stage: 3,
        available_at: "2020-01-01T00:00:00Z",
      },
    },
  ],
};
const mockGetAvailableReviews = jest.fn(async (_apiToken: string) => ({
  data: mockDashboard.assignments,
}));
const mockGetCachedAvailableReviews = jest.fn(
  async () =>
    null as {
      data: typeof mockDashboard.assignments;
    } | null,
);
const mockGetLiveAvailableReviews = jest.fn(async (_apiToken: string) => ({
  data: mockDashboard.assignments,
}));
const mockGetPendingProgressAssignmentIds = jest.fn(async () => ({
  lesson: new Set<number>(),
  review: new Set<number>(),
}));
const mockGetStudyMaterials = jest.fn(async () => ({ data: [] }));
const mockGetCachedStudyMaterials = jest.fn(async () => []);
let mockAcceptUserSynonymsAsAnswers = false;

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
jest.mock("../../src/hooks/useActivityTracking", () => ({
  useActivityTracking: jest.fn(),
}));
jest.mock("../../src/utils/store", () => ({
  useAuthStore: () => ({ apiToken: "test-token" }),
  useSettingsStore: () => ({
    ankiCardMode: mockAnkiCardMode,
    ankiGroupQuestions: mockAnkiGroupQuestions,
    ankiCardModeScope: "both",
    reviewOrder: "lowestLevelFirst",
    reviewTypeOrderEnabled: false,
    prioritizeCriticalItems: false,
    acceptUserSynonymsAsAnswers: mockAcceptUserSynonymsAsAnswers,
    backToBackQuestions: true,
    reviewQuestionOrderEnabled: true,
    meaningFirst: true,
    srsProgressionCardDisplayMode: "hidden",
    backToBackImmediateRetryIncorrect: true,
    reviewBatchSizeEnabled: mockReviewBatchSizeEnabled,
    reviewBatchSize: mockReviewBatchSize,
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
  getAvailableReviews: (apiToken: string) => mockGetAvailableReviews(apiToken),
  getCachedAvailableReviews: () => mockGetCachedAvailableReviews(),
  getLiveAvailableReviews: (apiToken: string) =>
    mockGetLiveAvailableReviews(apiToken),
  getReviewCount: (apiToken: string) => mockGetReviewCount(apiToken),
  getSubjects: (apiToken: string, params?: { ids?: number[] }) =>
    mockGetSubjects(apiToken, params),
  getStudyMaterials: (...args: unknown[]) => mockGetStudyMaterials(...args),
  isAssignmentInReviewQueueState: () => true,
  isRateLimitError: () => false,
  isUnauthorizedError: () => false,
}));
jest.mock("../../src/utils/cache", () => ({
  getAllSubjects: jest.fn(),
  getStudyMaterialsFromPermanentCache: (subjectIds: number[]) =>
    mockGetCachedStudyMaterials(subjectIds),
}));
jest.mock("../../src/services/errorService", () => ({
  errorService: { logError: jest.fn() },
}));
jest.mock("../../src/services/offlineStudyProgressService", () => ({
  attemptPendingProgressSend: (...args: unknown[]) =>
    mockQueueProgress(...args),
  getPendingProgressAssignmentIds: () => mockGetPendingProgressAssignmentIds(),
  getPendingProgressCounts: jest.fn(async () => ({ lesson: 0, review: 0 })),
  queueProgress: (_token: string, payload: unknown) =>
    mockPersistProgress(payload),
  queueProgressAndAttemptSend: (...args: unknown[]) =>
    mockQueueProgress(...args),
  syncPendingProgress: jest.fn(async () => ({ sent: 0 })),
}));
jest.mock("../../src/services/studyProgressAssignmentCacheService", () => ({
  markReviewSubmittedInAssignmentCaches: (...args: unknown[]) =>
    mockMarkReviewSubmittedInAssignmentCaches(...args),
}));
jest.mock("../../src/components/ReviewQuestionScreen", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text } =
    jest.requireActual<typeof import("react-native")>("react-native");
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
  const { Text } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    __esModule: true,
    default: ({ submittingResults }: { submittingResults: boolean }) => (
      <Text>{submittingResults ? "Submitting" : "Results"}</Text>
    ),
  };
});

function currentQuestion() {
  if (!mockQuestionProps) throw new Error("Review question has not loaded");
  return mockQuestionProps;
}

async function answerCurrent(isCorrect: boolean, wasIncorrect = false) {
  const question = currentQuestion();
  await act(async () => {
    question.onAnswer(
      question.item,
      question.questionType,
      isCorrect,
      wasIncorrect,
      false,
    );
  });
}

async function answerCurrentAndWaitForNextQuestion() {
  const previousQuestionKey = `${currentQuestion().item.id}:${currentQuestion().questionType}`;
  await answerCurrent(true);
  await waitFor(() => {
    const nextQuestionKey = `${currentQuestion().item.id}:${currentQuestion().questionType}`;
    expect(nextQuestionKey).not.toBe(previousQuestionKey);
  });
}

function addCachedReviews(totalCount: number) {
  for (let index = 1; index < totalCount; index += 1) {
    mockDashboard.subjects.push({
      ...mockSubject,
      id: index + 1,
      data: { ...mockSubject.data, characters: `subject-${index + 1}` },
    });
    mockDashboard.assignments.push({
      id: 10 + index,
      data: {
        subject_id: index + 1,
        srs_stage: 3,
        available_at: "2020-01-01T00:00:00Z",
      },
    });
  }
}

describe("review parent manual-correction accounting", () => {
  beforeEach(() => {
    mockDashboard.subjects.splice(1);
    mockDashboard.assignments.splice(1);
    mockAnkiCardMode = false;
    mockAnkiGroupQuestions = false;
    mockReviewBatchSizeEnabled = false;
    mockReviewBatchSize = 5;
    mockAcceptUserSynonymsAsAnswers = false;
    mockQuestionProps = null;
    mockQueueProgress.mockReset();
    mockPersistProgress.mockReset();
    mockPersistProgress.mockResolvedValue(undefined);
    mockGetReviewCount.mockReset();
    mockGetReviewCount.mockResolvedValue(1);
    mockGetSubjects.mockReset();
    mockGetSubjects.mockResolvedValue({ data: [] });
    mockGetStudyMaterials.mockReset();
    mockGetStudyMaterials.mockResolvedValue({ data: [] });
    mockGetCachedStudyMaterials.mockReset();
    mockGetCachedStudyMaterials.mockResolvedValue([]);
    mockMarkReviewSubmittedInAssignmentCaches.mockReset();
    mockMarkReviewSubmittedInAssignmentCaches.mockResolvedValue(undefined);
    mockGetAvailableReviews.mockReset();
    mockGetAvailableReviews.mockResolvedValue({
      data: mockDashboard.assignments,
    });
    mockGetCachedAvailableReviews.mockReset();
    mockGetCachedAvailableReviews.mockResolvedValue(null);
    mockGetLiveAvailableReviews.mockReset();
    mockGetLiveAvailableReviews.mockResolvedValue({
      data: mockDashboard.assignments,
    });
    mockGetPendingProgressAssignmentIds.mockReset();
    mockGetPendingProgressAssignmentIds.mockResolvedValue({
      lesson: new Set<number>(),
      review: new Set<number>(),
    });
    mockQueueProgress.mockResolvedValue({
      queued: false,
      response: {
        data: { starting_srs_stage: 3, ending_srs_stage: 4 },
        resources_updated: {
          assignment: {
            data: { srs_stage: 4, available_at: "2030-01-01T00:00:00Z" },
          },
        },
      },
    });
  });

  it("renders cached assignments while live reconciliation is still pending", async () => {
    mockGetLiveAvailableReviews.mockImplementation(() => new Promise(() => {}));

    const screen = render(<ReviewScreen />);

    await screen.findByTestId("accounting-question", {}, { timeout: 500 });
    expect(currentQuestion().item.id).toBe(10);
    expect(mockGetLiveAvailableReviews).toHaveBeenCalledWith("test-token");
    screen.unmount();
  });

  it.each([
    { label: "without a batch limit", batchSize: undefined },
    { label: "with a 1-item batch", batchSize: 1 },
    { label: "with a 5-item batch", batchSize: 5 },
  ])(
    "keeps the first visible question when an unchanged live queue refreshes $label",
    async ({ batchSize }) => {
      mockReviewBatchSizeEnabled = batchSize !== undefined;
      mockReviewBatchSize = batchSize ?? 5;
      const availableCount = (batchSize ?? 5) + 1;
      const expectedBatchCount = batchSize ?? availableCount;
      addCachedReviews(availableCount);
      let finishLiveReviews:
        | ((response: { data: typeof mockDashboard.assignments }) => void)
        | undefined;
      mockGetLiveAvailableReviews.mockImplementation(
        () =>
          new Promise((resolve) => {
            finishLiveReviews = resolve;
          }),
      );
      const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.99);
      const screen = render(<ReviewScreen />);

      try {
        await screen.findByTestId("accounting-question");
        expect(currentQuestion().item.id).toBe(10);
        const firstQuestionType = currentQuestion().questionType;
        expect(currentQuestion().totalItems).toBe(expectedBatchCount);

        // The response contains exactly the same due reviews. Only the random
        // tie-break order changes between the cached and live preparations.
        randomSpy.mockReturnValue(0);
        await act(async () => {
          finishLiveReviews?.({ data: [...mockDashboard.assignments] });
        });

        expect(mockGetLiveAvailableReviews).toHaveBeenCalledTimes(1);
        expect(mockGetPendingProgressAssignmentIds).toHaveBeenCalledTimes(2);
        expect(currentQuestion().item.id).toBe(10);
        expect(currentQuestion().questionType).toBe(firstQuestionType);
        expect(currentQuestion().totalItems).toBe(expectedBatchCount);
        expect(mockPersistProgress).not.toHaveBeenCalled();

        // The rest of the selected batch must stay stable as well.
        for (let index = 0; index < expectedBatchCount; index += 1) {
          expect(currentQuestion().item.id).toBe(10 + index);
          await answerCurrent(true);
          expect(currentQuestion().item.id).toBe(10 + index);
          await answerCurrent(true);
        }
        await screen.findByText("Results");
        expect(mockPersistProgress).toHaveBeenCalledTimes(expectedBatchCount);
      } finally {
        screen.unmount();
        randomSpy.mockRestore();
      }
    },
  );

  it.each([10, 11])(
    "replaces stale assignment %i without replacing eligible members of the batch",
    async (staleAssignmentId) => {
      mockReviewBatchSizeEnabled = true;
      addCachedReviews(7);
      let finishLiveReviews:
        | ((response: { data: typeof mockDashboard.assignments }) => void)
        | undefined;
      mockGetLiveAvailableReviews.mockImplementation(
        () =>
          new Promise((resolve) => {
            finishLiveReviews = resolve;
          }),
      );
      const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.99);
      const screen = render(<ReviewScreen />);

      try {
        await screen.findByTestId("accounting-question");
        expect(currentQuestion().item.id).toBe(10);
        randomSpy.mockReturnValue(0);
        await act(async () => {
          finishLiveReviews?.({
            data: mockDashboard.assignments.filter(
              (assignment) => assignment.id !== staleAssignmentId,
            ),
          });
        });

        const expectedAssignmentIds = [10, 11, 12, 13, 14, 15].filter(
          (id) => id !== staleAssignmentId,
        );
        expect(currentQuestion().totalItems).toBe(5);
        for (const assignmentId of expectedAssignmentIds) {
          expect(currentQuestion().item.id).toBe(assignmentId);
          await answerCurrent(true);
          expect(currentQuestion().item.id).toBe(assignmentId);
          await answerCurrent(true);
        }
        await screen.findByText("Results");
        expect(mockPersistProgress).toHaveBeenCalledTimes(5);
        expectedAssignmentIds.forEach((assignmentId, index) => {
          expect(mockPersistProgress).toHaveBeenNthCalledWith(
            index + 1,
            expect.objectContaining({ assignmentId }),
          );
        });
      } finally {
        screen.unmount();
        randomSpy.mockRestore();
      }
    },
  );

  it("starts from durable assignments while the dashboard provider is still cold", async () => {
    const originalAssignments = [...mockDashboard.assignments];
    mockDashboard.assignments.splice(0);
    mockGetCachedAvailableReviews.mockResolvedValue({
      data: originalAssignments,
    });
    mockGetLiveAvailableReviews.mockImplementation(() => new Promise(() => {}));

    const screen = render(<ReviewScreen />);

    try {
      await screen.findByTestId("accounting-question", {}, { timeout: 500 });
      expect(currentQuestion().item.id).toBe(10);
      expect(mockGetCachedAvailableReviews).toHaveBeenCalledTimes(1);
      expect(mockGetAvailableReviews).not.toHaveBeenCalled();
      expect(mockGetLiveAvailableReviews).toHaveBeenCalledWith("test-token");
    } finally {
      screen.unmount();
      mockDashboard.assignments.splice(0, 0, ...originalAssignments);
    }
  });

  it("keeps the cached queue when live reconciliation fails", async () => {
    mockDashboard.assignments.push({
      id: 12,
      data: {
        subject_id: 1,
        srs_stage: 3,
        available_at: "2020-01-01T00:00:00Z",
      },
    });
    mockGetLiveAvailableReviews.mockRejectedValue(new Error("offline"));
    mockGetAvailableReviews.mockResolvedValue({
      data: [mockDashboard.assignments[0]],
    });

    const screen = render(<ReviewScreen />);
    await screen.findByTestId("accounting-question");
    await waitFor(() =>
      expect(mockGetLiveAvailableReviews).toHaveBeenCalledWith("test-token"),
    );

    const firstAssignmentId = currentQuestion().item.id;
    expect([10, 12]).toContain(firstAssignmentId);

    await answerCurrentAndWaitForNextQuestion();
    expect(currentQuestion().item.id).toBe(firstAssignmentId);
    await answerCurrentAndWaitForNextQuestion();
    const remainingAssignmentId = firstAssignmentId === 10 ? 12 : 10;
    await waitFor(() =>
      expect(currentQuestion().item.id).toBe(remainingAssignmentId),
    );
    expect(mockGetAvailableReviews).not.toHaveBeenCalled();
    screen.unmount();
  });

  it("renders cached assignments while fresh user synonyms are still loading", async () => {
    mockAcceptUserSynonymsAsAnswers = true;
    mockGetStudyMaterials.mockImplementation(() => new Promise(() => {}));

    const screen = render(<ReviewScreen />);

    await screen.findByTestId("accounting-question", {}, { timeout: 500 });
    expect(currentQuestion().item.id).toBe(10);
    expect(mockGetCachedStudyMaterials).toHaveBeenCalledWith([1]);
    expect(mockGetStudyMaterials).toHaveBeenCalledWith(
      "test-token",
      { subject_ids: [1] },
      { skipCache: true },
    );
    screen.unmount();
  });

  it("keeps cached synonyms without a false alert when freshness fails", async () => {
    mockAcceptUserSynonymsAsAnswers = true;
    mockGetCachedStudyMaterials.mockResolvedValue([
      {
        data: {
          subject_id: 1,
          meaning_synonyms: ["academy"],
          meaning_note: "",
          reading_note: "",
        },
      },
    ]);
    mockGetStudyMaterials.mockRejectedValue(new Error("offline"));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

    try {
      const screen = render(<ReviewScreen />);
      await screen.findByTestId("accounting-question");
      await waitFor(() => expect(mockGetStudyMaterials).toHaveBeenCalled());
      expect(currentQuestion().studyMaterials?.meaning_synonyms).toEqual([
        "academy",
      ]);
      expect(alertSpy).not.toHaveBeenCalledWith(
        "User Synonyms Unavailable",
        expect.any(String),
      );
      screen.unmount();
    } finally {
      alertSpy.mockRestore();
    }
  });

  it("waits for fresh synonyms before exposing reviews when the durable cache is incomplete", async () => {
    mockAcceptUserSynonymsAsAnswers = true;
    mockGetCachedStudyMaterials.mockResolvedValue(null);
    mockGetLiveAvailableReviews.mockImplementation(() => new Promise(() => {}));
    let finishFreshMaterials:
      ((response: { data: unknown[] }) => void) | undefined;
    mockGetStudyMaterials.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishFreshMaterials = resolve;
        }),
    );

    const screen = render(<ReviewScreen />);

    await waitFor(() => expect(mockGetStudyMaterials).toHaveBeenCalled());
    expect(screen.queryByTestId("accounting-question")).toBeNull();

    await act(async () => {
      finishFreshMaterials?.({
        data: [
          {
            data: {
              subject_id: 1,
              meaning_synonyms: ["academy"],
              meaning_note: "",
              reading_note: "",
            },
          },
        ],
      });
      await Promise.resolve();
    });

    await screen.findByTestId("accounting-question");
    expect(currentQuestion().studyMaterials?.meaning_synonyms).toEqual([
      "academy",
    ]);
    screen.unmount();
  });

  it("keeps study-material edits made while background freshness is loading", async () => {
    mockAcceptUserSynonymsAsAnswers = true;
    mockGetCachedStudyMaterials.mockResolvedValue([
      {
        data: {
          subject_id: 1,
          meaning_synonyms: ["cached synonym"],
          meaning_note: "",
          reading_note: "",
        },
      },
    ]);
    let finishFreshMaterials:
      ((response: { data: unknown[] }) => void) | undefined;
    mockGetStudyMaterials.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishFreshMaterials = resolve;
        }),
    );

    const screen = render(<ReviewScreen />);
    await screen.findByTestId("accounting-question");
    await waitFor(() =>
      expect(currentQuestion().studyMaterials?.meaning_synonyms).toEqual([
        "cached synonym",
      ]),
    );

    act(() => {
      currentQuestion().onSynonymAdded?.(1, ["new local synonym"]);
    });
    await waitFor(() =>
      expect(currentQuestion().studyMaterials?.meaning_synonyms).toEqual([
        "new local synonym",
      ]),
    );

    await act(async () => {
      finishFreshMaterials?.({
        data: [
          {
            data: {
              subject_id: 1,
              meaning_synonyms: ["older server synonym"],
              meaning_note: "",
              reading_note: "",
            },
          },
        ],
      });
      await Promise.resolve();
    });

    expect(currentQuestion().studyMaterials?.meaning_synonyms).toEqual([
      "new local synonym",
    ]);
    screen.unmount();
  });

  it("keeps materials loaded for a review added while initial freshness is pending", async () => {
    mockAcceptUserSynonymsAsAnswers = true;
    mockDashboard.subjects.push({
      ...mockSubject,
      id: 2,
      data: { ...mockSubject.data, characters: "先生" },
    });
    mockGetLiveAvailableReviews.mockResolvedValue({
      data: [
        mockDashboard.assignments[0],
        {
          id: 11,
          data: {
            subject_id: 2,
            srs_stage: 3,
            available_at: "2020-01-01T00:00:00Z",
          },
        },
      ],
    });

    const materialResolvers: ((response: { data: unknown[] }) => void)[] = [];
    mockGetStudyMaterials.mockImplementation(
      () =>
        new Promise((resolve) => {
          materialResolvers.push(resolve);
        }),
    );

    const screen = render(<ReviewScreen />);
    await screen.findByTestId("accounting-question");
    await waitFor(() => expect(mockGetStudyMaterials).toHaveBeenCalledTimes(2));
    expect(currentQuestion().totalItems).toBe(1);

    await act(async () => {
      materialResolvers[1]?.({
        data: [
          {
            data: {
              subject_id: 2,
              meaning_synonyms: ["teacher"],
              meaning_note: "live material",
              reading_note: "",
            },
          },
        ],
      });
      await Promise.resolve();
    });
    await waitFor(() => expect(currentQuestion().totalItems).toBe(2));
    await act(async () => {
      materialResolvers[0]?.({
        data: [
          {
            data: {
              subject_id: 1,
              meaning_synonyms: ["academy"],
              meaning_note: "initial material",
              reading_note: "",
            },
          },
          {
            data: {
              subject_id: 2,
              meaning_synonyms: ["stale teacher"],
              meaning_note: "stale initial material",
              reading_note: "",
            },
          },
        ],
      });
      await Promise.resolve();
    });

    await answerCurrentAndWaitForNextQuestion();
    await answerCurrentAndWaitForNextQuestion();
    await waitFor(() => expect(currentQuestion().item.id).toBe(11));
    expect(currentQuestion().studyMaterials?.meaning_synonyms).toEqual([
      "teacher",
    ]);
    screen.unmount();
  });

  it("replaces unanswered stale cached work with the live queue", async () => {
    mockDashboard.assignments.push({
      id: 12,
      data: {
        subject_id: 1,
        srs_stage: 3,
        available_at: "2020-01-01T00:00:00Z",
      },
    });
    mockGetLiveAvailableReviews.mockResolvedValue({
      data: [
        {
          id: 11,
          data: {
            subject_id: 1,
            srs_stage: 4,
            available_at: "2020-01-01T00:00:00Z",
          },
        },
      ],
    });

    const screen = render(<ReviewScreen />);
    await screen.findByTestId("accounting-question");
    await waitFor(() => expect(currentQuestion().item.id).toBe(11));
    await answerCurrent(true);
    await answerCurrent(true);
    await waitFor(() => expect(screen.getByText("Results")).toBeTruthy());

    expect(
      mockPersistProgress.mock.calls.map(
        ([payload]) => (payload as { assignmentId: number }).assignmentId,
      ),
    ).toEqual([11]);
    screen.unmount();
  });

  it("preserves an answer made while a new live subject is loading", async () => {
    const newSubject = {
      ...mockSubject,
      id: 2,
      data: { ...mockSubject.data, characters: "先生" },
    };
    let finishSubjectFetch:
      ((response: { data: unknown[] }) => void) | undefined;
    mockGetLiveAvailableReviews.mockResolvedValue({
      data: [
        mockDashboard.assignments[0],
        {
          id: 11,
          data: {
            subject_id: 2,
            srs_stage: 3,
            available_at: "2020-01-01T00:00:00Z",
          },
        },
      ],
    });
    mockGetSubjects.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSubjectFetch = resolve;
        }),
    );

    const screen = render(<ReviewScreen />);
    await screen.findByTestId("accounting-question");
    await waitFor(() => expect(mockGetSubjects).toHaveBeenCalled());

    await answerCurrent(true);
    expect(currentQuestion().questionType).toBe("reading");

    await act(async () => {
      finishSubjectFetch?.({ data: [newSubject] });
      await Promise.resolve();
    });
    await answerCurrent(true);

    await waitFor(() => expect(currentQuestion().item.id).toBe(11));
    expect(mockPersistProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        assignmentId: 10,
        meaningIncorrectCount: 0,
        readingIncorrectCount: 0,
      }),
    );
    screen.unmount();
  });

  it("keeps live queue additions when a completed answer is still being saved", async () => {
    let finishLiveRefresh:
      | ((response: { data: typeof mockDashboard.assignments }) => void)
      | undefined;
    let finishPersistence: (() => void) | undefined;
    mockGetLiveAvailableReviews.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishLiveRefresh = resolve;
        }),
    );
    mockPersistProgress.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishPersistence = resolve;
        }),
    );

    const screen = render(<ReviewScreen />);
    await screen.findByTestId("accounting-question");
    await answerCurrent(true);

    const completionQuestion = currentQuestion();
    act(() => {
      completionQuestion.onAnswer(
        completionQuestion.item,
        completionQuestion.questionType,
        true,
        false,
        false,
      );
    });
    await waitFor(() => expect(mockPersistProgress).toHaveBeenCalledTimes(1));

    await act(async () => {
      finishLiveRefresh?.({
        data: [
          mockDashboard.assignments[0],
          {
            id: 11,
            data: {
              subject_id: 1,
              srs_stage: 3,
              available_at: "2020-01-01T00:00:00Z",
            },
          },
        ],
      });
      await Promise.resolve();
    });
    expect(currentQuestion().item.id).toBe(10);
    expect(currentQuestion().questionType).toBe("reading");

    await act(async () => {
      finishPersistence?.();
      await Promise.resolve();
    });

    await waitFor(() => expect(currentQuestion().item.id).toBe(11));
    expect(currentQuestion().questionType).toBe("meaning");
    await answerCurrent(true);
    await answerCurrent(true);
    await waitFor(() => expect(screen.getByText("Results")).toBeTruthy());
    expect(
      mockPersistProgress.mock.calls.map(
        ([payload]) => (payload as { assignmentId: number }).assignmentId,
      ),
    ).toEqual([10, 11]);
    screen.unmount();
  });

  it("keeps an in-flight question retryable when persistence fails after live reconciliation", async () => {
    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation(() => undefined);
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    let finishLiveRefresh:
      | ((response: { data: typeof mockDashboard.assignments }) => void)
      | undefined;
    let rejectPersistence: ((reason: Error) => void) | undefined;
    mockGetLiveAvailableReviews.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishLiveRefresh = resolve;
        }),
    );
    mockPersistProgress.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectPersistence = reject;
        }),
    );

    const screen = render(<ReviewScreen />);
    await screen.findByTestId("accounting-question");
    await answerCurrent(true);

    const completionQuestion = currentQuestion();
    act(() => {
      void completionQuestion.onAnswer(
        completionQuestion.item,
        completionQuestion.questionType,
        true,
        false,
        false,
      );
    });
    await waitFor(() => expect(mockPersistProgress).toHaveBeenCalledTimes(1));

    await act(async () => {
      finishLiveRefresh?.({
        data: [
          mockDashboard.assignments[0],
          {
            id: 11,
            data: {
              subject_id: 1,
              srs_stage: 3,
              available_at: "2020-01-01T00:00:00Z",
            },
          },
        ],
      });
      await Promise.resolve();
    });
    expect(currentQuestion().item.id).toBe(10);
    expect(currentQuestion().questionType).toBe("reading");

    await act(async () => {
      rejectPersistence?.(new Error("database unavailable"));
      await Promise.resolve();
    });
    const retryAlert = await waitFor(() => {
      const alert = alertSpy.mock.calls.find(
        ([title]) => title === "Couldn't Save Review",
      );
      expect(alert).toBeDefined();
      return alert;
    });
    expect(currentQuestion().item.id).toBe(10);
    expect(currentQuestion().questionType).toBe("reading");

    await act(async () => {
      await Promise.resolve();
      retryAlert?.[2]?.[0]?.onPress?.();
    });

    await waitFor(() => expect(mockPersistProgress).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(currentQuestion().item.id).toBe(11));
    expect(mockQueueProgress).toHaveBeenCalledTimes(1);

    consoleErrorSpy.mockRestore();
    alertSpy.mockRestore();
    screen.unmount();
  });

  it("checks the live queue when every cached review is already pending", async () => {
    mockGetPendingProgressAssignmentIds.mockResolvedValue({
      lesson: new Set<number>(),
      review: new Set([10]),
    });
    mockGetLiveAvailableReviews.mockResolvedValue({
      data: [
        {
          id: 11,
          data: {
            subject_id: 1,
            srs_stage: 3,
            available_at: "2020-01-01T00:00:00Z",
          },
        },
      ],
    });

    const screen = render(<ReviewScreen />);

    await screen.findByTestId("accounting-question");
    expect(mockGetReviewCount).not.toHaveBeenCalled();
    expect(mockGetLiveAvailableReviews).toHaveBeenCalledWith("test-token");
    expect(currentQuestion().item.id).toBe(11);
    screen.unmount();
  });

  it("shows an empty queue rather than a generic error when pending reviews cannot refresh offline", async () => {
    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation(() => undefined);
    const consoleWarnSpy = jest
      .spyOn(console, "warn")
      .mockImplementation(() => {});
    mockGetPendingProgressAssignmentIds.mockResolvedValue({
      lesson: new Set<number>(),
      review: new Set([10]),
    });
    mockGetLiveAvailableReviews.mockRejectedValue(new Error("offline"));

    const screen = render(<ReviewScreen />);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "No Reviews Available",
        "You don't have any reviews available right now.",
        expect.any(Array),
      );
    });
    expect(screen.queryByTestId("accounting-question")).toBeNull();
    expect(mockGetReviewCount).not.toHaveBeenCalled();
    expect(alertSpy.mock.calls.some(([title]) => title === "Error")).toBe(
      false,
    );

    consoleWarnSpy.mockRestore();
    alertSpy.mockRestore();
    screen.unmount();
  });

  it("shows usable results while queued delivery is still pending", async () => {
    mockDashboard.subjects.push({
      ...mockSubject,
      id: 2,
      data: { ...mockSubject.data, characters: "先生" },
    });
    mockDashboard.assignments.push({
      id: 11,
      data: {
        subject_id: 2,
        srs_stage: 3,
        available_at: "2020-01-01T00:00:00Z",
      },
    });
    const finishDeliveries: ((value: unknown) => void)[] = [];
    mockQueueProgress.mockImplementation(
      () => new Promise((resolve) => finishDeliveries.push(resolve)),
    );
    const screen = render(<ReviewScreen />);
    await screen.findByTestId("accounting-question");

    for (let answerIndex = 0; answerIndex < 4; answerIndex += 1) {
      await answerCurrent(true);
    }

    await waitFor(() => expect(screen.getByText("Results")).toBeTruthy(), {
      timeout: 500,
    });
    await act(async () => {
      finishDeliveries.forEach((resolve) =>
        resolve({ response: null, queued: true }),
      );
      await Promise.resolve();
    });
    screen.unmount();
  });

  it("does not advance or double-submit while durable persistence is pending", async () => {
    let finishPersistence: (() => void) | undefined;
    mockPersistProgress.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishPersistence = resolve;
        }),
    );
    const screen = render(<ReviewScreen />);
    await screen.findByTestId("accounting-question");
    await answerCurrent(true);

    const readingQuestion = currentQuestion();
    act(() => {
      readingQuestion.onAnswer(
        readingQuestion.item,
        readingQuestion.questionType,
        true,
        false,
        false,
      );
      readingQuestion.onAnswer(
        readingQuestion.item,
        readingQuestion.questionType,
        true,
        false,
        false,
      );
    });

    await waitFor(() => expect(mockPersistProgress).toHaveBeenCalledTimes(1));
    expect(currentQuestion().questionType).toBe("reading");
    expect(screen.queryByText("Results")).toBeNull();

    await act(async () => {
      finishPersistence?.();
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByText("Results")).toBeTruthy());
    expect(mockQueueProgress).toHaveBeenCalledTimes(1);
    screen.unmount();
  });

  it("advances after the durable write without waiting for assignment-cache maintenance", async () => {
    let finishCacheUpdate: (() => void) | undefined;
    mockMarkReviewSubmittedInAssignmentCaches.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishCacheUpdate = resolve;
        }),
    );
    const screen = render(<ReviewScreen />);
    await screen.findByTestId("accounting-question");
    await answerCurrent(true);
    await answerCurrent(true);

    await waitFor(() => expect(screen.getByText("Results")).toBeTruthy(), {
      timeout: 500,
    });
    expect(mockPersistProgress).toHaveBeenCalledTimes(1);
    expect(mockQueueProgress).not.toHaveBeenCalled();

    await act(async () => {
      finishCacheUpdate?.();
      await Promise.resolve();
    });
    await waitFor(() => expect(mockQueueProgress).toHaveBeenCalledTimes(1));
    screen.unmount();
  });

  it("allows a grouped meaning and reading pair while blocking duplicate callbacks", async () => {
    mockAnkiCardMode = true;
    mockAnkiGroupQuestions = true;
    const screen = render(<ReviewScreen />);
    await screen.findByTestId("accounting-question");
    const groupedQuestion = currentQuestion();

    act(() => {
      groupedQuestion.onAnswer(
        groupedQuestion.item,
        "meaning",
        true,
        false,
        true,
      );
      groupedQuestion.onAnswer(
        groupedQuestion.item,
        "reading",
        true,
        false,
        true,
      );
      groupedQuestion.onAnswer(
        groupedQuestion.item,
        "meaning",
        true,
        false,
        true,
      );
      groupedQuestion.onAnswer(
        groupedQuestion.item,
        "reading",
        true,
        false,
        true,
      );
    });

    await waitFor(() => expect(mockPersistProgress).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText("Results")).toBeTruthy());
    expect(mockQueueProgress).toHaveBeenCalledTimes(1);
    screen.unmount();
  });

  it("retains a completed answer and offers retry when local persistence fails", async () => {
    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation(() => undefined);
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockPersistProgress.mockRejectedValueOnce(
      new Error("database unavailable"),
    );
    const screen = render(<ReviewScreen />);
    await screen.findByTestId("accounting-question");
    await answerCurrent(true);
    await answerCurrent(true);

    expect(currentQuestion().questionType).toBe("reading");
    expect(screen.queryByText("Results")).toBeNull();
    expect(mockQueueProgress).not.toHaveBeenCalled();
    const retryAlert = alertSpy.mock.calls.find(
      ([title]) => title === "Couldn't Save Review",
    );
    expect(retryAlert).toBeDefined();

    act(() => {
      retryAlert?.[2]?.[0]?.onPress?.();
    });

    await waitFor(() => expect(mockPersistProgress).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText("Results")).toBeTruthy());
    expect(mockQueueProgress).toHaveBeenCalledTimes(1);
    consoleErrorSpy.mockRestore();
    alertSpy.mockRestore();
    screen.unmount();
  });

  it.each([false, true])(
    "submits no mistakes for two correct overrides (retry flag %s)",
    async (wasIncorrect) => {
      const screen = render(<ReviewScreen />);
      await screen.findByTestId("accounting-question");
      await answerCurrent(true, wasIncorrect);
      await answerCurrent(true, wasIncorrect);

      await waitFor(() => expect(mockPersistProgress).toHaveBeenCalledTimes(1));
      expect(mockPersistProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          assignmentId: 10,
          meaningIncorrectCount: 0,
          readingIncorrectCount: 0,
        }),
      );
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

    await waitFor(() => expect(mockPersistProgress).toHaveBeenCalledTimes(1));
    expect(mockPersistProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        assignmentId: 10,
        meaningIncorrectCount: 1,
        readingIncorrectCount: 0,
      }),
    );
    screen.unmount();
  });
});
