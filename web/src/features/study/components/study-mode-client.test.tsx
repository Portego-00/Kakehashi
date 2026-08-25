import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudyModeClient } from "./study-mode-client";

vi.mock("@/features/settings/use-workspace-preferences", () => ({
  useWebSettings: () => ({ study: { immersionKitAnimeSources: [] } }),
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
  StudyConfig: ({ onStart }: { onStart: () => void }) => <button onClick={onStart}>Start test session</button>,
}));

vi.mock("./quiz-session", () => ({
  QuizSession: () => <section aria-label="Active study session" />,
}));

describe("study session layout", () => {
  afterEach(() => window.localStorage.clear());

  it("removes the mode masthead and activates the full-page surface after starting", async () => {
    const { container } = render(<StudyModeClient mode="recent-lessons" />);

    expect(screen.getByRole("heading", { name: "Recent lessons" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start test session" }));

    await waitFor(() => expect(screen.getByRole("region", { name: "Active study session" })).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "Recent lessons" })).not.toBeInTheDocument();
    expect(container.querySelector("main")).toHaveAttribute("data-study-session", "active");
  });
});
