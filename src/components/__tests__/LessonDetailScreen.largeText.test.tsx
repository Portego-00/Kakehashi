import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, StyleSheet, View } from "react-native";

import LessonDetailScreen from "../LessonDetailScreen";

let mockFlushedNoteText: string | undefined;
const mockEditorFlush = jest.fn((value?: string) =>
  Promise.resolve(mockFlushedNoteText ?? value ?? ""),
);
const mockAlert = jest.spyOn(Alert, "alert");

function respondToDiscardAlert(action: "Keep editing" | "Discard") {
  const buttons = mockAlert.mock.calls.at(-1)?.[2];
  act(() => buttons?.find((button) => button.text === action)?.onPress?.());
}

let mockSinglePageLessonView = false;
let mockRetainModalDuringDismiss = false;

jest.mock("react-native/Libraries/Modal/Modal", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  type MockModalProps = {
    visible?: boolean;
    children?: React.ReactNode;
    onDismiss?: () => void;
    testID?: string;
  };

  class MockModal extends React.Component<
    MockModalProps,
    { isRendered: boolean }
  > {
    state = { isRendered: false };

    static getDerivedStateFromProps(props: MockModalProps) {
      return props.visible ? { isRendered: true } : null;
    }

    dismiss = () => {
      this.setState({ isRendered: false });
      this.props.onDismiss?.();
    };

    render() {
      // iOS keeps the children mounted until native dismissal finishes. The
      // default Jest Modal removes them as soon as visible becomes false.
      if (
        this.props.visible === false &&
        !(mockRetainModalDuringDismiss && this.state.isRendered)
      ) {
        return null;
      }
      return React.createElement("Modal", {
        ...this.props,
        testID: this.props.testID ?? "native-note-modal",
        onDismiss: this.dismiss,
      });
    }
  }

  return { __esModule: true, default: MockModal };
});

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
  useSafeAreaInsets: () => ({ top: 59, right: 0, bottom: 34, left: 0 }),
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
    { closeLinkPicker: () => boolean; flush: () => Promise<string> },
    React.ComponentProps<typeof TextInput>
  >((props, ref) => {
    const [pickerOpen, setPickerOpen] = React.useState(false);
    const [sourceMode, setSourceMode] = React.useState(false);
    React.useImperativeHandle(ref, () => ({
      flush: () => mockEditorFlush(props.value),
      closeLinkPicker: () => {
        if (!pickerOpen) return false;
        setPickerOpen(false);
        return true;
      },
    }));
    return (
      <>
        <TextInput {...props} />
        <TouchableOpacity onPress={() => setSourceMode(true)}>
          <Text>{sourceMode ? "Source mode active" : "Use source mode"}</Text>
        </TouchableOpacity>
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

function renderNoteLesson() {
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
  return screen;
}

describe("LessonDetailScreen large-text summary", () => {
  beforeEach(() => {
    mockAlert.mockClear();
    mockEditorFlush.mockClear();
    mockFlushedNoteText = undefined;
    mockSinglePageLessonView = false;
    mockRetainModalDuringDismiss = false;
  });

  it("closes an unchanged lesson note without asking to discard", async () => {
    const screen = renderNoteLesson();
    fireEvent.press(screen.getByText("Cancel"));
    await waitFor(() => expect(screen.queryByLabelText("Meaning note text")).toBeNull());
    expect(mockEditorFlush).toHaveBeenCalledTimes(1);
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it("checks the freshly flushed lesson draft before closing", async () => {
    const screen = renderNoteLesson();
    mockFlushedNoteText = "Last native keystroke";
    fireEvent.press(screen.getByText("Cancel"));
    await waitFor(() => expect(mockAlert).toHaveBeenCalledTimes(1));
    respondToDiscardAlert("Keep editing");
    expect(screen.getByLabelText("Meaning note text").props.value).toBe("Last native keystroke");
  });

  it.each(["after", "before"])("preserves the closing editor and resets a session reopened %s native dismissal", async (reopenTiming) => {
    mockSinglePageLessonView = true;
    mockRetainModalDuringDismiss = true;
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
    fireEvent.changeText(screen.getByLabelText("Meaning note text"), "Unsaved draft");
    fireEvent.press(screen.getByText("Use source mode"));
    const editingField = screen.getByLabelText("Meaning note text");

    fireEvent.press(screen.getByText("Cancel"));
    await waitFor(() => expect(mockAlert).toHaveBeenCalledTimes(1));
    respondToDiscardAlert("Discard");

    expect(screen.UNSAFE_getByType(Modal).props.visible).toBe(false);
    expect(screen.getByText("Source mode active")).toBeTruthy();
    expect(screen.getByLabelText("Meaning note text")).toBe(editingField);
    expect(editingField.props.value).toBe("Unsaved draft");

    if (reopenTiming === "after") {
      fireEvent(screen.getByTestId("native-note-modal"), "dismiss");
      expect(screen.queryByLabelText("Meaning note text")).toBeNull();
    }

    fireEvent.press(screen.getByLabelText("Add meaning note"));
    expect(screen.getByLabelText("Meaning note text").props.value).toBe("");
    expect(screen.getByText("Use source mode")).toBeTruthy();
  });

  it("keeps the note top anchored while applying only missing Android keyboard space", () => {
    const platform = jest.replaceProperty(Platform, "OS", "android");
    const addListener = jest.spyOn(Keyboard, "addListener");
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
    try {
      fireEvent.press(screen.getByLabelText("Add meaning note"));
      const overlay = screen.UNSAFE_getByType(KeyboardAvoidingView);
      fireEvent(overlay, "layout", { nativeEvent: { layout: { height: 844 } } });
      const keyboardShown = addListener.mock.calls.find(
        ([name]) => name === "keyboardDidShow",
      )?.[1];
      expect(keyboardShown).toBeDefined();
      act(() => {
        keyboardShown?.({
          duration: 250,
          easing: "keyboard",
          endCoordinates: { height: 300, width: 390, screenX: 0, screenY: 544 },
          startCoordinates: { height: 0, width: 390, screenX: 0, screenY: 844 },
        });
      });

      expect(StyleSheet.flatten(overlay.props.style)).toMatchObject({
        justifyContent: "flex-start",
        paddingTop: 59,
        paddingBottom: 316,
      });
      expect(StyleSheet.flatten(overlay.props.children.props.style).transform).toBeUndefined();

      fireEvent(overlay, "layout", { nativeEvent: { layout: { height: 544 } } });
      expect(StyleSheet.flatten(overlay.props.style)).toMatchObject({
        paddingTop: 59,
        paddingBottom: 16,
      });
    } finally {
      screen.unmount();
      addListener.mockRestore();
      platform.restore();
    }
  });

  it.each(["Cancel", "request close"])(
    "dismisses the subject picker before the lesson note editor through %s",
    async (dismissAction) => {
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

      expect(mockAlert).not.toHaveBeenCalled();
      expect(mockEditorFlush).not.toHaveBeenCalled();
      dismiss();
      await waitFor(() => expect(mockAlert).toHaveBeenCalledWith(
        "Discard note changes?",
        "Your changes will not be saved.",
        expect.arrayContaining([
          expect.objectContaining({ text: "Keep editing", style: "cancel" }),
          expect.objectContaining({ text: "Discard", style: "destructive" }),
        ]),
      ));
      respondToDiscardAlert("Keep editing");
      expect(screen.getByLabelText("Meaning note text").props.value).toBe("My unsaved note");
      dismiss();
      await waitFor(() => expect(mockAlert).toHaveBeenCalledTimes(2));
      respondToDiscardAlert("Discard");
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

afterAll(() => mockAlert.mockRestore());
