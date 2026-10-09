import React from "react";
import * as SecureStore from "expo-secure-store";
import { act, fireEvent, render } from "@testing-library/react-native";
import { BunproReviewSettingsSheet } from "../bunpro-review-settings-sheet";
import { useSettingsStore } from "../../../utils/store";

jest.mock("../../../utils/theme", () => ({ useTheme: () => ({ theme: { primary: "#326ac0", textColor: "black", textSecondary: "gray", border: "gray", cardBackground: "white" }, themeMode: "system", setThemeMode: jest.fn() }) }));
beforeEach(() => jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null));
afterEach(() => useSettingsStore.setState(useSettingsStore.getInitialState(), true));

it("edits ordering, pause, sound, and Anki preferences in the active session", async () => {
  const view = render(<BunproReviewSettingsSheet visible onClose={jest.fn()} />);
  await act(async () => {});
  expect(view.getByLabelText("Answer feedback sounds").props.onTintColor).toBe("#326ac0");
  fireEvent(view.getByLabelText("Pause on correct answer"), "valueChange", true);
  fireEvent(view.getByLabelText("Answer feedback sounds"), "valueChange", true);
  fireEvent.press(view.getByLabelText("Review subject order"));
  fireEvent.press(view.getByLabelText("Review subject order: Lower SRS first"));
  fireEvent(view.getByLabelText("Anki mode"), "valueChange", true);
  expect(view.getByLabelText("Show pitch accent graph")).toBeTruthy();
  fireEvent(view.getByLabelText("Show pitch accent graph"), "valueChange", true);
  expect(useSettingsStore.getState()).toMatchObject({ disableAutoProgressOnCorrect: true, answerFeedbackSoundEnabled: true, reviewOrder: "ascendingSrsStage", ankiCardMode: true, ankiShowPitchAccentGraph: true });
});
it("edits shortcuts and excludes conflicting keys", async () => {
  const view = render(<BunproReviewSettingsSheet visible onClose={jest.fn()} />);
  await act(async () => {});
  fireEvent.press(view.getByLabelText("Bunpro hint"));
  expect(view.queryByLabelText("Bunpro hint: R")).toBeNull();
  fireEvent.press(view.getByLabelText("Bunpro hint: Z"));
  expect(useSettingsStore.getState().bunproStudyShortcuts.hint).toBe("z");
});
