import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";

import ReviewQuestionScreen from "../ReviewQuestionScreen";

const mockGetSubjectById = jest.fn<Promise<unknown>, [number]>(
  async () => null,
);
const mockRenderedDetailSubjects: number[] = [];
const mockGetAllSubjects = jest.fn(async (): Promise<unknown[]> => []);

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
    getPermissionsAsync: jest.fn(async () => ({ granted: false })),
    requestPermissionsAsync: jest.fn(async () => ({ granted: false })),
    start: jest.fn(),
    stop: jest.fn(),
  },
  useSpeechRecognitionEvent: jest.fn(),
}));

jest.mock("../../utils/expoAvCompat", () => ({
  Audio: {
    Sound: { createAsync: jest.fn() },
  },
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
  useSettingsStore: () => mockSettings,
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
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return { __esModule: true, default: View };
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

  const MockKanaInput = React.forwardRef(
    (
      props: {
        onKanaChange: (text: string) => void;
        onSubmitEditing: () => void;
        resetSignal: string;
      },
      ref,
    ) => {
      const [value, setValue] = React.useState("");

      React.useEffect(() => {
        setValue("");
      }, [props.resetSignal]);

      React.useImperativeHandle(ref, () => ({
        clearInput: () => setValue(""),
        flushKana: () => value,
      }));

      return (
        <TextInput
          testID="answer-input"
          value={value}
          onChangeText={(text) => {
            setValue(text);
            props.onKanaChange(text);
          }}
          onSubmitEditing={props.onSubmitEditing}
        />
      );
    },
  );
  MockKanaInput.displayName = "MockKanaInput";

  return { __esModule: true, default: MockKanaInput };
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

describe("ReviewQuestionScreen question occurrences", () => {
  beforeEach(() => {
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
