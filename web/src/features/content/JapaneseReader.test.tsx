import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo, type AnchorHTMLAttributes, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Assignment, Subject, WKUser } from "@/types/wanikani";
import { JapaneseReader, useJapaneseReaderAnalysisContexts } from "./JapaneseReader";

const fixtures = vi.hoisted(() => {
  const user: WKUser = {
    id: 1,
    object: "user",
    url: "",
    data_updated_at: "",
    data: {
      username: "reader-test",
      level: 12,
      profile_url: "",
      started_at: "",
      current_vacation_started_at: null,
      preferences: { default_voice_actor_id: 1, lessons_autoplay_audio: false, lessons_batch_size: 5, lessons_presentation_order: "ascending_level_then_subject", reviews_autoplay_audio: false, reviews_display_srs_indicator: true },
      subscription: { active: true, type: "lifetime", max_level_granted: 60, period_ends_at: null },
    },
  };
  const subject: Subject = {
    id: 10,
    object: "vocabulary",
    url: "",
    data_updated_at: "",
    data: { level: 3, created_at: "", slug: "学校", document_url: "", hidden_at: null, characters: "学校", meanings: [{ meaning: "School", primary: true, accepted_answer: true }], auxiliary_meanings: [], readings: [{ reading: "がっこう", primary: true, accepted_answer: true }], parts_of_speech: ["noun"], pronunciation_audios: [{ url: "https://example.com/gakkou.mp3", content_type: "audio/mpeg", metadata: { gender: "female", source_id: 1, pronunciation: "がっこう", voice_actor_id: 1, voice_actor_name: "Kyoko", voice_description: "Tokyo accent" } }] },
  };
  const assignment: Assignment = {
    id: 110,
    object: "assignment",
    url: "",
    data_updated_at: "",
    data: { subject_id: 10, subject_type: "vocabulary", srs_stage: 6, available_at: null, started_at: "", unlocked_at: "", passed_at: "", burned_at: null, resurrected_at: null, hidden: false, created_at: "" },
  };
  return {
    assignment,
    dataset: { subjects: [subject] as Subject[], assignments: [assignment] as Assignment[] },
    subject,
    user,
    reader: { detailsInteraction: "click" as "click" | "hover", recognitionMode: "wk-jpdb" as "wk" | "wk-jpdb" },
    study: { showVocabularyFrequency: false },
    voice: { checked: true, supported: true, downloaded: false, activity: "idle" as "idle" | "downloading" | "synthesizing" | "playing", activeSentence: null as string | null, progress: null, message: null, error: null, download: vi.fn(), cancelDownload: vi.fn(), play: vi.fn(), stop: vi.fn() },
  };
});

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode; href: string }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("@/features/study/use-study-dataset", () => ({
  useStudyDataset: () => ({ user: fixtures.user, dataset: fixtures.dataset, loading: false }),
}));

vi.mock("@/features/settings/use-workspace-preferences", () => ({
  useWebSettings: () => ({ integrations: { jpdbApiKey: "configured-test-key" }, reader: fixtures.reader, study: fixtures.study }),
}));

vi.mock("@/features/speech/use-japanese-voice", () => ({
  useJapaneseVoice: () => fixtures.voice,
}));

function stubCatAnalysis() {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      tokens: [{ start: 0, end: 1, surface: "猫", spelling: "猫", reading: "ねこ", meaning: "cat", meanings: ["cat"], alternativeSpellings: ["ネコ"], partsOfSpeech: ["n"], tokenType: "vocabulary" }],
    }),
  }));
}

describe("JapaneseReader inspector", () => {
  beforeEach(() => {
    fixtures.reader.detailsInteraction = "click";
    fixtures.reader.recognitionMode = "wk-jpdb";
    fixtures.study.showVocabularyFrequency = false;
    fixtures.dataset.subjects = [fixtures.subject];
    fixtures.dataset.assignments = [fixtures.assignment];
    window.localStorage.clear();
    Object.assign(fixtures.voice, { checked: true, supported: true, downloaded: false, activity: "idle", activeSentence: null, progress: null, message: null, error: null });
    fixtures.voice.download.mockClear();
    fixtures.voice.cancelDownload.mockClear();
    fixtures.voice.play.mockClear();
    fixtures.voice.stop.mockClear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tokens: [
          { start: 0, end: 2, surface: "学校", spelling: "学校", reading: "がっこう", meaning: "school", meanings: ["school", "academy"], alternativeSpellings: ["學校"], partsOfSpeech: ["n"], tokenType: "vocabulary" },
          { start: 3, end: 4, surface: "猫", spelling: "猫", reading: "ねこ", meaning: "cat", meanings: ["cat", "domestic cat"], alternativeSpellings: ["ネコ"], partsOfSpeech: ["n"], tokenType: "vocabulary" },
        ],
      }),
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps the token-type key and a concise empty inspector in the default appearance", () => {
    render(<JapaneseReader text="学校" />);

    expect(screen.getByLabelText("Annotation key")).toBeInTheDocument();
    expect(screen.getByLabelText("Annotation key")).toHaveTextContent("VocabularyVerbsGrammar");
    expect(screen.getByRole("complementary")).toHaveTextContent("Word details");
    expect(screen.getByRole("complementary")).toHaveTextContent("Hover only highlights it");
  });

  it("supports undecorated inline tokens for tooltip-only surfaces", () => {
    const { container } = render(
      <JapaneseReader
        text="学校"
        appearance="inline"
        tokenDecoration="plain"
        inspectorMode="floating"
      />,
    );

    const reader = container.querySelector('[data-appearance="inline"]');
    expect(reader).toHaveAttribute("data-token-decoration", "plain");
    expect(screen.getByRole("article", { name: "Japanese reading text" })).toHaveTextContent("学校");
  });

  it("renders source furigana semantically and lets the parent turn it off", () => {
    const onShowFuriganaChange = vi.fn();
    const blocks = [{
      type: "text" as const,
      text: "学校へ行く。",
      furigana: [{ start: 0, end: 2, reading: "がっこう" }],
    }];
    const { container, rerender } = render(
      <JapaneseReader text="学校へ行く。" blocks={blocks} ariaLabel="Furigana article" showFurigana onShowFuriganaChange={onShowFuriganaChange} />,
    );

    const ruby = container.querySelector("ruby");
    expect(ruby).toHaveTextContent("学校がっこう");
    expect(ruby?.querySelector("rt")).toHaveTextContent("がっこう");
    expect(screen.getByRole("button", { name: /学校, Guru II WaniKani item/ })).toContainElement(ruby);
    const toggle = screen.getByRole("button", { name: "Furigana" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(toggle);
    expect(onShowFuriganaChange).toHaveBeenCalledWith(false);

    rerender(
      <JapaneseReader text="学校へ行く。" blocks={blocks} ariaLabel="Furigana article" showFurigana={false} onShowFuriganaChange={onShowFuriganaChange} />,
    );
    expect(container.querySelector("ruby")).not.toBeInTheDocument();
    expect(container.querySelector("rt")).not.toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Furigana article" })).toHaveTextContent("学校へ行く。");
    expect(screen.getByRole("button", { name: "Furigana" })).toHaveAttribute("aria-pressed", "false");
  });

  it("offers furigana and derives readings when a full article has no source ruby", () => {
    const onShowFuriganaChange = vi.fn();
    const blocks = [{ type: "text" as const, text: "学校へ行く。" }];
    const { container, rerender } = render(
      <JapaneseReader
        text="学校へ行く。"
        blocks={blocks}
        ariaLabel="Standard NHK article"
        showFurigana
        onShowFuriganaChange={onShowFuriganaChange}
      />,
    );

    expect(screen.getByRole("button", { name: "Furigana" })).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelector("ruby")).toHaveTextContent("学校がっこう");

    fireEvent.click(screen.getByRole("button", { name: "Furigana" }));
    expect(onShowFuriganaChange).toHaveBeenCalledWith(false);
    rerender(
      <JapaneseReader
        text="学校へ行く。"
        blocks={blocks}
        ariaLabel="Standard NHK article"
        showFurigana={false}
        onShowFuriganaChange={onShowFuriganaChange}
      />,
    );
    expect(container.querySelector("ruby")).not.toBeInTheDocument();
  });

  it("keeps a source ruby range intact when JPDB splits its base into separate tokens", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tokens: [
          { start: 0, end: 2, surface: "東京", spelling: "東京", reading: "とうきょう", meaning: "Tokyo", meanings: ["Tokyo"], alternativeSpellings: [], partsOfSpeech: ["n"], tokenType: "vocabulary" },
          { start: 2, end: 3, surface: "都", spelling: "都", reading: "と", meaning: "metropolis", meanings: ["metropolis"], alternativeSpellings: [], partsOfSpeech: ["n"], tokenType: "vocabulary" },
        ],
      }),
    }));
    const blocks = [{ type: "text" as const, text: "東京都です。", furigana: [{ start: 0, end: 3, reading: "とうきょうと" }] }];
    const { container, rerender } = render(
      <JapaneseReader
        text="東京都です。"
        blocks={blocks}
        showFurigana
      />,
    );

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("JPDB parsing mapped against your WaniKani library"), { timeout: 5_000 });
    expect(container.querySelectorAll("ruby")).toHaveLength(1);
    expect(container.querySelector("ruby")).toHaveTextContent("東京都とうきょうと");

    rerender(<JapaneseReader text="東京都です。" blocks={blocks} showFurigana={false} />);
    expect(container.querySelector("ruby")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /東京, JPDB term, not matched in WaniKani/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /都, JPDB term, not matched in WaniKani/ })).toBeInTheDocument();
  });

  it("removes furigana from compact results while keeping reading in clicked details", () => {
    const { container } = render(<JapaneseReader text="学校" appearance="compact" supplement={<p>School translation</p>} />);

    expect(container.querySelector('[data-appearance="compact"]')).toBeInTheDocument();
    expect(screen.queryByLabelText("Annotation key")).not.toBeInTheDocument();
    expect(container.querySelector("ruby, rt")).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();

    const token = screen.getByRole("button", { name: /学校, Guru II WaniKani item/ });
    fireEvent.mouseEnter(token);
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    fireEvent.click(token);

    const inspector = screen.getByRole("complementary");
    expect(within(inspector).getByRole("button", { name: "Speak 学校" })).toBeInTheDocument();
    expect(within(inspector).getByText("がっこう")).toBeInTheDocument();
    expect(within(inspector).queryByText("Status")).not.toBeInTheDocument();
    expect(within(inspector).getByRole("img", { name: "Guru II" })).toBeInTheDocument();
    expect(screen.getByText("School translation").compareDocumentPosition(inspector) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("opens controlled EPUB details without rendering an underlined token surface", async () => {
    const onSelectionResolved = vi.fn();
    const { container } = render(<JapaneseReader
      text="学校へ行く。"
      appearance="compact"
      inspectorOnly
      selectionRequest={{ id: "epub-word-1", index: 0 }}
      onSelectionResolved={onSelectionResolved}
    />);

    const inspector = await screen.findByRole("complementary");
    expect(within(inspector).getByText("学校")).toBeInTheDocument();
    expect(within(inspector).getByText("がっこう")).toBeInTheDocument();
    expect(container.querySelector("article")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Inspect 学校/ })).not.toBeInTheDocument();
    expect(container.querySelector('[data-inspector-only="true"]')).toBeInTheDocument();
    await waitFor(() => expect(onSelectionResolved).toHaveBeenCalledWith({
      requestId: "epub-word-1",
      text: "学校",
      start: 0,
      end: 2,
    }));
  });

  it("waits for preprocessed EPUB analysis instead of flashing a fallback word", async () => {
    const text = "学校へ行く。";
    const onSelectionResolved = vi.fn();
    const { rerender } = render(<JapaneseReader
      text={text}
      appearance="compact"
      inspectorOnly
      selectionRequest={{ id: "epub-word-loading", index: 0 }}
      analysisContext={{
        text,
        start: 0,
        analysis: { status: "loading", sourceText: text, tokens: [], message: "Analyzing this book page…" },
      }}
      onSelectionResolved={onSelectionResolved}
    />);

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.queryByText("Preparing word details")).not.toBeInTheDocument();
    expect(screen.queryByText("学校", { exact: true })).not.toBeInTheDocument();
    expect(onSelectionResolved).not.toHaveBeenCalled();

    rerender(<JapaneseReader
      text={text}
      appearance="compact"
      inspectorOnly
      selectionRequest={{ id: "epub-word-loading", index: 0 }}
      analysisContext={{
        text,
        start: 0,
        analysis: {
          status: "ready",
          sourceText: text,
          tokens: [{ start: 0, end: 2, surface: "学校", spelling: "学校", reading: "がっこう", meaning: "school", meanings: ["school"], alternativeSpellings: [], partsOfSpeech: ["n"], tokenType: "vocabulary" }],
          message: "JPDB parsing mapped against your WaniKani library.",
        },
      }}
      onSelectionResolved={onSelectionResolved}
    />);

    const inspector = await screen.findByRole("complementary");
    expect(within(inspector).getByText("学校", { exact: true })).toBeInTheDocument();
    expect(onSelectionResolved).toHaveBeenCalledOnce();
  });

  it("uses a compact two-column summary and dismisses a floating inspector only on an outside interaction", () => {
    const { container } = render(<div><button type="button">Outside reader</button><JapaneseReader text="学校" appearance="compact" inspectorMode="floating" /></div>);

    fireEvent.click(screen.getByRole("button", { name: /学校, Guru II WaniKani item/ }));
    const inspector = screen.getByRole("complementary");
    const primaryFacts = inspector.querySelector("[data-reader-primary-facts]");
    expect(primaryFacts).not.toBeNull();
    expect(primaryFacts?.tagName).toBe("DL");
    expect(primaryFacts).toHaveAttribute("data-layout", "columns");
    expect(inspector.querySelectorAll("dl")).toHaveLength(2);
    expect(within(primaryFacts as HTMLElement).getByText("Reading")).toBeInTheDocument();
    expect(within(primaryFacts as HTMLElement).getByText("Meaning")).toBeInTheDocument();
    expect(inspector).toHaveAttribute("data-floating", "true");
    expect(container.querySelector('[role="complementary"]')).not.toBeInTheDocument();

    fireEvent.pointerDown(inspector);
    expect(screen.getByRole("complementary")).toBeInTheDocument();

    fireEvent.scroll(window);
    expect(screen.getByRole("complementary")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /学校, Guru II WaniKani item/ }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside reader" }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("gives a long meaning its own full-width row", async () => {
    const meaning = "indicates possessive · nominalizes verbs and adjectives · substitutes for ga in subordinate phrases · at sentence-end, falling tone indicates a confident conclusion";
    render(<JapaneseReader
      text="の"
      appearance="compact"
      inspectorMode="floating"
      analysisContext={{
        text: "の",
        start: 0,
        analysis: {
          status: "ready",
          sourceText: "の",
          tokens: [{
            start: 0,
            end: 1,
            surface: "の",
            spelling: "の",
            reading: "の",
            meaning,
            meanings: [meaning],
            alternativeSpellings: [],
            partsOfSpeech: ["prt"],
            tokenType: "grammar",
          }],
          message: "JPDB parsing mapped against your WaniKani library.",
        },
      }}
    />);

    fireEvent.click(await screen.findByRole("button", { name: /の, JPDB term/ }));

    const primaryFacts = screen.getByRole("complementary").querySelector("[data-reader-primary-facts]");
    expect(primaryFacts).toHaveAttribute("data-layout", "stacked");
    expect(primaryFacts).toHaveTextContent(meaning);
  });

  it("treats focus entering an embedded player as an outside interaction", async () => {
    const onSelectionChange = vi.fn();
    render(<div><iframe title="Embedded video player" /><JapaneseReader text="学校" appearance="compact" inspectorMode="floating" onSelectionChange={onSelectionChange} /></div>);
    fireEvent.click(screen.getByRole("button", { name: /学校, Guru II WaniKani item/ }));
    const player = screen.getByTitle("Embedded video player");

    player.focus();
    expect(document.activeElement).toBe(player);
    window.dispatchEvent(new Event("blur"));

    await waitFor(() => expect(screen.queryByRole("complementary")).not.toBeInTheDocument());
    expect(onSelectionChange).toHaveBeenLastCalledWith(false);
  });

  it("switches floating word details without briefly dismissing the reader", async () => {
    const onSelectionChange = vi.fn();
    render(<JapaneseReader text="学校と猫" appearance="compact" inspectorMode="floating" onSelectionChange={onSelectionChange} />);
    const cat = await screen.findByRole("button", { name: /猫, JPDB term, not matched in WaniKani/ });

    fireEvent.click(screen.getByRole("button", { name: /学校, Guru II WaniKani item/ }));
    onSelectionChange.mockClear();
    fireEvent.pointerDown(cat);
    fireEvent.click(cat);

    expect(onSelectionChange).toHaveBeenCalledWith(true);
    expect(onSelectionChange).not.toHaveBeenCalledWith(false);
    expect(within(screen.getByRole("complementary")).getByText("cat · domestic cat")).toBeInTheDocument();
  });

  it("remaps an open WaniKani fallback tooltip when deferred JPDB analysis replaces its token", async () => {
    let finishAnalysis: ((response: { ok: boolean; json: () => Promise<unknown> }) => void) | undefined;
    const fetchMock = vi.fn(() => new Promise<{ ok: boolean; json: () => Promise<unknown> }>((resolve) => { finishAnalysis = resolve; }));
    const onSelectionChange = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<JapaneseReader text="学校" appearance="compact" inspectorMode="floating" onSelectionChange={onSelectionChange} />);

    fireEvent.click(screen.getByRole("button", { name: /学校, Guru II WaniKani item/ }));
    expect(within(screen.getByRole("complementary")).getByText("School")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    finishAnalysis?.({
      ok: true,
      json: async () => ({
        tokens: [{ start: 0, end: 2, surface: "学校", spelling: "学校", reading: "がっこう", meaning: "school", meanings: ["school", "academy"], alternativeSpellings: ["學校"], partsOfSpeech: ["n"], tokenType: "vocabulary" }],
      }),
    });

    await waitFor(() => expect(within(screen.getByRole("complementary")).getByText("school · academy")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /学校, Guru II WaniKani item/ })).toHaveAttribute("data-selected", "true");
    expect(onSelectionChange).not.toHaveBeenCalledWith(false);
  });

  it("closes an open JPDB-only tooltip if recognition falls back to non-interactive text", async () => {
    stubCatAnalysis();
    const onSelectionChange = vi.fn();
    const { rerender } = render(<JapaneseReader text="猫" appearance="compact" inspectorMode="floating" onSelectionChange={onSelectionChange} />);
    fireEvent.click(await screen.findByRole("button", { name: /猫, JPDB term, not matched in WaniKani/ }));
    expect(screen.getByRole("complementary")).toBeInTheDocument();

    fixtures.reader.recognitionMode = "wk";
    rerender(<JapaneseReader text="猫" appearance="compact" inspectorMode="floating" onSelectionChange={onSelectionChange} />);

    await waitFor(() => expect(screen.queryByRole("complementary")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /猫/ })).not.toBeInTheDocument();
    expect(onSelectionChange).toHaveBeenLastCalledWith(false);
  });

  it("plays WaniKani pronunciation audio for JPDB tokens mapped to WaniKani vocabulary", async () => {
    const audioPlay = vi.fn().mockResolvedValue(undefined);
    const audioConstructor = vi.fn().mockImplementation(function AudioMock() { return { play: audioPlay, pause: vi.fn() }; });
    vi.stubGlobal("Audio", audioConstructor);
    render(<JapaneseReader text="学校" />);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("JPDB parsing mapped"));
    fireEvent.click(screen.getByRole("button", { name: /学校, Guru II WaniKani item/ }));
    fireEvent.click(screen.getByRole("button", { name: "Speak 学校" }));

    expect(audioConstructor).toHaveBeenCalledWith("https://example.com/gakkou.mp3");
    expect(audioPlay).toHaveBeenCalledOnce();
    expect(fixtures.voice.play).not.toHaveBeenCalled();
  });

  it("shows loading, playing, and stop states for WaniKani pronunciation audio", async () => {
    let finishPlaybackStart: (() => void) | undefined;
    const pause = vi.fn();
    const audio = {
      play: vi.fn(() => new Promise<void>((resolve) => { finishPlaybackStart = resolve; })),
      pause,
      onended: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onpause: null as (() => void) | null,
    };
    const audioConstructor = vi.fn().mockImplementation(function AudioMock() { return audio; });
    vi.stubGlobal("Audio", audioConstructor);
    render(<JapaneseReader text="学校" />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("JPDB parsing mapped"));
    fireEvent.click(screen.getByRole("button", { name: /学校, Guru II WaniKani item/ }));

    fireEvent.click(screen.getByRole("button", { name: "Speak 学校" }));
    expect(screen.getByRole("button", { name: "Cancel speaking 学校" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Cancel speaking 学校" })).toHaveAttribute("data-state", "loading");
    expect(screen.getByRole("button", { name: "Cancel speaking 学校" })).toHaveAttribute("title", "Cancel speaking 学校");

    finishPlaybackStart?.();
    await waitFor(() => expect(screen.getByRole("button", { name: "Stop speaking 学校" })).toHaveAttribute("data-state", "playing"));
    expect(screen.getByRole("button", { name: "Stop speaking 学校" })).toHaveAttribute("title", "Stop speaking 学校");
    fireEvent.click(screen.getByRole("button", { name: "Stop speaking 学校" }));
    expect(pause).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Speak 学校" })).toHaveAttribute("data-state", "idle");
    expect(screen.getByRole("button", { name: "Speak 学校" })).toHaveAttribute("title", "Play WaniKani pronunciation");
  });

  it("stops WaniKani pronunciation when shared Japanese TTS starts", async () => {
    const pause = vi.fn();
    const audioConstructor = vi.fn().mockImplementation(function AudioMock() {
      const audio = { play: vi.fn().mockResolvedValue(undefined), pause, onended: null, onerror: null, onpause: null as (() => void) | null };
      pause.mockImplementation(() => queueMicrotask(() => audio.onpause?.()));
      return audio;
    });
    vi.stubGlobal("Audio", audioConstructor);
    const view = render(<JapaneseReader text="学校" />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("JPDB parsing mapped"));
    fireEvent.click(screen.getByRole("button", { name: /学校, Guru II WaniKani item/ }));
    fireEvent.click(screen.getByRole("button", { name: "Speak 学校" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Stop speaking 学校" })).toBeInTheDocument());

    Object.assign(fixtures.voice, { activity: "synthesizing", activeSentence: "猫です" });
    view.rerender(<JapaneseReader text="学校" />);

    await waitFor(() => expect(pause).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "Speak 学校" })).toHaveAttribute("data-state", "idle");
  });

  it("does not replace shared Japanese TTS when it interrupts WaniKani audio startup", async () => {
    fixtures.voice.downloaded = true;
    let rejectPlay: ((reason?: unknown) => void) | undefined;
    const playPromise = new Promise<void>((_resolve, reject) => { rejectPlay = reject; });
    const pause = vi.fn(() => rejectPlay?.(new DOMException("Playback interrupted.", "AbortError")));
    const audioConstructor = vi.fn().mockImplementation(function AudioMock() {
      return { play: vi.fn(() => playPromise), pause, onended: null, onerror: null, onpause: null };
    });
    vi.stubGlobal("Audio", audioConstructor);
    const view = render(<JapaneseReader text="学校" />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("JPDB parsing mapped"));
    fireEvent.click(screen.getByRole("button", { name: /学校, Guru II WaniKani item/ }));
    fireEvent.click(screen.getByRole("button", { name: "Speak 学校" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel speaking 学校" })).toHaveAttribute("data-state", "loading"));

    Object.assign(fixtures.voice, { activity: "synthesizing", activeSentence: "猫です" });
    view.rerender(<JapaneseReader text="学校" />);

    await waitFor(() => expect(pause).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole("button", { name: "Speak 学校" })).toHaveAttribute("data-state", "idle"));
    expect(fixtures.voice.play).not.toHaveBeenCalled();
  });

  it("shows and stops downloaded TTS after WaniKani audio fails", async () => {
    fixtures.voice.downloaded = true;
    const audioConstructor = vi.fn().mockImplementation(function AudioMock() {
      return { play: vi.fn().mockRejectedValue(new Error("audio failed")), pause: vi.fn(), onended: null, onerror: null, onpause: null };
    });
    vi.stubGlobal("Audio", audioConstructor);
    const { rerender } = render(<JapaneseReader text="学校" />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("JPDB parsing mapped"));
    fireEvent.click(screen.getByRole("button", { name: /学校, Guru II WaniKani item/ }));
    fireEvent.click(screen.getByRole("button", { name: "Speak 学校" }));
    await waitFor(() => expect(fixtures.voice.play).toHaveBeenCalledWith("学校"));

    Object.assign(fixtures.voice, { activity: "playing", activeSentence: "学校" });
    rerender(<JapaneseReader text="学校" />);
    const stop = screen.getByRole("button", { name: "Stop speaking 学校" });
    expect(stop).toHaveAttribute("data-audio-source", "tts");
    expect(stop).toHaveAttribute("title", "Stop speaking 学校");

    fixtures.voice.stop.mockClear();
    audioConstructor.mockClear();
    fireEvent.click(stop);
    expect(fixtures.voice.stop).toHaveBeenCalledOnce();
    expect(audioConstructor).not.toHaveBeenCalled();
  });

  it("uses the downloaded Japanese voice for JPDB-only terms", async () => {
    fixtures.voice.downloaded = true;
    stubCatAnalysis();
    render(<JapaneseReader text="猫" />);
    const token = await screen.findByRole("button", { name: /猫, JPDB term, not matched in WaniKani/ });

    fireEvent.click(token);
    fireEvent.click(screen.getByRole("button", { name: "Speak 猫" }));

    expect(fixtures.voice.play).toHaveBeenCalledWith("猫");
  });

  it("distinguishes speech synthesis loading from active playback", async () => {
    fixtures.voice.downloaded = true;
    stubCatAnalysis();
    const { rerender } = render(<JapaneseReader text="猫" appearance="compact" />);
    fireEvent.click(await screen.findByRole("button", { name: /猫, JPDB term, not matched in WaniKani/ }));

    Object.assign(fixtures.voice, { activity: "synthesizing", activeSentence: "猫" });
    rerender(<JapaneseReader text="猫" appearance="compact" />);
    expect(screen.getByRole("button", { name: "Cancel speaking 猫" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Cancel speaking 猫" })).toHaveAttribute("data-state", "synthesizing");

    Object.assign(fixtures.voice, { activity: "playing", activeSentence: "猫" });
    rerender(<JapaneseReader text="猫" appearance="compact" />);
    expect(screen.getByRole("button", { name: "Stop speaking 猫" })).toHaveAttribute("data-state", "playing");
  });

  it("keeps missing TTS setup in the side rail instead of navigating away", async () => {
    stubCatAnalysis();
    render(<JapaneseReader text="猫" />);
    fireEvent.click(await screen.findByRole("button", { name: /猫, JPDB term, not matched in WaniKani/ }));

    const inspector = screen.getByRole("complementary");
    expect(within(inspector).queryByRole("link", { name: /Japanese voice/ })).not.toBeInTheDocument();

    fireEvent.click(within(inspector).getByRole("button", { name: "Download Japanese voice for 猫" }));

    const prompt = within(inspector).getByRole("group", { name: "Download Japanese voice?" });
    expect(within(prompt).getByText(/Download Supertonic 3 · F3.*about 400 MB/)).toBeInTheDocument();
    fireEvent.click(within(prompt).getByRole("button", { name: "Download voice · about 400 MB" }));
    expect(fixtures.voice.download).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Speak 猫" })).not.toBeInTheDocument();
  });

  it("shows Jiten frequency beside JPDB and looks up an inflected verb by its dictionary form", async () => {
    fixtures.study.showVocabularyFrequency = true;
    const frequencyRequests: Array<{ expression: string; readings: string[] }> = [];
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url === "/news/analyze") {
        return new Response(JSON.stringify({
          tokens: [{
            start: 0,
            end: 5,
            surface: "触れさせて",
            spelling: "触れる",
            reading: "ふれる",
            surfaceReading: "ふれさせて",
            meaning: "to make touch",
            meanings: ["to make touch"],
            alternativeSpellings: [],
            partsOfSpeech: ["v1", "vt"],
            tokenType: "verb",
          }],
        }), { status: 200 });
      }
      if (url === "/api/study/vocabulary-frequency") {
        const request = JSON.parse(String(init?.body)) as { expression: string; readings: string[] };
        frequencyRequests.push(request);
        return new Response(JSON.stringify({ result: {
          provider: "jiten",
          frequencyRank: 1_500,
          wordId: 25,
          readingIndex: 0,
          matchedText: "触れる",
          matchedReading: "ふれる",
          sourceUrl: "https://jiten.moe/search?query=%E8%A7%A6%E3%82%8C%E3%82%8B",
        } }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: `Unexpected request: ${url}` }), { status: 500 });
    }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(<QueryClientProvider client={client}><JapaneseReader text="触れさせて" /></QueryClientProvider>);

    fireEvent.click(await screen.findByRole("button", { name: /触れさせて, JPDB term/ }));
    const inspector = screen.getByRole("complementary");
    const provider = within(inspector).getByText("JPDB", { exact: true });
    const frequency = await within(inspector).findByLabelText("Vocabulary frequency #1,500");

    expect(frequency).toHaveTextContent("#1,500");
    expect(provider.parentElement?.parentElement).toContainElement(frequency);
    expect(frequency.closest("[title]")).toHaveAttribute("title", "Jiten frequency rank; lower is more common");
    expect(frequencyRequests).toEqual([{ expression: "触れる", readings: ["ふれる"] }]);
  });

  it("keeps JPDB word frequency when the closest WaniKani match is a kanji subject", async () => {
    fixtures.study.showVocabularyFrequency = true;
    fixtures.dataset.subjects = [{
      id: 11,
      object: "kanji",
      url: "",
      data_updated_at: "",
      data: {
        level: 5,
        created_at: "",
        slug: "川",
        document_url: "",
        hidden_at: null,
        characters: "川",
        meanings: [{ meaning: "River", primary: true, accepted_answer: true }],
        auxiliary_meanings: [],
        readings: [{ reading: "かわ", primary: true, accepted_answer: true, type: "kunyomi" }],
      },
    }];
    fixtures.dataset.assignments = [];
    const frequencyRequests: Array<{ expression: string; readings: string[] }> = [];
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url === "/news/analyze") {
        return new Response(JSON.stringify({ tokens: [{
          start: 0,
          end: 1,
          surface: "川",
          spelling: "川",
          reading: "かわ",
          meaning: "river",
          meanings: ["river"],
          alternativeSpellings: [],
          partsOfSpeech: ["n"],
          tokenType: "vocabulary",
        }] }), { status: 200 });
      }
      const request = JSON.parse(String(init?.body)) as { expression: string; readings: string[] };
      frequencyRequests.push(request);
      return new Response(JSON.stringify({ result: {
        provider: "jiten",
        frequencyRank: 777,
        wordId: 26,
        readingIndex: 0,
        matchedText: "川",
        matchedReading: "かわ",
        sourceUrl: "https://jiten.moe/search?query=%E5%B7%9D",
      } }), { status: 200 });
    }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(<QueryClientProvider client={client}><JapaneseReader text="川" /></QueryClientProvider>);

    fireEvent.click(await screen.findByRole("button", { name: /川, Locked WaniKani item/ }));

    expect(await screen.findByLabelText("Vocabulary frequency #777")).toHaveTextContent("#777");
    expect(frequencyRequests).toEqual([{ expression: "川", readings: ["かわ"] }]);
  });

  it("does not show or request word frequency for grammar tokens", async () => {
    fixtures.study.showVocabularyFrequency = true;
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url === "/news/analyze") {
        return new Response(JSON.stringify({ tokens: [{
          start: 0,
          end: 1,
          surface: "は",
          spelling: "は",
          reading: "は",
          meaning: "topic marker",
          meanings: ["topic marker"],
          alternativeSpellings: [],
          partsOfSpeech: ["prt"],
          tokenType: "grammar",
        }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: `Unexpected request: ${url}` }), { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(<QueryClientProvider client={client}><JapaneseReader text="は" /></QueryClientProvider>);

    fireEvent.click(await screen.findByRole("button", { name: /は, JPDB term/ }));

    expect(within(screen.getByRole("complementary")).queryByLabelText(/Vocabulary frequency/)).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  });

  it("opens mapped and JPDB-only details on click without changing them on hover", async () => {
    render(<JapaneseReader text="学校と猫" />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("JPDB parsing mapped against your WaniKani library"), { timeout: 5_000 });

    const mapped = screen.getByRole("button", { name: /学校, Guru II WaniKani item/ });
    fireEvent.mouseEnter(mapped);
    const inspector = screen.getByRole("complementary");
    expect(within(inspector).getByText("Word details")).toBeInTheDocument();
    expect(within(inspector).queryByText("academy")).not.toBeInTheDocument();
    fireEvent.click(mapped);
    expect(within(inspector).getByRole("img", { name: "Guru II" })).toBeInTheDocument();
    expect(within(inspector).queryByText("JPDB + WaniKani · Guru II")).not.toBeInTheDocument();
    expect(within(inspector).getByText("school · academy")).toBeInTheDocument();
    expect(within(inspector).getByText("學校")).toBeInTheDocument();

    const jpdbOnly = screen.getByRole("button", { name: /猫, JPDB term, not matched in WaniKani/ });
    fireEvent.mouseEnter(jpdbOnly);
    expect(within(inspector).queryByText("domestic cat")).not.toBeInTheDocument();
    fireEvent.click(jpdbOnly);
    expect(within(inspector).queryByText("Status")).not.toBeInTheDocument();
    expect(within(inspector).getByText("cat · domestic cat")).toBeInTheDocument();
    expect(within(inspector).getByText("ネコ")).toBeInTheDocument();
  });

  it("supports hover details when the shared preference enables them", async () => {
    fixtures.reader.detailsInteraction = "hover";
    render(<JapaneseReader text="学校と猫" />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("JPDB parsing mapped against your WaniKani library"), { timeout: 5_000 });

    const jpdbOnly = screen.getByRole("button", { name: /猫, JPDB term, not matched in WaniKani/ });
    fireEvent.mouseEnter(jpdbOnly);
    expect(within(screen.getByRole("complementary")).getByText("cat · domestic cat")).toBeInTheDocument();
  });

  it("keeps the lyrics return route in the explicit details action", async () => {
    render(<JapaneseReader text="学校" subjectReturnTo="/music?song=saved-song" />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("JPDB parsing mapped against your WaniKani library"), { timeout: 5_000 });

    expect(screen.queryByRole("link", { name: /学校, Guru II WaniKani item/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /学校, Guru II WaniKani item/ }));
    expect(screen.getByRole("link", { name: /View details/ })).toHaveAttribute(
      "href",
      "/subjects/10?returnTo=%2Fmusic%3Fsong%3Dsaved-song",
    );
  });

  it("uses WK-only recognition without sending text to JPDB", async () => {
    fixtures.reader.recognitionMode = "wk";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<JapaneseReader text="学校と猫" />);

    expect(screen.getByRole("status")).toHaveTextContent("WaniKani-only recognition is active");
    expect(screen.getByRole("button", { name: /学校, Guru II WaniKani item/ })).toHaveAttribute("data-token-kind", "vocabulary");
    expect(screen.queryByRole("button", { name: /猫/ })).not.toBeInTheDocument();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("classifies JPDB underlines with the mobile grammar, verb, and vocabulary roles", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tokens: [
          { start: 0, end: 1, surface: "猫", spelling: "猫", reading: "ねこ", meaning: "cat", meanings: ["cat"], alternativeSpellings: [], partsOfSpeech: ["n"], tokenType: "vocabulary" },
          { start: 1, end: 2, surface: "が", spelling: "が", reading: "が", meaning: "subject marker", meanings: ["subject marker"], alternativeSpellings: [], partsOfSpeech: ["prt"], tokenType: "grammar" },
          { start: 2, end: 5, surface: "増える", spelling: "増える", reading: "ふえる", meaning: "increase", meanings: ["increase"], alternativeSpellings: [], partsOfSpeech: ["v1", "vi"], tokenType: "verb" },
        ],
      }),
    }));

    render(<JapaneseReader text="猫が増える" />);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("JPDB parsing mapped against your WaniKani library"), { timeout: 5_000 });
    expect(screen.getByRole("button", { name: /猫, JPDB term/ })).toHaveAttribute("data-token-kind", "vocabulary");
    expect(screen.getByRole("button", { name: /が, JPDB term/ })).toHaveAttribute("data-token-kind", "grammar");
    expect(screen.getByRole("button", { name: /増える, JPDB term/ })).toHaveAttribute("data-token-kind", "verb");
  });

  it("shows the selected inflected form's reading instead of the dictionary-form reading", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tokens: [
          { start: 0, end: 5, surface: "触れさせて", spelling: "触れる", reading: "ふれる", surfaceReading: "ふれさせて", meaning: "touch", meanings: ["touch"], alternativeSpellings: [], partsOfSpeech: ["v1", "vt"], tokenType: "verb" },
        ],
      }),
    }));

    render(<JapaneseReader text="触れさせて" />);
    const token = await screen.findByRole("button", { name: /触れさせて, JPDB term/ });
    fireEvent.click(token);

    const inspector = screen.getByRole("complementary");
    expect(within(inspector).getByText("ふれさせて")).toBeInTheDocument();
    expect(within(inspector).queryByText("ふれる")).not.toBeInTheDocument();
  });

  it("reuses one transcript-level JPDB parse while the displayed subtitle changes", async () => {
    let finishRequest: (() => void) | undefined;
    const requestGate = new Promise<void>((resolve) => { finishRequest = resolve; });
    const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
      void args;
      await requestGate;
      return {
        ok: true,
        json: async () => ({
          tokens: [
            { start: 0, end: 2, surface: "学校", spelling: "学校", reading: "がっこう", meaning: "school", meanings: ["school"], alternativeSpellings: [], partsOfSpeech: ["n"], tokenType: "vocabulary" },
            { start: 3, end: 4, surface: "猫", spelling: "猫", reading: "ねこ", meaning: "cat", meanings: ["cat"], alternativeSpellings: [], partsOfSpeech: ["n"], tokenType: "vocabulary" },
          ],
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    const analysisContext = { text: "学校と猫", start: 0 };
    const { rerender } = render(<JapaneseReader text="学校" analysisContext={analysisContext} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ text: "学校と猫", apiKey: "configured-test-key" });

    rerender(<JapaneseReader text="猫" analysisContext={{ text: "学校と猫", start: 3 }} />);
    expect((fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal).aborted).toBe(false);
    finishRequest?.();

    expect(await screen.findByRole("button", { name: /猫, JPDB term, not matched in WaniKani/ })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("analyzes coordinated lyric lines once and lets an inactive line open word details", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tokens: [
          { start: 0, end: 2, surface: "学校", spelling: "学校", reading: "がっこう", meaning: "school", meanings: ["school"], alternativeSpellings: [], partsOfSpeech: ["n"], tokenType: "vocabulary" },
          { start: 4, end: 5, surface: "猫", spelling: "猫", reading: "ねこ", meaning: "cat", meanings: ["cat"], alternativeSpellings: [], partsOfSpeech: ["n"], tokenType: "vocabulary" },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const sources = [{ id: "current", text: "学校" }, { id: "inactive", text: "猫" }];

    function CoordinatedLyrics() {
      const contexts = useJapaneseReaderAnalysisContexts(sources, {
        apiKey: "configured-test-key",
        enabled: true,
      });
      return <div>{sources.map((source, index) => <JapaneseReader
        key={source.id}
        text={source.text}
        analysisContext={contexts.get(source.id)}
        ariaLabel={`Lyric line ${index + 1}`}
        appearance="compact"
        inspectorMode="floating"
      />)}</div>;
    }

    render(<CoordinatedLyrics />);

    const cat = await screen.findByRole("button", { name: /猫, JPDB term, not matched in WaniKani/ });
    expect(cat.closest("article")).toHaveAttribute("aria-label", "Lyric line 2");
    fireEvent.click(cat);
    expect(within(screen.getByRole("complementary")).getByText("cat")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      text: "学校\n\n猫",
      apiKey: "configured-test-key",
    });
  });

  it("reuses a bounded preprocessing result when returning to an earlier EPUB section", async () => {
    const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
      const body = JSON.parse(String(args[1]?.body)) as { text: string };
      return {
        ok: true,
        json: async () => ({
          tokens: body.text === "学校"
            ? [{ start: 0, end: 2, surface: "学校", spelling: "学校", reading: "がっこう", meaning: "school", meanings: ["school"], alternativeSpellings: [], partsOfSpeech: ["n"], tokenType: "vocabulary" }]
            : [{ start: 0, end: 1, surface: "猫", spelling: "猫", reading: "ねこ", meaning: "cat", meanings: ["cat"], alternativeSpellings: [], partsOfSpeech: ["n"], tokenType: "vocabulary" }],
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    function SectionPreprocessor({ id, text }: { id: string; text: string }) {
      const sources = useMemo(() => [{ id, text }], [id, text]);
      const contexts = useJapaneseReaderAnalysisContexts(sources, {
        apiKey: "configured-test-key",
        enabled: true,
      });
      return <span role="status">{contexts.get(id)?.analysis?.status}</span>;
    }

    const { rerender } = render(<SectionPreprocessor id="section-a" text="学校" />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("ready"));
    rerender(<SectionPreprocessor id="section-b" text="猫" />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("ready"));
    rerender(<SectionPreprocessor id="section-a-return" text="学校" />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("ready"));

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps article images between their text blocks while analyzing the document once", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tokens: [
          { start: 0, end: 2, surface: "学校", spelling: "学校", reading: "がっこう", meaning: "school", meanings: ["school"], alternativeSpellings: [], partsOfSpeech: ["n"], tokenType: "vocabulary" },
          { start: 4, end: 5, surface: "猫", spelling: "猫", reading: "ねこ", meaning: "cat", meanings: ["cat"], alternativeSpellings: [], partsOfSpeech: ["n"], tokenType: "vocabulary" },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(
      <JapaneseReader
        text={"学校\n\n猫"}
        blocks={[
          { type: "text", text: "学校" },
          { type: "image", url: "https://img.web.nhk/news/example.jpg", alt: "現場" },
          { type: "text", text: "猫" },
        ]}
      />,
    );

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("JPDB parsing mapped against your WaniKani library"), { timeout: 5_000 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ text: "学校\n\n猫", apiKey: "configured-test-key" });
    expect([...container.querySelectorAll("[data-reader-block]")].map((node) => node.getAttribute("data-reader-block"))).toEqual(["text", "image", "text"]);
    expect(screen.getByRole("img", { name: "現場" })).toBeInTheDocument();
  });
});
