import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import WordSearchBoard from "../word-search-board";
import type { WordSearchPuzzle } from "../../utils/wordSearchGenerator";

const puzzle: WordSearchPuzzle = {
  size: 3,
  direction: "kanji-to-kana",
  grid: [
    ["に", "ほ", "ん"],
    ["が", "く", "せ"],
    ["い", "う", "え"],
  ],
  entries: [
    {
      id: "japan",
      subjectId: 1,
      written: "日本",
      reading: "にほん",
      meaning: "Japan",
      clue: "日本",
      answer: "にほん",
      path: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
      ],
    },
  ],
};

const tenByTenPuzzle: WordSearchPuzzle = {
  size: 10,
  direction: "kanji-to-kana",
  grid: Array.from({ length: 10 }, (_, row) =>
    Array.from({ length: 10 }, (_, col) => `${row}${col}`),
  ),
  entries: [],
};

describe("WordSearchBoard", () => {
  it("captures touches before a surrounding scroll view can claim a diagonal", () => {
    const screen = render(
      <WordSearchBoard
        puzzle={puzzle}
        foundPaths={[]}
        onSelectPath={jest.fn()}
      />,
    );
    const board = screen.getByTestId("word-search-board");

    expect(
      board.props.onStartShouldSetResponderCapture({
        nativeEvent: { touches: [{}] },
        touchHistory: { numberActiveTouches: 1 },
      }),
    ).toBe(true);
  });

  it("renders every puzzle row as one aligned row with all ten cells", () => {
    const screen = render(
      <WordSearchBoard
        puzzle={tenByTenPuzzle}
        foundPaths={[]}
        onSelectPath={jest.fn()}
      />,
    );

    for (let rowIndex = 0; rowIndex < tenByTenPuzzle.size; rowIndex += 1) {
      const row = screen.getByTestId(`word-search-row-${rowIndex}`);
      expect(row.children).toHaveLength(tenByTenPuzzle.size);
    }
  });

  it("submits a straight path using start and end taps", () => {
    const onSelectPath = jest.fn();
    const screen = render(
      <WordSearchBoard
        puzzle={puzzle}
        foundPaths={[]}
        onSelectPath={onSelectPath}
      />,
    );

    fireEvent.press(screen.getByTestId("word-search-cell-0-0"));
    fireEvent.press(screen.getByTestId("word-search-cell-0-2"));

    expect(onSelectPath).toHaveBeenCalledWith([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ]);
  });

  it("moves the anchor when the second tap is not on a straight line", () => {
    const onSelectPath = jest.fn();
    const screen = render(
      <WordSearchBoard
        puzzle={puzzle}
        foundPaths={[]}
        onSelectPath={onSelectPath}
      />,
    );

    fireEvent.press(screen.getByTestId("word-search-cell-0-0"));
    fireEvent.press(screen.getByTestId("word-search-cell-1-2"));

    expect(onSelectPath).not.toHaveBeenCalled();
    expect(
      screen.getByTestId("word-search-cell-1-2").props.accessibilityState,
    ).toEqual({ selected: true });
  });
});
