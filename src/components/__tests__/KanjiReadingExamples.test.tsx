import data from "../../../tests/fixtures/translation-packages/tr-learning-pilot.json";
import {parseTranslationPackage} from "../../features/translation-packages/resolver";
import {packageManager} from "../../features/translation-packages/package-store";
import {useLearningContentStore} from "../../features/translation-packages/store";
import { fireEvent, render } from "@testing-library/react-native";
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
    vocabulary: "#9c38d9",
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

  it("shows all vocabulary as cards with level tags for future levels in ungrouped mode", () => {
    const screen = render(
      <KanjiReadingExamples
        {...sharedProps}
        groupByReading={false}
        vocabulary={[vocabulary[0], { ...vocabulary[1], level: 10 }]}
        userLevel={5}
      />,
    );

    expect(screen.queryByText("On’yomi")).toBeNull();
    expect(screen.getByText("大学")).toBeTruthy();
    expect(screen.getByText("大人")).toBeTruthy();
    expect(screen.getByText("University")).toBeTruthy();
    expect(screen.getByText("Adult")).toBeTruthy();
    expect(screen.queryByText("だいがく")).toBeNull();
    expect(screen.queryByText("1")).toBeNull();
    expect(screen.getByText("10")).toBeTruthy();
  });

  it.each([true, false])(
    "shows unlock levels in ascending order before and after expanding (grouped: %s)",
    (groupByReading) => {
      const examples = [
        {
          ...vocabulary[0], id: 3, characters: "大学院", level: 20,
          readings: [{ reading: "だいがくいん", primary: true }],
          meanings: ["Graduate School"],
        },
        { ...vocabulary[0], level: 5 },
        {
          ...vocabulary[0], id: 4, characters: "大学生", level: 10,
          readings: [{ reading: "だいがくせい", primary: true }],
          meanings: ["University Student"],
        },
      ];
      const onSubjectPress = jest.fn();
      const screen = render(
        <KanjiReadingExamples
          {...sharedProps}
          groupByReading={groupByReading}
          vocabulary={examples}
          onSubjectPress={onSubjectPress}
          initialExamplesPerReading={2}
          initialUngroupedExamples={2}
        />,
      );
      const rowLabels = () => screen.getAllByRole("button")
        .map((row) => row.props.accessibilityLabel)
        .filter((label) => label.includes(", Level "));

      const levelPrefix = groupByReading ? "Level " : "";
      expect(screen.getByText(`${levelPrefix}5`)).toBeTruthy();
      expect(screen.getByText(`${levelPrefix}10`)).toBeTruthy();
      expect(screen.queryByText(`${levelPrefix}20`)).toBeNull();
      expect(rowLabels()).toEqual([
        "大学, だいがく, University, Level 5",
        "大学生, だいがくせい, University Student, Level 10",
      ]);

      fireEvent.press(screen.getByLabelText("Show 1 more vocabulary examples"));

      expect(screen.getByText(`${levelPrefix}20`)).toBeTruthy();
      expect(rowLabels()).toEqual([
        "大学, だいがく, University, Level 5",
        "大学生, だいがくせい, University Student, Level 10",
        "大学院, だいがくいん, Graduate School, Level 20",
      ]);
      fireEvent.press(screen.getByLabelText("大学生, だいがくせい, University Student, Level 10"));
      expect(onSubjectPress).toHaveBeenCalledWith(4);
      expect(examples.map((example) => example.level)).toEqual([20, 5, 10]);
    },
  );

  it("omits the level badge when the vocabulary level is unavailable", () => {
    const screen = render(
      <KanjiReadingExamples
        {...sharedProps}
        groupByReading
        vocabulary={[{ ...vocabulary[0], level: undefined }]}
        onSubjectPress={jest.fn()}
      />,
    );

    expect(screen.getByLabelText("大学, だいがく, University")).toBeTruthy();
    expect(screen.queryByText(/Level/)).toBeNull();
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
