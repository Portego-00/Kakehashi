import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Modal, StyleSheet, View } from "react-native";

import LessonDetailScreen from "../LessonDetailScreen";

let mockSinglePageLessonView = false;

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@expo/vector-icons/Feather", () => () => null);
jest.mock("@react-native-community/slider", () => () => null);

jest.mock("expo-blur", () => ({
  BlurView: ({ children }: { children?: React.ReactNode }) => children,
}));

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
}));

jest.mock("expo-status-bar", () => ({
  StatusBar: () => null,
}));

jest.mock("react-native-gesture-handler", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    GestureHandlerRootView: ({ children, ...props }: React.ComponentProps<typeof View>) => (
      <View {...props}>{children}</View>
    ),
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

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("react-native-svg", () => ({
  SvgXml: () => null,
}));

jest.mock("react-native-tab-view", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    TabBar: () => null,
    TabView: () => <View testID="mock-tab-view" />,
  };
});

jest.mock("react-native-external-keyboard", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  const MockKeyboardExtendedBaseView = React.forwardRef(
    (
      props: React.ComponentProps<typeof View>,
      ref: React.ForwardedRef<{ focus: () => void }>
    ) => {
      React.useImperativeHandle(ref, () => ({ focus: jest.fn() }));
      return <View {...props} />;
    }
  );
  MockKeyboardExtendedBaseView.displayName = "MockKeyboardExtendedBaseView";

  return {
    KeyboardExtendedBaseView: MockKeyboardExtendedBaseView,
  };
});

jest.mock("../../modules/AudioSessionManager", () => ({
  __esModule: true,
  default: { overrideSpeaker: jest.fn() },
}));

jest.mock("../../utils/expoAvCompat", () => ({
  Audio: {
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
    Sound: { createAsync: jest.fn() },
  },
}));

jest.mock("../../utils/azureSpeech", () => ({
  azureSpeechService: {
    speak: jest.fn(),
    stop: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("../../utils/store", () => ({
  useAuthStore: () => ({ apiToken: "test-token", userData: null }),
  useSettingsStore: () => ({
    appTextSizeScale: 1.15,
    autoplayLessonReadingAudio: false,
    singlePageLessonView: mockSinglePageLessonView,
    vocabularyAudioVoice: "female",
  }),
}));

jest.mock("../../utils/theme", () => ({
  useTheme: () => ({
    theme: {
      backgroundColor: "#fff",
      border: "#ddd",
      cardBackground: "#fff",
      isDark: false,
      primary: "#08f",
      textColor: "#111",
      textLight: "#888",
      textSecondary: "#555",
    },
  }),
}));

jest.mock("../../utils/subjectColors", () => ({
  useSubjectColors: () => ({
    radical: "#00a1f1",
    kanji: "#fa1f62",
    vocabulary: "#a0d468",
    getColorForType: () => "#fa1f62",
  }),
  withAlpha: () => "#fa1f6228",
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

jest.mock("../formatted-note", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { TextInput, TouchableOpacity, Text } =
    jest.requireActual<typeof import("react-native")>("react-native");
  const Editor = React.forwardRef<
    { closeLinkPicker: () => boolean },
    React.ComponentProps<typeof TextInput>
  >((props, ref) => {
    const [pickerOpen, setPickerOpen] = React.useState(false);
    React.useImperativeHandle(ref, () => ({
      closeLinkPicker: () => {
        if (!pickerOpen) return false;
        setPickerOpen(false);
        return true;
      },
    }));
    return (
      <>
        <TextInput {...props} />
        <TouchableOpacity onPress={() => setPickerOpen(true)}>
          <Text>Insert subject link</Text>
        </TouchableOpacity>
        {pickerOpen && <Text>Subject link picker</Text>}
      </>
    );
  });
  Editor.displayName = "MockNoteEditor";
  return { FormattedNoteEditor: Editor, FormattedNoteText: () => null };
});

jest.mock("../KanjiPracticeModal", () => () => null);
jest.mock("../KanjiLessonEtymologySection", () => () => null);
jest.mock("../KanjiReadingExamples", () => () => null);
jest.mock("../PitchAccentVisualization", () => () => null);
jest.mock("../StrokeOrderAnimation", () => () => null);
jest.mock("../SynonymsModal", () => ({ SynonymsModal: () => null }));
jest.mock("../VocabularyFrequencyBadge", () => () => null);

describe("LessonDetailScreen large-text summary", () => {
  beforeEach(() => {
    mockSinglePageLessonView = false;
  });

  it.each(["Cancel", "request close"])(
    "dismisses the subject picker before the lesson note editor through %s",
    (dismissAction) => {
      mockSinglePageLessonView = true;
      const subject = {
        id: 1,
        object: "kanji",
        data: {
          characters: "橋",
          meanings: [{ meaning: "bridge", primary: true }],
          readings: [],
        },
      };
      const screen = render(
        <LessonDetailScreen
          item={{ id: subject.id, subject }}
          batchItems={[{ id: subject.id, subject }]}
          currentBatchIndex={0}
          onNext={jest.fn()}
          onPrev={jest.fn()}
          canGoBack={false}
          canGoForward={false}
          progress={{ current: 1, total: 1, batchCurrent: 1, batchTotal: 1 }}
          onExit={jest.fn()}
        />,
      );
      fireEvent.press(screen.getByLabelText("Add meaning note"));
      fireEvent.changeText(screen.getByLabelText("Meaning note text"), "My unsaved note");
      fireEvent.press(screen.getByText("Insert subject link"));
      expect(screen.getByText("Subject link picker")).toBeTruthy();

      const dismiss = () => {
        if (dismissAction === "Cancel") {
          fireEvent.press(screen.getByText("Cancel"));
        } else {
          fireEvent(screen.UNSAFE_getByType(Modal), "requestClose");
        }
      };
      dismiss();

      expect(screen.queryByText("Subject link picker")).toBeNull();
      expect(screen.getByLabelText("Meaning note text").props.value).toBe("My unsaved note");

      dismiss();
      expect(screen.queryByLabelText("Meaning note text")).toBeNull();
    },
  );

  it("bounds the subject summary and preserves content through its trailing marker", () => {
    const longMeaning =
      "A deliberately long bridge definition that wraps";
    const subject = {
      id: 42,
      object: "kanji",
      data: {
        characters: "橋",
        meanings: [
          {
            meaning: longMeaning,
            primary: true,
          },
        ],
        readings: [],
      },
    };

    const screen = render(
      <LessonDetailScreen
        item={{ id: subject.id, subject }}
        batchItems={[{ id: subject.id, subject }]}
        currentBatchIndex={0}
        onNext={jest.fn()}
        onPrev={jest.fn()}
        canGoBack={false}
        canGoForward={false}
        progress={{ current: 1, total: 1, batchCurrent: 1, batchTotal: 1 }}
        onExit={jest.fn()}
      />
    );

    const summary = screen.getByTestId("lesson-subject-summary");
    const summaryStyle = StyleSheet.flatten(summary.props.style);

    expect(screen.getByText(longMeaning)).toBeTruthy();
    expect(summaryStyle.maxHeight).toBeGreaterThan(0);
    expect(summaryStyle.flexShrink).toBe(1);
    expect(summary.props.nestedScrollEnabled).toBe(true);
    expect(summary.props.showsVerticalScrollIndicator).toBe(true);

    const marker = summary
      .findAllByType(View)
      .find((node: { props: React.ComponentProps<typeof View> }) => {
        const style = StyleSheet.flatten(node.props.style);
        return style?.width === 1 && style?.height === 1 && node !== summary;
      });
    expect(marker).toBeDefined();

    fireEvent(marker!, "layout", {
      nativeEvent: {
        layout: { x: 0, y: 280, width: 1, height: 1 },
      },
    });

    const updatedSummary = screen.getByTestId("lesson-subject-summary");
    const contentStyle = StyleSheet.flatten(
      updatedSummary.props.contentContainerStyle
    );
    expect(contentStyle.minHeight).toBe(305);
    expect(screen.getByText(longMeaning)).toBeTruthy();
  });
});
