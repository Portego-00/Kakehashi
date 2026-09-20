import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PersonalVocabularyImport } from "./PersonalVocabularyImport";
import { PersonalWordEditor } from "./PersonalWordEditor";
const deckId = "personal:11111111-1111-4111-8111-111111111111";
describe("personal vocabulary editing", () => {
  it("previews duplicates and retries an import with identical word and event IDs", async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error("Connection lost")).mockResolvedValue(undefined);
    render(<PersonalVocabularyImport deckId={deckId} revision={2} existing={[]} onSave={onSave} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText("Vocabulary CSV or TSV text"), { target: { value: "characters,reading,meanings\n猫,ねこ,cat\n猫,ねこ,cat\n犬,いぬ,dog" } });
    expect(screen.getByRole("status")).toHaveTextContent("2 ready · 1 duplicates skipped");
    fireEvent.click(screen.getByRole("button", { name: "Import 2 words" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Connection lost"));
    fireEvent.click(screen.getByRole("button", { name: "Import 2 words" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave.mock.calls[0]).toEqual(onSave.mock.calls[1]);
    expect(onSave.mock.calls[0][0]).toHaveLength(2);
  });
  it("blocks invalid rows and stale import previews", () => {
    const props = { deckId, revision: 2, existing: [], onSave: vi.fn(), onCancel: vi.fn() };
    const { rerender } = render(<PersonalVocabularyImport {...props} />);
    fireEvent.change(screen.getByLabelText("Vocabulary CSV or TSV text"), { target: { value: "characters,reading,meanings\n猫,,cat" } });
    expect(screen.getByRole("button", { name: /Import .* words/ })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Vocabulary CSV or TSV text"), { target: { value: "characters,reading,meanings\n猫,ねこ,cat" } });
    expect(screen.getByRole("button", { name: "Import 1 words" })).toBeEnabled();
    rerender(<PersonalVocabularyImport {...props} revision={3} />);
    expect(screen.getByRole("button", { name: "Import 1 words" })).toBeDisabled();
  });
  it("creates a kana word with multiple accepted answers and keeps failed edits", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("Offline"));
    render(<PersonalWordEditor deckId={deckId} revision={4} onSave={onSave} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText("Japanese spelling"), { target: { value: "ありがとう" } });
    fireEvent.change(screen.getByLabelText(/^Accepted meanings/), { target: { value: "thanks | thank you" } });
    fireEvent.click(screen.getByRole("button", { name: "Save word" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Offline"));
    expect(onSave.mock.calls[0][0][0]).toMatchObject({ action: "create_word", deckId, word: { reading: "ありがとう", meanings: ["thanks", "thank you"] } });
    expect(screen.getByLabelText("Japanese spelling")).toHaveValue("ありがとう");
  });
});
