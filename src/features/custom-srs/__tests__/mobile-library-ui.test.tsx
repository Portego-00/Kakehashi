import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { File } from "expo-file-system";
import { createCustomSrsState } from "../../../../web/src/features/custom-srs/model";
import PersonalLibraryScreen from "../personal-library-screen";
import SchedulingSettingsScreen from "../scheduling-settings-screen";
import { VocabularyImportForm } from "../vocabulary-import-form";
import type { PersonalLibrary } from "../personal-library";

const deckId = "personal:11111111-1111-4111-8111-111111111111";
const wordId = "personal:22222222-2222-4222-8222-222222222222";
const word = { characters: "橋", reading: "はし", meanings: ["bridge"], partsOfSpeech: ["noun"], meaningMnemonic: "", contextSentences: [] };
const library: PersonalLibrary = { revision: 2, entries: {
  [deckId]: { id: deckId, kind: "deck", deckId: null, revision: 1, data: { title: "My reading" } },
  [wordId]: { id: wordId, kind: "word", deckId, revision: 2, data: { word, archived: false } },
} };
let mockId = 0;
let mockSrs: any;
jest.mock("expo-crypto", () => ({ randomUUID: () => `33333333-3333-4333-8333-${String(++mockId).padStart(12, "0")}` }));
jest.mock("expo-file-system", () => ({ File: { pickFileAsync: jest.fn() } }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), canGoBack: () => true, back: jest.fn() }, Stack: { Screen: () => null }, useLocalSearchParams: () => ({}) }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@react-native-picker/picker", () => {
  const React = jest.requireActual("react");
  const Picker = (props: any) => React.createElement("Picker", props, props.children);
  Picker.Item = function PickerItem(props: any) { return React.createElement("PickerItem", props); };
  return { Picker };
});
jest.mock("@react-native-segmented-control/segmented-control", () => "SegmentedControl");
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }) }));
jest.mock("../../../utils/theme", () => ({ useTheme: () => ({ theme: { isDark: true, backgroundColor: "#000", primary: "#936", textColor: "white", textSecondary: "gray", border: "#333", cardBackground: "#111", error: "red", headerBackground: "#111", headerText: "white" } }) }));
jest.mock("../data", () => ({ useCustomSrs: () => mockSrs }));
beforeEach(() => {
  jest.clearAllMocks(); mockId = 0;
  mockSrs = { accountId: "one", library, state: createCustomSrsState(), loading: false, syncing: false, error: null, pendingCount: 0, refresh: jest.fn().mockResolvedValue(null), saveSettings: jest.fn().mockResolvedValue(null), saveLibrary: jest.fn().mockResolvedValue({ revision: 3, added: 0, skipped: 0, changed: 1 }) };
});

it("edits and archives a web-imported word while preserving its identity and library revision", async () => {
  const screen = render(<PersonalLibraryScreen />);
  expect(screen.getByText("橋")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Edit 橋"));
  fireEvent.changeText(screen.getByLabelText("Accepted meanings"), "bridge | overpass");
  fireEvent.press(screen.getByLabelText("Save word"));
  await waitFor(() => expect(mockSrs.saveLibrary).toHaveBeenCalled());
  expect(mockSrs.saveLibrary.mock.calls[0][0][0]).toMatchObject({ action: "edit_word", id: wordId, word: { meanings: ["bridge", "overpass"] } });
  expect(mockSrs.saveLibrary.mock.calls[0][1]).toBe(2);
  await waitFor(() => expect(screen.getByLabelText("Archive 橋")).toBeTruthy());
  fireEvent.press(screen.getByLabelText("Archive 橋"));
  await waitFor(() => expect(mockSrs.saveLibrary).toHaveBeenCalledTimes(2));
  expect(mockSrs.saveLibrary.mock.calls[1][0]).toEqual([{ action: "archive_word", id: wordId, archived: true }]);
});

it("creates a personal deck without changing the account access gate", async () => {
  const screen = render(<PersonalLibraryScreen />);
  fireEvent.press(screen.getByLabelText("New deck"));
  fireEvent.changeText(screen.getByLabelText("Deck name"), "Book vocabulary");
  fireEvent.press(screen.getByLabelText("Save deck"));
  await waitFor(() => expect(mockSrs.saveLibrary).toHaveBeenCalled());
  expect(mockSrs.saveLibrary.mock.calls[0][0][0]).toMatchObject({ action: "create_deck", title: "Book vocabulary" });
});

it("retries archive operations with the same ID after a lost response", async () => {
  mockSrs.saveLibrary.mockRejectedValueOnce(new Error("Offline"));
  const screen = render(<PersonalLibraryScreen />);
  fireEvent.press(screen.getByLabelText("Archive 橋"));
  await waitFor(() => expect(screen.getByText("Offline")).toBeTruthy());
  fireEvent.press(screen.getByLabelText("Archive 橋"));
  await waitFor(() => expect(mockSrs.saveLibrary).toHaveBeenCalledTimes(2));
  expect(mockSrs.saveLibrary.mock.calls[0]).toEqual(mockSrs.saveLibrary.mock.calls[1]);
});

it("retains a failed scheduling draft and reuses the event ID on retry", async () => {
  mockSrs.saveSettings.mockRejectedValueOnce(new Error("Offline"));
  const screen = render(<SchedulingSettingsScreen />);
  fireEvent.changeText(screen.getByLabelText("Apprentice I interval"), "10m");
  fireEvent.press(screen.getByLabelText("Save schedule"));
  await waitFor(() => expect(screen.getByText("Offline")).toBeTruthy());
  expect(screen.getByLabelText("Apprentice I interval").props.value).toBe("10m");
  fireEvent.press(screen.getByLabelText("Save schedule"));
  await waitFor(() => expect(mockSrs.saveSettings).toHaveBeenCalledTimes(2));
  expect(mockSrs.saveSettings.mock.calls[0]).toEqual(mockSrs.saveSettings.mock.calls[1]);
  expect(mockSrs.saveSettings.mock.calls[0][0].stageIntervals[0]).toBe(10);
});

it("validates adaptive settings and blocks scheduling changes while answers are pending", async () => {
  const screen = render(<SchedulingSettingsScreen />);
  fireEvent(screen.UNSAFE_getByType("SegmentedControl" as never), "change", { nativeEvent: { selectedSegmentIndex: 1 } });
  fireEvent.changeText(screen.getByLabelText("Target retention (%)"), "95");
  fireEvent.press(screen.getByLabelText("Save schedule"));
  await waitFor(() => expect(mockSrs.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ mode: "fsrs", requestRetention: 0.95 }), 0, expect.any(String)));
  mockSrs.pendingCount = 1;
  screen.rerender(<SchedulingSettingsScreen />);
  fireEvent.press(screen.getByLabelText("Use WaniKani defaults"));
  fireEvent.press(screen.getByLabelText("Save schedule"));
  expect(mockSrs.saveSettings).toHaveBeenCalledTimes(1);
});

it("previews duplicates and keeps identical import IDs after a lost response", async () => {
  const save = jest.fn().mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(null);
  const screen = render(<VocabularyImportForm deckId={deckId} revision={2} existing={[word]} blocked={false} onSave={save} onCancel={jest.fn()} />);
  fireEvent.changeText(screen.getByLabelText("Vocabulary CSV or TSV text"), "characters,reading,meanings\n橋,はし,bridge\n道,みち,road | path");
  expect(screen.getByText("1 ready · 1 duplicates skipped · 0 rows need fixing")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Import 1 words"));
  await waitFor(() => expect(screen.getByText("Offline")).toBeTruthy());
  fireEvent.press(screen.getByLabelText("Import 1 words"));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[0]).toEqual(save.mock.calls[1]);
  expect(save.mock.calls[0][0][0].word.meanings).toEqual(["road", "path"]);
});

it("imports a picked TSV file and rejects invalid rows before sending anything", async () => {
  jest.mocked(File.pickFileAsync).mockResolvedValue({ name: "words.tsv", size: 80, text: async () => "characters\treading\tmeanings\n橋\t\tbridge" } as File);
  const save = jest.fn();
  const screen = render(<VocabularyImportForm deckId={deckId} revision={2} existing={[]} blocked={false} onSave={save} onCancel={jest.fn()} />);
  fireEvent.press(screen.getByLabelText("Choose CSV / TSV file"));
  await waitFor(() => expect(screen.getByText("0 ready · 0 duplicates skipped · 1 rows need fixing")).toBeTruthy());
  fireEvent.press(screen.getByLabelText("Import 0 words"));
  expect(save).not.toHaveBeenCalled();
});
