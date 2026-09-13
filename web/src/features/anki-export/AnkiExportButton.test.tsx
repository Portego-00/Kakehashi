import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import { AnkiExportButton, AnkiExportSettingsButton } from "./AnkiExportButton";
import { setAnkiExportEnabled } from "./settings";
import { connectToAnki, exportSentenceToAnki, loadAnkiExportConfig, loadAnkiFields, saveAnkiExportConfig, type AnkiExportConfig } from "./client";

vi.mock("./client", async (importOriginal) => ({
  ...await importOriginal<typeof import("./client")>(),
  connectToAnki: vi.fn(), exportSentenceToAnki: vi.fn(), loadAnkiExportConfig: vi.fn(),
  loadAnkiFields: vi.fn(), saveAnkiExportConfig: vi.fn(), getAnkiApiKey: () => "",
}));
const config: AnkiExportConfig = { deckName: "Sentences", modelName: "Japanese", japaneseField: "Expression", englishField: "Meaning", tags: [] };

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  setAnkiExportEnabled(true);
  vi.mocked(loadAnkiExportConfig).mockReturnValue(null);
  vi.mocked(connectToAnki).mockResolvedValue({ decks: ["Default", "Sentences"], models: ["Basic", "Japanese"] });
  vi.mocked(loadAnkiFields).mockResolvedValue(["Expression", "Audio", "Meaning"]);
  vi.mocked(exportSentenceToAnki).mockResolvedValue(12345);
});

describe("web Anki export", () => {
  it("is hidden by default and follows the settings switch immediately", () => {
    localStorage.clear();
    render(<><AnkiExportSettingsButton /><AnkiExportButton japanese="猫です。" english="A cat." /></>);
    const toggle = screen.getByRole("checkbox", { name: /Enable Anki export/u });
    expect(toggle).not.toBeChecked();
    expect(screen.queryByRole("button", { name: "Add sentence to Anki" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Configure Anki export" })).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Add sentence to Anki" })).toBeEnabled();
    fireEvent.click(toggle);
    expect(screen.queryByRole("button", { name: "Add sentence to Anki" })).not.toBeInTheDocument();
    expect(connectToAnki).not.toHaveBeenCalled();
  });
  it("only connects on request, saves the selected deck and fields, and exports the sentence", async () => {
    render(<StrictMode><AnkiExportButton japanese="猫です。" english="A cat." /></StrictMode>);
    expect(connectToAnki).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Add sentence to Anki" }));
    const dialog = screen.getByRole("dialog", { name: "Add sentence to Anki" });
    expect(connectToAnki).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Connect to Anki" }));
    await screen.findByRole("combobox", { name: "Japanese sentence field" });
    fireEvent.change(screen.getByRole("combobox", { name: "Deck" }), { target: { value: "Sentences" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Note type" }), { target: { value: "Japanese" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Save and add sentence" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Save and add sentence" }));
    await screen.findByRole("button", { name: "Sentence added to Anki" });
    expect(saveAnkiExportConfig).toHaveBeenCalledWith({ ...config, tags: ["kakehashi", "context-sentence"] });
    expect(exportSentenceToAnki).toHaveBeenCalledWith({ ...config, tags: ["kakehashi", "context-sentence"] }, { japanese: "猫です。", english: "A cat." });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the dialog open on an export failure and permits a retry", async () => {
    vi.mocked(exportSentenceToAnki).mockRejectedValueOnce(new Error("Anki is busy"));
    render(<AnkiExportButton japanese="猫です。" english="A cat." />);
    fireEvent.click(screen.getByRole("button", { name: "Add sentence to Anki" }));
    fireEvent.click(screen.getByRole("button", { name: "Connect to Anki" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save and add sentence" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Save and add sentence" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Anki is busy");
    fireEvent.click(screen.getByRole("button", { name: "Save and add sentence" }));
    await screen.findByRole("button", { name: "Sentence added to Anki" });
  });

  it("discards stale field responses after changing note types", async () => {
    let finishBasic!: (fields: string[]) => void;
    vi.mocked(loadAnkiFields).mockImplementation((name) => name === "Basic"
      ? new Promise((resolve) => { finishBasic = resolve; }) : Promise.resolve(["Japanese", "English"]));
    render(<AnkiExportSettingsButton />);
    fireEvent.click(screen.getByRole("button", { name: "Configure Anki export" }));
    fireEvent.click(screen.getByRole("button", { name: "Connect to Anki" }));
    await screen.findByRole("combobox", { name: "Note type" });
    fireEvent.change(screen.getByRole("combobox", { name: "Note type" }), { target: { value: "Japanese" } });
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Japanese sentence field" })).toHaveValue("Japanese"));
    await act(async () => finishBasic(["Front", "Back"]));
    expect(screen.getByRole("combobox", { name: "Japanese sentence field" })).toHaveValue("Japanese");
  });

  it("prevents mapping both values to the same field", async () => {
    render(<AnkiExportSettingsButton />);
    fireEvent.click(screen.getByRole("button", { name: "Configure Anki export" }));
    fireEvent.click(screen.getByRole("button", { name: "Connect to Anki" }));
    await screen.findByRole("combobox", { name: "English translation field" });
    fireEvent.change(screen.getByRole("combobox", { name: "English translation field" }), { target: { value: "Expression" } });
    expect(screen.getByRole("button", { name: "Save settings" })).toBeDisabled();
  });

  it("keeps a late export result attached to the original sentence", async () => {
    vi.mocked(loadAnkiExportConfig).mockReturnValue(config);
    let finish!: (id: number) => void;
    vi.mocked(exportSentenceToAnki).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const view = render(<AnkiExportButton japanese="猫です。" english="A cat." />);
    fireEvent.click(screen.getByRole("button", { name: "Add sentence to Anki" }));
    view.rerender(<AnkiExportButton japanese="犬です。" english="A dog." />);
    await act(async () => finish(12345));
    expect(screen.getByRole("button", { name: "Add sentence to Anki" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Add sentence to Anki" }));
    await screen.findByRole("button", { name: "Sentence added to Anki" });
    expect(exportSentenceToAnki).toHaveBeenLastCalledWith(config, { japanese: "犬です。", english: "A dog." });
  });
});
