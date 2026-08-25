import {
  buildAnkiDroidFields,
  guessAnkiDroidFieldMappings,
  isValidAnkiDroidExportConfig,
  type AnkiDroidExportConfig,
} from "../ankiDroidService";

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
});
