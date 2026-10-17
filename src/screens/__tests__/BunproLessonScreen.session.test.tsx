import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import BunproLessonScreen from "../BunproLessonScreen";
import { getBunproLearnIndex, getBunproLearnQuiz, getBunproQueue, getBunproReviewableDetails, getBunproCoverage } from "../../utils/bunproApi";

jest.mock("../../components/bunpro/BunproContext", () => ({ BunproContext: ({ query }: { query: string }) => { const React = jest.requireActual("react"); return React.createElement(jest.requireActual("react-native").Text, null, `Context for ${query}`); } }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }), useLocalSearchParams: () => ({}) }));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("react-native-safe-area-context", () => ({ ...jest.requireActual("react-native-safe-area-context"), useSafeAreaInsets: () => ({ top: 59, right: 0, bottom: 34, left: 0 }) }));
jest.mock("../../utils/navigation-focus", () => ({ useOptionalScreenIsFocused: () => true }));
jest.mock("../../utils/store", () => ({ useAuthStore: () => ({ userData: { username: "Portego" } }) }));
jest.mock("../../utils/theme", () => ({ useTheme: () => ({ theme: { textColor: "#000", textSecondary: "#666", backgroundColor: "#fff", headerBackground: "#c55", headerText: "#fff", border: "#ccc", error: "#a00" }, isDark: false }) }));
jest.mock("../../utils/bunproApi", () => ({ BunproApiError: class extends Error {}, getBunproLearnIndex: jest.fn(), getBunproLearnQuiz: jest.fn(), getBunproQueue: jest.fn(), getBunproReviewableDetails: jest.fn(), getBunproCoverage: jest.fn() }));
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
    const [page, setPage] = React.useState(props.initialPage ?? 0);
    React.useImperativeHandle(ref, () => ({ setPage, setPageWithoutAnimation: setPage }));
    return React.createElement(View, { testID: "lesson-pager" }, React.Children.toArray(props.children)[page]);
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
  jest.mocked(getBunproCoverage).mockResolvedValue([]);
  jest.mocked(getBunproQueue).mockResolvedValue({ data: [{ id: "11", type: "deck_setting", attributes: { deck_id: 1, daily_goal: 2, batch_size: 1, daily_goal_count_grammar: 0, daily_goal_count_vocab: 0 } }], included: [{ id: "1", type: "deck", attributes: { title: "N5 Grammar", grammar_count: 100 } }] } as any);
  jest.mocked(getBunproLearnIndex).mockResolvedValue({ content: [
    { data: { id: "1", type: "grammar_point", attributes: { title: "Lesson one", meaning: "One", level: "N5" } } },
    { data: { id: "2", type: "grammar_point", attributes: { title: "Lesson two", meaning: "Two", level: "N5" } } },
  ] } as any);
});

it("keeps the lesson batch after an invalid quiz response and retries that batch", async () => {
  jest.mocked(getBunproLearnQuiz).mockResolvedValueOnce({ review_session_id: 0, pending_attempt: [], pending_wrapup: [] } as any);
  const view = render(<BunproLessonScreen />);
  await waitFor(() => expect(view.getByText("Start Quiz")).toBeTruthy());
  fireEvent.press(view.getByText("Start Quiz"));
  await waitFor(() => expect(view.getByText(/did not return lesson questions/)).toBeTruthy());
  expect(view.getAllByText("Lesson one").length).toBeGreaterThan(0);
  expect(getBunproQueue).toHaveBeenCalledTimes(1);
  expect(getBunproLearnIndex).toHaveBeenCalledTimes(1);

  jest.mocked(getBunproLearnQuiz).mockResolvedValueOnce({ review_session_id: 42, pending_attempt: [{ data: { id: "1" } }], pending_wrapup: [] } as any);
  fireEvent.press(view.getByText("Start Quiz"));
  await waitFor(() => expect(view.getByText("Complete quiz")).toBeTruthy());
  expect(getBunproLearnQuiz).toHaveBeenNthCalledWith(2, { deckId: 1, reviewables: [["GrammarPoint", 1]] });
  jest.mocked(getBunproLearnIndex).mockResolvedValueOnce({ content: [{ data: { id: "2", type: "grammar_point", attributes: { title: "Lesson two", meaning: "Two", level: "N5" } } }] } as any);
  fireEvent.press(view.getByText("Complete quiz"));
  await waitFor(() => expect(view.getAllByText("Lesson two").length).toBeGreaterThan(0));
  expect(getBunproQueue).toHaveBeenCalledTimes(2);
  expect(view.getByText(/Batch 2/)).toBeTruthy();
});

it("serializes rapid quiz-start taps", async () => {
  let resolve!: (value: any) => void;
  jest.mocked(getBunproLearnQuiz).mockReturnValue(new Promise((yes) => { resolve = yes; }));
  const view = render(<BunproLessonScreen />);
  await waitFor(() => expect(view.getByText("Start Quiz")).toBeTruthy());
  const start = view.getByText("Start Quiz");
  act(() => { fireEvent.press(start); fireEvent.press(start); });
  expect(getBunproLearnQuiz).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ review_session_id: 42, pending_attempt: [{ data: { id: "1" } }], pending_wrapup: [] }));
  expect(view.getByText("Complete quiz")).toBeTruthy();
});



it("loads a configured extra batch after the daily goal has already been reached", async () => {
  const base = await jest.mocked(getBunproQueue).getMockImplementation()!();
  jest.mocked(getBunproQueue).mockResolvedValue({ ...base, data: [{ ...base.data[0], attributes: { ...base.data[0].attributes, daily_goal: 4, daily_goal_count_grammar: 4, batch_size: 2 } }] });
  jest.mocked(getBunproLearnQuiz).mockResolvedValue({ review_session_id: 42, pending_attempt: [{ data: { id: "1" } }], pending_wrapup: [] } as any);
  const view = render(<BunproLessonScreen />);
  await waitFor(() => expect(view.getByText("Next")).toBeTruthy());
  fireEvent.press(view.getByText("Next"));
  fireEvent.press(view.getByText("Start Quiz"));
  await waitFor(() => expect(view.getByText("Complete quiz")).toBeTruthy());
  expect(getBunproLearnQuiz).toHaveBeenCalledWith({ deckId: 1, reviewables: [["GrammarPoint", 1], ["GrammarPoint", 2]] });
});

it("continues on the same unfinished deck after the final daily batch", async () => {
  const base = await jest.mocked(getBunproQueue).getMockImplementation()!();
  jest.mocked(getBunproQueue).mockResolvedValueOnce({ ...base, data: [{ ...base.data[0], attributes: { ...base.data[0].attributes, daily_goal: 1 } }] });
  jest.mocked(getBunproLearnQuiz).mockResolvedValue({ review_session_id: 42, pending_attempt: [{ data: { id: "1" } }], pending_wrapup: [] } as any);
  const view = render(<BunproLessonScreen />);
  await waitFor(() => expect(view.getByText("Start Quiz")).toBeTruthy());
  fireEvent.press(view.getByText("Start Quiz"));
  await waitFor(() => expect(view.getByText("Complete quiz")).toBeTruthy());
  jest.mocked(getBunproQueue).mockResolvedValueOnce({ ...base, data: [{ ...base.data[0], attributes: { ...base.data[0].attributes, daily_goal: 1, daily_goal_count_grammar: 1, batch_size: 2 } }] });
  jest.mocked(getBunproLearnIndex).mockResolvedValueOnce({ content: [{ data: { id: "3", type: "grammar_point", attributes: { title: "Extra lesson", meaning: "Extra", level: "N5" } } }] } as any);
  fireEvent.press(view.getByText("Complete quiz"));
  await waitFor(() => expect(view.getAllByText("Extra lesson").length).toBeGreaterThan(0));
  expect(getBunproLearnIndex).toHaveBeenLastCalledWith(expect.objectContaining({ deckId: 1 }));
});

it("uses the native Bunpro lesson tabs with prefetched structure and examples", async () => {
  jest.mocked(getBunproLearnIndex).mockResolvedValue({ content: [{
    data: { id: "1", type: "grammar_point", attributes: { title: "たり〜たりする", slug: "tari-tari", meaning: "Do things like", level: "N5", casual_structure: "Standard structure", polite_structure: "Polite structure" } },
    included: [{ id: "q1", type: "study_question", attributes: { content: "本（ほん）を ____。", answer: "読みます", translation: "I read books." } }],
  }] } as any);
  const view = render(<BunproLessonScreen />);
  await waitFor(() => expect(view.getByRole("tab", { name: "Meaning" })).toBeTruthy());
  expect(view.getByText("Standard structure")).toBeTruthy();
  fireEvent.press(view.getByText("Polite"));
  expect(view.getByText("Polite structure")).toBeTruthy();
  fireEvent.press(view.getByRole("tab", { name: "Examples" }));
  expect(view.getByText("I read books.")).toBeTruthy();
  expect(view.getByLabelText("Start Quiz")).toBeTruthy();
  expect(getBunproReviewableDetails).not.toHaveBeenCalled();
});

it("resets native tabs between grammar and vocabulary lessons while keeping batch navigation", async () => {
  const base = await jest.mocked(getBunproQueue).getMockImplementation()!();
  jest.mocked(getBunproQueue).mockResolvedValue({ ...base, data: [{ ...base.data[0], attributes: { ...base.data[0].attributes, batch_size: 2 } }] });
  jest.mocked(getBunproLearnIndex).mockResolvedValue({ content: [
    { data: { id: "1", type: "grammar_point", attributes: { title: "Grammar lesson", meaning: "One", level: "N5" } } },
    { data: { id: "2", type: "vocab", attributes: { title: "猫", kana: "ねこ", meaning: "Cat", jlpt_level: "N5" } } },
  ] } as any);
  const view = render(<BunproLessonScreen />);
  await waitFor(() => expect(view.getByRole("tab", { name: "Resources" })).toBeTruthy());
  fireEvent.press(view.getByRole("tab", { name: "Resources" }));
  fireEvent.press(view.getByLabelText("Next"));
  expect(view.getByText("猫")).toBeTruthy();
  expect(view.getByRole("tab", { name: "Meaning" }).props.accessibilityState.selected).toBe(true);
  fireEvent.press(view.getByRole("tab", { name: "Context" }));
  expect(view.getByText("Context for 猫")).toBeTruthy();
  fireEvent.press(view.getByLabelText("Previous"));
  expect(view.getByText("Grammar lesson")).toBeTruthy();
  expect(view.queryByRole("tab", { name: "Context" })).toBeNull();
  expect(view.getByRole("tab", { name: "Meaning" }).props.accessibilityState.selected).toBe(true);
  expect(getBunproLearnIndex).toHaveBeenCalledTimes(1);
  expect(getBunproReviewableDetails).not.toHaveBeenCalled();
});

it("keeps vocabulary knowledge checks and conjugation practice in the native lesson", async () => {
  jest.mocked(getBunproLearnIndex).mockResolvedValue({ content: [{
    data: { id: "1", type: "grammar_point", attributes: { title: "る-Verbs", slug: "る-Verbs", meaning: "Ru verbs", level: "N5", coverage_vocab_ids: [2] } },
    included: [{ id: "2", type: "reviewable_base_attribute_mixed", attributes: { id: 2, type_snake: "vocab", title: "猫", kana: "ねこ", meaning: "Cat" } }],
  }] } as any);
  const view = render(<BunproLessonScreen />);
  await waitFor(() => expect(view.getByText("Practice る-Verbs in Kaijugation")).toBeTruthy());
  await waitFor(() => expect(view.getByText("You’ve covered 0% of this item’s vocabulary · 0/1")).toBeTruthy());
  expect(view.getByLabelText("Knowledge Check").props.accessibilityState.disabled).toBe(false);
  expect(getBunproCoverage).toHaveBeenCalledWith([2], expect.anything());
  expect(view.getByLabelText("Start Quiz")).toBeTruthy();
});
