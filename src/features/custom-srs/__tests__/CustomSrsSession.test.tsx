import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import CustomSrsSession from "../CustomSrsSession";
import { CustomSrsConflictError } from "../client";

const mockWords = Array.from({ length: 16 }, (_, index) => ({
  id: `word-${index + 1}`, characters: `かな${index + 1}`, reading: `かな${index + 1}`,
  meanings: [`meaning ${index + 1}`], meaningMnemonic: "<vocabulary>A useful mnemonic</vocabulary>",
  partsOfSpeech: ["noun"], contextSentences: [{ ja: "例です。", en: "An example." }, { ja: "もう一つの例です。", en: "Another example." }],
}));

const mockAssignments = () => Object.fromEntries(mockWords.map((word) => [word.id, {
  wordId: word.id, packId: "test-pack", stage: 0, availableAt: null as string | null,
  startedAt: null as string | null, updatedAt: "2026-09-07T00:00:00Z", burnedAt: null,
  correctReviews: 0, incorrectReviews: 0, card: null,
}]));
let mockState = { enrolledPackIds: ["test-pack"], assignments: mockAssignments() };
const mockCloud = {
  loading: false, error: null, state: mockState,
  refresh: jest.fn(), completeLesson: jest.fn(), submitReview: jest.fn(),
};
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
let mockUuid = 0;

jest.mock("expo-crypto", () => ({ randomUUID: () => `event-${++mockUuid}` }));
jest.mock("expo-router", () => ({ get router() { return mockRouter; } }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Icon" }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }) }));
jest.mock("../../../utils/store", () => ({ useSettingsStore: (select: (state: object) => unknown) => select({ lessonBatchSize: 5, meaningFirst: true, reviewQuestionOrderEnabled: true, backToBackQuestions: true, showVocabContextSentencesInReviews: true }) }));
jest.mock("../../../utils/subjectColors", () => ({ useSubjectColors: () => ({ vocabulary: "#9c38d9" }) }));
jest.mock("../../../utils/theme", () => ({ useTheme: () => ({ theme: { backgroundColor: "black", cardBackground: "#111111", textColor: "white", textSecondary: "gray", border: "#333333", error: "red", isDark: true } }) }));
jest.mock("../../../hooks/useActivityTracking", () => ({ useActivityTracking: jest.fn() }));
jest.mock("../audio-cache", () => ({ prefetchCustomVocabularyAudio: jest.fn(async () => {}) }));
jest.mock("../catalog", () => ({ get CUSTOM_VOCABULARY_PACKS() { return [{ id: "test-pack", words: mockWords }]; } }));
jest.mock("../client", () => ({ CustomSrsConflictError: class extends Error { readonly status = 409; } }));
jest.mock("../data", () => ({
  useCustomSrs: () => mockCloud,
  customLessonWords: (state: typeof mockState) => mockWords.filter((word) => state.assignments[word.id]?.stage === 0),
  customReviewWords: (state: typeof mockState) => mockWords.filter((word) => state.assignments[word.id]?.stage > 0 && Boolean(state.assignments[word.id]?.availableAt) && Date.parse(state.assignments[word.id].availableAt!) <= Date.now()),
}));
jest.mock("../subject", () => ({
  customWordUsesKanji: () => false,
  customSubjectIdToWord: (id: number) => mockWords[-id - 1],
  customWordToSubject: (word: typeof mockWords[number]) => ({
    id: -Number(word.id.split("-")[1]), object: "kana_vocabulary",
    data: { characters: word.characters, meanings: word.meanings.map((meaning) => ({ meaning, primary: true })), readings: [], meaning_mnemonic: word.meaningMnemonic, context_sentences: word.contextSentences },
  }),
}));
jest.mock("../../../components/LessonDetailScreen", () => {
  const { View, Text, Pressable } = jest.requireActual("react-native");
  return function LessonDetail(props: any) {
    return <View>
      <Text testID="teaching-word">{props.item.subject.data.characters}</Text>
      <Text testID="teaching-count">{props.progress.total}</Text>
      <Pressable testID="teaching-next" onPress={props.onNext}><Text>Next</Text></Pressable>
      <Pressable testID="teaching-details" onPress={() => props.onSubjectPress(props.item.id)}><Text>Details</Text></Pressable>
    </View>;
  };
});
jest.mock("../../../components/ReviewQuestionScreen", () => {
  const { View, Text, Pressable } = jest.requireActual("react-native");
  return function ReviewQuestion(props: any) {
    return <View>
      <Text testID="review-word">{props.item.subject.data.characters}</Text>
      <Text testID="question-type">{props.questionType}</Text>
      <Text testID="review-context">{props.contextSentencesHint?.length ?? 0}</Text>
      <Pressable testID="answer-correct" onPress={() => props.onAnswer(props.item, props.questionType, true, false)}><Text>Correct</Text></Pressable>
      <Pressable testID="answer-warning-retry" onPress={() => props.onAnswer(props.item, props.questionType, true, true)}><Text>Correct after warning</Text></Pressable>
      <Pressable testID="answer-incorrect" onPress={() => props.onAnswer(props.item, props.questionType, false, true)}><Text>Incorrect</Text></Pressable>
      <Pressable testID="previous-details" onPress={() => props.onViewSubjectDetails(-1)}><Text>Previous details</Text></Pressable>
    </View>;
  };
});

const confirmLesson = async (wordId: string) => {
  mockState = { ...mockState, assignments: { ...mockState.assignments, [wordId]: { ...mockState.assignments[wordId], stage: 1, availableAt: "2099-09-07T04:00:00Z", startedAt: "2026-09-07T00:00:00Z" } } };
  mockCloud.state = mockState;
  return mockState;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUuid = 0;
  mockState = { enrolledPackIds: ["test-pack"], assignments: mockAssignments() };
  mockCloud.state = mockState;
  mockCloud.refresh.mockImplementation(async () => mockState);
  mockCloud.completeLesson.mockImplementation(confirmLesson);
  mockCloud.submitReview.mockImplementation(confirmLesson);
  jest.spyOn(Math, "random").mockReturnValue(0.999);
});

afterEach(() => jest.restoreAllMocks());

async function finishTeaching(view: ReturnType<typeof render>, count: number) {
  await waitFor(() => expect(view.getByTestId("teaching-word")).toBeTruthy());
  for (let index = 0; index < count; index += 1) fireEvent.press(view.getByTestId("teaching-next"));
  expect(view.getByTestId("review-word")).toBeTruthy();
}

describe("native custom SRS sessions", () => {
  it("pops the existing screen when Back is pressed during initial loading", () => {
    mockCloud.refresh.mockImplementationOnce(() => new Promise(() => {}));
    const view = render(<CustomSrsSession mode="lessons" packId="test-pack" />);
    fireEvent.press(view.getByText(/^Back(?: to packs)?$/));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("allows genuine back navigation after the loading request fails", async () => {
    mockCloud.refresh.mockRejectedValueOnce(new Error("Cloud sync timed out"));
    const view = render(<CustomSrsSession mode="reviews" />);
    await waitFor(() => expect(view.getByText("Cloud sync timed out")).toBeTruthy());
    fireEvent.press(view.getByText(/^Back(?: to packs)?$/));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("offers consecutive 5, 5, 5, 1 lesson batches and saves every word exactly once", async () => {
    const view = render(<CustomSrsSession mode="lessons" packId="test-pack" />);
    for (const count of [5, 5, 5, 1]) {
      await finishTeaching(view, count);
      for (let index = 0; index < count; index += 1) {
        await act(async () => fireEvent.press(view.getByTestId("answer-correct")));
      }
      if (count === 1) break;
      await waitFor(() => expect(view.getByTestId("custom-srs-next-batch")).toBeTruthy());
      fireEvent.press(view.getByTestId("custom-srs-next-batch"));
    }
    await waitFor(() => expect(view.getByText("Lessons complete")).toBeTruthy());
    expect(mockCloud.completeLesson).toHaveBeenCalledTimes(16);
    expect(new Set(mockCloud.completeLesson.mock.calls.map(([wordId]) => wordId)).size).toBe(16);
    expect(view.queryByTestId("custom-srs-next-batch")).toBeNull();
    expect(mockCloud.submitReview).not.toHaveBeenCalled();
    expect(mockCloud.refresh).toHaveBeenCalledTimes(4);
  }, 20_000);

  it("holds the current question on save failure and retries the same logical event", async () => {
    mockCloud.completeLesson.mockRejectedValueOnce(new Error("No connection"));
    const view = render(<CustomSrsSession mode="lessons" packId="test-pack" />);
    await finishTeaching(view, 5);
    await act(async () => fireEvent.press(view.getByTestId("answer-correct")));
    expect(view.getByText("Progress not confirmed saved")).toBeTruthy();
    expect(view.getByTestId("review-word").props.children).toBe("かな1");
    expect(view.queryByTestId("custom-srs-next-batch")).toBeNull();
    await act(async () => fireEvent.press(view.getByTestId("custom-srs-retry-save")));
    expect(mockCloud.completeLesson.mock.calls).toEqual([["word-1", "event-1"], ["word-1", "event-1"]]);
    expect(view.getByTestId("review-word").props.children).toBe("かな2");
    expect(view.queryByText("Progress not confirmed saved")).toBeNull();
  });

  it("does not advance or open a blocking modal while a normal save is pending", async () => {
    let resolveSave!: (state: typeof mockState) => void;
    mockCloud.completeLesson.mockImplementationOnce(() => new Promise((resolve) => { resolveSave = resolve; }));
    const view = render(<CustomSrsSession mode="lessons" packId="test-pack" />);
    await finishTeaching(view, 5);
    fireEvent.press(view.getByTestId("answer-correct"));
    expect(view.getByTestId("review-word").props.children).toBe("かな1");
    expect(view.queryByText("Progress not confirmed saved")).toBeNull();
    fireEvent.press(view.getByTestId("answer-correct"));
    expect(mockCloud.completeLesson).toHaveBeenCalledTimes(1);
    await act(async () => resolveSave(await confirmLesson("word-1")));
    expect(view.getByTestId("review-word").props.children).toBe("かな2");
    expect(view.getByTestId("custom-srs-progression-popup").props.style).toEqual(expect.arrayContaining([expect.objectContaining({ position: "absolute" })]));
  });

  it("does not penalize harmless warning retries, but does count an incorrect answer before success", async () => {
    for (const assignment of Object.values(mockState.assignments)) assignment.stage = 9;
    mockState.assignments["word-1"].stage = 1;
    mockState.assignments["word-1"].availableAt = "2020-01-01T00:00:00Z";
    const view = render(<CustomSrsSession mode="reviews" packId="test-pack" />);
    await waitFor(() => expect(view.getByTestId("answer-warning-retry")).toBeTruthy());
    await act(async () => fireEvent.press(view.getByTestId("answer-warning-retry")));
    expect(mockCloud.submitReview).toHaveBeenCalledWith("word-1", 0, "event-1");
    view.unmount();
    mockCloud.submitReview.mockClear();
    mockState.assignments["word-1"].availableAt = "2020-01-01T00:00:00Z";
    const next = render(<CustomSrsSession mode="reviews" packId="test-pack" />);
    await waitFor(() => expect(next.getByTestId("answer-incorrect")).toBeTruthy());
    fireEvent.press(next.getByTestId("answer-incorrect"));
    await act(async () => fireEvent.press(next.getByTestId("answer-correct")));
    expect(mockCloud.submitReview).toHaveBeenCalledWith("word-1", 1, "event-2");
  });

  it("uses fresh server state, native context sentences and the correct previous-word details route", async () => {
    mockState.assignments["word-1"].stage = 1;
    const view = render(<CustomSrsSession mode="lessons" packId="test-pack" />);
    await finishTeaching(view, 5);
    expect(view.getByTestId("review-word").props.children).toBe("かな2");
    expect(view.getByTestId("review-context").props.children).toBe(2);
    expect(view.getByTestId("question-type").props.children).toBe("meaning");
    fireEvent.press(view.getByTestId("previous-details"));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/custom-vocabulary/word/[wordId]", params: { wordId: "word-1" } });
  });

  it("reloads remaining reviews after another device updates a queued word", async () => {
    for (const assignment of Object.values(mockState.assignments)) assignment.stage = 9;
    for (const id of ["word-1", "word-2"]) {
      mockState.assignments[id].stage = 1;
      mockState.assignments[id].availableAt = "2020-01-01T00:00:00Z";
    }
    mockCloud.submitReview.mockRejectedValueOnce(new CustomSrsConflictError());
    const view = render(<CustomSrsSession mode="reviews" packId="test-pack" />);
    await waitFor(() => expect(view.getByTestId("answer-correct")).toBeTruthy());
    // The web app reviews the first word after our mobile queue was created.
    await confirmLesson("word-1");
    await act(async () => fireEvent.press(view.getByTestId("answer-correct")));
    expect(view.getByText("Progress changed on another device")).toBeTruthy();
    expect(view.queryByTestId("custom-srs-retry-save")).toBeNull();
    expect(view.getByTestId("review-word").props.children).toBe("かな1");
    mockCloud.refresh.mockRejectedValueOnce(new Error("Offline"));
    await act(async () => fireEvent.press(view.getByTestId("custom-srs-reload-progress")));
    expect(view.getByTestId("review-word").props.children).toBe("かな1");
    expect(view.getByText("Could not load the latest progress. Offline")).toBeTruthy();
    await act(async () => fireEvent.press(view.getByTestId("custom-srs-reload-progress")));
    expect(view.getByTestId("review-word").props.children).toBe("かな2");
    expect(mockCloud.submitReview).toHaveBeenCalledTimes(1);
    await act(async () => fireEvent.press(view.getByTestId("answer-correct")));
    expect(mockCloud.submitReview.mock.calls).toEqual([["word-1", 0, "event-1"], ["word-2", 0, "event-2"]]);
    expect(view.getByText("Reviews complete")).toBeTruthy();
  });
});
