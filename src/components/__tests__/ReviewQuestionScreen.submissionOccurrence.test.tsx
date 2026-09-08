import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";
import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity } from "react-native";

import ReviewQuestionScreen from "../ReviewQuestionScreen";
import { Audio } from "../../utils/expoAvCompat";
import { buildReviewQuestionQueue } from "../../utils/reviewOrdering";

const mockGetSubjectById = jest.fn<Promise<unknown>, [number]>(
  async () => null,
);
const mockRenderedDetailSubjects: number[] = [];
const mockGetAllSubjects = jest.fn(async (): Promise<unknown[]> => []);
const mockSpeechListeners = new Map<string, (event: unknown) => void>();
let mockUseRealKanaInput = false;
let mockVoicePermissionsGranted = false;

jest.mock("../../utils/cache", () => ({
  getSubjectById: (id: number) => mockGetSubjectById(id),
  getAllSubjects: () => mockGetAllSubjects(),
  clearStudyMaterialsCache: jest.fn(async () => {}),
}));

const mockAuthState: { apiToken: null; userData: { username: string } | null } = {
  apiToken: null,
  userData: { username: "Portego" },
};

const mockSettings = {
  reviewMultipleChoiceEnabled: false,
  setReviewMultipleChoiceEnabled: jest.fn(),
  ankiCardMode: false,
  ankiGroupQuestions: false,
  ankiCardModeScope: "both",
  ankiHideAnswerCompletely: false,
  ankiButtonlessMode: false,
  ankiShowReplayAudioButton: false,
  ankiShowOtherAcceptedAnswersAndUserSynonyms: false,
  ankiShowWaniKaniGrammarTags: false,
  ankiShowPitchAccentNumbers: false,
  ankiShowPitchAccentGraph: false,
  autoplayVocabularyAudio: false,
  vocabularyAudioVoice: "female",
  allowSkippingReviews: false,
  disableAutoProgressOnWrong: false,
  disableAutoProgressOnCloseAnswer: false,
  disableAutoProgressOnCorrect: false,
  acceptUserSynonymsAsAnswers: false,
  showAddSynonymButton: false,
  acceptAnyKanjiOnyomiReading: false,
  jitaiEnabled: false,
  autoSwitchKeyboard: false,
  voiceReviewAnswersEnabled: false,
  reviewIncorrectKeyboardShortcuts: undefined,
  reviewCorrectKeyboardShortcuts: undefined,
  showAnswerStopSubjectDetails: false,
  showReviewItemLevelAndSrsStage: false,
  reviewAnimatePreviousQuestion: false,
  reviewSearchButtonEnabled: false,
  reviewCharacterFontScale: 1,
  reviewInputFontScale: 1,
  srsProgressionCardDisplayMode: "never",
  visuallySimilarKanjiSource: "wanikani",
};
const defaultSettings = { ...mockSettings };
const mockReadReviewSettings = jest.fn(() => mockSettings);

jest.mock("@expo/vector-icons", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    Ionicons: ({ name }: { name: string }) =>
      React.createElement(Text, null, name),
  };
});

jest.mock("expo-blur", () => {
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return { BlurView: View };
});

jest.mock("expo-router", () => {
  return {
    router: { push: jest.fn() },
    useFocusEffect: jest.fn(),
  };
});

jest.mock("expo-speech-recognition", () => ({
  ExpoSpeechRecognitionModule: {
    isRecognitionAvailable: jest.fn(() => true),
    supportsOnDeviceRecognition: jest.fn(() => false),
    getPermissionsAsync: jest.fn(async () => ({ granted: mockVoicePermissionsGranted })),
    requestPermissionsAsync: jest.fn(async () => ({ granted: false })),
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
  },
  useSpeechRecognitionEvent: (name: string, listener: (event: unknown) => void) => {
    mockSpeechListeners.set(name, listener);
  },
}));

jest.mock("../../utils/expoAvCompat", () => ({
  Audio: {
    Sound: { createAsync: jest.fn() },
  },
}));
jest.mock("../../features/custom-srs/audio-cache", () => ({
  resolveCustomVocabularyAudioForPlayback: jest.fn(async () => "file:///custom-audio.mp3"),
}));

jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  const transition = {
    duration: () => transition,
    easing: () => transition,
  };

  return {
    __esModule: true,
    default: { View },
    Easing: {
      cubic: "cubic",
      ease: "ease",
      in: () => undefined,
      out: () => undefined,
    },
    LinearTransition: transition,
    SlideInDown: transition,
    SlideOutDown: transition,
    interpolate: (
      value: number,
      inputRange: number[],
      outputRange: number[],
    ) => {
      const index = value >= inputRange[inputRange.length - 1] ? -1 : 0;
      return outputRange.at(index) ?? outputRange[0];
    },
    useAnimatedStyle: (factory: () => object) => factory(),
    useSharedValue: (value: unknown) => React.useRef({ value }).current,
    withDelay: (_delay: number, value: unknown) => value,
    withSequence: (...values: unknown[]) => values.at(-1),
    withTiming: (
      value: unknown,
      _config?: object,
      callback?: (finished: boolean) => void,
    ) => {
      callback?.(true);
      return value;
    },
  };
});

jest.mock("react-native-worklets", () => ({
  scheduleOnRN: (callback: (...args: unknown[]) => void, ...args: unknown[]) =>
    callback(...args),
}));

jest.mock("react-native-svg", () => {
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return { SvgXml: View };
});

jest.mock("../../utils/haptics", () => ({
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: {
    Error: "error",
    Success: "success",
    Warning: "warning",
  },
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
}));

jest.mock("../../utils/radicalSvg", () => ({
  pickBestImage: jest.fn(() => null),
  useRemoteSvg: jest.fn(() => null),
}));

jest.mock("../../utils/store", () => ({
  useAuthStore: () => mockAuthState,
  useSettingsStore: () => mockReadReviewSettings(),
}));

jest.mock("../../utils/subjectColors", () => ({
  getSubjectTypeColor: jest.fn(() => "#0066cc"),
}));

jest.mock("../../utils/theme", () => ({
  useTheme: () => ({
    theme: {
      backgroundColor: "#ffffff",
      border: "#dddddd",
      cardBackground: "#ffffff",
      error: "#cc0000",
      isDark: false,
      primary: "#0066cc",
      secondary: "#0066cc",
      textColor: "#111111",
      textLight: "#888888",
      textSecondary: "#666666",
    },
  }),
}));

jest.mock("../KanjiDetails", () => {
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return { __esModule: true, default: View };
});

jest.mock("../RadicalDetails", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { TouchableOpacity, Text } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    __esModule: true,
    default: ({ radical }: { radical: { onEditNote?: () => void } }) => (
      <TouchableOpacity onPress={radical.onEditNote}>
        <Text>Edit meaning note</Text>
      </TouchableOpacity>
    ),
  };
});

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

jest.mock("../VocabularyDetails", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    __esModule: true,
    default: (props: { vocabulary: { id: number } }) => {
      mockRenderedDetailSubjects.push(props.vocabulary.id);
      return React.createElement(
        Text,
        { testID: "paused-vocabulary-details" },
        `Details for ${props.vocabulary.id}`,
      );
    },
  };
});

jest.mock("../SrsLevelIcon", () => {
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return { __esModule: true, default: View };
});

jest.mock("../PitchAccentVisualization", () => {
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return { __esModule: true, default: View };
});

jest.mock("../VocabularyFrequencyBadge", () => {
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return { __esModule: true, default: View };
});

jest.mock("../TextToKanaInput", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { TextInput } =
    jest.requireActual<typeof import("react-native")>("react-native");
  const RealKanaInput =
    jest.requireActual<typeof import("../TextToKanaInput")>("../TextToKanaInput").default;

  const MockKanaInput = React.forwardRef(
    (
      props: React.ComponentProps<typeof RealKanaInput>,
      ref,
    ) => {
      const [value, setValue] = React.useState("");
      const latestValue = React.useRef("");

      React.useEffect(() => {
        latestValue.current = "";
        setValue("");
      }, [props.resetSignal]);

      React.useImperativeHandle(ref, () => ({
        clearInput: () => {
          latestValue.current = "";
          setValue("");
        },
        flushKana: () => latestValue.current,
      }));

      return (
        <TextInput
          testID="answer-input"
          value={value}
          onChangeText={(text) => {
            latestValue.current = text;
            setValue(text);
            props.onKanaChange?.(text);
          }}
          onSubmitEditing={props.onSubmitEditing}
        />
      );
    },
  );
  MockKanaInput.displayName = "MockKanaInput";
  const KanaInputHarness = React.forwardRef<
    React.ComponentRef<typeof RealKanaInput>,
    React.ComponentProps<typeof RealKanaInput>
  >((props, ref) =>
    mockUseRealKanaInput
      ? <RealKanaInput {...props} ref={ref} testID="answer-input" />
      : <MockKanaInput {...props} ref={ref} />,
  );
  KanaInputHarness.displayName = "KanaInputHarness";

  return { __esModule: true, default: KanaInputHarness };
});

const radicalItem = {
  id: 1,
  subject: {
    id: 1,
    object: "radical" as const,
    data: {
      characters: "一",
      meanings: [{ meaning: "ground", primary: true, accepted_answer: true }],
    },
  },
};

function renderQuestion(options?: {
  onAnswer?: jest.Mock;
  onSkip?: jest.Mock;
}) {
  return render(
    <ReviewQuestionScreen
      item={radicalItem}
      questionType="meaning"
      onAnswer={options?.onAnswer ?? jest.fn()}
      onSkip={options?.onSkip}
      showHeader={false}
      showBackgroundColor={false}
      totalItems={1}
      currentItem={0}
      completedCount={0}
      correctAnswersCount={0}
      isLessonFlow
    />,
  );
}

function getSubmitButton(screen: ReturnType<typeof render>) {
  return screen.UNSAFE_getAllByType(TouchableOpacity).find(
    (button) => ["arrow-forward", "chevron-forward"].includes(button.props.children?.props?.name),
  )!;
}

describe("ReviewQuestionScreen question occurrences", () => {
  beforeEach(() => {
    jest.mocked(Audio.Sound.createAsync).mockReset();
    Object.assign(mockSettings, defaultSettings);
    mockReadReviewSettings.mockClear();
    mockSpeechListeners.clear();
    mockUseRealKanaInput = false;
    mockVoicePermissionsGranted = false;
    jest.mocked(ExpoSpeechRecognitionModule.start).mockClear();
    mockAuthState.userData = { username: "Portego" };
    mockGetSubjectById.mockReset();
    mockGetSubjectById.mockResolvedValue(null);
    mockRenderedDetailSubjects.length = 0;
    mockSettings.reviewMultipleChoiceEnabled = false;
    mockSettings.setReviewMultipleChoiceEnabled.mockReset();
    mockGetAllSubjects.mockReset();
    mockGetAllSubjects.mockResolvedValue([]);
    mockSettings.allowSkippingReviews = false;
    mockSettings.ankiCardMode = false;
    mockSettings.ankiCardModeScope = "both";
    mockSettings.ankiHideAnswerCompletely = false;
    mockSettings.disableAutoProgressOnWrong = false;
    mockSettings.disableAutoProgressOnCorrect = false;
    mockSettings.showAnswerStopSubjectDetails = false;
  });

  it.each(["Cancel", "close button", "request close"])(
    "dismisses the subject picker before the review note editor through %s",
    async (dismissAction) => {
      mockSettings.disableAutoProgressOnCorrect = true;
      mockSettings.showAnswerStopSubjectDetails = true;
      const screen = renderQuestion();
      fireEvent(screen.getByTestId("answer-input"), "submitEditing", {
        nativeEvent: { text: "ground" },
      });
      await waitFor(() => expect(screen.getByText("Edit meaning note")).toBeTruthy());
      fireEvent.press(screen.getByText("Edit meaning note"));
      fireEvent.changeText(screen.getByLabelText("Meaning note text"), "My unsaved note");
      fireEvent.press(screen.getByText("Insert subject link"));
      expect(screen.getByText("Subject link picker")).toBeTruthy();

      const dismiss = () => {
        if (dismissAction === "Cancel") {
          fireEvent.press(screen.getByText("Cancel"));
        } else if (dismissAction === "close button") {
          fireEvent.press(screen.getByLabelText("Close note editor"));
        } else {
          fireEvent(screen.UNSAFE_getAllByType(Modal).find((modal) => modal.props.visible)!, "requestClose");
        }
      };
      dismiss();

      expect(screen.queryByText("Subject link picker")).toBeNull();
      expect(screen.getByLabelText("Meaning note text").props.value).toBe("My unsaved note");

      dismiss();
      expect(screen.queryByLabelText("Meaning note text")).toBeNull();
    },
  );

  it.each(["", "g"])(
    "grades the complete native submit text when the last change reported %j",
    async (lastChange) => {
      const onAnswer = jest.fn();
      const screen = renderQuestion({ onAnswer });
      const input = screen.getByTestId("answer-input");

      if (lastChange) fireEvent.changeText(input, lastChange);
      fireEvent(input, "submitEditing", { nativeEvent: { text: "ground" } });

      await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1));
      expect(onAnswer).toHaveBeenCalledWith(
        radicalItem,
        "meaning",
        true,
        false,
        false,
      );
    },
  );

  it("submits the final meaning change even when React has not rendered it yet", async () => {
    const onAnswer = jest.fn();
    const screen = renderQuestion({ onAnswer });
    const input = screen.getByTestId("answer-input");
    fireEvent.changeText(input, "g");

    act(() => {
      input.props.onChangeText("ground");
      input.props.onSubmitEditing();
    });

    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1));
    expect(onAnswer).toHaveBeenCalledWith(
      radicalItem,
      "meaning",
      true,
      false,
      false,
    );
  });

  const audioItem = {
    id: 2,
    subject: {
      id: 2,
      object: "vocabulary" as const,
      data: {
        characters: "猫",
        meanings: [{ meaning: "Cat", primary: true, accepted_answer: true }],
        readings: [{ reading: "ねこ", primary: true, accepted_answer: true }],
      },
    },
  };

  it.each([true, false])("keeps custom kana pronunciation hidden until an answer, with autoplay %s", async (autoplay) => {
    mockSettings.autoplayVocabularyAudio = autoplay;
    mockSettings.disableAutoProgressOnCorrect = true;
    mockSettings.vocabularyAudioVoice = "male"; // Existing preference logic falls back to the only available voice.
    const clip = { url: "https://audio.example/shizuka.mp3", content_type: "audio/mpeg", metadata: { gender: "female", voice_actor_name: "Shizuka", pronunciation: "やっぱり" } };
    jest.mocked(Audio.Sound.createAsync).mockResolvedValue({ sound: {
      setOnPlaybackStatusUpdate: (callback: ((status: unknown) => void) | null) => callback?.({ isLoaded: true, didJustFinish: true }),
      stopAsync: jest.fn(async () => {}), unloadAsync: jest.fn(async () => {}),
    } } as never);
    const item = {
      id: -123,
      subject: {
        id: -123, object: "kana_vocabulary" as const,
        data: { characters: "やっぱり", meanings: [{ meaning: "As Expected", primary: true, accepted_answer: true }], readings: [], pronunciation_audios: [clip] },
      },
    };
    const screen = render(<ReviewQuestionScreen item={item} questionType="meaning" onAnswer={jest.fn()} />);
    expect(screen.queryByText("Replay")).toBeNull();
    expect(Audio.Sound.createAsync).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByTestId("answer-input"), "as expected");
    fireEvent(screen.getByTestId("answer-input"), "submitEditing");
    await waitFor(() => expect(screen.getByText("Replay")).toBeTruthy());
    if (autoplay) {
      await waitFor(() => expect(Audio.Sound.createAsync).toHaveBeenCalledTimes(1));
    } else {
      expect(Audio.Sound.createAsync).not.toHaveBeenCalled();
      fireEvent.press(screen.getByText("Replay"));
      await waitFor(() => expect(Audio.Sound.createAsync).toHaveBeenCalledTimes(1));
    }
    expect(Audio.Sound.createAsync).toHaveBeenCalledWith({ uri: "file:///custom-audio.mp3" }, expect.objectContaining({ shouldPlay: true }));
  });

  function renderAudioQuestion(onAnswer = jest.fn()) {
    return render(
      <ReviewQuestionScreen
        item={audioItem}
        questionType="meaning"
        audioPrompt={<Text>Play recording</Text>}
        onAnswer={onAnswer}
        showHeader={false}
        totalItems={1}
        currentItem={0}
        completedCount={0}
        correctAnswersCount={0}
        forceDisableAnkiGrouping
      />,
    );
  }

  async function startVoiceCapture(screen: ReturnType<typeof render>) {
    mockVoicePermissionsGranted = true;
    await act(async () => {
      fireEvent.press(screen.getByText("mic"));
    });
    expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalled();
    act(() => mockSpeechListeners.get("start")?.({}));
  }

  it.each(["meaning", "reading"] as const)(
    "keeps a manually corrected voice %s answer correct when recognition delivers a late result",
    async (questionType) => {
      mockSettings.voiceReviewAnswersEnabled = true;
      mockSettings.disableAutoProgressOnWrong = true;
      mockGetAllSubjects.mockResolvedValue([audioItem.subject]);
      const onAnswer = jest.fn();
      const screen = render(
        <ReviewQuestionScreen item={audioItem} questionType={questionType} onAnswer={onAnswer} />,
      );
      await startVoiceCapture(screen);
      const wrongAnswer = questionType === "meaning" ? "sushi" : "すし";
      const lateResult = {
        isFinal: true,
        results: [{ transcript: wrongAnswer, confidence: 1 }],
      };

      await act(async () => {
        mockSpeechListeners.get("result")?.(lateResult);
      });
      expect(screen.getByText("Mark Correct")).toBeTruthy();
      expect(onAnswer).not.toHaveBeenCalled();
      fireEvent.press(screen.getByText("Mark Correct"));
      expect(onAnswer).toHaveBeenCalledWith(audioItem, questionType, true, false, false);

      // Stopping a recognizer can still deliver a final result from the old word.
      await act(async () => {
        mockSpeechListeners.get("result")?.(lateResult);
      });
      expect(screen.queryByText("Mark Correct")).toBeNull();
      expect(getSubmitButton(screen).props.children.props.name).toBe("arrow-forward");
      expect(onAnswer).toHaveBeenCalledTimes(1);

      act(() => mockSpeechListeners.get("end")?.({}));
      await startVoiceCapture(screen);
      await act(async () => {
        mockSpeechListeners.get("result")?.({
          isFinal: true,
          results: [{ transcript: questionType === "meaning" ? "cat" : "ねこ", confidence: 1 }],
        });
        mockSpeechListeners.get("end")?.({});
        await new Promise((resolve) => setTimeout(resolve, 800));
      });
      expect(onAnswer).toHaveBeenCalledTimes(2);
      expect(onAnswer).toHaveBeenLastCalledWith(audioItem, questionType, true, false, false);
      screen.unmount();
    },
  );

  describe("voice capture lifecycle", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      mockSettings.voiceReviewAnswersEnabled = true;
      mockVoicePermissionsGranted = true;
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    const result = (transcript: string, isFinal = true) => ({
      isFinal,
      results: [{ transcript, confidence: 1 }],
    });

    it("ignores recognition events without a requested capture", async () => {
      const onAnswer = jest.fn();
      const screen = renderAudioQuestion(onAnswer);
      await act(async () => {
        mockSpeechListeners.get("start")?.({});
        mockSpeechListeners.get("result")?.(result("sushi"));
      });
      expect(onAnswer).not.toHaveBeenCalled();
      expect(screen.getByText("mic")).toBeTruthy();
    });

    it("waits for the old capture to end before starting the next word", async () => {
      mockSettings.disableAutoProgressOnWrong = true;
      const onAnswer = jest.fn();
      const screen = renderAudioQuestion(onAnswer);
      await startVoiceCapture(screen);
      await act(async () => mockSpeechListeners.get("result")?.(result("sushi")));
      fireEvent.press(screen.getByText("Mark Correct"));

      await act(async () => fireEvent.press(screen.getByText("mic")));
      expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledTimes(1);
      await act(async () => {
        mockSpeechListeners.get("start")?.({});
        mockSpeechListeners.get("result")?.(result("sushi"));
        mockSpeechListeners.get("error")?.({ error: "aborted" });
      });
      expect(screen.queryByText("Mark Correct")).toBeNull();

      await act(async () => mockSpeechListeners.get("end")?.({}));
      expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledTimes(2);
      act(() => mockSpeechListeners.get("start")?.({}));
      await act(async () => {
        mockSpeechListeners.get("result")?.(result("cat"));
        mockSpeechListeners.get("end")?.({});
        jest.advanceTimersByTime(800);
      });
      expect(onAnswer).toHaveBeenCalledTimes(2);
      expect(onAnswer.mock.calls.every((call) => call[2] === true && call[3] === false)).toBe(true);
    });

    it.each([false, true])("keeps an accepted delayed answer after end (pause correct: %s)", async (pauseCorrect) => {
      mockSettings.disableAutoProgressOnCorrect = pauseCorrect;
      const onAnswer = jest.fn();
      const screen = renderAudioQuestion(onAnswer);
      await startVoiceCapture(screen);
      await act(async () => {
        mockSpeechListeners.get("result")?.(result("cat", false));
        mockSpeechListeners.get("end")?.({});
        mockSpeechListeners.get("result")?.(result("sushi"));
        jest.advanceTimersByTime(800);
      });
      if (pauseCorrect) {
        expect(onAnswer).not.toHaveBeenCalled();
        expect(StyleSheet.flatten(getSubmitButton(screen).props.style).backgroundColor).toBe("#4caf50");
        act(() => jest.advanceTimersByTime(350));
        fireEvent.press(getSubmitButton(screen));
      }
      expect(onAnswer).toHaveBeenCalledTimes(1);
      expect(onAnswer).toHaveBeenLastCalledWith(audioItem, "meaning", true, false, false);
    });

    it("cancels a delayed voice answer when a typed answer is manually corrected", async () => {
      mockSettings.disableAutoProgressOnWrong = true;
      const onAnswer = jest.fn();
      const screen = renderAudioQuestion(onAnswer);
      await startVoiceCapture(screen);
      act(() => mockSpeechListeners.get("result")?.(result("cat", false)));
      await act(async () => {
        fireEvent(screen.getByTestId("answer-input"), "submitEditing", { nativeEvent: { text: "sushi" } });
      });
      fireEvent.press(screen.getByText("Mark Correct"));
      await act(async () => jest.advanceTimersByTime(1000));
      expect(onAnswer).toHaveBeenCalledTimes(1);
      expect(onAnswer).toHaveBeenCalledWith(audioItem, "meaning", true, false, false);
      expect(getSubmitButton(screen).props.children.props.name).toBe("arrow-forward");
    });

    it("honors Mark Correct for a paused close voice answer", async () => {
      mockSettings.disableAutoProgressOnCloseAnswer = true;
      const onAnswer = jest.fn();
      const screen = renderQuestion({ onAnswer });
      await startVoiceCapture(screen);
      await act(async () => {
        mockSpeechListeners.get("result")?.(result("grounf"));
        jest.advanceTimersByTime(800);
      });
      expect(StyleSheet.flatten(getSubmitButton(screen).props.style).backgroundColor).toBe("#ff9800");
      expect(onAnswer).not.toHaveBeenCalled();
      fireEvent.press(screen.getByText("Mark Correct"));
      await act(async () => {
        mockSpeechListeners.get("result")?.(result("sushi"));
        mockSpeechListeners.get("end")?.({});
        jest.advanceTimersByTime(1000);
      });
      expect(onAnswer).toHaveBeenCalledTimes(1);
      expect(onAnswer).toHaveBeenCalledWith(radicalItem, "meaning", true, false, false);
      expect(getSubmitButton(screen).props.children.props.name).toBe("arrow-forward");
    });

    it("retries only after end, ignoring the preceding aborted error and stale results", async () => {
      const onAnswer = jest.fn();
      const screen = renderAudioQuestion(onAnswer);
      await startVoiceCapture(screen);
      act(() => mockSpeechListeners.get("result")?.(result("cat", false)));
      fireEvent.press(screen.getByText("refresh"));
      await act(async () => {
        mockSpeechListeners.get("error")?.({ error: "aborted" });
        mockSpeechListeners.get("result")?.(result("sushi"));
      });
      expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledTimes(1);
      await act(async () => mockSpeechListeners.get("end")?.({}));
      expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledTimes(2);
      act(() => mockSpeechListeners.get("start")?.({}));
      await act(async () => {
        mockSpeechListeners.get("result")?.(result("sushi"));
        jest.advanceTimersByTime(1000);
      });
      expect(onAnswer).toHaveBeenCalledTimes(1);
      expect(onAnswer).toHaveBeenCalledWith(audioItem, "meaning", false, true, false);
    });

    it.each(["question", "setting", "unmount"] as const)(
      "cancels pending voice confirmation on %s change",
      async (change) => {
        const onAnswer = jest.fn();
        const screen = renderAudioQuestion(onAnswer);
        await startVoiceCapture(screen);
        act(() => mockSpeechListeners.get("result")?.(result("cat", false)));
        if (change === "unmount") {
          screen.unmount();
        } else {
          if (change === "setting") mockSettings.voiceReviewAnswersEnabled = false;
          screen.rerender(
            <ReviewQuestionScreen item={change === "question" ? { ...audioItem, id: 3 } : audioItem} questionType="meaning" onAnswer={onAnswer} />,
          );
        }
        await act(async () => jest.advanceTimersByTime(1000));
        expect(onAnswer).not.toHaveBeenCalled();
      },
    );

    it("does not start recognition after permissions resolve for an old question", async () => {
      const onAnswer = jest.fn();
      const screen = renderAudioQuestion(onAnswer);
      await act(async () => {});
      const permissions = jest.mocked(ExpoSpeechRecognitionModule.getPermissionsAsync);
      const permissionResult = await permissions();
      let resolvePermissions!: (value: typeof permissionResult) => void;
      permissions.mockImplementationOnce(() => new Promise((resolve) => { resolvePermissions = resolve; }));
      await act(async () => fireEvent.press(screen.getByText("mic")));
      screen.rerender(<ReviewQuestionScreen item={{ ...audioItem, id: 3 }} questionType="meaning" onAnswer={onAnswer} />);
      await act(async () => resolvePermissions(permissionResult));
      expect(ExpoSpeechRecognitionModule.start).not.toHaveBeenCalled();
    });
  });

  it("grades the full native romaji snapshot through the real kana input", async () => {
    mockUseRealKanaInput = true;
    const item = {
      ...audioItem,
      subject: {
        ...audioItem.subject,
        data: {
          characters: "気分",
          meanings: [{ meaning: "feeling", primary: true, accepted_answer: true }],
          readings: [{ reading: "きぶん", primary: true, accepted_answer: true }],
        },
      },
    };
    const onAnswer = jest.fn();
    const screen = render(
      <ReviewQuestionScreen item={item} questionType="reading" onAnswer={onAnswer} />,
    );
    const input = screen.getByTestId("answer-input");
    fireEvent.changeText(input, "kib");
    fireEvent(input, "submitEditing", { nativeEvent: { text: "kibun" } });

    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1));
    expect(onAnswer).toHaveBeenCalledWith(item, "reading", true, false, false);
  });

  it("uses the native meaning snapshot through the real input in the same event batch", async () => {
    mockUseRealKanaInput = true;
    const onAnswer = jest.fn();
    const screen = renderQuestion({ onAnswer });
    const input = screen.getByTestId("answer-input");

    act(() => {
      input.props.onChangeText("g");
      input.props.onSubmitEditing({ nativeEvent: { text: "ground" } });
    });

    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1));
    expect(onAnswer).toHaveBeenCalledWith(radicalItem, "meaning", true, false, false);
  });

  it("keeps a real-input answer when submitting immediately after a question change", async () => {
    mockUseRealKanaInput = true;
    mockSettings.disableAutoProgressOnCorrect = true;
    const onAnswer = jest.fn();
    const screen = renderQuestion({ onAnswer });
    screen.rerender(
      <ReviewQuestionScreen
        item={{ ...radicalItem, id: 2 }}
        questionType="meaning"
        onAnswer={onAnswer}
      />,
    );
    const input = screen.getByTestId("answer-input");
    fireEvent.changeText(input, "g");
    fireEvent(input, "submitEditing", { nativeEvent: { text: "ground" } });

    await waitFor(() => expect(screen.getByDisplayValue("ground")).toBeTruthy());
    expect(screen.getByDisplayValue("ground").props.editable).toBe(false);
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "grades the full reading submit snapshot with automatic Japanese keyboard %s",
    async (autoSwitchKeyboard) => {
      mockSettings.autoSwitchKeyboard = autoSwitchKeyboard;
      mockGetAllSubjects.mockResolvedValue([audioItem.subject]);
      const onAnswer = jest.fn();
      const screen = render(
        <ReviewQuestionScreen item={audioItem} questionType="reading" onAnswer={onAnswer} />,
      );
      const input = screen.getByTestId("answer-input");
      fireEvent.changeText(input, "ね");
      fireEvent(input, "submitEditing", { nativeEvent: { text: "ねこ" } });

      await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1));
      expect(onAnswer).toHaveBeenCalledWith(audioItem, "reading", true, false, false);
    },
  );

  it.each([
    { questionType: "meaning", partial: "c", answer: "cat" },
    { questionType: "reading", partial: "ね", answer: "ねこ" },
  ] as const)(
    "the submit button uses the last $questionType change without waiting for a render",
    async ({ questionType, partial, answer }) => {
      mockGetAllSubjects.mockResolvedValue([audioItem.subject]);
      const onAnswer = jest.fn();
      const screen = render(
        <ReviewQuestionScreen item={audioItem} questionType={questionType} onAnswer={onAnswer} />,
      );
      const input = screen.getByTestId("answer-input");
      fireEvent.changeText(input, partial);

      act(() => {
        input.props.onChangeText(answer);
        fireEvent.press(screen.getByText("arrow-forward"));
      });

      await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1));
      expect(onAnswer).toHaveBeenCalledWith(audioItem, questionType, true, false, false);
    },
  );

  it.each([
    { setting: "disableAutoProgressOnWrong", answer: "underground", color: "#f44336" },
    { setting: "disableAutoProgressOnCorrect", answer: "ground", color: "#4caf50" },
    { setting: "disableAutoProgressOnCloseAnswer", answer: "grounf", color: "#ff9800" },
  ] as const)(
    "preserves the full submitted answer when $setting is enabled",
    async ({ setting, answer, color }) => {
      mockSettings[setting] = true;
      const onAnswer = jest.fn();
      const screen = renderQuestion({ onAnswer });
      const input = screen.getByTestId("answer-input");
      fireEvent.changeText(input, "g");
      fireEvent(input, "submitEditing", { nativeEvent: { text: answer } });

      await waitFor(() => expect(screen.getByDisplayValue(answer)).toBeTruthy());
      expect(onAnswer).not.toHaveBeenCalled();
      expect(screen.getByDisplayValue(answer).props.editable).toBe(false);
      expect(StyleSheet.flatten(getSubmitButton(screen).props.style).backgroundColor).toBe(color);
      expect(getSubmitButton(screen).props.children.props.name).toBe("chevron-forward");
    },
  );

  it.each([false, true])(
    "treats an empty native submission as empty with skipping %s despite a stale answer",
    async (allowSkippingReviews) => {
      mockSettings.allowSkippingReviews = allowSkippingReviews;
      const onAnswer = jest.fn();
      const onSkip = jest.fn();
      const screen = renderQuestion({ onAnswer, onSkip });
      const input = screen.getByTestId("answer-input");
      fireEvent.changeText(input, "ground");
      fireEvent(input, "submitEditing", { nativeEvent: { text: "" } });

      await act(async () => {});
      expect(onAnswer).not.toHaveBeenCalled();
      expect(onSkip).toHaveBeenCalledTimes(allowSkippingReviews ? 1 : 0);
    },
  );

  it("does not rerender the review screen for each typed character", async () => {
    const screen = renderQuestion();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    mockReadReviewSettings.mockClear();

    for (const text of ["g", "gr", "gro", "grou", "groun", "ground"]) {
      fireEvent.changeText(screen.getByTestId("answer-input"), text);
    }

    expect(mockReadReviewSettings).not.toHaveBeenCalled();
    expect(screen.getByTestId("answer-input").props.value).toBe("ground");
  });

  it.each(["first", "next"])(
    "keeps text entered immediately after the %s question appears",
    async (presentation) => {
      const onAnswer = jest.fn();
      const screen = renderQuestion({ onAnswer });
      if (presentation === "next") {
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
        });
        screen.rerender(
          <ReviewQuestionScreen
            item={{ ...radicalItem, id: 2 }}
            questionType="meaning"
            onAnswer={onAnswer}
          />,
        );
      }
      fireEvent.changeText(screen.getByTestId("answer-input"), "ground");

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });

      expect(screen.getByTestId("answer-input").props.value).toBe("ground");
      fireEvent.press(screen.getByText("arrow-forward"));
      await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1));
      expect(onAnswer.mock.calls[0][2]).toBe(true);
    },
  );

  it.each([false, true])(
    "honors synonym acceptance %s when the native submit contains the complete synonym",
    async (acceptUserSynonymsAsAnswers) => {
      mockSettings.acceptUserSynonymsAsAnswers = acceptUserSynonymsAsAnswers;
      const onAnswer = jest.fn();
      const screen = render(
        <ReviewQuestionScreen
          item={radicalItem}
          questionType="meaning"
          studyMaterials={{ meaning_synonyms: ["earth"] }}
          onAnswer={onAnswer}
        />,
      );
      const input = screen.getByTestId("answer-input");
      fireEvent.changeText(input, "e");
      fireEvent(input, "submitEditing", { nativeEvent: { text: "earth" } });

      await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1));
      expect(onAnswer).toHaveBeenCalledWith(
        radicalItem,
        "meaning",
        acceptUserSynonymsAsAnswers,
        !acceptUserSynonymsAsAnswers,
        false,
      );
    },
  );

  it.each([
    { answer: "cat", correct: true },
    { answer: "sushi", correct: false },
  ])("keeps the voice answer $answer separate from typed input", async ({ answer, correct }) => {
    mockSettings.voiceReviewAnswersEnabled = true;
    const onAnswer = jest.fn();
    const screen = renderAudioQuestion(onAnswer);
    await startVoiceCapture(screen);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    fireEvent.changeText(screen.getByTestId("answer-input"), "dog");

    await act(async () => {
      mockSpeechListeners.get("result")?.({
        isFinal: true,
        results: [{ transcript: answer, confidence: 1 }],
      });
      await new Promise((resolve) => setTimeout(resolve, correct ? 800 : 20));
    });

    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1));
    expect(onAnswer).toHaveBeenCalledWith(audioItem, "meaning", correct, !correct, false);
  });

  it.each(["meaning", "reading"] as const)(
    "hides the multiple choice toggle for %s questions when the setting is off",
    async (questionType) => {
      const screen = render(
        <ReviewQuestionScreen item={audioItem} questionType={questionType} onAnswer={jest.fn()} />,
      );
      expect(await screen.findByTestId("answer-input")).toBeTruthy();
      expect(screen.queryByLabelText("Use multiple choice")).toBeNull();
      expect(screen.queryByLabelText("Switch to typing")).toBeNull();
      expect(mockGetAllSubjects).not.toHaveBeenCalled();
    },
  );

  it("returns to typing when multiple choice is turned off in settings", async () => {
    mockSettings.reviewMultipleChoiceEnabled = true;
    const question = <ReviewQuestionScreen item={audioItem} questionType="reading" onAnswer={jest.fn()} />;
    const screen = render(question);
    await screen.findByRole("button", { name: /\d\. ねこ$/ });

    expect(screen.queryByLabelText("Switch to typing")).toBeNull();
    expect(screen.queryByText("Type instead")).toBeNull();
    mockSettings.reviewMultipleChoiceEnabled = false;
    screen.rerender(<ReviewQuestionScreen item={audioItem} questionType="reading" onAnswer={jest.fn()} />);

    expect(screen.getByTestId("answer-input")).toBeTruthy();
    expect(screen.queryByLabelText("Switch to typing")).toBeNull();
    expect(screen.queryByLabelText("Use multiple choice")).toBeNull();
    expect(screen.queryByRole("button", { name: /\d\. ねこ$/ })).toBeNull();
  });

  it.each([
    { questionType: "reading", answer: "がっこう", correct: true },
    { questionType: "reading", answer: "学校", correct: true },
    { questionType: "reading", answer: "ねこ", correct: false },
    { questionType: "meaning", answer: "school", correct: true },
    { questionType: "meaning", answer: "cat", correct: false },
  ] as const)(
    "preserves normal typed $questionType grading for $answer with multiple choice off",
    async ({ questionType, answer, correct }) => {
      const item = {
        ...audioItem,
        subject: {
          ...audioItem.subject,
          data: {
            characters: "学校",
            meanings: [{ meaning: "School", primary: true, accepted_answer: true }],
            readings: [{ reading: "がっこう", primary: true, accepted_answer: true }],
          },
        },
      };
      const onAnswer = jest.fn();
      const screen = render(
        <ReviewQuestionScreen
          item={item}
          questionType={questionType}
          onAnswer={onAnswer}
          acceptCharactersAsCorrectForReading
        />,
      );
      const input = await screen.findByTestId("answer-input");
      expect(mockGetAllSubjects).not.toHaveBeenCalled();
      fireEvent.changeText(input, answer);
      fireEvent(input, "submitEditing");
      await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1));
      expect(onAnswer).toHaveBeenCalledWith(item, questionType, correct, !correct, false);
    },
  );

  it.each(["meaning", "reading"] as const)(
    "keeps regular review %s questions multiple choice when kanji answers are also accepted",
    async (questionType) => {
      mockSettings.reviewMultipleChoiceEnabled = true;
      mockGetAllSubjects.mockResolvedValue(
        ["Dog", "Bird", "Horse"].map((meaning, index) => ({
          ...audioItem.subject,
          id: index + 10,
          data: {
            ...audioItem.subject.data,
            meanings: [{ meaning, primary: true, accepted_answer: true }],
          },
        })),
      );
      const onAnswer = jest.fn();
      const screen = render(
        <ReviewQuestionScreen
          item={audioItem}
          questionType={questionType}
          onAnswer={onAnswer}
          acceptCharactersAsCorrectForReading
        />,
      );
      const answer = await screen.findByRole("button", {
        name: questionType === "reading" ? /\d\. ねこ$/ : /\d\. Cat$/,
      });
      expect(screen.getAllByRole("button").filter((button) => /^\d\. /.test(button.props.accessibilityLabel))).toHaveLength(4);
      expect(screen.queryByTestId("answer-input")).toBeNull();
      fireEvent.press(answer);
      await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(audioItem, questionType, true, false, false));
    },
  );

  it.each([
    { requireSubjectCharactersForReading: true },
    { customAcceptedReadingAnswers: ["ねこ", "猫", "こねこ"] },
  ])("preserves typing for a custom reading exercise with %j", async (readingMode) => {
    mockSettings.reviewMultipleChoiceEnabled = true;
    const screen = render(
      <ReviewQuestionScreen
        item={audioItem}
        questionType="reading"
        onAnswer={jest.fn()}
        acceptCharactersAsCorrectForReading
        {...readingMode}
      />,
    );
    expect(await screen.findByTestId("answer-input")).toBeTruthy();
    expect(mockGetAllSubjects).not.toHaveBeenCalled();
  });

  it.each(["another-user", null])(
    "makes multiple choice available with a saved enabled preference for %s",
    async (username) => {
      mockAuthState.userData = username ? { username } : null;
      mockSettings.reviewMultipleChoiceEnabled = true;
      const screen = render(
        <ReviewQuestionScreen item={audioItem} questionType="reading" onAnswer={jest.fn()} />,
      );
      await screen.findByRole("button", { name: /\d\. ねこ$/ });
      expect(screen.getAllByRole("button").filter((button) => /^\d\. /.test(button.props.accessibilityLabel))).toHaveLength(4);
      expect(screen.queryByTestId("answer-input")).toBeNull();
      expect(screen.queryByLabelText("Switch to typing")).toBeNull();
    },
  );

  it("keeps multiple choice enabled when switching accounts", async () => {
    mockSettings.reviewMultipleChoiceEnabled = true;
    const question = <ReviewQuestionScreen item={audioItem} questionType="reading" onAnswer={jest.fn()} />;
    const screen = render(question);
    await screen.findByRole("button", { name: /\d\. ねこ$/ });
    mockAuthState.userData = { username: "another-user" };
    screen.rerender(<ReviewQuestionScreen item={audioItem} questionType="reading" onAnswer={jest.fn()} />);
    expect(await screen.findByRole("button", { name: /\d\. ねこ$/ })).toBeTruthy();
    expect(screen.queryByTestId("answer-input")).toBeNull();
    expect(screen.queryByLabelText("Switch to typing")).toBeNull();
    expect(mockSettings.reviewMultipleChoiceEnabled).toBe(true);
    expect(mockSettings.setReviewMultipleChoiceEnabled).not.toHaveBeenCalled();
  });

  it("submits a reading choice once and accepts the next occurrence of the same question", async () => {
    mockSettings.reviewMultipleChoiceEnabled = true;
    const onAnswer = jest.fn();
    const screen = render(<ReviewQuestionScreen item={audioItem} questionType="reading" onAnswer={onAnswer} showHeader={false} />);
    const correct = await screen.findByRole("button", { name: /\d\. ねこ$/ });
    expect(screen.queryByTestId("answer-input")).toBeNull();
    fireEvent.press(correct);
    fireEvent.press(correct);
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1));
    expect(onAnswer).toHaveBeenLastCalledWith(audioItem, "reading", true, false, false);
    const next = await screen.findByRole("button", { name: /\d\. ねこ$/ });
    await waitFor(() => expect(next.props.accessibilityState.disabled).toBe(false));
    fireEvent.press(next);
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(2));
  });

  it.each(["meaning", "reading"] as const)(
    "answers both back-to-back multiple-choice questions with %s first",
    async (firstType) => {
      mockSettings.reviewMultipleChoiceEnabled = true;
      const animals = ["Dog", "Bird", "Horse"].map((meaning, index) => ({
        ...audioItem.subject, id: index + 10,
        data: { ...audioItem.subject.data, meanings: [{ meaning, primary: true, accepted_answer: true }] },
      }));
      mockGetAllSubjects.mockResolvedValue([audioItem.subject, ...animals]);
      const items = [audioItem, { id: animals[0].id, subject: animals[0] }];
      const onAnswer = jest.fn();
      const queue = buildReviewQuestionQueue(items, {
        backToBack: true, questionTypeOrderEnabled: true, questionTypeOrder: firstType,
      });
      expect(queue.map(question => question.itemId)).toEqual([audioItem.id, audioItem.id, 10, 10]);
      function BackToBackReview() {
        const [index, setIndex] = React.useState(0);
        const question = queue[index];
        if (!question) return <Text>Session complete</Text>;
        const item = items.find(item => item.id === question.itemId)!;
        return <ReviewQuestionScreen
          item={item} questionType={question.type} currentItem={index}
          acceptCharactersAsCorrectForReading
          onAnswer={(...args) => { onAnswer(...args); setIndex(value => value + 1); }}
        />;
      }
      const screen = render(<BackToBackReview />);
      for (const question of queue) {
        const item = items.find(item => item.id === question.itemId)!;
        const name = question.type === "reading" ? /\d\. ねこ$/ : new RegExp(`\\d\\. ${item.subject.data.meanings[0].meaning}$`);
        const answer = await screen.findByRole("button", { name });
        expect(screen.queryByTestId("answer-input")).toBeNull();
        await waitFor(() => expect(answer.props.accessibilityState.disabled).toBe(false));
        fireEvent.press(answer);
        await waitFor(() => expect(onAnswer).toHaveBeenLastCalledWith(item, question.type, true, false, false));
      }
      expect(await screen.findByText("Session complete")).toBeTruthy();
      expect(onAnswer).toHaveBeenCalledTimes(4);
    },
  );

  it("counts a close reading distractor as wrong without offering a typing retry", async () => {
    mockSettings.reviewMultipleChoiceEnabled = true;
    const onAnswer = jest.fn();
    const screen = render(<ReviewQuestionScreen item={audioItem} questionType="reading" onAnswer={onAnswer} showHeader={false} />);
    await screen.findByRole("button", { name: /\d\. ねこ$/ });
    const wrong = screen.getAllByRole("button").find((button) => /^\d\. /.test(button.props.accessibilityLabel) && !button.props.accessibilityLabel.endsWith("ねこ"));
    expect(wrong).toBeDefined();
    fireEvent.press(wrong!);
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1));
    expect(onAnswer).toHaveBeenCalledWith(audioItem, "reading", false, true, false);
  });

  it("shows the existing correction actions after a wrong choice", async () => {
    mockSettings.reviewMultipleChoiceEnabled = true;
    mockSettings.disableAutoProgressOnWrong = true;
    const onAnswer = jest.fn();
    const screen = render(<ReviewQuestionScreen item={audioItem} questionType="reading" onAnswer={onAnswer} showHeader={false} />);
    await screen.findByRole("button", { name: /\d\. ねこ$/ });
    const wrong = screen.getAllByRole("button").find((button) => /^\d\. /.test(button.props.accessibilityLabel) && !button.props.accessibilityLabel.endsWith("ねこ"));
    fireEvent.press(wrong!);
    await screen.findByText("Incorrect");
    expect(onAnswer).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText("Mark Incorrect"));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(audioItem, "reading", false, true, false));
  });

  it("keeps Anki reveal controls when multiple choice is also enabled", async () => {
    mockSettings.reviewMultipleChoiceEnabled = true;
    mockSettings.ankiCardMode = true;
    const screen = renderAudioQuestion();
    expect(screen.queryByLabelText("Switch to typing")).toBeNull();
    expect(screen.queryByTestId("answer-input")).toBeNull();
    expect(mockGetAllSubjects).not.toHaveBeenCalled();
    expect(screen.getByText("Tap anywhere to see the answer")).toBeTruthy();
  });

  it("falls back to typing when meaning choices cannot be generated", async () => {
    mockSettings.reviewMultipleChoiceEnabled = true;
    const screen = renderQuestion();
    expect(await screen.findByTestId("answer-input")).toBeTruthy();
    expect(screen.getByText("Not enough distinct choices for this question. Type your answer.")).toBeTruthy();
  });

  it("submits a radical name using four choices instead of requiring typing", async () => {
    mockSettings.reviewMultipleChoiceEnabled = true;
    const gun = {
      ...radicalItem,
      subject: { ...radicalItem.subject, data: {
        characters: "𠂉", level: 1,
        meanings: [{ meaning: "Gun", primary: true, accepted_answer: true }],
      } },
    };
    mockGetAllSubjects.mockResolvedValue(["Slide", "Lid", "Barb"].map((meaning, index) => ({
      ...gun.subject, id: index + 10,
      data: { level: 1, meanings: [{ meaning, primary: true, accepted_answer: true }] },
    })));
    const onAnswer = jest.fn();
    const screen = render(<ReviewQuestionScreen item={gun} questionType="meaning" onAnswer={onAnswer} />);
    const answer = await screen.findByRole("button", { name: /\d\. Gun$/ });
    expect(screen.getAllByRole("button").filter(button => /^\d\. /.test(button.props.accessibilityLabel))).toHaveLength(4);
    expect(screen.queryByTestId("answer-input")).toBeNull();
    fireEvent.press(answer);
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(gun, "meaning", true, false, false));
  });

  it("uses the normal typed meaning answer for an audio prompt", async () => {
    const onAnswer = jest.fn();
    const screen = renderAudioQuestion(onAnswer);
    expect(screen.queryByText("猫")).toBeNull();
    expect(screen.queryByText("Cat")).toBeNull();
    const input = screen.getByTestId("answer-input");
    fireEvent.changeText(input, "cat");
    fireEvent(input, "submitEditing");
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1));
    expect(onAnswer).toHaveBeenCalledWith(
      audioItem,
      "meaning",
      true,
      false,
      false,
    );
  });

  it("opens custom vocabulary details without offering WaniKani synonym writes", async () => {
    mockSettings.disableAutoProgressOnWrong = true;
    mockSettings.showAddSynonymButton = true;
    const onViewSubjectDetails = jest.fn();
    const item = { ...audioItem, id: -123, subject: { ...audioItem.subject, id: -123 } };
    const screen = render(<ReviewQuestionScreen item={item} questionType="meaning" onAnswer={jest.fn()} onViewSubjectDetails={onViewSubjectDetails} />);
    const input = screen.getByTestId("answer-input");
    fireEvent.changeText(input, "dog");
    fireEvent(input, "submitEditing");
    await waitFor(() => expect(screen.getByText("Details")).toBeTruthy());
    expect(screen.queryByText("Synonym")).toBeNull();
    fireEvent.press(screen.getByText("Details"));
    expect(onViewSubjectDetails).toHaveBeenCalledWith(-123);
  });

  it("shows custom paused details without looking up a WaniKani subject", async () => {
    mockSettings.disableAutoProgressOnWrong = true;
    mockSettings.showAnswerStopSubjectDetails = true;
    const item = { ...audioItem, id: -123, subject: { ...audioItem.subject, id: -123 } };
    const screen = render(<ReviewQuestionScreen item={item} questionType="meaning" onAnswer={jest.fn()} />);
    const input = screen.getByTestId("answer-input");
    fireEvent.changeText(input, "dog");
    fireEvent(input, "submitEditing");
    await screen.findByText("Details for -123");
    expect(mockGetSubjectById).not.toHaveBeenCalledWith(-123);
  });

  it("does not reload paused details when the parent recreates the same question object", async () => {
    mockSettings.disableAutoProgressOnWrong = true;
    mockSettings.showAnswerStopSubjectDetails = true;
    const onAnswer = jest.fn();
    function QuestionHarness({ presentation }: { presentation: number }) {
      const [subjectId, setSubjectId] = React.useState(audioItem.subject.id);
      return (
        <ReviewQuestionScreen
          item={{
            ...audioItem,
            id: subjectId,
            subject: {
              ...audioItem.subject,
              id: subjectId,
              data: { ...audioItem.subject.data },
            },
          }}
          questionType="meaning"
          audioPrompt={<Text>Play recording {subjectId}</Text>}
          onAnswer={(...args) => {
            onAnswer(...args);
            setSubjectId(3);
          }}
          showHeader={false}
          totalItems={2}
          currentItem={subjectId === audioItem.subject.id ? 0 : 1}
          correctAnswersCount={presentation}
          forceDisableAnkiGrouping
        />
      );
    }
    const screen = render(<QuestionHarness presentation={0} />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(mockGetSubjectById).not.toHaveBeenCalled();
    const input = screen.getByTestId("answer-input");
    fireEvent.changeText(input, "dog");
    fireEvent(input, "submitEditing");
    await waitFor(() =>
      expect(screen.getByTestId("paused-vocabulary-details")).toBeTruthy(),
    );
    const loadsAtPause = mockGetSubjectById.mock.calls.length;
    expect(loadsAtPause).toBeGreaterThan(0);

    screen.rerender(<QuestionHarness presentation={1} />);
    await act(async () => {});
    expect(screen.getByTestId("paused-vocabulary-details")).toBeTruthy();
    expect(mockGetSubjectById).toHaveBeenCalledTimes(loadsAtPause);
    fireEvent.press(screen.getByText("Mark Wrong"));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("paused-vocabulary-details")).toBeNull();
    expect(screen.getByText("Play recording 3")).toBeTruthy();
    expect(mockRenderedDetailSubjects).not.toContain(3);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 120));
    });
    expect(screen.queryByTestId("paused-vocabulary-details")).toBeNull();
  });

  it("abandons an old details lookup after advancing to the next audio question", async () => {
    mockSettings.disableAutoProgressOnWrong = true;
    mockSettings.showAnswerStopSubjectDetails = true;
    let finishOldLookup: (value: unknown) => void = () => {};
    mockGetSubjectById.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOldLookup = resolve;
        }),
    );
    function QuestionHarness() {
      const [subjectId, setSubjectId] = React.useState(audioItem.subject.id);
      return (
        <ReviewQuestionScreen
          item={{
            ...audioItem,
            id: subjectId,
            subject: { ...audioItem.subject, id: subjectId },
          }}
          questionType="meaning"
          audioPrompt={<Text>Play recording {subjectId}</Text>}
          onAnswer={() => setSubjectId(3)}
          showHeader={false}
          currentItem={subjectId === audioItem.subject.id ? 0 : 1}
          forceDisableAnkiGrouping
        />
      );
    }
    const screen = render(<QuestionHarness />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    fireEvent.changeText(screen.getByTestId("answer-input"), "dog");
    fireEvent(screen.getByTestId("answer-input"), "submitEditing");
    await waitFor(() =>
      expect(screen.getByTestId("paused-vocabulary-details")).toBeTruthy(),
    );
    fireEvent.press(screen.getByText("Mark Wrong"));
    expect(screen.getByText("Play recording 3")).toBeTruthy();
    await act(async () => {
      finishOldLookup({
        ...audioItem.subject,
        data: { ...audioItem.subject.data, component_subject_ids: [9, 10, 11] },
      });
    });
    expect(mockGetSubjectById).toHaveBeenCalledTimes(1);
    expect(mockGetSubjectById).toHaveBeenCalledWith(audioItem.subject.id);
    expect(screen.queryByTestId("paused-vocabulary-details")).toBeNull();
    expect(mockRenderedDetailSubjects).not.toContain(3);
  });

  it("keeps audio meaning answers typed when Anki applies only to readings", () => {
    mockSettings.ankiCardMode = true;
    mockSettings.ankiCardModeScope = "reading";
    const screen = renderAudioQuestion();
    expect(screen.getByTestId("answer-input")).toBeTruthy();
  });

  it.each([
    [false, "sushi"],
    [true, "sushi"],
    [false, "cat"],
    [true, "cat"],
  ] as const)("reveals the reading with the meaning (details: %s, answer: %s)", async (showDetails, answer) => {
    mockSettings.showAnswerStopSubjectDetails = showDetails;
    mockSettings.disableAutoProgressOnWrong = true;
    mockSettings.disableAutoProgressOnCorrect = true;
    const screen = renderAudioQuestion();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(screen.queryByText("ねこ")).toBeNull();
    const input = screen.getByTestId("answer-input");
    fireEvent.changeText(input, answer);
    fireEvent(input, "submitEditing");
    await waitFor(() => expect(screen.getByTestId("audio-answer-reading").props.children).toBe("ねこ"));
    expect(screen.getByText("Cat")).toBeTruthy();
  });

  it("uses the existing reveal and correct/wrong controls when meaning Anki mode is on", async () => {
    mockSettings.ankiCardMode = true;
    mockSettings.ankiHideAnswerCompletely = true;
    const onAnswer = jest.fn();
    const screen = renderAudioQuestion(onAnswer);
    expect(screen.queryByTestId("answer-input")).toBeNull();
    expect(screen.queryByText("Cat")).toBeNull();
    expect(screen.queryByText("ねこ")).toBeNull();
    fireEvent.press(screen.getByText("Tap anywhere to see the answer"));
    expect(screen.getByText("Cat")).toBeTruthy();
    expect(screen.getByTestId("audio-answer-reading").props.children).toBe("ねこ");
    expect(screen.getByText("Wrong")).toBeTruthy();
    fireEvent.press(screen.getByText("Correct"));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1));
  });

  it("accepts an identical question again after a terminal wrong answer", async () => {
    const onAnswer = jest.fn();
    const screen = renderQuestion({ onAnswer });
    const input = screen.getByTestId("answer-input");

    fireEvent.changeText(input, "wrong");
    fireEvent(input, "submitEditing");
    fireEvent(input, "submitEditing");

    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1));
    expect(onAnswer).toHaveBeenLastCalledWith(
      radicalItem,
      "meaning",
      false,
      true,
      false,
    );

    fireEvent.changeText(screen.getByTestId("answer-input"), "ground");
    fireEvent(screen.getByTestId("answer-input"), "submitEditing");

    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(2));
    expect(onAnswer).toHaveBeenLastCalledWith(
      radicalItem,
      "meaning",
      true,
      false,
      false,
    );

    screen.unmount();
  });

  it.each([
    { questionType: "meaning", earlierPausedWrong: false },
    { questionType: "meaning", earlierPausedWrong: true },
    { questionType: "reading", earlierPausedWrong: false },
    { questionType: "reading", earlierPausedWrong: true },
  ] as const)(
    "keeps the next submit button neutral after a correct $questionType answer (earlier paused wrong: $earlierPausedWrong)",
    async ({ questionType, earlierPausedWrong }) => {
      jest.useFakeTimers();
      mockSettings.disableAutoProgressOnWrong = true;
      const onAnswer = jest.fn();
      const item = questionType === "meaning" ? radicalItem : audioItem;
      const answer = questionType === "meaning" ? "ground" : "ねこ";
      const wrongAnswer = questionType === "meaning" ? "sushi" : "すし";
      const screen = render(<ReviewQuestionScreen item={item} questionType={questionType} onAnswer={onAnswer} />);
      const submitButton = () => getSubmitButton(screen);
      const neutralColor = StyleSheet.flatten(submitButton().props.style).backgroundColor;

      try {
        if (earlierPausedWrong) {
          await act(async () => {
            fireEvent(screen.getByTestId("answer-input"), "submitEditing", { nativeEvent: { text: wrongAnswer } });
          });
          act(() => jest.advanceTimersByTime(350));
          expect(StyleSheet.flatten(submitButton().props.style).backgroundColor).toBe("#f44336");
          fireEvent.press(screen.getByText("Mark Incorrect"));
          expect(onAnswer).toHaveBeenLastCalledWith(item, questionType, false, true, false);
        }

        await act(async () => {
          fireEvent(screen.getByTestId("answer-input"), "submitEditing", { nativeEvent: { text: answer } });
        });
        expect(onAnswer).toHaveBeenLastCalledWith(item, questionType, true, false, false);
        expect(StyleSheet.flatten(submitButton().props.style).backgroundColor).toBe(neutralColor);

        // Feedback from the previous answer must not mark the new question as
        // answered after its synchronous reset has already run.
        act(() => jest.advanceTimersByTime(1000));
        expect(StyleSheet.flatten(submitButton().props.style).backgroundColor).toBe(neutralColor);
        expect(submitButton().props.children.props.name).toBe("arrow-forward");

        // Enter must still grade the new answer, even before an onChange callback.
        const answerCount = onAnswer.mock.calls.length;
        await act(async () => {
          fireEvent(screen.getByTestId("answer-input"), "submitEditing", { nativeEvent: { text: answer } });
        });
        expect(onAnswer).toHaveBeenCalledTimes(answerCount + 1);
      } finally {
        screen.unmount();
        jest.clearAllTimers();
        jest.useRealTimers();
      }
    },
  );

  it("advances a sole skipped question once per presentation", async () => {
    mockSettings.allowSkippingReviews = true;
    const onSkip = jest.fn();
    const screen = renderQuestion({ onSkip });
    const input = screen.getByTestId("answer-input");
    const submitFirstOccurrence = input.props.onSubmitEditing;

    act(() => {
      submitFirstOccurrence();
      submitFirstOccurrence();
    });

    await waitFor(() => expect(onSkip).toHaveBeenCalledTimes(1));

    fireEvent(screen.getByTestId("answer-input"), "submitEditing");

    await waitFor(() => expect(onSkip).toHaveBeenCalledTimes(2));
    screen.unmount();
  });
});
