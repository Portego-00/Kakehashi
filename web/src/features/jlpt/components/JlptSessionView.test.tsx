import "@testing-library/jest-dom/vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createJlptSession } from "../engine";
import { N5_QUESTIONS } from "../questions/n5";
import type { JlptQuestion, JlptSession } from "../types";
import { JlptSessionView } from "./JlptSessionView";

const voiceMock = vi.hoisted(() => ({
  checked: true,
  supported: true,
  downloaded: true,
  activity: "idle" as "idle" | "downloading" | "synthesizing" | "playing",
  activeSentence: null as string | null,
  progress: null as number | null,
  message: null as string | null,
  error: null as string | null,
  download: vi.fn(),
  cancelDownload: vi.fn(),
  play: vi.fn(),
  stop: vi.fn(),
}));

const feedbackAudioMock = vi.hoisted(() => ({
  playAnswerFeedback: vi.fn(),
}));

vi.mock("@/features/speech/use-japanese-voice", () => ({
  useJapaneseVoice: () => voiceMock,
}));

vi.mock("@/features/study/feedback-audio", () => feedbackAudioMock);

vi.mock("@/features/content/JapaneseReader", () => ({
  JapaneseReader: ({
    text,
    tokenDecoration,
  }: {
    text: string;
    tokenDecoration?: string;
  }) => (
    <span
      data-testid="practice-japanese-reader"
      data-token-decoration={tokenDecoration}
    >
      {text}
    </span>
  ),
}));

const speech = {
  cancel: vi.fn(),
  speak: vi.fn(),
};

class MockUtterance {
  lang = "";
  rate = 1;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

function focusedSession(
  question: JlptQuestion,
  mode: "quick" | "mock" = "quick",
  immediateFeedback = true,
) {
  const created = createJlptSession({
    level: "N5",
    mode,
    questions: N5_QUESTIONS,
    immediateFeedback,
    now: new Date(),
  });
  return {
    ...created,
    sectionQuestionIds: [[question.id]],
    currentSectionIndex: 0,
    currentQuestionIndex: 0,
  };
}

function Harness({
  initial,
  bank = N5_QUESTIONS,
  onExit = vi.fn(),
  onQuestionAnswered,
  answerFeedbackSoundEnabled = true,
}: {
  initial: JlptSession;
  bank?: readonly JlptQuestion[];
  onExit?: () => void;
  onQuestionAnswered?: (question: JlptQuestion) => void;
  answerFeedbackSoundEnabled?: boolean;
}) {
  const [session, setSession] = useState(initial);
  return (
    <JlptSessionView
      session={session}
      questions={bank}
      onSessionChange={setSession}
      onQuestionAnswered={onQuestionAnswered}
      onPauseAndExit={onExit}
      answerFeedbackSoundEnabled={answerFeedbackSoundEnabled}
    />
  );
}

describe("JLPT testing interface", () => {
  beforeEach(() => {
    Object.assign(voiceMock, {
      checked: true,
      supported: true,
      downloaded: true,
      activity: "idle",
      activeSentence: null,
      progress: null,
      message: null,
      error: null,
    });
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: speech,
    });
    speech.cancel.mockClear();
    speech.speak.mockClear();
    voiceMock.download.mockReset();
    voiceMock.cancelDownload.mockReset();
    voiceMock.play.mockReset();
    voiceMock.stop.mockReset();
    feedbackAudioMock.playAnswerFeedback.mockReset();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("shows immediate explanation in a quick quiz", () => {
    const question = N5_QUESTIONS.find(
      (item) => item.id === "n5-kanji-mainichi",
    )!;
    render(<Harness initial={focusedSession(question)} />);
    fireEvent.click(screen.getByRole("button", { name: /2\s*まいばん/ }));
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
    expect(screen.getByText("Not quite")).toBeInTheDocument();
    expect(screen.getByText(/毎朝 is read まいあさ/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /1\s*まいあさ/ }),
    ).toHaveAttribute("data-correct", "true");
  });

  it("plays answer feedback when immediate feedback and the sound setting are enabled", () => {
    const question = N5_QUESTIONS.find(
      (item) => item.id === "n5-kanji-mainichi",
    )!;
    render(<Harness initial={focusedSession(question)} />);

    fireEvent.click(screen.getByRole("button", { name: /2\s*まいばん/ }));
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));

    expect(feedbackAudioMock.playAnswerFeedback).toHaveBeenCalledOnce();
    expect(feedbackAudioMock.playAnswerFeedback).toHaveBeenCalledWith(false);
  });

  it.each([
    {
      label: "the sound setting is disabled",
      immediateFeedback: true,
      answerFeedbackSoundEnabled: false,
    },
    {
      label: "immediate feedback is disabled",
      immediateFeedback: false,
      answerFeedbackSoundEnabled: true,
    },
  ])(
    "keeps answer feedback silent when $label",
    ({ immediateFeedback, answerFeedbackSoundEnabled }) => {
      const question = N5_QUESTIONS.find(
        (item) => item.id === "n5-kanji-mainichi",
      )!;
      render(
        <Harness
          initial={focusedSession(question, "quick", immediateFeedback)}
          answerFeedbackSoundEnabled={answerFeedbackSoundEnabled}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: /1\s*まいあさ/ }));
      fireEvent.click(screen.getByRole("button", { name: "Check answer" }));

      expect(feedbackAudioMock.playAnswerFeedback).not.toHaveBeenCalled();
    },
  );

  it("never plays answer feedback during a mock exam", () => {
    const question = N5_QUESTIONS.find(
      (item) => item.id === "n5-kanji-mainichi",
    )!;
    const mockSession = {
      ...focusedSession(question, "mock"),
      immediateFeedback: true,
    };
    render(<Harness initial={mockSession} />);

    fireEvent.click(screen.getByRole("button", { name: /1\s*まいあさ/ }));
    fireEvent.click(screen.getByRole("button", { name: "Record answer" }));

    expect(feedbackAudioMock.playAnswerFeedback).not.toHaveBeenCalled();
  });

  it("advances no-repeat history only after the learner answers", () => {
    const question = N5_QUESTIONS.find(
      (item) => item.id === "n5-kanji-mainichi",
    )!;
    const onQuestionAnswered = vi.fn();
    render(
      <Harness
        initial={focusedSession(question)}
        onQuestionAnswered={onQuestionAnswered}
      />,
    );

    expect(onQuestionAnswered).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /1\s*まいあさ/ }));
    expect(onQuestionAnswered).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));

    expect(onQuestionAnswered).toHaveBeenCalledOnce();
    expect(onQuestionAnswered).toHaveBeenCalledWith(question);
  });

  it("records a mock answer without revealing correctness", () => {
    const question = N5_QUESTIONS.find(
      (item) => item.id === "n5-kanji-mainichi",
    )!;
    render(<Harness initial={focusedSession(question, "mock")} />);
    fireEvent.click(screen.getByRole("button", { name: /1\s*まいあさ/ }));
    fireEvent.click(screen.getByRole("button", { name: "Record answer" }));
    expect(screen.getByText(/Answer recorded/)).toBeInTheDocument();
    expect(screen.queryByText("Correct")).not.toBeInTheDocument();
    expect(screen.queryByText(question.explanation)).not.toBeInTheDocument();
  });

  it("supports desktop number and Enter shortcuts", () => {
    const question = N5_QUESTIONS.find(
      (item) => item.id === "n5-kanji-mainichi",
    )!;
    render(<Harness initial={focusedSession(question)} />);
    fireEvent.keyDown(window, { key: "1", code: "Digit1" });
    expect(
      screen.getByRole("button", { name: /1\s*まいあさ/ }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(window, { key: "Enter", code: "Enter" });
    expect(screen.getByText("Correct")).toBeInTheDocument();
  });

  it("lets practice users assemble every fragment in a sentence-composition question", () => {
    const question = N5_QUESTIONS.find(
      (item) => item.id === "n5-composition-school",
    )!;
    render(<Harness initial={focusedSession(question)} />);

    fireEvent.click(screen.getByRole("button", { name: /毎日/u }));
    fireEvent.click(screen.getByRole("button", { name: /学校/u }));
    fireEvent.click(screen.getByRole("button", { name: /3で/u }));
    fireEvent.click(screen.getByRole("button", { name: /日本語を/u }));

    const order = screen.getByRole("list", { name: "Your sentence order" });
    expect(
      within(order)
        .getAllByRole("button")
        .map((item) => item.textContent),
    ).toEqual(["毎日", "学校", "で", "日本語を"]);
    expect(screen.getByRole("button", { name: "Check answer" })).toBeEnabled();
  });

  it("requires the complete sentence order in mock mode without revealing correctness", () => {
    const question = N5_QUESTIONS.find(
      (item) => item.id === "n5-composition-school",
    )!;
    render(<Harness initial={focusedSession(question, "mock")} />);

    expect(
      screen.getByRole("list", { name: "Your sentence order" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Record answer" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /1毎日/u }));
    fireEvent.click(screen.getByRole("button", { name: /2学校/u }));
    fireEvent.click(screen.getByRole("button", { name: /3で/u }));
    fireEvent.click(screen.getByRole("button", { name: /4日本語を/u }));
    expect(screen.getByRole("button", { name: "Record answer" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Record answer" }));

    expect(screen.getByText(/Answer recorded/)).toBeInTheDocument();
    expect(screen.queryByText("Correct")).not.toBeInTheDocument();
    expect(screen.queryByText(question.explanation)).not.toBeInTheDocument();
  });

  it("makes practice sentences inspectable without decorating answer choices", async () => {
    const question = N5_QUESTIONS.find(
      (item) => item.id === "n5-reading-note",
    )!;
    render(<Harness initial={focusedSession(question)} />);

    const readers = await screen.findAllByTestId("practice-japanese-reader");
    expect(readers).toHaveLength(2);
    expect(
      readers.every(
        (reader) => reader.getAttribute("data-token-decoration") === "plain",
      ),
    ).toBe(true);
    expect(
      within(
        screen.getByRole("group", { name: "Answer choices" }),
      ).queryByTestId("practice-japanese-reader"),
    ).not.toBeInTheDocument();
  });

  it("keeps word inspection out of strict mock questions", () => {
    const question = N5_QUESTIONS.find(
      (item) => item.id === "n5-reading-note",
    )!;
    render(<Harness initial={focusedSession(question, "mock")} />);
    expect(
      screen.queryByTestId("practice-japanese-reader"),
    ).not.toBeInTheDocument();
  });

  it("identifies the position of a grouped text-grammar blank", () => {
    const source = N5_QUESTIONS.find(
      (item) => item.officialType === "text-grammar",
    )!;
    const group = [1, 2].map(
      (blankOrder): JlptQuestion => ({
        ...source,
        id: `grouped-text-grammar-${blankOrder}`,
        passage: {
          body: `同じ文章の空所${blankOrder}です。`,
          groupId: "grouped-passage",
          blankId: `blank-${blankOrder}`,
          blankOrder,
        },
      }),
    );
    const initial = {
      ...focusedSession(group[0], "mock"),
      sectionQuestionIds: [[group[0].id, group[1].id]],
    };

    render(<Harness initial={initial} bank={group} />);

    expect(screen.getByText("Passage blank 1 of 2")).toBeInTheDocument();
  });

  it("identifies a question within a shared reading passage without calling it a blank", () => {
    const source = N5_QUESTIONS.find(
      (item) => item.officialType === "reading-mid",
    )!;
    const group = [1, 2].map(
      (groupQuestionIndex): JlptQuestion => ({
        ...source,
        id: `grouped-reading-${groupQuestionIndex}`,
        passage: {
          body: "二つの問題で使う同じ文章です。",
          groupId: "grouped-reading-passage",
          groupQuestionIndex,
        },
      }),
    );
    const initial = {
      ...focusedSession(group[0], "mock"),
      sectionQuestionIds: [[group[0].id, group[1].id]],
    };

    render(<Harness initial={initial} bank={group} />);

    expect(screen.getByText("Passage question 1 of 2")).toBeInTheDocument();
    expect(screen.queryByText(/Passage blank/u)).not.toBeInTheDocument();
  });

  it("enforces one listening play in mock mode", () => {
    const question = N5_QUESTIONS.find(
      (item) => item.id === "n5-listening-cafe",
    )!;
    render(<Harness initial={focusedSession(question, "mock")} />);
    expect(
      screen.getByRole("heading", {
        name: "Listen to the situation and question, then the passage.",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(question.stem)).not.toBeInTheDocument();
    expect(
      screen.getByText("One forward item play · stimulus heard once"),
    ).toBeInTheDocument();
    const play = screen.getByRole("button", { name: "Play audio" });
    fireEvent.click(play);
    expect(voiceMock.play).toHaveBeenCalledWith(
      "男の人は何を買いますか。　飲み物は何にしますか。　コーヒーはきのう飲みました。きょうは暑いですね。冷たいお茶をください。　男の人は何を買いますか。",
      { speed: 0.82 },
    );
    expect(speech.speak).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Audio played" })).toBeDisabled();
    expect(screen.getByText("1/1")).toBeInTheDocument();
  });

  it("keeps key-point question text audio-only in strict mock mode", () => {
    const question = N5_QUESTIONS.find(
      (item) => item.officialType === "listening-key-points",
    )!;
    render(<Harness initial={focusedSession(question, "mock")} />);

    expect(
      screen.getByRole("heading", {
        name: "Listen to the situation and question, then the passage.",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(question.stem)).not.toBeInTheDocument();
    expect(
      within(
        screen.getByRole("group", { name: "Answer choices" }),
      ).getAllByRole("button"),
    ).toHaveLength(4);
  });

  it("does not pronounce inline speaker labels in neural-voice dialogue", () => {
    const source = N5_QUESTIONS.find(
      (item) => item.id === "n5-listening-cafe",
    )!;
    const question: JlptQuestion = {
      ...source,
      id: "inline-speaker-labels",
      listening: {
        ...source.listening!,
        script:
          "女：資料はできましたか。男：はい。先ほど送りました。ナレーション：二人は会社で話しています。",
      },
    };
    render(
      <Harness initial={focusedSession(question, "mock")} bank={[question]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Play audio" }));

    expect(voiceMock.play).toHaveBeenCalledWith(
      `${question.stem}　資料はできましたか。はい。先ほど送りました。二人は会社で話しています。　${question.stem}`,
      { speed: source.listening!.rate },
    );
  });

  it("presents verbal expressions as an illustration followed by one audio-only three-choice sequence", () => {
    const question = N5_QUESTIONS.find(
      (item) => item.id === "n5-generated-listening-verbal-001",
    )!;
    render(<Harness initial={focusedSession(question, "mock")} />);

    expect(
      screen.getByRole("heading", {
        name: "Look at the illustration and listen.",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(question.stem)).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /points to a shirt/i }),
    ).toBeInTheDocument();
    const choices = screen.getByRole("group", { name: "Answer choices" });
    expect(within(choices).getAllByRole("button")).toHaveLength(3);
    expect(
      within(choices).getByRole("button", { name: /1\s*Choice 1/ }),
    ).toBeInTheDocument();
    expect(
      within(choices).queryByText("あのシャツを見せてください"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Play audio" }));
    expect(voiceMock.play).toHaveBeenCalledWith(
      question.listening!.script.replace(/\n+/g, "　"),
      { speed: question.listening!.rate },
    );
  });

  it("allows two explicit practice plays of the same complete verbal-expression sequence", () => {
    const question = N5_QUESTIONS.find(
      (item) => item.id === "n5-generated-listening-verbal-001",
    )!;
    render(<Harness initial={focusedSession(question)} />);

    fireEvent.click(screen.getByRole("button", { name: "Play audio" }));
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));

    expect(voiceMock.play).toHaveBeenCalledTimes(2);
    expect(voiceMock.play.mock.calls[1]).toEqual(voiceMock.play.mock.calls[0]);
    expect(screen.getByRole("button", { name: "Audio played" })).toBeDisabled();
    expect(screen.getByText("2/2")).toBeInTheDocument();
  });

  it("does not render a scene illustration for other listening families", () => {
    const question = N5_QUESTIONS.find(
      (item) => item.id === "n5-listening-cafe",
    )!;
    render(<Harness initial={focusedSession(question, "mock")} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("withholds outline prompts and spoken choices from the visible test paper", () => {
    const source = N5_QUESTIONS.find(
      (item) => item.id === "n5-listening-cafe",
    )!;
    const question: JlptQuestion = {
      ...source,
      id: "listening-outline-regression",
      officialType: "listening-outline",
      stem: "話し手が最も伝えたいことは何ですか。",
      listening: {
        ...source.listening!,
        audioOnlyOptions: true,
        script:
          "短い話です。\n話し手が最も伝えたいことは何ですか。\n一、最初の答え\n二、二番目の答え\n三、三番目の答え\n四、四番目の答え",
      },
      options: [
        { id: "1", label: "最初の答え" },
        { id: "2", label: "二番目の答え" },
        { id: "3", label: "三番目の答え" },
        { id: "4", label: "四番目の答え" },
      ],
      correctOptionId: "1",
    };
    render(
      <Harness initial={focusedSession(question, "mock")} bank={[question]} />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Listen for the question after the passage.",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(question.stem)).not.toBeInTheDocument();
    const choices = screen.getByRole("group", { name: "Answer choices" });
    expect(
      within(choices).getByRole("button", { name: /1\s*Choice 1/ }),
    ).toBeInTheDocument();
    expect(within(choices).queryByText("最初の答え")).not.toBeInTheDocument();
  });

  it("offers the shared Japanese voice download without consuming a listening play", () => {
    Object.assign(voiceMock, { downloaded: false });
    const question = N5_QUESTIONS.find(
      (item) => item.id === "n5-listening-cafe",
    )!;
    render(<Harness initial={focusedSession(question, "mock")} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Download voice · about 400 MB" }),
    );

    expect(voiceMock.download).toHaveBeenCalledOnce();
    expect(voiceMock.play).not.toHaveBeenCalled();
    expect(screen.getByText("0/1")).toBeInTheDocument();
  });

  it("never exposes a mock listening transcript when the web voice fails", () => {
    Object.assign(voiceMock, { error: "The voice model could not start." });
    const question = N5_QUESTIONS.find(
      (item) => item.id === "n5-listening-cafe",
    )!;
    render(<Harness initial={focusedSession(question, "mock")} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("The voice model could not start.");
    expect(alert).toHaveTextContent("transcript remains hidden until review");
    expect(alert).not.toHaveTextContent(question.listening!.script);
  });

  it("releases a failed mock synthesis so the one allowed play can be retried", async () => {
    voiceMock.play.mockResolvedValueOnce(false);
    const question = N5_QUESTIONS.find(
      (item) => item.id === "n5-listening-cafe",
    )!;
    render(<Harness initial={focusedSession(question, "mock")} />);

    fireEvent.click(screen.getByRole("button", { name: "Play audio" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Play audio" })).toBeEnabled(),
    );
    expect(screen.getByText("0/1")).toBeInTheDocument();
  });

  it("confirms pause and explains the practice accommodation", () => {
    const onExit = vi.fn();
    const question = N5_QUESTIONS[0];
    render(<Harness initial={focusedSession(question)} onExit={onExit} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause and exit" }));
    expect(
      screen.getByRole("dialog", { name: "Pause this session?" }),
    ).toHaveTextContent("official JLPT does not allow pausing");
    fireEvent.click(screen.getByRole("button", { name: "Pause & exit" }));
    expect(onExit).toHaveBeenCalledOnce();
  });
});
