import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react-native";

import { permanentStorage } from "../../../../utils/permanentStorage";
import { useSettingsStore } from "../../../../utils/store";
import { NotesSection } from "../NotesSection";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("../../useSettingsController", () => ({
  STOP_DETAILS_PREVIEW_ASPECT_RATIO: 1,
}));

jest.mock("../../SettingsControllerContext", () => ({
  useSettingsControllerContext: () => ({
    theme: {
      cardBackground: "#ffffff",
      textColor: "#222222",
      textSecondary: "#666666",
      primary: "#326ac0",
      border: "#dddddd",
    },
    updateSectionOffset: jest.fn(),
  }),
}));

describe("Notes settings section", () => {
  beforeEach(() => {
    useSettingsStore.setState({ advancedNoteEditorEnabled: false });
  });

  afterEach(() => {
    cleanup();
    useSettingsStore.setState({ advancedNoteEditorEnabled: false });
  });

  it("keeps the optional editor switch discoverable and persists both choices", () => {
    const screen = render(<NotesSection />);

    expect(screen.getByText("Notes")).toBeTruthy();
    expect(screen.getByText(/Existing formatted notes keep the advanced editor/)).toBeTruthy();
    expect(screen.getByLabelText("Advanced note editor").props.value).toBe(false);

    fireEvent(screen.getByLabelText("Advanced note editor"), "valueChange", true);

    expect(screen.getByLabelText("Advanced note editor").props.value).toBe(true);
    expect(useSettingsStore.getState().advancedNoteEditorEnabled).toBe(true);
    expect(
      JSON.parse(permanentStorage.getString("wanikani-settings")!).state
        .advancedNoteEditorEnabled,
    ).toBe(true);

    fireEvent(screen.getByLabelText("Advanced note editor"), "valueChange", false);

    expect(screen.getByLabelText("Advanced note editor").props.value).toBe(false);
    expect(useSettingsStore.getState().advancedNoteEditorEnabled).toBe(false);
    expect(
      JSON.parse(permanentStorage.getString("wanikani-settings")!).state
        .advancedNoteEditorEnabled,
    ).toBe(false);
  });
});
