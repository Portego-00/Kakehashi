import { describe, expect, it } from "vitest";
import type { Assignment, Subject } from "@/types/wanikani";
import { annotateJpdbTokens, calculateKnownKanjiPercentage, collectJapaneseTerms, containsJapanese, normalizeLookupTerm, passedKanjiCharacters, readerPieces, segmentJapaneseText, srsStageLabel } from "../annotation";

function subject(id: number, object: Subject["object"], characters: string, meaning: string, reading = ""): Subject {
  return { id, object, url: "", data_updated_at: "", data: { level: 3, created_at: "", slug: characters, document_url: "", hidden_at: null, characters, meanings: [{ meaning, primary: true, accepted_answer: true }], auxiliary_meanings: [], readings: reading ? [{ reading, primary: true, accepted_answer: true }] : [] } };
}

function assignment(subjectId: number, subjectType: Assignment["data"]["subject_type"], srsStage: number): Assignment {
  return { id: subjectId + 100, object: "assignment", url: "", data_updated_at: "", data: { subject_id: subjectId, subject_type: subjectType, srs_stage: srsStage, available_at: null, started_at: "2026-01-01T00:00:00Z", unlocked_at: "2026-01-01T00:00:00Z", passed_at: srsStage >= 5 ? "2026-02-01T00:00:00Z" : null, burned_at: null, resurrected_at: null, hidden: false, created_at: "" } };
}

describe("Japanese annotation", () => {
  it("marks Japanese word-like segments without turning punctuation into lookups", () => {
    const segments = segmentJapaneseText("今日は、Tokyoへ行きます。\nまた明日！");
    expect(segments.map((segment) => segment.text).join("")).toBe("今日は、Tokyoへ行きます。\nまた明日！");
    expect(segments.some((segment) => segment.japanese && segment.wordLike)).toBe(true);
    expect(segments.filter((segment) => segment.text === "、").every((segment) => !segment.wordLike)).toBe(true);
  });

  it("normalizes lookup terms and preserves a unique study list", () => {
    expect(normalizeLookupTerm("「 学校。 」")).toBe("学校");
    const terms = collectJapaneseTerms("学校へ行きます。学校で日本語を勉強します。");
    expect(terms.length).toBeGreaterThan(2);
    expect(new Set(terms).size).toBe(terms.length);
  });

  it("distinguishes Japanese from Latin-only text", () => {
    expect(containsJapanese("日本語 lesson")).toBe(true);
    expect(containsJapanese("English only")).toBe(false);
  });

  it("matches the native Guru+ known-kanji percentage", () => {
    const subjects = [subject(1, "kanji", "学", "Study"), subject(2, "kanji", "校", "School")];
    const known = passedKanjiCharacters(subjects, [assignment(1, "kanji", 5), assignment(2, "kanji", 4)]);
    expect([...known]).toEqual(["学"]);
    expect(calculateKnownKanjiPercentage("学校で学ぶ", known)).toBe(50);
    expect(calculateKnownKanjiPercentage("かなだけ", known)).toBe(100);
  });

  it("maps JPDB dictionary forms to WaniKani subjects and actual passed state", () => {
    const subjects = [subject(10, "vocabulary", "学校", "School", "がっこう"), subject(11, "vocabulary", "行く", "To Go", "いく")];
    const tokens = [
      { start: 0, end: 2, surface: "学校", spelling: "学校", reading: "がっこう", meaning: "school", meanings: ["school", "academy"], alternativeSpellings: ["學校"], partsOfSpeech: ["n"], tokenType: "vocabulary" as const },
      { start: 3, end: 6, surface: "行った", spelling: "行く", reading: "いく", meaning: "to go", meanings: ["to go"], alternativeSpellings: [], partsOfSpeech: ["v5k"], tokenType: "verb" as const },
    ];
    const annotations = annotateJpdbTokens(tokens, subjects, [assignment(10, "vocabulary", 6), assignment(11, "vocabulary", 3)]);
    expect(annotations.map((item) => [item.subject?.id, item.known, item.srsStage])).toEqual([[10, true, 6], [11, false, 3]]);
    expect(readerPieces("学校へ行った", annotations).map((piece) => piece.kind === "text" ? piece.text : piece.annotation.text).join("")).toBe("学校へ行った");
  });

  it("never turns a kana particle into a same-sounding WaniKani kanji", () => {
    const gaKanji = subject(12, "kanji", "我", "I", "が");
    const [annotation] = annotateJpdbTokens([{
      start: 1,
      end: 2,
      surface: "が",
      spelling: "我",
      reading: "が",
      meaning: "I",
      meanings: ["I", "me"],
      alternativeSpellings: [],
      partsOfSpeech: ["n"],
      tokenType: "vocabulary",
    }], [gaKanji], []);

    expect(annotation?.subject).toBeNull();
    expect(annotation?.known).toBeNull();
  });

  it("prefers a vocabulary entry over its standalone kanji for word tokens", () => {
    const kanji = subject(13, "kanji", "水", "Water", "みず");
    const vocabulary = subject(14, "vocabulary", "水", "Water", "みず");
    const [annotation] = annotateJpdbTokens([{
      start: 0,
      end: 1,
      surface: "水",
      spelling: "水",
      reading: "みず",
      meaning: "water",
      meanings: ["water"],
      alternativeSpellings: [],
      partsOfSpeech: ["n"],
      tokenType: "vocabulary",
    }], [kanji, vocabulary], []);

    expect(annotation?.subject?.id).toBe(vocabulary.id);
  });

  it("names every live WaniKani SRS stage", () => {
    expect([null, 0, 1, 4, 5, 6, 7, 8, 9].map(srsStageLabel)).toEqual(["Locked", "Lesson", "Apprentice I", "Apprentice IV", "Guru I", "Guru II", "Master", "Enlightened", "Burned"]);
  });
});
