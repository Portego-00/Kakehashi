import data from "../../../tests/fixtures/translation-packages/tr-learning-pilot.json";
import {parseTranslationPackage} from "../../features/translation-packages/resolver";
import {packageManager} from "../../features/translation-packages/package-store";
import {useLearningContentStore} from "../../features/translation-packages/store";
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

it("shows translated meanings in kanji reading examples and switches back to English", () => {
  const packet = parseTranslationPackage(data)!;
  const entry = packet.subjects["2761"];
  packageManager.state.setState({packet, hydrated: true});
  useLearningContentStore.setState({enabled: true});
  const props = {...sharedProps, groupByReading: false,
    vocabulary: [{id: 2761, characters: entry.source.word!, meanings: entry.source.meaningsEn,
      readings: entry.source.readingsJa.map(reading => ({reading})), level: 8}]};
  const screen = render(<KanjiReadingExamples {...props} />);
  expect(screen.getByText("Gölet")).toBeTruthy();
  screen.unmount();
  useLearningContentStore.setState({enabled:false});
  const english = render(<KanjiReadingExamples {...props} />);
  expect(english.getByText(entry.source.meaningsEn[0])).toBeTruthy();
  english.unmount(); packageManager.state.setState({packet: null});
});
