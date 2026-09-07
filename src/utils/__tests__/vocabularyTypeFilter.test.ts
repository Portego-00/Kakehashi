import {
  getVocabularyTypeOptions,
  matchesVocabularyTypes,
  normalizeVocabularyTypes,
} from "../vocabularyTypeFilter";

const subject = (object: string, parts?: string[] | null) => ({
  object,
  data: { parts_of_speech: parts },
});

describe("vocabulary type filters", () => {
  it("keeps all subject types when no vocabulary type is selected", () => {
    expect(matchesVocabularyTypes(subject("kanji"), [])).toBe(true);
    expect(matchesVocabularyTypes(subject("vocabulary", null), [])).toBe(true);
  });

  it("matches any selected type, including kana vocabulary and multiple tags", () => {
    expect(matchesVocabularyTypes(subject("vocabulary", ["noun", "verbal noun"]), ["proper noun", "verbal noun"])).toBe(true);
    expect(matchesVocabularyTypes(subject("kana_vocabulary", ["Proper Noun"]), ["proper noun"])).toBe(true);
  });

  it("distinguishes nouns from their subtypes and excludes missing metadata", () => {
    expect(matchesVocabularyTypes(subject("vocabulary", ["noun"]), ["proper noun"])).toBe(false);
    expect(matchesVocabularyTypes(subject("vocabulary", ["verbal noun"]), ["noun"])).toBe(false);
    expect(matchesVocabularyTypes(subject("vocabulary", null), ["noun"])).toBe(false);
    expect(matchesVocabularyTypes(subject("kanji", ["noun"]), ["noun"])).toBe(false);
  });

  it("normalizes case, whitespace, empty values, and duplicates", () => {
    expect(normalizeVocabularyTypes([" Verbal  Noun ", "verbal noun", "", " Proper noun "])).toEqual(["verbal noun", "proper noun"]);
    expect(matchesVocabularyTypes(subject("vocabulary", [" Verbal  Noun "]), ["VERBAL NOUN"])).toBe(true);
  });

  it("derives options from the catalog while retaining unavailable selections", () => {
    expect(getVocabularyTypeOptions([
      subject("vocabulary", ["Noun", "noun", " Verbal  Noun "]),
      subject("kana_vocabulary", ["expression"]),
      subject("kanji", ["ignored"]),
    ], ["proper noun"])).toEqual([
      { value: "expression", label: "Expression" },
      { value: "noun", label: "Noun" },
      { value: "proper noun", label: "Proper noun" },
      { value: "verbal noun", label: "Verbal noun" },
    ]);
    expect(getVocabularyTypeOptions().map((option) => option.value)).toEqual(expect.arrayContaining(["verbal noun", "proper noun"]));
  });
});
