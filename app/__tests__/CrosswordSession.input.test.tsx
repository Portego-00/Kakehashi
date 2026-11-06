import React from "react";
import { cleanupAsync, fireEvent, render, waitFor } from "@testing-library/react-native";
import CrosswordSessionScreen from "../(app)/crossword-session";
import type { CrosswordPuzzle } from "../../src/utils/crosswordGenerator";
import { loadExtraStudySessionState } from "../../src/utils/extraStudySessionPersistence";

jest.mock("expo-router", () => ({ router: { back: jest.fn(), push: jest.fn() }, useLocalSearchParams: () => ({ resume: "true" }) }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("../../src/hooks/useActivityTracking", () => ({ useActivityTracking: () => {} }));
jest.mock("../../src/contexts/AuthContext", () => ({ useSession: () => ({ isLoading: false }) }));
jest.mock("../../src/utils/store", () => ({
  useAuthStore: () => ({ apiToken: null, userData: { level: 1 } }),
  useSettingsStore: (selector: (state: object) => unknown) => selector({ autoSwitchKeyboard: false, vocabularyAudioVoice: "female" }),
}));
jest.mock("../../src/utils/theme", () => ({ useTheme: () => ({ theme: { primary: "#08f", textColor: "#111", textSecondary: "#666", textLight: "#aaa", border: "#ddd", backgroundColor: "#fff", cardBackground: "#eee", error: "#f00" } }) }));
jest.mock("../../src/utils/fonts", () => ({ fontStyles: {} }));
jest.mock("../../src/modules/KeyboardManager", () => ({ __esModule: true, default: null }));
jest.mock("../../src/modules/AudioSessionManager", () => ({ __esModule: true, default: {} }));
jest.mock("../../src/utils/expoAvCompat", () => ({ Audio: {} }));
jest.mock("../../src/services/offlineVocabularyAudioService", () => ({}));
jest.mock("../../src/utils/api", () => ({ getAllAssignmentsCached: jest.fn() }));
jest.mock("../../src/utils/cache", () => ({ getAllSubjects: jest.fn(async () => []), getSubjectById: jest.fn(async () => null) }));
jest.mock("../../src/utils/permanentStorage", () => ({}));
jest.mock("../../src/utils/crosswordHistory", () => ({}));
jest.mock("../../src/utils/extraStudySubjectLists", () => ({ parseSelectedListIds: () => [] }));
jest.mock("../../src/utils/haptics", () => ({ notificationAsync: jest.fn(), NotificationFeedbackType: { Success: "success", Error: "error" } }));
jest.mock("../../src/utils/extraStudySessionPersistence", () => ({
  EXTRA_STUDY_SESSION_STORAGE_KEYS: { CROSSWORD: "crossword" },
  loadExtraStudySessionState: jest.fn(), clearExtraStudySessionState: jest.fn(), saveExtraStudySessionState: jest.fn(),
}));

const puzzle: CrosswordPuzzle = {
  rows: 4, cols: 4,
  words: [
    { id: "size", subjectId: 1, word: "おおきさ", meaning: "Size", row: 2, col: 0, direction: "across", number: 2 },
    { id: "please", subjectId: 2, word: "ください", meaning: "Please", row: 0, col: 3, direction: "down", number: 1 },
  ],
  cells: [
    [null, null, null, { row: 0, col: 3, solution: "く", number: 1, wordIds: ["please"] }],
    [null, null, null, { row: 1, col: 3, solution: "だ", wordIds: ["please"] }],
    [{ row: 2, col: 0, solution: "お", number: 2, wordIds: ["size"] }, { row: 2, col: 1, solution: "お", wordIds: ["size"] }, { row: 2, col: 2, solution: "き", wordIds: ["size"] }, { row: 2, col: 3, solution: "さ", wordIds: ["size", "please"] }],
    [null, null, null, { row: 3, col: 3, solution: "い", wordIds: ["please"] }],
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(loadExtraStudySessionState).mockResolvedValue({
    config: { playAudioOnCorrectAnswer: false }, puzzle,
    completedWordIds: ["please"], attemptsByWordId: {}, elapsedMs: 0,
  });
});
afterEach(cleanupAsync);

it("checks the displayed grid when the final kana is supplied by a crossing", async () => {
  const view = render(<CrosswordSessionScreen />);
  const input = await view.findByLabelText("Crossword grid input");
  fireEvent.changeText(input, "ooki");
  fireEvent.press(view.getByText("Submit"));
  await waitFor(() => expect(view.getByText("Crossword Complete!")).toBeTruthy());
});

it("flushes the native Enter event's latest text before checking crossings", async () => {
  const view = render(<CrosswordSessionScreen />);
  const input = await view.findByLabelText("Crossword grid input");
  fireEvent(input, "submitEditing", { nativeEvent: { text: "おおき" } });
  await waitFor(() => expect(view.getByText("Crossword Complete!")).toBeTruthy());
});

it("rejects incomplete and overlong entries while still accepting the full word", async () => {
  const view = render(<CrosswordSessionScreen />);
  const input = await view.findByLabelText("Crossword grid input");
  fireEvent.changeText(input, "おお");
  fireEvent.press(view.getByText("Submit"));
  expect(view.queryByText("Crossword Complete!")).toBeNull();
  fireEvent.changeText(input, "おおきさあ");
  fireEvent.press(view.getByText("Submit"));
  expect(view.queryByText("Crossword Complete!")).toBeNull();
  fireEvent.changeText(input, "おおきさ");
  fireEvent.press(view.getByText("Submit"));
  await waitFor(() => expect(view.getByText("Crossword Complete!")).toBeTruthy());
});

it("edits the tapped square and keeps the other unfinished letters", async () => {
  jest.mocked(loadExtraStudySessionState).mockResolvedValueOnce({
    config: { playAudioOnCorrectAnswer: false }, puzzle, completedWordIds: ["please"],
    draftValues: { "2:0": "お", "2:1": "お", "2:2": "く" },
  });
  const view = render(<CrosswordSessionScreen />);
  const input = await view.findByLabelText("Crossword grid input");
  fireEvent.press(view.getByLabelText("Row 3, column 3"));
  fireEvent.changeText(input, "ki");
  expect(view.getByLabelText("Row 3, column 1").props.accessibilityValue.text).toBe("お");
  expect(view.getByLabelText("Row 3, column 3").props.accessibilityValue.text).toBe("き");
  fireEvent.press(view.getByText("Submit"));
  await waitFor(() => expect(view.getByText("Crossword Complete!")).toBeTruthy());
});

it("shares unfinished letters between intersecting clues", async () => {
  jest.mocked(loadExtraStudySessionState).mockResolvedValueOnce({ config: {}, puzzle, completedWordIds: [] });
  const view = render(<CrosswordSessionScreen />);
  const input = await view.findByLabelText("Crossword grid input");
  fireEvent.changeText(input, "ooki");
  fireEvent.press(view.getByText("Please"));
  expect(view.getByLabelText("Row 3, column 1").props.accessibilityValue.text).toBe("お");
  fireEvent.changeText(input, "kudasai");
  fireEvent.press(view.getByText("Size"));
  expect(view.getByLabelText("Row 3, column 4").props.accessibilityValue.text).toBe("さ");
  expect(view.getByLabelText("Row 3, column 3").props.accessibilityValue.text).toBe("き");
});

it("backspaces from an empty tapped square without erasing a completed crossing", async () => {
  jest.mocked(loadExtraStudySessionState).mockResolvedValueOnce({
    config: {}, puzzle, completedWordIds: ["please"], draftValues: { "2:0": "お", "2:1": "お" },
  });
  const view = render(<CrosswordSessionScreen />);
  const input = await view.findByLabelText("Crossword grid input");
  fireEvent.press(view.getByLabelText("Row 3, column 3"));
  fireEvent(input, "keyPress", { nativeEvent: { key: "Backspace" } });
  expect(view.getByLabelText("Row 3, column 2").props.accessibilityValue.text).toBe("Empty");
  expect(view.getByLabelText("Row 3, column 4").props.accessibilityValue.text).toBe("さ");
});
