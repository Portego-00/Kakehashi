import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import BunproHomeStudy from "../BunproHomeStudy";
import { useBunproDashboard } from "../../../hooks/useBunproDashboard";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: { View: jest.requireActual("react-native").View },
  Easing: { bezier: () => (value: number) => value },
  ReduceMotion: { System: "system" },
  useSharedValue: (value: number) => jest.requireActual("react").useRef({ value }).current,
  useAnimatedStyle: (callback: () => object) => callback(),
  withTiming: (value: unknown) => value,
}));
jest.mock("../../../hooks/useBunproDashboard", () => ({ useBunproDashboard: jest.fn() }));
jest.mock("../../../utils/theme", () => ({ useTheme: () => ({ theme: { isDark: false, textColor: "#222", textSecondary: "#666", border: "#ddd" } }) }));

const mockRefresh = jest.fn();
const snapshot = () => ({
  eligible: true, status: "ready" as const, token: "test", refreshing: false,
  due: { total_due_grammar: 12, total_due_vocab: 8 },
  queue: { data: [{ id: "1", type: "deck_setting", attributes: { id: 1, user_id: 1, deck_id: 5, batch_size: 3, default_srs_level: 0, sorting_order: "default", daily_goal: 10, daily_goal_count_grammar: 2, daily_goal_count_vocab: 0 } }], included: [{ id: "5", type: "deck", attributes: { id: 5, slug: "n5", title: "N5 Grammar", grammar_count: 100, vocab_count: 0 } }] },
  analytics: null, error: null, refresh: mockRefresh,
});

beforeEach(() => { jest.clearAllMocks(); jest.mocked(useBunproDashboard).mockReturnValue(snapshot()); });

it("routes each lesson and review entry to its own queue", () => {
  const screen = render(<BunproHomeStudy wanikaniCount={30} />);
  fireEvent.press(screen.getByLabelText("Start Bunpro lessons"));
  expect(router.push).toHaveBeenLastCalledWith({ pathname: "/bunpro-lessons", params: { deckId: "5" } });
  fireEvent.press(screen.getByLabelText("Choose Bunpro lesson deck"));
  fireEvent.press(screen.getByLabelText("Learn N5 Grammar"));
  expect(router.push).toHaveBeenLastCalledWith({ pathname: "/bunpro-lessons", params: { deckId: "5" } });
  fireEvent.press(screen.getByLabelText("Choose Bunpro review type"));
  expect(screen.queryByLabelText("Learn N5 Grammar")).toBeNull();
  fireEvent.press(screen.getByLabelText("Bunpro Grammar only reviews"));
  expect(router.push).toHaveBeenLastCalledWith({ pathname: "/bunpro-reviews", params: { mode: "grammar" } });
  fireEvent.press(screen.getByLabelText("Bunpro Vocabulary only reviews"));
  expect(router.push).toHaveBeenLastCalledWith({ pathname: "/bunpro-reviews", params: { mode: "vocab" } });
  fireEvent.press(screen.getByLabelText("Bunpro reviews: grammar and vocabulary, 20 due"));
  expect(router.push).toHaveBeenLastCalledWith({ pathname: "/bunpro-reviews", params: { mode: "all" } });
});

it("shows combined counts and routes all three mixed modes", () => {
  const screen = render(<BunproHomeStudy wanikaniCount={30} />);
  expect(screen.queryByLabelText("Start mixed Grammar reviews")).toBeNull();
  fireEvent.press(screen.getByLabelText("Mix with WaniKani reviews"));
  expect(screen.getByText("42")).toBeTruthy();
  expect(screen.getByText("38")).toBeTruthy();
  expect(screen.getByText("50")).toBeTruthy();
  for (const [mode, label] of [["grammar", "Grammar"], ["vocab", "Vocabulary"], ["all", "Grammar + vocabulary"]]) {
    fireEvent.press(screen.getByLabelText(`Start mixed ${label} reviews`));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: "/mixed-reviews", params: { mode } });
  }
});

it("does not present missing counts as zero and supports retry", () => {
  jest.mocked(useBunproDashboard).mockReturnValue({ ...snapshot(), due: null, queue: null, status: "error", error: "Bunpro could not be refreshed. Please try again." });
  const screen = render(<BunproHomeStudy />);
  expect(screen.getByLabelText("Bunpro reviews: grammar and vocabulary, — due")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Mix with WaniKani reviews"));
  expect(screen.getAllByText("WaniKani — + Bunpro —")).toHaveLength(3);
  fireEvent.press(screen.getByText("Retry"));
  expect(mockRefresh).toHaveBeenCalledTimes(1);
});

it("hides all Bunpro controls for another account", () => {
  jest.mocked(useBunproDashboard).mockReturnValue({ ...snapshot(), eligible: false, status: "disabled" });
  const screen = render(<BunproHomeStudy />);
  expect(screen.queryByTestId("bunpro-home-study")).toBeNull();
});

it("offers connection setup without starting a queue when disconnected", () => {
  jest.mocked(useBunproDashboard).mockReturnValue({ ...snapshot(), status: "unconfigured", token: null, due: null, queue: null });
  const screen = render(<BunproHomeStudy />);
  fireEvent.press(screen.getByText("Connect Bunpro"));
  expect(router.push).toHaveBeenLastCalledWith("/(app)/(bunpro-tabs)");
  expect(screen.queryByLabelText("Start Bunpro lessons")).toBeNull();
});

it("hides closing sections from accessibility and accepts repeated toggle reversals", () => {
  const screen = render(<BunproHomeStudy wanikaniCount={30} />);
  for (const [toggleLabel, contentLabel] of [
    ["Choose Bunpro lesson deck", "Learn N5 Grammar"],
    ["Choose Bunpro review type", "Bunpro Grammar only reviews"],
    ["Mix with WaniKani reviews", "Start mixed Grammar reviews"],
  ]) {
    const toggle = screen.getByLabelText(toggleLabel);
    expect(screen.queryByLabelText(contentLabel)).toBeNull();
    fireEvent.press(toggle);
    expect(screen.getByLabelText(contentLabel)).toBeTruthy();
    fireEvent.press(toggle);
    expect(screen.queryByLabelText(contentLabel)).toBeNull();
    // Content stays mounted to measure and animate, but is no longer accessible.
    expect(screen.getByLabelText(contentLabel, { includeHiddenElements: true })).toBeTruthy();
    fireEvent.press(toggle);
    fireEvent.press(toggle);
    fireEvent.press(toggle);
    expect(screen.getByLabelText(toggleLabel).props.accessibilityState.expanded).toBe(true);
    expect(screen.getByLabelText(contentLabel)).toBeTruthy();
    fireEvent.press(toggle);
  }
  expect(router.push).not.toHaveBeenCalled();
});

it("updates an open lesson queue and keeps review disclosure mutually exclusive", () => {
  const screen = render(<BunproHomeStudy />);
  fireEvent.press(screen.getByLabelText("Choose Bunpro lesson deck"));
  const updated = snapshot();
  updated.queue.data.push({ ...updated.queue.data[0], id: "2", attributes: { ...updated.queue.data[0].attributes, id: 2, deck_id: 6 } });
  updated.queue.included.push({ ...updated.queue.included[0], id: "6", attributes: { ...updated.queue.included[0].attributes, id: 6, title: "N4 Grammar" } });
  jest.mocked(useBunproDashboard).mockReturnValue(updated);
  screen.rerender(<BunproHomeStudy />);
  expect(screen.getByLabelText("Learn N4 Grammar")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Choose Bunpro review type"));
  expect(screen.queryByLabelText("Learn N4 Grammar")).toBeNull();
  expect(screen.getByLabelText("Bunpro Grammar only reviews")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Choose Bunpro lesson deck"));
  expect(screen.queryByLabelText("Bunpro Grammar only reviews")).toBeNull();
  fireEvent.press(screen.getByLabelText("Learn N4 Grammar"));
  expect(router.push).toHaveBeenLastCalledWith({ pathname: "/bunpro-lessons", params: { deckId: "6" } });
});
