import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import React from "react";
import { RefreshControl } from "react-native";
import { createCustomSrsState } from "../../../../web/src/features/custom-srs/model";
import { CUSTOM_VOCABULARY_PACKS } from "../catalog";
import CustomSrsDashboardCard from "../CustomSrsDashboardCard";
import CustomVocabularyDetail from "../CustomVocabularyDetail";
import CustomVocabularyHub from "../CustomVocabularyHub";
import { useCustomSrs } from "../data";
import VocabularyDetails from "../../../components/VocabularyDetails";
import type { CustomSrsState } from "../types";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) }, Stack: { Screen: () => null }, useLocalSearchParams: () => ({}) }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@react-native-segmented-control/segmented-control", () => "SegmentedControl");
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 20, left: 0, right: 0 }) }));
jest.mock("../../../utils/haptics", () => ({ selectionAsync: jest.fn(), notificationAsync: jest.fn(), NotificationFeedbackType: { Success: "success" } }));
jest.mock("../../../utils/subjectColors", () => ({ useSubjectColors: () => ({ vocabulary: "#9c38d9" }), withAlpha: (color: string) => color, getBestContrastTextColor: () => "#ffffff" }));
jest.mock("../../../utils/theme", () => ({ useTheme: () => ({ theme: { backgroundColor: "#121212", cardBackground: "#1e1e1e", textColor: "#f5f5f5", textSecondary: "#b0b0b0", textLight: "#808080", border: "#333333", error: "#e57373", primary: "#3A86FF", isDark: true } }) }));
jest.mock("../../../utils/store", () => ({ useAuthStore: (selector: (state: unknown) => unknown) => selector({ userData: { username: "Portego", level: 21 } }) }));
jest.mock("../../../components/VocabularyDetails", () => jest.fn(() => null));
jest.mock("../data", () => ({
  useCustomSrs: jest.fn(),
  nextCustomReviewAt: () => null,
  customPackProgress: (state: { assignments: Record<string, { stage: number }> }, pack: { words: { id: string }[] }) => ({
    total: pack.words.length,
    lessons: pack.words.filter((word) => !state.assignments[word.id]?.stage).length,
    burned: 0,
    due: 0,
  }),
}));

type ProgressOverrides = Partial<Pick<ReturnType<typeof useCustomSrs>, "loading" | "syncing" | "error" | "lessonWords" | "reviewWords">> & { state?: Partial<CustomSrsState> };

function mockProgress(overrides: ProgressOverrides = {}) {
  const state: CustomSrsState = { ...createCustomSrsState(), ...overrides.state };
  const progress = {
    accountId: "portego-test-account",
    revision: 0,
    loading: false,
    isLoading: false,
    syncing: false,
    error: null,
    refresh: jest.fn().mockResolvedValue(state),
    enrollPack: jest.fn().mockResolvedValue(state),
    completeLesson: jest.fn().mockResolvedValue(state),
    submitReview: jest.fn().mockResolvedValue(state),
    lessonWords: [],
    reviewWords: [],
    ...overrides,
    state,
  };
  jest.mocked(useCustomSrs).mockReturnValue(progress);
  return progress;
}

beforeEach(() => { jest.clearAllMocks(); mockProgress(); });

it("renders the app's own header and a working back control while packs sync", () => {
  mockProgress({ loading: true });
  const screen = render(<CustomVocabularyHub />);
  expect(screen.getByRole("header", { name: "Vocabulary packs" })).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Go back"));
  expect(router.back).toHaveBeenCalledTimes(1);
  expect(router.push).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
});

it("keeps the same app header on an individual pack during a sync error", () => {
  mockProgress({ error: "Cloud sync timed out" });
  const screen = render(<CustomVocabularyHub packId="conversation-glue" />);
  expect(screen.getByRole("header", { name: "Conversation Glue" })).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Go back"));
  expect(router.back).toHaveBeenCalledTimes(1);
});

it("does not show the pull-to-refresh spinner for a background sync", () => {
  mockProgress({ syncing: true });
  const screen = render(<CustomVocabularyHub />);
  expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false);
});

it("shows the pull-to-refresh spinner only for an actual refresh gesture", async () => {
  const progress = mockProgress();
  let finishRefresh!: () => void;
  progress.refresh.mockImplementationOnce(() => new Promise<void>((resolve) => { finishRefresh = resolve; }));
  const screen = render(<CustomVocabularyHub />);
  fireEvent(screen.UNSAFE_getByType(RefreshControl), "refresh");
  expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(true);
  await act(async () => finishRefresh());
  expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false);
});

it("searches by a vocabulary word and opens its pack", () => {
  const screen = render(<CustomVocabularyHub />);
  fireEvent.changeText(screen.getByLabelText("Find a pack or word"), "やっぱり");
  fireEvent.press(screen.getByLabelText("Conversation Glue, 16 words"));
  expect(router.push).toHaveBeenCalledWith({ pathname: "/custom-vocabulary", params: { packId: "conversation-glue" } });
});

it("shows compact vocabulary previews instead of repeating pack descriptions", () => {
  const screen = render(<CustomVocabularyHub />);
  expect(screen.getByText("Conversation Glue")).toBeTruthy();
  expect(screen.queryByText(CUSTOM_VOCABULARY_PACKS[0].description)).toBeNull();
  expect(screen.queryByText(/Your progress syncs with the web app/)).toBeNull();
});

it("filters the native pack browser to enrolled packs and kana or kanji", () => {
  mockProgress({ state: { enrolledPackIds: ["conversation-glue"] } });
  const screen = render(<CustomVocabularyHub />);
  const control = screen.UNSAFE_getByType("SegmentedControl" as never);
  fireEvent(control, "change", { nativeEvent: { selectedSegmentIndex: 1 } });
  expect(screen.getByLabelText("Conversation Glue, 16 words, added to my packs")).toBeTruthy();
  expect(screen.getByLabelText("Conversation Glue, 16 words, added to my packs").props.accessibilityHint).toBe("Hiragana. 0 of 16 learned. 0 reviews due. Opens pack details.");
  expect(screen.queryByText(CUSTOM_VOCABULARY_PACKS[1].title)).toBeNull();

  fireEvent(control, "change", { nativeEvent: { selectedSegmentIndex: 3 } });
  expect(screen.queryByText("Conversation Glue")).toBeNull();
  const kanjiPack = CUSTOM_VOCABULARY_PACKS.find((pack) => pack.script === "kanji")!;
  expect(screen.getByText(kanjiPack.title)).toBeTruthy();

  fireEvent(control, "change", { nativeEvent: { selectedSegmentIndex: 2 } });
  expect(screen.getByText("Conversation Glue")).toBeTruthy();
  expect(screen.queryByText(kanjiPack.title)).toBeNull();
});

it("keeps the native study rows disabled while progress is loading", () => {
  mockProgress({ loading: true, state: { enrolledPackIds: ["conversation-glue"] } });
  const screen = render(<CustomVocabularyHub packId="conversation-glue" />);
  const lessons = screen.getByLabelText("Start lessons, 16 available");
  expect(lessons.props.accessibilityState.disabled).toBe(true);
  fireEvent.press(lessons);
  expect(router.push).not.toHaveBeenCalled();
});

it("keeps pack descriptions and accessible progress on the pack detail screen", () => {
  mockProgress({ state: { enrolledPackIds: ["conversation-glue"] } });
  const screen = render(<CustomVocabularyHub packId="conversation-glue" />);
  expect(screen.getByText(CUSTOM_VOCABULARY_PACKS[0].description)).toBeTruthy();
  expect(screen.getByLabelText("Pack learning progress").props.accessibilityValue).toEqual({ min: 0, max: 16, now: 0 });
  fireEvent.changeText(screen.getByLabelText("Find a word in this pack"), "やっぱり");
  expect(screen.getByLabelText("やっぱり, As Expected")).toBeTruthy();
  expect(screen.queryByLabelText("どうぞ, Please")).toBeNull();
});

it("shows a useful empty search result and supports unknown pack recovery", () => {
  const screen = render(<CustomVocabularyHub />);
  fireEvent.changeText(screen.getByLabelText("Find a pack or word"), "there-is-no-such-pack");
  expect(screen.getByText("No matches. Try another word or meaning.")).toBeTruthy();
  screen.unmount();
  const missing = render(<CustomVocabularyHub packId="missing" />);
  fireEvent.press(missing.getByText("Explore packs"));
  expect(router.replace).toHaveBeenCalledWith("/custom-vocabulary");
});

it("adds the selected pack and reports a persistence failure without starting lessons", async () => {
  const progress = mockProgress();
  progress.enrollPack.mockRejectedValue(new Error("Cloud save unavailable"));
  const screen = render(<CustomVocabularyHub packId="conversation-glue" />);
  fireEvent.press(screen.getByLabelText("Add Conversation Glue to my packs"));
  await waitFor(() => expect(screen.getByText("Cloud save unavailable")).toBeTruthy());
  expect(progress.enrollPack).toHaveBeenCalledWith("conversation-glue");
  expect(router.push).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText("Retry sync"));
  expect(progress.refresh).toHaveBeenCalled();
});

it("starts pack-scoped lessons and opens a word's own subject details", () => {
  mockProgress({ state: { enrolledPackIds: ["conversation-glue"], assignments: {} } });
  const screen = render(<CustomVocabularyHub packId="conversation-glue" />);
  fireEvent.press(screen.getByLabelText("Start lessons, 16 available"));
  expect(router.push).toHaveBeenCalledWith({ pathname: "/custom-vocabulary/lessons", params: { packId: "conversation-glue" } });
  fireEvent.press(screen.getByLabelText("やっぱり, As Expected"));
  expect(router.push).toHaveBeenCalledWith({ pathname: "/custom-vocabulary/word/[wordId]", params: { wordId: "conversation-yappari" } });
  expect(screen.getByLabelText("Start reviews, 0 due").props.accessibilityState.disabled).toBe(true);
});

it("offers lessons, reviews, and exploration in the dashboard card", () => {
  const pack = CUSTOM_VOCABULARY_PACKS[0];
  mockProgress({ lessonWords: pack.words.slice(0, 5), reviewWords: pack.words.slice(5, 7), state: { enrolledPackIds: [pack.id], assignments: {} } });
  const screen = render(<CustomSrsDashboardCard />);
  fireEvent.press(screen.getByLabelText("Custom vocabulary lessons, 5 available"));
  expect(router.push).toHaveBeenLastCalledWith("/custom-vocabulary/lessons");
  fireEvent.press(screen.getByLabelText("Custom vocabulary reviews, 2 due"));
  expect(router.push).toHaveBeenLastCalledWith("/custom-vocabulary/reviews");
  fireEvent.press(screen.getByLabelText("Explore vocabulary packs"));
  expect(router.push).toHaveBeenLastCalledWith("/custom-vocabulary");
});

it("shows a recoverable dashboard sync error and keeps exploration available", () => {
  const progress = mockProgress({ error: "Connection failed" });
  const screen = render(<CustomSrsDashboardCard />);
  expect(screen.getByLabelText("Custom vocabulary lessons, 0 available").props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getByLabelText("Retry vocabulary pack sync"));
  expect(progress.refresh).toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText("Explore vocabulary packs"));
  expect(router.push).toHaveBeenLastCalledWith("/custom-vocabulary");
});

it("reuses native subject details with rich examples and no WaniKani editing callbacks", () => {
  render(<CustomVocabularyDetail wordId="conversation-yappari" />);
  const props = jest.mocked(VocabularyDetails).mock.calls[0][0];
  expect(props.vocabulary.id).toBeLessThan(0);
  expect(props.vocabulary.object).toBe("kana_vocabulary");
  expect(props.vocabulary.contextSentences).toHaveLength(2);
  expect(props.vocabulary.meaningMnemonic).toContain("<vocabulary>");
  expect(props.vocabulary.readings).toEqual([]);
  expect(props.onSynonymsChange).toBeUndefined();
  expect(props.vocabulary.onEditNote).toBeUndefined();
  expect(props.onAddToList).toBeUndefined();
  props.onSubjectPress?.(42);
  expect(router.push).toHaveBeenLastCalledWith({ pathname: "/subject/[id]", params: { id: "42" } });
});
