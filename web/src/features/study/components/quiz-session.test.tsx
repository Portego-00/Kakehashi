import "@testing-library/jest-dom/vitest";
import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Subject } from "@/types/wanikani";
import type { StudyQuestion, StudySession } from "../types";
import { itemDetailsTabForQuestion, promptTypePresentation, QuizSession } from "./quiz-session";

function makeQuestion(overrides: Partial<StudyQuestion> = {}): StudyQuestion {
  return {
    id: "question-1",
    subjectId: 1,
    subjectType: "vocabulary",
    kind: "reading",
    prompt: "防ぐ",
    promptLabel: "Vocabulary reading",
    acceptedAnswers: ["ふせぐ"],
    displayAnswer: "ふせぐ",
    ...overrides,
  };
}

function makeSession(question: StudyQuestion): StudySession {
  return {
    version: 1,
    id: "session-1",
    mode: "vocab-reading",
    createdAt: "2026-08-17T00:00:00.000Z",
    updatedAt: "2026-08-17T00:00:00.000Z",
    currentIndex: 0,
    questions: [question],
    answers: [],
    complete: false,
  };
}

function makeSubject(): Subject {
  return {
    id: 1,
    object: "vocabulary",
    url: "",
    data_updated_at: "2026-08-17T00:00:00.000Z",
    data: {
      level: 12,
      created_at: "2026-08-17T00:00:00.000Z",
      slug: "防ぐ",
      document_url: "https://www.wanikani.com/vocabulary/%E9%98%B2%E3%81%90",
      hidden_at: null,
      characters: "防ぐ",
      meanings: [{ meaning: "Prevent", primary: true, accepted_answer: true }],
      auxiliary_meanings: [],
      meaning_mnemonic: "Put up a shield to prevent trouble from reaching you.",
      readings: [{ reading: "ふせぐ", primary: true, accepted_answer: true }],
      reading_mnemonic: "Picture a fuse stopping the trouble before it arrives.",
      context_sentences: [{ ja: "事故を防ぐ。", en: "Prevent an accident." }],
      parts_of_speech: ["transitive verb", "godan verb"],
    },
  };
}

describe("extra-study quiz interaction", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("puts the differentiated question type on the answer control", () => {
    expect(promptTypePresentation(makeQuestion())).toEqual({ label: "Reading", tone: "reading" });
    expect(promptTypePresentation(makeQuestion({ kind: "meaning" }))).toEqual({ label: "Meaning", tone: "meaning" });

    render(<QuizSession scope="test" initialSession={makeSession(makeQuestion())} onExit={vi.fn()} onRestartMistakes={vi.fn()} />);

    const input = screen.getByLabelText(/Vocabulary Reading/);
    expect(input).toBeInTheDocument();
    expect(input.closest("section")).toHaveAttribute("data-type", "vocabulary");
    expect(screen.getByRole("heading", { name: "防ぐ" })).not.toHaveTextContent("Reading");
  });

  it("marks context sentence prompts separately from regular review prompts", () => {
    const contextQuestion = makeQuestion({
      kind: "context",
      prompt: "今回の＿＿を活かして、次回はもっと上手くやれるようにしたいと思います。",
      promptLabel: "Type the missing vocabulary",
    });
    const { unmount } = render(
      <QuizSession
        scope="test"
        initialSession={{ ...makeSession(contextQuestion), mode: "context-sentences" }}
        onExit={vi.fn()}
        onRestartMistakes={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: contextQuestion.prompt })).toHaveAttribute("data-question-kind", "context");

    unmount();
    render(<QuizSession scope="test" initialSession={makeSession(makeQuestion())} onExit={vi.fn()} onRestartMistakes={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "防ぐ" })).toHaveAttribute("data-question-kind", "reading");
  });

  it("shows direct-submit number shortcuts for unanswered multiple-choice questions", () => {
    const contextQuestion = makeQuestion({
      kind: "context",
      prompt: "今回の＿＿を活かしたいと思います。",
      promptLabel: "Restore the missing vocabulary",
      acceptedAnswers: ["教訓"],
      displayAnswer: "教訓",
      choices: ["感染", "苦しむ", "教訓", "眉"],
    });
    render(
      <QuizSession
        scope="test"
        initialSession={{ ...makeSession(contextQuestion), mode: "context-sentences" }}
        keyboardShortcuts
        onExit={vi.fn()}
        onRestartMistakes={vi.fn()}
      />,
    );

    expect(screen.getByText(/to answer/)).toHaveTextContent("Press 1–4 to answer");
    expect(screen.queryByText(/to check/)).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "3" });
    expect(screen.getByText(/to continue/)).toHaveTextContent("Press Enter to continue");
  });

  it("converts romaji live and uses a compact, explicit incorrect state", () => {
    render(<QuizSession scope="test" initialSession={makeSession(makeQuestion())} onExit={vi.fn()} onRestartMistakes={vi.fn()} />);

    const input = screen.getByLabelText(/Vocabulary Reading/);
    fireEvent.change(input, { target: { value: "bougu" } });
    expect(input).toHaveValue("ぼうぐ");

    fireEvent.change(input, { target: { value: "neko" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(screen.getByText("Incorrect")).toBeInTheDocument();
    expect(screen.getByText("Correct answer")).toBeInTheDocument();
    expect(screen.getByText("ふせぐ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("shows item details automatically after an answer when the preference is enabled", () => {
    render(<QuizSession scope="test" initialSession={makeSession(makeQuestion())} subjects={[makeSubject()]} showDetailsAtAnswerStops keyboardShortcuts onExit={vi.fn()} onRestartMistakes={vi.fn()} />);

    const input = screen.getByLabelText(/Vocabulary Reading/);
    fireEvent.change(input, { target: { value: "fusegu" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(screen.getByRole("heading", { name: "Item details" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Reading" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("ふせぐ", { exact: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Meaning" }));
    expect(screen.getByText("Prevent", { exact: true })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open full details" })).toHaveAttribute("href", "/subjects/1");
    expect(screen.getByRole("link", { name: "Open full details" })).toHaveAttribute("target", "_blank");
    expect(screen.queryByText("Romaji converts to hiragana as you type.")).not.toBeInTheDocument();
  });

  it("defaults details to the section that matches the current question", () => {
    expect(itemDetailsTabForQuestion(makeQuestion({ kind: "reading" }))).toBe("reading");
    expect(itemDetailsTabForQuestion(makeQuestion({ kind: "meaning" }))).toBe("meaning");
    expect(itemDetailsTabForQuestion(makeQuestion({ kind: "context" }))).toBe("context");

    const meaningQuestion = makeQuestion({ kind: "meaning", acceptedAnswers: ["Prevent"], displayAnswer: "Prevent" });
    render(<QuizSession scope="test" initialSession={makeSession(meaningQuestion)} subjects={[makeSubject()]} showDetailsAtAnswerStops onExit={vi.fn()} onRestartMistakes={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Vocabulary Meaning/), { target: { value: "Prevent" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(screen.getByRole("tab", { name: "Meaning" })).toHaveAttribute("aria-selected", "true");
  });

  it("scrolls smoothly when details expand", async () => {
    const previousScrollIntoView = Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView");
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });
    const previousMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });

    try {
      render(<QuizSession scope="test" initialSession={makeSession(makeQuestion())} subjects={[makeSubject()]} showDetailsAtAnswerStops onExit={vi.fn()} onRestartMistakes={vi.fn()} />);
      fireEvent.change(screen.getByLabelText(/Vocabulary Reading/), { target: { value: "fusegu" } });
      fireEvent.click(screen.getByRole("button", { name: "Check" }));

      await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" }));
    } finally {
      if (previousScrollIntoView) Object.defineProperty(Element.prototype, "scrollIntoView", previousScrollIntoView);
      else delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
      window.matchMedia = previousMatchMedia;
    }
  });

  it("keeps answered item details behind a button and D shortcut when automatic details are off", () => {
    render(<QuizSession scope="test" initialSession={makeSession(makeQuestion())} subjects={[makeSubject()]} showDetailsAtAnswerStops={false} keyboardShortcuts onExit={vi.fn()} onRestartMistakes={vi.fn()} />);

    const input = screen.getByLabelText(/Vocabulary Reading/);
    fireEvent.change(input, { target: { value: "fusegu" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(screen.queryByRole("heading", { name: "Item details" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Show item details/ })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByRole("heading", { name: "Item details" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.queryByRole("heading", { name: "Item details" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Show item details/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("reports paired custom-review prompts as study items", () => {
    const questions = Array.from({ length: 5 }, (_, index) => [
      makeQuestion({ id: `${index + 1}:meaning`, subjectId: index + 1, kind: "meaning" }),
      makeQuestion({ id: `${index + 1}:reading`, subjectId: index + 1, kind: "reading" }),
    ]).flat();
    const session = { ...makeSession(questions[0]), mode: "custom-review" as const, questions };

    render(<QuizSession scope="test" initialSession={session} onExit={vi.fn()} onRestartMistakes={vi.fn()} />);

    expect(screen.getByText("1 / 5")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "5");
  });

  function makeListeningQuestion(overrides: Partial<StudyQuestion> = {}): StudyQuestion {
    return makeQuestion({
      kind: "listening-characters",
      prompt: "＿＿が好きです。",
      promptLabel: "Vocabulary · Sword Art Online",
      acceptedAnswers: ["猫"],
      displayAnswer: "猫",
      choices: ["猫", "犬"],
      characters: "猫",
      sentence: { ja: "猫が好きです。", en: "I like cats.", masked: "＿＿が好きです。" },
      audioUrl: "https://example.com/listening.mp3",
      imageUrl: "https://example.com/scene.jpg",
      sourceTitle: "Sword Art Online",
      autoPlayAudio: true,
      ...overrides,
    });
  }

  it("shows the listening scene and masked sentence before submission", () => {
    const listeningQuestion = makeListeningQuestion({ autoPlayAudio: false });

    render(<StrictMode><QuizSession scope="test" initialSession={{ ...makeSession(listeningQuestion), mode: "listening" }} onExit={vi.fn()} onRestartMistakes={vi.fn()} /></StrictMode>);

    expect(screen.getByRole("img", { name: "Scene from Sword Art Online" })).toBeVisible();
    expect(screen.getByText("＿＿が好きです。", { exact: true })).toBeVisible();
    expect(screen.getByText("猫が好きです。", { exact: true })).toHaveAttribute("data-visible", "false");
  });

  it("autoplays a listening clip once and replays it once per explicit action", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const listeningQuestion = makeListeningQuestion();

    render(<StrictMode><QuizSession scope="test" initialSession={{ ...makeSession(listeningQuestion), mode: "listening" }} onExit={vi.fn()} onRestartMistakes={vi.fn()} /></StrictMode>);

    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));

    const replay = screen.getByRole("button", { name: /replay listening clip/i });
    expect(within(replay).getByText("R", { exact: true })).toBeInTheDocument();
    fireEvent.click(replay);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("transitions correct feedback into the selected listening answer card", () => {
    const listeningQuestion = makeListeningQuestion({ autoPlayAudio: false });

    render(<QuizSession scope="test" initialSession={{ ...makeSession(listeningQuestion), mode: "listening" }} onExit={vi.fn()} onRestartMistakes={vi.fn()} />);

    const selected = screen.getByRole("button", { name: /猫/ });
    fireEvent.click(selected);
    expect(selected).toHaveAttribute("data-result", "correct");
    expect(within(selected).getByText("Correct", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText("Correct", { selector: "[role='status']" })).not.toBeInTheDocument();
  });

  it("plays distinct confirmation and error cues when answers are submitted", () => {
    const sources: string[] = [];
    const play = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("Audio", class {
      volume = 1;
      constructor(source?: string) { sources.push(source ?? ""); }
      play = play;
    });

    const question = makeListeningQuestion({ autoPlayAudio: false });
    const { unmount } = render(<QuizSession scope="test" initialSession={{ ...makeSession(question), mode: "listening" }} onExit={vi.fn()} onRestartMistakes={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /猫/ }));
    unmount();

    render(<QuizSession scope="test" initialSession={{ ...makeSession(question), id: "session-2", mode: "listening" }} onExit={vi.fn()} onRestartMistakes={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /犬/ }));

    expect(play).toHaveBeenCalledTimes(2);
    expect(sources[0]).toMatch(/^data:audio\/ogg;base64,/);
    expect(sources[1]).toMatch(/^data:audio\/ogg;base64,/);
    expect(sources[0]).not.toBe(sources[1]);
  });

  it("keeps the listening scene and answer grid structure stable when feedback appears", () => {
    const listeningQuestion = makeListeningQuestion({ autoPlayAudio: false });

    const { container } = render(<QuizSession scope="test" initialSession={{ ...makeSession(listeningQuestion), mode: "listening" }} showListeningTranslation onExit={vi.fn()} onRestartMistakes={vi.fn()} />);

    const translation = screen.getByText("I like cats.", { exact: true });
    const reveal = screen.getByRole("button", { name: "Show translation" });
    const resultSlots = Array.from(container.querySelectorAll("[data-choice-result]"));
    const actionSlot = container.querySelector("[data-choice-actions]");
    expect(translation).toHaveAttribute("data-visible", "false");
    expect(resultSlots).toHaveLength(2);
    expect(actionSlot).toHaveAttribute("data-visible", "false");

    fireEvent.click(screen.getByRole("button", { name: /猫/ }));

    expect(screen.getByText("I like cats.", { exact: true })).toBe(translation);
    expect(translation).toHaveAttribute("data-visible", "false");
    expect(reveal).toBeVisible();
    expect(Array.from(container.querySelectorAll("[data-choice-result]"))).toEqual(resultSlots);
    expect(container.querySelector("[data-choice-actions]")).toBe(actionSlot);
    expect(actionSlot).toHaveAttribute("data-visible", "true");

    fireEvent.click(reveal);
    expect(translation).toHaveAttribute("data-visible", "true");
    expect(screen.getByRole("button", { name: "Hide translation" })).toBeInTheDocument();
  });

  it("honors the listening translation visibility preference", () => {
    const listeningQuestion = makeListeningQuestion({ autoPlayAudio: false });

    render(<QuizSession scope="test" initialSession={{ ...makeSession(listeningQuestion), mode: "listening" }} showListeningTranslation={false} onExit={vi.fn()} onRestartMistakes={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /猫/ }));

    expect(screen.queryByText("I like cats.", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show translation" })).not.toBeInTheDocument();
  });

  it("keeps the last completed subject available throughout both phases of the next subject", () => {
    const catCharacters = makeListeningQuestion({ id: "cat:characters", subjectId: 1, autoPlayAudio: false });
    const catMeaning = makeListeningQuestion({ id: "cat:meaning", subjectId: 1, kind: "listening-meaning", choices: ["Cat", "Dog"], acceptedAnswers: ["Cat"], displayAnswer: "Cat", autoPlayAudio: false });
    const dogCharacters = makeListeningQuestion({ id: "dog:characters", subjectId: 2, characters: "犬", choices: ["犬", "猫"], acceptedAnswers: ["犬"], displayAnswer: "犬", autoPlayAudio: false });
    const dogMeaning = makeListeningQuestion({ id: "dog:meaning", subjectId: 2, kind: "listening-meaning", characters: "犬", choices: ["Dog", "Cat"], acceptedAnswers: ["Dog"], displayAnswer: "Dog", autoPlayAudio: false });
    const answers = [
      { questionId: catCharacters.id, value: "猫", correct: true, answeredAt: "2026-08-17T00:01:00.000Z" },
      { questionId: catMeaning.id, value: "Cat", correct: true, answeredAt: "2026-08-17T00:02:00.000Z" },
      { questionId: dogCharacters.id, value: "犬", correct: true, answeredAt: "2026-08-17T00:03:00.000Z" },
    ];
    const session = { ...makeSession(catCharacters), mode: "listening" as const, questions: [catCharacters, catMeaning, dogCharacters, dogMeaning], answers, currentIndex: 3 };
    const previousSubject = makeSubject();
    previousSubject.data.characters = "猫";
    previousSubject.data.slug = "猫";

    render(<QuizSession scope="test" initialSession={session} subjects={[previousSubject]} onExit={vi.fn()} onRestartMistakes={vi.fn()} />);

    expect(screen.getByRole("link", { name: "Previous subject: 猫" })).toHaveAttribute("href", "/subjects/1");
    expect(screen.getByRole("link", { name: "Previous subject: 猫" })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "Previous subject: 猫" }).parentElement).toBe(screen.getByRole("link", { name: "Previous subject: 猫" }).closest("section"));
    expect(screen.getByRole("img", { name: "Scene from Sword Art Online" }).parentElement).not.toContainElement(screen.getByRole("link", { name: "Previous subject: 猫" }));
  });

  it("keeps the requested listening total steady while clips stream, then falls back to the available total", () => {
    const question = makeListeningQuestion({ autoPlayAudio: false });
    const session = { ...makeSession(question), mode: "listening" as const };
    const props = { scope: "test" as const, initialSession: session, expectedSubjectCount: 10, onExit: vi.fn(), onRestartMistakes: vi.fn() };
    const { rerender } = render(<QuizSession {...props} loadingMore />);

    expect(screen.getByText("1 / 10")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "10");

    rerender(<QuizSession {...props} loadingMore={false} />);
    expect(screen.getByText("1 / 1")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "1");
  });

  it("summarizes listening responses by subject with scene playback and detail access", () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const characters = makeListeningQuestion({ id: "cat:characters", autoPlayAudio: false });
    const meaning = makeListeningQuestion({ id: "cat:meaning", kind: "listening-meaning", choices: ["Cat", "Dog"], acceptedAnswers: ["Cat"], displayAnswer: "Cat", autoPlayAudio: false });
    const subject = makeSubject();
    subject.data.characters = "猫";
    subject.data.slug = "猫";
    subject.data.meanings = [{ meaning: "Cat", primary: true, accepted_answer: true }];
    const session: StudySession = {
      ...makeSession(characters),
      mode: "listening",
      questions: [characters, meaning],
      answers: [
        { questionId: characters.id, value: "猫", correct: true, answeredAt: "2026-08-17T00:01:00.000Z" },
        { questionId: meaning.id, value: "Dog", correct: false, answeredAt: "2026-08-17T00:02:00.000Z" },
      ],
      currentIndex: 2,
      complete: true,
    };

    render(<QuizSession scope="test" initialSession={session} subjects={[subject]} onExit={vi.fn()} onRestartMistakes={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Session results" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Response review" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "猫 responses" })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Vocabulary 猫 猫 Correct/ })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Meaning Dog Cat Incorrect/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Scene from Sword Art Online" })).toBeVisible();
    expect(screen.getByText("猫が好きです。", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("I like cats.", { exact: true })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open 猫 subject details" })).toHaveAttribute("href", "/subjects/1");
    expect(screen.getByRole("link", { name: "Open 猫 subject details" })).toHaveAttribute("target", "_blank");

    fireEvent.click(screen.getByRole("button", { name: "Replay audio for 猫" }));
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("uses the same response review for non-listening extra-study quizzes", () => {
    const question = makeQuestion();
    const session: StudySession = {
      ...makeSession(question),
      answers: [{ questionId: question.id, value: "ぼうぐ", correct: false, answeredAt: "2026-08-17T00:01:00.000Z" }],
      currentIndex: 1,
      complete: true,
    };

    render(<QuizSession scope="test" initialSession={session} subjects={[makeSubject()]} onExit={vi.fn()} onRestartMistakes={vi.fn()} />);

    expect(screen.getByRole("table", { name: "防ぐ responses" })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Reading ぼうぐ ふせぐ Incorrect/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open 防ぐ subject details" })).toHaveAttribute("href", "/subjects/1");
    expect(screen.getByRole("button", { name: "Review 1 misses" })).toHaveAttribute("data-result-action");
    expect(screen.getByRole("button", { name: "Back to setup" })).toHaveAttribute("data-result-action");
  });
});
