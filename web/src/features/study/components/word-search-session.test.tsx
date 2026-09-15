import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Assignment, Subject } from "@/types/wanikani";
import { getModeDefaultFilters } from "../mode-config";
import { loadModeState, saveModeState, saveStudyConfig } from "../storage";
import type { StudyDataset, WordSearchEntry } from "../types";
import { StudyModeClient } from "./study-mode-client";
import { WordSearchGame, type SavedWordSearch } from "./word-search-game";

const datasetState = vi.hoisted(() => ({ dataset: { subjects: [], assignments: [] } as StudyDataset }));

vi.mock("../use-study-dataset", () => ({
  useStudyDataset: () => ({
    status: "authenticated",
    user: { id: "word-search-user", data: { username: "word-search-user", level: 2 } },
    dataset: datasetState.dataset,
    loading: false,
    fetching: false,
    error: null,
    retry: vi.fn(),
  }),
}));

const vocabulary = [
  ["日本", "にほん"], ["学校", "がっこう"], ["大学", "だいがく"],
  ["先生", "せんせい"], ["学生", "がくせい"], ["電車", "でんしゃ"],
  ["電話", "でんわ"], ["会社", "かいしゃ"], ["時間", "じかん"],
  ["天気", "てんき"], ["友達", "ともだち"], ["食事", "しょくじ"],
  ["毎日", "まいにち"], ["朝御飯", "あさごはん"], ["日本語", "にほんご"],
  ["新聞", "しんぶん"], ["空港", "くうこう"], ["家族", "かぞく"],
  ["誕生日", "たんじょうび"], ["自転車", "じてんしゃ"], ["銀行", "ぎんこう"],
  ["病院", "びょういん"], ["公園", "こうえん"], ["図書館", "としょかん"],
];

function makeDataset(): StudyDataset {
  const subjects: Subject[] = vocabulary.map(([characters, reading], index) => ({
    id: index + 1,
    object: "vocabulary",
    url: "",
    data_updated_at: "",
    data: {
      level: index < 12 ? 1 : 2,
      created_at: "",
      slug: characters,
      document_url: "",
      hidden_at: null,
      characters,
      meanings: [{ meaning: `Word ${index + 1}`, primary: true, accepted_answer: true }],
      auxiliary_meanings: [],
      readings: [{ reading, primary: true, accepted_answer: true }],
    },
  }));
  const assignments: Assignment[] = subjects.map((subject, index) => ({
    id: subject.id,
    object: "assignment",
    url: "",
    data_updated_at: "",
    data: {
      subject_id: subject.id,
      subject_type: "vocabulary",
      srs_stage: index % 2 ? 5 : 1,
      available_at: null,
      started_at: "2026-01-01T00:00:00.000Z",
      unlocked_at: "2026-01-01T00:00:00.000Z",
      passed_at: null,
      burned_at: null,
      resurrected_at: null,
      hidden: false,
      created_at: "",
    },
  }));
  return { subjects, assignments };
}

function savedGame() {
  const game = loadModeState<SavedWordSearch>("word-search-user", "word-search", "game");
  expect(game).not.toBeNull();
  return game!;
}

function findWord(entry: WordSearchEntry) {
  for (const cell of [entry.path[0], entry.path.at(-1)!]) {
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Row ${cell.row + 1}, column ${cell.col + 1}:`) }));
  }
  act(() => { vi.advanceTimersByTime(420); });
}

async function renderSetup() {
  await act(async () => { render(<StudyModeClient mode="word-search" />); });
}

describe("word search session setup and persistence", () => {
  beforeEach(() => {
    datasetState.dataset = makeDataset();
    vi.useFakeTimers();
    let seed = 72631;
    vi.spyOn(Math, "random").mockImplementation(() => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x100000000;
    });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ lists: [] }) })));
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("builds a fresh puzzle when starting again with the same settings", async () => {
    await renderSetup();
    fireEvent.click(screen.getByRole("button", { name: "Build puzzle" }));
    const first = savedGame();
    findWord(first.puzzle.entries[0]);
    fireEvent.click(screen.getByRole("button", { name: "Pause word search" }));
    fireEvent.click(screen.getByRole("button", { name: "Build puzzle" }));

    const second = savedGame();
    expect(second.foundEntryIds).toEqual([]);
    expect(second.puzzle).not.toEqual(first.puzzle);
    expect(within(screen.getByRole("complementary", { name: "Vocabulary clues" })).getAllByRole("button")).toHaveLength(10);
  });

  it("resumes the saved puzzle and progress after setup settings change", async () => {
    await renderSetup();
    fireEvent.click(screen.getByRole("button", { name: "Build puzzle" }));
    const first = savedGame();
    findWord(first.puzzle.entries[0]);
    const paused = savedGame();
    fireEvent.click(screen.getByRole("button", { name: "Pause word search" }));
    fireEvent.change(screen.getByRole("slider", { name: "Session length" }), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /Resume saved puzzle/ }));

    expect(savedGame().puzzle).toEqual(paused.puzzle);
    expect(savedGame().foundEntryIds).toEqual(paused.foundEntryIds);
    fireEvent.click(screen.getByRole("button", { name: "Pause word search" }));
    fireEvent.click(screen.getByRole("button", { name: "Build puzzle" }));
    expect(savedGame().puzzle.entries).toHaveLength(5);
    expect(savedGame().foundEntryIds).toEqual([]);
  });

  it("can request new vocabulary before finishing the current board", async () => {
    await renderSetup();
    fireEvent.click(screen.getByRole("button", { name: "Build puzzle" }));
    const first = savedGame();
    findWord(first.puzzle.entries[0]);
    const encountered = new Set(first.puzzle.entries.map((entry) => entry.subjectId));

    for (let index = 0; index < 3; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: "New puzzle" }));
      const next = savedGame();
      expect(next.foundEntryIds).toEqual([]);
      expect(next.mistakes).toBe(0);
      next.puzzle.entries.forEach((entry) => encountered.add(entry.subjectId));
    }

    expect(encountered.size).toBeGreaterThan(first.puzzle.entries.length);
  });

  it("builds another puzzle after completion and returning to setup", async () => {
    await renderSetup();
    fireEvent.change(screen.getByRole("slider", { name: "Session length" }), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Build puzzle" }));
    const first = savedGame();
    first.puzzle.entries.forEach(findWord);
    expect(screen.getByRole("heading", { name: "All words found" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to setup" }));
    expect(screen.queryByRole("button", { name: /Resume saved puzzle/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Build puzzle" }));

    expect(screen.queryByRole("heading", { name: "All words found" })).not.toBeInTheDocument();
    expect(savedGame().foundEntryIds).toEqual([]);
    expect(savedGame().puzzle).not.toEqual(first.puzzle);
  });

  it("applies count, direction, level, and SRS changes to the next puzzle", async () => {
    await renderSetup();
    fireEvent.click(screen.getByRole("button", { name: "Build puzzle" }));
    fireEvent.click(screen.getByRole("button", { name: "Pause word search" }));
    fireEvent.change(screen.getByRole("slider", { name: "Session length" }), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Kana clues → kanji grid" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Use custom level range" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "From" }), { target: { value: "2" } });
    for (const stage of ["Apprentice", "Master", "Enlightened", "Burned"]) {
      fireEvent.click(screen.getByRole("checkbox", { name: stage }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Build puzzle" }));

    const { puzzle } = savedGame();
    expect(puzzle.entries).toHaveLength(5);
    expect(puzzle.direction).toBe("kana-to-kanji");
    for (const entry of puzzle.entries) {
      expect(datasetState.dataset.subjects.find((subject) => subject.id === entry.subjectId)?.data.level).toBe(2);
      expect(datasetState.dataset.assignments.find((assignment) => assignment.data.subject_id === entry.subjectId)?.data.srs_stage).toBe(5);
    }
  });

  it("preserves an unfinished board when the game itself remounts", () => {
    const props = { dataset: datasetState.dataset, filters: getModeDefaultFilters("word-search", 2), scope: "word-search-user", onExit: vi.fn() };
    const view = render(<WordSearchGame {...props} />);
    findWord(savedGame().puzzle.entries[0]);
    const paused = savedGame();
    view.unmount();
    render(<WordSearchGame {...props} />);

    expect(savedGame().puzzle).toEqual(paused.puzzle);
    expect(savedGame().foundEntryIds).toEqual(paused.foundEntryIds);
  });

  it("resumes an older saved puzzle using its original filter signature", async () => {
    const filters = {
      ...getModeDefaultFilters("word-search", 2),
      count: 5,
      useCustomLevelRange: true,
      maxLevel: 1,
      selectedSubjectIds: [1, 2, 2, 3, 4, 5, 6],
      wordSearchDirection: "kana-to-kanji" as const,
    };
    const view = render(<WordSearchGame dataset={datasetState.dataset} filters={filters} scope="word-search-user" onExit={vi.fn()} />);
    findWord(savedGame().puzzle.entries[0]);
    const legacy = savedGame();
    delete legacy.filters;
    view.unmount();
    saveModeState("word-search-user", "word-search", "game", legacy);
    saveStudyConfig("word-search-user", "word-search", getModeDefaultFilters("word-search", 2));

    await renderSetup();
    fireEvent.click(screen.getByRole("button", { name: /Resume saved puzzle/ }));

    expect(savedGame().puzzle).toEqual(legacy.puzzle);
    expect(savedGame().foundEntryIds).toEqual(legacy.foundEntryIds);
    fireEvent.click(screen.getByRole("button", { name: "New puzzle" }));
    expect(savedGame().puzzle.entries).toHaveLength(5);
    expect(savedGame().puzzle.direction).toBe("kana-to-kanji");
    expect(savedGame().puzzle.entries.every((entry) => entry.subjectId <= 12)).toBe(true);
  });

  it("does not resurrect the previous board after new filters cannot build a puzzle", async () => {
    await renderSetup();
    fireEvent.click(screen.getByRole("button", { name: "Build puzzle" }));
    fireEvent.click(screen.getByRole("button", { name: "Pause word search" }));
    for (const stage of ["Apprentice", "Guru", "Enlightened", "Burned"]) {
      fireEvent.click(screen.getByRole("checkbox", { name: stage }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Build puzzle" }));

    expect(screen.getByRole("heading", { name: "Couldn’t build a word search" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to setup" }));
    expect(screen.queryByRole("button", { name: /Resume saved puzzle/ })).not.toBeInTheDocument();
    expect(loadModeState("word-search-user", "word-search", "game")).toBeNull();
  });

  it("drops a pending drag and click suppression when replacing the board", () => {
    render(<WordSearchGame dataset={datasetState.dataset} filters={getModeDefaultFilters("word-search", 2)} scope="word-search-user" onExit={vi.fn()} />);
    const board = screen.getByLabelText("10 by 10 Japanese word search");
    vi.spyOn(board, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, width: 400, height: 400, top: 0, left: 0, right: 400, bottom: 400, toJSON: () => ({}) });
    board.setPointerCapture = vi.fn();
    board.hasPointerCapture = vi.fn(() => true);
    board.releasePointerCapture = vi.fn();
    const pointer = (type: string) => {
      const event = new Event(type, { bubbles: true });
      Object.assign(event, { pointerId: 7, clientX: 20, clientY: 20 });
      fireEvent(board, event);
    };

    pointer("pointerdown");
    fireEvent.click(screen.getByRole("button", { name: "New puzzle" }));
    expect(board.releasePointerCapture).toHaveBeenCalledWith(7);
    pointer("pointerup");
    expect(screen.queryByText("Start selected. Choose the last character in the word.")).not.toBeInTheDocument();

    pointer("pointerdown");
    pointer("pointerup");
    fireEvent.click(screen.getByRole("button", { name: "New puzzle" }));
    fireEvent.click(screen.getByRole("button", { name: /^Row 1, column 1:/ }));
    expect(screen.getByText("Start selected. Choose the last character in the word.")).toBeInTheDocument();
  });
});
