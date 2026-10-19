import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { ScrollView } from "react-native";

import ReviewForecast from "../ReviewForecast";
import type { DayForecast } from "../../types/wanikani";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Icon",
  MaterialCommunityIcons: "Icon",
}));
jest.mock("@react-native-segmented-control/segmented-control", () =>
  "SegmentedControl",
);
jest.mock("react-native-reanimated", () => {
  const { View } = jest.requireActual("react-native");
  const animation = {
    delay: () => animation,
    duration: () => animation,
    easing: () => animation,
  };
  return {
    __esModule: true,
    default: { View },
    Easing: { ease: jest.fn() },
    Layout: animation,
    FadeInDown: animation,
    FadeOutUp: animation,
  };
});
jest.mock("../../utils/api", () => ({
  isAssignmentInReviewQueueState: jest.fn(),
}));

const mockSettings = {
  appTextSizeScale: 1,
  forecastShowSubjectColors: false,
  setForecastShowSubjectColors: jest.fn(),
};
jest.mock("../../utils/store", () => ({
  useSettingsStore: () => mockSettings,
}));
jest.mock("../../utils/subjectColors", () => ({
  useSubjectColors: () => ({
    radical: "#0088cc",
    kanji: "#cc0088",
    vocabulary: "#8800cc",
  }),
  withAlpha: (color: string) => color,
}));
jest.mock("../../utils/theme", () => ({
  useTheme: () => ({
    theme: {
      isDark: false,
      cardBackground: "#ffffff",
      border: "#dddddd",
      primary: "#6d28d9",
      textColor: "#111111",
      textSecondary: "#666666",
      textLight: "#888888",
    },
  }),
}));

const forecast: DayForecast[] = Array.from({ length: 7 }, (_, index) => ({
  day: [
    "Today",
    "Tomorrow",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ][index],
  totalCount: 24,
  cumulativeCount: (index + 1) * 24,
  hours: Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: 1,
    cumulativeCount: hour + 1,
  })),
}));

describe("ReviewForecast chart scroll state", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-19T12:00:00Z"));
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it.each([1, 2])(
    "starts each time scale at the origin with text scale %s",
    async (textScale) => {
      mockSettings.appTextSizeScale = textScale;
      // Native scroll position belongs to the ScrollView instance. Model it
      // separately because Jest does not perform Android scrolling or layout.
      const offsets = new WeakMap<ScrollView, number>();
      jest.spyOn(ScrollView.prototype, "scrollTo").mockImplementation(function (
        this: ScrollView,
        options,
      ) {
        offsets.set(this, typeof options === "object" ? options.x ?? 0 : 0);
      });

      const screen = render(<ReviewForecast forecast={forecast} />);
      await act(async () => {});
      const chart = () =>
        screen.UNSAFE_getByType(ScrollView).instance as ScrollView;
      const offset = () => offsets.get(chart()) ?? 0;
      const switchScale = (selectedSegmentIndex: number) =>
        fireEvent(screen.UNSAFE_getByType(SegmentedControl), "change", {
          nativeEvent: { selectedSegmentIndex },
        });

      offsets.set(chart(), 600);
      switchScale(1);
      expect(screen.getByText("Today")).toBeTruthy();
      expect(offset()).toBe(0);

      // Large-text daily charts can scroll too; their position must not leak
      // back into the hourly chart on the reverse transition.
      if (textScale > 1) offsets.set(chart(), 120);
      switchScale(0);
      expect(screen.getByText("Now")).toBeTruthy();
      expect(offset()).toBe(0);

      // Ordinary forecast refreshes should preserve the user's position.
      offsets.set(chart(), 300);
      screen.rerender(
        <ReviewForecast forecast={forecast} currentReviewCount={5} />,
      );
      expect(offset()).toBe(300);
    },
  );
});
