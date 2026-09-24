import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render, waitFor } from "@testing-library/react-native";
import React from "react";

import type ReviewQuestionScreen from "../../src/components/ReviewQuestionScreen";
import {
  AnswerCheckerResult,
  checkAnswerWithDetails,
} from "../../src/utils/answerChecker";
import TestSessionRoute from "../(app)/test-session";

let mockQuestionProps: React.ComponentProps<typeof ReviewQuestionScreen> | null = null;
let mockAcceptUserSynonymsAsAnswers = true;
const initialParams: Record<string, string> = {
  includeVocabulary: "true",
  includeMeaning: "true",
  includeReading: "false",
  numberOfQuestions: "1",
  maxLevel: "1",
};
let mockParams = { ...initialParams };
const mockSubject = {
  id: 101,
  object: "vocabulary",
  data: {
    characters: "学校",
    level: 1,
    meanings: [{ meaning: "school", primary: true, accepted_answer: true }],
    readings: [{ reading: "がっこう", primary: true, accepted_answer: true }],
  },
};
const mockStudyMaterial = {
  id: 201,
  object: "study_material",
  data: {
    subject_id: mockSubject.id,
    subject_type: "vocabulary",
    meaning_synonyms: ["learning institution"],
    meaning_note: null,
    reading_note: null,
  },
};
const mockGetAssignments = jest.fn();
const mockGetStudyMaterials = jest.fn();

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));
jest.mock("../../src/contexts/AuthContext", () => ({
  useSession: () => ({ isLoading: false }),
}));
jest.mock("../../src/hooks/useActivityTracking", () => ({
  useActivityTracking: jest.fn(),
}));
jest.mock("../../src/utils/store", () => ({
  useAuthStore: () => ({ apiToken: "test-token", userData: { id: "user-1", level: 1 } }),
  useSettingsStore: () => ({
    ankiCardMode: false,
    ankiGroupQuestions: false,
    ankiCardModeScope: "both",
    backToBackQuestions: true,
    reviewQuestionOrderEnabled: true,
    meaningFirst: true,
    acceptUserSynonymsAsAnswers: mockAcceptUserSynonymsAsAnswers,
  }),
}));
jest.mock("../../src/utils/theme", () => ({
  useTheme: () => ({
    theme: { backgroundColor: "#fff", textColor: "#111", secondary: "#666" },
  }),
}));
jest.mock("../../src/utils/api", () => ({
  getAllAssignmentsCached: (...args: unknown[]) => mockGetAssignments(...args),
  getStudyMaterials: (...args: unknown[]) => mockGetStudyMaterials(...args),
}));
jest.mock("../../src/utils/cache", () => ({
  getAllSubjects: async () => [mockSubject],
  getSubjectById: async () => mockSubject,
}));
jest.mock("../../src/utils/subjectLists", () => ({
  getSubjectIdSetForListIds: async () => new Set<number>(),
}));
jest.mock("../../src/components/ExtraStudyCompletionTransition", () => ({
  __esModule: true,
  default: () => null,
  useExtraStudyResultsReveal: (isComplete: boolean) => isComplete,
}));
jest.mock("../../src/components/ExtraStudyModeAccess", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("../../src/components/audio-vocab-prompt", () => () => null);
jest.mock("../../src/components/ReviewResultsScreen", () => () => null);
jest.mock("../../src/components/ReviewQuestionScreen", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    __esModule: true,
    default: (props: typeof mockQuestionProps) => {
      mockQuestionProps = props;
      return <Text>Meaning question</Text>;
    },
  };
});

function checkCurrentAnswer(answer: string) {
  if (!mockQuestionProps) throw new Error("Question has not loaded");
  return checkAnswerWithDetails(
    answer,
    mockQuestionProps.item.subject,
    mockQuestionProps.questionType,
    mockAcceptUserSynonymsAsAnswers ? mockQuestionProps.studyMaterials : undefined,
  );
}

describe("Random test user synonyms", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    mockParams = { ...initialParams };
    mockQuestionProps = null;
    mockAcceptUserSynonymsAsAnswers = true;
    mockGetAssignments.mockResolvedValue({
      data: [{ id: 301, data: { subject_id: mockSubject.id, srs_stage: 1 } }],
    });
    mockGetStudyMaterials.mockResolvedValue({ data: [mockStudyMaterial] });
  });

  it("accepts a saved user synonym when synonym answers are enabled", async () => {
    const screen = render(<TestSessionRoute />);
    await waitFor(() => expect(screen.getByText("Meaning question")).toBeTruthy());

    expect(checkCurrentAnswer("learning institution")).toBe(AnswerCheckerResult.Precise);
    expect(checkCurrentAnswer("school")).toBe(AnswerCheckerResult.Precise);
  });

  it("rejects user synonyms when synonym answers are disabled", async () => {
    mockAcceptUserSynonymsAsAnswers = false;
    const screen = render(<TestSessionRoute />);
    await waitFor(() => expect(screen.getByText("Meaning question")).toBeTruthy());

    expect(checkCurrentAnswer("learning institution")).toBe(AnswerCheckerResult.Incorrect);
    expect(checkCurrentAnswer("school")).toBe(AnswerCheckerResult.Precise);
  });

  it("waits for saved synonyms before presenting an answerable question", async () => {
    let resolveMaterials!: (value: { data: typeof mockStudyMaterial[] }) => void;
    mockGetStudyMaterials.mockReturnValue(new Promise((resolve) => {
      resolveMaterials = resolve;
    }));
    const screen = render(<TestSessionRoute />);
    await waitFor(() => expect(mockGetStudyMaterials).toHaveBeenCalled());
    expect(screen.queryByText("Meaning question")).toBeNull();

    await act(async () => resolveMaterials({ data: [mockStudyMaterial] }));

    expect(screen.getByText("Meaning question")).toBeTruthy();
    expect(checkCurrentAnswer("learning institution")).toBe(AnswerCheckerResult.Precise);
  });

  it("loads synonyms when resuming a saved session that does not contain study materials", async () => {
    mockParams.resume = "true";
    const savedSession = {
      savedAt: 1,
      config: {
        includeRadicals: false,
        includeKanji: false,
        includeVocabulary: true,
        includeKanaVocabulary: false,
        numberOfQuestions: 1,
        includeMeaning: true,
        includeReading: false,
        srsGroups: {
          apprentice: true,
          guru: true,
          master: true,
          enlightened: true,
          burned: true,
        },
        useCustomLevelRange: false,
        minLevel: 1,
        maxLevel: 1,
        selectedListIds: [],
      },
      testQuestions: [{ id: 101, subject: mockSubject, questionType: "meaning" }],
      currentQuestionIndex: 0,
      reviewItems: [{
        id: 101,
        assignmentId: 301,
        subjectId: mockSubject.id,
        subject: mockSubject,
        srsStage: 1,
        meaningDone: false,
        readingDone: true,
        meaningApplicable: true,
        readingApplicable: false,
        meaningIncorrect: 0,
        readingIncorrect: 0,
        meaningCorrectlyAnswered: false,
        readingCorrectlyAnswered: false,
        meaningIncorrectCounted: false,
        readingIncorrectCounted: false,
      }],
    };
    jest.mocked(AsyncStorage.getItem).mockImplementation(async (key) =>
      key === "extra_study_session:random_test" ? JSON.stringify(savedSession) : null,
    );

    const screen = render(<TestSessionRoute />);
    await waitFor(() => expect(screen.getByText("Meaning question")).toBeTruthy());

    expect(checkCurrentAnswer("learning institution")).toBe(AnswerCheckerResult.Precise);
    expect(mockGetAssignments).not.toHaveBeenCalled();
  });

  it("keeps synonyms available when questions use the offline subjects fallback", async () => {
    mockGetAssignments.mockRejectedValue(new Error("Offline"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const screen = render(<TestSessionRoute />);
      await waitFor(() => expect(screen.getByText("Meaning question")).toBeTruthy());

      expect(checkCurrentAnswer("learning institution")).toBe(AnswerCheckerResult.Precise);
    } finally {
      warn.mockRestore();
    }
  });

  it("retains synonyms added during the session", async () => {
    const screen = render(<TestSessionRoute />);
    await waitFor(() => expect(screen.getByText("Meaning question")).toBeTruthy());

    expect(checkCurrentAnswer("academy")).toBe(AnswerCheckerResult.Incorrect);
    const onSynonymAdded = mockQuestionProps?.onSynonymAdded;
    expect(onSynonymAdded).toBeDefined();
    act(() => {
      onSynonymAdded?.(mockSubject.id, ["learning institution", "academy"]);
    });

    expect(checkCurrentAnswer("academy")).toBe(AnswerCheckerResult.Precise);
    expect(checkCurrentAnswer("learning institution")).toBe(AnswerCheckerResult.Precise);
  });

  it("loads newly enabled synonyms without restarting the session", async () => {
    mockAcceptUserSynonymsAsAnswers = false;
    mockParams.includeReading = "true";
    const screen = render(<TestSessionRoute />);
    await waitFor(() => expect(screen.getByText("Meaning question")).toBeTruthy());
    if (!mockQuestionProps) throw new Error("Question has not loaded");
    const question = mockQuestionProps;
    act(() => question.onAnswer(question.item, "meaning", true, false));
    expect(mockQuestionProps.questionType).toBe("reading");
    expect(mockQuestionProps.currentItem).toBe(1);

    mockAcceptUserSynonymsAsAnswers = true;
    await act(async () => screen.rerender(<TestSessionRoute />));
    await waitFor(() => expect(mockGetStudyMaterials).toHaveBeenCalled());

    expect(mockQuestionProps.studyMaterials?.meaning_synonyms).toContain("learning institution");
    expect(mockQuestionProps.questionType).toBe("reading");
    expect(mockQuestionProps.currentItem).toBe(1);
    expect(mockGetAssignments).toHaveBeenCalledTimes(1);
  });
});
