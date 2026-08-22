import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";

import ReviewQuestionScreen from "../ReviewQuestionScreen";

const mockSettings = {
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
  const { Text } = jest.requireActual<typeof import("react-native")>(
    "react-native",
  );

  return {
    Ionicons: ({ name }: { name: string }) =>
      React.createElement(Text, null, name),
  };
});

jest.mock("expo-blur", () => {
  const { View } = jest.requireActual<typeof import("react-native")>(
    "react-native",
  );
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
  const { View } = jest.requireActual<typeof import("react-native")>(
    "react-native",
  );
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
    useSharedValue: (value: unknown) => ({ value }),
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
  const { View } = jest.requireActual<typeof import("react-native")>(
    "react-native",
  );
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
  useAuthStore: () => ({ apiToken: null, userData: null }),
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
  const { View } = jest.requireActual<typeof import("react-native")>(
    "react-native",
  );
  return { __esModule: true, default: View };
});

jest.mock("../RadicalDetails", () => {
  const { View } = jest.requireActual<typeof import("react-native")>(
    "react-native",
  );
  return { __esModule: true, default: View };
});

jest.mock("../VocabularyDetails", () => {
  const { View } = jest.requireActual<typeof import("react-native")>(
    "react-native",
  );
  return { __esModule: true, default: View };
});

jest.mock("../SrsLevelIcon", () => {
  const { View } = jest.requireActual<typeof import("react-native")>(
    "react-native",
  );
  return { __esModule: true, default: View };
});

jest.mock("../PitchAccentVisualization", () => {
  const { View } = jest.requireActual<typeof import("react-native")>(
    "react-native",
  );
  return { __esModule: true, default: View };
});

jest.mock("../VocabularyFrequencyBadge", () => {
  const { View } = jest.requireActual<typeof import("react-native")>(
    "react-native",
  );
  return { __esModule: true, default: View };
});

jest.mock("../TextToKanaInput", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { TextInput } = jest.requireActual<typeof import("react-native")>(
    "react-native",
  );

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
      meanings: [
        { meaning: "ground", primary: true, accepted_answer: true },
      ],
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
    mockSettings.allowSkippingReviews = false;
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
