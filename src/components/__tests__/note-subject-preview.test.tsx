import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { StyleSheet } from "react-native";

import { getSubject } from "../../utils/api";
import { getSubjectById } from "../../utils/cache";
import NoteSubjectPreview from "../note-subject-preview";

const mockRouterPush = jest.fn();

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
  },
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
  useSubjectColors: () => ({
    getColorForType: (type: string) => {
      if (type === "radical") return "#3c9bff";
      if (type === "kanji") return "#fa1f62";
      return "#9c38d9";
    },
  }),
}));

jest.mock("../../utils/theme", () => ({
  useTheme: () => ({
    theme: {
      border: "#dddddd",
      cardBackground: "#ffffff",
      headerText: "#ffffff",
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
      expect(screen.getByText("Reading")).toBeTruthy();
      expect(screen.getByText("はし")).toBeTruthy();
      expect(screen.getByText("Bridge · Span")).toBeTruthy();
      expect(screen.getByText("noun · no adjective")).toBeTruthy();
    });

    expect(getSubjectById).toHaveBeenCalledWith(440);
    expect(getSubject).not.toHaveBeenCalled();

    const explicitClose = screen
      .getAllByRole("button", { name: "Close word preview" })
      .find((button) => StyleSheet.flatten(button.props.style)?.width === 40);

    expect(explicitClose).toBeDefined();
    fireEvent.press(explicitClose!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes the preview before opening the complete subject details", async () => {
    const onClose = jest.fn();
    const screen = render(
      <NoteSubjectPreview
        linkText="bridge"
        onClose={onClose}
        subjectId={440}
      />,
    );

    const detailsButton = await waitFor(() =>
      screen.getByRole("button", { name: "View full details" }),
    );

    expect(StyleSheet.flatten(detailsButton.props.style)).toMatchObject({
      backgroundColor: "#9c38d9",
      minHeight: 44,
    });

    fireEvent.press(detailsButton);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: "/subject/[id]",
      params: {
        id: "440",
      },
    });
    expect(onClose.mock.invocationCallOrder[0]).toBeLessThan(
      mockRouterPush.mock.invocationCallOrder[0],
    );
  });

  it("still offers the complete subject page when the compact preview cannot load", async () => {
    (getSubjectById as jest.Mock).mockRejectedValue(
      new Error("cache unavailable"),
    );
    (getSubject as jest.Mock).mockRejectedValue(new Error("offline"));
    const onClose = jest.fn();
    const screen = render(
      <NoteSubjectPreview
        linkText="bridge"
        onClose={onClose}
        subjectId={440}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/linked subject could not be loaded/i),
      ).toBeTruthy();
    });
    fireEvent.press(screen.getByRole("button", { name: "View full details" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: "/subject/[id]",
      params: { id: "440" },
    });
  });

  it("groups kanji readings by On’yomi, Kun’yomi, and Nanori", async () => {
    (getSubjectById as jest.Mock).mockResolvedValue({
      ...cachedSubject,
      object: "kanji",
      data: {
        ...cachedSubject.data,
        characters: "生",
        readings: [
          { reading: "せい", primary: true, type: "onyomi" },
          { reading: "しょう", primary: false, type: "onyomi" },
          { reading: "い.きる", primary: false, type: "kunyomi" },
          { reading: "いく", primary: false, type: "nanori" },
        ],
      },
    });
    const screen = render(
      <NoteSubjectPreview linkText="生" onClose={jest.fn()} subjectId={440} />,
    );

    await waitFor(() => {
      expect(screen.getByText("On’yomi")).toBeTruthy();
      expect(screen.getByText("せい · しょう")).toBeTruthy();
      expect(screen.getByText("Kun’yomi")).toBeTruthy();
      expect(screen.getByText("い.きる")).toBeTruthy();
      expect(screen.getByText("Nanori")).toBeTruthy();
      expect(screen.getByText("いく")).toBeTruthy();
    });

    expect(screen.queryByText("Reading")).toBeNull();
  });

  it.each([
    ["radical", "生"],
    ["kanji", "命"],
  ])(
    "uses the app header text color on a %s preview",
    async (object, characters) => {
      (getSubjectById as jest.Mock).mockResolvedValue({
        ...cachedSubject,
        object,
        data: { ...cachedSubject.data, characters },
      });
      const screen = render(
        <NoteSubjectPreview
          linkText={characters}
          onClose={jest.fn()}
          subjectId={440}
        />,
      );

      const characterText = await waitFor(() => screen.getByText(characters));
      const metaText = screen.getByText(`${object} · Level 5`);

      expect(StyleSheet.flatten(characterText.props.style)).toMatchObject({
        color: "#ffffff",
      });
      expect(StyleSheet.flatten(metaText.props.style)).toMatchObject({
        color: "#ffffff",
      });
    },
  );
});
