import React from "react";
import * as SecureStore from "expo-secure-store";
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
    const {
      useSettingsStore,
      REVIEW_CHARACTER_FONT_SCALE_MIN,
      REVIEW_CHARACTER_FONT_SCALE_MAX,
      REVIEW_CHARACTER_FONT_SCALE_STEP,
    } = jest.requireActual<typeof import("../../../../utils/store")>("../../../../utils/store");
    const settings = useSettingsStore();
    return {
      ...settings,
      REVIEW_CHARACTER_FONT_SCALE_STEP,
      canDecreaseReviewCharacterFontScale:
        settings.reviewCharacterFontScale > REVIEW_CHARACTER_FONT_SCALE_MIN,
      canIncreaseReviewCharacterFontScale:
        settings.reviewCharacterFontScale < REVIEW_CHARACTER_FONT_SCALE_MAX,
      Platform,
      theme: {
        cardBackground: "#ffffff",
        textColor: "#222222",
        textSecondary: "#666666",
        primary: "#326ac0",
        border: "#dddddd",
      },
      formatReviewFontScale: (scale: number) => `${Math.round(scale * 100)}%`,
      getReviewOrderLabel: (order: string) => order,
      getSrsProgressionCardModeLabel: (mode: string) => mode,
      updateSectionOffset: jest.fn(),
    };
  },
}));

const settingLabel = "Cycle through all Jitai fonts";
const selectedFonts = ["reggae-one", "yuji-syuku", "custom-handwriting"];

beforeEach(() => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
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

it("keeps full font cycling off and hidden until advanced settings are expanded", async () => {
  expect(useSettingsStore.getInitialState().jitaiCycleAllFonts).toBe(false);
  const screen = render(<ReviewSettingsSection />);
  await act(async () => {});

  expect(screen.queryByLabelText(settingLabel)).toBeNull();
  fireEvent.press(screen.getByLabelText("Advanced settings"));
  expect(screen.getByLabelText(settingLabel).props.value).toBe(false);

  fireEvent.press(screen.getByLabelText("Collapse advanced settings"));
  expect(screen.queryByLabelText(settingLabel)).toBeNull();
});

it("only shows the advanced font cycle setting while Jitai is enabled", async () => {
  useSettingsStore.setState({ jitaiEnabled: false });
  const screen = render(<ReviewSettingsSection />);
  await act(async () => {});
  fireEvent.press(screen.getByLabelText("Advanced settings"));
  expect(screen.queryByLabelText(settingLabel)).toBeNull();

  act(() => useSettingsStore.getState().setJitaiEnabled(true));
  expect(screen.getByLabelText(settingLabel)).toBeTruthy();
  act(() => useSettingsStore.getState().setJitaiEnabled(false));
  expect(screen.queryByLabelText(settingLabel)).toBeNull();
});

it("persists both toggle choices without changing the selected fonts", async () => {
  const screen = render(<ReviewSettingsSection />);
  await act(async () => {});
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

it("shrinks review characters to 30% from the basic settings without changing other text", async () => {
  useSettingsStore.setState({ appTextSizeScale: 1.15, reviewInputFontScale: 1.1 });
  const screen = render(<ReviewSettingsSection />);
  await act(async () => {});
  const decrease = () => screen.getByLabelText("Decrease review character size");
  expect(screen.getByText("100%")).toBeTruthy();
  for (const percentage of [90, 80, 70, 60, 50, 40, 30]) {
    fireEvent.press(decrease());
    expect(screen.getByText(`${percentage}%`)).toBeTruthy();
  }
  expect(decrease().props.accessibilityState.disabled).toBe(true);
  expect(useSettingsStore.getState()).toMatchObject({
    reviewCharacterFontScale: 0.3,
    appTextSizeScale: 1.15,
    reviewInputFontScale: 1.1,
  });
  fireEvent.press(screen.getByLabelText("Increase review character size"));
  expect(screen.getByText("40%")).toBeTruthy();
  expect(decrease().props.accessibilityState.disabled).toBe(false);
});


it("only shows the Bunpro furigana toggle with a saved key and persists its preference", async () => {
  const screen = render(<ReviewSettingsSection />);
  await act(async () => {});
  expect(screen.queryByLabelText("Hide Bunpro furigana")).toBeNull();
  screen.unmount();

  jest.mocked(SecureStore.getItemAsync).mockResolvedValue("fixture-key");
  const connectedScreen = render(<ReviewSettingsSection />);
  const toggle = await connectedScreen.findByLabelText("Hide Bunpro furigana");
  expect(toggle.props.value).toBe(false);
  fireEvent(toggle, "valueChange", true);
  expect(useSettingsStore.getState().bunproHideFurigana).toBe(true);
  expect(JSON.parse(permanentStorage.getString("wanikani-settings")!).state.bunproHideFurigana).toBe(true);
  connectedScreen.unmount();

  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
  const disconnectedScreen = render(<ReviewSettingsSection />);
  await act(async () => {});
  expect(disconnectedScreen.queryByLabelText("Hide Bunpro furigana")).toBeNull();
  expect(useSettingsStore.getState().bunproHideFurigana).toBe(true);
});
