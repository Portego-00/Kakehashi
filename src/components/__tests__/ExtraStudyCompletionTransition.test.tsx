import { act, render } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import ExtraStudyCompletionTransition, {
  useExtraStudyResultsReveal,
} from "../ExtraStudyCompletionTransition";

jest.mock("../../utils/theme", () => ({
  useTheme: () => ({
    theme: {
      backgroundColor: "#ffffff",
      primary: "#7c3aed",
      textColor: "#111111",
      textSecondary: "#555555",
    },
  }),
}));

function CompletionHarness({ isComplete }: { isComplete: boolean }) {
  const shouldRevealResults = useExtraStudyResultsReveal(isComplete);

  if (!isComplete) {
    return <Text>Question</Text>;
  }

  if (!shouldRevealResults) {
    return <ExtraStudyCompletionTransition />;
  }

  return <Text>Results</Text>;
}

describe("ExtraStudyCompletionTransition", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("replaces the question immediately before revealing results", () => {
    const { getByText, queryByText, rerender } = render(
      <CompletionHarness isComplete={false} />,
    );

    expect(getByText("Question")).toBeTruthy();

    rerender(<CompletionHarness isComplete />);

    expect(queryByText("Question")).toBeNull();
    expect(getByText("Complete!")).toBeTruthy();
    expect(queryByText("Results")).toBeNull();

    act(() => {
      jest.advanceTimersByTime(700);
    });

    expect(getByText("Results")).toBeTruthy();
  });
});
