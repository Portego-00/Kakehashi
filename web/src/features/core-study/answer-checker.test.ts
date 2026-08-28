import { describe, expect, it } from "vitest";
import type { StudyMaterial, Subject } from "@/types/wanikani";
import { checkAnswer, levenshtein, normalizeReading } from "./answer-checker";

function buildSubject(data: Partial<Subject["data"]> = {}, object: Subject["object"] = "vocabulary"): Subject {
  return {
    id: 1,
    object,
    url: "",
    data_updated_at: "",
    data: {
      level: 1,
      created_at: "",
      slug: "川",
      document_url: "",
      hidden_at: null,
      characters: "川",
      meanings: [{ meaning: "River", primary: true, accepted_answer: true }],
      auxiliary_meanings: [
        { meaning: "Stream", type: "whitelist" },
        { meaning: "Water", type: "blacklist" },
      ],
      readings: [{ reading: "かわ", primary: true, accepted_answer: true, type: "kunyomi" }],
      ...data,
    },
  };
}

function buildMaterial(meaningSynonyms: string[]): StudyMaterial {
  return {
    id: 9,
    object: "study_material",
    url: "",
    data_updated_at: "",
    data: {
      subject_id: 1,
      subject_type: "vocabulary",
      meaning_synonyms: meaningSynonyms,
      meaning_note: null,
      reading_note: null,
      hidden: false,
      created_at: "",
    },
  };
}

describe("core answer checker", () => {
  it("normalizes romaji readings to hiragana", () => expect(normalizeReading("kawa")).toBe("かわ"));

  it("accepts WaniKani and user meanings, including close answers", () => {
    const material = buildMaterial(["watercourse"]);

    expect(checkAnswer(buildSubject(), "meaning", "stream", material).status).toBe("correct");
    expect(checkAnswer(buildSubject(), "meaning", "watercourse", material).status).toBe("correct");
    expect(checkAnswer(buildSubject(), "meaning", "watercorse", material)).toMatchObject({ status: "close", canonical: "River" });
    expect(checkAnswer(buildSubject(), "meaning", "rivr", material)).toMatchObject({ status: "close", canonical: "River" });
  });

  it("treats blacklisted meanings as incorrect like mobile", () => {
    expect(checkAnswer(buildSubject(), "meaning", "water").status).toBe("incorrect");
  });

  it("warns when the romaji reading 'mazu' is entered for the meaning of 先ず", () => {
    const mazu = buildSubject({
      characters: "先ず",
      meanings: [{ meaning: "First Of All", primary: true, accepted_answer: true }],
      readings: [{ reading: "まず", primary: true, accepted_answer: true }],
    });

    expect(checkAnswer(mazu, "meaning", "mazu")).toMatchObject({
      status: "blocked",
      message: "You entered the reading, but we want the meaning.",
    });
  });

  it.each([
    ["a kana reading on a meaning question", buildSubject(), "meaning", "かわ", "You entered the reading, but we want the meaning."],
    ["a romaji reading on a meaning question", buildSubject(), "meaning", "kawa", "You entered the reading, but we want the meaning."],
    ["the characters on a reading question", buildSubject(), "reading", "川", "You entered the kanji/characters, but we want the reading."],
    ["the meaning on a reading question", buildSubject(), "reading", "River", "Your answer contains non-kana characters."],
  ] as const)("returns a retryable warning for %s", (_label, item, kind, answer, message) => {
    expect(checkAnswer(item, kind, answer)).toMatchObject({ status: "blocked", message });
  });

  it("warns for a non-primary kanji reading instead of accepting it", () => {
    const kanji = buildSubject({
      readings: [
        { reading: "にち", primary: true, accepted_answer: true, type: "onyomi" },
        { reading: "じつ", primary: false, accepted_answer: true, type: "onyomi" },
      ],
    }, "kanji");

    expect(checkAnswer(kanji, "reading", "じつ")).toMatchObject({
      status: "blocked",
      message: "This is a valid reading, but WaniKani is looking for the primary reading (highlighted in the kanji details).",
    });
  });

  it("can accept another on'yomi when the mobile preference is enabled", () => {
    const kanji = buildSubject({
      readings: [
        { reading: "にち", primary: true, accepted_answer: true, type: "onyomi" },
        { reading: "じつ", primary: false, accepted_answer: true, type: "onyomi" },
      ],
    }, "kanji");

    expect(checkAnswer(kanji, "reading", "じつ", undefined, { acceptAnyKanjiOnyomiReading: true }).status).toBe("correct");
  });

  it("warns when a single-kanji vocabulary answer is only a kanji reading", () => {
    const vocabulary = buildSubject({
      characters: "生",
      readings: [{ reading: "なま", primary: true, accepted_answer: true }],
    });

    expect(checkAnswer(vocabulary, "reading", "せい", undefined, {
      singleKanjiReadings: { 生: ["せい", "しょう"] },
    })).toMatchObject({
      status: "blocked",
      message: "This is a reading for the individual kanji, not the vocabulary.",
    });
  });

  it("warns about the common n-before-y conversion mistake", () => {
    const vocabulary = buildSubject({
      characters: "今夜",
      readings: [{ reading: "こんや", primary: true, accepted_answer: true }],
    });

    expect(checkAnswer(vocabulary, "reading", "こにゃ")).toMatchObject({
      status: "blocked",
      message: "Try typing \"nn\" for ん before vowels or y.",
    });
  });

  it("computes edit distance", () => expect(levenshtein("kitten", "sitting")).toBe(3));
});
