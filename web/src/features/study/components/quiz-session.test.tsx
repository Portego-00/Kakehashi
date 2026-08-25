import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StudyQuestion, StudySession } from "../types";
import { promptTypePresentation, QuizSession } from "./quiz-session";

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
});
