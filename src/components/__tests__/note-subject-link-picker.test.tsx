import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";

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
  getBestContrastTextColor: () => "#ffffff",
  useSubjectColors: () => ({
    getColorForType: () => "#7c3aed",
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
