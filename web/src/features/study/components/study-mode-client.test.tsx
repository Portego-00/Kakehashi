import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createListRepository } from "@/features/subjects/lists";
import { StudyModeClient } from "./study-mode-client";

const immersionMocks = vi.hoisted(() => ({
  streamAnimeContext: vi.fn(),
}));

const engineMocks = vi.hoisted(() => ({
  generateQuestions: vi.fn(() => [{ id: "question-1", characters: "猫" }]),
}));

vi.mock("@/features/settings/use-workspace-preferences", () => ({
  useWebSettings: () => ({ study: { immersionKitAnimeSources: [], showAnswerStopSubjectDetails: true, showListeningTranslation: false, keyboardShortcuts: true } }),
}));

vi.mock("../use-study-dataset", () => ({
  useStudyDataset: () => ({
    status: "authenticated",
    user: { id: "user-1", data: { username: "Test", level: 1 } },
    dataset: {
      subjects: [
        { id: 440, object: "vocabulary", data: { level: 1, hidden_at: null } },
        { id: 441, object: "kanji", data: { level: 1, hidden_at: null } },
      ],
      assignments: [],
    },
    loading: false,
    fetching: false,
    error: null,
    retry: vi.fn(),
  }),
}));

vi.mock("../immersion", () => ({
  addAnimeContext: vi.fn(),
  streamAnimeContext: immersionMocks.streamAnimeContext,
}));

vi.mock("../engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../engine")>();
  return {
    ...actual,
    generateQuestions: engineMocks.generateQuestions,
    createStudySession: (mode: string, questions: Array<{ id: string }>) => ({
      id: "session-1",
      mode,
      questions,
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
  QuizSession: ({ initialSession, showDetailsAtAnswerStops, showListeningTranslation, keyboardShortcuts, loadingMore, expectedSubjectCount, onExit }: { initialSession: { questions: unknown[] }; showDetailsAtAnswerStops: boolean; showListeningTranslation: boolean; keyboardShortcuts: boolean; loadingMore?: boolean; expectedSubjectCount?: number; onExit: () => void }) => <section aria-label="Active study session" data-auto-details={showDetailsAtAnswerStops} data-listening-translation={showListeningTranslation} data-keyboard-shortcuts={keyboardShortcuts} data-question-count={initialSession.questions.length} data-loading-more={loadingMore} data-expected-subjects={expectedSubjectCount}><button onClick={onExit}>Exit test session</button></section>,
}));

describe("study session layout", () => {
  afterEach(() => {
    window.localStorage.clear();
    immersionMocks.streamAnimeContext.mockReset();
    engineMocks.generateQuestions.mockClear();
  });

  it("removes the mode masthead and activates the full-page surface after starting", async () => {
    const { container } = render(<StudyModeClient mode="recent-lessons" />);

    expect(screen.getByRole("heading", { name: "Recent lessons" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start test session" }));

    await waitFor(() => expect(screen.getByRole("region", { name: "Active study session" })).toBeInTheDocument());
    expect(screen.getByRole("region", { name: "Active study session" })).toHaveAttribute("data-auto-details", "true");
    expect(screen.getByRole("region", { name: "Active study session" })).toHaveAttribute("data-listening-translation", "false");
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

  it("starts a seeded subject-list session without showing setup", async () => {
    render(<StudyModeClient mode="custom-review" seedSubjectIds={[440, 441]} startImmediately />);

    expect(screen.queryByRole("button", { name: "Start test session" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("region", { name: "Active study session" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Start test session" })).not.toBeInTheDocument();
    expect(engineMocks.generateQuestions).toHaveBeenCalledWith(
      "custom-review",
      expect.anything(),
      expect.objectContaining({ selectedSubjectIds: [440, 441] }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Exit test session" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Start test session" })).toBeInTheDocument());
    expect(engineMocks.generateQuestions).toHaveBeenCalledTimes(1);
  });

  it("passes the seeded list into other directly started study modes", async () => {
    render(<StudyModeClient mode="random-test" seedSubjectIds={[440]} startImmediately />);

    await waitFor(() => expect(screen.getByRole("region", { name: "Active study session" })).toBeInTheDocument());
    expect(engineMocks.generateQuestions).toHaveBeenCalledWith(
      "random-test",
      expect.anything(),
      expect.objectContaining({ selectedSubjectIds: [440] }),
    );
  });

  it("shows the listening preparation transition, then starts with the first batch while the rest load", async () => {
    let releaseFirst: (() => void) | undefined;
    let releaseRest: (() => void) | undefined;
    immersionMocks.streamAnimeContext.mockImplementation(async function* () {
      await new Promise<void>((resolve) => { releaseFirst = resolve; });
      yield [{ id: "cat:characters" }, { id: "cat:meaning" }];
      await new Promise<void>((resolve) => { releaseRest = resolve; });
      yield [{ id: "dog:characters" }, { id: "dog:meaning" }];
    });

    render(<StudyModeClient mode="listening" />);
    fireEvent.click(screen.getByRole("button", { name: "Start test session" }));

    expect(await screen.findByRole("status", { name: "Finding anime clips" })).toBeInTheDocument();
    releaseFirst?.();
    await waitFor(() => expect(screen.getByRole("region", { name: "Active study session" })).toHaveAttribute("data-question-count", "2"));
    expect(screen.getByRole("region", { name: "Active study session" })).toHaveAttribute("data-loading-more", "true");
    expect(screen.getByRole("region", { name: "Active study session" })).toHaveAttribute("data-expected-subjects", "10");

    releaseRest?.();
    await waitFor(() => expect(screen.getByRole("region", { name: "Active study session" })).toHaveAttribute("data-question-count", "4"));
    expect(screen.getByRole("region", { name: "Active study session" })).toHaveAttribute("data-loading-more", "false");
  });
});
