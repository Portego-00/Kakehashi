import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import { permanentStorage } from "../../../../utils/permanentStorage";
import { useSettingsStore } from "../../../../utils/store";
import { VocabularyContextSection } from "../VocabularyContextSection";

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
    };
  },
}));

afterEach(() => {
  useSettingsStore.setState({
    showJLPTLevel: false,
    showVocabularyFrequency: false,
    hideContextSentenceTranslations: false,
    hideContextSentenceTranslationsCompletely: false,
  });
});

it.each([false, true])("can remove translations independently of tap-to-reveal being %s", (hideUntilTapped) => {
  useSettingsStore.setState({
    hideContextSentenceTranslations: hideUntilTapped,
    hideContextSentenceTranslationsCompletely: false,
  });
  const screen = render(<VocabularyContextSection />);
  const removeLabel = "Remove context sentence translations";
  const tapLabel = "Hide context sentence translations until tapped";

  expect(screen.queryByLabelText(removeLabel)).toBeNull();
  fireEvent.press(screen.getByLabelText("Advanced settings"));
  expect(screen.getByLabelText(removeLabel).props.disabled).toBeFalsy();
  fireEvent(screen.getByLabelText(removeLabel), "valueChange", true);
  expect(useSettingsStore.getState().hideContextSentenceTranslationsCompletely).toBe(true);
  expect(screen.getByLabelText(removeLabel).props.value).toBe(true);
  expect(screen.getByLabelText(tapLabel).props.disabled).toBe(true);

  fireEvent(screen.getByLabelText(removeLabel), "valueChange", false);
  expect(useSettingsStore.getState().hideContextSentenceTranslationsCompletely).toBe(false);
  expect(screen.getByLabelText(tapLabel).props.disabled).toBe(false);
  expect(screen.getByLabelText(tapLabel).props.value).toBe(hideUntilTapped);

  fireEvent.press(screen.getByLabelText("Collapse advanced settings"));
  expect(screen.queryByLabelText(removeLabel)).toBeNull();
});

it("persists the optional JLPT setting independently of frequency", () => {
  expect(useSettingsStore.getInitialState().showJLPTLevel).toBe(false);
  const screen = render(<VocabularyContextSection />);
  fireEvent.press(screen.getByLabelText("Advanced settings"));
  const toggle = screen.getByLabelText("Show JLPT levels");
  expect(toggle.props.value).toBe(false);
  fireEvent(toggle, "valueChange", true);
  expect(useSettingsStore.getState().showJLPTLevel).toBe(true);
  expect(useSettingsStore.getState().showVocabularyFrequency).toBe(false);
  const persistedSettings = JSON.parse(permanentStorage.getString("wanikani-settings") ?? "{}");
  expect(persistedSettings.state.showJLPTLevel).toBe(true);
  fireEvent(screen.getByLabelText("Show JLPT levels"), "valueChange", false);
  expect(useSettingsStore.getState().showJLPTLevel).toBe(false);
});
