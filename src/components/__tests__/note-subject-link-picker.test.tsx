import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { StyleSheet } from "react-native";

import { getSubjects } from "../../utils/api";
import { getAllSubjects } from "../../utils/cache";
import NoteSubjectLinkPicker from "../note-subject-link-picker";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("react-native/Libraries/Lists/FlatList", () => {
  const React = jest.requireActual<typeof import("react")>("react");

  return {
    __esModule: true,
    default: ({
      data,
      keyExtractor,
      renderItem,
    }: {
      data: unknown[];
      keyExtractor: (item: unknown, index: number) => string;
      renderItem: (info: { item: unknown; index: number }) => React.ReactNode;
    }) =>
      React.createElement(
        React.Fragment,
        null,
        ...data.map((item, index) =>
          React.createElement(
            React.Fragment,
            { key: keyExtractor(item, index) },
            renderItem({ item, index }),
          ),
        ),
      ),
  };
});

jest.mock("../../utils/api", () => ({
  getSubjects: jest.fn(),
}));

jest.mock("../../utils/cache", () => ({
  getAllSubjects: jest.fn(),
}));

jest.mock("../../utils/fonts", () => ({
  fontStyles: { japaneseText: {} },
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
      backgroundColor: "#f5f5f5",
      border: "#dddddd",
      cardBackground: "#ffffff",
      error: "#cc0000",
      headerSurface: "#eeeeee",
      headerText: "#ffffff",
      primary: "#3366cc",
      textColor: "#111111",
      textLight: "#888888",
      textSecondary: "#666666",
    },
  }),
}));

const bridgeSubject = {
  id: 440,
  object: "vocabulary",
  data: {
    characters: "橋",
    level: 5,
    meanings: [{ meaning: "Bridge", primary: true }],
    readings: [{ reading: "はし", primary: true }],
  },
};

const unrelatedSubject = {
  id: 441,
  object: "vocabulary",
  data: {
    characters: "川",
    level: 2,
    meanings: [{ meaning: "River", primary: true }],
    readings: [{ reading: "かわ", primary: true }],
  },
};

const lifeRadical = {
  id: 442,
  object: "radical",
  data: {
    characters: "生",
    level: 3,
    meanings: [{ meaning: "Life Radical", primary: true }],
    readings: null,
  },
};

const lifeKanji = {
  id: 443,
  object: "kanji",
  data: {
    characters: "命",
    level: 7,
    meanings: [{ meaning: "Life Kanji", primary: true }],
    readings: [{ reading: "めい", primary: true }],
  },
};

describe("NoteSubjectLinkPicker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAllSubjects as jest.Mock).mockResolvedValue([
      unrelatedSubject,
      bridgeSubject,
    ]);
  });

  it("searches the cached catalog from its prefilled query and selects the ranked result", async () => {
    const onSelect = jest.fn();
    const screen = render(
      <NoteSubjectLinkPicker
        initialQuery="bridge"
        onCancel={jest.fn()}
        onSelect={onSelect}
      />,
    );

    expect(
      screen.getByPlaceholderText("Japanese, reading, or meaning").props.value,
    ).toBe("bridge");

    const bridgeResult = await waitFor(() =>
      screen.getByLabelText("Link to 橋, Bridge"),
    );

    expect(getAllSubjects).toHaveBeenCalledTimes(1);
    expect(getSubjects).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Link to 川, River")).toBeNull();

    fireEvent.press(bridgeResult);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(bridgeSubject);
  });

  it("uses white characters on radical and kanji subject colors", async () => {
    (getAllSubjects as jest.Mock).mockResolvedValue([
      lifeRadical,
      lifeKanji,
    ]);
    const screen = render(
      <NoteSubjectLinkPicker
        initialQuery="life"
        onCancel={jest.fn()}
        onSelect={jest.fn()}
      />,
    );

    const radicalCharacters = await waitFor(() => screen.getByText("生"));
    const kanjiCharacters = await waitFor(() => screen.getByText("命"));

    expect(StyleSheet.flatten(radicalCharacters.props.style)).toMatchObject({
      color: "#ffffff",
    });
    expect(StyleSheet.flatten(kanjiCharacters.props.style)).toMatchObject({
      color: "#ffffff",
    });
  });

  it("offers removal when editing an existing subject link", async () => {
    const onRemove = jest.fn();
    const screen = render(
      <NoteSubjectLinkPicker
        initialQuery="bridge"
        linkedSubjectId={440}
        onCancel={jest.fn()}
        onRemove={onRemove}
        onSelect={jest.fn()}
      />,
    );

    const removeButton = await waitFor(() =>
      screen.getByLabelText("Remove word link"),
    );
    fireEvent.press(removeButton);

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(getSubjects).not.toHaveBeenCalled();
  });

  it("replaces the previous results when the query changes", async () => {
    const screen = render(
      <NoteSubjectLinkPicker
        initialQuery="bridge"
        onCancel={jest.fn()}
        onSelect={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText("Link to 橋, Bridge")).toBeTruthy(),
    );

    fireEvent.changeText(
      screen.getByPlaceholderText("Japanese, reading, or meaning"),
      "river",
    );

    await waitFor(() =>
      expect(screen.getByLabelText("Link to 川, River")).toBeTruthy(),
    );
    expect(screen.queryByLabelText("Link to 橋, Bridge")).toBeNull();
  });
});
