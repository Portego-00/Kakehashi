import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { StyleSheet } from "react-native";
import ReviewResultsScreen from "../ReviewResultsScreen";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("react-native-svg", () => ({ SvgXml: () => null }));
jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native");
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock("../../utils/fonts", () => ({ fontStyles: { japaneseText: {} } }));
jest.mock("../../utils/radicalSvg", () => ({ pickBestImage: () => null, useRemoteSvg: () => null }));
jest.mock("../../utils/subjectColors", () => ({ getSubjectTypeColor: () => "#dd0093" }));
jest.mock("../../utils/theme", () => ({
  useTheme: () => ({ theme: { backgroundColor: "#ffffff", cardBackground: "#ffffff", border: "#dddddd", secondary: "#7c3aed", textColor: "#111111", textSecondary: "#555555" } }),
}));
jest.mock("../AddToSubjectListsModal", () => () => null);

const defaultProps: React.ComponentProps<typeof ReviewResultsScreen> = {
  reviewItems: [{
    id: 1, assignmentId: 10, subjectId: 1,
    subject: { id: 1, object: "radical", data: { characters: "一", meanings: [{ meaning: "ground", primary: true }] } } as React.ComponentProps<typeof ReviewResultsScreen>["reviewItems"][number]["subject"],
    meaningDone: true, readingDone: false, meaningIncorrect: 0, readingIncorrect: 0,
    meaningCorrectlyAnswered: true,
  }],
  progress: { current: 1, total: 1, meaningCorrect: 1, readingCorrect: 0, totalItems: 1, answeredCount: 1, completedItems: 1, meaningAttempts: 1, readingAttempts: 0, correctAnswersCount: 1 },
  submittingResults: false,
  onBackToDashboard: jest.fn(),
};

it.each([0, 1])("allows Redo with %i mistakes and uses the existing icon button size", (mistakes) => {
  const onRedo = jest.fn();
  const screen = render(<ReviewResultsScreen {...defaultProps} onRedo={onRedo}
    reviewItems={[{ ...defaultProps.reviewItems[0], meaningIncorrect: mistakes }]} />);
  const button = screen.getByRole("button", { name: "Redo" });
  expect(StyleSheet.flatten(button.props.style)).toMatchObject({ width: 54, minHeight: 54 });
  if (mistakes > 0) {
    expect(screen.getByLabelText("Add mistakes to lists")).toBeTruthy();
    expect(screen.getByText("Practice Mistakes • 1")).toBeTruthy();
  }
  fireEvent.press(button);
  expect(onRedo).toHaveBeenCalledTimes(1);
});

it("shows Redo only for sessions that support it and waits for result submission", () => {
  const screen = render(<ReviewResultsScreen {...defaultProps} />);
  expect(screen.queryByLabelText("Redo")).toBeNull();
  screen.rerender(<ReviewResultsScreen {...defaultProps} onRedo={jest.fn()} submittingResults />);
  expect(screen.queryByLabelText("Redo")).toBeNull();
  screen.rerender(<ReviewResultsScreen {...defaultProps} onRedo={jest.fn()} reviewItems={[]} />);
  expect(screen.queryByLabelText("Redo")).toBeNull();
});
