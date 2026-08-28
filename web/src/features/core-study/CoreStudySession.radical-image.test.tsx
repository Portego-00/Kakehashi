import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CoreStudySession } from "./CoreStudySession";

const fixtures = vi.hoisted(() => {
  const radicalSvgUrl = "https://files.wanikani.com/rib-cage.svg";
  const radical = {
    id: 876,
    object: "radical",
    url: "https://api.wanikani.com/v2/subjects/876",
    data_updated_at: "2026-08-17T00:00:00.000Z",
    data: {
      level: 4,
      created_at: "2026-01-01T00:00:00.000Z",
      slug: "rib-cage",
      document_url: "https://www.wanikani.com/radicals/rib-cage",
      hidden_at: null,
      characters: null,
      meanings: [{ meaning: "Rib Cage", primary: true, accepted_answer: true }],
      auxiliary_meanings: [],
      meaning_mnemonic: "Picture a rib cage protecting your heart.",
      amalgamation_subject_ids: [],
      character_images: [
        {
          url: "https://files.wanikani.com/rib-cage-256.png",
          content_type: "image/png",
          metadata: { color: "#000000", dimensions: "256x256", style_name: "256px" },
        },
        {
          url: radicalSvgUrl,
          content_type: "image/svg+xml",
          metadata: { inline_styles: true },
        },
      ],
    },
  };
  const assignment = {
    id: 100,
    object: "assignment",
    url: "https://api.wanikani.com/v2/assignments/100",
    data_updated_at: "2026-08-17T00:00:00.000Z",
    data: {
      subject_id: radical.id,
      subject_type: "radical",
      srs_stage: 3,
      available_at: "2026-08-16T00:00:00.000Z",
      started_at: "2026-01-02T00:00:00.000Z",
      unlocked_at: "2026-01-01T00:00:00.000Z",
      passed_at: null,
      burned_at: null,
      resurrected_at: null,
      hidden: false,
      created_at: "2026-01-01T00:00:00.000Z",
    },
  };
  const user = {
    id: 1,
    object: "user",
    url: "https://api.wanikani.com/v2/user",
    data_updated_at: "2026-08-17T00:00:00.000Z",
    data: {
      username: "radical-image-test",
      level: 4,
      profile_url: "https://www.wanikani.com/users/radical-image-test",
      started_at: "2026-01-01T00:00:00.000Z",
      current_vacation_started_at: null,
      preferences: {},
      subscription: {},
    },
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
      keyboardShortcuts: true,
      shuffleSubjects: false,
      lessonsBatchSize: 5,
      answerOrder: "mixed",
      dailyLessonLimit: 0,
      lessonOrder: "available",
      reviewOrder: "available",
      reviewBatchSize: 10,
      reviewWrapUpSize: 5,
      lessonQuestionOrder: "meaning-first",
      reviewQuestionOrder: "meaning-first",
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
  return { assignment, radical, radicalSvgUrl, settings, user };
});

vi.mock("@/lib/session", () => ({ useSession: () => ({ user: fixtures.user }) }));

vi.mock("@/features/settings/use-workspace-preferences", () => ({
  useWebSettings: () => fixtures.settings,
}));

vi.mock("@/features/settings/jitai", () => ({
  installCustomJitaiFonts: vi.fn().mockResolvedValue(undefined),
  resolveJitaiFontFamily: () => undefined,
}));

vi.mock("@/lib/wanikani/client", () => ({
  WaniKaniApiError: class extends Error {},
  wkRequest: vi.fn(async () => fixtures.user),
  wkCollection: vi.fn(async (endpoint: string) => {
    if (endpoint.includes("immediately_available_for_review")) return [fixtures.assignment];
    if (endpoint.startsWith("subjects?")) return [fixtures.radical];
    return [];
  }),
}));

function renderReview() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CoreStudySession mode="reviews" />
    </QueryClientProvider>,
  );
}

describe("core study radical prompt", () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it("prefers WaniKani's SVG for an image-only radical instead of showing its slug", async () => {
    renderReview();

    expect(await screen.findByRole("heading", { name: "meaning" })).toBeInTheDocument();
    const prompt = screen.getByLabelText("Review prompt");
    const radicalImage = within(prompt).getByRole("img", { name: "Rib Cage radical" });

    expect(radicalImage).toHaveAttribute("src", fixtures.radicalSvgUrl);
    expect(within(prompt).queryByText("rib-cage")).not.toBeInTheDocument();
  });
});
