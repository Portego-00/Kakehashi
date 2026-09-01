import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCustomSrsState, enrollCustomVocabularyPack } from "./model";
import type { CustomSrsState, CustomVocabularyPack } from "./types";
import { CustomVocabularyHub } from "./CustomVocabularyHub";
import { CUSTOM_VOCABULARY_PACKS } from "./catalog";

const { hubTestState } = vi.hoisted(() => ({
  hubTestState: {
    hook: {} as Record<string, unknown>,
    enrollPack: vi.fn(),
    refresh: vi.fn(),
  },
}));

vi.mock("@/lib/session", () => ({ useSession: () => ({ user: { id: 42 } }) }));

vi.mock("./catalog", () => {
  const word = (id: string, characters: string, meaning: string) => ({
    id,
    characters,
    reading: characters,
    meanings: [meaning],
    partsOfSpeech: ["noun"],
    meaningMnemonic: `${characters} means ${meaning}.`,
    readingMnemonic: "The word is already written in kana.",
    contextSentences: [{ ja: `${characters}。`, en: meaning }],
  });
  return {
    CUSTOM_VOCABULARY_PACKS: [
      { id: "daily-hiragana", title: "Everyday Hiragana", description: "Useful daily words.", script: "hiragana", words: [word("daily-hiragana:もしもし", "もしもし", "Hello on the phone")] },
      { id: "daily-katakana", title: "Everyday Katakana", description: "Useful loanwords.", script: "katakana", words: [word("daily-katakana:メモ", "メモ", "Note")] },
      { id: "mixed-kana", title: "Mixed Kana", description: "A mixed-script pack.", script: "mixed", words: [
        word("mixed-kana:よろしく", "よろしく", "Best regards"),
        word("mixed-kana:メール", "メール", "Email"),
        word("food-gochisousama", "ごちそうさま", "Thank You For The Meal, That Was Delicious"),
        word("mixed-kana:カメラ", "カメラ", "Camera"),
        word("mixed-kana:アプリ", "アプリ", "App"),
      ] },
      { id: "levels-1-10", title: "WaniKani Levels 1–10", description: "Common words using early kanji.", script: "kanji", levelRange: { min: 1, max: 10 }, words: [{
        ...word("levels-1-10:足音", "足音", "Footsteps"),
        reading: "あしおと",
        requiredLevel: 8,
        kanjiLevels: { "足": 4, "音": 8 },
      }] },
    ] satisfies CustomVocabularyPack[],
  };
});

vi.mock("./use-custom-srs", () => ({
  useCustomSrs: () => ({ ...hubTestState.hook, enrollPack: hubTestState.enrollPack }),
}));

function setHookState(state: CustomSrsState, overrides: Record<string, unknown> = {}) {
  hubTestState.hook = {
    state,
    isLoading: false,
    isRefreshing: false,
    isUnavailable: false,
    isSaving: false,
    error: "",
    storageMode: "browser",
    refresh: hubTestState.refresh,
    ...overrides,
  };
}

beforeEach(() => {
  hubTestState.enrollPack.mockReset();
  hubTestState.enrollPack.mockResolvedValue(undefined);
  hubTestState.refresh.mockReset();
  hubTestState.refresh.mockResolvedValue({});
  setHookState(createCustomSrsState(new Date("2026-08-31T09:00:00Z")));
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-31T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("custom vocabulary pack hub", () => {
  it("groups kana and level-based kanji pack previews with persistence, queue counts, and runnable routes", () => {
    const pack = CUSTOM_VOCABULARY_PACKS[0];
    const enrolled = enrollCustomVocabularyPack(createCustomSrsState(new Date("2026-08-31T09:00:00Z")), pack, new Date("2026-08-31T09:00:00Z"));
    const wordId = pack.words[0].id;
    enrolled.assignments[wordId] = { ...enrolled.assignments[wordId], stage: 1, availableAt: "2026-08-31T10:00:00Z" };
    setHookState(enrolled, { storageMode: "cloud" });

    const { container } = render(<CustomVocabularyHub />);

    expect(screen.getByRole("heading", { name: "Custom vocabulary" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vocabulary packs" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Kana & everyday language" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Kanji by WaniKani level" })).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(4);
    expect(screen.getByText("もしもし")).toBeInTheDocument();
    expect(screen.getByText("メモ")).toBeInTheDocument();
    expect(screen.getByText("よろしく")).toBeInTheDocument();
    expect(screen.getByText("足音")).toBeInTheDocument();
    expect(screen.getByText("Kanji · WaniKani levels 1–10 · 1 word")).toBeInTheDocument();
    expect(screen.getByText("もしもし").closest("a")).toHaveAttribute("href", `/custom-vocabulary/words/${encodeURIComponent(wordId)}`);
    expect(screen.getByText("メモ").closest("a")).toHaveAttribute("href", `/custom-vocabulary/words/${encodeURIComponent(CUSTOM_VOCABULARY_PACKS[1].words[0].id)}`);
    const longMeaning = screen.getByText("Thank You For The Meal, That Was Delicious");
    const longMeaningLink = longMeaning.closest("a");
    expect(longMeaningLink).toHaveAttribute("href", "/custom-vocabulary/words/food-gochisousama");
    expect(longMeaning.parentElement).toBe(longMeaningLink);
    expect(screen.getByText("ごちそうさま").parentElement).toBe(longMeaningLink);
    expect(screen.getByText("Show 1 more words")).toBeInTheDocument();
    expect(screen.getByText("Cloud progress", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText(/adaptive FSRS/i)).toBeInTheDocument();
    expect(screen.getByText(/does not reproduce WaniKani’s exact schedule/i)).toBeInTheDocument();
    expect(screen.getByText("How custom SRS timing works")).toBeInTheDocument();
    expect(container.querySelectorAll('[data-subject-type="vocabulary"]')).not.toHaveLength(0);
    expect(screen.getByRole("link", { name: "JMdict/EDICT project" })).toHaveAttribute("href", "https://www.edrdg.org/jmdict/j_jmdict.html");

    const firstPack = screen.getAllByRole("article")[0];
    const secondPack = screen.getAllByRole("article")[1];
    expect(within(firstPack).getByText("due now").parentElement).toHaveTextContent("1 due now");
    expect(within(firstPack).getByText("Apprentice I")).toBeInTheDocument();
    expect(within(secondPack).queryByRole("progressbar")).not.toBeInTheDocument();
    expect(within(secondPack).queryByLabelText("Everyday Katakana SRS stages")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Start lessons/i })).toHaveAttribute("href", "/custom-vocabulary/lessons");
    expect(screen.getByRole("link", { name: /Review due/i })).toHaveAttribute("href", "/custom-vocabulary/reviews");
    expect(screen.getByRole("link", { name: /Review due/i })).not.toHaveAttribute("aria-disabled", "true");
  });

  it("awaits pack enrollment and prevents a second add while it is pending", async () => {
    let resolveEnrollment: (() => void) | undefined;
    hubTestState.enrollPack.mockReturnValue(new Promise<void>((resolve) => { resolveEnrollment = resolve; }));
    render(<CustomVocabularyHub />);

    const addButton = screen.getByRole("button", { name: "Add Everyday Hiragana pack" });
    fireEvent.click(addButton);

    expect(hubTestState.enrollPack).toHaveBeenCalledWith(CUSTOM_VOCABULARY_PACKS[0]);
    expect(addButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add Everyday Katakana pack" })).toBeDisabled();

    await act(async () => { resolveEnrollment?.(); });
    expect(screen.getByRole("button", { name: "Add Everyday Hiragana pack" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("Everyday Hiragana added. 1 custom lesson is ready.");
    expect(screen.getByRole("heading", { name: "Everyday Hiragana" })).toHaveFocus();
  });

  it("keeps the pack preview visible while cloud progress reports an error", () => {
    setHookState(createCustomSrsState(), { error: "Cloud progress is unavailable." });
    render(<CustomVocabularyHub />);

    expect(screen.getByRole("alert")).toHaveTextContent("Cloud progress is unavailable.");
    expect(screen.getAllByRole("article")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Add Everyday Hiragana pack" })).toBeEnabled();
  });

  it("does not mislabel or mutate local progress after an initial cloud load failure", () => {
    setHookState(createCustomSrsState(), { error: "Cloud progress is unavailable.", storageMode: "cloud", isUnavailable: true });
    render(<CustomVocabularyHub />);

    expect(screen.getByText("Cloud progress", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Everyday Hiragana pack" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(hubTestState.refresh).toHaveBeenCalledOnce();
    expect(hubTestState.enrollPack).not.toHaveBeenCalled();
  });
});
