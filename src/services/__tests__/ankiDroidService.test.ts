import {
  buildAnkiDroidFields,
  exportContextSentenceToAnkiDroid,
  guessAnkiDroidFieldMappings,
  isValidAnkiDroidExportConfig,
  type AnkiDroidExportConfig,
} from "../ankiDroidService";
import AnkiDroid from "../../modules/AnkiDroid";

jest.mock("../../modules/AnkiDroid", () => ({
  __esModule: true,
  default: {
    isAvailable: jest.fn(),
    hasPermission: jest.fn(),
    requestPermission: jest.fn(),
    getFields: jest.fn(),
    addNote: jest.fn(),
  },
}));

const native = jest.mocked(AnkiDroid!);
const sentence = { japanese: "猫が好きです。", english: "I like cats." };

beforeEach(() => {
  jest.resetAllMocks();
  native.isAvailable.mockResolvedValue(true);
  native.hasPermission.mockResolvedValue(true);
  native.getFields.mockResolvedValue(["Expression", "Reading", "Meaning"]);
  native.addNote.mockResolvedValue("789");
});

const makeConfig = (
  overrides: Partial<AnkiDroidExportConfig> = {}
): AnkiDroidExportConfig => ({
  deckId: "123",
  deckName: "Sentence Mining",
  noteTypeId: "456",
  noteTypeName: "Japanese",
  fields: ["Expression", "Reading", "Meaning"],
  japaneseFieldIndex: 0,
  englishFieldIndex: 2,
  tags: ["kakehashi", "context-sentence"],
  ...overrides,
});

describe("AnkiDroid context sentence export", () => {
  it("guesses common sentence and translation field names", () => {
    expect(
      guessAnkiDroidFieldMappings(["Audio", "Japanese Sentence", "Translation"])
    ).toEqual({ japaneseFieldIndex: 1, englishFieldIndex: 2 });
  });

  it("falls back to separate first and second fields", () => {
    expect(guessAnkiDroidFieldMappings(["Prompt", "Response"])).toEqual({
      japaneseFieldIndex: 0,
      englishFieldIndex: 1,
    });
  });

  it("places sentence data in the configured fields and leaves others blank", () => {
    expect(
      buildAnkiDroidFields(makeConfig(), {
        japanese: "  猫が好きです。 ",
        english: " I like cats. ",
      })
    ).toEqual(["猫が好きです。", "", "I like cats."]);
  });

  it("rejects configurations that map both values to the same field", () => {
    expect(
      isValidAnkiDroidExportConfig(makeConfig({ englishFieldIndex: 0 }))
    ).toBe(false);
  });

  it("preserves literal text and line breaks in Anki's HTML fields", async () => {
    await exportContextSentenceToAnkiDroid(makeConfig(), {
      japanese: "猫 < 犬",
      english: 'Cats & dogs\n"Hi"',
    });
    expect(native.addNote).toHaveBeenCalledWith(
      "123", "456", ["猫 &lt; 犬", "", "Cats &amp; dogs<br>&quot;Hi&quot;"],
      ["kakehashi", "context-sentence"]
    );
  });

  it("exports the configured fields, deck, note type, and tags", async () => {
    await expect(exportContextSentenceToAnkiDroid(makeConfig(), sentence)).resolves.toBe("789");
    expect(native.addNote).toHaveBeenCalledWith(
      "123", "456", [sentence.japanese, "", sentence.english],
      ["kakehashi", "context-sentence"]
    );
  });

  it.each([
    ["Meaning", "Reading", "Expression"],
    ["Expression", "Meaning"],
    ["Sentence", "Reading", "Meaning"],
  ])("requires setup again when fields change to %j", async (...fields) => {
    native.getFields.mockResolvedValue(fields);
    await expect(exportContextSentenceToAnkiDroid(makeConfig(), sentence)).rejects.toMatchObject({ code: "FIELDS_CHANGED" });
    expect(native.addNote).not.toHaveBeenCalled();
  });

  it("requests permission and exports after access is granted", async () => {
    native.hasPermission.mockResolvedValue(false);
    native.requestPermission.mockResolvedValue(true);
    await exportContextSentenceToAnkiDroid(makeConfig(), sentence);
    expect(native.requestPermission).toHaveBeenCalledTimes(1);
    expect(native.addNote).toHaveBeenCalledTimes(1);
  });

  it("does not write a note when permission is denied", async () => {
    native.hasPermission.mockResolvedValue(false);
    native.requestPermission.mockResolvedValue(false);
    await expect(exportContextSentenceToAnkiDroid(makeConfig(), sentence)).rejects.toThrow("Allow Kakehashi access");
    expect(native.addNote).not.toHaveBeenCalled();
  });

  it("explains when AnkiDroid is not installed", async () => {
    native.isAvailable.mockResolvedValue(false);
    await expect(exportContextSentenceToAnkiDroid(makeConfig(), sentence)).rejects.toThrow("Install AnkiDroid");
    expect(native.addNote).not.toHaveBeenCalled();
  });

  it("rejects invalid data before requesting native access", async () => {
    await expect(exportContextSentenceToAnkiDroid(makeConfig(), { ...sentence, english: " " })).rejects.toThrow("Both the Japanese sentence and translation");
    await expect(exportContextSentenceToAnkiDroid(makeConfig({ englishFieldIndex: 0 }), sentence)).rejects.toThrow("Invalid AnkiDroid export configuration");
    expect(native.isAvailable).not.toHaveBeenCalled();
    expect(native.addNote).not.toHaveBeenCalled();
  });
});
