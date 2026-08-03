import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";

import {
  AdvancedSetting,
  AdvancedSettingsGroup,
} from "../AdvancedSettings";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
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
    interpolate: (
      value: number,
      _inputRange: number[],
      outputRange: number[],
    ) => (value === 0 ? outputRange[0] : outputRange[1]),
    ReduceMotion: { System: "system" },
    useAnimatedStyle: (factory: () => unknown) => factory(),
    useSharedValue: (value: number) => ({ value }),
    withTiming: (value: number) => value,
  };
});

jest.mock("../../SettingsControllerContext", () => ({
  useSettingsControllerContext: () => ({
    theme: {
      border: "#dddddd",
      textColor: "#111111",
      textSecondary: "#666666",
    },
  }),
}));

describe("AdvancedSettingsGroup", () => {
  it("reveals and collapses advanced settings from the section footer", () => {
    const screen = render(
      <AdvancedSettingsGroup>
        <Text>Core setting</Text>
        <AdvancedSetting>
          <Text>Niche setting</Text>
        </AdvancedSetting>
      </AdvancedSettingsGroup>,
    );

    expect(screen.getByText("Core setting")).toBeTruthy();
    expect(screen.queryByText("Niche setting")).toBeNull();

    fireEvent.press(screen.getByLabelText("Advanced settings"));

    expect(screen.getByText("Niche setting")).toBeTruthy();
    expect(
      screen.getByLabelText("Collapse advanced settings").props
        .accessibilityState,
    ).toEqual({ expanded: true });

    fireEvent.press(screen.getByLabelText("Collapse advanced settings"));

    expect(screen.queryByText("Niche setting")).toBeNull();
    expect(
      screen.getByLabelText("Advanced settings").props.accessibilityState,
    ).toEqual({ expanded: false });
  });
});
