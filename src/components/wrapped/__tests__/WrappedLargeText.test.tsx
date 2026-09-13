import { act, render } from "@testing-library/react-native";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { WrappedContainer } from "../WrappedContainer";
import { StarSlide } from "../slides/StarSlide";
import { TroubleSlide } from "../slides/TroubleSlide";

let mockAppTextSizeScale = 1.15;

type MockTapGesture = Record<
  | "enabled"
  | "maxDuration"
  | "maxDistance"
  | "cancelsTouchesInView"
  | "runOnJS"
  | "onEnd",
  jest.Mock
>;

const mockTapGesture: MockTapGesture = {
  enabled: jest.fn(() => mockTapGesture),
  maxDuration: jest.fn(() => mockTapGesture),
  maxDistance: jest.fn(() => mockTapGesture),
  cancelsTouchesInView: jest.fn(() => mockTapGesture),
  runOnJS: jest.fn(() => mockTapGesture),
  onEnd: jest.fn(() => mockTapGesture),
};

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("expo-linear-gradient", () => {
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return { LinearGradient: View };
});

jest.mock("react-native-gesture-handler", () => ({
  Gesture: { Tap: () => mockTapGesture },
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("react-native-reanimated", () => {
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  const transition = {
    duration: () => transition,
  };

  return {
    __esModule: true,
    default: { View },
    Easing: {
      cubic: "cubic",
      quad: "quad",
      inOut: (value: unknown) => value,
      out: (value: unknown) => value,
    },
    FadeIn: transition,
    FadeOut: transition,
    useAnimatedStyle: (factory: () => object) => factory(),
    useSharedValue: (value: unknown) => ({ value }),
    withDelay: (_delay: number, value: unknown) => value,
    withRepeat: (value: unknown) => value,
    withSequence: (...values: unknown[]) => values.at(-1),
    withTiming: (value: unknown) => value,
  };
});

jest.mock("../../../utils/haptics", () => ({
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  impactAsync: jest.fn(),
}));

jest.mock("../../../utils/store", () => ({
  useSettingsStore: (
    selector: (state: { appTextSizeScale: number }) => unknown,
  ) => selector({ appTextSizeScale: mockAppTextSizeScale }),
}));

jest.mock("../../../utils/subjectColors", () => ({
  getSubjectTypeColor: () => "#a0d468",
}));

jest.mock("../RadialGlow", () => ({
  RadialGlow: () => null,
}));

const subject = {
  subjectId: 1,
  characters: "世界観",
  primaryMeaning: "A deliberately long meaning that needs to wrap",
  primaryReading: "せかいかん",
  subjectType: "vocabulary" as const,
  meaningCorrect: 8,
  meaningIncorrect: 2,
  readingCorrect: 8,
  readingIncorrect: 2,
  totalIncorrect: 4,
  percentageCorrect: 80,
  maxStreak: 6,
  timeToGuru: 3_600_000,
};

describe("wrapped slides with large text", () => {
  beforeEach(() => {
    mockAppTextSizeScale = 1.15;
    jest.clearAllMocks();
  });

  it("keeps the star slide vertically scrollable with safe top and bottom space", () => {
    const screen = render(
      <StarSlide starPerformer={subject} fastestToGuru={subject} />,
    );
    const scrollView = screen.UNSAFE_getByType(ScrollView);

    expect(scrollView.props.showsVerticalScrollIndicator).toBe(true);
    expect(
      StyleSheet.flatten(scrollView.props.contentContainerStyle),
    ).toMatchObject({
      flexGrow: 1,
      justifyContent: "center",
      paddingTop: 112,
      paddingBottom: 112,
    });
  });

  it("allows trouble-item meanings to wrap inside a vertically scrollable list", () => {
    const screen = render(<TroubleSlide mostMissed={[subject]} />);
    const scrollView = screen.UNSAFE_getByType(ScrollView);

    expect(scrollView.props.showsVerticalScrollIndicator).toBe(true);
    expect(
      screen.getByText(subject.primaryMeaning).props.numberOfLines,
    ).toBeUndefined();
  });

  it("does not auto-advance while a large-text user is reading or scrolling", () => {
    jest.useFakeTimers();
    const screen = render(
      <WrappedContainer onClose={jest.fn()}>
        <View>
          <Text>First slide</Text>
        </View>
        <View>
          <Text>Second slide</Text>
        </View>
      </WrappedContainer>,
    );

    act(() => {
      jest.advanceTimersByTime(8_100);
    });

    expect(screen.getByText("First slide")).toBeTruthy();
    expect(screen.queryByText("Second slide")).toBeNull();
    jest.useRealTimers();
  });

  it("does not treat a vertical drag as a tap-to-advance", () => {
    const screen = render(
      <WrappedContainer onClose={jest.fn()}>
        <View>
          <Text>First slide</Text>
        </View>
        <View>
          <Text>Second slide</Text>
        </View>
      </WrappedContainer>,
    );
    const onGestureEnd = mockTapGesture.onEnd.mock.calls.at(-1)?.[0] as (
      event: { x: number },
      success: boolean,
    ) => void;

    act(() => {
      // Gesture Handler reports a tap as unsuccessful once scrolling moves
      // farther than maxDistance, so the slide must stay put.
      onGestureEnd({ x: 300 }, false);
    });

    expect(mockTapGesture.maxDistance).toHaveBeenCalledWith(12);
    expect(screen.getByText("First slide")).toBeTruthy();
    expect(screen.queryByText("Second slide")).toBeNull();
  });
});
