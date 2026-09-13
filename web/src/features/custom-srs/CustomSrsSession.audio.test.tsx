import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_WEB_SETTINGS, settingsStorageKey } from "@/features/settings/settings";
import { CUSTOM_VOCABULARY_PACKS } from "./catalog";
import { createCustomSrsState, enrollCustomVocabularyPack } from "./model";
import publication from "./audio-publication.generated.json";
import type { CustomSrsState, CustomVocabularyPack } from "./types";
import { CustomSrsSession } from "./CustomSrsSession";

const hook = vi.hoisted(() => ({ state: null as CustomSrsState | null }));
vi.mock("@/lib/session", () => ({
  useSession: () => ({ user: { id: 42, data: { username: "published-audio-test" } } }),
}));
vi.mock("./use-custom-srs", () => ({
  useCustomSrs: () => ({
    state: hook.state,
    storageMode: "browser",
    isLoading: false,
    isSaving: false,
    pendingCount: 0,
    syncError: "",
    error: "",
    retrySync: vi.fn(),
    refresh: vi.fn(),
    completeLesson: vi.fn(),
    submitReview: vi.fn(),
  }),
}));
vi.mock("@/features/study/immersion", () => ({ fetchImmersionExamples: async () => [] }));

// Use the shipped catalog and publication lookup, not fabricated audio metadata.
const catalogPack = CUSTOM_VOCABULARY_PACKS.find((pack) => pack.id === "conversation-glue")!;
const word = catalogPack.words.find((entry) => entry.id === "conversation-douzo")!;
const pack = { ...catalogPack, words: [word] };
const publishedUrl = `https://zcvoxqcvobgvcwcrqytz.supabase.co/storage/v1/object/public/custom-vocabulary-audio/${publication.entries["conversation-douzo"].objectPath}`;

function renderSession(mode: "lessons" | "reviews", autoplayAudio = true, selectedPack: CustomVocabularyPack = pack) {
  const state = enrollCustomVocabularyPack(createCustomSrsState(), selectedPack);
  if (mode === "reviews") {
    for (const assignment of Object.values(state.assignments)) {
      assignment.stage = 1;
      assignment.startedAt = "2020-01-01T00:00:00.000Z";
      assignment.availableAt = "2020-01-01T00:00:00.000Z";
    }
  }
  hook.state = state;
  window.localStorage.setItem(settingsStorageKey("published-audio-test"), JSON.stringify({
    ...DEFAULT_WEB_SETTINGS,
    study: { ...DEFAULT_WEB_SETTINGS.study, autoplayAudio, showAnswerStopSubjectDetails: false },
  }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><CustomSrsSession mode={mode} packs={[selectedPack]} /></QueryClientProvider>);
}

describe("published custom audio in real lesson and review screens", () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  });

  beforeEach(() => {
    window.localStorage.clear();
    vi.stubEnv("NEXT_PUBLIC_CUSTOM_VOCABULARY_AUDIO_SUPABASE_URL", undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("autoplays the released recording during teaching without build-time configuration", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const { container } = renderSession("lessons");
    await waitFor(() => expect(play).toHaveBeenCalledOnce());
    expect(container.querySelector("audio")).toHaveAttribute("src", publishedUrl);
    expect(await screen.findByRole("button", { name: "Stop Shizuka pronunciation" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Reading" })).not.toBeInTheDocument();
  });

  it.each(["lessons", "reviews"] as const)("autoplays after correct and incorrect %s answers, but never before the answer", async (mode) => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const { container } = renderSession(mode);
    if (mode === "lessons") {
      await waitFor(() => expect(play).toHaveBeenCalledOnce());
      fireEvent.click(screen.getByRole("button", { name: "Start lesson quiz" }));
      play.mockClear();
    }
    expect(play).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Shizuka pronunciation/ })).not.toBeInTheDocument();

    for (const answer of ["wrong answer", "please"]) {
      fireEvent.change(screen.getByRole("textbox"), { target: { value: answer } });
      fireEvent.click(screen.getByRole("button", { name: "Check" }));
      await waitFor(() => expect(play).toHaveBeenCalledOnce());
      expect(container.querySelector("audio")).toHaveAttribute("src", publishedUrl);
      if (answer === "wrong answer") {
        fireEvent.click(screen.getByRole("button", { name: "Next" }));
        play.mockClear();
      }
    }
  });

  it.each(["lessons", "reviews"] as const)("offers manual playback without loading audio when %s autoplay is off", async (mode) => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const { container } = renderSession(mode, false);
    if (mode === "reviews") {
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "please" } });
      fireEvent.click(screen.getByRole("button", { name: "Check" }));
    }
    expect(play).not.toHaveBeenCalled();
    expect(container.querySelector("audio")).not.toHaveAttribute("src");
    fireEvent.click(screen.getByRole("button", { name: "Play Shizuka pronunciation" }));
    await waitFor(() => expect(play).toHaveBeenCalledOnce());
    expect(container.querySelector("audio")).toHaveAttribute("src", publishedUrl);
  });

  it.each(["lessons", "reviews"] as const)("does not invent audio controls for an unpublished word during %s", (mode) => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    renderSession(mode, true, { ...pack, words: [{ ...word, id: "unpublished-word" }] });
    if (mode === "reviews") {
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "please" } });
      fireEvent.click(screen.getByRole("button", { name: "Check" }));
    }
    expect(play).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Shizuka pronunciation/ })).not.toBeInTheDocument();
  });
});
