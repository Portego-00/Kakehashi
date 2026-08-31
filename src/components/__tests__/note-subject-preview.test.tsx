import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { StyleSheet } from "react-native";

import { getSubject } from "../../utils/api";
import { getSubjectById } from "../../utils/cache";
import NoteSubjectPreview from "../note-subject-preview";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("../../utils/api", () => ({
  getSubject: jest.fn(),
}));

jest.mock("../../utils/cache", () => ({
  getSubjectById: jest.fn(),
}));

jest.mock("../../utils/fonts", () => ({
  fontStyles: { japaneseText: {} },
}));

jest.mock("../../utils/note-subject-preview-state", () => ({
  registerOpenNoteSubjectPreview: jest.fn(() => jest.fn()),
}));

jest.mock("../../utils/store", () => ({
  useAuthStore: (selector: (state: { apiToken: string }) => unknown) =>
    selector({ apiToken: "test-token" }),
}));

jest.mock("../../utils/subjectColors", () => ({
  getBestContrastTextColor: () => "#ffffff",
  useSubjectColors: () => ({
    getColorForType: () => "#7c3aed",
  }),
}));

jest.mock("../../utils/theme", () => ({
  useTheme: () => ({
    theme: {
      border: "#dddddd",
      cardBackground: "#ffffff",
      primary: "#3366cc",
      textColor: "#111111",
      textSecondary: "#666666",
    },
  }),
}));

const cachedSubject = {
  id: 440,
  object: "vocabulary",
  data: {
    characters: "橋",
    level: 5,
    meanings: [
      { meaning: "Bridge", primary: true },
      { meaning: "Span", primary: false },
    ],
    readings: [{ reading: "はし", primary: true }],
    parts_of_speech: ["noun", "no_adjective"],
  },
};

describe("NoteSubjectPreview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSubjectById as jest.Mock).mockResolvedValue(cachedSubject);
  });

  it("renders cached subject content without fetching and closes from the explicit button", async () => {
    const onClose = jest.fn();
    const screen = render(
      <NoteSubjectPreview
        linkText="bridge"
        onClose={onClose}
        subjectId={440}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("橋")).toBeTruthy();
      expect(screen.getByText("はし")).toBeTruthy();
      expect(screen.getByText("Bridge · Span")).toBeTruthy();
      expect(screen.getByText("noun · no adjective")).toBeTruthy();
    });

    expect(getSubjectById).toHaveBeenCalledWith(440);
    expect(getSubject).not.toHaveBeenCalled();

    const explicitClose = screen
      .getAllByRole("button", { name: "Close word preview" })
      .find(
        (button) => StyleSheet.flatten(button.props.style)?.width === 40,
      );

    expect(explicitClose).toBeDefined();
    fireEvent.press(explicitClose!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
