/* eslint-disable @typescript-eslint/no-require-imports -- Jest mock factories are hoisted and must load their runtime dependencies locally. */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  act,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react-native";
import React from "react";
import { Alert, Dimensions, StyleSheet } from "react-native";
import { azureSpeechService } from "../../../utils/azureSpeech";
import {
  createJlptSession,
  JLPT_BANK_VERSION,
  loadJlptQuestionBank,
  pauseJlptSession,
  type JlptQuestion,
  type JlptSession,
} from "../domain";
import { JlptHubScreen } from "../jlpt-hub-screen";
import { JlptResults } from "../jlpt-results";
import { JlptSessionScreen } from "../jlpt-session-screen";
import { jlptNativeHistoryKey, jlptNativeSessionKey } from "../storage";

const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockSearchParams: Record<string, string> = {};

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock("react-native-safe-area-context", () => {
  const mockReact = require("react");
  const MockView = require("react-native").View;
  return {
    SafeAreaView: ({ children, ...props }: any) =>
      mockReact.createElement(MockView, props, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock("@expo/vector-icons", () => {
  const mockReact = require("react");
  const MockText = require("react-native").Text;
  return {
    Ionicons: ({ name }: { name: string }) =>
      mockReact.createElement(MockText, null, name),
  };
});

jest.mock("../../../utils/store", () => ({
  useAuthStore: (selector: (state: { userData: null }) => unknown) =>
    selector({ userData: null }),
}));

jest.mock("@react-navigation/native", () => {
  const mockReact = require("react");
  return {
    useFocusEffect: (callback: () => void | (() => void)) =>
      mockReact.useEffect(callback, [callback]),
  };
});

jest.mock("../../../../src/hooks/useActivityTracking", () => ({
  useActivityTracking: jest.fn(),
}));

jest.mock("../inspectable-japanese-text", () => ({
  InspectableJapaneseText: ({ text }: { text: string }) => {
    const mockReact = require("react");
    const MockText = require("react-native").Text;
    return mockReact.createElement(
      MockText,
      { testID: "practice-japanese-inspector" },
      text,
    );
  },
}));

jest.mock("../../../utils/cache", () => ({
  getAllSubjects: jest.fn(() => Promise.resolve([])),
}));

jest.mock("../../../utils/permanentStorage", () => ({
  getAssignmentsFromPermanentStorage: jest.fn(() => Promise.resolve([])),
}));

jest.mock("../../../utils/haptics", () => ({
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: "success", Error: "error" },
}));

jest.mock("../domain", () => {
  const actual = jest.requireActual("../domain");
  return { ...actual, loadJlptQuestionBank: jest.fn() };
});

jest.mock("../../../utils/azureSpeech", () => ({
  azureSpeechService: {
    speak: jest.fn(async (_text, onStart, onEnd) => {
      onStart?.();
      onEnd?.();
    }),
    stop: jest.fn(() => Promise.resolve()),
  },
}));

const orderQuestion: JlptQuestion = {
  id: "n5-order-mobile",
  level: "N5",
  skill: "grammar",
  officialType: "sentence-composition",
  instruction: "Put the four parts in order.",
  stem: "わたしは　＿＿　＿＿　★　＿＿　勉強します。",
  options: [
    { id: "1", label: "毎日" },
    { id: "2", label: "学校" },
    { id: "3", label: "で" },
    { id: "4", label: "日本語を" },
  ],
  correctOptionId: "3",
  sentenceComposition: {
    canonicalOrderOptionIds: ["1", "2", "3", "4"],
    starredPosition: 2,
  },
  explanation: "毎日 学校で 日本語を 勉強します is the only natural order.",
};

const listeningQuestion: JlptQuestion = {
  id: "n5-listening-mobile",
  level: "N5",
  skill: "listening",
  officialType: "listening-key-points",
  instruction: "Listen and choose.",
  stem: "何曜日ですか。",
  listening: {
    script: "男の人：火曜日です。\n女の人：今月から木曜日です。",
    maxPlays: 2,
    rate: 0.82,
  },
  options: [
    { id: "1", label: "火曜日" },
    { id: "2", label: "木曜日" },
  ],
  correctOptionId: "2",
  explanation: "今月から木曜日です says Thursday.",
};

const readingQuestion: JlptQuestion = {
  id: "n5-reading-mobile",
  level: "N5",
  skill: "reading",
  officialType: "reading-short",
  instruction: "Read and choose.",
  stem: "まりさんは何時に来ますか。",
  passage: { body: "まりさんは三時に図書館へ来ます。" },
  options: [
    { id: "1", label: "二時" },
    { id: "2", label: "三時" },
  ],
  correctOptionId: "2",
  explanation: "三時に来ます is stated directly.",
};

const verbalQuestion: JlptQuestion = {
  id: "n5-verbal-mobile",
  level: "N5",
  skill: "listening",
  officialType: "listening-verbal",
  instruction: "Look and listen.",
  stem: "何と言いますか。",
  listening: {
    script:
      "一、これを見せてください。\n二、これを着てください。\n三、これを洗ってください。",
    maxPlays: 2,
    rate: 0.82,
    audioOnlyOptions: true,
    verbalScene: {
      setting: "shop",
      speaker: { side: "left", pose: "pointing" },
      partner: { side: "right", pose: "neutral" },
      prop: { kind: "shirt", position: "center" },
      description:
        "A customer points to a shirt while speaking to a shop clerk",
    },
  },
  options: [
    { id: "1", label: "これを見せてください。" },
    { id: "2", label: "これを着てください。" },
    { id: "3", label: "これを洗ってください。" },
  ],
  correctOptionId: "1",
  explanation:
    "Pointing to merchandise makes 見せてください the appropriate request.",
};

function mockSavedSession(session: JlptSession) {
  (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
    Promise.resolve(
      key === jlptNativeSessionKey("anonymous")
        ? JSON.stringify(session)
        : null,
    ),
  );
}

describe("JLPT mobile UI", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = {};
    Dimensions.set({
      window: { width: 320, height: 640, scale: 2, fontScale: 1 },
      screen: { width: 320, height: 640, scale: 2, fontScale: 1 },
    });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  it("keeps all five level choices usable at 320px and gives selection a solid high-contrast fill", async () => {
    const screen = render(<JlptHubScreen />);
    await waitFor(() => expect(screen.getByTestId("jlpt-hub")).toBeTruthy());

    const levels = ["N5", "N4", "N3", "N2", "N1"].map((level) =>
      screen.getByTestId(`jlpt-level-${level}`),
    );
    expect(levels).toHaveLength(5);
    levels.forEach((level) => {
      const flattened = StyleSheet.flatten(level.props.style);
      expect(flattened.flex).toBe(1);
      expect(flattened.minWidth).toBe(0);
    });
    expect(StyleSheet.flatten(levels[0].props.style).backgroundColor).toBe(
      "#3A86FF",
    );
    expect(screen.queryByText("Elementary")).toBeNull();

    fireEvent.press(screen.getByTestId("jlpt-start-quick"));
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/jlpt-session" }),
    );
  });

  it("lets practice users build all four sentence-order positions before submitting", async () => {
    const active = createJlptSession({
      level: "N5",
      mode: "quick",
      questions: [orderQuestion],
      random: () => 0,
    });
    mockSavedSession(pauseJlptSession(active));
    (loadJlptQuestionBank as jest.Mock).mockResolvedValue([orderQuestion]);
    mockSearchParams = { resume: "true" };

    const screen = render(<JlptSessionScreen />);
    await waitFor(() =>
      expect(screen.getByTestId("jlpt-option-1")).toBeTruthy(),
    );
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(
      jlptNativeHistoryKey("anonymous"),
      expect.any(String),
    );
    expect(screen.getByText("Overall 0/1 answered")).toBeTruthy();
    expect(
      screen.getByTestId("jlpt-submit").props.accessibilityState.disabled,
    ).toBe(true);

    fireEvent.press(screen.getByTestId("jlpt-option-1"));
    fireEvent.press(screen.getByTestId("jlpt-option-2"));
    fireEvent.press(screen.getByTestId("jlpt-option-3"));
    fireEvent.press(screen.getByTestId("jlpt-option-4"));

    expect(
      within(screen.getByTestId("jlpt-composition-slot-0")).getByText("毎日"),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId("jlpt-composition-slot-3")).getByText(
        "日本語を",
      ),
    ).toBeTruthy();
    expect(
      screen.getByTestId("jlpt-submit").props.accessibilityState.disabled,
    ).toBe(false);

    fireEvent.press(screen.getByTestId("jlpt-submit"));
    await waitFor(() => expect(screen.getByText("Correct")).toBeTruthy());
    await waitFor(() =>
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        jlptNativeHistoryKey("anonymous"),
        expect.stringContaining(orderQuestion.id),
      ),
    );
    expect(screen.getByText(/only natural order/)).toBeTruthy();
  });

  it("requires all four sentence fragments in mock mode and keeps correctness hidden", async () => {
    const created = createJlptSession({
      level: "N5",
      mode: "quick",
      questions: [orderQuestion],
      random: () => 0,
    });
    const mock = {
      ...created,
      mode: "mock" as const,
      immediateFeedback: false,
      remainingSeconds: 20 * 60,
      deadlineAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
    };
    mockSavedSession(pauseJlptSession(mock));
    (loadJlptQuestionBank as jest.Mock).mockResolvedValue([orderQuestion]);
    mockSearchParams = { resume: "true" };

    const screen = render(<JlptSessionScreen />);
    await waitFor(() =>
      expect(screen.getByTestId("jlpt-option-1")).toBeTruthy(),
    );
    expect(
      screen.getByTestId("jlpt-submit").props.accessibilityState.disabled,
    ).toBe(true);
    fireEvent.press(screen.getByTestId("jlpt-option-1"));
    fireEvent.press(screen.getByTestId("jlpt-option-2"));
    fireEvent.press(screen.getByTestId("jlpt-option-3"));
    fireEvent.press(screen.getByTestId("jlpt-option-4"));
    expect(
      screen.getByTestId("jlpt-submit").props.accessibilityState.disabled,
    ).toBe(false);

    fireEvent.press(screen.getByTestId("jlpt-submit"));
    await waitFor(() => expect(screen.getByText("See results")).toBeTruthy());
    expect(screen.queryByText("Correct")).toBeNull();
    expect(screen.queryByText(orderQuestion.explanation)).toBeNull();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      jlptNativeSessionKey("anonymous"),
      expect.stringContaining('"selectedOrderOptionIds":["1","2","3","4"]'),
    );
  });

  it("offers word inspection only for practice passage and stem text, never answers or mock", async () => {
    const active = createJlptSession({
      level: "N5",
      mode: "quick",
      questions: [readingQuestion],
      random: () => 0,
    });
    mockSavedSession(pauseJlptSession(active));
    (loadJlptQuestionBank as jest.Mock).mockResolvedValue([readingQuestion]);
    mockSearchParams = { resume: "true" };

    const practice = render(<JlptSessionScreen />);
    await waitFor(() =>
      expect(
        practice.getAllByTestId("practice-japanese-inspector"),
      ).toHaveLength(2),
    );
    expect(
      within(practice.getByTestId("jlpt-option-1")).queryByTestId(
        "practice-japanese-inspector",
      ),
    ).toBeNull();
    practice.unmount();

    jest.clearAllMocks();
    const mock = {
      ...active,
      mode: "mock" as const,
      immediateFeedback: false,
      remainingSeconds: 20 * 60,
      deadlineAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
    };
    mockSavedSession(pauseJlptSession(mock));
    (loadJlptQuestionBank as jest.Mock).mockResolvedValue([readingQuestion]);
    const strict = render(<JlptSessionScreen />);
    await waitFor(() =>
      expect(strict.getByTestId("jlpt-option-1")).toBeTruthy(),
    );
    expect(strict.queryByTestId("practice-japanese-inspector")).toBeNull();
  });

  it("uses the context-sentence Azure voice and enforces two practice plays", async () => {
    const active = createJlptSession({
      level: "N5",
      mode: "quick",
      questions: [listeningQuestion],
      random: () => 0,
    });
    mockSavedSession(pauseJlptSession(active));
    (loadJlptQuestionBank as jest.Mock).mockResolvedValue([listeningQuestion]);
    mockSearchParams = { resume: "true" };

    const screen = render(<JlptSessionScreen />);
    const play = await screen.findByText("Play audio");
    fireEvent.press(play);
    await waitFor(() => expect(screen.getByText("Play again")).toBeTruthy());
    fireEvent.press(screen.getByText("Play again"));
    await waitFor(() => expect(screen.getByText("Audio played")).toBeTruthy());

    expect(azureSpeechService.speak).toHaveBeenCalledTimes(2);
    expect(azureSpeechService.speak).toHaveBeenCalledWith(
      expect.stringContaining("何曜日ですか。"),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      { speedMultiplier: 0.82 },
    );
  });

  it("plays the complete question-stimulus-question sequence once in mock mode", async () => {
    const created = createJlptSession({
      level: "N5",
      mode: "quick",
      questions: [listeningQuestion],
      random: () => 0,
    });
    const mock = {
      ...created,
      mode: "mock" as const,
      immediateFeedback: false,
      remainingSeconds: 20 * 60,
      deadlineAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
    };
    mockSavedSession(pauseJlptSession(mock));
    (loadJlptQuestionBank as jest.Mock).mockResolvedValue([listeningQuestion]);
    mockSearchParams = { resume: "true" };

    const screen = render(<JlptSessionScreen />);
    expect(
      await screen.findByText(
        "Listen to the situation and question, then the passage.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(listeningQuestion.stem)).toBeNull();
    fireEvent.press(screen.getByText("Play audio"));
    await waitFor(() => expect(screen.getByText("Audio played")).toBeTruthy());

    expect(azureSpeechService.speak).toHaveBeenCalledTimes(1);
    expect(azureSpeechService.speak).toHaveBeenCalledWith(
      "何曜日ですか。　火曜日です。　今月から木曜日です。　何曜日ですか。",
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      { speedMultiplier: 0.82 },
    );
  });

  it("releases a failed mobile mock play so the learner can retry", async () => {
    (azureSpeechService.speak as jest.Mock).mockImplementationOnce(
      async (_text, onStart, _onEnd, onError) => {
        onStart?.();
        onError?.(new Error("synthetic failure"));
      },
    );
    const created = createJlptSession({
      level: "N5",
      mode: "quick",
      questions: [listeningQuestion],
      random: () => 0,
    });
    const mock = {
      ...created,
      mode: "mock" as const,
      immediateFeedback: false,
      remainingSeconds: 20 * 60,
      deadlineAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
    };
    mockSavedSession(pauseJlptSession(mock));
    (loadJlptQuestionBank as jest.Mock).mockResolvedValue([listeningQuestion]);
    mockSearchParams = { resume: "true" };

    const screen = render(<JlptSessionScreen />);
    fireEvent.press(await screen.findByText("Play audio"));
    await waitFor(() =>
      expect(
        screen.getByText(
          "Audio could not be played. Check your connection and try again.",
        ),
      ).toBeTruthy(),
    );
    expect(screen.getByText("Play audio")).toBeTruthy();
    expect(screen.getByText("0/1")).toBeTruthy();
  });

  it("expires a timed mock on resume and locks the completed section", async () => {
    const expired: JlptSession = {
      version: 1,
      bankVersion: JLPT_BANK_VERSION,
      id: "expired-mock",
      level: "N5",
      mode: "mock",
      status: "active",
      immediateFeedback: false,
      sectionQuestionIds: [[orderQuestion.id], [], []],
      currentSectionIndex: 0,
      currentQuestionIndex: 0,
      answers: [],
      listeningPlays: {},
      deadlineAt: new Date(Date.now() - 5_000).toISOString(),
      remainingSeconds: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockSavedSession(expired);
    (loadJlptQuestionBank as jest.Mock).mockResolvedValue([orderQuestion]);
    mockSearchParams = { resume: "true" };

    const screen = render(<JlptSessionScreen />);
    expect(await screen.findByText("Vocabulary complete")).toBeTruthy();
    expect(screen.getByText(/answers are locked/i)).toBeTruthy();
  });

  it("offers save-or-discard exit behavior and persists the paused attempt", async () => {
    const alert = jest
      .spyOn(Alert, "alert")
      .mockImplementation(() => undefined);
    const active = createJlptSession({
      level: "N5",
      mode: "quick",
      questions: [readingQuestion],
      random: () => 0,
    });
    mockSavedSession(pauseJlptSession(active));
    (loadJlptQuestionBank as jest.Mock).mockResolvedValue([readingQuestion]);
    mockSearchParams = { resume: "true" };

    const screen = render(<JlptSessionScreen />);
    fireEvent.press(await screen.findByLabelText("Pause and exit"));
    expect(alert).toHaveBeenCalledWith(
      "Leave JLPT session?",
      "You can save your place or discard this attempt.",
      expect.any(Array),
    );
    const buttons = alert.mock.calls[0][2]!;
    const continueLater = buttons.find(
      (button) => button.text === "Continue Later",
    )!;
    await act(async () => continueLater.onPress?.());

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      jlptNativeSessionKey("anonymous"),
      expect.stringContaining('"status":"paused"'),
    );
    expect(mockReplace).toHaveBeenCalledWith("/jlpt");
  });

  it("renders directional results, weak-area action, and every missed explanation", async () => {
    const active = createJlptSession({
      level: "N5",
      mode: "quick",
      questions: [orderQuestion],
      random: () => 0,
    });
    const complete: JlptSession = {
      ...active,
      status: "complete",
      answers: [
        {
          questionId: orderQuestion.id,
          selectedOptionId: "1",
          selectedOrderOptionIds: ["2", "1", "3", "4"],
          correct: false,
          answeredAt: new Date().toISOString(),
        },
      ],
    };
    const practice = jest.fn();
    const screen = render(
      <JlptResults
        session={complete}
        questions={[orderQuestion]}
        onPracticeWeakAreas={practice}
        onReturn={jest.fn()}
      />,
    );

    expect(screen.getAllByText("0%").length).toBeGreaterThan(0);
    expect(screen.getByText(/directional sample/i)).toBeTruthy();
    expect(screen.getByText("Skills")).toBeTruthy();
    expect(screen.getByText("JLPT scoring sections")).toBeTruthy();
    expect(screen.getByText("Question types")).toBeTruthy();
    expect(screen.getByText("Missed question review")).toBeTruthy();
    expect(screen.getByText(/only natural order/)).toBeTruthy();
    fireEvent.press(screen.getByText("Practice weak areas"));
    expect(practice).toHaveBeenCalledWith(["grammar"]);
  });

  it("restores the verbal scene, transcript, and spoken answer labels in missed review", () => {
    const active = createJlptSession({
      level: "N5",
      mode: "quick",
      questions: [verbalQuestion],
      random: () => 0,
    });
    const complete: JlptSession = {
      ...active,
      status: "complete",
      answers: [
        {
          questionId: verbalQuestion.id,
          selectedOptionId: "2",
          correct: false,
          answeredAt: new Date().toISOString(),
        },
      ],
    };
    const screen = render(
      <JlptResults
        session={complete}
        questions={[verbalQuestion]}
        onPracticeWeakAreas={jest.fn()}
        onReturn={jest.fn()}
      />,
    );

    expect(screen.getByLabelText(/customer points to a shirt/i)).toBeTruthy();
    expect(screen.getByText("LISTENING TRANSCRIPT")).toBeTruthy();
    expect(screen.getByText("これを着てください。")).toBeTruthy();
    expect(screen.getByText("これを見せてください。")).toBeTruthy();
    expect(screen.queryByText("Choice 1")).toBeNull();
  });
});
