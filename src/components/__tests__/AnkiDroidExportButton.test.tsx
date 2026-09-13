import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert, Platform, ToastAndroid } from "react-native";
import { AnkiDroidExportButton } from "../AnkiDroidExportButton";
import { useSettingsStore } from "../../utils/store";
import {
  exportContextSentenceToAnkiDroid,
  loadAnkiDroidExportConfig,
  loadAnkiDroidFields,
  loadAnkiDroidSetupData,
  saveAnkiDroidExportConfig,
  type AnkiDroidExportConfig,
} from "../../services/ankiDroidService";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("../../utils/store", () => ({ useSettingsStore: jest.fn() }));
jest.mock("@react-native-picker/picker", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { Picker: Object.assign(View, { Item: () => null }) };
});
jest.mock("../../utils/theme", () => ({
  useTheme: () => ({ theme: { primary: "#9c38d9", textColor: "#111", textSecondary: "#555", cardBackground: "#fff", backgroundColor: "#fff", border: "#ddd" } }),
}));
jest.mock("../../services/ankiDroidService", () => ({
  exportContextSentenceToAnkiDroid: jest.fn(),
  loadAnkiDroidExportConfig: jest.fn(),
  loadAnkiDroidFields: jest.fn(),
  loadAnkiDroidSetupData: jest.fn(),
  saveAnkiDroidExportConfig: jest.fn(),
  guessAnkiDroidFieldMappings: () => ({ japaneseFieldIndex: 0, englishFieldIndex: 1 }),
}));

const config: AnkiDroidExportConfig = {
  deckId: "123", deckName: "Sentences", noteTypeId: "456", noteTypeName: "Basic",
  fields: ["Front", "Back"], japaneseFieldIndex: 0, englishFieldIndex: 1, tags: [],
};
const originalPlatform = Platform.OS;

beforeEach(() => {
  jest.resetAllMocks();
  Platform.OS = "android";
  jest.mocked(useSettingsStore).mockReturnValue(true);
  jest.spyOn(ToastAndroid, "show").mockImplementation(() => {});
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  jest.mocked(loadAnkiDroidExportConfig).mockResolvedValue(config);
  jest.mocked(loadAnkiDroidSetupData).mockResolvedValue({ decks: [{ id: config.deckId, name: config.deckName }], noteTypes: [{ id: config.noteTypeId, name: config.noteTypeName }] });
  jest.mocked(loadAnkiDroidFields).mockResolvedValue(config.fields);
  jest.mocked(exportContextSentenceToAnkiDroid).mockResolvedValue("789");
  jest.mocked(saveAnkiDroidExportConfig).mockResolvedValue();
});

afterEach(() => {
  Platform.OS = originalPlatform;
  jest.restoreAllMocks();
});

it("hides export until it is enabled in settings", () => {
  jest.mocked(useSettingsStore).mockReturnValue(false);
  const screen = render(<AnkiDroidExportButton japanese="猫です。" english="A cat." />);
  expect(screen.toJSON()).toBeNull();
  expect(loadAnkiDroidExportConfig).not.toHaveBeenCalled();
});

it("allows exporting the next sentence when the same row is reused", async () => {
  const screen = render(<AnkiDroidExportButton japanese="猫です。" english="A cat." />);
  fireEvent.press(screen.getByLabelText("Add sentence to AnkiDroid"));
  await waitFor(() => expect(screen.getByLabelText("Sentence added to AnkiDroid")).toBeTruthy());
  screen.rerender(<AnkiDroidExportButton japanese="犬です。" english="A dog." />);
  fireEvent.press(screen.getByLabelText("Add sentence to AnkiDroid"));
  await waitFor(() => expect(exportContextSentenceToAnkiDroid).toHaveBeenLastCalledWith(config, { japanese: "犬です。", english: "A dog." }));
  await waitFor(() => expect(screen.getByLabelText("Sentence added to AnkiDroid")).toBeTruthy());
});

it("does not mark a new sentence exported when an older export finishes", async () => {
  let finishExport!: (noteId: string) => void;
  jest.mocked(exportContextSentenceToAnkiDroid).mockReturnValueOnce(new Promise((resolve) => { finishExport = resolve; }));
  const screen = render(<AnkiDroidExportButton japanese="猫です。" english="A cat." />);
  fireEvent.press(screen.getByLabelText("Add sentence to AnkiDroid"));
  await waitFor(() => expect(exportContextSentenceToAnkiDroid).toHaveBeenCalledTimes(1));
  screen.rerender(<AnkiDroidExportButton japanese="犬です。" english="A dog." />);
  await act(async () => finishExport("789"));
  expect(screen.queryByLabelText("Sentence added to AnkiDroid")).toBeNull();
  fireEvent.press(screen.getByLabelText("Add sentence to AnkiDroid"));
  await waitFor(() => expect(exportContextSentenceToAnkiDroid).toHaveBeenCalledTimes(2));
});

it("reopens setup when the saved field mapping is stale", async () => {
  jest.mocked(exportContextSentenceToAnkiDroid).mockRejectedValueOnce(Object.assign(new Error("Fields changed"), { code: "FIELDS_CHANGED" }));
  const screen = render(<AnkiDroidExportButton japanese="猫です。" english="A cat." />);
  fireEvent.press(screen.getByLabelText("Add sentence to AnkiDroid"));
  await waitFor(() => expect(screen.getByText("Japanese sentence field")).toBeTruthy());
  expect(Alert.alert).not.toHaveBeenCalled();
});

it("keeps setup open after a failed export and allows retrying", async () => {
  jest.mocked(loadAnkiDroidExportConfig).mockResolvedValue(null);
  jest.mocked(exportContextSentenceToAnkiDroid).mockRejectedValueOnce(new Error("AnkiDroid is busy"));
  const screen = render(<AnkiDroidExportButton japanese="猫です。" english="A cat." />);
  fireEvent.press(screen.getByLabelText("Add sentence to AnkiDroid"));
  await waitFor(() => expect(screen.getByRole("button", { name: "Save", disabled: false })).toBeTruthy());
  fireEvent.press(screen.getByText("Save"));
  await waitFor(() => expect(screen.getByText("AnkiDroid is busy")).toBeTruthy());
  fireEvent.press(screen.getByText("Save"));
  await waitFor(() => expect(screen.getByLabelText("Sentence added to AnkiDroid")).toBeTruthy());
  expect(exportContextSentenceToAnkiDroid).toHaveBeenCalledTimes(2);
});

it.each(["ios", "web"] as const)("hides Android export on %s", (platform) => {
  Platform.OS = platform;
  const screen = render(<AnkiDroidExportButton japanese="猫です。" english="A cat." />);
  expect(screen.toJSON()).toBeNull();
  expect(loadAnkiDroidExportConfig).not.toHaveBeenCalled();
});
