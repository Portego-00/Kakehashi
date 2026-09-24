import React from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react-native";

import { permanentStorage } from "../../../../utils/permanentStorage";
import { useSettingsStore } from "../../../../utils/store";
import { ReviewSettingsSection } from "../ReviewSettingsSection";

jest.mock("@expo/vector-icons", () => ({
  FontAwesome: () => null,
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
    const { Platform } = jest.requireActual("react-native");
    const { useSettingsStore } = jest.requireActual<typeof import("../../../../utils/store")>("../../../../utils/store");
    return {
      ...useSettingsStore(),
      Platform,
      theme: {
        cardBackground: "#ffffff",
        textColor: "#222222",
        textSecondary: "#666666",
        primary: "#326ac0",
        border: "#dddddd",
      },
      formatReviewFontScale: (scale: number) => `${scale * 100}%`,
      getReviewOrderLabel: (order: string) => order,
      getSrsProgressionCardModeLabel: (mode: string) => mode,
      updateSectionOffset: jest.fn(),
    };
  },
}));

const settingLabel = "Cycle through all Jitai fonts";
const selectedFonts = ["reggae-one", "yuji-syuku", "custom-handwriting"];

beforeEach(() => {
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  useSettingsStore.setState({
    jitaiEnabled: true,
    jitaiSelectedFontIds: selectedFonts,
  });
});

afterEach(() => {
  cleanup();
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
});

it("keeps full font cycling off and hidden until advanced settings are expanded", () => {
  expect(useSettingsStore.getInitialState().jitaiCycleAllFonts).toBe(false);
  const screen = render(<ReviewSettingsSection />);

  expect(screen.queryByLabelText(settingLabel)).toBeNull();
  fireEvent.press(screen.getByLabelText("Advanced settings"));
  expect(screen.getByLabelText(settingLabel).props.value).toBe(false);

  fireEvent.press(screen.getByLabelText("Collapse advanced settings"));
  expect(screen.queryByLabelText(settingLabel)).toBeNull();
});

it("only shows the advanced font cycle setting while Jitai is enabled", () => {
  useSettingsStore.setState({ jitaiEnabled: false });
  const screen = render(<ReviewSettingsSection />);
  fireEvent.press(screen.getByLabelText("Advanced settings"));
  expect(screen.queryByLabelText(settingLabel)).toBeNull();

  act(() => useSettingsStore.getState().setJitaiEnabled(true));
  expect(screen.getByLabelText(settingLabel)).toBeTruthy();
  act(() => useSettingsStore.getState().setJitaiEnabled(false));
  expect(screen.queryByLabelText(settingLabel)).toBeNull();
});

it("persists both toggle choices without changing the selected fonts", async () => {
  const screen = render(<ReviewSettingsSection />);
  fireEvent.press(screen.getByLabelText("Advanced settings"));

  for (const enabled of [true, false]) {
    fireEvent(screen.getByLabelText(settingLabel), "valueChange", enabled);
    expect(screen.getByLabelText(settingLabel).props.value).toBe(enabled);
    expect(useSettingsStore.getState()).toMatchObject({
      jitaiEnabled: true,
      jitaiCycleAllFonts: enabled,
      jitaiSelectedFontIds: selectedFonts,
    });
    const persisted = permanentStorage.getString("wanikani-settings")!;
    expect(JSON.parse(persisted).state.jitaiCycleAllFonts).toBe(enabled);

    act(() => useSettingsStore.setState({ jitaiCycleAllFonts: !enabled }));
    permanentStorage.set("wanikani-settings", persisted);
    await act(async () => useSettingsStore.persist.rehydrate());
    expect(screen.getByLabelText(settingLabel).props.value).toBe(enabled);
    expect(useSettingsStore.getState().jitaiSelectedFontIds).toEqual(selectedFonts);
  }
});

it.each([20, useSettingsStore.persist.getOptions().version])(
  "keeps the original toggle for stored settings without the option at version %s",
  async (version) => {
    permanentStorage.set(
      "wanikani-settings",
      JSON.stringify({
        state: { jitaiEnabled: true, jitaiSelectedFontIds: selectedFonts },
        version,
      }),
    );

    await useSettingsStore.persist.rehydrate();

    expect(useSettingsStore.getState()).toMatchObject({
      jitaiEnabled: true,
      jitaiCycleAllFonts: false,
      jitaiSelectedFontIds: selectedFonts,
    });
  },
);
