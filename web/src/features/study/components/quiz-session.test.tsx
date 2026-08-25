import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
});
