import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CoreStudySession } from "./CoreStudySession";

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
      context_sentences: [{ ja: "川を渡ります。", en: "I cross the river." }],
      pronunciation_audios: [{ url: "https://example.com/kawa.mp3", content_type: "audio/mpeg", metadata: {} }],
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
  const settings = {
    study: {
      autoplayAudio: false,
      showSrsIndicator: true,
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
      ankiMode: "off",
      voiceAnswers: false,
      jitaiEnabled: false,
      jitaiSelectedFontIds: [],
      jitaiCustomFonts: [],
      immersionKitAnimeSources: [],
      epubDailyGoalMinutes: 5,
    },
  };
  return { lessonAssignment, reviewAssignment, settings, subject, user };
});

vi.mock("@/lib/session", () => ({ useSession: () => ({ user: fixtures.user }) }));

vi.mock("@/features/settings/use-workspace-preferences", () => ({
  useWebSettings: () => fixtures.settings,
}));

vi.mock("@/features/settings/jitai", () => ({ installCustomJitaiFonts: vi.fn().mockResolvedValue(undefined), resolveJitaiFontFamily: () => undefined }));

vi.mock("@/lib/wanikani/client", () => ({
  WaniKaniApiError: class extends Error {},
  wkRequest: vi.fn(async (endpoint: string) => endpoint === "user" ? fixtures.user : fixtures.reviewAssignment),
  wkCollection: vi.fn(async (endpoint: string) => {
    if (endpoint.includes("immediately_available_for_lessons")) return [fixtures.lessonAssignment];
    if (endpoint.includes("immediately_available_for_review")) return [fixtures.reviewAssignment];
    if (endpoint.startsWith("subjects?")) return [fixtures.subject];
    if (endpoint.startsWith("study_materials?")) return [];
    return [];
  }),
}));

function renderSession(mode: "lessons" | "reviews") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><CoreStudySession mode={mode} /></QueryClientProvider>);
}

describe("core study prompt layout", () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", { writable: true, value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  });

  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    fixtures.settings.study.reviewQuestionOrder = "meaning-first";
  });

  it("keeps answers and item details out of an active review until feedback", async () => {
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
    expect(screen.getByRole("heading", { name: "Item details" })).toBeInTheDocument();
    expect(screen.getByText("River")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Info" })).toBeEnabled();
  });

  it("composes romaji into hiragana while a reading answer is typed", async () => {
    fixtures.settings.study.reviewQuestionOrder = "reading-first";
    renderSession("reviews");

    expect(await screen.findByRole("heading", { name: "reading" })).toBeInTheDocument();
    const input = screen.getByRole("textbox", { name: "Your answer" });
    fireEvent.change(input, { target: { value: "kawa" } });

    expect(input).toHaveValue("かわ");
  });

  it("uses the same prompt grammar for lesson teaching and its quiz", async () => {
    renderSession("lessons");

    expect(await screen.findByRole("progressbar", { name: "Lesson progress" })).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByRole("heading", { name: "River" })).toBeInTheDocument();
    expect(screen.getByText("Lesson", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play audio" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start Quiz" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "meaning" })).toBeInTheDocument());
    expect(screen.getByText("1 / 1")).toBeInTheDocument();
    expect(screen.queryByText("River")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Info" })).toBeDisabled();
  });
});
