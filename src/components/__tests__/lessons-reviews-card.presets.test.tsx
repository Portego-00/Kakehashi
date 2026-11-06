import React from "react";
import { act, cleanupAsync, fireEvent, render } from "@testing-library/react-native";
import { Image, StyleSheet, TouchableOpacity } from "react-native";
import LessonsReviewsCard from "../LessonsReviewsCard";
import { useSettingsStore } from "../../utils/store";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: jest.requireActual("react-native").View }));

const quick = { id: "quick", name: "Quick", batchSize: 5, reviewOrder: "ascendingSrsStage" as const };
const longer = { id: "longer", name: "Longer", batchSize: 20, reviewOrder: "random" as const };

beforeEach(() => {
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  useSettingsStore.setState({ reviewBatchSizeEnabled: true, reviewBatchSize: 50, reviewPresetsEnabled: true, reviewPresets: [quick, longer] });
});
afterEach(async () => { await cleanupAsync(); useSettingsStore.setState(useSettingsStore.getInitialState(), true); });

it("selects a preset without starting reviews and only passes it when the start action is pressed", () => {
  const onStart = jest.fn();
  const screen = render(<LessonsReviewsCard type="reviews" count={30} onPress={onStart} />);
  fireEvent.press(screen.getByLabelText("Quick, 5 reviews, Lower SRS first"), { stopPropagation: jest.fn() });
  expect(onStart).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText("Start 5 Reviews"), { stopPropagation: jest.fn() });
  expect(onStart).toHaveBeenLastCalledWith(quick);
  fireEvent.press(screen.getByLabelText("Longer, 20 reviews, Random"), { stopPropagation: jest.fn() });
  fireEvent.press(screen.getByLabelText("Start 20 Reviews"), { stopPropagation: jest.fn() });
  expect(onStart).toHaveBeenLastCalledWith(longer);
  fireEvent.press(screen.getByLabelText("Use default review settings"), { stopPropagation: jest.fn() });
  fireEvent.press(screen.getByLabelText("Start 30 Reviews"), { stopPropagation: jest.fn() });
  expect(onStart).toHaveBeenLastCalledWith(undefined);
  expect(useSettingsStore.getState().reviewBatchSize).toBe(50);
});

it("returns to the default if a selected preset is removed, and hides presets when batching is off", () => {
  const onStart = jest.fn();
  const screen = render(<LessonsReviewsCard type="reviews" count={30} onPress={onStart} />);
  fireEvent.press(screen.getByLabelText("Quick, 5 reviews, Lower SRS first"), { stopPropagation: jest.fn() });
  act(() => useSettingsStore.getState().setReviewPresets([longer]));
  fireEvent.press(screen.getByLabelText("Start 30 Reviews"), { stopPropagation: jest.fn() });
  expect(onStart).toHaveBeenLastCalledWith(undefined);
  act(() => useSettingsStore.getState().setReviewBatchSizeEnabled(false));
  expect(screen.queryByLabelText("Longer, 20 reviews, Random")).toBeNull();
});

it("adapts artwork to the card's available width without losing the selected review preset", () => {
  const onStart = jest.fn();
  const screen = render(<LessonsReviewsCard type="reviews" count={30} onPress={onStart} />);
  fireEvent.press(screen.getByLabelText("Quick, 5 reviews, Lower SRS first"), { stopPropagation: jest.fn() });
  const card = screen.UNSAFE_getAllByType(TouchableOpacity)[0];

  fireEvent(card, "layout", { nativeEvent: { layout: { width: 900, height: 180, x: 0, y: 0 } } });
  expect(StyleSheet.flatten(screen.UNSAFE_getByType(Image).props.style).width).toBe(150);

  fireEvent(card, "layout", { nativeEvent: { layout: { width: 320, height: 220, x: 0, y: 0 } } });
  expect(StyleSheet.flatten(screen.UNSAFE_getByType(Image).props.style).width).toBe(100);
  fireEvent.press(screen.getByLabelText("Start 5 Reviews"), { stopPropagation: jest.fn() });
  expect(onStart).toHaveBeenLastCalledWith(quick);
});
