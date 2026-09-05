import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createListRepository } from "@/features/subjects/lists";
import type { StudyMaterial, Subject } from "@/types/wanikani";
import { ContextSentences, StudyMaterialEditor, SubjectDetail, SubjectDetailPanels, SubjectStickyHeader } from "./SubjectDetail";

const { wkCollectionMock, wkRequestMock } = vi.hoisted(() => ({ wkCollectionMock: vi.fn(), wkRequestMock: vi.fn() }));
const voiceMock = vi.hoisted(() => ({
  checked: true,
  supported: true,
  downloaded: true,
  activity: "idle" as "idle" | "downloading" | "synthesizing" | "playing",
  activeSentence: null as string | null,
  progress: null as number | null,
  message: null as string | null,
  error: null as string | null,
  download: vi.fn(),
  play: vi.fn(),
  stop: vi.fn(),
}));

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

vi.mock("@/lib/wanikani/client", () => ({
  wkCollection: wkCollectionMock,
  wkRequest: wkRequestMock,
}));

vi.mock("@/lib/session", () => ({
  useSession: () => ({ user: null }),
}));

vi.mock("@/features/settings/use-workspace-preferences", () => ({
  useWebSettings: () => ({
    subjectDetails: {
      showContextSentences: false,
      showImmersionExamples: false,
      showPitchAccent: false,
      showKanjiReadingExamples: false,
      showStrokeOrder: false,
      showPatternsOfUse: false,
    },
    study: { immersionKitAnimeSources: [] },
  }),
}));

vi.mock("@/features/speech/use-japanese-voice", () => ({
  useJapaneseVoice: () => voiceMock,
}));

const material: StudyMaterial = {
  id: 42,
  object: "study_material",
  url: "https://api.wanikani.com/v2/study_materials/42",
  data_updated_at: "2026-08-25T10:00:00.000Z",
  data: {
    subject_id: 7,
    subject_type: "vocabulary",
    meaning_synonyms: ["daily"],
    meaning_note: "Keep this compact.",
    reading_note: "Remember the long vowel.",
    hidden: false,
    created_at: "2026-08-25T09:00:00.000Z",
  },
};

function renderEditor() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><StudyMaterialEditor subjectId={7} material={material} queryKey={["study-material", 7]} loading={false} /></QueryClientProvider>);
}

const contextSentences = [
  { ja: "これは普通の例文です。", en: "This is a normal example sentence." },
  { ja: "毎朝、電車で本を読みます。", en: "I read a book on the train every morning." },
];

const audioSubject: Subject = {
  id: 88,
  object: "vocabulary",
  url: "https://api.wanikani.com/v2/subjects/88",
  data_updated_at: "2026-08-27T00:00:00.000Z",
  data: {
    level: 5,
    created_at: "2026-08-27T00:00:00.000Z",
    slug: "熱心",
    document_url: "https://www.wanikani.com/vocabulary/熱心",
    hidden_at: null,
    characters: "熱心",
    meanings: [{ meaning: "Enthusiasm", primary: true, accepted_answer: true }],
    auxiliary_meanings: [],
    readings: [{ reading: "ねっしん", primary: true, accepted_answer: true }],
    pronunciation_audios: [
      { url: "https://example.com/kyoko.mp3", content_type: "audio/mpeg", metadata: { gender: "female", source_id: 1, pronunciation: "ねっしん", voice_actor_id: 1, voice_actor_name: "Kyoko", voice_description: "Tokyo accent" } },
      { url: "https://example.com/kenichi.mp3", content_type: "audio/mpeg", metadata: { gender: "male", source_id: 2, pronunciation: "ねっしん", voice_actor_id: 2, voice_actor_name: "Kenichi", voice_description: "Tokyo accent" } },
    ],
  },
};

const kanaVocabularySubject = {
  ...audioSubject,
  id: 89,
  object: "kana_vocabulary",
  data: {
    ...audioSubject.data,
    slug: "おはよう",
    characters: "おはよう",
    meanings: [{ meaning: "Good Morning", primary: true, accepted_answer: true }],
    readings: [{ reading: "おはよう", primary: true, accepted_answer: true }],
    meaning_mnemonic: "From <reading>Ohio</reading>, you shout <vocabulary>good morning</vocabulary>.",
    reading_mnemonic: "This internal reading note should not create a separate tab.",
    context_sentences: [{ ja: "おはよう、よく眠れた？", en: "Good morning, did you sleep well?" }],
    pronunciation_audios: [],
  },
} as Subject;

const imageRadical = {
  id: 876,
  object: "radical",
  url: "https://api.wanikani.com/v2/subjects/876",
  data_updated_at: "2026-08-27T00:00:00.000Z",
  data: {
    level: 4,
    created_at: "2026-08-27T00:00:00.000Z",
    slug: "rib-cage",
    document_url: "https://www.wanikani.com/radicals/rib-cage",
    hidden_at: null,
    characters: null,
    meanings: [{ meaning: "Rib Cage", primary: true, accepted_answer: true }],
    auxiliary_meanings: [],
    character_images: [
      { url: "https://files.wanikani.com/rib-cage-256.png", content_type: "image/png", metadata: { dimensions: "256x256" } },
      { url: "https://files.wanikani.com/rib-cage.svg", content_type: "image/svg+xml" },
    ],
  },
} as Subject;

const oneSubject = {
  id: 1,
  object: "kanji",
  data: {
    level: 1,
    slug: "一",
    characters: "一",
    meanings: [{ meaning: "One", primary: true }],
  },
} as Subject;

function renderAudioSubject() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><SubjectDetailPanels
    record={audioSubject}
    materialLoading={false}
    materialsKey={["study-material", audioSubject.id]}
    relatedSubjects={[]}
    pitchAccents={[]}
    usagePatterns={[]}
    immersionExamples={[
      { title: "Re:Zero", sentence: "そんな熱心に見つめられると", translation: "It is embarrassing when you stare so intently.", audio: "https://example.com/re-zero.mp3" },
      { title: "KonoSuba", sentence: "熱心な信者です", translation: "A devoted believer." },
    ]}
    immersionLoading={false}
    immersionFailed={false}
    settings={{ showContextSentences: false, showImmersionExamples: true, showPitchAccent: false, showKanjiReadingExamples: false, showStrokeOrder: false, showPatternsOfUse: false }}
    returnTo="/subjects"
    initialTab="reading"
  /></QueryClientProvider>);
}

describe("normal vocabulary context speech", () => {
  beforeEach(() => {
    Object.assign(voiceMock, {
      checked: true,
      supported: true,
      downloaded: true,
      activity: "idle",
      activeSentence: null,
      progress: null,
      message: null,
      error: null,
    });
    voiceMock.download.mockReset();
    voiceMock.play.mockReset();
    voiceMock.stop.mockReset();
  });

  it("plays only the selected Japanese context sentence", () => {
    const { container } = render(<ContextSentences sentences={contextSentences} />);

    const first = screen.getByRole("button", { name: "Play Japanese context sentence 1: これは普通の例文です。" });
    expect(screen.getByRole("button", { name: "Play Japanese context sentence 2: 毎朝、電車で本を読みます。" })).toBeEnabled();
    expect(screen.queryByText("Saved in this browser")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(container.querySelector("audio")).not.toBeInTheDocument();

    fireEvent.click(first);
    expect(voiceMock.play).toHaveBeenCalledWith("これは普通の例文です。");
    expect(voiceMock.play).not.toHaveBeenCalledWith(contextSentences[0].en);
  });

  it("requires an explicit voice download before enabling sentence playback", () => {
    Object.assign(voiceMock, { downloaded: false });
    render(<ContextSentences sentences={contextSentences} />);

    const download = screen.getByRole("button", { name: "Download voice · about 400 MB" });
    expect(screen.getByRole("button", { name: /Play Japanese context sentence 1/u })).toBeDisabled();
    fireEvent.click(download);
    expect(voiceMock.download).toHaveBeenCalledOnce();
  });

  it("offers stop on the active sentence without enabling the others", () => {
    Object.assign(voiceMock, { activity: "playing", activeSentence: contextSentences[0].ja, message: "Playing Japanese sentence…" });
    render(<ContextSentences sentences={contextSentences} />);

    const stop = screen.getByRole("button", { name: "Stop Japanese context sentence 1" });
    expect(screen.queryByText("Playing Japanese sentence…")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Play Japanese context sentence 2/u })).toBeDisabled();
    fireEvent.click(stop);
    expect(voiceMock.stop).toHaveBeenCalledOnce();
  });
});

describe("subject detail media buttons", () => {
  it("uses compact custom controls for pronunciation and anime context", () => {
    const { container } = renderAudioSubject();

    expect(screen.getByRole("button", { name: "Play Kyoko pronunciation" })).toHaveTextContent("Kyoko (female)");
    expect(screen.getByRole("button", { name: "Play Kenichi pronunciation" })).toHaveTextContent("Kenichi (male)");
    expect(screen.getAllByText("Tokyo accent · ねっしん")).toHaveLength(2);

    fireEvent.click(screen.getByRole("tab", { name: "Context" }));
    const reZero = screen.getByText("Re:Zero").closest("figure");
    const konosuba = screen.getByText("KonoSuba").closest("figure");
    expect(reZero).not.toBeNull();
    expect(konosuba).not.toBeNull();
    expect(within(reZero!).getByRole("button", { name: "Play anime clip from Re:Zero" })).toBeEnabled();
    expect(within(konosuba!).getByRole("button", { name: "Audio unavailable for anime clip from KonoSuba" })).toBeDisabled();
    expect(container.querySelector("audio[controls]")).not.toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("keeps kana vocabulary to Meaning and Context even when reading data exists", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(<QueryClientProvider client={client}><SubjectDetailPanels
      record={kanaVocabularySubject}
      materialLoading={false}
      materialsKey={["study-material", kanaVocabularySubject.id]}
      relatedSubjects={[]}
      pitchAccents={[]}
      usagePatterns={[]}
      immersionExamples={[]}
      immersionLoading={false}
      immersionFailed={false}
      settings={{ showContextSentences: true, showImmersionExamples: false, showPitchAccent: false, showKanjiReadingExamples: false, showStrokeOrder: false, showPatternsOfUse: false }}
      returnTo="/subjects"
      initialTab="reading"
    /></QueryClientProvider>);

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Meaning", "Context"]);
    expect(screen.getByRole("tab", { name: "Meaning" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: "Reading" })).not.toBeInTheDocument();
  });

  it("renders WaniKani mnemonic tags and numeric entities on ordinary subject pages", () => {
    const taggedSubject = {
      ...audioSubject,
      data: {
        ...audioSubject.data,
        meaning_mnemonic: "&#x41;&#x20;<radical>sun</radical> enters the <kanji>heart</kanji> and creates <vocabulary>enthusiasm</vocabulary>. It is <em>intense</em> &amp; has <meaning>purpose</meaning>.\n\n<ja>熱心</ja> appears in <a href=\"https://www.wanikani.com/vocabulary/熱心\" onclick=\"ignored()\">ordinary use</a>; <a href=\"javascript:ignored()\">unsafe links stay text</a>, as does <future-tag>future markup</future-tag>.",
        reading_mnemonic: "A <ja><reading>NET—SHIN</reading></ja> catches the <i>feeling</i>.",
      },
    } as Subject;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const { container } = render(<QueryClientProvider client={client}><SubjectDetailPanels
      record={taggedSubject}
      materialLoading={false}
      materialsKey={["study-material", taggedSubject.id]}
      relatedSubjects={[]}
      pitchAccents={[]}
      usagePatterns={[]}
      immersionExamples={[]}
      immersionLoading={false}
      immersionFailed={false}
      settings={{ showContextSentences: false, showImmersionExamples: false, showPitchAccent: false, showKanjiReadingExamples: false, showStrokeOrder: false, showPatternsOfUse: false }}
      returnTo="/subjects"
    /></QueryClientProvider>);

    const mnemonic = screen.getByRole("heading", { name: "Mnemonic" }).closest("section")!;
    expect(mnemonic).toHaveTextContent("A sun enters the heart and creates enthusiasm. It is intense & has purpose.");
    expect(mnemonic.querySelector('[data-mnemonic-kind="radical"]')).toHaveTextContent("sun");
    expect(mnemonic.querySelector('[data-mnemonic-kind="kanji"]')).toHaveTextContent("heart");
    expect(mnemonic.querySelector('[data-mnemonic-kind="vocabulary"]')).toHaveTextContent("enthusiasm");
    expect(mnemonic.querySelector('[data-mnemonic-kind="meaning"]')).toHaveTextContent("purpose");
    expect(within(mnemonic).getByText("intense", { selector: "em" })).toBeInTheDocument();
    expect(within(mnemonic).getByText("熱心")).toHaveAttribute("lang", "ja");
    expect(within(mnemonic).getByRole("link", { name: "ordinary use" })).toHaveAttribute("rel", "noopener noreferrer");
    expect(within(mnemonic).queryByRole("link", { name: "unsafe links stay text" })).not.toBeInTheDocument();
    expect(mnemonic).toHaveTextContent("unsafe links stay text");
    expect(mnemonic).toHaveTextContent("future markup");

    fireEvent.click(screen.getByRole("tab", { name: "Reading" }));
    expect(container.querySelector('[data-mnemonic-kind="reading"]')).toHaveTextContent("NET—SHIN");
    expect(within(screen.getByRole("heading", { name: "Reading mnemonic" }).closest("section")!).getByText("NET—SHIN").closest("span")).toHaveAttribute("lang", "ja");
    expect(screen.getByText("feeling", { selector: "em" })).toBeInTheDocument();
  });
});

describe("subject detail vocabulary frequency", () => {
  it("shows the formatted frequency rank in the vocabulary Name section when enabled", async () => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ result: {
      provider: "jiten",
      frequencyRank: 1_500,
      wordId: 1390020,
      readingIndex: 0,
      matchedText: "熱心",
      matchedReading: "ねっしん",
      sourceUrl: "https://jiten.moe/search?query=%E7%86%B1%E5%BF%83",
    } }), { status: 200 })));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

    render(<QueryClientProvider client={client}><SubjectDetailPanels
      record={audioSubject}
      materialLoading={false}
      materialsKey={["study-material", audioSubject.id]}
      relatedSubjects={[]}
      pitchAccents={[]}
      usagePatterns={[]}
      immersionExamples={[]}
      immersionLoading={false}
      immersionFailed={false}
      settings={{ showContextSentences: false, showImmersionExamples: false, showPitchAccent: false, showKanjiReadingExamples: false, showStrokeOrder: false, showPatternsOfUse: false }}
      showVocabularyFrequency
      returnTo="/subjects"
    /></QueryClientProvider>);

    expect(screen.getByText("Frequency")).toBeInTheDocument();
    expect(await screen.findByLabelText("Vocabulary frequency #1,500")).toHaveTextContent("#1,500");
  });
});

describe("image-only radical identity", () => {
  beforeEach(() => {
    wkCollectionMock.mockReset();
    wkRequestMock.mockReset();
  });

  it("uses the WaniKani artwork in the hero and sticky header", async () => {
    wkRequestMock.mockResolvedValue(imageRadical);
    wkCollectionMock.mockResolvedValue([]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

    const { container } = render(<QueryClientProvider client={client}><SubjectDetail id={imageRadical.id} /></QueryClientProvider>);

    expect(await screen.findByRole("heading", { name: "Rib Cage" })).toBeInTheDocument();
    const images = container.querySelectorAll<HTMLImageElement>('img[alt="Rib Cage radical"]');
    const tintFilters = container.querySelectorAll("filter[data-subject-image-tint]");
    expect(images).toHaveLength(2);
    expect(tintFilters).toHaveLength(2);
    expect([...images].map((image) => image.getAttribute("src"))).toEqual([
      "https://files.wanikani.com/rib-cage.svg",
      "https://files.wanikani.com/rib-cage.svg",
    ]);
    expect([...images].every((image) => /^url\("#[^"]+"\)$/.test(image.style.filter))).toBe(true);
  });

  it("uses the WaniKani artwork in relationship cards", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const record = {
      ...oneSubject,
      data: { ...oneSubject.data, component_subject_ids: [imageRadical.id] },
    } as Subject;

    render(<QueryClientProvider client={client}><SubjectDetailPanels
      record={record}
      materialLoading={false}
      materialsKey={["study-material", record.id]}
      relatedSubjects={[imageRadical]}
      pitchAccents={[]}
      usagePatterns={[]}
      immersionExamples={[]}
      immersionLoading={false}
      immersionFailed={false}
      settings={{ showContextSentences: false, showImmersionExamples: false, showPitchAccent: false, showKanjiReadingExamples: false, showStrokeOrder: false, showPatternsOfUse: false }}
      returnTo="/subjects"
    /></QueryClientProvider>);

    expect(screen.getByRole("img", { name: "Rib Cage radical" })).toHaveAttribute("src", "https://files.wanikani.com/rib-cage.svg");
  });
});

describe("subject detail saved-list action", () => {
  beforeEach(() => {
    wkCollectionMock.mockReset().mockResolvedValue([]);
    wkRequestMock.mockReset().mockResolvedValue(imageRadical);
  });

  it("shows existing membership and opens the mobile-style list picker", async () => {
    const repository = createListRepository(window.localStorage, "anonymous");
    const saved = repository.create("Saved subjects");
    repository.addSubject(saved.id, imageRadical.id);
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (_input, init) => new Response(JSON.stringify(init?.method === "PUT" ? {} : { lists: [] }), { status: 200 })));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

    render(<QueryClientProvider client={client}><SubjectDetail id={imageRadical.id} /></QueryClientProvider>);

    const action = await screen.findByRole("button", { name: "Edit saved lists" });
    expect(action).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(action);

    const dialog = screen.getByRole("dialog", { name: "Add to Lists" });
    expect(within(dialog).getByRole("checkbox", { name: /Saved subjects/ })).toBeChecked();
  });
});

describe("subject detail notes", () => {
  beforeEach(() => wkRequestMock.mockReset());

  it("shows compact read-only notes by default", () => {
    renderEditor();

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByText("daily")).toBeInTheDocument();
    expect(screen.getByText("Keep this compact.")).toBeInTheDocument();
    expect(screen.getByText("Remember the long vowel.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Meaning note" })).not.toBeInTheDocument();
    expect(screen.queryByText("Notes and synonyms sync back to WaniKani.")).not.toBeInTheDocument();
  });

  it("turns comma-separated synonyms into removable chips and saves the normalized list", async () => {
    const saved: StudyMaterial = {
      ...material,
      data: {
        ...material.data,
        meaning_synonyms: ["daily", "speedy", "quick"],
        meaning_note: "Updated meaning note.",
      },
    };
    wkRequestMock.mockResolvedValue(saved);
    renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const synonymInput = screen.getByRole("textbox", { name: "Meaning synonyms" });
    fireEvent.change(synonymInput, { target: { value: "speedy," } });
    expect(screen.getByRole("button", { name: "Remove synonym speedy" })).toBeInTheDocument();
    expect(synonymInput).toHaveValue("");

    fireEvent.change(synonymInput, { target: { value: "quick" } });
    fireEvent.keyDown(synonymInput, { key: "Enter" });
    expect(screen.getByRole("button", { name: "Remove synonym quick" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Meaning note" }), { target: { value: "Updated meaning note." } });
    fireEvent.click(screen.getByRole("button", { name: "Save notes" }));

    await waitFor(() => expect(wkRequestMock).toHaveBeenCalledWith("study_materials/42", {
      method: "PUT",
      body: {
        study_material: {
          meaning_note: "Updated meaning note.",
          reading_note: "Remember the long vowel.",
          meaning_synonyms: ["daily", "speedy", "quick"],
        },
      },
    }));
    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Meaning synonyms" })).not.toBeInTheDocument();
  });
});

describe("subject detail sticky header", () => {
  it("reveals after the subject hero clears the navigation and returns to the hero", async () => {
    const hero = document.createElement("header");
    let heroBottom = 120;
    hero.getBoundingClientRect = () => ({ bottom: heroBottom, height: 320, left: 0, right: 1200, top: heroBottom - 320, width: 1200, x: 0, y: heroBottom - 320, toJSON: () => ({}) });
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));

    const { container } = render(<SubjectStickyHeader heroRef={{ current: hero }} subject={oneSubject} meaning="One" reading="いち" level={1} />);
    const button = container.querySelector<HTMLButtonElement>('[aria-label="Back to One"]');
    const stickyHeader = button?.parentElement;

    expect(stickyHeader).toHaveAttribute("aria-hidden", "true");
    expect(button).toHaveAttribute("tabindex", "-1");

    heroBottom = -1;
    fireEvent.scroll(window);
    await waitFor(() => expect(stickyHeader).toHaveAttribute("data-visible", "true"));
    expect(stickyHeader).toHaveAttribute("aria-hidden", "false");
    expect(button).toHaveAttribute("tabindex", "0");

    fireEvent.click(button!);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });
});

describe("subject detail nested tabs", () => {
  it("keeps usage-pattern arrows inside their own tablist during a lesson", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
    const nextLesson = vi.fn();
    render(<QueryClientProvider client={client}><SubjectDetailPanels
      record={audioSubject}
      materialLoading={false}
      materialsKey={["study-material", audioSubject.id]}
      relatedSubjects={[]}
      pitchAccents={[]}
      usagePatterns={[
        { name: "Everyday", examples: [{ ja: "熱心に学ぶ", en: "Study eagerly" }] },
        { name: "Formal", examples: [{ ja: "熱心に取り組む", en: "Work diligently" }] },
      ]}
      immersionExamples={[]}
      immersionLoading={false}
      immersionFailed={false}
      settings={{ showContextSentences: false, showImmersionExamples: false, showPitchAccent: false, showKanjiReadingExamples: false, showStrokeOrder: false, showPatternsOfUse: true }}
      returnTo="/lessons"
      initialTab="context"
      sequentialNavigation={{ next: nextLesson }}
    /></QueryClientProvider>);

    const everyday = screen.getByRole("tab", { name: "Everyday" });
    everyday.focus();
    fireEvent.keyDown(everyday, { key: "ArrowRight" });

    expect(screen.getByRole("tab", { name: "Formal" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(screen.getByRole("tab", { name: "Formal" })).toHaveFocus());
    expect(nextLesson).not.toHaveBeenCalled();
  });
});
