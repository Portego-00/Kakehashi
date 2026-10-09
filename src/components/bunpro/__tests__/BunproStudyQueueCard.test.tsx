import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import BunproStudyQueueCard from "../BunproStudyQueueCard";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

it("keeps the Bunpro tab Learn action enabled after the goal and highlights extra lessons", () => {
  const start = jest.fn();
  const screen = render(<BunproStudyQueueCard panelBackground="#fff" panelBorder="#ccc" accent="#c64949" accentSoft="#082832" softText="#666" learnGoal={6} learnedTodayCount={6} extraLearnedCount={2} nextLessonBatchCount={2} remainingLessons={0} availableReviews={1} dueTomorrow={1} dueNowGrammar={1} dueNowVocab={0} onPressLearn={start} />);
  expect(screen.getByText("6/6")).toBeTruthy();
  fireEvent.press(screen.getByText("Next batch: 2"));
  expect(start).toHaveBeenCalledTimes(1);
  const extras = screen.getAllByTestId("bunpro-extra-lesson-segment");
  expect(extras).toHaveLength(2);
  for (const segment of extras) expect(StyleSheet.flatten(segment.props.style).backgroundColor).toBe("#ff9e00");
});
