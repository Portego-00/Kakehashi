import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCustomSrsState, enrollCustomVocabularyPack } from "./model";
import { CUSTOM_VOCABULARY_PACKS } from "./catalog";
import type { CustomSrsState } from "./types";
import { CustomVocabularyDetail } from "./CustomVocabularyDetail";

const mocks = vi.hoisted(() => ({
  state: null as CustomSrsState | null,
  storageMode: "cloud" as "cloud" | "browser",
  isLoading: false,
  showVocabularyFrequency: false,
}));

const fetchImmersionExamplesMock = vi.hoisted(() => vi.fn());

const voiceMock = vi.hoisted(() => ({
  checked: true,
  supported: true,
  downloaded: true,
  activity: "idle" as const,
  activeSentence: null,
  progress: null,
  message: null,
  error: null,
  download: vi.fn(),
  play: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  useSession: () => ({ user: { id: 42, data: { username: "Pozab" } } }),
}));

vi.mock("@/features/settings/use-workspace-preferences", () => ({
  useWebSettings: () => ({
    subjectDetails: {
      showContextSentences: false,
      showImmersionExamples: true,
      showPitchAccent: true,
      showKanjiReadingExamples: true,
      showStrokeOrder: true,
      showPatternsOfUse: true,
    },
    study: {
      immersionKitAnimeSources: ["*"],
      showVocabularyFrequency: mocks.showVocabularyFrequency,
    },
  }),
}));

vi.mock("@/features/study/immersion", () => ({
  fetchImmersionExamples: fetchImmersionExamplesMock,
}));

vi.mock("@/features/speech/use-japanese-voice", () => ({
  useJapaneseVoice: () => voiceMock,
}));

vi.mock("./use-custom-srs", () => ({
  useCustomSrs: () => ({
    state: mocks.state,
    storageMode: mocks.storageMode,
    isLoading: mocks.isLoading,
    isUnavailable: false,
  }),
}));

const pack = CUSTOM_VOCABULARY_PACKS.find((candidate) => candidate.id === "conversation-glue")!;
const word = pack.words.find((candidate) => candidate.id === "conversation-douzo")!;

function renderDetail(detailWord = word, packTitle = pack.title) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><CustomVocabularyDetail word={detailWord} packTitle={packTitle} /></QueryClientProvider>);
}

describe("custom vocabulary subject details", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    mocks.state = createCustomSrsState(new Date("2026-08-31T09:00:00.000Z"));
    mocks.storageMode = "cloud";
    mocks.isLoading = false;
    mocks.showVocabularyFrequency = false;
    fetchImmersionExamplesMock.mockReset();
    fetchImmersionExamplesMock.mockResolvedValue([
      {
        title: "Nichijou",
        sentence: "こちらへどうぞ。",
        translation: "Please, come this way.",
        audio: "https://example.com/nichijou.mp3",
        imageUrl: "https://example.com/nichijou.jpg",
      },
    ]);
  });

  it("shows kana vocabulary with Meaning and Context tabs plus anime examples", async () => {
    const { container } = renderDetail();

    const page = container.querySelector("[data-custom-vocabulary-detail]");
    const hero = page?.querySelector('header[data-type="vocabulary"]');
    expect(page).toHaveAttribute("data-subject-detail-type", "vocabulary");
    expect(hero).toBeInTheDocument();
    expect(within(hero as HTMLElement).getByRole("heading", { level: 1, name: "Please" })).toBeInTheDocument();
    expect(within(hero as HTMLElement).getAllByText("どうぞ")).toHaveLength(1);
    expect(within(hero as HTMLElement).getByText("Preview")).toBeInTheDocument();
    expect(within(hero as HTMLElement).getByText("Cloud progress")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to vocabulary packs" })).toHaveAttribute("href", "/custom-vocabulary");
    expect(screen.queryByRole("link", { name: "Explore subject constellation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open subject on WaniKani" })).not.toBeInTheDocument();

    const nameSection = screen.getByRole("heading", { name: "Name" }).closest("section")!;
    expect(nameSection).toHaveTextContent("PrimaryPlease");
    expect(nameSection).toHaveTextContent("AlternativeHere You Go, Go Ahead");
    expect(nameSection).toHaveTextContent("Part of speechadverb, expression");
    const mnemonicSection = screen.getByRole("heading", { name: "Mnemonic" }).closest("section")!;
    expect(mnemonicSection.querySelector('[data-mnemonic-kind="reading"]')).toBeInTheDocument();
    expect(mnemonicSection.querySelector('[data-mnemonic-kind="vocabulary"]')).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Meaning", "Context"]);
    expect(screen.queryByRole("tab", { name: "Reading" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Context" }));
    const context = screen.getByRole("heading", { name: "Context sentences" }).closest("section")!;
    expect(context).toHaveTextContent("こちらの席へどうぞ。");
    expect(context).toHaveTextContent("Please take this seat.");
    const anime = (await screen.findByText("Nichijou")).closest("section")!;
    expect(within(anime).getByRole("heading", { name: "Anime context" })).toBeInTheDocument();
    expect(anime).toHaveTextContent("Nichijou");
    expect(anime).toHaveTextContent("こちらへどうぞ。");
    expect(anime).toHaveTextContent("Please, come this way.");
    expect(fetchImmersionExamplesMock).toHaveBeenCalledWith("どうぞ", ["*"], expect.any(AbortSignal));
  });

  it("uses the persisted custom stage and storage source after enrollment", () => {
    const enrolled = enrollCustomVocabularyPack(mocks.state!, pack, new Date("2026-08-31T09:00:00.000Z"));
    enrolled.assignments[word.id] = { ...enrolled.assignments[word.id], stage: 5 };
    mocks.state = enrolled;
    mocks.storageMode = "browser";

    renderDetail();

    expect(screen.getByLabelText("Custom vocabulary progress")).toHaveTextContent("Guru I");
    expect(screen.getByLabelText("Custom vocabulary progress")).toHaveTextContent("Browser progress");
    expect(screen.getByRole("heading", { name: "Your progression" }).closest("section")).toHaveTextContent("StageGuru I");
  });

  it("shows the required WaniKani level for kanji vocabulary", () => {
    const { container } = renderDetail(
      { ...word, characters: "足音", reading: "あしおと", requiredLevel: 8, kanjiLevels: { "足": 4, "音": 8 } },
      "Everyday Kanji · Levels 1–10",
    );

    expect(screen.getByLabelText("Custom vocabulary progress")).toHaveTextContent("WaniKani level 8+");
    expect(screen.getByRole("tab", { name: "Reading" })).toBeInTheDocument();
    expect(within(container.querySelector("header")!).getByText("あしおと")).toBeInTheDocument();
  });

  it("shows the frequency rank in the Name section when the web setting is enabled", async () => {
    mocks.showVocabularyFrequency = true;
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ result: {
      provider: "jiten",
      frequencyRank: 1_500,
      wordId: 1390020,
      readingIndex: 0,
      matchedText: "どうぞ",
      matchedReading: "どうぞ",
      sourceUrl: "https://jiten.moe/search?query=%E3%81%A9%E3%81%86%E3%81%9E",
    } }), { status: 200 })));

    renderDetail();

    const nameSection = screen.getByRole("heading", { name: "Name" }).closest("section")!;
    expect(within(nameSection).getByText("Frequency")).toBeInTheDocument();
    expect(await within(nameSection).findByLabelText("Vocabulary frequency #1,500")).toHaveTextContent("#1,500");
  });
});
