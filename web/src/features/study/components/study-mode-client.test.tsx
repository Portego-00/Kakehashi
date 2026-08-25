import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createListRepository } from "@/features/subjects/lists";
import { StudyModeClient } from "./study-mode-client";

vi.mock("@/features/settings/use-workspace-preferences", () => ({
  useWebSettings: () => ({ study: { immersionKitAnimeSources: [], showAnswerStopSubjectDetails: true, keyboardShortcuts: true } }),
}));

vi.mock("../use-study-dataset", () => ({
  useStudyDataset: () => ({
    status: "authenticated",
    user: { id: "user-1", data: { username: "Test", level: 1 } },
    dataset: { subjects: [], assignments: [] },
    loading: false,
    fetching: false,
    error: null,
    retry: vi.fn(),
  }),
}));

vi.mock("../engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../engine")>();
  return {
    ...actual,
    generateQuestions: () => [{ id: "question-1" }],
    createStudySession: () => ({
      id: "session-1",
      mode: "recent-lessons",
      questions: [{ id: "question-1" }],
      answers: [],
      currentIndex: 0,
      complete: false,
    }),
  };
});

vi.mock("./study-config", () => ({
  StudyConfig: ({ onStart, lists = [] }: { onStart: () => void; lists?: Array<{ name: string }> }) => <><button onClick={onStart}>Start test session</button>{lists.map((list) => <span key={list.name}>{list.name}</span>)}</>,
}));

vi.mock("./quiz-session", () => ({
  QuizSession: ({ showDetailsAtAnswerStops, keyboardShortcuts }: { showDetailsAtAnswerStops: boolean; keyboardShortcuts: boolean }) => <section aria-label="Active study session" data-auto-details={showDetailsAtAnswerStops} data-keyboard-shortcuts={keyboardShortcuts} />,
}));

describe("study session layout", () => {
  afterEach(() => window.localStorage.clear());

  it("removes the mode masthead and activates the full-page surface after starting", async () => {
    const { container } = render(<StudyModeClient mode="recent-lessons" />);

    expect(screen.getByRole("heading", { name: "Recent lessons" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start test session" }));

    await waitFor(() => expect(screen.getByRole("region", { name: "Active study session" })).toBeInTheDocument());
    expect(screen.getByRole("region", { name: "Active study session" })).toHaveAttribute("data-auto-details", "true");
    expect(screen.getByRole("region", { name: "Active study session" })).toHaveAttribute("data-keyboard-shortcuts", "true");
    expect(screen.queryByRole("heading", { name: "Recent lessons" })).not.toBeInTheDocument();
    expect(container.querySelector("main")).toHaveAttribute("data-study-session", "active");
  });

  it("uses the canonical subject lists in study setup", () => {
    const repository = createListRepository(window.localStorage, "Test", undefined, () => "mobile-review");
    repository.create("Mobile review");

    render(<StudyModeClient mode="custom-review" />);

    expect(screen.getByText("Mobile review")).toBeInTheDocument();
  });
});
