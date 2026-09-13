import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { Alert, Clipboard } from "react-native";

import { KnownVocabularyExportSetting } from "../known-vocabulary-export-setting";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("../../styles", () => ({ styles: {} }));

const mockDashboardData = {
  subjects: [
    { id: 1, object: "vocabulary", data: { characters: "水", hidden_at: null } },
    {
      id: 2,
      object: "kana_vocabulary",
      data: { characters: "ありがとう", hidden_at: null },
    },
  ],
  assignments: [
    {
      data: {
        subject_id: 1,
        subject_type: "vocabulary",
        started_at: "2026-09-01",
        srs_stage: 1,
        hidden: false,
      },
    },
    {
      data: {
        subject_id: 2,
        subject_type: "kana_vocabulary",
        started_at: "2026-09-01",
        srs_stage: 9,
        hidden: false,
      },
    },
  ],
  dataLoadingState: { assignments: true, subjects: true },
};

jest.mock("../../SettingsControllerContext", () => ({
  useSettingsControllerContext: () => ({
    dashboardData: mockDashboardData,
    theme: {
      primary: "#555555",
      textColor: "#111111",
      textSecondary: "#666666",
    },
  }),
}));

const originalSubjects = mockDashboardData.subjects;
const originalAssignments = mockDashboardData.assignments;

function copyVocabulary() {
  const screen = render(<KnownVocabularyExportSetting />);
  fireEvent.press(screen.getByRole("button", { name: "Copy Known Vocabulary" }));
}

describe("KnownVocabularyExportSetting", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDashboardData.subjects = originalSubjects;
    mockDashboardData.assignments = originalAssignments;
    mockDashboardData.dataLoadingState = { assignments: true, subjects: true };
    jest.spyOn(Clipboard, "setString").mockImplementation(() => {});
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("copies a plain list in one tap and confirms the word count", () => {
    copyVocabulary();

    expect(Clipboard.setString).toHaveBeenCalledTimes(1);
    expect(Clipboard.setString).toHaveBeenCalledWith("ありがとう\n水");
    expect(Alert.alert).toHaveBeenCalledWith(
      "Vocabulary copied",
      expect.stringContaining("2 words copied"),
    );
  });

  it("keeps the clipboard unchanged when there are no learned words", () => {
    mockDashboardData.assignments = [];
    copyVocabulary();

    expect(Clipboard.setString).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      "No vocabulary to copy",
      expect.any(String),
    );
  });

  it.each(["assignments", "subjects"] as const)(
    "keeps the clipboard unchanged while %s are not ready",
    (field) => {
      mockDashboardData.dataLoadingState[field] = false;
      copyVocabulary();

      expect(Clipboard.setString).not.toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith(
        "Vocabulary data not ready",
        expect.any(String),
      );
    },
  );

  it("does not copy a partial list when a learned subject is missing", () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockDashboardData.subjects = originalSubjects.slice(0, 1);
    copyVocabulary();

    expect(Clipboard.setString).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      "Could not copy vocabulary",
      expect.any(String),
    );
  });

  it("reports a clipboard failure without a success message", () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(Clipboard, "setString").mockImplementation(() => {
      throw new Error("Clipboard unavailable");
    });
    copyVocabulary();

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      "Could not copy vocabulary",
      expect.any(String),
    );
  });
});
