import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { wkCollection, wkRequest } from "@/lib/wanikani/client";
import { playAnswerFeedback } from "@/features/study/feedback-audio";
import { CoreStudySession, fetchCoreStudyCollectionByIds } from "./CoreStudySession";

const fixtures = vi.hoisted(() => {
  const user = {
    id: 1,
    object: "user",
    url: "https://api.wanikani.com/v2/user",
    data_updated_at: "2026-08-17T00:00:00.000Z",
    data: { username: "study-test", level: 4, profile_url: "https://www.wanikani.com/users/study-test", started_at: "2026-01-01T00:00:00.000Z", current_vacation_started_at: null, preferences: {}, subscription: {} },
  };
  const subject = {
    id: 200,
    object: "vocabulary",
    url: "https://api.wanikani.com/v2/subjects/200",
    data_updated_at: "2026-08-17T00:00:00.000Z",
    data: {
      level: 4,
      created_at: "2026-01-01T00:00:00.000Z",
      slug: "川",
      document_url: "https://www.wanikani.com/vocabulary/川",
      hidden_at: null,
      characters: "川",
      meanings: [{ meaning: "River", primary: true, accepted_answer: true }],
      auxiliary_meanings: [],
      readings: [{ reading: "かわ", primary: true, accepted_answer: true }],
      meaning_mnemonic: "Picture a river cutting through the valley.",
      reading_mnemonic: "A friendly cow stands beside the river.",
      component_subject_ids: [201],
      context_sentences: [
        { ja: "川を渡ります。", en: "I cross the river." },
        { ja: "川で泳ぎます。", en: "I swim in the river." },
        { ja: "川は静かです。", en: "The river is quiet." },
      ],
      pronunciation_audios: [{ url: "https://example.com/kawa.mp3", content_type: "audio/mpeg", metadata: { gender: "female", source_id: 1, pronunciation: "かわ", voice_actor_id: 1, voice_actor_name: "Kyoko", voice_description: "Tokyo accent" } }],
    },
  };
  const componentKanji = {
    ...subject,
    id: 201,
    object: "kanji",
    data: {
      ...subject.data,
      document_url: "https://www.wanikani.com/kanji/川",
      readings: [
        { reading: "せん", primary: true, accepted_answer: true, type: "onyomi" },
        { reading: "かわ", primary: false, accepted_answer: true, type: "kunyomi" },
      ],
      component_subject_ids: [],
    },
  };
  const secondSubject = {
    ...componentKanji,
    id: 202,
    data: {
      ...componentKanji.data,
      slug: "火",
      document_url: "https://www.wanikani.com/kanji/火",
      characters: "火",
      meanings: [{ meaning: "Fire", primary: true, accepted_answer: true }],
      readings: [{ reading: "か", primary: true, accepted_answer: true, type: "onyomi" }],
      meaning_mnemonic: "Picture a bright fire.",
      reading_mnemonic: "A car drives past the fire.",
      context_sentences: [],
      pronunciation_audios: [],
    },
  };
  const reviewAssignment = {
    id: 100,
    object: "assignment",
    url: "https://api.wanikani.com/v2/assignments/100",
    data_updated_at: "2026-08-17T00:00:00.000Z",
    data: { subject_id: 200, subject_type: "vocabulary", srs_stage: 3, available_at: "2026-08-16T00:00:00.000Z", started_at: "2026-01-02T00:00:00.000Z", unlocked_at: "2026-01-01T00:00:00.000Z", passed_at: null, burned_at: null, resurrected_at: null, hidden: false, created_at: "2026-01-01T00:00:00.000Z" },
  };
  const lessonAssignment = {
    ...reviewAssignment,
    id: 101,
    data: { ...reviewAssignment.data, srs_stage: 0, available_at: null, started_at: null },
  };
  const secondLessonAssignment = {
    ...lessonAssignment,
    id: 103,
    data: { ...lessonAssignment.data, subject_id: 202, subject_type: "kanji" },
  };
  const reviewResponse = {
    id: 500,
    object: "review",
    url: "https://api.wanikani.com/v2/reviews/500",
    data_updated_at: "2026-08-17T00:00:00.000Z",
    data: { assignment_id: 100, subject_id: 200, starting_srs_stage: 3, ending_srs_stage: 4, incorrect_meaning_answers: 0, incorrect_reading_answers: 0, created_at: "2026-08-17T00:00:00.000Z" },
    resources_updated: { assignment: { ...reviewAssignment, data: { ...reviewAssignment.data, srs_stage: 4, available_at: "2026-08-28T00:00:00.000Z" } } },
  };
  const settings = {
    subjectDetails: {
      showContextSentences: true,
      showImmersionExamples: false,
      showPitchAccent: false,
      showKanjiReadingExamples: true,
      showStrokeOrder: true,
      showPatternsOfUse: false,
    },
    study: {
      autoplayAudio: false,
      answerFeedbackSoundEnabled: true,
      showSrsIndicator: true,
      showReviewItemLevelAndSrsStage: false,
      showVocabularyFrequency: false,
      showVocabContextSentencesInReviews: false,
      allowSkippingReviews: false,
      reviewSearchButtonEnabled: false,
      reviewCharacterFontScale: 1,
      reviewInputFontScale: 1,
      pauseOnWrong: true,
      pauseOnClose: false,
      pauseOnCorrect: false,
      srsProgressionCardDisplayMode: "normal",
      acceptUserSynonymsAsAnswers: false,
      showAddSynonymButton: true,
      keyboardShortcuts: true,
      shuffleSubjects: false,
      lessonsBatchSize: 5,
      answerOrder: "mixed",
      dailyLessonLimit: 0,
      lessonOrder: "available",
      reviewOrder: "oldestAvailableFirst",
      customReviewOrder: "random",
      reviewTypeOrderEnabled: false,
      reviewTypeOrder: ["radical", "kanji", "vocabulary"],
      prioritizeCriticalItems: false,
      reviewBatchSizeEnabled: true,
      reviewBatchSize: 10,
      reviewWrapUpSize: 5,
      lessonQuestionOrder: "meaning-first",
      reviewQuestionOrderEnabled: true,
      reviewQuestionOrder: "meaning-first",
      backToBackQuestions: false,
      backToBackImmediateRetryIncorrect: false,
      reviewAnimatePreviousQuestion: true,
      answerStopBehavior: "always",
      showAnswerStopSubjectDetails: false,
      showListeningTranslation: true,
      vocabularyAudioVoice: "female",
      ankiMode: "off",
      ankiGroupQuestions: false,
      ankiHideAnswerCompletely: false,
      ankiShowOtherAcceptedAnswersAndUserSynonyms: false,
      ankiShowWaniKaniGrammarTags: false,
      ankiShowPitchAccentNumbers: false,
      ankiShowPitchAccentGraph: false,
      ankiButtonlessMode: false,
      ankiShowReplayAudioButton: false,
      acceptAnyKanjiOnyomiReading: false,
      voiceAnswers: false,
      jitaiEnabled: false,
      jitaiSelectedFontIds: [],
      jitaiCustomFonts: [],
      immersionKitAnimeSources: [],
      epubDailyGoalMinutes: 5,
    },
  };
  const studyMaterial = {
    id: 300,
    object: "study_material",
    url: "https://api.wanikani.com/v2/study_materials/300",
    data_updated_at: "2026-08-17T00:00:00.000Z",
    data: { subject_id: 200, subject_type: "vocabulary", meaning_synonyms: ["watercourse"], meaning_note: null, reading_note: null, hidden: false, created_at: "2026-01-01T00:00:00.000Z" },
  };
  return { componentKanji, lessonAssignment, lessonAssignmentsResponse: [lessonAssignment], reviewAssignment, reviewAssignmentsResponse: [reviewAssignment], reviewResponse, secondLessonAssignment, secondSubject, settings, studyMaterial, studyMaterialsRequest: null as Promise<typeof studyMaterial[]> | null, subject, user };
});

vi.mock("@/lib/session", () => ({ useSession: () => ({ user: fixtures.user }) }));

vi.mock("@/features/settings/use-workspace-preferences", () => ({
  useWebSettings: () => fixtures.settings,
}));

vi.mock("@/features/settings/jitai", () => ({ installCustomJitaiFonts: vi.fn().mockResolvedValue(undefined), resolveJitaiFontFamily: () => undefined }));

vi.mock("@/features/study/feedback-audio", () => ({ playAnswerFeedback: vi.fn() }));

vi.mock("@/lib/wanikani/client", () => ({
  WaniKaniApiError: class extends Error {},
  wkRequest: vi.fn(async (endpoint: string) => endpoint === "user" ? fixtures.user : endpoint === "reviews" ? fixtures.reviewResponse : endpoint.startsWith("study_materials") ? fixtures.studyMaterial : fixtures.reviewAssignment),
  wkCollection: vi.fn(async (endpoint: string) => {
    if (endpoint.includes("immediately_available_for_lessons")) return fixtures.lessonAssignmentsResponse;
    if (endpoint.includes("immediately_available_for_review")) return fixtures.reviewAssignmentsResponse;
    if (endpoint.startsWith("assignments?subject_ids=")) {
      const ids = endpoint.split("=")[1].split(",").map(Number);
      return [fixtures.lessonAssignment, fixtures.secondLessonAssignment].filter((assignment) => ids.includes(assignment.data.subject_id));
    }
    if (endpoint.startsWith("subjects?ids=")) {
      const ids = endpoint.split("=")[1].split(",").map(Number);
      return [fixtures.subject, fixtures.componentKanji, fixtures.secondSubject].filter((subject) => ids.includes(subject.id));
    }
    if (endpoint.startsWith("study_materials?")) return fixtures.studyMaterialsRequest || [];
    return [];
  }),
}));

function renderSession(mode: "lessons" | "reviews") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return Object.assign(render(<QueryClientProvider client={client}><CoreStudySession mode={mode} /></QueryClientProvider>), { client });
}

describe("core study prompt layout", () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", { writable: true, value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  });

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.clearAllMocks();
    fixtures.studyMaterialsRequest = null;
    fixtures.lessonAssignmentsResponse = [fixtures.lessonAssignment];
    fixtures.reviewAssignmentsResponse = [fixtures.reviewAssignment];
  });
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
    Object.assign(fixtures.settings.study, {
      reviewOrder: "oldestAvailableFirst",
      customReviewOrder: "random",
      reviewTypeOrderEnabled: false,
      reviewTypeOrder: ["radical", "kanji", "vocabulary"],
      prioritizeCriticalItems: false,
      reviewBatchSizeEnabled: true,
      reviewBatchSize: 10,
      reviewQuestionOrderEnabled: true,
      reviewQuestionOrder: "meaning-first",
      backToBackQuestions: false,
      backToBackImmediateRetryIncorrect: false,
      reviewAnimatePreviousQuestion: true,
      showReviewItemLevelAndSrsStage: false,
      showVocabularyFrequency: false,
      showVocabContextSentencesInReviews: false,
      allowSkippingReviews: false,
      reviewSearchButtonEnabled: false,
      reviewCharacterFontScale: 1,
      reviewInputFontScale: 1,
      answerFeedbackSoundEnabled: true,
      pauseOnWrong: true,
      pauseOnClose: false,
      pauseOnCorrect: false,
      srsProgressionCardDisplayMode: "normal",
      acceptUserSynonymsAsAnswers: false,
      showAddSynonymButton: true,
      showAnswerStopSubjectDetails: false,
      shuffleSubjects: false,
      vocabularyAudioVoice: "female",
      ankiMode: "off",
      ankiGroupQuestions: false,
      ankiHideAnswerCompletely: false,
      ankiShowOtherAcceptedAnswersAndUserSynonyms: false,
      ankiShowWaniKaniGrammarTags: false,
      ankiShowPitchAccentNumbers: false,
      ankiShowPitchAccentGraph: false,
      ankiButtonlessMode: false,
      ankiShowReplayAudioButton: false,
    });
  });

  it("chunks large answer-context and study-material ID collections", async () => {
    const ids = Array.from({ length: 1_001 }, (_, index) => index + 1);
    vi.mocked(wkCollection).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await fetchCoreStudyCollectionByIds("subjects", "ids", ids);

    expect(vi.mocked(wkCollection).mock.calls.map(([endpoint]) => endpoint)).toEqual([
      `subjects?ids=${ids.slice(0, 500).join(",")}`,
      `subjects?ids=${ids.slice(500, 1_000).join(",")}`,
      "subjects?ids=1001",
    ]);

    vi.mocked(wkCollection).mockClear();
    vi.mocked(wkCollection).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await fetchCoreStudyCollectionByIds("study_materials", "subject_ids", ids);

    expect(vi.mocked(wkCollection).mock.calls.map(([endpoint]) => endpoint)).toEqual([
      `study_materials?subject_ids=${ids.slice(0, 500).join(",")}`,
      `study_materials?subject_ids=${ids.slice(500, 1_000).join(",")}`,
      "study_materials?subject_ids=1001",
    ]);
  });

  it("keeps review level and SRS metadata opt-in as one mobile-parity setting", async () => {
    renderSession("reviews");
    expect(await screen.findByRole("heading", { name: "meaning" })).toBeInTheDocument();
    expect(screen.queryByText("Level 4")).not.toBeInTheDocument();
    expect(screen.queryByText("Apprentice III")).not.toBeInTheDocument();

    cleanup();
    window.localStorage.clear();
    fixtures.settings.study.showReviewItemLevelAndSrsStage = true;
    renderSession("reviews");
    expect(await screen.findByText("Level 4")).toBeInTheDocument();
    expect(screen.getByText("Apprentice III")).toBeInTheDocument();
  });

  it("shows up to three Japanese context hints while keeping translations gated", async () => {
    fixtures.settings.study.showVocabContextSentencesInReviews = true;
    renderSession("reviews");

    expect(await screen.findByText("• 川を渡ります。")).toBeInTheDocument();
    expect(screen.getByText("• 川で泳ぎます。")).toBeInTheDocument();
    expect(screen.getByText("• 川は静かです。")).toBeInTheDocument();
    expect(screen.queryByText("I cross the river.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show translations" }));
    expect(screen.getByText("• I cross the river.")).toBeInTheDocument();
    expect(screen.getByText("• I swim in the river.")).toBeInTheDocument();
    expect(screen.getByText("• The river is quiet.")).toBeInTheDocument();
  });

  it("looks up and formats vocabulary frequency only when enabled", async () => {
    const frequencyFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      result: {
        provider: "jiten",
        frequencyRank: 1500,
        wordId: 25,
        readingIndex: 0,
        matchedText: "川",
        matchedReading: "かわ",
        sourceUrl: "https://jiten.moe/search?query=%E5%B7%9D",
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", frequencyFetch);

    renderSession("reviews");
    expect(await screen.findByRole("heading", { name: "meaning" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Vocabulary frequency/)).not.toBeInTheDocument();
    expect(frequencyFetch).not.toHaveBeenCalled();

    cleanup();
    window.localStorage.clear();
    fixtures.settings.study.showVocabularyFrequency = true;
    renderSession("reviews");
    expect(await screen.findByLabelText("Vocabulary frequency #1,500")).toHaveTextContent("#1,500");
    expect(frequencyFetch).toHaveBeenCalledOnce();
  });

  it("adds opt-in skip and search controls without exposing them by default", async () => {
    renderSession("reviews");
    expect(await screen.findByRole("heading", { name: "meaning" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skip review" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Search this item" })).not.toBeInTheDocument();

    cleanup();
    window.localStorage.clear();
    fixtures.settings.study.allowSkippingReviews = true;
    fixtures.settings.study.reviewSearchButtonEnabled = true;
    renderSession("reviews");
    expect(await screen.findByRole("button", { name: "Skip review" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search this item" })).toHaveAttribute("href", "/search?q=%E5%B7%9D");
  });

  it("groups meaning and reading on self-assessment cards", async () => {
    fixtures.settings.study.ankiMode = "both";
    fixtures.settings.study.ankiGroupQuestions = true;
    renderSession("reviews");

    expect(await screen.findByRole("region", { name: "Anki answer" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Your answer" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Reveal answer/i }));
    const revealedAnswer = screen.getByTestId("anki-answer-content");
    expect(revealedAnswer).toHaveTextContent("River");
    expect(revealedAnswer).toHaveTextContent("かわ");
    fireEvent.click(screen.getByRole("button", { name: /Correct/i }));
    expect(await screen.findByText("Correct")).toBeInTheDocument();
  });

  it("shows the submitted SRS progression using the selected card size", async () => {
    fixtures.reviewAssignmentsResponse = [
      fixtures.reviewAssignment,
      { ...fixtures.reviewAssignment, id: 102, data: { ...fixtures.reviewAssignment.data } },
    ];
    fixtures.settings.study.ankiMode = "both";
    fixtures.settings.study.ankiGroupQuestions = true;
    fixtures.settings.study.srsProgressionCardDisplayMode = "compact";
    fixtures.settings.study.pauseOnCorrect = true;
    const { container } = renderSession("reviews");

    await screen.findByRole("region", { name: "Anki answer" });
    const reservedSlot = container.querySelector("[data-srs-progression-slot]");
    expect(reservedSlot).toHaveAttribute("data-mode", "compact");
    expect(reservedSlot).toHaveAttribute("data-progression-visible", "false");
    expect(reservedSlot).not.toHaveAttribute("aria-hidden");
    expect(screen.getByLabelText("Question status")).toHaveTextContent("0 mistakes");
    expect(screen.queryByLabelText("SRS progression")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Reveal answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /Correct/i }));
    const timeoutSpy = vi.spyOn(window, "setTimeout");

    try {
      fireEvent.click(await screen.findByRole("button", { name: "Next Question" }));

      const progression = await screen.findByLabelText("SRS progression");
      expect(progression).toHaveAttribute("data-mode", "compact");
      expect(progression).toHaveTextContent("Apprentice IV");
      expect(progression).toHaveTextContent("Next review");

      const activeSlot = container.querySelector("[data-srs-progression-slot]");
      expect(activeSlot).toHaveAttribute("data-mode", "compact");
      expect(activeSlot).toHaveAttribute("data-progression-visible", "true");
      expect(screen.queryByLabelText("Question status")).not.toBeInTheDocument();

      const dismissProgression = timeoutSpy.mock.calls.find(([, delay]) => delay === 3_000)?.[0];
      expect(dismissProgression).toBeTypeOf("function");
      act(() => {
        if (typeof dismissProgression === "function") dismissProgression();
      });

      expect(screen.queryByLabelText("SRS progression")).not.toBeInTheDocument();
      expect(container.querySelector("[data-srs-progression-slot]")).toBe(activeSlot);
      expect(activeSlot).toHaveAttribute("data-progression-visible", "false");
      expect(screen.getByLabelText("Question status")).toHaveTextContent("0 mistakes");
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("does not reserve or announce progression when its display mode is hidden", async () => {
    fixtures.settings.study.srsProgressionCardDisplayMode = "hidden";
    const { container } = renderSession("reviews");

    expect(await screen.findByRole("heading", { name: "meaning" })).toBeInTheDocument();
    expect(container.querySelector("[data-srs-progression-slot]")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Question status")).toHaveTextContent("0 mistakes");
    expect(screen.queryByLabelText("SRS progression")).not.toBeInTheDocument();
  });

  it("keeps answers and item details out of an active review until feedback", async () => {
    fixtures.settings.study.pauseOnCorrect = true;
    renderSession("reviews");

    expect(await screen.findByRole("heading", { name: "meaning" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Study progress" })).toBeInTheDocument();
    expect(screen.getByText("1 / 1")).toBeInTheDocument();
    expect(screen.getByText("vocabulary")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Info" })).toBeDisabled();
    expect(screen.queryByText("River")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Item details" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), { target: { value: "River" } });
    fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));

    expect(await screen.findByText("Correct")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Item details" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Info" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Info" }));
    expect(await screen.findByRole("heading", { name: "Item details" })).toBeInTheDocument();
    expect(screen.getAllByText("River").length).toBeGreaterThan(0);
    expect(screen.getByRole("tab", { name: "Meaning" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mnemonic" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Notes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your progression" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Reading" }));
    expect(screen.getByRole("heading", { name: "Readings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reading mnemonic" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pronunciation" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Context" }));
    expect(screen.getByRole("heading", { name: "Context sentences" })).toBeInTheDocument();
    expect(screen.getByText("川を渡ります。")).toBeInTheDocument();
  });

  it("collapses open subject details before replacing the answered question", async () => {
    fixtures.settings.study.pauseOnCorrect = true;
    fixtures.settings.study.showAnswerStopSubjectDetails = true;
    renderSession("reviews");

    const answerInput = await screen.findByRole("textbox", { name: "Your answer" });
    fireEvent.change(answerInput, { target: { value: "River" } });
    fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));
    expect(await screen.findByRole("heading", { name: "Item details" })).toBeInTheDocument();
    const details = document.getElementById("study-item-details");
    expect(details).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next Question" }));

    expect(screen.getByRole("heading", { name: "meaning" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "reading" })).not.toBeInTheDocument();
    expect(details).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Item details" })).not.toBeInTheDocument();

    expect(await screen.findByRole("heading", { name: "reading" })).toBeInTheDocument();
    expect(document.getElementById("study-item-details")).not.toBeInTheDocument();
  });

  it("keeps automatic details closed for self-assessment feedback but still allows manual Info", async () => {
    fixtures.settings.study.ankiMode = "meaning";
    fixtures.settings.study.pauseOnCorrect = true;
    fixtures.settings.study.showAnswerStopSubjectDetails = true;
    renderSession("reviews");

    expect(await screen.findByRole("region", { name: "Anki answer" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Reveal answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /Correct/i }));
    expect(await screen.findByText("Correct")).toBeInTheDocument();

    const info = screen.getByRole("button", { name: "Info" });
    expect(info).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("heading", { name: "Item details" })).not.toBeInTheDocument();

    fireEvent.click(info);
    expect(await screen.findByRole("heading", { name: "Item details" })).toBeInTheDocument();
    expect(info).toHaveAttribute("aria-expanded", "true");
  });

  it("uses Info to close and reopen canonical subject details", async () => {
    fixtures.settings.study.pauseOnCorrect = true;
    renderSession("reviews");

    const answerInput = await screen.findByRole("textbox", { name: "Your answer" });
    fireEvent.change(answerInput, { target: { value: "River" } });
    fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));
    expect(await screen.findByText("Correct")).toBeInTheDocument();

    const info = screen.getByRole("button", { name: "Info" });
    fireEvent.click(info);
    expect(await screen.findByRole("heading", { name: "Item details" })).toBeInTheDocument();
    expect(info).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(info);
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Item details" })).not.toBeInTheDocument());
    expect(info).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(info);
    expect(await screen.findByRole("heading", { name: "Item details" })).toBeInTheDocument();
    expect(info).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps review shortcuts out of the custom pronunciation control", async () => {
    fixtures.settings.study.pauseOnCorrect = true;
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    const { container } = renderSession("reviews");

    try {
      const answerInput = await screen.findByRole("textbox", { name: "Your answer" });
      fireEvent.change(answerInput, { target: { value: "River" } });
      fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));
      expect(await screen.findByText("Correct")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Info" }));
      expect(await screen.findByRole("heading", { name: "Item details" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("tab", { name: "Reading" }));

      const pronunciation = screen.getByRole("button", { name: "Play Kyoko pronunciation" });
      expect(container.querySelector("#study-item-details audio[controls]")).not.toBeInTheDocument();
      expect(screen.queryByRole("slider")).not.toBeInTheDocument();
      fireEvent.keyDown(pronunciation, { key: " ", code: "Space" });

      expect(play).not.toHaveBeenCalled();
      expect(screen.getByRole("heading", { name: "Item details" })).toBeInTheDocument();
      fireEvent.click(pronunciation);
      await waitFor(() => expect(play).toHaveBeenCalledOnce());
      expect(screen.getByRole("button", { name: "Stop Kyoko pronunciation" })).toBeInTheDocument();
    } finally {
      play.mockRestore();
      pause.mockRestore();
    }
  });

  it("does not advance while Enter is handled by the subject details editor", async () => {
    fixtures.settings.study.pauseOnCorrect = true;
    renderSession("reviews");

    const answerInput = await screen.findByRole("textbox", { name: "Your answer" });
    fireEvent.change(answerInput, { target: { value: "River" } });
    fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));
    expect(await screen.findByText("Correct")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Info" }));
    expect(await screen.findByRole("heading", { name: "Item details" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const meaningNote = screen.getByRole("textbox", { name: "Meaning note" });
    fireEvent.keyDown(meaningNote, { key: "Enter" });
    expect(screen.getByRole("heading", { name: "meaning" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Item details" })).toBeInTheDocument();

    const preventedEnter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    preventedEnter.preventDefault();
    fireEvent(window, preventedEnter);
    expect(screen.getByRole("heading", { name: "meaning" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Enter" });
    expect(await screen.findByRole("heading", { name: "reading" })).toBeInTheDocument();
  });

  it("composes romaji into hiragana while a reading answer is typed", async () => {
    fixtures.settings.study.reviewQuestionOrder = "reading-first";
    renderSession("reviews");

    expect(await screen.findByRole("heading", { name: "reading" })).toBeInTheDocument();
    const input = screen.getByRole("textbox", { name: "Your answer" });
    fireEvent.change(input, { target: { value: "kawa" } });

    expect(input).toHaveValue("かわ");
  });

  it("autoplays the selected vocabulary voice after a correct reading in normal reviews and lessons", async () => {
    const originalAudios = fixtures.subject.data.pronunciation_audios;
    const playedSources: string[] = [];
    fixtures.settings.study.autoplayAudio = true;
    fixtures.settings.study.lessonQuestionOrder = "reading-first";
    fixtures.settings.study.reviewQuestionOrder = "reading-first";
    fixtures.settings.study.vocabularyAudioVoice = "male";
    fixtures.subject.data.pronunciation_audios = [
      originalAudios[0],
      { url: "https://example.com/kawa-kenichi.mp3", content_type: "audio/mpeg", metadata: { gender: "male", source_id: 2, pronunciation: "かわ", voice_actor_id: 2, voice_actor_name: "Kenichi", voice_description: "Tokyo accent" } },
    ];
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
      playedSources.push(this.src);
      return Promise.resolve();
    });

    try {
      for (const mode of ["reviews", "lessons"] as const) {
        renderSession(mode);
        if (mode === "lessons") fireEvent.click(await screen.findByRole("button", { name: "Start lesson review" }));
        expect(await screen.findByRole("heading", { name: "reading" })).toBeInTheDocument();
        fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), { target: { value: "kawa" } });
        fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));

        expect(await screen.findByText("Correct")).toBeInTheDocument();
        await waitFor(() => expect(playedSources).toHaveLength(mode === "reviews" ? 1 : 2));
        cleanup();
        window.localStorage.clear();
      }
      expect(playedSources).toEqual([
        "https://example.com/kawa-kenichi.mp3",
        "https://example.com/kawa-kenichi.mp3",
      ]);
    } finally {
      play.mockRestore();
      fixtures.subject.data.pronunciation_audios = originalAudios;
      fixtures.settings.study.autoplayAudio = false;
      fixtures.settings.study.lessonQuestionOrder = "meaning-first";
    }
  });

  it("waits for personal meanings before accepting answers, then honors a user synonym", async () => {
    fixtures.settings.study.acceptUserSynonymsAsAnswers = true;
    let resolveMaterials!: (materials: typeof fixtures.studyMaterial[]) => void;
    fixtures.studyMaterialsRequest = new Promise((resolve) => { resolveMaterials = resolve; });
    renderSession("reviews");

    await waitFor(() => expect(vi.mocked(wkCollection).mock.calls.some(([endpoint]) => endpoint.startsWith("study_materials?"))).toBe(true));
    expect(screen.queryByRole("textbox", { name: "Your answer" })).not.toBeInTheDocument();

    await act(async () => resolveMaterials([fixtures.studyMaterial]));
    const input = await screen.findByRole("textbox", { name: "Your answer" });
    fireEvent.change(input, { target: { value: "watercourse" } });
    fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));

    expect(await screen.findByText("Correct")).toBeInTheDocument();
  });

  it("keeps user synonyms opt-in like the mobile review checker", async () => {
    fixtures.studyMaterialsRequest = Promise.resolve([fixtures.studyMaterial]);
    renderSession("reviews");

    const input = await screen.findByRole("textbox", { name: "Your answer" });
    fireEvent.change(input, { target: { value: "watercourse" } });
    fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));

    expect(await screen.findByText("Incorrect")).toBeInTheDocument();
  });

  it("adds a paused wrong meaning as a user synonym and marks it correct", async () => {
    fixtures.studyMaterialsRequest = Promise.resolve([fixtures.studyMaterial]);
    renderSession("reviews");

    const input = await screen.findByRole("textbox", { name: "Your answer" });
    fireEvent.change(input, { target: { value: "Waterway" } });
    fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));

    expect(await screen.findByText("Incorrect")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add as synonym" }));

    await waitFor(() => expect(vi.mocked(wkRequest)).toHaveBeenCalledWith("study_materials/300", {
      method: "PUT",
      body: { study_material: { meaning_synonyms: ["watercourse", "waterway"] } },
    }));
    expect(await screen.findByText("Added “waterway” as a synonym and marked the answer correct.")).toBeInTheDocument();
    expect(screen.getByText("0 mistakes")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add as synonym" })).not.toBeInTheDocument();
  });

  it("moves the previous review answer into a stable linked corner card", async () => {
    fixtures.reviewAssignmentsResponse = [
      fixtures.reviewAssignment,
      { ...fixtures.reviewAssignment, id: 102, data: { ...fixtures.reviewAssignment.data } },
    ];
    fixtures.settings.study.pauseOnCorrect = true;
    renderSession("reviews");

    const input = await screen.findByRole("textbox", { name: "Your answer" });
    fireEvent.change(input, { target: { value: "River" } });
    fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));
    fireEvent.click(await screen.findByRole("button", { name: "Next Question" }));

    const previous = await screen.findByRole("link", { name: "Previous meaning answer: River, correct" });
    expect(previous).toHaveAttribute("href", "/subjects/200");
    expect(previous).toHaveAttribute("data-animate", "true");
  });

  it("accepts a close meaning answer without recording a mistake", async () => {
    renderSession("reviews");

    const input = await screen.findByRole("textbox", { name: "Your answer" });
    fireEvent.change(input, { target: { value: "rivr" } });
    fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));

    expect(await screen.findByText("Accepted with a typo")).toBeInTheDocument();
    expect(screen.getByText("Correct, with a small typo.")).toBeInTheDocument();
    expect(screen.getByText("0 mistakes")).toBeInTheDocument();
  });

  it("requires a paused close answer to be marked incorrect before retrying it", async () => {
    fixtures.settings.study.pauseOnClose = true;
    renderSession("reviews");

    const input = await screen.findByRole("textbox", { name: "Your answer" });
    fireEvent.change(input, { target: { value: "rivr" } });
    fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));

    expect(await screen.findByRole("button", { name: "Mark Incorrect" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark Correct" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next Question" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mark Incorrect" }));

    expect(await screen.findByRole("heading", { name: "reading" })).toBeInTheDocument();
    expect(screen.getByText("1 mistake")).toBeInTheDocument();
    expect(playAnswerFeedback).toHaveBeenLastCalledWith(false);
  });

  it("requires a paused close answer to be marked correct before accepting it", async () => {
    fixtures.settings.study.pauseOnClose = true;
    renderSession("reviews");

    const input = await screen.findByRole("textbox", { name: "Your answer" });
    fireEvent.change(input, { target: { value: "rivr" } });
    fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));
    fireEvent.click(await screen.findByRole("button", { name: "Mark Correct" }));

    expect(await screen.findByRole("heading", { name: "reading" })).toBeInTheDocument();
    expect(screen.getByText("0 mistakes")).toBeInTheDocument();
    expect(playAnswerFeedback).toHaveBeenLastCalledWith(true);
  });

  it("treats Enter as Mark Correct for a paused close answer", async () => {
    fixtures.settings.study.pauseOnClose = true;
    renderSession("reviews");

    const input = await screen.findByRole("textbox", { name: "Your answer" });
    fireEvent.change(input, { target: { value: "rivr" } });
    fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));
    expect(await screen.findByRole("button", { name: "Mark Correct" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Enter" });

    expect(await screen.findByRole("heading", { name: "reading" })).toBeInTheDocument();
    expect(screen.getByText("0 mistakes")).toBeInTheDocument();
    expect(playAnswerFeedback).toHaveBeenLastCalledWith(true);
  });

  it("uses answer feedback sounds for typed and Anki-mode grades", async () => {
    renderSession("reviews");
    const input = await screen.findByRole("textbox", { name: "Your answer" });
    fireEvent.change(input, { target: { value: "River" } });
    fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));
    expect(playAnswerFeedback).toHaveBeenCalledWith(true);

    cleanup();
    window.localStorage.clear();
    vi.mocked(playAnswerFeedback).mockClear();
    fixtures.settings.study.ankiMode = "both";
    fixtures.settings.study.ankiGroupQuestions = true;
    renderSession("reviews");
    fireEvent.click(await screen.findByRole("button", { name: /Reveal answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /Wrong/i }));
    expect(playAnswerFeedback).toHaveBeenCalledWith(false);
  });

  it("keeps core answer feedback sounds disabled when configured", async () => {
    fixtures.settings.study.answerFeedbackSoundEnabled = false;
    renderSession("reviews");

    const input = await screen.findByRole("textbox", { name: "Your answer" });
    fireEvent.change(input, { target: { value: "River" } });
    fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));

    expect(playAnswerFeedback).not.toHaveBeenCalled();
  });

  it("warns about a reading entered for meaning and clears it for the retry", async () => {
    renderSession("reviews");

    const input = await screen.findByRole("textbox", { name: "Your answer" });
    fireEvent.change(input, { target: { value: "kawa" } });
    fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));

    expect(await screen.findByText("Try another answer")).toBeInTheDocument();
    expect(screen.getByText("You entered the reading, but we want the meaning.")).toBeInTheDocument();
    expect(screen.getByText("0 mistakes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(input).toHaveValue("");
  });

  it("lets the user retry a kanji reading entered for single-kanji vocabulary", async () => {
    fixtures.settings.study.reviewQuestionOrder = "reading-first";
    renderSession("reviews");

    expect(await screen.findByRole("heading", { name: "reading" })).toBeInTheDocument();
    const input = screen.getByRole("textbox", { name: "Your answer" });
    fireEvent.change(input, { target: { value: "sen" } });
    fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));

    expect(await screen.findByText("Try another answer")).toBeInTheDocument();
    expect(screen.getByText("This is a reading for the individual kanji, not the vocabulary.")).toBeInTheDocument();
    expect(screen.getByText("0 mistakes")).toBeInTheDocument();
  });

  it("uses the subject-page grammar for lesson teaching before its review", async () => {
    renderSession("lessons");

    expect(await screen.findByRole("progressbar", { name: "Lesson progress" })).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByRole("heading", { name: "River" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Meaning" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Mnemonic" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore River constellation" })).toHaveAttribute("href", "/subjects/200/constellation");
    expect(screen.getByRole("navigation", { name: "Lesson navigation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lesson 1: River" })).toHaveAttribute("aria-current", "step");

    fireEvent.click(screen.getByRole("button", { name: "Start lesson review" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "meaning" })).toBeInTheDocument());
    expect(screen.getByText("1 / 1")).toBeInTheDocument();
    expect(screen.queryByText("River")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Info" })).toBeDisabled();
  });

  it("keeps every lesson in the batch centered between previous and next controls", async () => {
    fixtures.lessonAssignmentsResponse = [fixtures.lessonAssignment, fixtures.secondLessonAssignment];
    renderSession("lessons");

    expect(await screen.findByRole("heading", { name: "River" })).toBeInTheDocument();
    const previous = screen.getByRole("button", { name: "Previous lesson" });
    expect(previous).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next lesson" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lesson 1: River" })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: "Lesson 2: Fire" })).not.toHaveAttribute("aria-current");

    const fireLesson = screen.getByRole("button", { name: "Lesson 2: Fire" });
    const keepActiveLessonVisible = vi.fn();
    Object.defineProperty(fireLesson, "scrollIntoView", { configurable: true, value: keepActiveLessonVisible });
    fireEvent.click(fireLesson);
    expect(await screen.findByRole("heading", { name: "Fire" })).toBeInTheDocument();
    await waitFor(() => expect(keepActiveLessonVisible).toHaveBeenCalledWith({ block: "nearest", inline: "nearest" }));
    expect(screen.getByRole("button", { name: "Lesson 2: Fire" })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("tab", { name: "Meaning" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Start lesson review" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Previous lesson" }));
    expect(await screen.findByRole("heading", { name: "River" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Meaning" })).toHaveAttribute("aria-selected", "true");
  });

  it("walks through tabs, subjects, and into lesson review with the arrow keys", async () => {
    fixtures.lessonAssignmentsResponse = [fixtures.lessonAssignment, fixtures.secondLessonAssignment];
    renderSession("lessons");

    expect(await screen.findByRole("heading", { name: "River" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Reading" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Context" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(window, { key: "ArrowRight" });

    expect(await screen.findByRole("heading", { name: "Fire" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Meaning" })).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(await screen.findByRole("heading", { name: "River" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Meaning" })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("button", { name: "Lesson 2: Fire" }));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Reading" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Stroke" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(window, { key: "ArrowRight" });

    expect(await screen.findByRole("heading", { name: "meaning" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Lesson navigation" })).not.toBeInTheDocument();
  });

  it("moves focus to the first tab when a tab arrow crosses into another subject", async () => {
    fixtures.lessonAssignmentsResponse = [fixtures.lessonAssignment, fixtures.secondLessonAssignment];
    renderSession("lessons");

    expect(await screen.findByRole("heading", { name: "River" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Context" }));
    const contextTab = screen.getByRole("tab", { name: "Context" });
    contextTab.focus();
    fireEvent.keyDown(contextTab, { key: "ArrowRight" });

    expect(await screen.findByRole("heading", { name: "Fire" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("tab", { name: "Meaning" })).toHaveFocus());
  });

  it("restores the teaching subject and tab after a constellation detour", async () => {
    fixtures.lessonAssignmentsResponse = [fixtures.lessonAssignment, fixtures.secondLessonAssignment];
    const firstRender = renderSession("lessons");

    expect(await screen.findByRole("heading", { name: "River" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lesson 2: Fire" }));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Reading" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(window.localStorage.getItem("kakehashi:core-study:study-test:lesson-teaching")).not.toBeNull());

    firstRender.unmount();
    renderSession("lessons");

    expect(await screen.findByRole("heading", { name: "Fire" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Reading" })).toHaveAttribute("aria-selected", "true");
  });

  it("keeps a shuffled lesson batch stable when a new tab restores it", async () => {
    fixtures.settings.study.shuffleSubjects = true;
    fixtures.lessonAssignmentsResponse = [fixtures.lessonAssignment, fixtures.secondLessonAssignment];
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    const firstRender = renderSession("lessons");

    expect(await screen.findByRole("heading", { name: "Fire" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Reading" }));
    await waitFor(() => expect(window.localStorage.getItem("kakehashi:core-study:study-test:lesson-teaching")).not.toBeNull());

    firstRender.unmount();
    random.mockReturnValue(0.999);
    renderSession("lessons");

    expect(await screen.findByRole("heading", { name: "Fire" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Reading" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Lesson 1: Fire" })).toHaveAttribute("aria-current", "step");
    random.mockRestore();
  });

  it("keeps a fresh lesson review stable when subjects leave the available queue", async () => {
    fixtures.lessonAssignmentsResponse = [fixtures.lessonAssignment, fixtures.secondLessonAssignment];
    const { client } = renderSession("lessons");

    expect(await screen.findByRole("heading", { name: "River" })).toBeInTheDocument();
    await waitFor(() => expect(wkCollection).toHaveBeenCalledWith("assignments?subject_ids=200,202"));
    fireEvent.click(screen.getByRole("button", { name: "Lesson 2: Fire" }));
    fireEvent.click(screen.getByRole("button", { name: "Start lesson review" }));
    expect(await screen.findByRole("heading", { name: "meaning" })).toBeInTheDocument();
    expect(screen.getByText("川")).toBeInTheDocument();

    fixtures.lessonAssignmentsResponse = [fixtures.secondLessonAssignment];
    await act(async () => {
      await client.invalidateQueries({ queryKey: ["core-study", "lessons", "assignments"] });
    });

    expect(screen.getByRole("heading", { name: "meaning" })).toBeInTheDocument();
    expect(screen.getByText("川")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Lesson navigation" })).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("kakehashi:core-study:study-test:lesson-teaching") || "null").subjectIds).toEqual([200, 202]);
  });

  it("restores a partial lesson quiz after completed assignments leave the available queue", async () => {
    fixtures.lessonAssignmentsResponse = [fixtures.secondLessonAssignment];
    const savedAt = new Date().toISOString();
    window.localStorage.setItem("kakehashi:core-study:study-test:lesson-teaching", JSON.stringify({ savedAt, subjectIds: [200, 202], index: 1, tab: "meaning" }));
    window.localStorage.setItem("kakehashi-core-session:study-test:lessons", JSON.stringify({
      savedAt,
      startedAt: savedAt,
      questionIds: ["103:meaning", "103:reading"],
      completed: { 101: ["meaning", "reading"] },
      errors: {},
      submittedIds: [101],
    }));

    renderSession("lessons");

    expect(await screen.findByRole("heading", { name: "Resume lessons?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue Session" }));
    expect(await screen.findByRole("heading", { name: "meaning" })).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(screen.getByText("火")).toBeInTheDocument();
  });

  it("starts a partial lesson resume fresh with only currently unstarted assignments", async () => {
    fixtures.lessonAssignmentsResponse = [fixtures.secondLessonAssignment];
    const savedAt = new Date().toISOString();
    window.localStorage.setItem("kakehashi:core-study:study-test:lesson-teaching", JSON.stringify({ savedAt, subjectIds: [200, 202], index: 1, tab: "meaning" }));
    window.localStorage.setItem("kakehashi-core-session:study-test:lessons", JSON.stringify({
      savedAt,
      startedAt: savedAt,
      questionIds: ["103:meaning", "103:reading"],
      completed: { 101: ["meaning", "reading"] },
      errors: {},
      submittedIds: [101],
    }));

    renderSession("lessons");

    expect(await screen.findByRole("heading", { name: "Resume lessons?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start Fresh" }));
    expect(await screen.findByRole("heading", { name: "Fire" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lesson 1: Fire" })).toHaveAttribute("aria-current", "step");
    expect(screen.queryByRole("button", { name: "Lesson 2: Fire" })).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("kakehashi:core-study:study-test:lesson-teaching") || "null").subjectIds).toEqual([202]);
  });

  it("does not steal lesson arrows from subject note fields", async () => {
    renderSession("lessons");

    expect(await screen.findByRole("heading", { name: "River" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const meaningNote = screen.getByRole("textbox", { name: "Meaning note" });
    fireEvent.keyDown(meaningNote, { key: "ArrowRight" });

    expect(screen.getByRole("tab", { name: "Meaning" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "River" })).toBeInTheDocument();
  });
});
