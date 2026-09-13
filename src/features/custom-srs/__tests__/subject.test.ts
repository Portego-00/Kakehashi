import { CUSTOM_VOCABULARY_WORDS } from "../catalog";
import { customSubjectIdToWord, customVocabularySubjectId, customVocabularyWordToDetails, customWordToSubject, customWordUsesKanji } from "../subject";

describe("native custom vocabulary display adapter", () => {
  it("assigns deterministic, unique negative IDs to the complete shared catalog", () => {
    expect(CUSTOM_VOCABULARY_WORDS.length).toBeGreaterThanOrEqual(500);
    const ids = CUSTOM_VOCABULARY_WORDS.map((word) => customVocabularySubjectId(word.id));
    expect(new Set(ids).size).toBe(CUSTOM_VOCABULARY_WORDS.length);
    for (const word of CUSTOM_VOCABULARY_WORDS) {
      const id = customVocabularySubjectId(word.id);
      expect(Number.isSafeInteger(id)).toBe(true);
      expect(id).toBeLessThan(0);
      expect(customSubjectIdToWord(id)).toBe(word);
    }
    expect(customSubjectIdToWord(1)).toBeUndefined();
  });

  it("keeps kana meaning-only and preserves all mnemonic markup and examples", () => {
    const word = CUSTOM_VOCABULARY_WORDS.find((item) => item.id === "conversation-yappari")!;
    const subject = customWordToSubject(word);
    expect(subject.object).toBe("kana_vocabulary");
    expect(subject.data.readings).toEqual([]);
    expect(subject.data.reading_mnemonic).toBeNull();
    expect(subject.data.level).toBe(0);
    expect(subject.data.meaning_mnemonic).toContain("<reading>");
    expect(subject.data.meaning_mnemonic).toBe(word.meaningMnemonic);
    expect(subject.data.context_sentences).toBe(word.contextSentences);
    expect(subject.data.context_sentences!.length).toBeGreaterThanOrEqual(2);
    expect(subject.url).toBe("");
    expect(subject.data.document_url).toBe("");
    expect(subject.data.meanings.every((meaning) => meaning.accepted_answer)).toBe(true);
  });

  it("includes the reading and composition mnemonic for kanji vocabulary", () => {
    const word = CUSTOM_VOCABULARY_WORDS.find(customWordUsesKanji)!;
    const subject = customWordToSubject(word);
    expect(subject.object).toBe("vocabulary");
    expect(subject.data.readings).toEqual([{ reading: word.reading, primary: true, accepted_answer: true, type: "kunyomi" }]);
    expect(subject.data.level).toBe(word.requiredLevel);
    const details = customVocabularyWordToDetails(word);
    expect(details.readingMnemonic).toBe(word.readingMnemonic);
    expect(details.meaningMnemonic).toBe(word.meaningMnemonic);
    expect(details.contextSentences).toBe(word.contextSentences);
    expect(details).not.toHaveProperty("meaningCorrect");
    expect(details).not.toHaveProperty("readingCurrentStreak");
  });
});
