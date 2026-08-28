import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Assignment, Subject } from "@/types/wanikani";
import { filterStudySubjects } from "../engine";
import { wordleCandidates } from "../games";
import { getModeDefaultFilters } from "../mode-config";
import { CustomLessons, KanaWordle, SubjectLists } from "./special-modes";

const { wkCollectionMock } = vi.hoisted(() => ({ wkCollectionMock: vi.fn() }));

vi.mock("@/lib/wanikani/client", () => ({
  wkCollection: wkCollectionMock,
  wkRequest: vi.fn(),
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

function vocabulary(id: number, characters: string, reading: string, meaning: string): Subject {
  return {
    id,
    object: "vocabulary",
    url: "",
    data_updated_at: "",
    data: {
      level: 1,
      created_at: "",
      slug: characters,
      document_url: "",
      hidden_at: null,
      characters,
      meanings: [{ meaning, primary: true, accepted_answer: true }],
      auxiliary_meanings: [],
      readings: [{ reading, primary: true, accepted_answer: true }],
    },
  };
}

function imageRadical(): Subject {
  return {
    id: 876,
    object: "radical",
    url: "https://api.wanikani.com/v2/subjects/876",
    data_updated_at: "2026-08-26T00:00:00.000Z",
    data: {
      level: 4,
      created_at: "2026-08-26T00:00:00.000Z",
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

function assignment(id: number, subjectId: number): Assignment {
  return {
    id,
    object: "assignment",
    url: "",
    data_updated_at: "",
    data: {
      subject_id: subjectId,
      subject_type: "vocabulary",
      srs_stage: 5,
      available_at: null,
      started_at: "2026-08-26T00:00:00.000Z",
      unlocked_at: "2026-08-26T00:00:00.000Z",
      passed_at: null,
      burned_at: null,
      resurrected_at: null,
      hidden: false,
      created_at: "2026-08-26T00:00:00.000Z",
    },
  };
}

describe("Kana Wordle", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    wkCollectionMock.mockReset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("starts a matching game immediately when the kana count changes", () => {
    const subjects = [
      vocabulary(1, "桜", "さくら", "Cherry blossom"),
      vocabulary(2, "平仮名", "ひらがな", "Hiragana"),
    ];
    const dataset = {
      subjects,
      assignments: subjects.map((subject, index) => assignment(index + 1, subject.id)),
    };
    const filters = { ...getModeDefaultFilters("kana-wordle", 60), wordLength: 3 };

    expect(wordleCandidates(filterStudySubjects(dataset, filters), 4)).toHaveLength(1);

    render(
      <KanaWordle
        dataset={dataset}
        filters={filters}
        scope="wordle-length-test"
        onExit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Guesses").firstElementChild?.children).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "4 kana" }));

    expect(screen.queryByText("No 4-kana vocabulary was found in this range.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Guesses").firstElementChild?.children).toHaveLength(4);
  });
});

describe("Custom Lessons", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    wkCollectionMock.mockReset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows the canonical subject sections for the current lesson", async () => {
    const subject = vocabulary(1, "防ぐ", "ふせぐ", "Prevent");
    subject.data.meaning_mnemonic = "Put up a shield to prevent trouble from reaching you.";
    subject.data.reading_mnemonic = "Picture a fuse stopping the trouble before it arrives.";
    subject.data.context_sentences = [{ ja: "事故を防ぐ。", en: "Prevent an accident." }];
    subject.data.parts_of_speech = ["transitive verb", "godan verb"];
    subject.data.pronunciation_audios = [{
      url: "https://example.com/fusegu.mp3",
      content_type: "audio/mpeg",
      metadata: { gender: "female", source_id: 1, pronunciation: "ふせぐ", voice_actor_id: 1, voice_actor_name: "Kyoko", voice_description: "Tokyo accent" },
    }];
    const dataset = { subjects: [subject], assignments: [assignment(1, subject.id)] };
    const filters = { ...getModeDefaultFilters("custom-lessons", 60), selectedSubjectIds: [subject.id] };
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
    wkCollectionMock.mockResolvedValue([]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ examples: [] }), { status: 200, headers: { "Content-Type": "application/json" } })));

    render(
      <QueryClientProvider client={queryClient}>
        <CustomLessons dataset={dataset} filters={filters} scope="canonical-custom-lessons" onExit={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("tablist", { name: "Subject details" })).toBeInTheDocument();
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
    expect(screen.getByText("事故を防ぐ。")).toBeInTheDocument();
  });

  it("uses WaniKani artwork for an image-only radical lesson", () => {
    const subject = imageRadical();
    const radicalAssignment = assignment(1, subject.id);
    radicalAssignment.data.subject_type = "radical";
    const dataset = { subjects: [subject], assignments: [radicalAssignment] };
    const filters = { ...getModeDefaultFilters("custom-lessons", 60), selectedSubjectIds: [subject.id] };
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
    wkCollectionMock.mockResolvedValue([]);

    render(
      <QueryClientProvider client={queryClient}>
        <CustomLessons dataset={dataset} filters={filters} scope="radical-custom-lesson" onExit={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("heading", { name: "Rib Cage radical" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Rib Cage radical" })).toHaveAttribute("src", "https://files.wanikani.com/rib-cage.svg");
  });
});

describe("Subject Lists", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses WaniKani artwork instead of the generic radical placeholder", () => {
    const list = { id: "radicals", name: "Radicals", subjectIds: [876], createdAt: "2026-08-26T00:00:00.000Z", updatedAt: "2026-08-26T00:00:00.000Z" };
    window.localStorage.setItem("kakehashi-web:subject-lists:radical-user:v1", JSON.stringify({ version: 1, lists: [list] }));
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));

    render(<SubjectLists subjects={[imageRadical()]} scope="radical-list" username="radical-user" />);

    expect(screen.getByRole("img", { name: "Rib Cage radical" })).toHaveAttribute("src", "https://files.wanikani.com/rib-cage.svg");
    expect(screen.queryByText("◈")).not.toBeInTheDocument();
  });
});
