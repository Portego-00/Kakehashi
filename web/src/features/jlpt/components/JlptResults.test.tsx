import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createJlptSession } from "../engine";
import { N5_QUESTIONS } from "../questions/n5";
import type {
  JlptAnswer,
  JlptQuestion,
  JlptQuizMode,
  JlptSkill,
} from "../types";
import { JlptResults } from "./JlptResults";

vi.mock("@/lib/wanikani/queries", () => ({
  assignmentsQuery: () => ({
    queryKey: ["jlpt-test", "assignments"],
    queryFn: async () => [],
    retry: false,
  }),
  subjectsQuery: () => ({
    queryKey: ["jlpt-test", "subjects"],
    queryFn: async () => [],
    retry: false,
  }),
}));

function renderResults({
  questions,
  answers,
  mode = "mock",
  onPracticeWeakAreas = vi.fn(),
}: {
  questions: readonly JlptQuestion[];
  answers: JlptAnswer[];
  mode?: JlptQuizMode;
  onPracticeWeakAreas?: (skills: JlptSkill[]) => void;
}) {
  const created = createJlptSession({
    level: "N5",
    mode,
    questions: N5_QUESTIONS,
  });
  const session = {
    ...created,
    status: "complete" as const,
    sectionQuestionIds: [questions.map((question) => question.id)],
    answers,
  };
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <JlptResults
        session={session}
        questions={questions}
        onPracticeWeakAreas={onPracticeWeakAreas}
        onReturn={vi.fn()}
      />
    </QueryClientProvider>,
  );
  return { onPracticeWeakAreas };
}

describe("JLPT results", () => {
  it("labels mock accuracy honestly and prioritizes the weakest measured skill", () => {
    const questions = [N5_QUESTIONS[0], N5_QUESTIONS[4]];
    const answers: JlptAnswer[] = [
      {
        questionId: questions[0].id,
        selectedOptionId: "2",
        correct: false,
        answeredAt: "2026-08-29T10:00:00.000Z",
      },
      {
        questionId: questions[1].id,
        selectedOptionId: questions[1].correctOptionId,
        correct: true,
        answeredAt: "2026-08-29T10:01:00.000Z",
      },
    ];
    const onPracticeWeakAreas = vi.fn();
    renderResults({ questions, answers, onPracticeWeakAreas });

    expect(
      screen.getByRole("heading", { name: "Estimated mock performance" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /2 representative questions across 2 official question types/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/original representative questions/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/not an official JLPT score or pass prediction/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("50% overall")).toBeInTheDocument();
    expect(
      screen.getByText("Your next study priorities are clear."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Kanji needs the most attention"),
    ).toBeInTheDocument();
    expect(screen.getByText("Vocabulary led this session")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Practice Kanji" }));
    expect(onPracticeWeakAreas).toHaveBeenCalledWith(["kanji"]);
  });

  it("shows skill, scoring-section, and low-sample question-type breakdowns", () => {
    const questions = [N5_QUESTIONS[0], N5_QUESTIONS[4]];
    const answers: JlptAnswer[] = [
      {
        questionId: questions[0].id,
        selectedOptionId: "2",
        correct: false,
        answeredAt: "2026-08-29T10:00:00.000Z",
      },
      {
        questionId: questions[1].id,
        selectedOptionId: questions[1].correctOptionId,
        correct: true,
        answeredAt: "2026-08-29T10:01:00.000Z",
      },
    ];
    renderResults({ questions, answers });

    expect(screen.getByRole("heading", { name: "Skills" })).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Kanji: 0%" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Vocabulary: 100%" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "JLPT scoring sections" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/official sectional pass marks cannot be applied/i),
    ).toBeInTheDocument();

    const typeBreakdown = screen.getByRole("region", {
      name: "Question types",
    });
    expect(
      within(typeBreakdown).getByText("Kanji reading"),
    ).toBeInTheDocument();
    expect(
      within(typeBreakdown).getByText("Contextually-defined expressions"),
    ).toBeInTheDocument();
    expect(
      within(typeBreakdown).getAllByText(/one-question sample/i),
    ).toHaveLength(2);
  });

  it("makes each missed answer and explanation clear", () => {
    const questions = [N5_QUESTIONS[0], N5_QUESTIONS[4]];
    const answers: JlptAnswer[] = [
      {
        questionId: questions[0].id,
        selectedOptionId: "2",
        correct: false,
        answeredAt: "2026-08-29T10:00:00.000Z",
      },
      {
        questionId: questions[1].id,
        selectedOptionId: questions[1].correctOptionId,
        correct: true,
        answeredAt: "2026-08-29T10:01:00.000Z",
      },
    ];
    renderResults({ questions, answers });

    expect(
      screen.getByRole("heading", { name: "Missed question review" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Question 1")).toBeInTheDocument();
    expect(screen.getByText("1 to revisit")).toBeInTheDocument();
    expect(screen.getByText(questions[0].explanation)).toBeInTheDocument();
    expect(screen.getByText("まいばん")).toBeInTheDocument();
    expect(screen.getByText("まいあさ")).toBeInTheDocument();
    expect(screen.getByText("Why this is correct")).toBeInTheDocument();
  });

  it("reviews the learner's complete sentence order instead of only the starred fragment", () => {
    const question = N5_QUESTIONS.find(
      (candidate) => candidate.officialType === "sentence-composition",
    )!;
    const selectedOrderOptionIds = [
      ...question.sentenceComposition!.canonicalOrderOptionIds,
    ].reverse();
    const selectedOptionId =
      selectedOrderOptionIds[question.sentenceComposition!.starredPosition];
    const selectedOrder = selectedOrderOptionIds
      .map(
        (optionId) =>
          question.options.find((option) => option.id === optionId)!.label,
      )
      .join("　");
    const correctOrder = question
      .sentenceComposition!.canonicalOrderOptionIds.map(
        (optionId) =>
          question.options.find((option) => option.id === optionId)!.label,
      )
      .join("　");
    const answers: JlptAnswer[] = [
      {
        questionId: question.id,
        selectedOptionId,
        selectedOrderOptionIds,
        correct: false,
        answeredAt: "2026-08-29T10:00:00.000Z",
      },
    ];

    renderResults({ questions: [question], answers, mode: "quick" });

    expect(
      screen.getByText((_, element) => element?.textContent === selectedOrder),
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === correctOrder),
    ).toBeInTheDocument();
  });

  it("restores the illustration and spoken answer text when reviewing a missed verbal-expression item", () => {
    const question = N5_QUESTIONS.find(
      (candidate) => candidate.id === "n5-generated-listening-verbal-001",
    )!;
    const wrong = question.options.find(
      (option) => option.id !== question.correctOptionId,
    )!;
    const answers: JlptAnswer[] = [
      {
        questionId: question.id,
        selectedOptionId: wrong.id,
        correct: false,
        answeredAt: "2026-08-29T10:00:00.000Z",
      },
    ];

    renderResults({ questions: [question], answers });

    expect(
      screen.getByRole("img", { name: /points to a shirt/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Listening transcript")).toBeInTheDocument();
    expect(screen.getByText(wrong.label)).toBeInTheDocument();
    expect(
      screen.getByText(
        question.options.find(
          (option) => option.id === question.correctOptionId,
        )!.label,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Choice 1")).not.toBeInTheDocument();
  });

  it("explains the volatility of a perfect quick-quiz sample without calling it a pass", () => {
    const questions = [N5_QUESTIONS[0], N5_QUESTIONS[4]];
    const answers: JlptAnswer[] = questions.map((question, index) => ({
      questionId: question.id,
      selectedOptionId: question.correctOptionId,
      correct: true,
      answeredAt: `2026-08-29T10:0${index}:00.000Z`,
    }));
    renderResults({ questions, answers, mode: "quick" });

    expect(
      screen.getByRole("heading", { name: "Quiz results" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/one answer changes the result by about 50 points/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/not a JLPT level verdict/i)).toBeInTheDocument();
    expect(screen.getByText("No weak skill stood out")).toBeInTheDocument();
    expect(screen.getByText("Every answer was correct")).toBeInTheDocument();
    expect(screen.queryByText(/pass prediction/i)).not.toBeInTheDocument();
  });
});
