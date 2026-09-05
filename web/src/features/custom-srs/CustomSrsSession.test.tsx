import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_WEB_SETTINGS } from "@/features/settings/settings";
import { CUSTOM_SRS_POLICY } from "./scheduler";
import type { CustomSrsAssignment, CustomSrsState, CustomVocabularyPack, CustomVocabularyWord } from "./types";
import { createCustomQuestionQueue, CustomSrsSession } from "./CustomSrsSession";

const hook = vi.hoisted(() => ({
  state: null as CustomSrsState | null,
  error: "",
  isLoading: false,
  isSaving: false,
  completeLesson: vi.fn(),
  submitReview: vi.fn(),
  refresh: vi.fn(),
}));

const fetchImmersionExamplesMock = vi.hoisted(() => vi.fn());
const scrollIntoViewMock = vi.fn();

vi.mock("@/lib/session", () => ({
  useSession: () => ({ user: { id: 42, data: { username: "custom-study-test" } } }),
}));

vi.mock("./use-custom-srs", () => ({
  useCustomSrs: () => ({
    state: hook.state,
    storageMode: "browser",
    isLoading: hook.isLoading,
    isSaving: hook.isSaving,
    error: hook.error,
    completeLesson: hook.completeLesson,
    submitReview: hook.submitReview,
    refresh: hook.refresh,
  }),
}));

vi.mock("@/features/study/immersion", () => ({
  fetchImmersionExamples: fetchImmersionExamplesMock,
}));

const cat: CustomVocabularyWord = {
  id: "kana-cat",
  characters: "ねこ",
  reading: "ねこ",
  meanings: ["Cat", "Kitty"],
  partsOfSpeech: ["noun"],
  meaningMnemonic: "A <vocabulary>cat</vocabulary> curls up by your neck.",
  readingMnemonic: "The word is already written in kana: <reading>ねこ</reading>.",
  contextSentences: [{ ja: "ねこが寝ています。", en: "The cat is sleeping." }],
};

const dog: CustomVocabularyWord = {
  id: "kana-dog",
  characters: "いぬ",
  reading: "いぬ",
  meanings: ["Dog"],
  partsOfSpeech: ["noun"],
  meaningMnemonic: "A dog is in a new yard.",
  readingMnemonic: "The word is already written in kana: いぬ.",
  contextSentences: [{ ja: "いぬと歩きます。", en: "I walk with the dog." }],
};

const footsteps: CustomVocabularyWord = {
  id: "level-8-footsteps",
  characters: "足音",
  reading: "あしおと",
  meanings: ["Footsteps", "Sound of footsteps"],
  partsOfSpeech: ["noun"],
  meaningMnemonic: "You hear the <vocabulary>sound of feet</vocabulary> before anyone reaches the door.",
  readingMnemonic: "Join <reading>あし</reading> (foot) and <reading>おと</reading> (sound): <reading>あしおと</reading>.",
  contextSentences: [{ ja: "廊下から足音が聞こえた。", en: "I heard footsteps from the hallway." }],
  requiredLevel: 8,
  kanjiLevels: { "足": 4, "音": 8 },
};

function assignment(wordId: string, packId: string, stage: CustomSrsAssignment["stage"], availableAt: string | null): CustomSrsAssignment {
  return {
    wordId,
    packId,
    stage,
    availableAt,
    startedAt: stage ? "2026-01-01T00:00:00.000Z" : null,
    burnedAt: null,
    updatedAt: "2026-08-31T08:00:00.000Z",
    correctReviews: 0,
    incorrectReviews: 0,
    card: null,
  };
}

function stateFor(pack: CustomVocabularyPack, stages: Record<string, { stage: CustomSrsAssignment["stage"]; availableAt: string | null }>): CustomSrsState {
  return {
    version: 1,
    policy: CUSTOM_SRS_POLICY,
    enrolledPackIds: [pack.id],
    assignments: Object.fromEntries(pack.words.map((word) => {
      const value = stages[word.id] ?? { stage: 0 as const, availableAt: null };
      return [word.id, assignment(word.id, pack.id, value.stage, value.availableAt)];
    })),
    reviewLog: [],
    updatedAt: "2026-08-31T08:00:00.000Z",
  };
}

function withAssignment(current: CustomSrsState, wordId: string, stage: CustomSrsAssignment["stage"], availableAt: string | null) {
  return { ...current, assignments: { ...current.assignments, [wordId]: { ...current.assignments[wordId], stage, availableAt } } };
}

function renderSession(mode: "lessons" | "reviews", packs: CustomVocabularyPack[], lessonBatchSize?: number) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><CustomSrsSession mode={mode} packs={packs} lessonBatchSize={lessonBatchSize} /></QueryClientProvider>);
}

describe("custom vocabulary lesson and review sessions", () => {
  beforeAll(() => {
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoViewMock });
    if (!window.requestAnimationFrame) Object.defineProperty(window, "requestAnimationFrame", { configurable: true, value: (callback: FrameRequestCallback) => window.setTimeout(callback, 0) });
    if (!window.cancelAnimationFrame) Object.defineProperty(window, "cancelAnimationFrame", { configurable: true, value: (id: number) => window.clearTimeout(id) });
  });

  beforeEach(() => {
    hook.completeLesson.mockReset();
    hook.submitReview.mockReset();
    hook.refresh.mockReset();
    hook.error = "";
    hook.isLoading = false;
    hook.isSaving = false;
    scrollIntoViewMock.mockClear();
    fetchImmersionExamplesMock.mockReset();
    fetchImmersionExamplesMock.mockResolvedValue([{
      title: "Natsume's Book of Friends",
      sentence: "ねこが庭を歩いています。",
      translation: "A cat is walking through the garden.",
    }]);
  });

  afterEach(() => cleanup());

  it("keeps the page position when arrow keys switch lesson detail tabs", async () => {
    const pack: CustomVocabularyPack = { id: "everyday-hiragana", title: "Everyday Hiragana", description: "Common words", script: "hiragana", words: [cat] };
    hook.state = stateFor(pack, { [cat.id]: { stage: 0, availableAt: null } });

    renderSession("lessons", [pack]);
    expect(screen.getByRole("tab", { name: "Meaning" })).toHaveAttribute("aria-selected", "true");
    scrollIntoViewMock.mockClear();

    fireEvent.keyDown(window, { key: "ArrowRight" });

    expect(screen.getByRole("tab", { name: "Context" })).toHaveAttribute("aria-selected", "true");
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it("keeps the page position when lesson navigation arrows switch words", async () => {
    const pack: CustomVocabularyPack = { id: "everyday-hiragana", title: "Everyday Hiragana", description: "Common words", script: "hiragana", words: [cat, dog] };
    hook.state = stateFor(pack, {});

    renderSession("lessons", [pack]);
    expect(screen.getByRole("heading", { name: "Cat" })).toBeInTheDocument();
    scrollIntoViewMock.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Next lesson" }));

    expect(await screen.findByRole("heading", { name: "Dog" })).toBeInTheDocument();
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    expect(scrollIntoViewMock).not.toHaveBeenCalledWith({ block: "start" });
    expect(screen.getByRole("tab", { name: "Meaning" })).not.toHaveFocus();
  });

  it("keeps tab focus when tab arrows cross between lesson words", async () => {
    const pack: CustomVocabularyPack = { id: "everyday-hiragana", title: "Everyday Hiragana", description: "Common words", script: "hiragana", words: [cat, dog] };
    hook.state = stateFor(pack, {});

    renderSession("lessons", [pack]);
    const contextTab = screen.getByRole("tab", { name: "Context" });
    fireEvent.click(contextTab);
    contextTab.focus();

    fireEvent.keyDown(contextTab, { key: "ArrowRight" });

    expect(await screen.findByRole("heading", { name: "Dog" })).toBeInTheDocument();
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    expect(screen.getByRole("tab", { name: "Meaning" })).toHaveFocus();
  });

  it("teaches the editorial content and keeps wrong-mode answers non-penalizing", async () => {
    const pack: CustomVocabularyPack = { id: "everyday-hiragana", title: "Everyday Hiragana", description: "Common words", script: "hiragana", words: [cat] };
    const initial = stateFor(pack, { [cat.id]: { stage: 0, availableAt: null } });
    hook.state = initial;
    hook.completeLesson.mockResolvedValue(withAssignment(initial, cat.id, 1, "2026-08-31T12:00:00.000Z"));

    const view = renderSession("lessons", [pack]);

    expect(screen.getByRole("tablist", { name: "Subject details" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Meaning" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: "Reading" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Context" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByText("Part of speech")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mnemonic" })).toBeInTheDocument();
    expect(screen.getByText("cat", { selector: "mark" })).toHaveAttribute("data-mnemonic-kind", "vocabulary");
    expect(screen.getByText("The cat is sleeping.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Context" }));
    expect(await screen.findByText("Natsume's Book of Friends")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Anime context" })).toBeInTheDocument();
    expect(screen.getByText("A cat is walking through the garden.")).toBeInTheDocument();
    expect(fetchImmersionExamplesMock).toHaveBeenCalledWith("ねこ", ["*"], expect.any(AbortSignal));
    fireEvent.click(screen.getByRole("tab", { name: "Meaning" }));
    expect(screen.queryByRole("link", { name: "Pause" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start lesson quiz" }));
    const answer = screen.getByRole("textbox", { name: "Vocabulary Meaning" });
    expect(screen.getByRole("link", { name: "Pause and exit session" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    fireEvent.change(answer, { target: { value: "neko" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(screen.getByText("Try another answer")).toBeInTheDocument();
    expect(screen.getByText("You entered the reading, but we want the meaning.")).toBeInTheDocument();
    expect(hook.completeLesson).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Vocabulary Meaning" }), { target: { value: "banana" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByText("Incorrect")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Vocabulary Meaning" }), { target: { value: "cat" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    const next = screen.getByRole("button", { name: "Next" });
    fireEvent.click(next);
    fireEvent.click(next);

    expect(await screen.findByRole("heading", { name: "Custom lessons complete" })).toBeInTheDocument();
    expect(hook.completeLesson).toHaveBeenCalledOnce();
    expect(hook.completeLesson.mock.calls[0][0]).toBe(cat.id);
    expect(hook.completeLesson.mock.calls[0][1]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(screen.getByLabelText("SRS progression")).toHaveTextContent("Apprentice I");
    expect(view.container).not.toContainElement(screen.getByLabelText("SRS progression"));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss SRS progression" }));
    expect(screen.queryByLabelText("SRS progression")).not.toBeInTheDocument();
  });

  it("uses a default lesson batch of five", () => {
    const words = Array.from({ length: 6 }, (_, index) => ({ ...cat, id: `word-${index + 1}`, characters: `こと${index + 1}`, meanings: [`Word ${index + 1}`] }));
    const pack: CustomVocabularyPack = { id: "six-words", title: "Six words", description: "Batch fixture", script: "hiragana", words };
    hook.state = stateFor(pack, {});

    renderSession("lessons", [pack]);

    expect(screen.getByRole("button", { name: "Lesson 5: Word 5" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lesson 6: Word 6" })).not.toBeInTheDocument();
  });

  it("continues a sixteen-word pack in batches of five, five, five, and one without repeating completed lessons", async () => {
    const words = Array.from({ length: 16 }, (_, index) => ({ ...cat, id: `batch-word-${index + 1}`, characters: `こと${index + 1}`, meanings: [`Word ${index + 1}`] }));
    const pack: CustomVocabularyPack = { id: "sixteen-words", title: "Sixteen words", description: "Batch fixture", script: "hiragana", words };
    hook.state = stateFor(pack, {});
    let savedState = hook.state;
    hook.completeLesson.mockImplementation(async (wordId: string) => {
      savedState = withAssignment(savedState, wordId, 1, "2999-01-01T00:00:00.000Z");
      return savedState;
    });

    renderSession("lessons", [pack]);
    const wordsByCharacters = new Map(words.map((word) => [word.characters, word]));
    let completed = 0;
    for (const batchSize of [5, 5, 5, 1]) {
      expect(screen.getAllByRole("button", { name: /^Lesson \d+:/ })).toHaveLength(batchSize);
      expect(screen.getByRole("heading", { name: `Word ${completed + 1}` })).toBeInTheDocument();
      expect(screen.queryByRole("textbox", { name: "Vocabulary Meaning" })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: `Lesson ${batchSize}: Word ${completed + batchSize}` }));
      fireEvent.click(screen.getByRole("button", { name: "Start lesson quiz" }));
      for (let index = 0; index < batchSize; index += 1) {
        const prompt = screen.getByRole("heading", { level: 2 });
        const current = wordsByCharacters.get(prompt.textContent ?? "")!;
        fireEvent.change(screen.getByRole("textbox", { name: "Vocabulary Meaning" }), { target: { value: current.meanings[0] } });
        fireEvent.click(screen.getByRole("button", { name: "Check" }));
        fireEvent.click(screen.getByRole("button", { name: "Next" }));
        completed += 1;
        await waitFor(() => expect(hook.completeLesson).toHaveBeenCalledTimes(completed));
        await waitFor(() => expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument());
      }

      const remaining = words.length - completed;
      expect(await screen.findByRole("heading", { name: remaining ? "Lesson batch complete" : "Custom lessons complete" })).toBeInTheDocument();
      expect(screen.getByText("items completed").previousElementSibling).toHaveTextContent(String(batchSize));
      expect(screen.getByText("100%", { exact: true })).toBeInTheDocument();
      expect(screen.getByText("incorrect attempts").previousElementSibling).toHaveTextContent("0");
      if (remaining) {
        expect(screen.getByText(`${remaining} ${remaining === 1 ? "lesson" : "lessons"} remaining.`)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: `Next batch (${Math.min(5, remaining)})` }));
        expect(screen.queryByLabelText("SRS progression")).not.toBeInTheDocument();
      } else {
        expect(screen.queryByRole("button", { name: /Next batch/ })).not.toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Vocabulary Packs" })).toBeInTheDocument();
      }
    }
    expect(new Set(hook.completeLesson.mock.calls.map(([wordId]) => wordId)).size).toBe(16);
    expect(new Set(hook.completeLesson.mock.calls.map(([, eventId]) => eventId)).size).toBe(16);
  });

  it("requires both meaning and reading before completing a kanji vocabulary lesson", async () => {
    const pack: CustomVocabularyPack = {
      id: "levels-1-10",
      title: "WaniKani Levels 1–10",
      description: "Common vocabulary using early kanji",
      script: "kanji",
      levelRange: { min: 1, max: 10 },
      words: [footsteps],
    };
    const initial = stateFor(pack, { [footsteps.id]: { stage: 0, availableAt: null } });
    hook.state = initial;
    hook.completeLesson.mockResolvedValue(withAssignment(initial, footsteps.id, 1, "2026-08-31T12:00:00.000Z"));

    renderSession("lessons", [pack]);

    expect(screen.getByText("WaniKani level 8+")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Reading" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson quiz" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Vocabulary Meaning" }), { target: { value: "footsteps" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(hook.completeLesson).not.toHaveBeenCalled();
    expect(screen.getByText("Reading", { selector: "strong" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Vocabulary Reading" }), { target: { value: "ashioto" } });
    expect(screen.getByRole("textbox", { name: "Vocabulary Reading" })).toHaveValue("あしおと");
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByRole("heading", { name: "Custom lessons complete" })).toBeInTheDocument();
    expect(hook.completeLesson).toHaveBeenCalledOnce();
    expect(hook.completeLesson).toHaveBeenCalledWith(footsteps.id, expect.any(String));
    expect(screen.getByText("100%", { exact: true })).toBeInTheDocument();
  });

  it("respects a custom batch size and resets mistakes and accuracy for the following batch", async () => {
    const bird = { ...cat, id: "kana-bird", characters: "とり", reading: "とり", meanings: ["Bird"] };
    const pack: CustomVocabularyPack = { id: "three-animals", title: "Animals", description: "Batch fixture", script: "hiragana", words: [cat, dog, bird] };
    hook.state = stateFor(pack, {});
    let savedState = hook.state;
    hook.completeLesson.mockImplementation(async (wordId: string) => {
      savedState = withAssignment(savedState, wordId, 1, "2999-01-01T00:00:00.000Z");
      return savedState;
    });
    renderSession("lessons", [pack], 2);
    expect(screen.getAllByRole("button", { name: /^Lesson \d+:/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Lesson 2: Dog" }));
    fireEvent.click(screen.getByRole("button", { name: "Start lesson quiz" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Vocabulary Meaning" }), { target: { value: "banana" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    for (let completed = 1; completed <= 2; completed += 1) {
      const prompt = screen.getByRole("heading", { level: 2 }).textContent;
      fireEvent.change(screen.getByRole("textbox", { name: "Vocabulary Meaning" }), { target: { value: prompt === cat.characters ? "cat" : "dog" } });
      fireEvent.click(screen.getByRole("button", { name: "Check" }));
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
      await waitFor(() => expect(hook.completeLesson).toHaveBeenCalledTimes(completed));
      await waitFor(() => expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument());
    }
    expect(await screen.findByRole("heading", { name: "Lesson batch complete" })).toBeInTheDocument();
    expect(screen.getByText("67%", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("incorrect attempts").previousElementSibling).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "Next batch (1)" }));
    expect(screen.getByRole("heading", { name: "Bird" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Lesson \d+:/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Start lesson quiz" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Vocabulary Meaning" }), { target: { value: "bird" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("heading", { name: "Custom lessons complete" })).toBeInTheDocument();
    expect(screen.getByText("100%", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("incorrect attempts").previousElementSibling).toHaveTextContent("0");
    expect(screen.getByText("items completed").previousElementSibling).toHaveTextContent("1");
  });

  it("does not offer the next lesson batch until the current batch saves successfully", async () => {
    const pack: CustomVocabularyPack = { id: "save-retry", title: "Save retry", description: "Batch fixture", script: "hiragana", words: [cat, dog] };
    const initial = stateFor(pack, {});
    hook.state = initial;
    hook.completeLesson.mockRejectedValueOnce(new Error("Unable to save this lesson."))
      .mockResolvedValueOnce(withAssignment(initial, cat.id, 1, "2999-01-01T00:00:00.000Z"));
    renderSession("lessons", [pack], 1);
    fireEvent.click(screen.getByRole("button", { name: "Start lesson quiz" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Vocabulary Meaning" }), { target: { value: "cat" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to save this lesson.");
    expect(screen.queryByRole("button", { name: /Next batch/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry Save" }));
    expect(await screen.findByRole("heading", { name: "Lesson batch complete" })).toBeInTheDocument();
    expect(hook.completeLesson.mock.calls[0][1]).toBe(hook.completeLesson.mock.calls[1][1]);
    fireEvent.click(screen.getByRole("button", { name: "Next batch (1)" }));
    expect(screen.getByRole("heading", { name: "Dog" })).toBeInTheDocument();
  });

  it("interleaves both sides of a larger kanji review batch within the normal question gap", () => {
    const words = Array.from({ length: 12 }, (_, index) => ({ ...footsteps, id: `kanji-${index + 1}`, characters: `足音${index + 1}` }));
    const pack: CustomVocabularyPack = {
      id: "kanji-batch",
      title: "Kanji batch",
      description: "Queue fixture",
      script: "kanji",
      levelRange: { min: 1, max: 10 },
      words,
    };
    const state = stateFor(pack, Object.fromEntries(words.map((word) => [word.id, { stage: 3 as const, availableAt: "2020-01-01T00:00:00.000Z" }])));
    const questions = createCustomQuestionQueue(words, state, "reviews", DEFAULT_WEB_SETTINGS.study, () => 0);

    expect(questions).toHaveLength(24);
    for (const word of words) {
      const matching = questions.flatMap((question, index) => question.word.id === word.id ? [{ index, kind: question.kind }] : []);
      expect(matching.map((question) => question.kind).sort()).toEqual(["meaning", "reading"]);
      expect(matching[1].index - matching[0].index).toBeLessThanOrEqual(10);
    }
  });

  it("respects custom review ordering by SRS stage and WaniKani-ready level", () => {
    const words = [
      { ...footsteps, id: "level-8", characters: "足音八", requiredLevel: 8 },
      { ...footsteps, id: "level-5", characters: "足音五", requiredLevel: 5 },
      { ...footsteps, id: "level-10", characters: "足音十", requiredLevel: 10 },
    ];
    const pack: CustomVocabularyPack = { id: "ordered-kanji", title: "Ordered kanji", description: "Order fixture", script: "kanji", levelRange: { min: 1, max: 10 }, words };
    const state = stateFor(pack, {
      "level-8": { stage: 1, availableAt: "2020-01-01T00:00:00.000Z" },
      "level-5": { stage: 7, availableAt: "2020-01-01T00:00:00.000Z" },
      "level-10": { stage: 4, availableAt: "2020-01-01T00:00:00.000Z" },
    });
    const orderedPreferences = { ...DEFAULT_WEB_SETTINGS.study, reviewQuestionOrderEnabled: true, reviewQuestionOrder: "meaning-first" as const };

    const descendingStage = createCustomQuestionQueue(words, state, "reviews", { ...orderedPreferences, customReviewOrder: "descendingSrsStage" }, () => 0);
    expect(descendingStage.slice(0, 3).map((question) => question.word.id)).toEqual(["level-5", "level-10", "level-8"]);

    const lowestLevel = createCustomQuestionQueue(words, state, "reviews", { ...orderedPreferences, customReviewOrder: "lowestLevelFirst" }, () => 0);
    expect(lowestLevel.slice(0, 3).map((question) => question.word.id)).toEqual(["level-5", "level-8", "level-10"]);
  });

  it("includes only due reviews, requeues misses, and commits a completed item once", async () => {
    const pack: CustomVocabularyPack = { id: "mixed-due", title: "Mixed due", description: "Due fixture", script: "hiragana", words: [cat, dog] };
    const initial = stateFor(pack, {
      [cat.id]: { stage: 3, availableAt: "2020-01-01T00:00:00.000Z" },
      [dog.id]: { stage: 2, availableAt: "2999-01-01T00:00:00.000Z" },
    });
    hook.state = initial;
    hook.submitReview.mockResolvedValue(withAssignment(initial, cat.id, 2, "2999-01-02T00:00:00.000Z"));

    renderSession("reviews", [pack]);

    expect(screen.getByText("ねこ")).toBeInTheDocument();
    expect(screen.queryByText("いぬ")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Vocabulary Meaning" }), { target: { value: "banana" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Vocabulary Meaning" }), { target: { value: "cat" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    const next = screen.getByRole("button", { name: "Next" });
    fireEvent.click(next);
    fireEvent.click(next);

    expect(await screen.findByRole("heading", { name: "Custom reviews complete" })).toBeInTheDocument();
    expect(hook.submitReview).toHaveBeenCalledOnce();
    expect(hook.submitReview.mock.calls[0][0]).toBe(cat.id);
    expect(hook.submitReview.mock.calls[0][1]).toBe(1);
    expect(hook.submitReview.mock.calls[0][2]).toMatch(/^[0-9a-f-]{36}$/i);
    expect(screen.getByLabelText("SRS progression")).toHaveTextContent("Apprentice II");
  });

  it("reuses the same event UUID when a save is retried", async () => {
    const pack: CustomVocabularyPack = { id: "retry-pack", title: "Retry pack", description: "Retry fixture", script: "hiragana", words: [cat] };
    const initial = stateFor(pack, { [cat.id]: { stage: 1, availableAt: "2020-01-01T00:00:00.000Z" } });
    hook.state = initial;
    hook.submitReview
      .mockRejectedValueOnce(new Error("Progress is temporarily unavailable."))
      .mockResolvedValueOnce(withAssignment(initial, cat.id, 2, "2999-01-01T00:00:00.000Z"));

    renderSession("reviews", [pack]);
    fireEvent.change(screen.getByRole("textbox", { name: "Vocabulary Meaning" }), { target: { value: "cat" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Progress is temporarily unavailable.");
    fireEvent.click(screen.getByRole("button", { name: "Retry Save" }));
    expect(await screen.findByRole("heading", { name: "Custom reviews complete" })).toBeInTheDocument();
    expect(hook.submitReview).toHaveBeenCalledTimes(2);
    expect(hook.submitReview.mock.calls[0][2]).toBe(hook.submitReview.mock.calls[1][2]);
  });

  it("blocks entry after an initial hook error and offers retry and back actions", async () => {
    const pack: CustomVocabularyPack = { id: "error-pack", title: "Error pack", description: "Error fixture", script: "hiragana", words: [cat] };
    hook.state = stateFor(pack, { [cat.id]: { stage: 1, availableAt: "2020-01-01T00:00:00.000Z" } });
    hook.error = "Custom vocabulary progress could not be reached.";
    hook.refresh.mockImplementation(async () => {
      hook.error = "";
      return { error: null };
    });

    renderSession("reviews", [pack]);

    expect(screen.getByRole("heading", { name: "Custom vocabulary could not load" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Vocabulary (Meaning|Reading)/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Vocabulary Packs" })).toHaveAttribute("href", "/custom-vocabulary");
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));

    expect(await screen.findByRole("textbox", { name: /Vocabulary (Meaning|Reading)/ })).toBeInTheDocument();
    expect(hook.refresh).toHaveBeenCalledOnce();
  });
});
