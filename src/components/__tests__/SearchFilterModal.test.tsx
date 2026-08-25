import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { StyleSheet } from "react-native";

import {
  createDefaultSearchFilters,
  SearchFilterModal,
} from "../SearchFilterModal";

jest.mock("@expo/vector-icons", () => {
  const React = jest.requireActual("react");
  const { Text } = jest.requireActual("react-native");
  return {
    Ionicons: ({ name }: { name: string }) =>
      React.createElement(Text, null, name),
  };
});

jest.mock("expo-blur", () => {
  const { View } = jest.requireActual("react-native");
  return { BlurView: View };
});

jest.mock("../../utils/subjectColors", () => ({
  useSubjectColors: () => ({
    radical: "#0088cc",
    kanji: "#cc0088",
    vocabulary: "#8800cc",
  }),
}));

jest.mock("../../utils/theme", () => ({
  useTheme: () => ({
    theme: {
      isDark: false,
      cardBackground: "#ffffff",
      backgroundColor: "#f5f5f5",
      border: "#dddddd",
      error: "#dc2626",
      primary: "#6d28d9",
      textColor: "#111111",
      textSecondary: "#666666",
      textLight: "#888888",
    },
  }),
}));

describe("SearchFilterModal frequency filters", () => {
  it("applies any valid maximum rank when frequency filters are enabled", async () => {
    const onApply = jest.fn();
    const screen = render(
      <SearchFilterModal
        visible
        currentFilters={createDefaultSearchFilters()}
        onClose={jest.fn()}
        onApply={onApply}
        showFrequencyFilters
      />,
    );

    const maximumRankInput = await waitFor(() =>
      screen.getByLabelText("Maximum word frequency rank"),
    );

    expect(StyleSheet.flatten(maximumRankInput.props.style).minHeight).toBe(
      44,
    );

    fireEvent.changeText(maximumRankInput, "3471");
    expect(
      screen.getByLabelText("Radicals subject type filter").props
        .accessibilityState,
    ).toEqual({ checked: false, disabled: true });
    expect(
      screen.getByLabelText("Vocabulary subject type filter").props
        .accessibilityState,
    ).toEqual({ checked: true, disabled: true });
    fireEvent.press(screen.getByText("Apply Filters"));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0].maxFrequencyRank).toBe(3471);
  });

  it("exposes SRS choices as selected, full-size checkboxes", async () => {
    const screen = render(
      <SearchFilterModal
        visible
        currentFilters={createDefaultSearchFilters()}
        onClose={jest.fn()}
        onApply={jest.fn()}
      />,
    );

    const burnedFilter = await waitFor(() =>
      screen.getByLabelText("Burned SRS filter"),
    );

    expect(burnedFilter.props.accessibilityRole).toBe("checkbox");
    expect(burnedFilter.props.accessibilityState).toEqual({ checked: true });
    expect(StyleSheet.flatten(burnedFilter.props.style).minHeight).toBe(44);
  });

  it("keeps invalid ranks from being applied and treats blank as Any", async () => {
    const onApply = jest.fn();
    const screen = render(
      <SearchFilterModal
        visible
        currentFilters={createDefaultSearchFilters()}
        onClose={jest.fn()}
        onApply={onApply}
        showFrequencyFilters
      />,
    );

    const maximumRankInput = await waitFor(() =>
      screen.getByLabelText("Maximum word frequency rank"),
    );
    fireEvent.changeText(maximumRankInput, "0");

    expect(screen.getByText("Enter a whole number greater than 0.")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Apply Filters" }).props
        .accessibilityState,
    ).toEqual({ disabled: true });

    fireEvent.press(screen.getByLabelText("Clear maximum word frequency rank"));
    fireEvent.press(screen.getByText("Apply Filters"));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0].maxFrequencyRank).toBeNull();
  });

  it("offers an inline opt-in before frequency lookups are enabled", async () => {
    const onEnableFrequencyFilters = jest.fn();
    const screen = render(
      <SearchFilterModal
        visible
        currentFilters={createDefaultSearchFilters()}
        onClose={jest.fn()}
        onApply={jest.fn()}
        showFrequencyFilters
        frequencyFiltersEnabled={false}
        onEnableFrequencyFilters={onEnableFrequencyFilters}
      />,
    );

    expect(
      screen.queryByLabelText("Maximum word frequency rank"),
    ).toBeNull();
    fireEvent.press(await screen.findByText("Enable Frequency Filtering"));

    expect(onEnableFrequencyFilters).toHaveBeenCalledTimes(1);
  });

  it("keeps frequency controls out of screens that do not opt in", () => {
    const screen = render(
      <SearchFilterModal
        visible
        currentFilters={createDefaultSearchFilters()}
        onClose={jest.fn()}
        onApply={jest.fn()}
      />,
    );

    expect(screen.queryByText("Word Frequency")).toBeNull();
    expect(
      screen.queryByLabelText("Maximum word frequency rank"),
    ).toBeNull();
  });
});
