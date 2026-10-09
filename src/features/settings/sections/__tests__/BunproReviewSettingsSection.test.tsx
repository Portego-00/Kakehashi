import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import { clearBunproApiToken, getStoredBunproApiToken, saveBunproApiToken, validateBunproApiToken } from "../../../../utils/bunproApi";
import { permanentStorage } from "../../../../utils/permanentStorage";
import { useSettingsStore } from "../../../../utils/store";
import { BunproReviewSettingsSection } from "../BunproReviewSettingsSection";

const mockAuth = { userData: { id: 1, username: "Portego" } };
let mockFocused = true;
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("../../../../utils/store", () => ({
  ...jest.requireActual("../../../../utils/store"),
  useAuthStore: (selector: (state: typeof mockAuth) => unknown) => selector(mockAuth),
}));
jest.mock("../../../../utils/navigation-focus", () => ({ useOptionalScreenIsFocused: () => mockFocused }));
jest.mock("../../../../utils/bunproApi", () => ({
  clearBunproApiToken: jest.fn(),
  getStoredBunproApiToken: jest.fn(),
  saveBunproApiToken: jest.fn(),
  validateBunproApiToken: jest.fn(),
}));
jest.mock("../../useSettingsController", () => ({ STOP_DETAILS_PREVIEW_ASPECT_RATIO: 1 }));
jest.mock("../../SettingsControllerContext", () => ({ useSettingsControllerContext: () => ({
  theme: { primary: "#326ac0", cardBackground: "#fff", textColor: "#222", textSecondary: "#666", border: "#ddd", error: "#a00" },
  updateSectionOffset: jest.fn(),
}) }));

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.userData = { id: 1, username: "Portego" };
  mockFocused = true;
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  jest.mocked(getStoredBunproApiToken).mockResolvedValue(null);
  jest.mocked(validateBunproApiToken).mockResolvedValue(true);
  jest.mocked(saveBunproApiToken).mockResolvedValue(undefined);
  jest.mocked(clearBunproApiToken).mockResolvedValue(undefined);
});
afterEach(() => useSettingsStore.setState(useSettingsStore.getInitialState(), true));

it.each(["SomeoneElse", ""])("hides the section and does not read credentials for %s", async username => {
  mockAuth.userData.username = username;
  const view = render(<BunproReviewSettingsSection />);
  await act(async () => {});
  expect(view.queryByText("Bunpro reviews")).toBeNull();
  expect(getStoredBunproApiToken).not.toHaveBeenCalled();
});

it("lets Portego connect without a key and reveals themed preferences after saving", async () => {
  const view = render(<BunproReviewSettingsSection />);
  await act(async () => {});
  expect(view.getByText("Bunpro reviews")).toBeTruthy();
  expect(view.getByLabelText("Bunpro API key").props.secureTextEntry).toBe(true);
  expect(view.queryByLabelText("Hide Bunpro furigana")).toBeNull();
  fireEvent.changeText(view.getByLabelText("Bunpro API key"), "  fixture-key  ");
  fireEvent.press(view.getByLabelText("Save Bunpro API key"));
  await waitFor(() => expect(view.getByText("Bunpro API key saved.")).toBeTruthy());
  expect(validateBunproApiToken).toHaveBeenCalledWith("fixture-key");
  expect(saveBunproApiToken).toHaveBeenCalledWith("fixture-key");
  for (const [label, enabled] of [["Hide Bunpro furigana", true], ["Show details on wrong answer", true], ["Answer feedback sounds", true], ["Bunpro keyboard shortcuts", false]] as const) {
    const toggle = view.getByLabelText(label);
    expect(toggle.props.onTintColor).toBe("#326ac0");
    fireEvent(toggle, "valueChange", enabled);
  }
  expect(JSON.parse(permanentStorage.getString("wanikani-settings")!).state).toMatchObject({
    bunproHideFurigana: true, showDetailsOnWrongAnswer: true, answerFeedbackSoundEnabled: true, reviewKeyboardShortcutsEnabled: false,
  });
  expect(view.getByLabelText("Bunpro API key").props.value).toBe("");
});

it("rejects invalid keys without saving or enabling review settings", async () => {
  jest.mocked(validateBunproApiToken).mockResolvedValue(false);
  const view = render(<BunproReviewSettingsSection />);
  await act(async () => {});
  fireEvent.changeText(view.getByLabelText("Bunpro API key"), "invalid-key");
  fireEvent.press(view.getByLabelText("Save Bunpro API key"));
  await waitFor(() => expect(view.getByText("That API key is invalid or Bunpro is unavailable right now.")).toBeTruthy());
  expect(saveBunproApiToken).not.toHaveBeenCalled();
  expect(view.queryByLabelText("Hide Bunpro furigana")).toBeNull();
});

it("removes a saved key and hides the preferences without resetting them", async () => {
  jest.mocked(getStoredBunproApiToken).mockResolvedValueOnce("fixture-key");
  useSettingsStore.getState().setBunproHideFurigana(true);
  const view = render(<BunproReviewSettingsSection />);
  await view.findByLabelText("Hide Bunpro furigana");
  fireEvent.press(view.getByLabelText("Remove Bunpro API key"));
  await waitFor(() => expect(view.getByText("Bunpro API key removed.")).toBeTruthy());
  expect(clearBunproApiToken).toHaveBeenCalledTimes(1);
  expect(view.queryByLabelText("Hide Bunpro furigana")).toBeNull();
  expect(useSettingsStore.getState().bunproHideFurigana).toBe(true);
});

it("rechecks the connection when Settings regains focus", async () => {
  jest.mocked(getStoredBunproApiToken).mockResolvedValueOnce("fixture-key");
  const view = render(<BunproReviewSettingsSection />);
  await view.findByLabelText("Hide Bunpro furigana");
  mockFocused = false;
  view.rerender(<BunproReviewSettingsSection />);
  mockFocused = true;
  view.rerender(<BunproReviewSettingsSection />);
  await act(async () => {});
  expect(getStoredBunproApiToken).toHaveBeenCalledTimes(2);
  expect(view.queryByLabelText("Hide Bunpro furigana")).toBeNull();
});

it("does not save a pending key after switching away from Portego", async () => {
  let finishValidation!: (valid: boolean) => void;
  jest.mocked(validateBunproApiToken).mockReturnValue(new Promise(resolve => { finishValidation = resolve; }));
  const view = render(<BunproReviewSettingsSection />);
  await act(async () => {});
  fireEvent.changeText(view.getByLabelText("Bunpro API key"), "fixture-key");
  fireEvent.press(view.getByLabelText("Save Bunpro API key"));
  mockAuth.userData.username = "SomeoneElse";
  view.rerender(<BunproReviewSettingsSection />);
  await act(async () => { finishValidation(true); });
  expect(saveBunproApiToken).not.toHaveBeenCalled();
  expect(view.queryByText("Bunpro reviews")).toBeNull();
});
