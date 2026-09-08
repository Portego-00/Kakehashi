import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import React from "react";
import { StyleSheet } from "react-native";
import { createCustomSrsState } from "../../../../web/src/features/custom-srs/model";
import * as Haptics from "../../../utils/haptics";
import { CUSTOM_VOCABULARY_PACKS } from "../catalog";
import CustomSrsDashboardCard from "../CustomSrsDashboardCard";
import { nextCustomReviewAt, useCustomSrs } from "../data";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("../../../utils/haptics", () => ({ selectionAsync: jest.fn() }));
jest.mock("../../../utils/subjectColors", () => ({ useSubjectColors: () => ({ vocabulary: "#9c38d9" }) }));
jest.mock("../../../utils/theme", () => ({
  useTheme: () => ({
    theme: {
      cardBackground: "#1e1e1e",
      textColor: "#f5f5f5",
      textSecondary: "#b0b0b0",
      textLight: "#808080",
      border: "#333333",
      error: "#e57373",
    },
  }),
}));
jest.mock("../data", () => ({ useCustomSrs: jest.fn(), nextCustomReviewAt: jest.fn() }));

function mockProgress(overrides: Partial<ReturnType<typeof useCustomSrs>> = {}) {
  const state = createCustomSrsState();
  const progress: ReturnType<typeof useCustomSrs> = {
    accountId: "portego-test-account",
    revision: 0,
    state,
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
  };
  jest.mocked(useCustomSrs).mockReturnValue(progress);
  return progress;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(nextCustomReviewAt).mockReturnValue(null);
  mockProgress();
});

it("opens lessons, reviews, and packs from compact native rows with haptics", () => {
  const pack = CUSTOM_VOCABULARY_PACKS[0];
  mockProgress({ lessonWords: pack.words.slice(0, 5), reviewWords: pack.words.slice(5, 7) });
  const screen = render(<CustomSrsDashboardCard />);
  const lessons = screen.getByRole("button", { name: "Custom vocabulary lessons, 5 available" });
  const reviews = screen.getByRole("button", { name: "Custom vocabulary reviews, 2 due" });
  const explore = screen.getByRole("button", { name: "Explore vocabulary packs" });

  for (const action of [lessons, reviews, explore]) {
    expect(StyleSheet.flatten(action.props.style)).toMatchObject({
      flexDirection: "row",
      minHeight: 54,
    });
    fireEvent.press(action);
  }
  expect(router.push).toHaveBeenNthCalledWith(1, "/custom-vocabulary/lessons");
  expect(router.push).toHaveBeenNthCalledWith(2, "/custom-vocabulary/reviews");
  expect(router.push).toHaveBeenNthCalledWith(3, "/custom-vocabulary");
  expect(Haptics.selectionAsync).toHaveBeenCalledTimes(3);
  expect(screen.queryByText(/Progress synced with web/)).toBeNull();
});

it("disables empty study queues but keeps exploration available", () => {
  const screen = render(<CustomSrsDashboardCard />);
  for (const label of ["Custom vocabulary lessons, 0 available", "Custom vocabulary reviews, 0 due"]) {
    const action = screen.getByRole("button", { name: label });
    expect(action.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(action);
  }
  expect(router.push).not.toHaveBeenCalled();
  expect(screen.getByText("Add a pack to get started")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Explore vocabulary packs" }));
  expect(router.push).toHaveBeenCalledWith("/custom-vocabulary");
});

it("hides stale counts and blocks study actions during the initial load", () => {
  const pack = CUSTOM_VOCABULARY_PACKS[0];
  mockProgress({ loading: true, lessonWords: pack.words.slice(0, 5), reviewWords: pack.words.slice(5, 7) });
  const screen = render(<CustomSrsDashboardCard />);
  expect(screen.getByLabelText("Syncing vocabulary packs")).toBeTruthy();
  expect(screen.getAllByText("—")).toHaveLength(2);
  for (const label of ["Custom vocabulary lessons, 5 available", "Custom vocabulary reviews, 2 due"]) {
    const action = screen.getByRole("button", { name: label });
    expect(action.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    fireEvent.press(action);
  }
  expect(router.push).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "Explore vocabulary packs" }));
  expect(router.push).toHaveBeenCalledWith("/custom-vocabulary");
});

it("keeps cached study actions available during background refresh", () => {
  mockProgress({ syncing: true, lessonWords: CUSTOM_VOCABULARY_PACKS[0].words.slice(0, 5) });
  const screen = render(<CustomSrsDashboardCard />);
  expect(screen.getByLabelText("Syncing vocabulary packs")).toBeTruthy();
  const lessons = screen.getByRole("button", { name: "Custom vocabulary lessons, 5 available" });
  expect(lessons.props.accessibilityState.disabled).toBe(false);
  fireEvent.press(lessons);
  expect(router.push).toHaveBeenCalledWith("/custom-vocabulary/lessons");
});

it("shows the next review time in the reviews row", () => {
  jest.mocked(nextCustomReviewAt).mockReturnValue(new Date("2026-09-10T09:30:00.000Z"));
  const screen = render(<CustomSrsDashboardCard />);
  const label = screen.getByText(/^Next /);
  expect(screen.getByRole("button", { name: "Custom vocabulary reviews, 0 due" }).props.accessibilityHint).toBe(label.props.children);
  expect(label.props.children).toContain("30");
});

it("offers a retry without hiding exploration when progress cannot sync", async () => {
  const refresh = jest.fn().mockRejectedValue(new Error("Still offline"));
  mockProgress({ error: "Connection failed", refresh });
  const screen = render(<CustomSrsDashboardCard />);
  expect(screen.getByText("Couldn’t sync progress. Tap to retry.")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Retry vocabulary pack sync" }));
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  fireEvent.press(screen.getByRole("button", { name: "Explore vocabulary packs" }));
  expect(router.push).toHaveBeenCalledWith("/custom-vocabulary");
});

it.each([1, 2])("summarizes %s enrolled packs without sync boilerplate", (count) => {
  const progress = mockProgress();
  mockProgress({ state: { ...progress.state, enrolledPackIds: CUSTOM_VOCABULARY_PACKS.slice(0, count).map((pack) => pack.id) } });
  const screen = render(<CustomSrsDashboardCard />);
  expect(screen.getByText(count === 1 ? "1 pack added" : "2 packs added")).toBeTruthy();
});
