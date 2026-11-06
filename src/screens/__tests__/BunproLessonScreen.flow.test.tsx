import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import BunproLessonScreen from "../BunproLessonScreen";
import fetchMock from "jest-fetch-mock";
import type { BunproReviewQueueItem } from "../../types/bunpro";

const mockReviewSettings = { autoSwitchKeyboard: false, disableAutoProgressOnCorrect: true, disableAutoProgressOnWrong: true, autoplayVocabularyAudio: false, vocabularyAudioVoice: "female", allowSkippingReviews: false, ankiCardMode: false, ankiCardModeScope: "both", ankiHideAnswerCompletely: false, ankiShowOtherAcceptedAnswersAndUserSynonyms: false, ankiShowReplayAudioButton: false, ankiButtonlessMode: false, ankiGroupQuestions: false, reviewSearchButtonEnabled: false, bunproHideFurigana: false, setBunproHideFurigana: jest.fn() };
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("../../contexts/ReviewKeyboardContext", () => ({
  useReviewKeyboard: () => ({ height: { value: 0 }, state: { value: 4 } }),
}));

jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { __esModule: true, default: { View }, useReducedMotion: () => false, useSharedValue: (value: number) => React.useRef({ value, get: () => value }).current, useAnimatedRef: () => React.useRef(null), measure: () => null, useAnimatedStyle: (fn: () => object) => fn(), withTiming: (value: number) => value };
});
jest.mock("../../utils/haptics", () => ({ notificationAsync: jest.fn(), NotificationFeedbackType: { Success: "success", Error: "error", Warning: "warning" } }));
jest.mock("../../hooks/use-bunpro-voice-answer", () => ({ useBunproVoiceAnswer: () => ({ listening: false, error: "", start: jest.fn(), stop: jest.fn() }) }));
jest.mock("../../hooks/use-bunpro-jitai-font", () => ({ useBunproJitaiFont: () => undefined }));
jest.mock("../../components/bunpro/bunpro-review-shortcuts", () => ({ BunproReviewShortcuts: () => null }));
jest.mock("../../components/bunpro/bunpro-details-content", () => ({ BunproDetailsContent: () => null }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn(), push: mockPush, replace: mockReplace }), useLocalSearchParams: () => ({}) }));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("../../utils/navigation-focus", () => ({ useOptionalScreenIsFocused: () => true }));
jest.mock("../../utils/store", () => ({
  useAuthStore: () => ({ userData: { username: "Portego" } }),
  useSettingsStore: (selector: (state: object) => unknown) => selector(mockReviewSettings),
}));
jest.mock("../../utils/theme", () => ({ useTheme: () => ({ theme: { textColor: "#000", textSecondary: "#666", backgroundColor: "#fff", border: "#ccc", error: "#a00" }, isDark: false }) }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn().mockResolvedValue("fixture-key") }));
jest.mock("../../components/bunpro/bunpro-native-details", () => ({ BunproNativeDetails: ({ content, footer }: any) => {
  const React = jest.requireActual("react");
  const { View, Text } = jest.requireActual("react-native");
  return React.createElement(View, null, React.createElement(Text, null, content.data.attributes.title), footer);
} }));
jest.mock("../../utils/expoAvCompat", () => ({ Audio: { Sound: { createAsync: jest.fn() } } }));
jest.mock("../../components/TextToKanaInput", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { TextInput } = jest.requireActual<typeof import("react-native")>("react-native");
  return { __esModule: true, default: React.forwardRef(function TestKanaInput(props: any, ref: any) {
    const [value, setValue] = React.useState(props.initialValue ?? "");
    const valueRef = React.useRef(props.initialValue ?? "");
    React.useLayoutEffect(() => { valueRef.current = ""; setValue(""); }, [props.resetSignal]);
    React.useImperativeHandle(ref, () => ({
      flushKana: () => valueRef.current,
      clearInput: () => { valueRef.current = ""; setValue(""); },
      setInputText: (text: string) => { valueRef.current = text; setValue(text); },
      focus: jest.fn(),
    }));
    return React.createElement(TextInput, { ...props, value, testID: props.enableKanaConversion ? "kana-input" : "meaning-input", onChangeText: (text: string) => { valueRef.current = text; setValue(text); props.onKanaChange(text); } });
  }) };
});

function question(id: number): BunproReviewQueueItem {
  return {
    data: { id: String(id), type: "review", attributes: { id, ghost_count: 0, reviewable_id: id, reviewable_type: "GrammarPoint", streak: 0 }, relationships: { study_question: { data: { id: `q${id}`, type: "study_question" } }, reviewable: { data: { id: String(id), type: "grammar_point" } } } },
    included: [
      { id: `q${id}`, type: "study_question", attributes: { content: `Quiz ${id} ____.`, answer: "です" } },
      { id: String(id), type: "grammar_point", attributes: { title: `Lesson ${id}`, slug: `lesson-${id}`, level: "N5" } },
    ],
  };
}

beforeEach(() => { jest.clearAllMocks(); fetchMock.resetMocks(); });

it("finishes a lesson batch, saves only correct quiz answers, refreshes the next batch, and returns home when finished", async () => {
  let completed = 0;
  let session = 41;
  const saved: number[] = [];
  const quizBatches: unknown[] = [];
  fetchMock.mockResponse(async request => {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/user/queue")) return JSON.stringify({ data: [{ id: "11", type: "deck_setting", attributes: { deck_id: 1, daily_goal: 3, batch_size: 2, daily_goal_count_grammar: completed, daily_goal_count_vocab: 0, complete_grammar_count: completed } }], included: [{ id: "1", type: "deck", attributes: { title: "N5 Grammar", grammar_count: 3 } }] });
    if (url.pathname.endsWith("/learn")) return JSON.stringify({ content: [1, 2, 3].filter(id => !saved.includes(id)).map(id => ({ data: { id: String(id), type: "grammar_point", attributes: { title: `Lesson ${id}`, meaning: "Polite", level: "N5" } } })) });
    if (url.pathname.endsWith("/learn/quiz")) {
      const body = JSON.parse(await request.text());
      quizBatches.push(body);
      const expectedIds = saved.length ? [3] : [1, 2];
      if (JSON.stringify(body) !== JSON.stringify({ deck_id: 1, reviewables: expectedIds.map(id => ({ reviewable_id: id, reviewable_type: "grammar_point" })) })) return { status: 500, body: "{}" };
      session++;
      return JSON.stringify({ review_session_id: session, pending_attempt: expectedIds.map(question), pending_wrapup: [] });
    }
    const id = Number(url.pathname.match(/\/reviews\/(\d+)\/update$/)?.[1]);
    if (id) {
      const body = JSON.parse(await request.text());
      expect(body).toMatchObject({ correct: true, review_session_id: session, deck_id: null, only_review: null, loaded_review_ids: null, loaded_ghost_review_ids: null, loaded_self_study_review_ids: null });
      expect(saved).not.toContain(id);
      saved.push(id); completed++;
      return "{}";
    }
    throw new Error(`Unexpected Bunpro request: ${url.pathname}`);
  });
  const view = render(<BunproLessonScreen />);
  await waitFor(() => expect(view.getByText("Lesson 1")).toBeTruthy());
  fireEvent.press(view.getByLabelText("Next"));
  expect(view.getByText("Lesson 2")).toBeTruthy();
  fireEvent.press(view.getByLabelText("Start Quiz"));
  await waitFor(() => expect(view.getByText("Quiz 1 ")).toBeTruthy());
  // Misses in lessons stay local until the first correct answer.
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "違う");
  fireEvent.press(view.getByLabelText("Check answer"));
  fireEvent.press(view.getByLabelText("Next question"));
  await waitFor(() => expect(view.getByText("Quiz 2 ")).toBeTruthy());
  expect(saved).toEqual([]);
  for (const id of [2, 1]) {
    await waitFor(() => expect(view.getByText(`Quiz ${id} `)).toBeTruthy());
    fireEvent.changeText(view.getByLabelText("Bunpro answer"), "です");
    fireEvent.press(view.getByLabelText("Check answer"));
    expect(view.queryByText("Continue lessons")).toBeNull();
    fireEvent.press(view.getByLabelText("Next question"));
  }
  await waitFor(() => expect(view.getByText("Lesson quiz complete")).toBeTruthy());
  expect(saved).toEqual([2, 1]);
  fireEvent.press(view.getByText("Continue lessons"));
  await waitFor(() => expect(view.getByText("Lesson 3")).toBeTruthy());
  fireEvent.press(view.getByLabelText("Start Quiz"));
  await waitFor(() => expect(view.getByText("Quiz 3 ")).toBeTruthy());
  fireEvent.changeText(view.getByLabelText("Bunpro answer"), "です");
  fireEvent.press(view.getByLabelText("Check answer"));
  fireEvent.press(view.getByLabelText("Next question"));
  await waitFor(() => expect(view.getByText("Continue lessons")).toBeTruthy());
  fireEvent.press(view.getByText("Continue lessons"));
  await waitFor(() => expect(view.getByText("Lessons complete")).toBeTruthy());
  expect(quizBatches).toHaveLength(2);
  expect(saved).toEqual([2, 1, 3]);
  fireEvent.press(view.getByLabelText("Back to home"));
  expect(mockReplace).toHaveBeenCalledWith({ pathname: "/", params: { refreshLessonsReviews: "true" } });
});
