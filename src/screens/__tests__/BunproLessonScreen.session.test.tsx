import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import BunproLessonScreen from "../BunproLessonScreen";
import { getBunproLearnIndex, getBunproLearnQuiz, getBunproQueue } from "../../utils/bunproApi";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }), useLocalSearchParams: () => ({}) }));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("react-native-safe-area-context", () => ({ ...jest.requireActual("react-native-safe-area-context"), useSafeAreaInsets: () => ({ top: 59, right: 0, bottom: 34, left: 0 }) }));
jest.mock("../../utils/navigation-focus", () => ({ useOptionalScreenIsFocused: () => true }));
jest.mock("../../utils/store", () => ({ useAuthStore: () => ({ userData: { username: "Portego" } }) }));
jest.mock("../../utils/theme", () => ({ useTheme: () => ({ theme: { textColor: "#000", textSecondary: "#666", backgroundColor: "#fff", headerBackground: "#c55", headerText: "#fff", border: "#ccc", error: "#a00" }, isDark: false }) }));
jest.mock("../../utils/bunproApi", () => ({ BunproApiError: class extends Error {}, getBunproLearnIndex: jest.fn(), getBunproLearnQuiz: jest.fn(), getBunproQueue: jest.fn() }));
jest.mock("../../utils/expoAvCompat", () => ({ Audio: { Sound: { createAsync: jest.fn() }, setAudioModeAsync: jest.fn(async () => undefined) } }));
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View, ScrollView } = jest.requireActual<typeof import("react-native")>("react-native");
  return { __esModule: true, default: { View, ScrollView }, Extrapolation: { CLAMP: "clamp" }, interpolate: () => 0, useAnimatedScrollHandler: () => undefined, useAnimatedStyle: (fn: () => object) => fn(), useSharedValue: (value: unknown) => React.useRef({ value }).current };
});
jest.mock("react-native-pager-view", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { __esModule: true, default: React.forwardRef(function Pager(props: any, ref: any) {
    React.useImperativeHandle(ref, () => ({ setPage: jest.fn() }));
    return React.createElement(View, { ...props, testID: "lesson-pager" });
  }) };
});
jest.mock("../BunproReviewScreen", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text, TouchableOpacity } = jest.requireActual<typeof import("react-native")>("react-native");
  return { __esModule: true,
    buildReviewQueue: (response: any) => [...(response.pending_wrapup ?? []), ...(response.pending_attempt ?? [])],
    default: (props: any) => React.createElement(TouchableOpacity, { onPress: props.onComplete }, React.createElement(Text, null, "Complete quiz")),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getBunproQueue).mockResolvedValue({ data: [{ id: "11", type: "deck_setting", attributes: { deck_id: 1, daily_goal: 2, batch_size: 1, daily_goal_count_grammar: 0, daily_goal_count_vocab: 0 } }], included: [{ id: "1", type: "deck", attributes: { title: "N5 Grammar", grammar_count: 100 } }] } as any);
  jest.mocked(getBunproLearnIndex).mockResolvedValue({ content: [
    { data: { id: "1", type: "grammar_point", attributes: { title: "Lesson one", meaning: "One", level: "N5" } } },
    { data: { id: "2", type: "grammar_point", attributes: { title: "Lesson two", meaning: "Two", level: "N5" } } },
  ] } as any);
});

it("keeps the lesson batch after an invalid quiz response and retries that batch", async () => {
  jest.mocked(getBunproLearnQuiz).mockResolvedValueOnce({ review_session_id: 0, pending_attempt: [], pending_wrapup: [] } as any);
  const view = render(<BunproLessonScreen />);
  await waitFor(() => expect(view.getByText("Start Review")).toBeTruthy());
  fireEvent.press(view.getByText("Start Review"));
  await waitFor(() => expect(view.getByText(/did not return lesson questions/)).toBeTruthy());
  expect(view.getAllByText("Lesson one").length).toBeGreaterThan(0);
  expect(getBunproQueue).toHaveBeenCalledTimes(1);
  expect(getBunproLearnIndex).toHaveBeenCalledTimes(1);

  jest.mocked(getBunproLearnQuiz).mockResolvedValueOnce({ review_session_id: 42, pending_attempt: [{ data: { id: "1" } }], pending_wrapup: [] } as any);
  fireEvent.press(view.getByText("Start Review"));
  await waitFor(() => expect(view.getByText("Complete quiz")).toBeTruthy());
  expect(getBunproLearnQuiz).toHaveBeenNthCalledWith(2, { deckId: 1, reviewables: [["GrammarPoint", 1]] });
  fireEvent.press(view.getByText("Complete quiz"));
  expect(view.getAllByText("Lesson two").length).toBeGreaterThan(0);
  expect(view.getByText("Batch 2")).toBeTruthy();
});

it("serializes rapid quiz-start taps", async () => {
  let resolve!: (value: any) => void;
  jest.mocked(getBunproLearnQuiz).mockReturnValue(new Promise((yes) => { resolve = yes; }));
  const view = render(<BunproLessonScreen />);
  await waitFor(() => expect(view.getByText("Start Review")).toBeTruthy());
  const start = view.getByText("Start Review");
  act(() => { fireEvent.press(start); fireEvent.press(start); });
  expect(getBunproLearnQuiz).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ review_session_id: 42, pending_attempt: [{ data: { id: "1" } }], pending_wrapup: [] }));
  expect(view.getByText("Complete quiz")).toBeTruthy();
});

it.each(["study_question", "vocab_study_question"])("renders %s examples without Bunpro's hidden answer annotations", async (resourceType) => {
  jest.mocked(getBunproLearnIndex).mockResolvedValue({ content: [{
    data: { id: "1", type: "grammar_point", attributes: { title: "Lesson one", meaning: "One", level: "N5" } },
    included: [{ id: "example-1", type: resourceType, attributes: {
      content: "昨日、____。[[昨日、行かなかった。hidden annotation]]",
      answer: "行かなかった",
      translation: "I did not go yesterday.",
    } }],
  }] } as any);
  const view = render(<BunproLessonScreen />);
  await waitFor(() => expect(view.getByText("Start Review")).toBeTruthy());
  expect(view.getByText("I did not go yesterday.")).toBeTruthy();
  expect(view.getByText("行かなかった")).toBeTruthy();
  expect(view.queryByText(/hidden annotation|\[\[/)).toBeNull();
});
