import React from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react-native";
import AnkiSettingsScreen from "../(app)/anki-settings";
import { useSettingsStore } from "../../src/utils/store";
import { permanentStorage } from "../../src/utils/permanentStorage";
jest.mock("../../src/utils/badgeNotifications", () => ({ clearBadgeCount: jest.fn(), invalidateBadgeNotificationUpdatesForLogout: jest.fn() }));
jest.mock("expo-notifications", () => ({}));

jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));
jest.mock("../../src/components/AnkiDroidExportButton", () => ({ AnkiDroidExportSettingsButton: () => null }));
jest.mock("../../src/ui/settings/settings-choice-cards", () => ({ SettingsChoiceCards: () => null }));
jest.mock("../../src/ui/settings/settings-foldout", () => ({ SettingsFoldout: ({ children }: { children: React.ReactNode }) => children }));

beforeEach(() => {
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  useSettingsStore.setState({ ankiGroupQuestions: true, ankiCardModeScope: "both" });
});
afterEach(() => { cleanup(); useSettingsStore.setState(useSettingsStore.getInitialState(), true); });

it("exposes an off-by-default chooser preference in Anki settings and saves changes", () => {
  const screen = render(<AnkiSettingsScreen />);
  const toggle = screen.getByLabelText("Ask which part was wrong");
  expect(toggle.props.value ?? toggle.props.on).toBe(false);
  fireEvent(toggle, "valueChange", true);
  expect(useSettingsStore.getState().ankiAskIncorrectPart).toBe(true);
  expect(JSON.parse(permanentStorage.getString("wanikani-settings")!).state.ankiAskIncorrectPart).toBe(true);
});

it("only offers the chooser for grouped meaning and reading cards", () => {
  const screen = render(<AnkiSettingsScreen />);
  expect(screen.getByLabelText("Ask which part was wrong")).toBeTruthy();
  act(() => useSettingsStore.getState().setAnkiGroupQuestions(false));
  expect(screen.queryByLabelText("Ask which part was wrong")).toBeNull();
  act(() => useSettingsStore.setState({ ankiGroupQuestions: true, ankiCardModeScope: "reading" }));
  expect(screen.queryByLabelText("Ask which part was wrong")).toBeNull();
});

it("updates the buttonless instructions with the left-handed preference", () => {
  const screen = render(<AnkiSettingsScreen />);
  expect(screen.getByText(/After reveal: tap left for incorrect, tap right for correct/)).toBeTruthy();
  act(() => useSettingsStore.getState().setReviewLeftHandedMode(true));
  expect(screen.getByText(/After reveal: tap left for correct, tap right for incorrect/)).toBeTruthy();
});
