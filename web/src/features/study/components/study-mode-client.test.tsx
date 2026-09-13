import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createListRepository } from "@/features/subjects/lists";
import { configKey, sessionKey } from "../storage";
import { StudyModeClient } from "./study-mode-client";

const immersionMocks = vi.hoisted(() => ({
  streamAnimeContext: vi.fn(),
}));

const engineMocks = vi.hoisted(() => ({
  generateQuestions: vi.fn(() => [{ id: "question-1", characters: "猫" }]),
}));

vi.mock("@/features/settings/use-workspace-preferences", () => ({
  useWebSettings: () => ({ study: { immersionKitAnimeSources: [], showAnswerStopSubjectDetails: true, showReviewItemLevelAndSrsStage: true, showVocabularyFrequency: true, showVocabContextSentencesInReviews: true, reviewSearchButtonEnabled: true, pauseOnWrong: true, pauseOnClose: true, pauseOnCorrect: false, acceptUserSynonymsAsAnswers: true, acceptAnyKanjiOnyomiReading: true, answerFeedbackSoundEnabled: false, showListeningTranslation: false, keyboardShortcuts: true, customReviewOrder: "oldestAvailableFirst", reviewTypeOrderEnabled: true, reviewTypeOrder: ["kanji", "vocabulary", "radical"], prioritizeCriticalItems: true, reviewQuestionOrderEnabled: true, reviewQuestionOrder: "reading-first", backToBackQuestions: true } }),
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
  QuizSession: ({ initialSession, reviewPreferences, showDetailsAtAnswerStops, pauseOnWrong, pauseOnClose, pauseOnCorrect, acceptUserSynonymsAsAnswers, acceptAnyKanjiOnyomiReading, answerFeedbackSoundEnabled, showListeningTranslation, keyboardShortcuts, loadingMore, expectedSubjectCount, onExit }: { initialSession: { id: string; questions: unknown[] }; reviewPreferences?: { showReviewItemLevelAndSrsStage: boolean; showVocabularyFrequency: boolean; showVocabContextSentencesInReviews: boolean; reviewSearchButtonEnabled: boolean }; showDetailsAtAnswerStops: boolean; pauseOnWrong: boolean; pauseOnClose: boolean; pauseOnCorrect: boolean; acceptUserSynonymsAsAnswers: boolean; acceptAnyKanjiOnyomiReading: boolean; answerFeedbackSoundEnabled: boolean; showListeningTranslation: boolean; keyboardShortcuts: boolean; loadingMore?: boolean; expectedSubjectCount?: number; onExit: () => void }) => <section aria-label="Active study session" data-session-id={initialSession.id} data-review-level-srs={reviewPreferences?.showReviewItemLevelAndSrsStage} data-review-frequency={reviewPreferences?.showVocabularyFrequency} data-review-context={reviewPreferences?.showVocabContextSentencesInReviews} data-review-search={reviewPreferences?.reviewSearchButtonEnabled} data-auto-details={showDetailsAtAnswerStops} data-pause-on-wrong={pauseOnWrong} data-pause-on-close={pauseOnClose} data-pause-on-correct={pauseOnCorrect} data-user-synonyms={acceptUserSynonymsAsAnswers} data-any-onyomi={acceptAnyKanjiOnyomiReading} data-answer-feedback-sound={answerFeedbackSoundEnabled} data-listening-translation={showListeningTranslation} data-keyboard-shortcuts={keyboardShortcuts} data-question-count={initialSession.questions.length} data-loading-more={loadingMore} data-expected-subjects={expectedSubjectCount}><button onClick={onExit}>Exit test session</button></section>,
}));

describe("study session layout", () => {
  afterEach(() => {
    window.localStorage.clear();
    immersionMocks.streamAnimeContext.mockReset();
    engineMocks.generateQuestions.mockClear();
  });

  it.each([
    ["word", "No vocabulary with WaniKani audio matches these filters."],
    ["sentence", "No vocabulary with Japanese context sentences matches these filters."],
  ] as const)("explains missing content for the %s audio source", async (audioVocabSource, message) => {
    window.localStorage.setItem(configKey("user-1", "audio-vocab"), JSON.stringify({ audioVocabSource }));
    engineMocks.generateQuestions.mockReturnValueOnce([]);
    render(<StudyModeClient mode="audio-vocab" />);
    fireEvent.click(screen.getByRole("button", { name: "Start test session" }));
    expect(await screen.findByText(`${message} Try more levels, SRS stages, or another list.`)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Active study session" })).not.toBeInTheDocument();
  });

  it("removes the mode masthead and activates the full-page surface after starting", async () => {
    const { container } = render(<StudyModeClient mode="recent-lessons" />);

    expect(screen.getByRole("heading", { name: "Recent lessons" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start test session" }));

    await waitFor(() => expect(screen.getByRole("region", { name: "Active study session" })).toBeInTheDocument());
    expect(screen.getByRole("region", { name: "Active study session" })).toHaveAttribute("data-auto-details", "true");
    expect(screen.getByRole("region", { name: "Active study session" })).toHaveAttribute("data-pause-on-wrong", "true");
    expect(screen.getByRole("region", { name: "Active study session" })).toHaveAttribute("data-pause-on-close", "true");
    expect(screen.getByRole("region", { name: "Active study session" })).toHaveAttribute("data-pause-on-correct", "false");
    expect(screen.getByRole("region", { name: "Active study session" })).toHaveAttribute("data-user-synonyms", "true");
    expect(screen.getByRole("region", { name: "Active study session" })).toHaveAttribute("data-any-onyomi", "true");
    expect(screen.getByRole("region", { name: "Active study session" })).toHaveAttribute("data-answer-feedback-sound", "false");
    expect(screen.getByRole("region", { name: "Active study session" })).toHaveAttribute("data-listening-translation", "false");
    expect(screen.getByRole("region", { name: "Active study session" })).toHaveAttribute("data-keyboard-shortcuts", "true");
    expect(screen.queryByRole("heading", { name: "Recent lessons" })).not.toBeInTheDocument();
    expect(container.querySelector("main")).toHaveAttribute("data-study-session", "active");
  });

  it("places the saved-session action in the mode header and resumes it", async () => {
    window.localStorage.setItem(sessionKey("user-1", "random-test"), JSON.stringify({
      version: 1,
      id: "saved-random-test",
      mode: "random-test",
      createdAt: "2026-08-27T18:00:00.000Z",
      updatedAt: "2026-08-27T18:05:00.000Z",
      currentIndex: 1,
      questions: [
        { id: "440:meaning", subjectId: 440 },
        { id: "441:meaning", subjectId: 441 },
      ],
      answers: [],
      complete: false,
    }));

    const { container } = render(<StudyModeClient mode="random-test" />);
    const header = container.querySelector("header");

    expect(header).not.toBeNull();
    const resumeButton = within(header as HTMLElement).getByRole("button", { name: "Resume saved session, item 2 of 2" });
    expect(within(resumeButton).getByText("2 / 2")).toBeInTheDocument();

    fireEvent.click(resumeButton);

    await waitFor(() => expect(screen.getByRole("region", { name: "Active study session" })).toHaveAttribute("data-question-count", "2"));
    expect(container.querySelector("header")).not.toBeInTheDocument();
  });

  it("starts a fresh session when a saved session exists", async () => {
    window.localStorage.setItem(sessionKey("user-1", "random-test"), JSON.stringify({
      version: 1,
      id: "saved-random-test",
      mode: "random-test",
      createdAt: "2026-08-27T18:00:00.000Z",
      updatedAt: "2026-08-27T18:05:00.000Z",
      currentIndex: 1,
      questions: [
        { id: "440:meaning", subjectId: 440 },
        { id: "441:meaning", subjectId: 441 },
      ],
      answers: [],
      complete: false,
    }));

    render(<StudyModeClient mode="random-test" />);
    fireEvent.click(screen.getByRole("button", { name: "Start test session" }));

    const session = await screen.findByRole("region", { name: "Active study session" });
    expect(session).toHaveAttribute("data-session-id", "session-1");
    expect(session).toHaveAttribute("data-question-count", "1");
  });

  it("drops a legacy misses-only filter before starting a normal quiz", async () => {
    window.localStorage.setItem(configKey("user-1", "random-test"), JSON.stringify({
      selectedSubjectIds: [440],
      selectedListIds: [],
    }));

    render(<StudyModeClient mode="random-test" />);
    fireEvent.click(screen.getByRole("button", { name: "Start test session" }));

    await screen.findByRole("region", { name: "Active study session" });
    expect(engineMocks.generateQuestions).toHaveBeenCalledWith(
      "random-test",
      expect.anything(),
      expect.objectContaining({ selectedSubjectIds: [] }),
    );
  });

  it("abandons the saved session as soon as a fresh listening session starts", async () => {
    let releaseFirst: (() => void) | undefined;
    immersionMocks.streamAnimeContext.mockImplementation(async function* () {
      await new Promise<void>((resolve) => { releaseFirst = resolve; });
      yield [{ id: "cat:characters" }];
    });
    window.localStorage.setItem(sessionKey("user-1", "listening"), JSON.stringify({
      version: 1,
      id: "saved-listening",
      mode: "listening",
      createdAt: "2026-08-27T18:00:00.000Z",
      updatedAt: "2026-08-27T18:05:00.000Z",
      currentIndex: 1,
      questions: [{ id: "old:characters", subjectId: 440 }],
      answers: [],
      complete: false,
    }));

    render(<StudyModeClient mode="listening" />);
    fireEvent.click(screen.getByRole("button", { name: "Start test session" }));
    const savedWhilePreparing = window.localStorage.getItem(sessionKey("user-1", "listening"));
    await act(async () => { releaseFirst?.(); });

    expect(savedWhilePreparing).toBeNull();
    await screen.findByRole("region", { name: "Active study session" });
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
      {
        customReviewOrder: "oldestAvailableFirst",
        reviewTypeOrderEnabled: true,
        reviewTypeOrder: ["kanji", "vocabulary", "radical"],
        prioritizeCriticalItems: true,
        userLevel: 1,
        reviewQuestionOrderEnabled: true,
        reviewQuestionOrder: "reading-first",
        backToBackQuestions: true,
        maxQuestionGap: 10,
      },
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

  it("passes review question extras into random tests", async () => {
    render(<StudyModeClient mode="random-test" seedSubjectIds={[440]} startImmediately />);

    const session = await screen.findByRole("region", { name: "Active study session" });
    expect(session).toHaveAttribute("data-review-level-srs", "true");
    expect(session).toHaveAttribute("data-review-frequency", "true");
    expect(session).toHaveAttribute("data-review-context", "true");
    expect(session).toHaveAttribute("data-review-search", "true");
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
