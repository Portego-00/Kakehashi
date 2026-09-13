import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VocabularyAudioVoice } from "@/features/settings/settings";
import type { Subject } from "@/types/wanikani";
import { StudyModeClient } from "./study-mode-client";

const preferenceState = vi.hoisted(() => ({
  autoplayAudio: true,
  vocabularyAudioVoice: "female" as "female" | "male" | "both",
}));

const engineMocks = vi.hoisted(() => ({
  questionKind: "reading" as "reading" | "meaning-to-reading" | "context",
  promptLabel: "Vocabulary reading",
  generateQuestions: vi.fn(() => [{
    id: "question-1",
    subjectId: 440,
    subjectType: "vocabulary" as const,
    kind: engineMocks.questionKind,
    prompt: "防ぐ",
    promptLabel: engineMocks.promptLabel,
    acceptedAnswers: ["ふせぐ"],
    displayAnswer: "ふせぐ",
    characters: "防ぐ",
    meaning: "Prevent",
  }]),
}));

const listMocks = vi.hoisted(() => ({
  repository: {
    load: vi.fn(() => []),
    replace: vi.fn(),
  },
}));

const subject: Subject = {
  id: 440,
  object: "vocabulary",
  url: "https://api.wanikani.com/v2/subjects/440",
  data_updated_at: "2026-08-27T00:00:00.000Z",
  data: {
    level: 12,
    created_at: "2026-08-27T00:00:00.000Z",
    slug: "防ぐ",
    document_url: "https://www.wanikani.com/vocabulary/%E9%98%B2%E3%81%90",
    hidden_at: null,
    characters: "防ぐ",
    meanings: [{ meaning: "Prevent", primary: true, accepted_answer: true }],
    auxiliary_meanings: [],
    readings: [{ reading: "ふせぐ", primary: true, accepted_answer: true }],
    pronunciation_audios: [
      {
        url: "https://example.com/fusegu-female.mp3",
        content_type: "audio/mpeg",
        metadata: {
          gender: "female",
          source_id: 1,
          pronunciation: "ふせぐ",
          voice_actor_id: 1,
          voice_actor_name: "Kyoko",
          voice_description: "Tokyo accent",
        },
      },
      {
        url: "https://example.com/fusegu-male.mp3",
        content_type: "audio/mpeg",
        metadata: {
          gender: "male",
          source_id: 2,
          pronunciation: "ふせぐ",
          voice_actor_id: 2,
          voice_actor_name: "Kenichi",
          voice_description: "Tokyo accent",
        },
      },
    ],
  },
};

vi.mock("@/features/settings/use-workspace-preferences", () => ({
  useWebSettings: () => ({
    subjectDetails: {
      showContextSentences: true,
      showImmersionExamples: false,
      showPitchAccent: false,
      showKanjiReadingExamples: true,
      showStrokeOrder: true,
      showPatternsOfUse: false,
    },
    integrations: { myAnimeListUsername: "", aniListUsername: "" },
    study: {
      autoplayAudio: preferenceState.autoplayAudio,
      vocabularyAudioVoice: preferenceState.vocabularyAudioVoice,
      immersionKitAnimeSources: [],
      showAnswerStopSubjectDetails: false,
      pauseOnWrong: false,
      pauseOnClose: false,
      pauseOnCorrect: false,
      acceptUserSynonymsAsAnswers: false,
      acceptAnyKanjiOnyomiReading: false,
      answerFeedbackSoundEnabled: false,
      showListeningTranslation: true,
      keyboardShortcuts: false,
    },
  }),
}));

vi.mock("../use-study-dataset", () => ({
  useStudyDataset: () => ({
    status: "authenticated",
    user: { id: "user-1", data: { username: "Test", level: 12 } },
    dataset: { subjects: [subject], assignments: [] },
    loading: false,
    fetching: false,
    error: null,
    retry: vi.fn(),
  }),
}));

vi.mock("@/features/subjects/use-subject-lists", () => ({
  useSubjectLists: () => ({ repository: listMocks.repository, lists: [] }),
}));

vi.mock("../engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../engine")>();
  return { ...actual, generateQuestions: engineMocks.generateQuestions };
});

class AudioProbe {
  static sources: string[] = [];
  static instances: AudioProbe[] = [];
  static autoEnd = true;
  private listeners = new Map<string, EventListener[]>();
  currentTime = 0;
  paused = false;

  constructor(source?: string) {
    AudioProbe.sources.push(source ?? "");
    AudioProbe.instances.push(this);
  }

  addEventListener(type: string, listener: EventListener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  removeEventListener(type: string, listener: EventListener) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((candidate) => candidate !== listener));
  }

  emit(type: string) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(new Event(type));
  }

  pause() {
    this.paused = true;
  }

  play() {
    if (AudioProbe.autoEnd) queueMicrotask(() => this.emit("ended"));
    return Promise.resolve();
  }
}

describe("extra-study vocabulary audio autoplay", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    AudioProbe.sources = [];
    AudioProbe.instances = [];
    AudioProbe.autoEnd = true;
    engineMocks.generateQuestions.mockClear();
    listMocks.repository.load.mockClear();
    listMocks.repository.replace.mockClear();
    preferenceState.autoplayAudio = true;
    preferenceState.vocabularyAudioVoice = "female";
    engineMocks.questionKind = "reading";
    engineMocks.promptLabel = "Vocabulary reading";
    vi.unstubAllGlobals();
  });

  it.each([
    ["female", ["https://example.com/fusegu-female.mp3"]],
    ["male", ["https://example.com/fusegu-male.mp3"]],
    ["both", ["https://example.com/fusegu-female.mp3", "https://example.com/fusegu-male.mp3"]],
  ] satisfies Array<[Exclude<VocabularyAudioVoice, "random">, string[]]>)
  ("autoplays the %s pronunciation selection after a correct Random Test reading", async (voice, expectedSources) => {
    preferenceState.vocabularyAudioVoice = voice;
    vi.stubGlobal("Audio", AudioProbe);

    render(<StudyModeClient mode="random-test" seedSubjectIds={[subject.id]} startImmediately />);

    const input = await screen.findByRole("textbox", { name: "Vocabulary Reading" });
    fireEvent.change(input, { target: { value: "fusegu" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(await screen.findByText("Correct", { exact: true })).toBeInTheDocument();
    await waitFor(() => expect(AudioProbe.sources).toEqual(expectedSources), { timeout: 300 });
  });

  it("cancels the remaining voice when the user advances during Both playback", async () => {
    preferenceState.vocabularyAudioVoice = "both";
    AudioProbe.autoEnd = false;
    vi.stubGlobal("Audio", AudioProbe);

    render(<StudyModeClient mode="random-test" seedSubjectIds={[subject.id]} startImmediately />);

    const input = await screen.findByRole("textbox", { name: "Vocabulary Reading" });
    fireEvent.change(input, { target: { value: "fusegu" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(await screen.findByText("Correct", { exact: true })).toBeInTheDocument();
    expect(AudioProbe.sources).toEqual(["https://example.com/fusegu-female.mp3"]);
    const firstVoice = AudioProbe.instances[0];
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("heading", { name: "Session results" })).toBeInTheDocument();
    firstVoice.emit("ended");

    await waitFor(() => expect(firstVoice.paused).toBe(true));
    expect(AudioProbe.sources).toEqual(["https://example.com/fusegu-female.mp3"]);
  });

  it.each(["recent-lessons", "custom-review"] as const)
  ("autoplays vocabulary pronunciation after a correct reading in %s", async (mode) => {
    vi.stubGlobal("Audio", AudioProbe);

    render(<StudyModeClient mode={mode} seedSubjectIds={[subject.id]} startImmediately />);

    const input = await screen.findByRole("textbox", { name: "Vocabulary Reading" });
    fireEvent.change(input, { target: { value: "fusegu" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(await screen.findByText("Correct", { exact: true })).toBeInTheDocument();
    await waitFor(() => expect(AudioProbe.sources).toEqual(["https://example.com/fusegu-female.mp3"]), { timeout: 300 });
  });

  it("autoplays vocabulary pronunciation after a correct Vocab Reading answer", async () => {
    preferenceState.vocabularyAudioVoice = "male";
    engineMocks.questionKind = "meaning-to-reading";
    engineMocks.promptLabel = "Type the reading in kana";
    vi.stubGlobal("Audio", AudioProbe);

    render(<StudyModeClient mode="vocab-reading" seedSubjectIds={[subject.id]} startImmediately />);

    const input = await screen.findByRole("textbox", { name: "Vocabulary Reading" });
    fireEvent.change(input, { target: { value: "fusegu" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(await screen.findByText("Correct", { exact: true })).toBeInTheDocument();
    await waitFor(() => expect(AudioProbe.sources).toEqual(["https://example.com/fusegu-male.mp3"]), { timeout: 300 });
  });

  it("stays silent when shared vocabulary autoplay is disabled", async () => {
    preferenceState.autoplayAudio = false;
    vi.stubGlobal("Audio", AudioProbe);

    render(<StudyModeClient mode="random-test" seedSubjectIds={[subject.id]} startImmediately />);

    const input = await screen.findByRole("textbox", { name: "Vocabulary Reading" });
    fireEvent.change(input, { target: { value: "fusegu" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(await screen.findByText("Correct", { exact: true })).toBeInTheDocument();
    expect(AudioProbe.sources).toEqual([]);
  });

  it("leaves Context Sentences on its dedicated sentence-audio settings", async () => {
    engineMocks.questionKind = "context";
    engineMocks.promptLabel = "Complete the sentence";
    vi.stubGlobal("Audio", AudioProbe);

    render(<StudyModeClient mode="context-sentences" seedSubjectIds={[subject.id]} startImmediately />);

    const input = await screen.findByRole("textbox", { name: "Vocabulary Answer" });
    fireEvent.change(input, { target: { value: "ふせぐ" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(await screen.findByText("Correct", { exact: true })).toBeInTheDocument();
    expect(AudioProbe.sources).toEqual([]);
  });
});
