import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Assignment, Subject } from "@/types/wanikani";
import { getModeDefaultFilters } from "../mode-config";
import { WordSearchGame } from "./word-search-game";

const { generateWordSearchMock } = vi.hoisted(() => ({ generateWordSearchMock: vi.fn() }));

vi.mock("../games", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../games")>();
  return { ...actual, generateWordSearch: generateWordSearchMock };
});

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

function assignment(subjectId: number): Assignment {
  return {
    id: subjectId,
    object: "assignment",
    url: "",
    data_updated_at: "",
    data: {
      subject_id: subjectId,
      subject_type: "vocabulary",
      srs_stage: 5,
      available_at: null,
      started_at: "",
      unlocked_at: "",
      passed_at: null,
      burned_at: null,
      resurrected_at: null,
      hidden: false,
      created_at: "",
    },
  };
}

describe("WordSearchGame", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    generateWordSearchMock.mockReset();
    vi.restoreAllMocks();
  });

  it("supports endpoint selection and advances the saved clue progress", () => {
    const subjects = [vocabulary(1, "日本", "にほん", "Japan"), vocabulary(2, "学校", "がっこう", "School")];
    generateWordSearchMock.mockReturnValue({
      size: 4,
      direction: "kanji-to-kana",
      grid: [["に", "ほ", "ん", "あ"], ["が", "っ", "こ", "う"], ["い", "え", "お", "か"], ["き", "く", "け", "こ"]],
      entries: [
        { id: "word-search-1", subjectId: 1, prompt: "日本", answer: "にほん", characters: "日本", reading: "にほん", meaning: "Japan", path: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }] },
        { id: "word-search-2", subjectId: 2, prompt: "学校", answer: "がっこう", characters: "学校", reading: "がっこう", meaning: "School", path: [{ row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }] },
      ],
    });
    const dataset = { subjects, assignments: subjects.map((subject) => assignment(subject.id)) };

    render(<WordSearchGame dataset={dataset} filters={getModeDefaultFilters("word-search", 60)} scope="word-search-test" onExit={vi.fn()} />);

    expect(screen.getByText("0", { selector: "header span b" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Row 1, column 1: に" }));
    expect(screen.getByText("Start selected. Choose the last character in the word.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Row 1, column 3: ん" }));

    expect(screen.getByText("1", { selector: "header span b" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "日本, Japan, found" })).toBeDisabled();
    expect(screen.getByText(/日本 found/)).toBeInTheDocument();
  });
});
