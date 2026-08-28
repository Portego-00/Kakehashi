import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnkiAnswerContent, type AnkiAnswerContentProps } from "./AnkiAnswerContent";

function props(overrides: Partial<AnkiAnswerContentProps> = {}): AnkiAnswerContentProps {
  return {
    revealed: false,
    questionKind: "meaning",
    meaningAnswer: "to eat",
    readingAnswer: "たべる",
    onReveal: vi.fn(),
    onGradeIncorrect: vi.fn(),
    onGradeCorrect: vi.fn(),
    ...overrides,
  };
}

describe("AnkiAnswerContent", () => {
  it("offers a blurred preview or removes the answer entirely before reveal", () => {
    const onReveal = vi.fn();
    const { rerender } = render(<AnkiAnswerContent {...props({ onReveal })} />);

    const preview = screen.getByTestId("anki-answer-preview");
    expect(preview).toHaveAttribute("data-visibility", "blurred");
    expect(screen.getByText("to eat").closest("[aria-hidden='true']")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /wrong/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    expect(onReveal).toHaveBeenCalledOnce();

    rerender(<AnkiAnswerContent {...props({ hideAnswerCompletely: true, onReveal })} />);
    expect(screen.getByTestId("anki-answer-preview")).toHaveAttribute("data-visibility", "hidden");
    expect(screen.queryByText("to eat")).not.toBeInTheDocument();
  });

  it("reveals grouped meaning and reading answers together", () => {
    render(
      <AnkiAnswerContent
        {...props({
          revealed: true,
          groupQuestions: true,
          meaningAnswer: "to eat",
          readingAnswer: "たべる",
        })}
      />,
    );

    const answer = screen.getByTestId("anki-answer-content");
    expect(within(answer).getByText("Meaning")).toBeInTheDocument();
    expect(within(answer).getByText("to eat")).toBeInTheDocument();
    expect(within(answer).getByText("Reading")).toBeInTheDocument();
    expect(within(answer).getByText("たべる")).toHaveAttribute("lang", "ja");
    expect(screen.queryByRole("button", { name: "Reveal answer" })).not.toBeInTheDocument();
  });

  it("shows enabled answer supplements, pitch details, replay, and grading controls", () => {
    const onReplayAudio = vi.fn();
    const onGradeIncorrect = vi.fn();
    const onGradeCorrect = vi.fn();
    render(
      <AnkiAnswerContent
        {...props({
          revealed: true,
          questionKind: "reading",
          groupQuestions: true,
          otherMeaningAnswers: ["consume", " consume "],
          otherReadingAnswers: ["くう"],
          userSynonyms: ["have a meal"],
          partsOfSpeech: ["ichidan_verb", "transitive_verb"],
          pitchAccents: [{ r: "たべる", p: [0, 2] }],
          showOtherAcceptedAnswersAndUserSynonyms: true,
          showWaniKaniGrammarTags: true,
          showPitchAccentNumbers: true,
          showPitchAccentGraph: true,
          showReplayAudioButton: true,
          onReplayAudio,
          onGradeIncorrect,
          onGradeCorrect,
        })}
      />,
    );

    expect(screen.getByText("Other meaning answers")).toBeInTheDocument();
    expect(screen.getByText("consume")).toBeInTheDocument();
    expect(screen.getByText("Other reading answers")).toBeInTheDocument();
    expect(screen.getByText("くう")).toHaveAttribute("lang", "ja");
    expect(screen.getByText("User synonyms")).toBeInTheDocument();
    expect(screen.getByText("have a meal")).toBeInTheDocument();
    expect(screen.getByText("Part of speech")).toBeInTheDocument();
    expect(screen.getByText("ichidan verb, transitive verb")).toBeInTheDocument();
    expect(screen.getByText(/Heiban \(0\), Nakadaka \(2\)/)).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /pitch accent/i })).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Replay vocabulary audio" }));
    fireEvent.click(screen.getByRole("button", { name: /wrong/i }));
    fireEvent.click(screen.getByRole("button", { name: /correct/i }));
    expect(onReplayAudio).toHaveBeenCalledOnce();
    expect(onGradeIncorrect).toHaveBeenCalledOnce();
    expect(onGradeCorrect).toHaveBeenCalledOnce();
  });

  it("uses familiar tap zones instead of visible grading buttons in buttonless Anki mode", () => {
    const onGradeIncorrect = vi.fn();
    const onGradeCorrect = vi.fn();
    render(
      <AnkiAnswerContent
        {...props({
          revealed: true,
          buttonlessMode: true,
          showReplayAudioButton: true,
          onReplayAudio: vi.fn(),
          onGradeIncorrect,
          onGradeCorrect,
        })}
      />,
    );

    expect(screen.queryByRole("button", { name: /1 · Wrong/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /2 · Correct/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Replay vocabulary audio" })).not.toBeInTheDocument();

    const controls = screen.getByRole("group", { name: "Buttonless Anki controls" });
    fireEvent.click(within(controls).getByRole("button", { name: "Tap left: mark wrong" }));
    fireEvent.click(within(controls).getByRole("button", { name: "Tap right: mark correct" }));
    expect(onGradeIncorrect).toHaveBeenCalledOnce();
    expect(onGradeCorrect).toHaveBeenCalledOnce();
  });

  it("uses the full revealed card as the buttonless gesture surface and cancels abandoned gestures", () => {
    const onGradeIncorrect = vi.fn();
    const onGradeCorrect = vi.fn();
    render(<AnkiAnswerContent {...props({ revealed: true, buttonlessMode: true, onGradeIncorrect, onGradeCorrect })} />);

    const card = screen.getByRole("region", { name: "Anki answer" });
    Object.defineProperty(card, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 20, right: 220, top: 0, bottom: 200, width: 200, height: 200, x: 20, y: 0, toJSON: () => ({}) }),
    });

    fireEvent.pointerDown(card, { pointerId: 1, clientX: 60, clientY: 80, button: 0, isPrimary: true });
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 62, clientY: 82, button: 0, isPrimary: true });
    fireEvent.pointerDown(card, { pointerId: 2, clientX: 180, clientY: 80, button: 0, isPrimary: true });
    fireEvent.pointerUp(card, { pointerId: 2, clientX: 182, clientY: 82, button: 0, isPrimary: true });
    expect(onGradeIncorrect).toHaveBeenCalledOnce();
    expect(onGradeCorrect).toHaveBeenCalledOnce();

    fireEvent.pointerDown(card, { pointerId: 3, clientX: 60, clientY: 80, button: 0, isPrimary: true });
    fireEvent.pointerCancel(card, { pointerId: 3 });
    fireEvent.pointerUp(card, { pointerId: 3, clientX: 180, clientY: 80, button: 0, isPrimary: true });
    expect(onGradeIncorrect).toHaveBeenCalledOnce();
    expect(onGradeCorrect).toHaveBeenCalledOnce();
  });

  it("matches the mobile buttonless swipe gestures for details and skip", () => {
    const onShowDetails = vi.fn();
    const onSkip = vi.fn();
    render(<AnkiAnswerContent {...props({ revealed: true, buttonlessMode: true, onShowDetails, onSkip })} />);

    const card = screen.getByRole("region", { name: "Anki answer" });
    fireEvent.pointerDown(card, { pointerId: 1, clientX: 100, clientY: 150, button: 0, isPrimary: true });
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 102, clientY: 80, button: 0, isPrimary: true });
    expect(onShowDetails).toHaveBeenCalledOnce();

    fireEvent.pointerDown(card, { pointerId: 2, clientX: 100, clientY: 80, button: 0, isPrimary: true });
    fireEvent.pointerUp(card, { pointerId: 2, clientX: 98, clientY: 150, button: 0, isPrimary: true });
    expect(onSkip).toHaveBeenCalledOnce();
  });
});
