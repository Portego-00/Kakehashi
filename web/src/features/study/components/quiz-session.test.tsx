import "@testing-library/jest-dom/vitest";
import { StrictMode, type ComponentProps } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_WEB_SETTINGS } from "@/features/settings/settings";
import type { Assignment, StudyMaterial, Subject } from "@/types/wanikani";
import type { StudyQuestion, StudySession } from "../types";
import { loadStudySession, sessionKey } from "../storage";
import { itemDetailsTabForQuestion, promptTypePresentation, QuizSession } from "./quiz-session";

const { wkCollectionMock, wkRequestMock } = vi.hoisted(() => ({ wkCollectionMock: vi.fn(), wkRequestMock: vi.fn() }));

vi.mock("@/lib/wanikani/client", () => ({
  wkCollection: wkCollectionMock,
  wkRequest: wkRequestMock,
}));

vi.mock("@/features/speech/use-japanese-voice", () => ({
  useJapaneseVoice: () => ({
    checked: true,
    supported: false,
    downloaded: false,
    activity: "idle",
    activeSentence: null,
    progress: null,
    message: null,
    error: null,
    download: vi.fn(),
    play: vi.fn(),
    stop: vi.fn(),
  }),
}));

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

function makeSubject(): Subject {
  return {
    id: 1,
    object: "vocabulary",
    url: "",
    data_updated_at: "2026-08-17T00:00:00.000Z",
    data: {
      level: 12,
      created_at: "2026-08-17T00:00:00.000Z",
      slug: "防ぐ",
      document_url: "https://www.wanikani.com/vocabulary/%E9%98%B2%E3%81%90",
      hidden_at: null,
      characters: "防ぐ",
      meanings: [{ meaning: "Prevent", primary: true, accepted_answer: true }],
      auxiliary_meanings: [],
      meaning_mnemonic: "Put up a shield to prevent trouble from reaching you.",
      readings: [{ reading: "ふせぐ", primary: true, accepted_answer: true }],
      reading_mnemonic: "Picture a fuse stopping the trouble before it arrives.",
      pronunciation_audios: [{
        url: "https://example.com/fusegu.mp3",
        content_type: "audio/mpeg",
        metadata: { gender: "female", source_id: 1, pronunciation: "ふせぐ", voice_actor_id: 1, voice_actor_name: "Kyoko", voice_description: "Tokyo accent" },
      }],
      context_sentences: [{ ja: "事故を防ぐ。", en: "Prevent an accident." }],
      parts_of_speech: ["transitive verb", "godan verb"],
    },
  };
}

function makeAssignment(subjectId = 1, stage = 3): Assignment {
  return {
    id: 100 + subjectId,
    object: "assignment",
    url: "",
    data_updated_at: "2026-08-17T00:00:00.000Z",
    data: {
      subject_id: subjectId,
      subject_type: "vocabulary",
      srs_stage: stage,
      available_at: "2026-08-17T00:00:00.000Z",
      started_at: "2026-01-02T00:00:00.000Z",
      unlocked_at: "2026-01-01T00:00:00.000Z",
      passed_at: null,
      burned_at: null,
      resurrected_at: null,
      hidden: false,
      created_at: "2026-01-01T00:00:00.000Z",
    },
  };
}

function makeImageRadical(): Subject {
  return {
    id: 876,
    object: "radical",
    url: "https://api.wanikani.com/v2/subjects/876",
    data_updated_at: "2026-08-17T00:00:00.000Z",
    data: {
      level: 4,
      created_at: "2026-08-17T00:00:00.000Z",
      slug: "rib-cage",
      document_url: "https://www.wanikani.com/radicals/rib-cage",
      hidden_at: null,
      characters: null,
      character_images: [
        { url: "https://files.wanikani.com/rib-cage-256.png", content_type: "image/png", metadata: { dimensions: "256x256" } },
        { url: "https://files.wanikani.com/rib-cage.svg", content_type: "image/svg+xml" },
      ],
      meanings: [{ meaning: "Rib Cage", primary: true, accepted_answer: true }],
      auxiliary_meanings: [],
    },
  };
}

const testSubjectDetailSettings = {
  showContextSentences: true,
  showImmersionExamples: false,
  showPitchAccent: false,
  showKanjiReadingExamples: true,
  showStrokeOrder: true,
  showPatternsOfUse: false,
};

function renderQuiz(props: ComponentProps<typeof QuizSession>, studyMaterials: StudyMaterial[] = []) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  wkCollectionMock.mockResolvedValue(studyMaterials);
  return render(
    <QueryClientProvider client={queryClient}>
      <QuizSession {...props} />
    </QueryClientProvider>,
  );
}

describe("extra-study quiz interaction", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    wkCollectionMock.mockReset();
    wkRequestMock.mockReset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("puts the differentiated question type on the answer control", () => {
    expect(promptTypePresentation(makeQuestion())).toEqual({ label: "Reading", tone: "reading" });
    expect(promptTypePresentation(makeQuestion({ kind: "meaning" }))).toEqual({ label: "Meaning", tone: "meaning" });

    render(<QuizSession scope="test" initialSession={makeSession(makeQuestion())} onExit={vi.fn()} />);

    const input = screen.getByLabelText(/Vocabulary Reading/);
    expect(input).toBeInTheDocument();
    expect(input.closest("section")).toHaveAttribute("data-type", "vocabulary");
    expect(screen.getByRole("heading", { name: "防ぐ" })).not.toHaveTextContent("Reading");
  });

  it("uses WaniKani artwork for an image-only radical prompt and result identity", () => {
    const radical = makeImageRadical();
    const question = makeQuestion({
      subjectId: radical.id,
      subjectType: "radical",
      kind: "meaning",
      prompt: "rib cage",
      promptLabel: "Radical meaning",
      acceptedAnswers: ["Rib Cage"],
      displayAnswer: "Rib Cage",
      characters: null,
      meaning: "Rib Cage",
    });
    renderQuiz({
      scope: "radical-artwork",
      initialSession: { ...makeSession(question), mode: "random-test" },
      subjects: [radical],
      pauseOnCorrect: true,
      answerFeedbackSoundEnabled: false,
      onExit: vi.fn(),
    });

    const promptImage = screen.getByRole("img", { name: "Rib Cage radical" });
    expect(promptImage).toHaveAttribute("src", "https://files.wanikani.com/rib-cage.svg");
    expect(screen.getByRole("heading", { name: "Rib Cage radical" })).toHaveAttribute("id", "question-prompt");
    expect(screen.queryByRole("heading", { name: "rib cage" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Radical Meaning"), { target: { value: "Rib Cage" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("heading", { name: "Session results" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Rib Cage radical" })).toHaveAttribute("src", "https://files.wanikani.com/rib-cage.svg");
    expect(screen.queryByText("rib-cage")).not.toBeInTheDocument();
  });

  it("marks context sentence prompts separately from regular review prompts", () => {
    const contextQuestion = makeQuestion({
      kind: "context",
      prompt: "今回の＿＿を活かして、次回はもっと上手くやれるようにしたいと思います。",
      promptLabel: "Type the missing vocabulary",
    });
    const { unmount } = render(
      <QuizSession
        scope="test"
        initialSession={{ ...makeSession(contextQuestion), mode: "context-sentences" }}
        onExit={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: contextQuestion.prompt })).toHaveAttribute("data-question-kind", "context");

    unmount();
    render(<QuizSession scope="test" initialSession={makeSession(makeQuestion())} onExit={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "防ぐ" })).toHaveAttribute("data-question-kind", "reading");
  });

  it("shows direct-submit number shortcuts for unanswered multiple-choice questions", () => {
    const contextQuestion = makeQuestion({
      kind: "context",
      prompt: "今回の＿＿を活かしたいと思います。",
      promptLabel: "Restore the missing vocabulary",
      acceptedAnswers: ["教訓"],
      displayAnswer: "教訓",
      choices: ["感染", "苦しむ", "教訓", "眉"],
    });
    render(
      <QuizSession
        scope="test"
        initialSession={{ ...makeSession(contextQuestion), mode: "context-sentences" }}
        keyboardShortcuts
        onExit={vi.fn()}
      />,
    );

    expect(screen.getByText(/to answer/)).toHaveTextContent("Press 1–4 to answer");
    expect(screen.queryByText(/to check/)).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "3" });
    expect(screen.getByText(/to continue/)).toHaveTextContent("Press Enter to continue");
  });

  it("converts romaji live and uses a compact, explicit incorrect state", () => {
    render(<QuizSession scope="test" initialSession={makeSession(makeQuestion())} onExit={vi.fn()} />);

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

  it("converts romaji live for a typed listening vocabulary answer", () => {
    const question = makeQuestion({
      kind: "listening-characters",
      prompt: "Listen",
      promptLabel: "Type the vocabulary you hear",
      autoPlayAudio: false,
    });
    render(<QuizSession scope="test" initialSession={{ ...makeSession(question), mode: "listening" }} onExit={vi.fn()} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "fusegu" } });

    expect(input).toHaveValue("ふせぐ");
  });

  it("lets the learner retry when a romaji reading is entered for a meaning question", async () => {
    const question = makeQuestion({
      kind: "meaning",
      prompt: "先ず",
      promptLabel: "Vocabulary meaning",
      acceptedAnswers: ["First Of All"],
      displayAnswer: "First Of All",
    });
    const baseSubject = makeSubject();
    const mazuSubject: Subject = {
      ...baseSubject,
      data: {
        ...baseSubject.data,
        slug: "先ず",
        characters: "先ず",
        meanings: [{ meaning: "First Of All", primary: true, accepted_answer: true }],
        readings: [{ reading: "まず", primary: true, accepted_answer: true }],
      },
    };
    renderQuiz({
      scope: "test",
      initialSession: makeSession(question),
      subjects: [mazuSubject],
      answerFeedbackSoundEnabled: false,
      onExit: vi.fn(),
    });

    const input = screen.getByLabelText(/Vocabulary Meaning/);
    fireEvent.change(input, { target: { value: "mazu" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(await screen.findByText("You entered the reading, but we want the meaning.")).toBeInTheDocument();
    expect(input).toHaveValue("");
    expect(screen.queryByText("Incorrect")).not.toBeInTheDocument();
    expect(screen.queryByText("Correct answer")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check" })).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "First Of All" } });
    expect(screen.queryByText("You entered the reading, but we want the meaning.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(screen.getByText("Correct")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("accepts a one-letter typo in a typed vocabulary meaning as a close answer", () => {
    const question = makeQuestion({
      subjectId: 7,
      kind: "meaning",
      prompt: "七日",
      promptLabel: "Vocabulary meaning",
      acceptedAnswers: ["Seventh Day", "Day Seven", "Seven Days"],
      displayAnswer: "Seventh Day",
      characters: "七日",
      meaning: "Seventh Day",
    });
    const baseSubject = makeSubject();
    const seventhDaySubject: Subject = {
      ...baseSubject,
      id: 7,
      data: {
        ...baseSubject.data,
        level: 2,
        slug: "七日",
        characters: "七日",
        meanings: [{ meaning: "Seventh Day", primary: true, accepted_answer: true }],
        auxiliary_meanings: [
          { meaning: "Day Seven", type: "whitelist" },
          { meaning: "Seven Days", type: "whitelist" },
        ],
        readings: [{ reading: "なのか", primary: true, accepted_answer: true }],
      },
    };
    renderQuiz({
      scope: "test",
      initialSession: { ...makeSession(question), mode: "random-test" },
      subjects: [seventhDaySubject],
      pauseOnCorrect: true,
      answerFeedbackSoundEnabled: false,
      onExit: vi.fn(),
    });

    const input = screen.getByLabelText("Vocabulary Meaning");
    fireEvent.change(input, { target: { value: "sevent day" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(screen.getByRole("status")).toHaveTextContent("Accepted with a typo");
    expect(screen.getByRole("status")).not.toHaveTextContent("Incorrect");
    expect(input).toHaveAttribute("aria-invalid", "false");
  });

  it("loads and accepts personal meaning synonyms when the preference is enabled", async () => {
    const material: StudyMaterial = {
      id: 91,
      object: "study_material",
      url: "",
      data_updated_at: "2026-08-17T00:00:00.000Z",
      data: {
        subject_id: 1,
        subject_type: "vocabulary",
        meaning_synonyms: ["Stop Trouble"],
        meaning_note: null,
        reading_note: null,
        hidden: false,
        created_at: "2026-08-17T00:00:00.000Z",
      },
    };
    const question = makeQuestion({ kind: "meaning", acceptedAnswers: ["Prevent"], displayAnswer: "Prevent" });
    renderQuiz({
      scope: "test",
      initialSession: { ...makeSession(question), mode: "random-test" },
      subjects: [makeSubject()],
      acceptUserSynonymsAsAnswers: true,
      pauseOnCorrect: true,
      answerFeedbackSoundEnabled: false,
      onExit: vi.fn(),
    }, [material]);

    const input = await screen.findByLabelText("Vocabulary Meaning");
    expect(wkCollectionMock).toHaveBeenCalledWith("study_materials?subject_ids=1");
    fireEvent.change(input, { target: { value: "Stop Trouble" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(screen.getByRole("status")).toHaveTextContent("Correct");
    expect(screen.getByRole("status")).not.toHaveTextContent("Incorrect");
  });

  it("honors the any-on’yomi preference in typed kanji reading study", () => {
    const question = makeQuestion({
      subjectType: "kanji",
      kind: "reading",
      prompt: "行",
      promptLabel: "Kanji reading",
      acceptedAnswers: ["こう"],
      displayAnswer: "こう",
      characters: "行",
    });
    const baseSubject = makeSubject();
    const kanjiSubject: Subject = {
      ...baseSubject,
      object: "kanji",
      data: {
        ...baseSubject.data,
        slug: "行",
        characters: "行",
        meanings: [{ meaning: "Go", primary: true, accepted_answer: true }],
        readings: [
          { reading: "こう", primary: true, accepted_answer: true, type: "onyomi" },
          { reading: "ぎょう", primary: false, accepted_answer: true, type: "onyomi" },
        ],
      },
    };
    renderQuiz({
      scope: "test",
      initialSession: { ...makeSession(question), mode: "random-test" },
      subjects: [kanjiSubject],
      acceptAnyKanjiOnyomiReading: true,
      pauseOnCorrect: true,
      answerFeedbackSoundEnabled: false,
      onExit: vi.fn(),
    });

    const input = screen.getByLabelText("Kanji Reading");
    fireEvent.change(input, { target: { value: "gyou" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(screen.getByRole("status")).toHaveTextContent("Correct");
    expect(screen.getByRole("status")).not.toHaveTextContent("Try another answer");
  });

  it("uses mobile meaning grading for a typed kana-to-meaning answer", () => {
    const question = makeQuestion({
      kind: "kana-to-meaning",
      prompt: "ふせぐ",
      promptLabel: "Type the English meaning",
      acceptedAnswers: ["Prevent"],
      displayAnswer: "Prevent",
      characters: "防ぐ",
      meaning: "Prevent",
    });
    renderQuiz({
      scope: "test",
      initialSession: { ...makeSession(question), mode: "hiragana-meaning" },
      subjects: [makeSubject()],
      pauseOnClose: true,
      answerFeedbackSoundEnabled: false,
      onExit: vi.fn(),
    });

    const input = screen.getByLabelText("Vocabulary Meaning");
    fireEvent.change(input, { target: { value: "prevet" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(screen.getByRole("status")).toHaveTextContent("Accepted with a typo");
    expect(screen.getByRole("status")).not.toHaveTextContent("Incorrect");
    expect(input).toHaveAttribute("aria-invalid", "false");
  });

  it("uses mobile meaning grading for a typed listening-meaning answer", () => {
    const question = makeQuestion({
      kind: "listening-meaning",
      prompt: "Listen",
      promptLabel: "Type its English meaning",
      acceptedAnswers: ["Prevent"],
      displayAnswer: "Prevent",
      characters: "防ぐ",
      meaning: "Prevent",
      autoPlayAudio: false,
    });
    renderQuiz({
      scope: "test",
      initialSession: { ...makeSession(question), mode: "listening" },
      subjects: [makeSubject()],
      pauseOnClose: true,
      answerFeedbackSoundEnabled: false,
      onExit: vi.fn(),
    });

    const input = screen.getByLabelText("Vocabulary Meaning");
    fireEvent.change(input, { target: { value: "prevet" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(screen.getByRole("status")).toHaveTextContent("Accepted with a typo");
    expect(screen.getByRole("status")).not.toHaveTextContent("Incorrect");
    expect(input).toHaveAttribute("aria-invalid", "false");
  });

  it("warns and records no answer when a meaning is entered for meaning-to-reading", async () => {
    const question = makeQuestion({
      kind: "meaning-to-reading",
      prompt: "Prevent",
      promptLabel: "Type the reading in kana",
      acceptedAnswers: ["ふせぐ"],
      displayAnswer: "ふせぐ",
      characters: "防ぐ",
      meaning: "Prevent",
    });
    renderQuiz({
      scope: "test",
      initialSession: { ...makeSession(question), mode: "vocab-reading" },
      subjects: [makeSubject()],
      pauseOnCorrect: true,
      answerFeedbackSoundEnabled: false,
      onExit: vi.fn(),
    });

    const input = screen.getByLabelText("Vocabulary Reading");
    fireEvent.change(input, { target: { value: "Prevent" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(await screen.findByText("Your answer contains non-kana characters.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Try another answer");
    expect(input).toHaveValue("");
    expect(screen.queryByText("Incorrect")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "fusegu" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByRole("status")).toHaveTextContent("Correct");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByRole("heading", { name: "Session results" })).toBeInTheDocument();
    expect(screen.getByText("Correct responses").closest("div")).toHaveTextContent("1 / 1");
    expect(within(screen.getByRole("table", { name: "防ぐ responses" })).getAllByRole("row")).toHaveLength(2);
  });

  it.each([
    {
      label: "kana-to-kanji",
      mode: "kana-to-kanji" as const,
      question: makeQuestion({ kind: "kana-to-kanji", prompt: "ふせぐ", promptLabel: "Type the vocabulary in kanji", acceptedAnswers: ["防ぐ"], displayAnswer: "防ぐ" }),
      closeButWrong: "防ぎ",
    },
    {
      label: "similar-kanji",
      mode: "similar-kanji" as const,
      question: makeQuestion({ subjectType: "kanji", kind: "similar-kanji", prompt: "Prevent", promptLabel: "Type the matching kanji", acceptedAnswers: ["防"], displayAnswer: "防" }),
      closeButWrong: "坊",
    },
    {
      label: "listening-characters",
      mode: "listening" as const,
      question: makeQuestion({ kind: "listening-characters", prompt: "Listen", promptLabel: "Type the vocabulary you hear", acceptedAnswers: ["防ぐ"], displayAnswer: "防ぐ", autoPlayAudio: false }),
      closeButWrong: "防ぎ",
    },
    {
      label: "context",
      mode: "context-sentences" as const,
      question: makeQuestion({ kind: "context", prompt: "事故を＿＿。", promptLabel: "Type the missing vocabulary", acceptedAnswers: ["防ぐ"], displayAnswer: "防ぐ" }),
      closeButWrong: "防ぎ",
    },
  ])("keeps $label typed answers exact instead of applying fuzzy semantic grading", ({ mode, question, closeButWrong }) => {
    renderQuiz({
      scope: "test",
      initialSession: { ...makeSession(question), mode },
      subjects: [makeSubject()],
      pauseOnWrong: true,
      answerFeedbackSoundEnabled: false,
      onExit: vi.fn(),
    });

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: closeButWrong } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(screen.getByRole("status")).toHaveTextContent("Incorrect");
    expect(screen.getByRole("status")).not.toHaveTextContent("Accepted with a typo");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("uses the close-answer pause independently from the correct-answer pause", () => {
    vi.useFakeTimers();
    try {
      const firstQuestion = makeQuestion({
        kind: "kana-to-meaning",
        prompt: "ふせぐ",
        promptLabel: "Type the English meaning",
        acceptedAnswers: ["Prevent"],
        displayAnswer: "Prevent",
        characters: "防ぐ",
        meaning: "Prevent",
      });
      const secondQuestion = makeQuestion({ id: "question-2", subjectId: 2, kind: "meaning", prompt: "猫", acceptedAnswers: ["Cat"], displayAnswer: "Cat" });
      renderQuiz({
        scope: "test",
        initialSession: { ...makeSession(firstQuestion), mode: "hiragana-meaning", questions: [firstQuestion, secondQuestion] },
        subjects: [makeSubject()],
        pauseOnClose: true,
        pauseOnCorrect: false,
        answerFeedbackSoundEnabled: false,
        onExit: vi.fn(),
      });

      fireEvent.change(screen.getByLabelText("Vocabulary Meaning"), { target: { value: "prevet" } });
      fireEvent.click(screen.getByRole("button", { name: "Check" }));
      expect(screen.getByRole("status")).toHaveTextContent("Accepted with a typo");
      expect(screen.getByRole("button", { name: "Mark Incorrect" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Mark Correct" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();

      act(() => vi.advanceTimersByTime(1_000));
      expect(screen.getByRole("heading", { name: "ふせぐ" })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Mark Correct" }));
      act(() => vi.advanceTimersByTime(1_000));
      expect(screen.getByRole("heading", { name: "猫" })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("lets a paused close answer be marked incorrect before it is finalized", () => {
    const question = makeQuestion({
      kind: "meaning",
      prompt: "防ぐ",
      promptLabel: "Vocabulary meaning",
      acceptedAnswers: ["Prevent"],
      displayAnswer: "Prevent",
      characters: "防ぐ",
      meaning: "Prevent",
    });
    renderQuiz({
      scope: "test",
      initialSession: { ...makeSession(question), mode: "random-test" },
      subjects: [makeSubject()],
      pauseOnClose: true,
      pauseOnWrong: true,
      answerFeedbackSoundEnabled: false,
      onExit: vi.fn(),
    });

    fireEvent.change(screen.getByLabelText("Vocabulary Meaning"), { target: { value: "prevet" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark Incorrect" }));

    expect(screen.getByRole("status")).toHaveTextContent("Incorrect");
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Session results" })).toBeInTheDocument();
    expect(screen.getByText("Correct responses").closest("div")).toHaveTextContent("0 / 1");
  });

  it("treats Enter as Mark Correct for a paused close answer", () => {
    const question = makeQuestion({
      kind: "meaning",
      prompt: "防ぐ",
      promptLabel: "Vocabulary meaning",
      acceptedAnswers: ["Prevent"],
      displayAnswer: "Prevent",
      characters: "防ぐ",
      meaning: "Prevent",
    });
    renderQuiz({
      scope: "test",
      initialSession: { ...makeSession(question), mode: "random-test" },
      subjects: [makeSubject()],
      pauseOnClose: true,
      pauseOnCorrect: true,
      answerFeedbackSoundEnabled: false,
      onExit: vi.fn(),
    });

    fireEvent.change(screen.getByLabelText("Vocabulary Meaning"), { target: { value: "prevet" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByRole("button", { name: "Mark Correct" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Enter" });

    expect(screen.getByRole("status")).toHaveTextContent("Correct");
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("shows the full subject screen sections in a normal extra-study mode", async () => {
    renderQuiz({
      scope: "test",
      initialSession: makeSession(makeQuestion()),
      subjects: [makeSubject()],
      subjectDetailSettings: testSubjectDetailSettings,
      pauseOnCorrect: true,
      showDetailsAtAnswerStops: true,
      keyboardShortcuts: true,
      onExit: vi.fn(),
    });

    const input = screen.getByLabelText(/Vocabulary Reading/);
    fireEvent.change(input, { target: { value: "fusegu" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(await screen.findByRole("tablist", { name: "Subject details" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Reading" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Readings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reading mnemonic" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Meaning" }));
    expect(screen.getByRole("heading", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mnemonic" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Notes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your progression" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open full subject" })).toHaveAttribute("href", "/subjects/1");
    expect(screen.getByRole("link", { name: "Open full subject" })).toHaveAttribute("target", "_blank");
    expect(screen.queryByText("Romaji converts to hiragana as you type.")).not.toBeInTheDocument();
  });

  it("matches the full subject screen sections in recent lessons", async () => {
    const session = { ...makeSession(makeQuestion()), mode: "recent-lessons" as const };
    renderQuiz({
      scope: "test",
      initialSession: session,
      subjects: [makeSubject()],
      subjectDetailSettings: testSubjectDetailSettings,
      pauseOnCorrect: true,
      showDetailsAtAnswerStops: true,
      onExit: vi.fn(),
    });

    fireEvent.change(screen.getByLabelText(/Vocabulary Reading/), { target: { value: "fusegu" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(await screen.findByRole("tablist", { name: "Subject details" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Meaning" }));
    expect(screen.getByRole("heading", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mnemonic" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Notes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your progression" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open full subject" })).toHaveAttribute("href", "/subjects/1");

    fireEvent.click(screen.getByRole("tab", { name: "Reading" }));
    expect(screen.getByRole("heading", { name: "Readings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reading mnemonic" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pronunciation" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Context" }));
    expect(screen.getByRole("heading", { name: "Context sentences" })).toBeInTheDocument();
  });

  it("keeps recent lesson subject sections mounted until their collapse finishes", async () => {
    const firstQuestion = makeQuestion();
    const secondQuestion = makeQuestion({ id: "question-2", subjectId: 2, prompt: "猫", acceptedAnswers: ["ねこ"], displayAnswer: "ねこ" });
    const session = { ...makeSession(firstQuestion), mode: "recent-lessons" as const, questions: [firstQuestion, secondQuestion] };
    const baseSubject = makeSubject();
    const catSubject: Subject = { ...baseSubject, id: 2, data: { ...baseSubject.data, slug: "猫", characters: "猫" } };
    renderQuiz({
      scope: "test",
      initialSession: session,
      subjects: [baseSubject, catSubject],
      subjectDetailSettings: testSubjectDetailSettings,
      pauseOnCorrect: true,
      showDetailsAtAnswerStops: true,
      onExit: vi.fn(),
    });

    fireEvent.change(screen.getByLabelText(/Vocabulary Reading/), { target: { value: "fusegu" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByRole("tablist", { name: "Subject details" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("heading", { name: "防ぐ" }).closest("section")).toHaveAttribute("data-advancing", "true");
    expect(document.getElementById("study-item-details")).toBeInTheDocument();
    expect(document.getElementById("study-item-details-toggle")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("heading", { name: "猫" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("heading", { name: "猫" })).toBeInTheDocument());
    expect(document.getElementById("study-item-details")).not.toBeInTheDocument();
  });

  it("defaults details to the section that matches the current question", async () => {
    expect(itemDetailsTabForQuestion(makeQuestion({ kind: "reading" }))).toBe("reading");
    expect(itemDetailsTabForQuestion(makeQuestion({ kind: "meaning" }))).toBe("meaning");
    expect(itemDetailsTabForQuestion(makeQuestion({ kind: "context" }))).toBe("context");

    const meaningQuestion = makeQuestion({ kind: "meaning", acceptedAnswers: ["Prevent"], displayAnswer: "Prevent" });
    renderQuiz({
      scope: "test",
      initialSession: makeSession(meaningQuestion),
      subjects: [makeSubject()],
      subjectDetailSettings: testSubjectDetailSettings,
      pauseOnCorrect: true,
      showDetailsAtAnswerStops: true,
      onExit: vi.fn(),
    });

    fireEvent.change(screen.getByLabelText(/Vocabulary Meaning/), { target: { value: "Prevent" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(await screen.findByRole("tab", { name: "Meaning" })).toHaveAttribute("aria-selected", "true");
  });

  it("honors an explicit context stop and opens the canonical Context section", async () => {
    const contextQuestion = makeQuestion({
      kind: "context",
      prompt: "事故を＿＿。",
      promptLabel: "Restore the missing vocabulary",
      acceptedAnswers: ["防ぐ"],
      displayAnswer: "防ぐ",
      stopAfterAnswer: true,
    });
    renderQuiz({
      scope: "test",
      initialSession: { ...makeSession(contextQuestion), mode: "context-sentences" },
      subjects: [makeSubject()],
      subjectDetailSettings: testSubjectDetailSettings,
      pauseOnCorrect: true,
      showDetailsAtAnswerStops: true,
      onExit: vi.fn(),
    });

    fireEvent.change(screen.getByLabelText(/Vocabulary Answer/), { target: { value: "防ぐ" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(await screen.findByRole("tab", { name: "Context" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Context sentences" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("keeps explicit context stops closed when correct answers are not configured to show details", async () => {
    const contextQuestion = makeQuestion({
      kind: "context",
      prompt: "事故を＿＿。",
      promptLabel: "Restore the missing vocabulary",
      acceptedAnswers: ["防ぐ"],
      displayAnswer: "防ぐ",
      stopAfterAnswer: true,
    });
    renderQuiz({
      scope: "test",
      initialSession: { ...makeSession(contextQuestion), mode: "context-sentences" },
      subjects: [makeSubject()],
      subjectDetailSettings: testSubjectDetailSettings,
      pauseOnCorrect: false,
      showDetailsAtAnswerStops: true,
      onExit: vi.fn(),
    });

    fireEvent.change(screen.getByLabelText(/Vocabulary Answer/), { target: { value: "防ぐ" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(screen.getByRole("button", { name: /Show subject details/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("tablist", { name: "Subject details" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Show subject details/ }));
    expect(await screen.findByRole("tab", { name: "Context" })).toHaveAttribute("aria-selected", "true");
  });

  it("honors an explicit non-stopping context question even when correct answers normally pause", async () => {
    const firstQuestion = makeQuestion({
      kind: "context",
      prompt: "事故を＿＿。",
      promptLabel: "Restore the missing vocabulary",
      acceptedAnswers: ["防ぐ"],
      displayAnswer: "防ぐ",
      stopAfterAnswer: false,
    });
    const secondQuestion = makeQuestion({ id: "question-2", kind: "meaning", prompt: "猫", acceptedAnswers: ["Cat"], displayAnswer: "Cat" });
    renderQuiz({
      scope: "test",
      initialSession: { ...makeSession(firstQuestion), mode: "context-sentences", questions: [firstQuestion, secondQuestion] },
      subjects: [makeSubject()],
      subjectDetailSettings: testSubjectDetailSettings,
      pauseOnCorrect: true,
      showDetailsAtAnswerStops: true,
      onExit: vi.fn(),
    });

    fireEvent.change(screen.getByLabelText(/Vocabulary Answer/), { target: { value: "防ぐ" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(screen.queryByRole("button", { name: /subject details/ })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "猫" }, { timeout: 2_000 })).toBeInTheDocument();
  });

  it("scrolls smoothly when details expand", async () => {
    const previousScrollIntoView = Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView");
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });
    const previousMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });

    try {
      renderQuiz({
        scope: "test",
        initialSession: makeSession(makeQuestion()),
        subjects: [makeSubject()],
        subjectDetailSettings: testSubjectDetailSettings,
        pauseOnCorrect: true,
        showDetailsAtAnswerStops: true,
        onExit: vi.fn(),
      });
      fireEvent.change(screen.getByLabelText(/Vocabulary Reading/), { target: { value: "fusegu" } });
      fireEvent.click(screen.getByRole("button", { name: "Check" }));

      await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" }));
    } finally {
      if (previousScrollIntoView) Object.defineProperty(Element.prototype, "scrollIntoView", previousScrollIntoView);
      else delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
      window.matchMedia = previousMatchMedia;
    }
  });

  it("collapses open details before swapping to the next question", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const firstQuestion = makeQuestion();
    const secondQuestion = makeQuestion({ id: "question-2", prompt: "猫", acceptedAnswers: ["ねこ"], displayAnswer: "ねこ" });
    const session = { ...makeSession(firstQuestion), questions: [firstQuestion, secondQuestion] };
    const { container } = renderQuiz({
      scope: "test",
      initialSession: session,
      subjects: [makeSubject()],
      subjectDetailSettings: testSubjectDetailSettings,
      pauseOnCorrect: true,
      showDetailsAtAnswerStops: true,
      onExit: vi.fn(),
    });

    fireEvent.change(screen.getByLabelText(/Vocabulary Reading/), { target: { value: "fusegu" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Hide subject details/ })).toHaveAttribute("aria-expanded", "true"));
    const answerStop = container.querySelector("[data-answer-stop]");
    expect(answerStop).toHaveAttribute("data-visible", "true");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    expect(screen.getByRole("heading", { name: "防ぐ" }).closest("section")).toHaveAttribute("data-advancing", "true");
    expect(answerStop).toHaveAttribute("data-visible", "false");
    expect(document.getElementById("study-answer-status")).toBeInTheDocument();
    expect(document.getElementById("study-item-details-toggle")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("heading", { name: "猫" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("heading", { name: "猫" })).toBeInTheDocument());
    expect(document.getElementById("study-answer-status")).not.toBeInTheDocument();
  });

  it("keeps details closed when a pending open frame and D shortcut race with advancing", () => {
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    const requestAnimationFrame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      nextFrame += 1;
      frames.set(nextFrame, callback);
      return nextFrame;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((frame) => {
      frames.delete(frame);
    });
    const firstQuestion = makeQuestion();
    const secondQuestion = makeQuestion({ id: "question-2", prompt: "猫", acceptedAnswers: ["ねこ"], displayAnswer: "ねこ" });
    const session = { ...makeSession(firstQuestion), questions: [firstQuestion, secondQuestion] };
    renderQuiz({
      scope: "test",
      initialSession: session,
      subjects: [makeSubject()],
      subjectDetailSettings: testSubjectDetailSettings,
      pauseOnCorrect: true,
      showDetailsAtAnswerStops: true,
      keyboardShortcuts: true,
      onExit: vi.fn(),
    });

    fireEvent.change(screen.getByLabelText(/Vocabulary Reading/), { target: { value: "fusegu" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    const pendingOpenFrame = [...frames.values()].at(-1);
    expect(pendingOpenFrame).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const framesScheduledBeforeShortcut = requestAnimationFrame.mock.calls.length;
    fireEvent.keyDown(window, { key: "d" });
    expect(requestAnimationFrame).toHaveBeenCalledTimes(framesScheduledBeforeShortcut);

    act(() => pendingOpenFrame?.(performance.now()));
    const detailsToggle = document.getElementById("study-item-details-toggle");
    expect(detailsToggle).not.toBeNull();
    expect(detailsToggle).toHaveAttribute("aria-expanded", "false");
    expect(detailsToggle?.closest("[data-open]")).toHaveAttribute("data-open", "false");
  });

  it("keeps answered subject details behind a button and D shortcut when automatic details are off", async () => {
    renderQuiz({
      scope: "test",
      initialSession: makeSession(makeQuestion()),
      subjects: [makeSubject()],
      subjectDetailSettings: testSubjectDetailSettings,
      pauseOnCorrect: true,
      showDetailsAtAnswerStops: false,
      keyboardShortcuts: true,
      onExit: vi.fn(),
    });

    const input = screen.getByLabelText(/Vocabulary Reading/);
    fireEvent.change(input, { target: { value: "fusegu" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(screen.queryByRole("heading", { name: "Subject details" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Show subject details/ })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "d" });
    expect(await screen.findByRole("heading", { name: "Subject details" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "d" });
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Subject details" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Show subject details/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("opens wrong-answer details with D while the answer field remains focused", async () => {
    renderQuiz({
      scope: "test",
      initialSession: makeSession(makeQuestion()),
      subjects: [makeSubject()],
      subjectDetailSettings: testSubjectDetailSettings,
      pauseOnWrong: true,
      showDetailsAtAnswerStops: false,
      keyboardShortcuts: true,
      answerFeedbackSoundEnabled: false,
      onExit: vi.fn(),
    });

    const input = screen.getByLabelText(/Vocabulary Reading/);
    fireEvent.change(input, { target: { value: "neko" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    input.focus();

    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: /Show subject details/ })).toHaveAttribute("aria-expanded", "false");

    fireEvent.keyDown(input, { key: "d", code: "KeyD" });

    expect(await screen.findByRole("heading", { name: "Subject details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hide subject details/ })).toHaveAttribute("aria-expanded", "true");
  });

  it("leaves Enter and D with embedded subject-detail editors and buttons", async () => {
    const firstQuestion = makeQuestion();
    const secondQuestion = makeQuestion({ id: "question-2", prompt: "猫", acceptedAnswers: ["ねこ"], displayAnswer: "ねこ" });
    renderQuiz({
      scope: "test",
      initialSession: { ...makeSession(firstQuestion), questions: [firstQuestion, secondQuestion] },
      subjects: [makeSubject()],
      subjectDetailSettings: testSubjectDetailSettings,
      pauseOnCorrect: true,
      showDetailsAtAnswerStops: true,
      keyboardShortcuts: true,
      onExit: vi.fn(),
    });

    fireEvent.change(screen.getByLabelText(/Vocabulary Reading/), { target: { value: "fusegu" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByRole("tablist", { name: "Subject details" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Meaning" }));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));

    const quiz = screen.getByRole("heading", { name: "防ぐ" }).closest("section");
    const detailsToggle = screen.getByRole("button", { name: /Hide subject details/ });
    const meaningNote = screen.getByRole("textbox", { name: "Meaning note" });
    fireEvent.keyDown(meaningNote, { key: "Enter" });
    expect(quiz).not.toHaveAttribute("data-advancing");
    expect(detailsToggle).toHaveAttribute("aria-expanded", "true");

    const synonyms = screen.getByRole("textbox", { name: "Meaning synonyms" });
    fireEvent.keyDown(synonyms, { key: "d" });
    expect(detailsToggle).toHaveAttribute("aria-expanded", "true");

    const save = screen.getByRole("button", { name: "Save notes" });
    fireEvent.keyDown(save, { key: "Enter" });
    fireEvent.keyDown(save, { key: "d" });
    expect(quiz).not.toHaveAttribute("data-advancing");
    expect(detailsToggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByRole("heading", { name: "猫" })).not.toBeInTheDocument();
  });

  it.each([
    { result: "correct", value: "fusegu", pauseOnCorrect: true, pauseOnWrong: false },
    { result: "wrong", value: "neko", pauseOnCorrect: false, pauseOnWrong: true },
  ])("opens subject details immediately when a $result answer is configured to pause", async ({ value, pauseOnCorrect, pauseOnWrong }) => {
    renderQuiz({
      scope: "test",
      initialSession: makeSession(makeQuestion()),
      subjects: [makeSubject()],
      subjectDetailSettings: testSubjectDetailSettings,
      pauseOnCorrect,
      pauseOnWrong,
      showDetailsAtAnswerStops: true,
      onExit: vi.fn(),
    });

    fireEvent.change(screen.getByLabelText(/Vocabulary Reading/), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(await screen.findByRole("heading", { name: "Subject details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hide subject details/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it.each([
    { result: "correct", value: "fusegu", pauseOnCorrect: false, pauseOnWrong: true },
    { result: "wrong", value: "neko", pauseOnCorrect: true, pauseOnWrong: false },
  ])("auto-advances without subject details when a $result answer is not configured to pause", async ({ value, pauseOnCorrect, pauseOnWrong }) => {
    const firstQuestion = makeQuestion();
    const secondQuestion = makeQuestion({ id: "question-2", prompt: "猫", acceptedAnswers: ["ねこ"], displayAnswer: "ねこ" });
    renderQuiz({
      scope: "test",
      initialSession: { ...makeSession(firstQuestion), questions: [firstQuestion, secondQuestion] },
      subjects: [makeSubject()],
      subjectDetailSettings: testSubjectDetailSettings,
      pauseOnCorrect,
      pauseOnWrong,
      showDetailsAtAnswerStops: true,
      onExit: vi.fn(),
    });

    fireEvent.change(screen.getByLabelText(/Vocabulary Reading/), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(screen.queryByRole("button", { name: /subject details/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Subject details" })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "猫" }, { timeout: 2_000 })).toBeInTheDocument();
  });

  it("reports paired custom-review prompts as study items", () => {
    const questions = Array.from({ length: 5 }, (_, index) => [
      makeQuestion({ id: `${index + 1}:meaning`, subjectId: index + 1, kind: "meaning" }),
      makeQuestion({ id: `${index + 1}:reading`, subjectId: index + 1, kind: "reading" }),
    ]).flat();
    const session = { ...makeSession(questions[0]), mode: "custom-review" as const, questions };

    render(<QuizSession scope="test" initialSession={session} onExit={vi.fn()} />);

    expect(screen.getByText("1 / 5")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "5");
  });

  it("shows enabled review question extras in random test", async () => {
    const frequencyFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      result: { provider: "jiten", frequencyRank: 1_500, wordId: 25, readingIndex: 0, matchedText: "防ぐ", matchedReading: "ふせぐ", sourceUrl: "https://jiten.moe/search?query=%E9%98%B2%E3%81%90" },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", frequencyFetch);

    renderQuiz({
      scope: "random-test-review-extras",
      initialSession: { ...makeSession(makeQuestion()), mode: "random-test" },
      subjects: [makeSubject()],
      assignments: [makeAssignment()],
      reviewPreferences: {
        ...DEFAULT_WEB_SETTINGS.study,
        showReviewItemLevelAndSrsStage: true,
        showVocabularyFrequency: true,
        showVocabContextSentencesInReviews: true,
        reviewSearchButtonEnabled: true,
      },
      answerFeedbackSoundEnabled: false,
      onExit: vi.fn(),
    });

    expect(screen.getByLabelText("Question status")).toHaveTextContent("Level 12");
    expect(screen.getByLabelText("Question status")).toHaveTextContent("Apprentice III");
    expect(await screen.findByLabelText("Vocabulary frequency #1,500")).toHaveTextContent("#1,500");
    expect(screen.getByText("• 事故を防ぐ。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search this item" })).toHaveAttribute("href", "/search?q=%E9%98%B2%E3%81%90");
  });

  it("applies custom-review prompt settings and skips paired questions as one subject", async () => {
    const firstSubject = makeSubject();
    const secondSubject: Subject = {
      ...makeSubject(),
      id: 2,
      data: {
        ...makeSubject().data,
        slug: "猫",
        characters: "猫",
        meanings: [{ meaning: "Cat", primary: true, accepted_answer: true }],
        readings: [{ reading: "ねこ", primary: true, accepted_answer: true }],
      },
    };
    const questions = [
      makeQuestion({ id: "1:meaning", kind: "meaning", acceptedAnswers: ["Prevent"], displayAnswer: "Prevent" }),
      makeQuestion({ id: "1:reading", kind: "reading" }),
      makeQuestion({ id: "2:meaning", subjectId: 2, kind: "meaning", prompt: "猫", acceptedAnswers: ["Cat"], displayAnswer: "Cat" }),
      makeQuestion({ id: "2:reading", subjectId: 2, kind: "reading", prompt: "猫", acceptedAnswers: ["ねこ"], displayAnswer: "ねこ" }),
    ];
    const frequencyFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      result: { provider: "jiten", frequencyRank: 1_500, wordId: 25, readingIndex: 0, matchedText: "防ぐ", matchedReading: "ふせぐ", sourceUrl: "https://jiten.moe/search?query=%E9%98%B2%E3%81%90" },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", frequencyFetch);

    renderQuiz({
      scope: "custom-review-settings",
      initialSession: { ...makeSession(questions[0]), mode: "custom-review", questions },
      subjects: [firstSubject, secondSubject],
      assignments: [makeAssignment(1, 3), makeAssignment(2, 5)],
      studyMaterials: [],
      reviewPreferences: {
        ...DEFAULT_WEB_SETTINGS.study,
        showReviewItemLevelAndSrsStage: true,
        showVocabularyFrequency: true,
        showVocabContextSentencesInReviews: true,
        allowSkippingReviews: true,
        reviewSearchButtonEnabled: true,
        reviewCharacterFontScale: 1.2,
        reviewInputFontScale: 1.2,
        jitaiEnabled: true,
        jitaiSelectedFontIds: ["mincho"],
      },
      answerFeedbackSoundEnabled: false,
      onExit: vi.fn(),
    });

    const prompt = screen.getByRole("heading", { name: "防ぐ" });
    expect(prompt).toHaveAttribute("data-character-scale", "1.2");
    expect(prompt.style.fontFamily).toContain("Yu Mincho");
    expect(screen.getByRole("textbox")).toHaveStyle({ fontSize: "1.2rem" });
    expect(screen.getByLabelText("Question status")).toHaveTextContent("Level 12");
    expect(screen.getByLabelText("Question status")).toHaveTextContent("Apprentice III");
    expect(await screen.findByLabelText("Vocabulary frequency #1,500")).toHaveTextContent("#1,500");
    expect(screen.getByText("• 事故を防ぐ。")).toBeInTheDocument();
    expect(screen.queryByText("• Prevent an accident.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show translations" }));
    expect(screen.getByText("• Prevent an accident.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search this item" })).toHaveAttribute("href", "/search?q=%E9%98%B2%E3%81%90");

    fireEvent.click(screen.getByRole("button", { name: "Skip review" }));

    expect(screen.getByRole("heading", { name: "猫" })).toBeInTheDocument();
    expect(screen.getByLabelText("Question status")).toHaveTextContent("Guru I");
    expect(screen.queryByRole("heading", { name: "防ぐ" })).not.toBeInTheDocument();
  });

  it("groups both custom-review prompts into one buttonless Anki grade", async () => {
    const meaning = makeQuestion({ id: "1:meaning", kind: "meaning", acceptedAnswers: ["Prevent"], displayAnswer: "Prevent" });
    const reading = makeQuestion({ id: "1:reading", kind: "reading" });
    renderQuiz({
      scope: "custom-review-anki",
      initialSession: { ...makeSession(meaning), mode: "custom-review", questions: [meaning, reading] },
      subjects: [makeSubject()],
      studyMaterials: [],
      reviewPreferences: {
        ...DEFAULT_WEB_SETTINGS.study,
        ankiMode: "both",
        ankiGroupQuestions: true,
        ankiButtonlessMode: true,
      },
      pauseOnCorrect: true,
      answerFeedbackSoundEnabled: false,
      onExit: vi.fn(),
    });

    expect(screen.getByRole("region", { name: "Anki answer" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("Meaning + Reading")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    expect(screen.getByTestId("anki-answer-content")).toHaveTextContent("Prevent");
    expect(screen.getByTestId("anki-answer-content")).toHaveTextContent("ふせぐ");
    expect(screen.getByRole("group", { name: "Buttonless Anki controls" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tap right: mark correct" }));
    expect(screen.getByRole("status")).toHaveTextContent("Correct");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByRole("heading", { name: "Session results" })).toBeInTheDocument();
    expect(screen.getByText("Correct responses").closest("div")).toHaveTextContent("2 / 2");
  });

  it("saves a paused wrong custom-review meaning as a synonym and marks it correct", async () => {
    const question = makeQuestion({ id: "1:meaning", kind: "meaning", acceptedAnswers: ["Prevent"], displayAnswer: "Prevent" });
    const material: StudyMaterial = {
      id: 91,
      object: "study_material",
      url: "",
      data_updated_at: "2026-08-17T00:00:00.000Z",
      data: {
        subject_id: 1,
        subject_type: "vocabulary",
        meaning_synonyms: ["watercourse"],
        meaning_note: null,
        reading_note: null,
        hidden: false,
        created_at: "2026-08-17T00:00:00.000Z",
      },
    };
    const saved = { ...material, data: { ...material.data, meaning_synonyms: ["watercourse", "stop trouble"] } };
    wkRequestMock.mockResolvedValue(saved);
    renderQuiz({
      scope: "custom-review-synonym",
      initialSession: { ...makeSession(question), mode: "custom-review" },
      subjects: [makeSubject()],
      studyMaterials: [material],
      reviewPreferences: { ...DEFAULT_WEB_SETTINGS.study, showAddSynonymButton: true },
      pauseOnWrong: true,
      pauseOnCorrect: true,
      answerFeedbackSoundEnabled: false,
      onExit: vi.fn(),
    });

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Stop Trouble" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByRole("status")).toHaveTextContent("Incorrect");
    fireEvent.click(screen.getByRole("button", { name: "Add as synonym" }));

    await waitFor(() => expect(wkRequestMock).toHaveBeenCalledWith("study_materials/91", {
      method: "PUT",
      body: { study_material: { meaning_synonyms: ["watercourse", "stop trouble"] } },
    }));
    expect(screen.getByRole("status")).toHaveTextContent("Correct");
    expect(screen.queryByRole("button", { name: "Add as synonym" })).not.toBeInTheDocument();
  });

  function makeListeningQuestion(overrides: Partial<StudyQuestion> = {}): StudyQuestion {
    return makeQuestion({
      kind: "listening-characters",
      prompt: "＿＿が好きです。",
      promptLabel: "Vocabulary · Sword Art Online",
      acceptedAnswers: ["猫"],
      displayAnswer: "猫",
      choices: ["猫", "犬"],
      characters: "猫",
      sentence: { ja: "猫が好きです。", en: "I like cats.", masked: "＿＿が好きです。" },
      audioUrl: "https://example.com/listening.mp3",
      imageUrl: "https://example.com/scene.jpg",
      sourceTitle: "Sword Art Online",
      autoPlayAudio: true,
      stopAfterAnswer: false,
      ...overrides,
    });
  }

  it.each([
    { result: "correct", answerMode: "multiple choice", answer: "猫", pauseOnCorrect: true, pauseOnWrong: false },
    { result: "wrong", answerMode: "multiple choice", answer: "犬", pauseOnCorrect: false, pauseOnWrong: true },
    { result: "correct", answerMode: "typed", answer: "neko", pauseOnCorrect: true, pauseOnWrong: false },
    { result: "wrong", answerMode: "typed", answer: "inu", pauseOnCorrect: false, pauseOnWrong: true },
  ])("stops and opens subject details after a $answerMode listening $result answer when configured", async ({ answerMode, answer, pauseOnCorrect, pauseOnWrong }) => {
    const firstQuestion = makeListeningQuestion({
      stopAfterAnswer: false,
      autoPlayAudio: false,
      acceptedAnswers: answerMode === "typed" ? ["猫", "ねこ"] : ["猫"],
      choices: answerMode === "typed" ? undefined : ["猫", "犬"],
    });
    const secondQuestion = makeListeningQuestion({
      id: "dog:characters",
      subjectId: 2,
      prompt: "＿＿が走ります。",
      acceptedAnswers: ["犬"],
      displayAnswer: "犬",
      choices: ["犬", "猫"],
      characters: "犬",
      sentence: { ja: "犬が走ります。", en: "A dog runs.", masked: "＿＿が走ります。" },
      stopAfterAnswer: false,
      autoPlayAudio: false,
    });
    const dogSubject = { ...makeSubject(), id: 2, data: { ...makeSubject().data, slug: "犬", characters: "犬" } };
    renderQuiz({
      scope: "test",
      initialSession: { ...makeSession(firstQuestion), mode: "listening", questions: [firstQuestion, secondQuestion] },
      subjects: [makeSubject(), dogSubject],
      subjectDetailSettings: testSubjectDetailSettings,
      pauseOnCorrect,
      pauseOnWrong,
      showDetailsAtAnswerStops: true,
      onExit: vi.fn(),
    });

    if (answerMode === "typed") {
      fireEvent.change(screen.getByRole("textbox"), { target: { value: answer } });
      fireEvent.click(screen.getByRole("button", { name: "Check" }));
    } else {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(answer) }));
    }

    expect(await screen.findByRole("heading", { name: "Subject details" })).toBeInTheDocument();
    const detailsButton = screen.getByRole("button", { name: /Hide subject details/ });
    expect(detailsButton).toHaveAttribute("aria-expanded", "true");
    expect(detailsButton.closest("section")).toHaveAttribute("data-details-open", "true");
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    expect(screen.queryByText("犬が走ります。", { exact: true })).not.toBeInTheDocument();
  });

  it("continues listening automatically when neither outcome is configured to stop", async () => {
    const firstQuestion = makeListeningQuestion({ stopAfterAnswer: false, autoPlayAudio: false });
    const secondQuestion = makeListeningQuestion({
      id: "dog:characters",
      subjectId: 2,
      prompt: "＿＿が走ります。",
      acceptedAnswers: ["犬"],
      displayAnswer: "犬",
      choices: ["犬", "猫"],
      characters: "犬",
      sentence: { ja: "犬が走ります。", en: "A dog runs.", masked: "＿＿が走ります。" },
      stopAfterAnswer: false,
      autoPlayAudio: false,
    });
    renderQuiz({
      scope: "test",
      initialSession: { ...makeSession(firstQuestion), mode: "listening", questions: [firstQuestion, secondQuestion] },
      subjects: [makeSubject(), { ...makeSubject(), id: 2 }],
      pauseOnCorrect: false,
      pauseOnWrong: false,
      showDetailsAtAnswerStops: true,
      onExit: vi.fn(),
    });

    fireEvent.click(screen.getByRole("button", { name: /猫/ }));

    expect(await screen.findByText("犬が走ります。", { exact: true }, { timeout: 2_000 })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Subject details" })).not.toBeInTheDocument();
  });

  it("shows the listening scene and masked sentence before submission", () => {
    const listeningQuestion = makeListeningQuestion({ autoPlayAudio: false });

    render(<StrictMode><QuizSession scope="test" initialSession={{ ...makeSession(listeningQuestion), mode: "listening" }} onExit={vi.fn()} /></StrictMode>);

    expect(screen.getByRole("img", { name: "Scene from Sword Art Online" })).toBeVisible();
    expect(screen.getByText("＿＿が好きです。", { exact: true })).toBeVisible();
    expect(screen.getByText("猫が好きです。", { exact: true })).toHaveAttribute("data-visible", "false");
  });

  it("keeps the filled Japanese term highlighted during and after the listening meaning phase", () => {
    const charactersQuestion = makeListeningQuestion({ id: "cat:characters", autoPlayAudio: false });
    const meaningQuestion = makeListeningQuestion({
      id: "cat:meaning",
      kind: "listening-meaning",
      choices: ["Cat", "Dog"],
      acceptedAnswers: ["Cat"],
      displayAnswer: "Cat",
      autoPlayAudio: false,
    });
    const session: StudySession = {
      ...makeSession(charactersQuestion),
      mode: "listening",
      currentIndex: 1,
      questions: [charactersQuestion, meaningQuestion],
      answers: [{ questionId: charactersQuestion.id, value: "猫", correct: true, status: "correct", answeredAt: "2026-08-17T00:01:00.000Z" }],
    };

    render(<QuizSession scope="test" initialSession={session} onExit={vi.fn()} />);

    const highlightedTerm = screen.getByText("猫", { selector: "mark", exact: true });
    expect(highlightedTerm).toBeVisible();
    expect(highlightedTerm.closest("p")).toHaveTextContent("猫が好きです。");
    expect(screen.getByText("＿＿が好きです。", { exact: true })).toHaveAttribute("data-visible", "false");

    fireEvent.click(screen.getByRole("button", { name: /Cat/ }));
    expect(highlightedTerm).toBeVisible();
  });

  it("autoplays a listening clip once and replays it once per explicit action", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const listeningQuestion = makeListeningQuestion();

    render(<StrictMode><QuizSession scope="test" initialSession={{ ...makeSession(listeningQuestion), mode: "listening" }} onExit={vi.fn()} /></StrictMode>);

    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));

    const replay = screen.getByRole("button", { name: /replay listening clip/i });
    expect(within(replay).getByText("R", { exact: true })).toBeInTheDocument();
    fireEvent.click(replay);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("transitions correct feedback into the selected listening answer card", () => {
    const listeningQuestion = makeListeningQuestion({ autoPlayAudio: false });

    render(<QuizSession scope="test" initialSession={{ ...makeSession(listeningQuestion), mode: "listening" }} onExit={vi.fn()} />);

    const selected = screen.getByRole("button", { name: /猫/ });
    fireEvent.click(selected);
    expect(selected).toHaveAttribute("data-result", "correct");
    expect(within(selected).getByText("Correct", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText("Correct", { selector: "[role='status']" })).not.toBeInTheDocument();
  });

  it("plays distinct confirmation and error cues when answers are submitted", () => {
    const sources: string[] = [];
    const play = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("Audio", class {
      volume = 1;
      constructor(source?: string) { sources.push(source ?? ""); }
      play = play;
    });

    const question = makeListeningQuestion({ autoPlayAudio: false });
    const { unmount } = render(<QuizSession scope="test" initialSession={{ ...makeSession(question), mode: "listening" }} onExit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /猫/ }));
    unmount();

    render(<QuizSession scope="test" initialSession={{ ...makeSession(question), id: "session-2", mode: "listening" }} onExit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /犬/ }));

    expect(play).toHaveBeenCalledTimes(2);
    expect(sources[0]).toMatch(/^data:audio\/ogg;base64,/);
    expect(sources[1]).toMatch(/^data:audio\/ogg;base64,/);
    expect(sources[0]).not.toBe(sources[1]);
  });

  it("keeps answer feedback silent when the preference is disabled", () => {
    const play = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("Audio", class {
      volume = 1;
      play = play;
    });

    const question = makeListeningQuestion({ autoPlayAudio: false });
    render(<QuizSession scope="test" initialSession={{ ...makeSession(question), mode: "listening" }} answerFeedbackSoundEnabled={false} onExit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /猫/ }));

    expect(play).not.toHaveBeenCalled();
  });

  it("keeps the listening scene and answer grid structure stable when feedback appears", () => {
    const listeningQuestion = makeListeningQuestion({ autoPlayAudio: false });

    const { container } = render(<QuizSession scope="test" initialSession={{ ...makeSession(listeningQuestion), mode: "listening" }} showListeningTranslation onExit={vi.fn()} />);

    const translation = screen.getByText("I like cats.", { exact: true });
    const reveal = screen.getByRole("button", { name: "Show translation" });
    const resultSlots = Array.from(container.querySelectorAll("[data-choice-result]"));
    const actionSlot = container.querySelector("[data-choice-actions]");
    expect(translation).toHaveAttribute("data-visible", "false");
    expect(resultSlots).toHaveLength(2);
    expect(actionSlot).toHaveAttribute("data-visible", "false");

    fireEvent.click(screen.getByRole("button", { name: /猫/ }));

    expect(screen.getByText("I like cats.", { exact: true })).toBe(translation);
    expect(translation).toHaveAttribute("data-visible", "false");
    expect(reveal).toBeVisible();
    expect(Array.from(container.querySelectorAll("[data-choice-result]"))).toEqual(resultSlots);
    expect(container.querySelector("[data-choice-actions]")).toBe(actionSlot);
    expect(actionSlot).toHaveAttribute("data-visible", "false");

    fireEvent.click(reveal);
    expect(translation).toHaveAttribute("data-visible", "true");
    expect(screen.getByRole("button", { name: "Hide translation" })).toBeInTheDocument();
  });

  it("honors the listening translation visibility preference", () => {
    const listeningQuestion = makeListeningQuestion({ autoPlayAudio: false });

    render(<QuizSession scope="test" initialSession={{ ...makeSession(listeningQuestion), mode: "listening" }} showListeningTranslation={false} onExit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /猫/ }));

    expect(screen.queryByText("I like cats.", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show translation" })).not.toBeInTheDocument();
  });

  it("keeps the last completed subject available throughout both phases of the next subject", () => {
    const catCharacters = makeListeningQuestion({ id: "cat:characters", subjectId: 1, autoPlayAudio: false });
    const catMeaning = makeListeningQuestion({ id: "cat:meaning", subjectId: 1, kind: "listening-meaning", choices: ["Cat", "Dog"], acceptedAnswers: ["Cat"], displayAnswer: "Cat", autoPlayAudio: false });
    const dogCharacters = makeListeningQuestion({ id: "dog:characters", subjectId: 2, characters: "犬", choices: ["犬", "猫"], acceptedAnswers: ["犬"], displayAnswer: "犬", autoPlayAudio: false });
    const dogMeaning = makeListeningQuestion({ id: "dog:meaning", subjectId: 2, kind: "listening-meaning", characters: "犬", choices: ["Dog", "Cat"], acceptedAnswers: ["Dog"], displayAnswer: "Dog", autoPlayAudio: false });
    const answers = [
      { questionId: catCharacters.id, value: "猫", correct: true, answeredAt: "2026-08-17T00:01:00.000Z" },
      { questionId: catMeaning.id, value: "Cat", correct: true, answeredAt: "2026-08-17T00:02:00.000Z" },
      { questionId: dogCharacters.id, value: "犬", correct: true, answeredAt: "2026-08-17T00:03:00.000Z" },
    ];
    const session = { ...makeSession(catCharacters), mode: "listening" as const, questions: [catCharacters, catMeaning, dogCharacters, dogMeaning], answers, currentIndex: 3 };
    const previousSubject = makeSubject();
    previousSubject.data.characters = "猫";
    previousSubject.data.slug = "猫";

    render(<QuizSession scope="test" initialSession={session} subjects={[previousSubject]} onExit={vi.fn()} />);

    expect(screen.getByRole("link", { name: "Previous subject: 猫" })).toHaveAttribute("href", "/subjects/1");
    expect(screen.getByRole("link", { name: "Previous subject: 猫" })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "Previous subject: 猫" }).parentElement).toBe(screen.getByRole("link", { name: "Previous subject: 猫" }).closest("section"));
    expect(screen.getByRole("img", { name: "Scene from Sword Art Online" }).parentElement).not.toContainElement(screen.getByRole("link", { name: "Previous subject: 猫" }));
  });

  it("keeps the requested listening total steady while clips stream, then falls back to the available total", () => {
    const question = makeListeningQuestion({ autoPlayAudio: false });
    const session = { ...makeSession(question), mode: "listening" as const };
    const props = { scope: "test" as const, initialSession: session, expectedSubjectCount: 10, onExit: vi.fn() };
    const { rerender } = render(<QuizSession {...props} loadingMore />);

    expect(screen.getByText("1 / 10")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "10");

    rerender(<QuizSession {...props} loadingMore={false} />);
    expect(screen.getByText("1 / 1")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "1");
  });

  it("summarizes listening responses by subject with scene playback and detail access", () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const characters = makeListeningQuestion({ id: "cat:characters", autoPlayAudio: false });
    const meaning = makeListeningQuestion({ id: "cat:meaning", kind: "listening-meaning", choices: ["Cat", "Dog"], acceptedAnswers: ["Cat"], displayAnswer: "Cat", autoPlayAudio: false });
    const subject = makeSubject();
    subject.data.characters = "猫";
    subject.data.slug = "猫";
    subject.data.meanings = [{ meaning: "Cat", primary: true, accepted_answer: true }];
    const session: StudySession = {
      ...makeSession(characters),
      mode: "listening",
      questions: [characters, meaning],
      answers: [
        { questionId: characters.id, value: "猫", correct: true, answeredAt: "2026-08-17T00:01:00.000Z" },
        { questionId: meaning.id, value: "Dog", correct: false, answeredAt: "2026-08-17T00:02:00.000Z" },
      ],
      currentIndex: 2,
      complete: true,
    };

    render(<QuizSession scope="test" initialSession={session} subjects={[subject]} onExit={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Session results" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Response review" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "猫 responses" })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Vocabulary 猫 猫 Correct/ })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Meaning Dog Cat Incorrect/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Scene from Sword Art Online" })).toBeVisible();
    expect(screen.getByText("猫が好きです。", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("I like cats.", { exact: true })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open 猫 subject details" })).toHaveAttribute("href", "/subjects/1");
    expect(screen.getByRole("link", { name: "Open 猫 subject details" })).toHaveAttribute("target", "_blank");

    fireEvent.click(screen.getByRole("button", { name: "Replay audio for 猫" }));
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("uses the same response review for non-listening extra-study quizzes", () => {
    const question = makeQuestion();
    const session: StudySession = {
      ...makeSession(question),
      answers: [{ questionId: question.id, value: "ぼうぐ", correct: false, answeredAt: "2026-08-17T00:01:00.000Z" }],
      currentIndex: 1,
      complete: true,
    };

    render(<QuizSession scope="test" initialSession={session} subjects={[makeSubject()]} onExit={vi.fn()} />);

    expect(screen.getByRole("table", { name: "防ぐ responses" })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Reading ぼうぐ ふせぐ Incorrect/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open 防ぐ subject details" })).toHaveAttribute("href", "/subjects/1");
    expect(screen.queryByRole("button", { name: "Review 1 misses" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to setup" })).toHaveAttribute("data-result-action");
  });

  it("clears a completed session as soon as its results are reached", () => {
    const question = makeQuestion();
    const session: StudySession = {
      ...makeSession(question),
      answers: [{ questionId: question.id, value: "ふせぐ", correct: true, answeredAt: "2026-08-17T00:01:00.000Z" }],
      currentIndex: 1,
      complete: true,
    };
    window.localStorage.setItem(sessionKey("test", session.mode), JSON.stringify(session));

    render(<QuizSession scope="test" initialSession={session} subjects={[makeSubject()]} onExit={vi.fn()} />);

    expect(loadStudySession("test", session.mode)).toBeNull();
  });
});
