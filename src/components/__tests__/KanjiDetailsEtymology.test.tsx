import {act} from "@testing-library/react-native";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {parsePackageText} from "../../features/translation-packages/resolver";
import {packageManager} from "../../features/translation-packages/package-store";
import {useLearningContentStore} from "../../features/translation-packages/store";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";

import { useSettingsStore } from "../../utils/store";
import KanjiDetails from "../KanjiDetails";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(() => Promise.resolve()),
}));

jest.mock("../../utils/prepareNativeSpeech", () => ({
  prepareNativeSpeech: jest.fn(() => Promise.resolve()),
}));

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
}));

jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { ScrollView, View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  const transition = {
    delay: () => transition,
    duration: () => transition,
  };

  return {
    __esModule: true,
    default: { ScrollView, View },
    enableLayoutAnimations: jest.fn(),
    FadeIn: transition,
    FadeInDown: transition,
    FadeOutUp: transition,
    LinearTransition: transition,
    useAnimatedRef: () => React.createRef(),
  };
});

jest.mock("react-native-pager-view", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  const MockPagerView = React.forwardRef(
    (
      props: React.ComponentProps<typeof View>,
      ref: React.ForwardedRef<React.ElementRef<typeof View>>
    ) => <View {...props} ref={ref} />
  );
  MockPagerView.displayName = "MockPagerView";

  return MockPagerView;
});

jest.mock("../../utils/store", () => ({
  useSettingsStore: jest.fn(),
}));

jest.mock("../../utils/subjectColors", () => ({
  getReadableTextColor: () => "#fff",
  useSubjectColors: () => ({
    radical: "#00a1f1",
    kanji: "#fa1f62",
    vocabulary: "#a0d468",
  }),
}));

jest.mock("../../utils/theme", () => ({
  useTheme: () => ({
    theme: {
      backgroundColor: "#f6f6f6",
      border: "#dddddd",
      cardBackground: "#ffffff",
      isDark: false,
      primary: "#3a86ff",
      secondary: "#777777",
      textColor: "#111111",
      textLight: "#999999",
      textSecondary: "#666666",
    },
  }),
}));

jest.mock("../CopyTooltip", () => ({
  CopyTooltip: () => null,
  useCopyTooltip: () => ({
    containerRef: { current: null },
    tooltipVisible: false,
    tooltipPosition: { x: 0, y: 0 },
    tooltipOpacity: { value: 0 },
    tooltipTranslateY: { value: 0 },
    copyText: jest.fn(),
  }),
}));

jest.mock("../KanjiPracticeModal", () => () => null);
jest.mock("../StrokeOrderAnimation", () => () => null);
jest.mock("../SynonymsModal", () => ({
  SynonymsModal: () => null,
}));

jest.mock("../KanjiEtymologySection", () => ({
  __esModule: true,
  default: ({
    characters,
    presentation,
    visible,
  }: {
    characters: string;
    presentation?: "details" | "lesson";
    visible: boolean;
  }) => {
    const React = jest.requireActual<typeof import("react")>("react");
    const { Text, View } =
      jest.requireActual<typeof import("react-native")>("react-native");

    return React.createElement(
      View,
      { testID: "etymology-integration" },
      React.createElement(Text, null, characters),
      React.createElement(Text, null, presentation),
      React.createElement(Text, null, visible ? "visible" : "hidden")
    );
  },
}));

const kanji = {
  id: 1,
  object: "kanji",
  level: 1,
  characters: "休",
  meanings: [{ meaning: "Rest", primary: true }],
  readings: [
    {
      reading: "きゅう",
      primary: true,
      type: "onyomi" as const,
    },
  ],
  meaningMnemonic: "A person rests by a tree.",
  readingMnemonic: "Remember the reading.",
};

function mockSettings(
  showKanjiEtymology: boolean,
  kanjiReadingTextToSpeechEnabled = false,
  showJLPTLevel = false
) {
  const settings = {
    groupKanjiVocabularyExamplesByReading: false,
    showInlineRadicalReminders: false,
    showKanjiEtymology,
    kanjiReadingTextToSpeechEnabled,
    showOnyomiInKatakana: false,
    showPitchAccent: false,
    showStrokeOrder: false,
    showJLPTLevel,
    showVocabularyFrequency: false,
  };
  (useSettingsStore as unknown as jest.Mock).mockImplementation(
    (selector?: (state: typeof settings) => unknown) => selector ? selector(settings) : settings,
  );
}

describe("KanjiDetails etymology integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    [false, "hidden"],
    [true, "visible"],
  ])(
    "passes the kanji and showKanjiEtymology=%s to the Meaning tab",
    (showKanjiEtymology, visibilityLabel) => {
      mockSettings(showKanjiEtymology);

      const screen = render(
        <KanjiDetails
          kanji={kanji}
          progressionStatus="success"
          embedded
        />
      );

      expect(screen.getByTestId("etymology-integration")).toBeTruthy();
      expect(screen.getByText("休")).toBeTruthy();
      expect(screen.getByText("details")).toBeTruthy();
      expect(screen.getByText(visibilityLabel)).toBeTruthy();
    }
  );

  it("speaks a kanji reading when reading speech is enabled", async () => {
    const Speech = jest.requireMock<typeof import("expo-speech")>(
      "expo-speech"
    );
    mockSettings(false, true);

    const screen = render(
      <KanjiDetails kanji={kanji} progressionStatus="success" embedded />
    );

    fireEvent.press(
      screen.getByLabelText("Speak Japanese pronunciation きゅう")
    );

    await waitFor(() => {
      expect(Speech.stop).toHaveBeenCalledTimes(1);
      expect(Speech.speak).toHaveBeenCalledWith("きゅう", {
        language: "ja-JP",
        pitch: 1,
        rate: 0.8,
      });
    });
  });
});

it.each([false, true])("only shows the kanji JLPT row when enabled (%s)", (enabled) => {
  mockSettings(false, false, enabled);
  const screen = render(<KanjiDetails kanji={kanji} progressionStatus="success" embedded />);
  if (enabled) {
    expect(screen.getByText("JLPT Level")).toBeTruthy();
    expect(screen.getByText("N5")).toBeTruthy();
  } else {
    expect(screen.queryByText("JLPT Level")).toBeNull();
  }
  expect(screen.queryByText("Frequency")).toBeNull();
});

it("shows translated Composition radicals and switches back to English",async()=>{
 mockSettings(false);await packageManager.hydrate();
 const packet=parsePackageText(readFileSync(resolve(process.cwd(),"translation-packages/example-tr-v3.json"),"utf8"));
 packageManager.state.setState({packet});useLearningContentStore.setState({enabled:true});
 const e=packet.subjects["80"];
 const component={id:80,characters:e.source.word,meanings:e.source.meaningsEn,level:e.source.level};
 const screen=render(<KanjiDetails kanji={{...kanji,componentSubjects:[component]}} progressionStatus="success" embedded />);
 expect(screen.getAllByText("Hayalet").length).toBeGreaterThan(0);
 await act(async()=>{useLearningContentStore.setState({enabled:false});});
 expect(screen.queryAllByText("Hayalet")).toHaveLength(0);expect(screen.getAllByText(e.source.meaningsEn[0]).length).toBeGreaterThan(0);
});
