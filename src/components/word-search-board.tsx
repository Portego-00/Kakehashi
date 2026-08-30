import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { fontStyles } from "../utils/fonts";
import { useTheme } from "../utils/theme";
import {
  getWordSearchDragEndCell,
  wordSearchCellKey,
  wordSearchSelectionPath,
  type WordSearchCell,
  type WordSearchPuzzle,
} from "../utils/wordSearchGenerator";

type WordSearchBoardProps = {
  puzzle: WordSearchPuzzle;
  foundPaths: WordSearchCell[][];
  hintCell?: WordSearchCell | null;
  incorrectPath?: WordSearchCell[];
  onSelectPath: (path: WordSearchCell[]) => void;
  onDragStateChange?: (isDragging: boolean) => void;
};

export default function WordSearchBoard({
  puzzle,
  foundPaths,
  hintCell,
  incorrectPath = [],
  onSelectPath,
  onDragStateChange,
}: WordSearchBoardProps) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const dragStartRef = useRef<WordSearchCell | null>(null);
  const isDraggingRef = useRef(false);
  const activePathRef = useRef<WordSearchCell[]>([]);
  const [activePath, setActivePathState] = useState<WordSearchCell[]>([]);
  const [tapAnchor, setTapAnchor] = useState<WordSearchCell | null>(null);

  const boardBorderWidth = StyleSheet.hairlineWidth;
  const boardSize = Math.max(0, Math.min(width - 32, 420));
  const innerBoardSize = boardSize - boardBorderWidth * 2;
  const cellSize = innerBoardSize / puzzle.size;

  const setActivePath = useCallback((path: WordSearchCell[]) => {
    activePathRef.current = path;
    setActivePathState(path);
  }, []);

  const submitPath = useCallback(
    (path: WordSearchCell[]) => {
      if (path.length >= 2) {
        onSelectPath(path);
      }
      setTapAnchor(null);
      setActivePath([]);
    },
    [onSelectPath, setActivePath],
  );

  const handleCellPress = useCallback(
    (cell: WordSearchCell) => {
      if (!tapAnchor) {
        setTapAnchor(cell);
        setActivePath([cell]);
        return;
      }

      if (tapAnchor.row === cell.row && tapAnchor.col === cell.col) {
        setTapAnchor(null);
        setActivePath([]);
        return;
      }

      const path = wordSearchSelectionPath(tapAnchor, cell, puzzle.size);
      if (!path) {
        setTapAnchor(cell);
        setActivePath([cell]);
        return;
      }

      submitPath(path);
    },
    [puzzle.size, setActivePath, submitPath, tapAnchor],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => {
          dragStartRef.current = null;
          return true;
        },
        onPanResponderGrant: () => {
          isDraggingRef.current = false;
        },
        onPanResponderMove: (_, gestureState) => {
          const start = dragStartRef.current;
          if (!start) {
            return;
          }
          if (
            Math.abs(gestureState.dx) <= 5 &&
            Math.abs(gestureState.dy) <= 5
          ) {
            return;
          }
          if (!isDraggingRef.current) {
            isDraggingRef.current = true;
            setTapAnchor(null);
            setActivePath([start]);
            onDragStateChange?.(true);
          }
          const current = getWordSearchDragEndCell(
            start,
            gestureState,
            cellSize,
            puzzle.size,
          );
          const path = wordSearchSelectionPath(start, current, puzzle.size);
          if (path) {
            setActivePath(path);
          }
        },
        onPanResponderRelease: () => {
          const start = dragStartRef.current;
          const path = activePathRef.current;
          const wasDragging = isDraggingRef.current;
          dragStartRef.current = null;
          isDraggingRef.current = false;
          if (wasDragging) {
            onDragStateChange?.(false);
            submitPath(path);
          } else if (start) {
            handleCellPress(start);
          }
        },
        onPanResponderTerminate: () => {
          dragStartRef.current = null;
          if (isDraggingRef.current) {
            onDragStateChange?.(false);
          }
          isDraggingRef.current = false;
          setActivePath([]);
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [
      cellSize,
      handleCellPress,
      onDragStateChange,
      puzzle.size,
      setActivePath,
      submitPath,
    ],
  );

  const activeCellKeys = useMemo(
    () => new Set(activePath.map(wordSearchCellKey)),
    [activePath],
  );
  const foundCellKeys = useMemo(
    () => new Set(foundPaths.flatMap((path) => path.map(wordSearchCellKey))),
    [foundPaths],
  );
  const incorrectCellKeys = useMemo(
    () => new Set(incorrectPath.map(wordSearchCellKey)),
    [incorrectPath],
  );
  const hintCellKey = hintCell ? wordSearchCellKey(hintCell) : null;

  return (
    <View
      testID="word-search-board"
      {...panResponder.panHandlers}
      style={[
        styles.board,
        {
          width: boardSize,
          height: boardSize,
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
          boxShadow: theme.isDark
            ? "0 10px 24px rgba(0,0,0,0.34)"
            : "0 10px 24px rgba(32,45,70,0.10)",
        },
      ]}
    >
      {puzzle.grid.map((row, rowIndex) => (
        <View
          key={`row-${rowIndex}`}
          testID={`word-search-row-${rowIndex}`}
          style={styles.row}
        >
          {row.map((character, colIndex) => {
            const cell = { row: rowIndex, col: colIndex };
            const key = wordSearchCellKey(cell);
            const isActive = activeCellKeys.has(key);
            const isFound = foundCellKeys.has(key);
            const isIncorrect = incorrectCellKeys.has(key);
            const isHinted = hintCellKey === key;
            const isAnchor =
              tapAnchor?.row === rowIndex && tapAnchor.col === colIndex;
            const isLastColumn = colIndex === puzzle.size - 1;
            const isLastRow = rowIndex === puzzle.size - 1;

            let backgroundColor = theme.cardBackground;
            let borderColor = theme.border;
            let textColor = theme.textColor;
            if (isFound) {
              backgroundColor = theme.isDark
                ? "rgba(61,220,132,0.22)"
                : "rgba(22,163,74,0.16)";
              textColor = theme.isDark ? "#84F0B4" : "#137333";
            }
            if (isHinted) {
              backgroundColor = `${theme.accent}28`;
              borderColor = theme.accent;
            }
            if (isIncorrect) {
              backgroundColor = `${theme.error}22`;
              textColor = theme.error;
            }
            if (isActive) {
              backgroundColor = `${theme.primary}30`;
              borderColor = theme.primary;
              textColor = theme.primary;
            }

            return (
              <Pressable
                key={key}
                testID={`word-search-cell-${rowIndex}-${colIndex}`}
                accessibilityRole="button"
                accessibilityLabel={`${character}, row ${rowIndex + 1}, column ${colIndex + 1}`}
                accessibilityHint={
                  tapAnchor
                    ? "Selects the end of the word"
                    : "Selects the start of a word"
                }
                accessibilityState={{ selected: isActive || isFound }}
                onTouchStart={() => {
                  dragStartRef.current = cell;
                }}
                onPress={() => handleCellPress(cell)}
                style={({ pressed }) => [
                  styles.cell,
                  {
                    backgroundColor,
                    borderRightColor: borderColor,
                    borderBottomColor: borderColor,
                    borderRightWidth: isLastColumn
                      ? 0
                      : StyleSheet.hairlineWidth,
                    borderBottomWidth: isLastRow ? 0 : StyleSheet.hairlineWidth,
                    opacity: pressed ? 0.76 : 1,
                  },
                  isAnchor && {
                    borderWidth: 2,
                    borderColor: theme.primary,
                  },
                ]}
              >
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.character,
                    fontStyles.japaneseBold,
                    {
                      color: textColor,
                      fontSize: Math.max(18, Math.min(26, cellSize * 0.58)),
                    },
                  ]}
                >
                  {character}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    alignSelf: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  row: {
    flex: 1,
    flexDirection: "row",
    width: "100%",
  },
  cell: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  character: {
    lineHeight: 31,
    textAlign: "center",
  },
});
