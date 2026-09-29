import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { ReviewPreviousAnswerCard } from "../ReviewPreviousAnswerCard";
import { withTiming } from "react-native-reanimated";
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("../../utils/store", () => ({ useSettingsStore: (select: (state: object) => unknown) => select({ reviewAnimatePreviousQuestion: true, vocabularyColor: "#882d9e", kanjiColor: "#dd0093", radicalColor: "#00aaff" }) }));
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { __esModule: true, default: { View }, useReducedMotion: () => false, useSharedValue: (value: number) => React.useRef({ value }).current, useAnimatedStyle: (fn: () => object) => fn(), withTiming: jest.fn((value: number) => value) };
});
beforeEach(() => jest.clearAllMocks());
it.each([ ["vocabulary", "#882d9e"], ["kana_vocabulary", "#882d9e"], ["kanji", "#dd0093"], ["radical", "#00aaff"] ] as const)("uses the %s subject color", (subjectType, expected) => {
  const view = render(<ReviewPreviousAnswerCard answer={{ id: "1", source: "wanikani", title: "猫", correct: true, subjectType, subjectId: 1 }} />);
  expect(StyleSheet.flatten(view.getByTestId("previous-answer-card").props.style).backgroundColor).toBe(expected);
  fireEvent.press(view.getByTestId("previous-answer-card"));
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/subject/[id]", params: { id: "1" } });
});
it("uses Bunpro's color, keeps the verdict, and animates once per answer rather than per provider render", () => {
  const answer = { id: "1", source: "bunpro" as const, title: "つもり", correct: false, bunproSubject: { kind: "grammar" as const, slug: "tsumori" } };
  const view = render(<ReviewPreviousAnswerCard answer={answer} />);
  const card = view.getByTestId("previous-answer-card");
  expect(StyleSheet.flatten(card.props.style).backgroundColor).toBe("#cc5b5d");
  expect(view.getByText(/Incorrect/)).toBeTruthy();
  view.rerender(<ReviewPreviousAnswerCard answer={answer} />);
  expect(view.getByTestId("previous-answer-card")).toBe(card);
  expect(withTiming).toHaveBeenCalledTimes(1);
  fireEvent.press(card);
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/bunpro-reviewable/[kind]/[slug]", params: { kind: "grammar", slug: "tsumori" } });
});
