import { beforeEach, describe, expect, it, vi } from "vitest";
import { connectToAnki, exportSentenceToAnki, loadAnkiExportConfig, saveAnkiExportConfig, type AnkiExportConfig } from "./client";

const config: AnkiExportConfig = { deckName: "Sentences", modelName: "Japanese", japaneseField: "Expression", englishField: "Meaning", tags: ["kakehashi"] };
const sentence = { japanese: "猫です。", english: "A cat." };
const requests: { action: string; key?: string; params: Record<string, unknown> }[] = [];
let results: Record<string, unknown>;
let errors: Record<string, string>;

beforeEach(() => {
  localStorage.clear(); requests.length = 0; errors = {};
  results = { requestPermission: { permission: "granted", requireApiKey: false }, deckNames: ["Sentences"], modelNames: ["Japanese"], modelFieldNames: ["Expression", "Audio", "Meaning"], addNote: 12345 };
  vi.stubGlobal("fetch", vi.fn(async (url: string, options: RequestInit) => {
    expect(url).toBe("http://127.0.0.1:8765");
    expect(options.credentials).toBe("omit");
    const request = JSON.parse(String(options.body));
    expect(request.version).toBe(6);
    requests.push(request);
    return new Response(JSON.stringify({ result: results[request.action], error: errors[request.action] ?? null }));
  }));
});

describe("AnkiConnect sentence export", () => {
  it("asks permission before loading the collection and sends a configured API key only to AnkiConnect", async () => {
    results.requestPermission = { permission: "granted", requireApiKey: true };
    expect(await connectToAnki("local-key")).toEqual({ decks: ["Sentences"], models: ["Japanese"] });
    expect(requests.map((request) => request.action)).toEqual(["requestPermission", "deckNames", "modelNames"]);
    expect(requests[0].key).toBeUndefined();
    expect(requests[1].key).toBe("local-key");
    expect(localStorage.length).toBe(0);
  });

  it("does not load decks or add notes after access is denied", async () => {
    results.requestPermission = { permission: "denied" };
    await expect(connectToAnki("")).rejects.toThrow("Allow Kakehashi");
    expect(requests).toHaveLength(1);
  });

  it("asks for the API key when AnkiConnect requires one", async () => {
    results.requestPermission = { permission: "granted", requireApiKey: true };
    await expect(connectToAnki("")).rejects.toThrow("Enter the API key");
    expect(requests).toHaveLength(1);
  });

  it("adds Japanese and English to the chosen named fields, escapes HTML, and leaves other fields blank", async () => {
    await connectToAnki("");
    await expect(exportSentenceToAnki(config, { japanese: "猫 < 犬", english: 'Cats & dogs\n"Hi"' })).resolves.toBe(12345);
    expect(requests.at(-1)).toMatchObject({ action: "addNote", params: { note: {
      deckName: "Sentences", modelName: "Japanese", tags: ["kakehashi"],
      fields: { Expression: "猫 &lt; 犬", Audio: "", Meaning: "Cats &amp; dogs<br>&quot;Hi&quot;" },
      options: { allowDuplicate: false, duplicateScope: "deck" },
    } } });
  });

  it("preserves mapping by name when Anki reorders the fields", async () => {
    results.modelFieldNames = ["Meaning", "Audio", "Expression"];
    await exportSentenceToAnki(config, sentence);
    expect(requests.at(-1)?.params).toMatchObject({ note: { fields: { Expression: sentence.japanese, Meaning: sentence.english } } });
  });

  it("rejects a missing field before writing a note", async () => {
    results.modelFieldNames = ["Front", "Back"];
    await expect(exportSentenceToAnki(config, sentence)).rejects.toThrow("fields have changed");
    expect(requests.some((request) => request.action === "addNote")).toBe(false);
  });

  it("reports duplicate and unavailable-Anki errors without retrying writes", async () => {
    errors.addNote = "cannot create note because it is a duplicate";
    await expect(exportSentenceToAnki(config, sentence)).rejects.toThrow("duplicate");
    expect(requests.filter((request) => request.action === "addNote")).toHaveLength(1);
    vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(connectToAnki("")).rejects.toThrow("Open desktop Anki");
  });

  it("does not claim success for a null addNote result", async () => {
    results.addNote = null;
    await expect(exportSentenceToAnki(config, sentence)).rejects.toThrow("did not confirm");
  });

  it("validates saved settings and persists only deck, note type, fields, and tags", () => {
    saveAnkiExportConfig(config);
    expect(loadAnkiExportConfig()).toEqual(config);
    expect(() => saveAnkiExportConfig({ ...config, englishField: config.japaneseField })).toThrow();
    localStorage.setItem("kakehashi:anki-export:v1", "corrupt");
    expect(loadAnkiExportConfig()).toBeNull();
  });
});
