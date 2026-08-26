import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getModeDefaultFilters } from "../mode-config";
import type { CrosswordPuzzle, StudyDataset } from "../types";

const { puzzle } = vi.hoisted(() => ({
  puzzle: {
    rows: 2,
    cols: 2,
    cells: [
      [
        { answer: "な", number: 1, entryIds: ["summer", "what"] },
        { answer: "つ", entryIds: ["summer"] },
      ],
      [
        { answer: "に", entryIds: ["what"] },
        null,
      ],
    ],
    entries: [
      {
        id: "summer",
        subjectId: 1,
        answer: "なつ",
        clue: "Summer",
        characters: "夏",
        meaning: "Summer",
        row: 0,
        col: 0,
        direction: "across",
        number: 1,
      },
      {
        id: "what",
        subjectId: 2,
        answer: "なに",
        clue: "What",
        characters: "何",
        meaning: "What",
        row: 0,
        col: 0,
        direction: "down",
        number: 1,
      },
    ],
  } satisfies CrosswordPuzzle,
}));

vi.mock("../games", async (importOriginal) => {
  const original = await importOriginal<typeof import("../games")>();
  return { ...original, generateCrossword: vi.fn(() => puzzle) };
});

import { CrosswordGame } from "./special-modes";

const dataset: StudyDataset = { subjects: [], assignments: [] };

function renderCrossword() {
  return render(
    <CrosswordGame
      dataset={dataset}
      filters={{
        ...getModeDefaultFilters("crossword", 60),
        crosswordPlayAudioOnCorrect: false,
      }}
      scope="crossword-test"
      onExit={vi.fn()}
    />,
  );
}

async function solveCrossword() {
  const answer = screen.getByRole("textbox", { name: "Answer" });
  fireEvent.change(answer, { target: { value: "natsu" } });
  fireEvent.keyDown(answer, { key: "Enter" });
  await waitFor(() => expect(screen.getByText("What", { selector: "[data-active-clue]" })).toBeVisible());

  const nextAnswer = screen.getByRole("textbox", { name: "Answer" });
  fireEvent.change(nextAnswer, { target: { value: "nani" } });
  fireEvent.keyDown(nextAnswer, { key: "Enter" });
  await waitFor(() => expect(screen.getByRole("heading", { name: "Crossword complete" })).toBeVisible());
}

function tile(row: number, column: number) {
  return screen.getByRole("button", { name: `Row ${row}, column ${column}` });
}

function tileLetter(row: number, column: number) {
  return tile(row, column).querySelector("[data-letter]");
}

describe("crossword keyboard interaction", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps an ambiguous n editable in the lower field while previewing complete kana", () => {
    renderCrossword();

    const answer = screen.getByRole("textbox", { name: "Answer" });
    answer.focus();
    fireEvent.change(answer, { target: { value: "n" } });
    expect(answer).toHaveValue("n");
    expect(tileLetter(1, 1)).toBeEmptyDOMElement();
    expect(answer).toHaveFocus();

    fireEvent.change(answer, { target: { value: "na" } });
    expect(answer).toHaveValue("な");
    expect(tileLetter(1, 1)).toHaveTextContent("な");
    expect(tileLetter(1, 2)).toBeEmptyDOMElement();
  });

  it("ties clue selection, grid highlighting, and per-word hint controls together", () => {
    renderCrossword();

    const clueRail = screen.getByRole("navigation", { name: "Crossword clues" });
    const downClue = within(clueRail).getByRole("button", { name: /1 Down.*What/i });
    fireEvent.click(downClue);

    expect(downClue).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("What", { selector: "[data-active-clue]" })).toBeVisible();
    const hintButton = screen.getByRole("button", { name: "Show hint" });
    const revealButton = screen.getByRole("button", { name: "Reveal word" });
    expect(hintButton).toBeEnabled();
    expect(revealButton).toBeEnabled();

    const selectedCells = screen
      .getByLabelText("Crossword grid")
      .querySelectorAll('[data-selected="true"]');
    expect(selectedCells).toHaveLength(2);

    fireEvent.click(hintButton);
    expect(screen.getByText("Written as 何")).toBeVisible();

    fireEvent.click(revealButton);
    expect(tileLetter(1, 1)).toHaveTextContent("な");
    expect(tileLetter(2, 1)).toHaveTextContent("に");
    expect(tileLetter(1, 2)).toBeEmptyDOMElement();
  });

  it("previews a word from the lower field and checks it with Return", async () => {
    renderCrossword();

    const answer = screen.getByRole("textbox", { name: "Answer" });
    fireEvent.change(answer, { target: { value: "n" } });
    expect(answer).toHaveValue("n");
    expect(tileLetter(1, 1)).toBeEmptyDOMElement();

    fireEvent.change(answer, { target: { value: "na" } });
    expect(answer).toHaveValue("な");
    expect(tileLetter(1, 1)).toHaveTextContent("な");

    fireEvent.change(answer, { target: { value: "natsu" } });
    expect(answer).toHaveValue("なつ");
    expect(tileLetter(1, 2)).toHaveTextContent("つ");
    fireEvent.keyDown(answer, { key: "Enter" });

    await waitFor(() => expect(screen.getByText("What", { selector: "[data-active-clue]" })).toBeVisible());
    expect(screen.getByRole("textbox", { name: "Answer" })).toHaveValue("");
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Answer" })).toHaveFocus());
    expect(tileLetter(1, 1)).toHaveTextContent("な");
    expect(tileLetter(1, 2)).toHaveTextContent("つ");
    expect(tile(1, 2)).toHaveAttribute("data-completed", "true");
  });

  it("keeps an incorrect checked word editable without committing it", async () => {
    renderCrossword();

    const answer = screen.getByRole("textbox", { name: "Answer" });
    fireEvent.change(answer, { target: { value: "nani" } });
    fireEvent.keyDown(answer, { key: "Enter" });

    expect(answer).toHaveValue("なに");
    expect(answer).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("status")).toHaveTextContent("does not match the selected clue");
    await waitFor(() => expect(tile(1, 2)).toHaveAttribute("data-feedback", "incorrect"));
    expect(tileLetter(1, 2)).toHaveTextContent("に");

    fireEvent.change(answer, { target: { value: "natsu" } });
    expect(answer).not.toHaveAttribute("aria-invalid");
  });

  it("uses the grid only to select a word and returns focus to the lower answer field", async () => {
    renderCrossword();

    const grid = screen.getByLabelText("Crossword grid");
    expect(within(grid).queryByRole("textbox", { name: "Row 1, column 1" })).not.toBeInTheDocument();

    fireEvent.click(within(grid).getByRole("button", { name: "Row 2, column 1" }));

    expect(screen.getByText("What", { selector: "[data-active-clue]" })).toBeVisible();
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Answer" })).toHaveFocus());
    expect(grid.querySelectorAll('[data-selected="true"]')).toHaveLength(2);
  });

  it("stages correct feedback across the selected tiles before advancing", async () => {
    vi.useFakeTimers();
    try {
      renderCrossword();

      const answer = screen.getByRole("textbox", { name: "Answer" });
      fireEvent.change(answer, { target: { value: "natsu" } });
      fireEvent.keyDown(answer, { key: "Enter" });

      expect(screen.getByText("Summer", { selector: "[data-active-clue]" })).toBeVisible();
      expect(tile(1, 1)).toHaveAttribute("data-feedback", "correct");
      expect(tile(1, 2)).not.toHaveAttribute("data-feedback");

      await act(async () => { await vi.advanceTimersByTimeAsync(70); });
      expect(tile(1, 2)).toHaveAttribute("data-feedback", "correct");
      expect(screen.getByText("Summer", { selector: "[data-active-clue]" })).toBeVisible();

      await act(async () => { await vi.advanceTimersByTimeAsync(190); });
      expect(screen.getByText("What", { selector: "[data-active-clue]" })).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });

  it("marks every selected tile red when the checked word is wrong", async () => {
    renderCrossword();

    const answer = screen.getByRole("textbox", { name: "Answer" });
    fireEvent.change(answer, { target: { value: "nani" } });
    fireEvent.keyDown(answer, { key: "Enter" });

    expect(screen.getByText("Summer", { selector: "[data-active-clue]" })).toBeVisible();
    expect(tile(1, 1)).toHaveAttribute("data-feedback", "incorrect");
    await waitFor(() => expect(tile(1, 2)).toHaveAttribute("data-feedback", "incorrect"));
  });

  it("shows a dedicated completion summary with a fresh-crossword action", async () => {
    renderCrossword();
    await solveCrossword();

    expect(screen.getByRole("heading", { name: "Crossword complete" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Crossword answers" })).toBeVisible();
    const newCrossword = screen.getByRole("button", { name: "New crossword" });
    expect(newCrossword).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Reveal puzzle" })).not.toBeInTheDocument();

    fireEvent.click(newCrossword);
    expect(tileLetter(1, 1)).toBeEmptyDOMElement();
    expect(screen.queryByRole("heading", { name: "Crossword complete" })).not.toBeInTheDocument();
  });

  it("does not restore a completed crossword when the player returns", async () => {
    const firstRender = renderCrossword();
    await solveCrossword();
    firstRender.unmount();

    renderCrossword();

    expect(tileLetter(1, 1)).toBeEmptyDOMElement();
    expect(screen.queryByRole("heading", { name: "Crossword complete" })).not.toBeInTheDocument();
  });

  it("provides both puzzle dimensions so the board can fit its available viewport", () => {
    renderCrossword();

    const grid = screen.getByLabelText("Crossword grid");
    expect(grid.style.getPropertyValue("--crossword-cols")).toBe("2");
    expect(grid.style.getPropertyValue("--crossword-rows")).toBe("2");
  });
});
