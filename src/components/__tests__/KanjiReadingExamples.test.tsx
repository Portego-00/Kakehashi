import { render } from "@testing-library/react-native";
import React from "react";

import KanjiReadingExamples from "../KanjiReadingExamples";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("../../utils/store", () => ({
  useSettingsStore: (
    selector: (state: { showOnyomiInKatakana: boolean }) => unknown,
  ) => selector({ showOnyomiInKatakana: false }),
}));

jest.mock("../../utils/subjectColors", () => ({
  useSubjectColors: () => ({
    kanji: "#fa1f62",
  }),
}));

jest.mock("../../utils/theme", () => ({
  useTheme: () => ({
    theme: {
      border: "#dddddd",
      textColor: "#111111",
      textSecondary: "#666666",
    },
  }),
}));

const vocabulary = [
  {
    id: 1,
    characters: "大学",
    meanings: ["University"],
    readings: [{ reading: "だいがく", primary: true }],
    level: 1,
  },
  {
    id: 2,
    characters: "大人",
    meanings: ["Adult"],
    readings: [{ reading: "おとな", primary: true }],
    level: 1,
  },
];

const sharedProps = {
  kanjiCharacters: "大",
  kanjiReadings: [
    { reading: "だい", type: "onyomi" as const, primary: true },
    { reading: "おお", type: "kunyomi" as const, primary: false },
  ],
  vocabulary,
};

describe("KanjiReadingExamples", () => {
  it("shows only confidently categorized examples in grouped mode", () => {
    const screen = render(
      <KanjiReadingExamples {...sharedProps} groupByReading />,
    );

    expect(screen.getByText("On’yomi")).toBeTruthy();
    expect(screen.getByText("大学")).toBeTruthy();
    expect(screen.queryByText("大人")).toBeNull();
  });

  it("shows all vocabulary without reading headings in ungrouped mode", () => {
    const screen = render(
      <KanjiReadingExamples {...sharedProps} groupByReading={false} />,
    );

    expect(screen.queryByText("On’yomi")).toBeNull();
    expect(screen.getByText("大学")).toBeTruthy();
    expect(screen.getByText("大人")).toBeTruthy();
  });
});
