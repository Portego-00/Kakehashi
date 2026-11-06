import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { Platform } from "react-native";
import { ReviewPromptColorSetting } from "../review-prompt-color-setting";
import { useSettingsStore } from "../../../../utils/store";

jest.mock("../../../../utils/theme", () => ({ useTheme: () => ({ theme: { textColor: "#222222", textSecondary: "#666666", primary: "#326ac0", border: "#dddddd", isDark: false } }) }));
jest.mock("@expo/ui/swift-ui", () => {
  const { TextInput, View } = jest.requireActual("react-native");
  const React = jest.requireActual("react");
  return { Host: View, ColorPicker: ({ selection, onSelectionChange }: { selection: string; onSelectionChange: (value: string) => void }) => React.createElement(TextInput, { accessibilityLabel: "Native color picker", value: selection, onChangeText: onSelectionChange }) };
});
jest.mock("@expo/ui/swift-ui/modifiers", () => ({ accessibilityLabel: (label: string) => ({ label }) }));
afterEach(() => { useSettingsStore.setState(useSettingsStore.getInitialState(), true); jest.restoreAllMocks(); });

it.each(["ios", "android"] as const)("edits and resets independent provider colors on %s", (platform) => {
  jest.replaceProperty(Platform, "OS", platform);
  const view = render(<><ReviewPromptColorSetting provider="wanikani" /><ReviewPromptColorSetting provider="bunpro" /></>);
  fireEvent(view.getByLabelText("Custom WaniKani prompt text color"), "valueChange", true);
  fireEvent.changeText(view.getByLabelText("WaniKani prompt text color hexadecimal value"), "123456");
  fireEvent(view.getByLabelText("Custom Bunpro prompt text color"), "valueChange", true);
  fireEvent.changeText(view.getByLabelText("Bunpro prompt text color hexadecimal value"), "abcdef");
  expect(useSettingsStore.getState()).toMatchObject({ reviewPromptTextColor: "#123456", bunproReviewPromptTextColor: "#abcdef" });
  fireEvent(view.getByLabelText("Custom WaniKani prompt text color"), "valueChange", false);
  expect(useSettingsStore.getState()).toMatchObject({ reviewPromptTextColor: "", bunproReviewPromptTextColor: "#abcdef" });
  expect(view.queryByLabelText("WaniKani prompt text color hexadecimal value")).toBeNull();
});

it("accepts native picker colors and leaves incomplete manual edits unsaved", () => {
  jest.replaceProperty(Platform, "OS", "ios");
  const view = render(<ReviewPromptColorSetting provider="wanikani" />);
  fireEvent(view.getByLabelText("Custom WaniKani prompt text color"), "valueChange", true);
  fireEvent.changeText(view.getByLabelText("Native color picker"), "#ABCDEFff");
  expect(useSettingsStore.getState().reviewPromptTextColor).toBe("#abcdef");
  fireEvent.changeText(view.getByLabelText("WaniKani prompt text color hexadecimal value"), "12");
  expect(useSettingsStore.getState().reviewPromptTextColor).toBe("#abcdef");
  act(() => useSettingsStore.getState().setReviewPromptTextColor("#123456"));
  expect(view.getByLabelText("WaniKani prompt text color hexadecimal value").props.value).toBe("123456");
});
