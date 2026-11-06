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
import { generateCrossword } from "../games";

const dataset: StudyDataset = { subjects: [], assignments: [] };

const hospitalPuzzle = {
  rows: 1,
  cols: 5,
  cells: [[
    { answer: "び", number: 1, entryIds: ["hospital"] },
    { answer: "ょ", entryIds: ["hospital"] },
    { answer: "う", entryIds: ["hospital"] },
    { answer: "い", entryIds: ["hospital"] },
    { answer: "ん", entryIds: ["hospital"] },
  ]],
  entries: [{
    id: "hospital",
    subjectId: 3,
    answer: "びょういん",
    clue: "Hospital",
    characters: "病院",
    meaning: "Hospital",
    row: 0,
    col: 0,
    direction: "across",
    number: 1,
  }],
} satisfies CrosswordPuzzle;

const navigationPuzzle = {
  ...puzzle,
  cells: [
    puzzle.cells[0],
    [
      { answer: "に", number: 2, entryIds: ["what", "garden"] },
      { answer: "わ", entryIds: ["garden"] },
    ],
  ],
  entries: [
    ...puzzle.entries,
    {
      id: "garden",
      subjectId: 4,
      answer: "にわ",
      clue: "Garden",
      characters: "庭",
      meaning: "Garden",
      row: 1,
      col: 0,
      direction: "across",
      number: 2,
    },
  ],
} satisfies CrosswordPuzzle;

function renderCrossword(nextPuzzle?: CrosswordPuzzle) {
  if (nextPuzzle) vi.mocked(generateCrossword).mockReturnValueOnce(nextPuzzle);
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
  const answer = screen.getByRole("textbox", { name: "Crossword grid input" });
  fireEvent.change(answer, { target: { value: "natsu" } });
  fireEvent.keyDown(answer, { key: "Enter" });
  await waitFor(() => expect(screen.getByText("What", { selector: "[data-active-clue]" })).toBeVisible());

  const nextAnswer = screen.getByRole("textbox", { name: "Crossword grid input" });
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

  it("keeps an ambiguous n in the active grid square while composing kana", () => {
    renderCrossword();

    const answer = screen.getByRole("textbox", { name: "Crossword grid input" });
    answer.focus();
    fireEvent.change(answer, { target: { value: "n" } });
    expect(answer).toHaveValue("n");
    expect(tileLetter(1, 1)).toHaveTextContent("n");
    expect(answer).toHaveFocus();

    fireEvent.change(answer, { target: { value: "na" } });
    expect(answer).toHaveValue("な");
    expect(tileLetter(1, 1)).toHaveTextContent("な");
    expect(tileLetter(1, 2)).toBeEmptyDOMElement();
  });

  it("flushes a trailing romaji n before checking the selected word", () => {
    renderCrossword(hospitalPuzzle);

    const answer = screen.getByRole("textbox", { name: "Crossword grid input" }) as HTMLInputElement;
    for (const character of "byouin") {
      fireEvent.change(answer, { target: { value: `${answer.value}${character}` } });
    }
    expect(answer).toHaveValue("びょういn");

    fireEvent.click(screen.getByRole("button", { name: "Check word" }));

    expect(screen.getByRole("status")).toHaveTextContent("Correct. Revealing the word");
    expect(answer).toHaveValue("びょういん");
    expect(answer).not.toHaveAttribute("aria-invalid");
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

  it("types into the grid and checks the word with Return", async () => {
    renderCrossword();

    const answer = screen.getByRole("textbox", { name: "Crossword grid input" });
    fireEvent.change(answer, { target: { value: "n" } });
    expect(answer).toHaveValue("n");
    expect(tileLetter(1, 1)).toHaveTextContent("n");

    fireEvent.change(answer, { target: { value: "na" } });
    expect(answer).toHaveValue("な");
    expect(tileLetter(1, 1)).toHaveTextContent("な");

    fireEvent.change(answer, { target: { value: "natsu" } });
    expect(answer).toHaveValue("なつ");
    expect(tileLetter(1, 2)).toHaveTextContent("つ");
    fireEvent.keyDown(answer, { key: "Enter" });

    await waitFor(() => expect(screen.getByText("What", { selector: "[data-active-clue]" })).toBeVisible());
    expect(screen.getByRole("textbox", { name: "Crossword grid input" })).toHaveValue("");
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Crossword grid input" })).toHaveFocus());
    expect(tileLetter(1, 1)).toHaveTextContent("な");
    expect(tileLetter(1, 2)).toHaveTextContent("つ");
    expect(tile(1, 2)).toHaveAttribute("data-completed", "true");
  });

  it("advances to the next word when Return is pressed with an empty answer", async () => {
    renderCrossword();

    const answer = screen.getByRole("textbox", { name: "Crossword grid input" });
    answer.focus();
    expect(screen.getByText("Summer", { selector: "[data-active-clue]" })).toBeVisible();
    expect(answer).toHaveValue("");

    fireEvent.keyDown(answer, { key: "Enter" });

    await waitFor(() => expect(screen.getByText("What", { selector: "[data-active-clue]" })).toBeVisible());
    expect(answer).toHaveValue("");
    expect(answer).not.toHaveAttribute("aria-invalid");
    await waitFor(() => expect(answer).toHaveFocus());
  });

  it("fills a leading crossing from the grid when only the missing kana is typed", async () => {
    renderCrossword();
    const answer = screen.getByRole("textbox", { name: "Crossword grid input" });
    fireEvent.change(answer, { target: { value: "natsu" } });
    fireEvent.keyDown(answer, { key: "Enter" });
    await waitFor(() => expect(screen.getByText("What", { selector: "[data-active-clue]" })).toBeVisible());

    fireEvent.change(answer, { target: { value: "ni" } });
    expect(tileLetter(1, 1)).toHaveTextContent("な");
    expect(tileLetter(2, 1)).toHaveTextContent("に");
    fireEvent.keyDown(answer, { key: "Enter" });
    await waitFor(() => expect(screen.getByRole("heading", { name: "Crossword complete" })).toBeVisible());
  });

  it("counts a trailing crossing when checking the letters displayed in the grid", async () => {
    renderCrossword({
      ...puzzle,
      cells: [
        [{ answer: "な", number: 1, entryIds: ["summer"] }, { answer: "つ", number: 2, entryIds: ["summer", "what"] }],
        [null, { answer: "に", entryIds: ["what"] }],
      ],
      entries: [puzzle.entries[0], { ...puzzle.entries[1], answer: "つに", col: 1, number: 2 }],
    });
    fireEvent.click(screen.getByRole("button", { name: /2 Down.*What/i }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal word" }));
    fireEvent.click(screen.getByRole("button", { name: /1 Across.*Summer/i }));
    const answer = screen.getByRole("textbox", { name: "Crossword grid input" });
    fireEvent.change(answer, { target: { value: "na" } });
    expect(tileLetter(1, 1)).toHaveTextContent("な");
    expect(tileLetter(1, 2)).toHaveTextContent("つ");
    fireEvent.click(screen.getByRole("button", { name: "Check word" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Crossword complete" })).toBeVisible());
  });

  it("rejects extra kana instead of silently truncating an answer to the grid", () => {
    renderCrossword();
    const answer = screen.getByRole("textbox", { name: "Crossword grid input" });
    fireEvent.change(answer, { target: { value: "なつあ" } });
    fireEvent.click(screen.getByRole("button", { name: "Check word" }));
    expect(answer).toHaveAttribute("aria-invalid", "true");
  });

  it("continues forward after answering a skipped-to clue and wraps past solved clues", async () => {
    renderCrossword(navigationPuzzle);

    const answer = screen.getByRole("textbox", { name: "Crossword grid input" });
    fireEvent.keyDown(answer, { key: "Enter" });
    expect(screen.getByText("What", { selector: "[data-active-clue]" })).toBeVisible();

    fireEvent.change(answer, { target: { value: "nani" } });
    fireEvent.keyDown(answer, { key: "Enter" });
    await waitFor(() => expect(screen.getByText("Garden", { selector: "[data-active-clue]" })).toBeVisible());

    fireEvent.keyDown(answer, { key: "Enter" });
    expect(screen.getByText("Summer", { selector: "[data-active-clue]" })).toBeVisible();
    fireEvent.keyDown(answer, { key: "Enter" });
    expect(screen.getByText("Garden", { selector: "[data-active-clue]" })).toBeVisible();

    fireEvent.change(answer, { target: { value: "niwa" } });
    fireEvent.keyDown(answer, { key: "Enter" });
    await waitFor(() => expect(screen.getByText("Summer", { selector: "[data-active-clue]" })).toBeVisible());
    await waitFor(() => expect(answer).toHaveFocus());

    fireEvent.change(answer, { target: { value: "natsu" } });
    fireEvent.keyDown(answer, { key: "Enter" });
    await waitFor(() => expect(screen.getByRole("heading", { name: "Crossword complete" })).toBeVisible());
  });

  it("keeps an incorrect checked word editable without committing it", async () => {
    renderCrossword();

    const answer = screen.getByRole("textbox", { name: "Crossword grid input" });
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

  it("keeps the keyboard input in the grid when a square is selected", async () => {
    renderCrossword();

    const grid = screen.getByLabelText("Crossword grid");
    expect(within(grid).getByRole("textbox", { name: "Crossword grid input" })).toBeInTheDocument();

    fireEvent.click(within(grid).getByRole("button", { name: "Row 2, column 1" }));

    expect(screen.getByText("What", { selector: "[data-active-clue]" })).toBeVisible();
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Crossword grid input" })).toHaveFocus());
    expect(grid.querySelectorAll('[data-selected="true"]')).toHaveLength(2);
  });

  it("stages correct feedback across the selected tiles before advancing", async () => {
    vi.useFakeTimers();
    try {
      renderCrossword();

      const answer = screen.getByRole("textbox", { name: "Crossword grid input" });
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

    const answer = screen.getByRole("textbox", { name: "Crossword grid input" });
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

  it("edits a tapped middle square while preserving the surrounding kana", async () => {
    renderCrossword(hospitalPuzzle);
    const input = screen.getByRole("textbox", { name: "Crossword grid input" });
    fireEvent.change(input, { target: { value: "びゃういん" } });
    fireEvent.click(tile(1, 2));
    fireEvent.change(input, { target: { value: "ょ" } });
    expect(tileLetter(1, 1)).toHaveTextContent("び");
    expect(tileLetter(1, 2)).toHaveTextContent("ょ");
    expect(tileLetter(1, 5)).toHaveTextContent("ん");
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(screen.getByRole("heading", { name: "Crossword complete" })).toBeVisible());
  });

  it("preserves unfinished letters when switching clues and returning to the game", () => {
    const view = renderCrossword();
    fireEvent.change(screen.getByRole("textbox", { name: "Crossword grid input" }), { target: { value: "na" } });
    fireEvent.click(screen.getByRole("button", { name: /1 Down.*What/i }));
    expect(tileLetter(1, 1)).toHaveTextContent("な");
    view.unmount();
    renderCrossword();
    expect(tileLetter(1, 1)).toHaveTextContent("な");
  });

  it("backspaces into the previous square after tapping an empty square", () => {
    renderCrossword();
    const input = screen.getByRole("textbox", { name: "Crossword grid input" });
    fireEvent.change(input, { target: { value: "na" } });
    fireEvent.click(tile(1, 2));
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(tileLetter(1, 1)).toBeEmptyDOMElement();
    expect(input).toHaveFocus();
  });

  it("keeps one focused input throughout Japanese IME composition", () => {
    renderCrossword(hospitalPuzzle);
    const input = screen.getByRole("textbox", { name: "Crossword grid input" });
    fireEvent.click(tile(1, 1));
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "びょ" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(screen.getByRole("status")).not.toHaveTextContent("does not match");
    fireEvent.compositionEnd(input, { data: "びょういん", target: { value: "びょういん" } });
    expect(screen.getByRole("textbox", { name: "Crossword grid input" })).toBe(input);
    expect(input).toHaveFocus();
    expect(tileLetter(1, 5)).toHaveTextContent("ん");
  });
});
