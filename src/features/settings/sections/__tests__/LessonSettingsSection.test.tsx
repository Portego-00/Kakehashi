import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import { permanentStorage } from "../../../../utils/permanentStorage";
import { useSettingsStore } from "../../../../utils/store";
import { LessonSettingsSection } from "../LessonSettingsSection";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
  MaterialCommunityIcons: () => null,
}));

jest.mock("react-native-reanimated", () => {
  const { View } = jest.requireActual("react-native");
  const animationBuilder = {
    duration: () => animationBuilder,
    easing: () => animationBuilder,
    easingHeight: () => animationBuilder,
    easingWidth: () => animationBuilder,
    easingX: () => animationBuilder,
    easingY: () => animationBuilder,
    reduceMotion: () => animationBuilder,
  };

  return {
    __esModule: true,
    default: { View },
    CurvedTransition: animationBuilder,
    Easing: {
      bezier: jest.fn(),
      cubic: jest.fn(),
      in: (easing: unknown) => easing,
      out: (easing: unknown) => easing,
    },
    FadeInDown: animationBuilder,
    FadeOutUp: animationBuilder,
    interpolate: (value: number, _inputRange: number[], outputRange: number[]) =>
      value === 0 ? outputRange[0] : outputRange[1],
    ReduceMotion: { System: "system" },
    useAnimatedStyle: (factory: () => unknown) => factory(),
    useSharedValue: (value: number) => ({ value }),
    withTiming: (value: number) => value,
  };
});

jest.mock("../../useSettingsController", () => ({
  STOP_DETAILS_PREVIEW_ASPECT_RATIO: 1,
}));

jest.mock("../../SettingsControllerContext", () => ({
  useSettingsControllerContext: () => {
    const { useSettingsStore } = jest.requireActual<typeof import("../../../../utils/store")>("../../../../utils/store");
    return {
      ...useSettingsStore(),
      theme: {
        cardBackground: "#ffffff",
        textColor: "#222222",
        textSecondary: "#666666",
        primary: "#326ac0",
        border: "#dddddd",
      },
      updateSectionOffset: jest.fn(),
      getLessonOrderLabel: () => "Level order",
      isDailyLessonLimitEnabled: false,
      dailyLessonLimitMin: 5,
      dailyLessonLimitMax: 500,
    };
  },
}));

afterEach(() => useSettingsStore.setState(useSettingsStore.getInitialState(), true));

it("keeps vocabulary unlock counts inside advanced lesson preferences and saves the choice", () => {
  const screen = render(<LessonSettingsSection />);
  expect(screen.queryByLabelText("Lesson Unlock Counts")).toBeNull();
  fireEvent.press(screen.getByLabelText("Advanced settings"));
  const toggle = screen.getByLabelText("Lesson Unlock Counts");
  expect(toggle.props.value).toBe(false);
  fireEvent(toggle, "valueChange", true);
  expect(screen.getByLabelText("Lesson Unlock Counts").props.value).toBe(true);
  expect(useSettingsStore.getState().showLessonVocabularyUnlockCounts).toBe(true);
  expect(JSON.parse(permanentStorage.getString("wanikani-settings")!).state.showLessonVocabularyUnlockCounts).toBe(true);
  fireEvent.press(screen.getByLabelText("Collapse advanced settings"));
  expect(screen.queryByLabelText("Lesson Unlock Counts")).toBeNull();
});
